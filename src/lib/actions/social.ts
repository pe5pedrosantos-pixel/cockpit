"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq, gte, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { smIdeas, smLines, smMetrics, smPosts, smRequests } from "@/lib/db/schema";
import { getSession } from "@/lib/auth";
import {
  addAnalysis,
  addIdeas,
  approvePost,
  attachStoredMedia,
  copyMediaFromUrls,
  moveMedia,
  removeMedia,
  createRequest,
  deletePost,
  deleteRequest,
  getPost,
  getSettings,
  prepareSocialDb,
  requestAdjustment,
  saveLine,
  savePost,
  saveSettings,
  setIdeaStatus,
  SocialError,
  updateRequest,
} from "@/lib/social/service";
import { lineInput, postInput, requestInput, requestUpdate } from "@/lib/social/schemas";
import {
  AiError,
  analyzePerformance,
  answerRequest,
  generateIdeas,
  writeCaption,
} from "@/lib/social/ai";
import { addDays } from "@/lib/social/constants";
import { StorageError } from "@/lib/social/storage";
import { todayISO } from "@/lib/format";

export type Result<T = undefined> = { ok: boolean; message: string; data?: T };

async function requireAuth() {
  const session = await getSession();
  if (!session) throw new Error("Não autenticado");
}

function done() {
  revalidatePath("/social");
}

function firstIssue(e: z.ZodError) {
  const i = e.issues[0];
  return i ? `${i.path.length ? `${i.path.join(".")}: ` : ""}${i.message}` : "Dados inválidos.";
}

/** Executa com tratamento de erro padrão das telas. */
async function run<T>(fn: () => Promise<Result<T>>): Promise<Result<T>> {
  try {
    await requireAuth();
    const r = await fn();
    done();
    return r;
  } catch (e) {
    if (e instanceof SocialError || e instanceof AiError || e instanceof StorageError) {
      return { ok: false, message: e.message };
    }
    if (e instanceof z.ZodError) return { ok: false, message: firstIssue(e) };
    console.error("[social]", e);
    return { ok: false, message: "Algo deu errado. Tente de novo." };
  }
}

// ─── Banco ────────────────────────────────────────────────────────────────

export async function prepareSocialAction(): Promise<Result> {
  return run(async () => {
    await prepareSocialDb();
    return { ok: true, message: "Banco pronto. As linhas editoriais padrão foram criadas." };
  });
}

// ─── Posts ────────────────────────────────────────────────────────────────

export async function savePostAction(input: unknown): Promise<Result<{ id: number }>> {
  return run(async () => {
    const d = postInput.parse(input);
    const post = await savePost(d, "pedro");
    return { ok: true, message: d.id ? "Post salvo." : "Post criado.", data: { id: post.id } };
  });
}

export async function deletePostAction(id: number): Promise<Result> {
  return run(async () => {
    await deletePost(id);
    return { ok: true, message: "Post removido." };
  });
}

export async function approvePostsAction(ids: number[]): Promise<Result> {
  return run(async () => {
    const list = z.array(z.number().int().positive()).min(1).max(40).parse(ids);
    for (const id of list) await approvePost(id, "pedro");
    return {
      ok: true,
      message:
        list.length === 1
          ? "Aprovado. O agente agenda no Metricool."
          : `${list.length} posts aprovados. O agente agenda no Metricool.`,
    };
  });
}

export async function adjustPostAction(id: number, text: string): Promise<Result> {
  return run(async () => {
    await requestAdjustment(id, text, "pedro");
    return { ok: true, message: "Pedido de ajuste enviado ao agente." };
  });
}

