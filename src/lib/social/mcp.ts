import "server-only";
import { desc, eq, and, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { smAnalyses, smIdeas, type SmPost, type SmRequest } from "@/lib/db/schema";
import {
  addAnalysis,
  addIdeas,
  addRun,
  approvePost,
  createRequest,
  getPost,
  getSettings,
  isSocialReady,
  listLines,
  listPosts,
  listRequests,
  overview,
  requestAdjustment,
  savePost,
  saveLine,
  saveSettings,
  SocialError,
  updateRequest,
  upsertMetrics,
} from "@/lib/social/service";
import {
  analysisInput,
  ideaInput,
  lineInput,
  metricItem,
  postInput,
  requestInput,
  requestUpdate,
  runInput,
} from "@/lib/social/schemas";
import { POST_STATUS_KEYS, REQUEST_STATUS_KEYS, TARGET_KEYS } from "@/lib/social/constants";

/**
 * Servidor MCP do cockpit (Streamable HTTP, sem sessão, respostas em JSON).
 * É o caminho do Claude (chat e agente agendado) para ler e gravar a aba
 * Social Media: solicitações, posts, linhas, métricas, análises e execuções.
 */

export const SUPPORTED_PROTOCOLS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];

const INSTRUCTIONS = `Cockpit do Pedro Santos, aba Social Media (marca @pe5antos, Instagram e LinkedIn).
Comece por ver_resumo. Solicitações "para_claude" são trabalho para você: marque em_andamento ao começar e concluida ao terminar, com o resultado e o link. Para pedir algo ao Pedro (aprovação, fotos, decisão), use criar_solicitacao com destino "pedro".
Nunca agende nem publique sem o post estar "aprovado" pelo Pedro. Depois de agendar no Metricool, salve o post com status "agendado" e os ids do Metricool: o pedido de agendamento fecha sozinho. Peça pronta para o OK do Pedro vai com status "aguardando_ok".
Registre cada rotina com registrar_execucao e as métricas do Metricool com registrar_metricas.`;

type Tool = {
  name: string;
  title: string;
  description: string;
  schema: z.ZodType;
  readOnly?: boolean;
  run: (args: never) => Promise<unknown>;
};

const BY = "claude" as const;

// ─── Saída em português (mesmos nomes da entrada) ─────────────────────────

function postOut(p: SmPost, full = true) {
  const base = {
    id: p.id,
    data: p.date,
    extra: p.extra,
    linha: p.lineSlug,
    titulo: p.title,
    formato: p.format,
    fundo: p.background,
    status: p.status,
    redes: p.networks,
    horaLinkedin: p.timeLinkedin,
    horaInstagram: p.timeInstagram,
    arteUrl: p.artUrl,
    pendencia: p.pending,
    ajuste: p.adjustRequest,
    metricoolIdLinkedin: p.metricoolIdLinkedin,
    metricoolIdInstagram: p.metricoolIdInstagram,
    atualizadoPor: p.updatedBy,
    atualizadoEm: p.updatedAt.toISOString(),
  };
  if (!full) {
    return { ...base, temLegendaLinkedin: !!p.captionLinkedin, temLegendaInstagram: !!p.captionInstagram };
  }
  return {
    ...base,
    chaveExterna: p.externalKey,
    legendaLinkedin: p.captionLinkedin,
    legendaInstagram: p.captionInstagram,
    primeiroComentarioLinkedin: p.firstCommentLinkedin,
    primeiroComentarioInstagram: p.firstCommentInstagram,
    previewUrl: p.previewUrl,
    fonteNome: p.sourceName,
    fonteUrl: p.sourceUrl,
    notas: p.notes,
    aprovadoEm: p.approvedAt?.toISOString() ?? null,
    urlLinkedin: p.urlLinkedin,
    urlInstagram: p.urlInstagram,
  };
}

function requestOut(r: SmRequest) {
  return {
    id: r.id,
    direcao: r.direction,
    destino: r.target,
    tipo: r.kind,
    titulo: r.title,
    detalhes: r.details,
    postId: r.postId,
    status: r.status,
    prioridade: r.priority,
    prazo: r.dueDate,
    resultado: r.result,
    link: r.resultUrl,
    criadaPor: r.createdBy,
    criadaEm: r.createdAt.toISOString(),
    historico: r.log,
  };
}

// ─── Ferramentas ──────────────────────────────────────────────────────────

