import "server-only";
import { and, asc, desc, eq, gte, inArray, lte, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  smAnalyses,
  smIdeas,
  smLines,
  smMedia,
  smMetrics,
  smPosts,
  smRequests,
  smRuns,
  smSettings,
  type SmLogEntry,
  type SmMedia,
  type SmPost,
  type SmRequest,
} from "@/lib/db/schema";
import { SOCIAL_MIGRATIONS } from "@/lib/social/schema-sql";
import { copyFromUrl, isOwnBlobUrl, kindOf, removeFiles } from "@/lib/social/storage";
import {
  DEFAULT_GRID,
  DEFAULT_LINES,
  DEFAULT_TIMES,
  ROTATION,
  addDays,
  postStatusLabel,
} from "@/lib/social/constants";
import type {
  LineInput,
  MetricItem,
  PostInput,
  RequestInput,
} from "@/lib/social/schemas";
import { todayISO } from "@/lib/format";

/**
 * Regras da aba Social Media, usadas pelas telas (server actions) e pelo
 * conector MCP. Quem chama é responsável pela autenticação.
 * `by` diz quem fez a mudança: pedro | claude | ia.
 */

export type Actor = "pedro" | "claude" | "ia";

const now = () => new Date();

function logEntry(by: Actor, text: string): SmLogEntry {
  return { at: new Date().toISOString(), by, text };
}

function appendLog(entry: SmLogEntry) {
  return sql`${smRequests.log} || ${JSON.stringify([entry])}::jsonb`;
}

const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

// ─── Banco ────────────────────────────────────────────────────────────────

/** Roda as migrações da aba (todas idempotentes). */
async function runMigrations() {
  for (const migration of SOCIAL_MIGRATIONS) {
    const statements = migration
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const statement of statements) {
      await db.execute(sql.raw(statement));
    }
  }
}

let upgrade: Promise<void> | null = null;

/**
 * A aba está pronta? Antes do primeiro "Preparar banco", não. Se o banco já
 * foi preparado numa versão anterior, aplica sozinho as tabelas novas
 * (CREATE ... IF NOT EXISTS), uma vez por instância do servidor.
 */
export async function isSocialReady(): Promise<boolean> {
  try {
    const res = await db.execute(
      sql`select to_regclass('public.sm_settings') as settings, to_regclass('public.sm_media') as media`
    );
    const row = (res as unknown as { rows: { settings: string | null; media: string | null }[] }).rows?.[0];
    if (!row?.settings) return false;
    const [geral] = await db.select({ key: smSettings.key }).from(smSettings).where(eq(smSettings.key, "geral"));
    if (!geral) return false;
    if (!row.media) {
      upgrade ??= runMigrations().catch((e) => {
        upgrade = null;
        throw e;
      });
      await upgrade;
    }
    return true;
  } catch (e) {
    console.error("[social] verificação do banco", e);
    return false;
  }
}

/** Cria as tabelas (idempotente) e grava linhas e configurações padrão. */
export async function prepareSocialDb() {
  await runMigrations();
  await db
    .insert(smLines)
    .values(DEFAULT_LINES.map((l) => ({ ...l })))
    .onConflictDoNothing({ target: smLines.slug });
  await db
    .insert(smSettings)
    .values({ key: "geral", value: { horarios: DEFAULT_TIMES, grade: DEFAULT_GRID } })
    .onConflictDoNothing({ target: smSettings.key });
}

// ─── Configurações ────────────────────────────────────────────────────────

export type SocialSettings = {
  horarios: { linkedin: string; instagram: string };
  grade: Record<string, { linha: string; peca: string }>;
  links?: Record<string, string>;
  rotinas?: Record<string, string>;
};

export async function getSettings(): Promise<SocialSettings> {
  const [row] = await db.select().from(smSettings).where(eq(smSettings.key, "geral"));
  const value = (row?.value ?? {}) as Partial<SocialSettings>;
  return {
    horarios: { ...DEFAULT_TIMES, ...(value.horarios ?? {}) },
    grade: { ...DEFAULT_GRID, ...(value.grade ?? {}) },
    links: value.links,
    rotinas: value.rotinas,
  };
}