/** Pede ao agente uma peça (arte, vídeo, legenda) ligada a um post. */
export async function askAgentForPostAction(
  postId: number,
  kind: "arte" | "video" | "legenda" | "agendar",
  details?: string
): Promise<Result> {
  return run(async () => {
    const post = await getPost(postId);
    if (!post) throw new SocialError("Post não encontrado.");
    const labels = { arte: "Criar arte", video: "Criar vídeo", legenda: "Escrever legendas", agendar: "Agendar no Metricool" };
    const target = kind === "arte" ? "canva" : kind === "video" ? "higgsfield" : kind === "agendar" ? "metricool" : "claude";
    const [open] = await db
      .select({ id: smRequests.id })
      .from(smRequests)
      .where(
        and(eq(smRequests.postId, postId), eq(smRequests.kind, kind), inArray(smRequests.status, ["aberta", "em_andamento"]))
      );
    if (open) return { ok: true, message: "Já existe um pedido aberto para isso." };
    await createRequest(
      {
        titulo: `${labels[kind]}: ${post.title} (${post.date.slice(8, 10)}/${post.date.slice(5, 7)})`,
        detalhes: details?.trim() || null,
        tipo: kind,
        destino: target,
        postId,
        prioridade: post.date <= addDays(todayISO(), 2) ? "alta" : "normal",
        prazo: post.date,
      },
      "pedro"
    );
    if (kind !== "agendar" && post.status === "planejado") {
      await db.update(smPosts).set({ status: "producao", updatedAt: new Date() }).where(eq(smPosts.id, postId));
    }
    return { ok: true, message: "Pedido enviado ao agente." };
  });
}

// ─── Mídias ───────────────────────────────────────────────────────────────

const uploadedFile = z.object({
  url: z.string().url(),
  pathname: z.string().max(500).nullable().optional(),
  contentType: z.string().max(120).nullable().optional(),
  size: z.number().int().min(0).nullable().optional(),
  name: z.string().max(200).nullable().optional(),
});

/** Liga ao post um arquivo que o navegador acabou de subir para o Blob. */
export async function attachUploadedMediaAction(postId: number, file: unknown): Promise<Result> {
  return run(async () => {
    await attachStoredMedia(postId, uploadedFile.parse(file), "pedro");
    return { ok: true, message: "Arquivo anexado." };
  });
}

/** Copia para o cockpit um arquivo de um link público (Drive, Canva...). */
export async function attachMediaFromUrlAction(postId: number, url: string): Promise<Result> {
  return run(async () => {
    const link = z.string().trim().url("Cole um link completo, começando com https://").parse(url);
    const { saved, failed } = await copyMediaFromUrls(postId, [link], { source: "upload" }, "pedro");
    if (!saved.length) throw new SocialError(failed[0]?.erro ?? "Não consegui copiar o arquivo.");
    return { ok: true, message: "Arquivo copiado para o cockpit." };
  });
}

export async function removeMediaAction(id: number): Promise<Result> {
  return run(async () => {
    await removeMedia(id);
    return { ok: true, message: "Arquivo removido." };
  });
}

export async function moveMediaAction(id: number, dir: -1 | 1): Promise<Result> {
  return run(async () => {
    await moveMedia(id, dir === -1 ? -1 : 1);
    return { ok: true, message: "" };
  });
}

// ─── Solicitações ─────────────────────────────────────────────────────────

export async function createRequestAction(input: unknown): Promise<Result> {
  return run(async () => {
    const d = requestInput.parse(input);
    await createRequest(d, "pedro");
    return { ok: true, message: d.destino === "pedro" ? "Lembrete criado." : "Pedido enviado ao agente." };
  });
}

export async function updateRequestAction(input: unknown): Promise<Result> {
  return run(async () => {
    const d = requestUpdate.parse(input);
    await updateRequest(d, "pedro");
    return { ok: true, message: "Solicitação atualizada." };
  });
}

export async function deleteRequestAction(id: number): Promise<Result> {
  return run(async () => {
    await deleteRequest(id);
    return { ok: true, message: "Solicitação removida." };
  });
}

/** Pede ao agente para trazer as métricas do Metricool para o cockpit. */
export async function requestMetricsAction(): Promise<Result> {
  return run(async () => {
    const [open] = await db
      .select({ id: smRequests.id })
      .from(smRequests)
      .where(and(eq(smRequests.kind, "metricas"), inArray(smRequests.status, ["aberta", "em_andamento"])));
    if (open) return { ok: true, message: "O pedido de métricas já está na fila do agente." };
    await createRequest(
      {
        titulo: "Atualizar métricas do Metricool no cockpit",
        detalhes:
          "Ler no Metricool as publicações dos últimos 60 dias (Instagram feed e reels, LinkedIn) e gravar com registrar_metricas.",
        tipo: "metricas",
        destino: "metricool",
        prioridade: "normal",
      },
      "pedro"
    );
    return { ok: true, message: "Pedido enviado. O agente traz as métricas na próxima rodada." };
  });
}