const tools: Tool[] = [
  {
    name: "ver_resumo",
    title: "Ver resumo da social media",
    description:
      "Visão geral: hoje, grade da semana, horários, linhas ativas, posts dos próximos 21 dias por status, dias sem post, conflitos de fundo, solicitações abertas nos dois sentidos, última análise e última execução. Comece por aqui.",
    schema: z.object({}),
    readOnly: true,
    run: async () => overview(),
  },
  {
    name: "listar_solicitacoes",
    title: "Listar solicitações",
    description:
      "Lista solicitações. Sem filtro de status, traz só as abertas e em andamento. direcao 'para_claude' = trabalho para você; 'para_pedro' = o que você pediu ao Pedro.",
    schema: z.object({
      status: z.array(z.enum(REQUEST_STATUS_KEYS)).optional(),
      direcao: z.enum(["para_claude", "para_pedro"]).optional(),
      destino: z.enum(TARGET_KEYS).optional(),
      limite: z.number().int().min(1).max(200).optional(),
    }),
    readOnly: true,
    run: async (a: { status?: string[]; direcao?: string; destino?: string; limite?: number }) => {
      const rows = await listRequests({
        status: a.status?.length ? a.status : ["aberta", "em_andamento"],
        direction: a.direcao,
        target: a.destino,
        limit: a.limite ?? 50,
      });
      return rows.map(requestOut);
    },
  },
  {
    name: "atualizar_solicitacao",
    title: "Atualizar solicitação",
    description:
      "Muda o status de uma solicitação (aberta, em_andamento, concluida, cancelada), registra o resultado, o link e uma nota no histórico.",
    schema: requestUpdate,
    run: async (a: z.infer<typeof requestUpdate>) => requestOut(await updateRequest(a, BY)),
  },
  {
    name: "criar_solicitacao",
    title: "Criar solicitação",
    description:
      "Cria uma solicitação. Use destino 'pedro' para pedir algo ao Pedro (aprovar, mandar fotos, decidir). Outros destinos registram trabalho para o agente.",
    schema: requestInput,
    run: async (a: z.infer<typeof requestInput>) => requestOut(await createRequest(a, BY)),
  },
  {
    name: "listar_posts",
    title: "Listar posts",
    description:
      "Lista posts do calendário entre duas datas (padrão: de hoje a 30 dias). completo=true inclui legendas e notas.",
    schema: z.object({
      de: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      ate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      status: z.array(z.enum(POST_STATUS_KEYS)).optional(),
      completo: z.boolean().optional(),
    }),
    readOnly: true,
    run: async (a: { de?: string; ate?: string; status?: string[]; completo?: boolean }) => {
      const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
      const plus30 = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
      const rows = await listPosts({ from: a.de ?? today, to: a.ate ?? plus30, status: a.status });
      return rows.map((p) => postOut(p, !!a.completo));
    },
  },
  {
    name: "obter_post",
    title: "Obter post",
    description: "Traz um post completo, com legendas, notas, fonte e links.",
    schema: z.object({ id: z.number().int().positive() }),
    readOnly: true,
    run: async (a: { id: number }) => {
      const p = await getPost(a.id);
      if (!p) throw new SocialError(`Post ${a.id} não encontrado.`);
      return postOut(p);
    },
  },
  {
    name: "salvar_post",
    title: "Criar ou atualizar post",
    description:
      "Cria (sem id; exige data e titulo) ou atualiza (com id, ou com chaveExterna já existente) um post. Só os campos enviados mudam; envie null para apagar um campo. Sem fundo informado ao criar, o cockpit escolhe um diferente dos dias vizinhos. Status 'agendado' fecha o pedido de agendamento; 'aguardando_ok' fecha o pedido de ajuste.",
    schema: postInput,
    run: async (a: z.infer<typeof postInput>) => postOut(await savePost(a, BY)),
  },
  {
    name: "aprovar_post",
    title: "Aprovar post",
    description:
      "Marca o post como aprovado e abre o pedido de agendamento no Metricool. Use só quando o Pedro aprovar explicitamente (ex.: 'ok 1,2').",
    schema: z.object({ id: z.number().int().positive() }),
    run: async (a: { id: number }) => {
      await approvePost(a.id, BY);
      const p = await getPost(a.id);
      return p ? postOut(p, false) : { ok: true };
    },
  },
  {
    name: "pedir_ajuste",
    title: "Registrar pedido de ajuste",
    description: "Registra o pedido de ajuste do Pedro num post (status 'ajuste') e abre a solicitação correspondente.",
    schema: z.object({ id: z.number().int().positive(), texto: z.string().trim().min(3).max(2000) }),
    run: async (a: { id: number; texto: string }) => {
      await requestAdjustment(a.id, a.texto, BY);
      const p = await getPost(a.id);
      return p ? postOut(p, false) : { ok: true };
    },
  },
  {
    name: "listar_linhas",
    title: "Listar linhas editoriais",
    description: "Linhas editoriais com cor, objetivo, o que entra, formatos e frequência.",
    schema: z.object({}),
    readOnly: true,
    run: async () =>
      (await listLines()).map((l) => ({
        slug: l.slug,
        nome: l.name,
        cor: l.color,
        ordem: l.position,
        ativa: l.active,
        frequencia: l.frequency,
        objetivo: l.objective,
        oQueEntra: l.scope,
        formatos: l.formats,
      })),
  },
  {
    name: "salvar_linha",
    title: "Criar ou atualizar linha editorial",
    description: "Cria ou atualiza uma linha editorial pelo slug.",
    schema: lineInput,
    run: async (a: z.infer<typeof lineInput>) => {
      const l = await saveLine(a);
      return { slug: l.slug, nome: l.name, ativa: l.active };
    },
  },
  {
    name: "listar_ideias",
    title: "Listar ideias",
    description: "Banco de ideias por linha. Sem status, traz as novas e aprovadas.",
    schema: z.object({
      linha: z.string().optional(),
      status: z.array(z.enum(["nova", "aprovada", "usada", "descartada"])).optional(),
    }),
    readOnly: true,
    run: async (a: { linha?: string; status?: string[] }) => {
      const conds = [inArray(smIdeas.status, a.status?.length ? a.status : ["nova", "aprovada"])];
      if (a.linha) conds.push(eq(smIdeas.lineSlug, a.linha));
      const rows = await db.select().from(smIdeas).where(and(...conds)).orderBy(desc(smIdeas.createdAt)).limit(100);
      return rows.map((i) => ({
        id: i.id,
        linha: i.lineSlug,
        titulo: i.title,
        gancho: i.hook,
        formato: i.format,
        detalhes: i.details,
        status: i.status,
        origem: i.source,
      }));
    },
  },
  {
    name: "salvar_ideias",
    title: "Salvar ideias",
    description: "Guarda ideias no banco de ideias (aparecem na aba Linhas do cockpit).",
    schema: z.object({ ideias: z.array(ideaInput).min(1).max(30) }),
    run: async (a: { ideias: z.infer<typeof ideaInput>[] }) => {
      const rows = await addIdeas(a.ideias, BY);
      return { salvas: rows.length };
    },
  },
  {
    name: "registrar_metricas",
    title: "Registrar métricas",
    description:
      "Grava ou atualiza métricas por publicação (chave: rede + url), vindas do Metricool. Campos vazios não apagam números já gravados. Alimenta o Analytics do cockpit.",
    schema: z.object({ itens: z.array(metricItem).min(1).max(200) }),
    run: async (a: { itens: z.infer<typeof metricItem>[] }) => ({ gravadas: await upsertMetrics(a.itens) }),
  },
  {
    name: "listar_analises",
    title: "Listar análises",
    description: "Últimas análises de desempenho, com os pontos de melhoria.",
    schema: z.object({ limite: z.number().int().min(1).max(20).optional() }),
    readOnly: true,
    run: async (a: { limite?: number }) => {
      const rows = await db.select().from(smAnalyses).orderBy(desc(smAnalyses.createdAt)).limit(a.limite ?? 3);
      return rows.map((r) => ({
        id: r.id,
        periodo: r.period,
        resumo: r.summary,
        pontos: r.points,
        origem: r.source,
        em: r.createdAt.toISOString(),
      }));
    },
  },
  {
    name: "registrar_analise",
    title: "Registrar análise",
    description: "Guarda uma leitura de desempenho com pontos de melhoria (aparece no Analytics).",
    schema: analysisInput,
    run: async (a: z.infer<typeof analysisInput>) => {
      const r = await addAnalysis(a, BY);
      return { id: r.id };
    },
  },
  {
    name: "registrar_execucao",
    title: "Registrar execução",
    description: "Registra no histórico do cockpit o que uma rotina do agente fez (semanal, mensal, agendamento, importação).",
    schema: runInput,
    run: async (a: z.infer<typeof runInput>) => {
      const r = await addRun(a);
      return { id: r.id };
    },
  },
  {
    name: "salvar_configuracoes",
    title: "Salvar configurações",
    description: "Atualiza horários padrão e a grade da semana (0 = domingo).",
    schema: z.object({
      horarios: z
        .object({ linkedin: z.string().regex(/^\d{2}:\d{2}$/), instagram: z.string().regex(/^\d{2}:\d{2}$/) })
        .optional(),
      grade: z
        .record(z.enum(["0", "1", "2", "3", "4", "5", "6"]), z.object({ linha: z.string(), peca: z.string() }))
        .optional(),
    }),
    run: async (a: { horarios?: { linkedin: string; instagram: string }; grade?: Record<string, { linha: string; peca: string }> }) => {
      const current = await getSettings();
      return saveSettings({
        ...(a.horarios ? { horarios: a.horarios } : {}),
        ...(a.grade ? { grade: { ...current.grade, ...a.grade } } : {}),
      });
    },
  },
];