export async function saveSettings(patch: Partial<SocialSettings>) {
  const current = await getSettings();
  const value = { ...current, ...patch };
  await db
    .insert(smSettings)
    .values({ key: "geral", value })
    .onConflictDoUpdate({ target: smSettings.key, set: { value, updatedAt: now() } });
  return value;
}

// ─── Posts ────────────────────────────────────────────────────────────────

/** Converte a entrada (nomes em português) para colunas do banco. */
function postColumns(d: Partial<PostInput>) {
  const out: Partial<typeof smPosts.$inferInsert> = {};
  const set = <K extends keyof typeof smPosts.$inferInsert>(k: K, v: unknown) => {
    if (v !== undefined) out[k] = v as (typeof smPosts.$inferInsert)[K];
  };
  set("externalKey", d.chaveExterna);
  set("date", d.data);
  set("extra", d.extra);
  set("lineSlug", d.linha);
  set("title", d.titulo);
  set("format", d.formato);
  set("background", d.fundo);
  set("status", d.status);
  set("networks", d.redes);
  set("timeLinkedin", d.horaLinkedin);
  set("timeInstagram", d.horaInstagram);
  set("captionLinkedin", d.legendaLinkedin);
  set("captionInstagram", d.legendaInstagram);
  set("firstCommentLinkedin", d.primeiroComentarioLinkedin);
  set("firstCommentInstagram", d.primeiroComentarioInstagram);
  set("artUrl", d.arteUrl);
  set("previewUrl", d.previewUrl);
  set("sourceName", d.fonteNome);
  set("sourceUrl", d.fonteUrl);
  set("notes", d.notas);
  set("pending", d.pendencia);
  set("adjustRequest", d.ajuste);
  set("metricoolIdLinkedin", d.metricoolIdLinkedin);
  set("metricoolIdInstagram", d.metricoolIdInstagram);
  set("urlLinkedin", d.urlLinkedin);
  set("urlInstagram", d.urlInstagram);
  return out;
}

export class SocialError extends Error {}

/**
 * Cria ou atualiza um post. Sem id e com chaveExterna já existente, atualiza
 * o post dessa chave (importação idempotente).
 */
export async function savePost(d: Partial<PostInput>, by: Actor): Promise<SmPost> {
  const cols = postColumns(d);
  let id = d.id;
  if (!id && d.chaveExterna) {
    const [found] = await db
      .select({ id: smPosts.id })
      .from(smPosts)
      .where(eq(smPosts.externalKey, d.chaveExterna));
    id = found?.id;
  }
  if (id) {
    const [before] = cols.status
      ? await db.select({ status: smPosts.status }).from(smPosts).where(eq(smPosts.id, id))
      : [];
    if (cols.status === "aprovado" && before?.status !== "aprovado") cols.approvedAt = now();
    const [row] = await db
      .update(smPosts)
      .set({ ...cols, updatedBy: by, updatedAt: now() })
      .where(eq(smPosts.id, id))
      .returning();
    if (!row) throw new SocialError(`Post ${id} não encontrado.`);
    if (cols.status && cols.status !== before?.status) {
      await closeRequestsFor(row.id, cols.status, by);
      if (cols.status === "aprovado") await ensureScheduleRequest(row, by);
    }
    return row;
  }
  if (!cols.date) throw new SocialError("Informe a data do post (AAAA-MM-DD).");
  if (!cols.title) throw new SocialError("Informe o título do post.");
  const settings = await getSettings();
  const [row] = await db
    .insert(smPosts)
    .values({
      timeLinkedin: settings.horarios.linkedin,
      timeInstagram: settings.horarios.instagram,
      ...cols,
      date: cols.date,
      title: cols.title,
      background: cols.background === undefined ? await suggestBackground(cols.date) : cols.background,
      updatedBy: by,
    })
    .returning();
  return row;
}

/**
 * Fecha sozinho o que o novo status já resolveu: post agendado fecha o
 * pedido de agendamento; post de volta em "aguardando OK" fecha o ajuste.
 */
