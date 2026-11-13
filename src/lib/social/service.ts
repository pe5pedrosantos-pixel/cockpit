import "server-only";
import { and, asc, desc, eq, gte, inArray, lte, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  smAnalyses,
  smIdeas,
  smLines,
  smMetrics,
  smPosts,
  smRequests,
  smRuns,
  smSettings,
  type SmLogEntry,
  type SmPost,
  type SmRequest,
} from "@/lib/db/schema";
import { SOCIAL_SCHEMA_SQL } from "@/lib/social/schema-sql";
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

/** As tabelas já existem? (antes do "Preparar banco", não existem) */
export async function isSocialReady(): Promise<boolean> {
  try {
    const rows = await db.select({ key: smSettings.key }).from(smSettings).where(eq(smSettings.key, "geral"));
    return rows.length > 0;
  } catch {
    // tabela ainda não existe
    return false;
  }
}

/** Cria as tabelas (idempotente) e grava linhas e configurações padrão. */
export async function prepareSocialDb() {
  const statements = SOCIAL_SCHEMA_SQL.split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const statement of statements) {
    await db.execute(sql.raw(statement));
  }
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
  await db.delete(smPosts).where(eq(smPosts.id, id));
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