const byName = new Map(tools.map((t) => [t.name, t]));

function inputSchema(schema: z.ZodType) {
  const json = z.toJSONSchema(schema, { io: "input", unrepresentable: "any" }) as Record<string, unknown>;
  delete json.$schema;
  return json;
}

let cachedList: unknown[] | null = null;
export function listTools() {
  if (!cachedList) {
    cachedList = tools.map((t) => ({
      name: t.name,
      title: t.title,
      description: t.description,
      inputSchema: inputSchema(t.schema),
      annotations: {
        title: t.title,
        readOnlyHint: !!t.readOnly,
        destructiveHint: false,
        openWorldHint: false,
      },
    }));
  }
  return cachedList;
}

// ─── JSON-RPC ─────────────────────────────────────────────────────────────

type RpcRequest = { jsonrpc?: string; id?: string | number | null; method?: string; params?: Record<string, unknown> };
type RpcResponse = { jsonrpc: "2.0"; id: string | number | null; result?: unknown; error?: { code: number; message: string } };

const ok = (id: RpcRequest["id"], result: unknown): RpcResponse => ({ jsonrpc: "2.0", id: id ?? null, result });
const fail = (id: RpcRequest["id"], code: number, message: string): RpcResponse => ({
  jsonrpc: "2.0",
  id: id ?? null,
  error: { code, message },
});