async function closeRequestsFor(postId: number, status: string, by: Actor) {
  const kinds =
    status === "agendado" || status === "publicado"
      ? ["agendar"]
      : status === "aguardando_ok"
        ? ["ajuste", "arte", "video"]
        : status === "aprovado"
          ? ["ajuste"]
          : [];
  if (!kinds.length) return;
  await db
    .update(smRequests)
    .set({
      status: "concluida",
      completedAt: now(),
      updatedAt: now(),
      log: appendLog(logEntry(by, `Concluída: o post passou para "${postStatusLabel(status)}"`)),
    })
    .where(
      and(
        eq(smRequests.postId, postId),
        inArray(smRequests.kind, kinds),
        inArray(smRequests.status, ["aberta", "em_andamento"])
      )
    );
}

export async function getPost(id: number) {
  const [row] = await db.select().from(smPosts).where(eq(smPosts.id, id));
  return row ?? null;
}

export async function listPosts(opts: { from?: string; to?: string; status?: string[] } = {}) {
  const conds = [];
  if (opts.from) conds.push(gte(smPosts.date, opts.from));
  if (opts.to) conds.push(lte(smPosts.date, opts.to));
  if (opts.status?.length) conds.push(inArray(smPosts.status, opts.status));
  return db
    .select()
    .from(smPosts)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(asc(smPosts.date), asc(smPosts.extra), asc(smPosts.id));
}

export async function deletePost(id: number) {
  const files = await db.select({ url: smMedia.url }).from(smMedia).where(eq(smMedia.postId, id));
  await db.delete(smPosts).where(eq(smPosts.id, id));
  await removeFiles(files.map((f) => f.url));
}

// ─── Mídias (slides, vídeo, PDF) ──────────────────────────────────────────

export async function listMedia(postIds: number[]): Promise<SmMedia[]> {
  if (!postIds.length) return [];
  return db
    .select()
    .from(smMedia)
    .where(inArray(smMedia.postId, postIds))
    .orderBy(asc(smMedia.postId), asc(smMedia.position), asc(smMedia.id));
}

async function nextPosition(postId: number) {
  const [row] = await db
    .select({ max: sql<number>`coalesce(max(${smMedia.position}), -1)` })
    .from(smMedia)
    .where(eq(smMedia.postId, postId));
  return Number(row?.max ?? -1) + 1;
}

/** Registra um arquivo que já está no Blob deste projeto (upload do Pedro). */
export async function attachStoredMedia(
  postId: number,
  file: { url: string; pathname?: string | null; contentType?: string | null; size?: number | null; name?: string | null },
  by: Actor
) {
  if (!isOwnBlobUrl(file.url)) throw new SocialError("O arquivo precisa estar no armazenamento do cockpit.");
  const post = await getPost(postId);
  if (!post) throw new SocialError("Post não encontrado.");
  const [row] = await db
    .insert(smMedia)
    .values({
      postId,
      url: file.url,
      pathname: file.pathname ?? null,
      contentType: file.contentType ?? null,
      size: file.size ?? null,
      name: file.name ?? null,
      kind: kindOf(file.contentType, file.name ?? file.url),
      position: await nextPosition(postId),
      source: by === "pedro" ? "upload" : by,
    })
    .returning();
  await db.update(smPosts).set({ updatedBy: by, updatedAt: now() }).where(eq(smPosts.id, postId));
  return row;
}

/**
 * Copia arquivos de links públicos para o Blob e liga ao post, na ordem
 * recebida. Com replace, apaga as mídias anteriores do post.
 */