// ─── Linhas e ideias ──────────────────────────────────────────────────────

export async function saveLineAction(input: unknown): Promise<Result> {
  return run(async () => {
    const d = lineInput.parse(input);
    await saveLine(d);
    return { ok: true, message: "Linha salva." };
  });
}

export async function setIdeaStatusAction(id: number, status: string): Promise<Result> {
  return run(async () => {
    const s = z.enum(["nova", "aprovada", "usada", "descartada"]).parse(status);
    await setIdeaStatus(id, s);
    return { ok: true, message: s === "descartada" ? "Ideia descartada." : "Ideia atualizada." };
  });
}

/** Leva uma ideia para o calendário como post planejado. */
export async function ideaToPostAction(id: number, date: string): Promise<Result> {
  return run(async () => {
    const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Escolha a data").parse(date);
    const [idea] = await db.select().from(smIdeas).where(eq(smIdeas.id, id));
    if (!idea) throw new SocialError("Ideia não encontrada.");
    await savePost(
      {
        data: day,
        titulo: idea.title,
        linha: idea.lineSlug,
        formato: idea.format,
        notas: [idea.hook ? `Gancho: ${idea.hook}` : null, idea.details].filter(Boolean).join("\n") || null,
        status: "planejado",
      },
      "pedro"
    );
    await setIdeaStatus(id, "usada");
    return { ok: true, message: "Ideia no calendário." };
  });
}

// ─── Configurações ────────────────────────────────────────────────────────

export async function saveTimesAction(linkedin: string, instagram: string): Promise<Result> {
  return run(async () => {
    const t = z.string().regex(/^\d{2}:\d{2}$/, "Hora no formato HH:MM");
    await saveSettings({ horarios: { linkedin: t.parse(linkedin), instagram: t.parse(instagram) } });
    return { ok: true, message: "Horários salvos." };
  });
}

// ─── Claude dentro do cockpit (API da Anthropic) ──────────────────────────

export async function aiIdeasAction(lineSlug: string, count: number, hint?: string): Promise<Result> {
  return run(async () => {
    const [line] = await db.select().from(smLines).where(eq(smLines.slug, lineSlug));
    if (!line) throw new SocialError("Linha não encontrada.");
    const recent = await db
      .select({ title: smPosts.title })
      .from(smPosts)
      .where(and(eq(smPosts.lineSlug, lineSlug), gte(smPosts.date, addDays(todayISO(), -60))))
      .orderBy(desc(smPosts.date))
      .limit(30);
    const ideas = await generateIdeas({
      line: { slug: line.slug, name: line.name, objective: line.objective, scope: line.scope, formats: line.formats },
      count: Math.min(Math.max(count, 1), 10),
      hint,
      recentTitles: recent.map((r) => r.title),
    });
    await addIdeas(ideas.map((i) => ({ ...i, linha: lineSlug })), "ia");
    return { ok: true, message: `${ideas.length} ideias novas em ${line.name}.` };
  });
}

/** Devolve a legenda escrita; quem salva é o formulário do post. */
export async function aiCaptionAction(
  postId: number,
  network: "linkedin" | "instagram",
  instruction?: string,
  draft?: { title?: string; captionLinkedin?: string | null; captionInstagram?: string | null }
): Promise<Result<{ text: string }>> {
  try {
    await requireAuth();
    const post = await getPost(postId);
    if (!post) return { ok: false, message: "Post não encontrado." };
    const [line] = post.lineSlug
      ? await db.select({ name: smLines.name }).from(smLines).where(eq(smLines.slug, post.lineSlug))
      : [];
    const li = draft?.captionLinkedin ?? post.captionLinkedin;
    const ig = draft?.captionInstagram ?? post.captionInstagram;
    const text = await writeCaption({
      network,
      post: {
        title: draft?.title || post.title,
        format: post.format,
        lineName: line?.name ?? null,
        notes: post.notes,
        sourceName: post.sourceName,
        sourceUrl: post.sourceUrl,
      },
      current: network === "linkedin" ? li : ig,
      other: network === "linkedin" ? ig : li,
      instruction: instruction?.trim() || undefined,
    });
    return { ok: true, message: "Legenda pronta. Revise e salve.", data: { text } };
  } catch (e) {
    if (e instanceof AiError) return { ok: false, message: e.message };
    console.error("[social] legenda", e);
    return { ok: false, message: "Não foi possível escrever a legenda agora." };
  }
}