function textResult(value: unknown, isError = false) {
  return {
    content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }],
    ...(isError ? { isError: true } : {}),
  };
}

async function callTool(name: string, args: unknown) {
  const tool = byName.get(name);
  if (!tool) return textResult(`Ferramenta desconhecida: ${name}`, true);
  const parsed = tool.schema.safeParse(args ?? {});
  if (!parsed.success) {
    const issues = parsed.error.issues
      .slice(0, 5)
      .map((i) => `${i.path.join(".") || "(entrada)"}: ${i.message}`)
      .join("; ");
    return textResult(`Entrada inválida para ${name}: ${issues}`, true);
  }
  if (!(await isSocialReady())) {
    return textResult(
      "As tabelas de social media ainda não existem. Peça ao Pedro para abrir a aba Social Media do cockpit e clicar em \"Preparar banco\".",
      true
    );
  }
  try {
    const result = await tool.run(parsed.data as never);
    return textResult(result ?? { ok: true });
  } catch (e) {
    if (e instanceof SocialError) return textResult(e.message, true);
    console.error(`[mcp] ${name} falhou:`, e);
    return textResult(`Erro ao executar ${name}. Tente de novo.`, true);
  }
}

/** Trata uma mensagem JSON-RPC. Notificações e respostas devolvem null. */
export async function handleRpc(msg: RpcRequest): Promise<RpcResponse | null> {
  if (!msg || typeof msg !== "object" || typeof msg.method !== "string") {
    // resposta do cliente ou lixo: nada a responder
    return msg && "id" in msg && !("result" in msg) && !("error" in msg)
      ? fail(msg.id, -32600, "Requisição inválida")
      : null;
  }
  const isNotification = !("id" in msg) || msg.id === undefined;
  if (isNotification) return null;

  switch (msg.method) {
    case "initialize": {
      const requested = typeof msg.params?.protocolVersion === "string" ? msg.params.protocolVersion : "";
      return ok(msg.id, {
        protocolVersion: SUPPORTED_PROTOCOLS.includes(requested) ? requested : SUPPORTED_PROTOCOLS[1],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "pe5-cockpit-social", title: "Pe5 Cockpit · Social Media", version: "1.0.0" },
        instructions: INSTRUCTIONS,
      });
    }
    case "ping":
      return ok(msg.id, {});
    case "tools/list":
      return ok(msg.id, { tools: listTools() });
    case "tools/call": {
      const name = typeof msg.params?.name === "string" ? msg.params.name : "";
      return ok(msg.id, await callTool(name, msg.params?.arguments));
    }
    case "resources/list":
      return ok(msg.id, { resources: [] });
    case "prompts/list":
      return ok(msg.id, { prompts: [] });
    default:
      return fail(msg.id, -32601, `Método não suportado: ${msg.method}`);
  }
}