export async function copyMediaFromUrls(
  postId: number,
  urls: string[],
  opts: { replace?: boolean; source?: string },
  by: Actor
) {
  const post = await getPost(postId);
  if (!post) throw new SocialError(`Post ${postId} não encontrado.`);
  const saved: SmMedia[] = [];
  const failed: { url: string; erro: string }[] = [];
  const copies: { url: string; result: Awaited<ReturnType<typeof copyFromUrl>> | null }[] = [];
  for (const url of urls) {
    try {
      copies.push({ url, result: isOwnBlobUrl(url) ? null : await copyFromUrl(url, `social/post-${postId}`) });
    } catch (e) {
      failed.push({ url, erro: e instanceof Error ? e.message : "falhou" });
    }
  }
  if (opts.replace && copies.length) {
    const old = await db.select().from(smMedia).where(eq(smMedia.postId, postId));
    await db.delete(smMedia).where(eq(smMedia.postId, postId));
    await removeFiles(old.map((m) => m.url));
  }
  let position = await nextPosition(postId);
  for (const c of copies) {
    const r = c.result;
    const [row] = await db
      .insert(smMedia)
      .values({
        postId,
        url: r?.url ?? c.url,
        pathname: r?.pathname ?? null,
        contentType: r?.contentType ?? null,
        size: r?.size ?? null,
        name: r?.name ?? null,
        kind: r?.kind ?? kindOf(null, c.url),
        position: position++,
        source: opts.source ?? by,
        originalUrl: r ? c.url : null,
      })
      .returning();
    saved.push(row);
  }
  if (saved.length) {
    await db.update(smPosts).set({ updatedBy: by, updatedAt: now() }).where(eq(smPosts.id, postId));
  }
  return { saved, failed };
}

export async function removeMedia(id: number) {
  const [row] = await db.delete(smMedia).where(eq(smMedia.id, id)).returning();
  if (!row) throw new SocialError("Arquivo não encontrado.");
  await removeFiles([row.url]);
  return row;
}

/** Troca a posição com o vizinho (dir -1 = antes, 1 = depois). */
export async function moveMedia(id: number, dir: -1 | 1) {
  const [item] = await db.select().from(smMedia).where(eq(smMedia.id, id));
  if (!item) throw new SocialError("Arquivo não encontrado.");
  const list = await db
    .select()
    .from(smMedia)
    .where(eq(smMedia.postId, item.postId))
    .orderBy(asc(smMedia.position), asc(smMedia.id));
  const idx = list.findIndex((m) => m.id === id);
  const other = list[idx + dir];
  if (!other) return;
  // renumera em sequência e troca os dois
  const order = list.map((m) => m.id);
  [order[idx], order[idx + dir]] = [order[idx + dir], order[idx]];
  for (let i = 0; i < order.length; i++) {
    await db.update(smMedia).set({ position: i }).where(eq(smMedia.id, order[i]));
  }
}

/**
 * Fundo sugerido para um dia: o primeiro da rotação diferente do fundo do
 * post principal do dia anterior e do dia seguinte.
 */
export async function suggestBackground(date: string): Promise<string> {
  const near = await db
    .select({ date: smPosts.date, background: smPosts.background })
    .from(smPosts)
    .where(
      and(
        inArray(smPosts.date, [addDays(date, -1), addDays(date, 1)]),
        eq(smPosts.extra, false),
        ne(smPosts.status, "cancelado")
      )
    );
  const taken = new Set(near.map((p) => p.background));
  const start = (Number(date.slice(8, 10)) + Number(date.slice(5, 7))) % ROTATION.length;
  for (let i = 0; i < ROTATION.length; i++) {
    const bg = ROTATION[(start + i) % ROTATION.length];
    if (!taken.has(bg)) return bg;
  }
  return ROTATION[start];
}

/** Abre o pedido de agendamento no Metricool, se ainda não houver um aberto. */
async function ensureScheduleRequest(post: SmPost, by: Actor) {
  const [open] = await db
    .select({ id: smRequests.id })
    .from(smRequests)
    .where(
      and(
        eq(smRequests.postId, post.id),
        eq(smRequests.kind, "agendar"),
        inArray(smRequests.status, ["aberta", "em_andamento"])
      )
    );
  if (open) return;
  await createRequest(
    {
      titulo: `Agendar no Metricool: ${post.title} (${ddmm(post.date)})`,
      detalhes: `Post aprovado em ${ddmm(todayISO())}. Agendar nas redes do post, nos horários do post.`,
      tipo: "agendar",
      destino: "metricool",
      postId: post.id,
      prioridade: post.date <= addDays(todayISO(), 1) ? "alta" : "normal",
      prazo: post.date,
    },
    by
  );
}