export async function aiAnalyzeAction(days: number): Promise<Result> {
  return run(async () => {
    const span = [30, 60, 90].includes(days) ? days : 30;
    const since = new Date(Date.now() - span * 86_400_000);
    const rows = await db
      .select()
      .from(smMetrics)
      .where(gte(smMetrics.publishedAt, since))
      .orderBy(desc(smMetrics.publishedAt))
      .limit(150);
    if (rows.length < 3) {
      throw new SocialError("Ainda há poucas publicações com métricas. Peça ao agente para atualizar as métricas primeiro.");
    }
    const n = (v: number | null) => v ?? 0;
    const table = rows
      .map((m) => {
        const day = m.publishedAt
          ? new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "short", day: "2-digit", month: "2-digit" }).format(m.publishedAt)
          : "?";
        const watch = m.avgWatchSeconds ? ` | tempo médio ${Number(m.avgWatchSeconds).toFixed(1)}s` : "";
        const rate = m.viewRate ? ` | taxa de visualização ${Number(m.viewRate).toFixed(1)}%` : "";
        return `${m.network} | ${m.kind ?? "post"} | ${day} | curtidas ${n(m.likes)} | coment. ${n(m.comments)} | salvos ${n(m.saves)} | compart. ${n(m.shares)} | alcance ${n(m.reach)} | impressões ${n(m.impressions)} | cliques ${n(m.clicks)}${watch}${rate} | "${(m.text ?? "").replace(/\s+/g, " ").slice(0, 90)}"`;
      })
      .join("\n");
    const totals = ["instagram", "linkedin"]
      .map((net) => {
        const list = rows.filter((r) => r.network === net);
        if (!list.length) return `${net}: sem dados`;
        const sum = (k: "likes" | "comments" | "saves" | "shares" | "reach" | "impressions") =>
          list.reduce((s, r) => s + n(r[k]), 0);
        return `${net}: ${list.length} posts, curtidas ${sum("likes")}, comentários ${sum("comments")}, salvos ${sum("saves")}, compartilhamentos ${sum("shares")}, alcance ${sum("reach")}, impressões ${sum("impressions")}`;
      })
      .join("\n");
    const out = await analyzePerformance({ period: `últimos ${span} dias`, table, totals });
    await addAnalysis({ periodo: `Últimos ${span} dias`, resumo: out.resumo, pontos: out.pontos }, "ia");
    return { ok: true, message: "Análise pronta." };
  });
}

export async function aiAnswerRequestAction(id: number): Promise<Result> {
  return run(async () => {
    const [r] = await db.select().from(smRequests).where(eq(smRequests.id, id));
    if (!r) throw new SocialError("Solicitação não encontrada.");
    const post = r.postId ? await getPost(r.postId) : null;
    const text = await answerRequest({
      title: r.title,
      details: r.details,
      kind: r.kind,
      post: post
        ? {
            title: post.title,
            date: post.date,
            format: post.format,
            captionLinkedin: post.captionLinkedin,
            captionInstagram: post.captionInstagram,
          }
        : null,
    });
    await updateRequest(
      { id, status: "concluida", resultado: text, nota: "Respondida pelo Claude do cockpit" },
      "ia"
    );
    return { ok: true, message: "O Claude respondeu. Veja o resultado na solicitação." };
  });
}

export async function getSettingsAction() {
  await requireAuth();
  return getSettings();
}