/** Aprova: o post fica pronto para o agente agendar no Metricool. */
export async function approvePost(id: number, by: Actor) {
  const post = await getPost(id);
  if (!post) throw new SocialError("Post não encontrado.");
  const [row] = await db
    .update(smPosts)
    .set({ status: "aprovado", approvedAt: now(), adjustRequest: null, updatedBy: by, updatedAt: now() })
    .where(eq(smPosts.id, id))
    .returning();
  await closeRequestsFor(id, "aprovado", by);
  await ensureScheduleRequest(row, by);
}

/** Pede ajuste: volta para o agente com o pedido escrito. */
export async function requestAdjustment(id: number, text: string, by: Actor) {
  const post = await getPost(id);
  if (!post) throw new SocialError("Post não encontrado.");
  const note = text.trim();
  if (!note) throw new SocialError("Escreva o que precisa mudar.");
  await db
    .update(smPosts)
    .set({ status: "ajuste", adjustRequest: note, updatedBy: by, updatedAt: now() })
    .where(eq(smPosts.id, id));
  // um post em ajuste não pode ser agendado: cancela o pedido de agendamento aberto
  await db
    .update(smRequests)
    .set({
      status: "cancelada",
      updatedAt: now(),
      log: appendLog(logEntry(by, "Cancelada: o Pedro pediu ajuste no post")),
    })
    .where(
      and(eq(smRequests.postId, id), eq(smRequests.kind, "agendar"), inArray(smRequests.status, ["aberta", "em_andamento"]))
    );
  await createRequest(
    {
      titulo: `Ajustar: ${post.title} (${ddmm(post.date)})`,
      detalhes: note,
      tipo: "ajuste",
      destino: "claude",
      postId: id,
      prioridade: post.date <= addDays(todayISO(), 2) ? "alta" : "normal",
      prazo: post.date,
    },
    by
  );
}

/** Posts principais seguidos com o mesmo fundo (regra "jamais igual"). */
export function rotationConflicts(posts: Pick<SmPost, "date" | "extra" | "background" | "status">[]) {
  const main = posts
    .filter((p) => !p.extra && p.status !== "cancelado" && p.background && p.background !== "video")
    .sort((a, b) => a.date.localeCompare(b.date));
  const out: string[] = [];
  for (let i = 1; i < main.length; i++) {
    const prev = main[i - 1];
    const cur = main[i];
    if (addDays(prev.date, 1) === cur.date && prev.background === cur.background) out.push(cur.date);
  }
  return out;
}

// ─── Linhas editoriais ────────────────────────────────────────────────────

export async function listLines() {
  return db.select().from(smLines).orderBy(asc(smLines.position), asc(smLines.name));
}

export async function saveLine(d: LineInput) {
  const cols: Partial<typeof smLines.$inferInsert> = {};
  if (d.nome !== undefined) cols.name = d.nome;
  if (d.cor !== undefined) cols.color = d.cor;
  if (d.ordem !== undefined) cols.position = d.ordem;
  if (d.ativa !== undefined) cols.active = d.ativa;
  if (d.frequencia !== undefined) cols.frequency = d.frequencia;
  if (d.objetivo !== undefined) cols.objective = d.objetivo;
  if (d.oQueEntra !== undefined) cols.scope = d.oQueEntra;
  if (d.formatos !== undefined) cols.formats = d.formatos;
  const [existing] = await db.select({ id: smLines.id }).from(smLines).where(eq(smLines.slug, d.slug));
  if (existing) {
    const [row] = await db
      .update(smLines)
      .set({ ...cols, updatedAt: now() })
      .where(eq(smLines.id, existing.id))
      .returning();
    return row;
  }
  if (!cols.name) throw new SocialError("Informe o nome da linha.");
  const [row] = await db
    .insert(smLines)
    .values({ ...cols, slug: d.slug, name: cols.name })
    .returning();
  return row;
}

// ─── Solicitações ─────────────────────────────────────────────────────────

export async function createRequest(d: RequestInput, by: Actor): Promise<SmRequest> {
  const direction = d.destino === "pedro" ? "para_pedro" : "para_claude";
  const [row] = await db
    .insert(smRequests)
    .values({
      direction,
      target: d.destino,
      kind: d.tipo,
      title: d.titulo,
      details: d.detalhes ?? null,
      postId: d.postId ?? null,
      priority: d.prioridade,
      dueDate: d.prazo ?? null,
      createdBy: by,
      log: [logEntry(by, "Solicitação criada")],
    })
    .returning();
  return row;
}

export async function updateRequest(
  d: { id: number; status?: string; resultado?: string | null; link?: string | null; nota?: string },
  by: Actor
) {
  const [current] = await db.select().from(smRequests).where(eq(smRequests.id, d.id));
  if (!current) throw new SocialError(`Solicitação ${d.id} não encontrada.`);
  const notes: string[] = [];
  if (d.status && d.status !== current.status) notes.push(`Status: ${current.status} → ${d.status}`);
  if (d.nota) notes.push(d.nota);
  if (d.resultado && d.resultado !== current.result) notes.push("Resultado registrado");
  const [row] = await db
    .update(smRequests)
    .set({
      ...(d.status ? { status: d.status } : {}),
      ...(d.resultado !== undefined ? { result: d.resultado } : {}),
      ...(d.link !== undefined ? { resultUrl: d.link } : {}),
      ...(d.status === "concluida" && current.status !== "concluida" ? { completedAt: now() } : {}),
      ...(d.status && d.status !== "concluida" ? { completedAt: null } : {}),
      ...(notes.length ? { log: appendLog(logEntry(by, notes.join(" · "))) } : {}),
      updatedAt: now(),
    })
    .where(eq(smRequests.id, d.id))
    .returning();
  return row;
}

export async function listRequests(
  opts: { status?: string[]; direction?: string; target?: string; limit?: number } = {}
) {
  const conds = [];
  if (opts.status?.length) conds.push(inArray(smRequests.status, opts.status));
  if (opts.direction) conds.push(eq(smRequests.direction, opts.direction));
  if (opts.target) conds.push(eq(smRequests.target, opts.target));
  return db
    .select()
    .from(smRequests)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(
      sql`case ${smRequests.status} when 'em_andamento' then 0 when 'aberta' then 1 else 2 end`,
      sql`case ${smRequests.priority} when 'alta' then 0 else 1 end`,
      desc(smRequests.createdAt)
    )
    .limit(Math.min(opts.limit ?? 100, 300));
}

export async function deleteRequest(id: number) {
  await db.delete(smRequests).where(eq(smRequests.id, id));
}

// ─── Métricas, análises, ideias e execuções ───────────────────────────────

const int = (v: number | null | undefined) => (v == null ? null : Math.round(v));
const dec = (v: number | null | undefined) => (v == null ? null : String(v));

export async function upsertMetrics(items: MetricItem[]) {
  let saved = 0;
  for (const m of items) {
    const values = {
      network: m.rede,
      url: m.url,
      kind: m.tipo ?? null,
      publishedAt: m.publicadoEm ? new Date(m.publicadoEm) : null,
      text: m.texto ?? null,
      likes: int(m.curtidas),
      comments: int(m.comentarios),
      saves: int(m.salvos),
      shares: int(m.compartilhamentos),
      reach: int(m.alcance),
      impressions: int(m.impressoes),
      clicks: int(m.cliques),
      videoViews: int(m.visualizacoesVideo),
      follows: int(m.seguidores),
      avgWatchSeconds: dec(m.tempoMedioSeg),
      totalWatchSeconds: dec(m.tempoTotalSeg),
      viewRate: dec(m.taxaVisualizacao),
      postId: m.postId ?? null,
      syncedAt: now(),
    };
    if (values.publishedAt && Number.isNaN(values.publishedAt.getTime())) values.publishedAt = null;
    // só sobrescreve o que veio preenchido: uma leitura parcial não apaga números
    const update = Object.fromEntries(
      Object.entries(values).filter(([k, v]) => v !== null && k !== "network" && k !== "url")
    );
    await db
      .insert(smMetrics)
      .values(values)
      .onConflictDoUpdate({ target: [smMetrics.network, smMetrics.url], set: update });
    saved++;
  }
  // liga métricas aos posts pelo link publicado
  await db.execute(sql`
    update sm_metrics m set post_id = p.id
    from sm_posts p
    where m.post_id is null
      and ((m.network = 'linkedin' and p.url_linkedin = m.url)
        or (m.network = 'instagram' and p.url_instagram = m.url))
  `);
  return saved;
}

export async function addAnalysis(
  d: { periodo?: string | null; resumo: string; pontos: { titulo: string; detalhe: string; acao?: string }[] },
  by: Actor
) {
  const [row] = await db
    .insert(smAnalyses)
    .values({ period: d.periodo ?? null, summary: d.resumo, points: d.pontos, source: by === "ia" ? "ia" : "claude" })
    .returning();
  return row;
}

export async function addIdeas(
  ideas: { linha?: string | null; titulo: string; gancho?: string | null; formato?: string | null; detalhes?: string | null }[],
  by: Actor
) {
  if (!ideas.length) return [];
  return db
    .insert(smIdeas)
    .values(
      ideas.map((i) => ({
        lineSlug: i.linha ?? null,
        title: i.titulo,
        hook: i.gancho ?? null,
        format: i.formato ?? null,
        details: i.detalhes ?? null,
        source: by,
      }))
    )
    .returning();
}

export async function setIdeaStatus(id: number, status: string) {
  await db.update(smIdeas).set({ status }).where(eq(smIdeas.id, id));
}

export async function addRun(d: {
  rotina: string;
  resultado: string;
  resumo: string;
  detalhes?: string | null;
  quando?: string;
}) {
  const at = d.quando ? new Date(d.quando) : null;
  const [row] = await db
    .insert(smRuns)
    .values({
      routine: d.rotina,
      result: d.resultado,
      summary: d.resumo,
      details: d.detalhes ?? null,
      ...(at && !Number.isNaN(at.getTime()) ? { ranAt: at } : {}),
    })
    .returning();
  return row;
}

// ─── Visão geral (para o agente) ──────────────────────────────────────────

export async function overview() {
  const today = todayISO();
  const [posts, openRequests, lines, [lastAnalysis], [lastRun], settings] = await Promise.all([
    listPosts({ from: addDays(today, -3), to: addDays(today, 21) }),
    listRequests({ status: ["aberta", "em_andamento"] }),
    listLines(),
    db.select().from(smAnalyses).orderBy(desc(smAnalyses.createdAt)).limit(1),
    db.select().from(smRuns).orderBy(desc(smRuns.ranAt)).limit(1),
    getSettings(),
  ]);
  const byStatus: Record<string, number> = {};
  for (const p of posts) byStatus[p.status] = (byStatus[p.status] ?? 0) + 1;
  const daysWithout: string[] = [];
  for (let i = 0; i < 14; i++) {
    const d = addDays(today, i);
    if (!posts.some((p) => p.date === d && !p.extra && p.status !== "cancelado")) daysWithout.push(d);
  }
  return {
    hoje: today,
    horarios: settings.horarios,
    grade: settings.grade,
    linhasAtivas: lines.filter((l) => l.active).map((l) => ({ slug: l.slug, nome: l.name, frequencia: l.frequency })),
    postsProximos21Dias: Object.fromEntries(
      Object.entries(byStatus).map(([k, v]) => [postStatusLabel(k), v])
    ),
    diasSemPostNos14Dias: daysWithout,
    conflitosDeFundo: rotationConflicts(posts),
    solicitacoesParaClaude: openRequests
      .filter((r) => r.direction === "para_claude")
      .map((r) => ({ id: r.id, tipo: r.kind, destino: r.target, titulo: r.title, prioridade: r.priority, prazo: r.dueDate, postId: r.postId, status: r.status })),
    solicitacoesParaPedro: openRequests
      .filter((r) => r.direction === "para_pedro")
      .map((r) => ({ id: r.id, titulo: r.title, status: r.status })),
    postsAguardandoOk: posts
      .filter((p) => p.status === "aguardando_ok")
      .map((p) => ({ id: p.id, data: p.date, titulo: p.title })),
    ultimaAnalise: lastAnalysis
      ? { em: lastAnalysis.createdAt.toISOString(), periodo: lastAnalysis.period, resumo: lastAnalysis.summary }
      : null,
    ultimaExecucao: lastRun
      ? { em: lastRun.ranAt.toISOString(), rotina: lastRun.routine, resultado: lastRun.result, resumo: lastRun.summary }
      : null,
  };
}
