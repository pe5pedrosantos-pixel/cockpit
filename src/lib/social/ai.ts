import "server-only";

/**
 * Claude dentro do cockpit, pela API da Anthropic (pago por uso, à parte do
 * plano do claude.ai). Só para tarefas rápidas de texto: ideias, legendas,
 * leitura de métricas e respostas a solicitações. Arte, vídeo e agendamento
 * continuam com o agente, pela fila de solicitações.
 *
 * A chave fica só no servidor (ANTHROPIC_API_KEY, na Vercel).
 */

const API_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-sonnet-5-5";

export function isAiConfigured() {
  return !!process.env.ANTHROPIC_API_KEY;
}

export function aiModel() {
  return process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;
}

/** Regras da marca para toda chamada (versão curta da skill de social media). */
export const BRAND_SYSTEM = `Você é o social media e copywriter da marca pessoal Pedro Santos (@pe5antos), no Instagram e no LinkedIn. Escreva sempre em português do Brasil.

Quem é o Pedro: mais de 10 anos em vendas (varejo na Vivo e Centauro, educação na KNN, SaaS e 6 anos em energia solar). Hoje é Head de Novos Negócios da SOBE, agência de Santa Cruz do Sul (RS). Mora em Florianópolis. Formação em Relações Públicas e Marketing. Lado humano: música, cerveja artesanal, Floripa. Está escrevendo o livro "O Poder das Conexões — Networking, propósito e a arte de construir pontes". Palestras: People-Led Growth e O Poder das Conexões. YouTube: Networking Talks e Cafezin e Resenha.

Posicionamento: o cara que fala de rede de contatos e influência na vida pessoal e profissional. Eixos: NET + WORKING; ponte, não escada; a rede antes da necessidade.

Linhas editoriais: vendas e marketing (notícia comentada, tese, cases, sempre com fonte quando houver número); relacionamento (histórias e casos reais, Networking Talks, lado humano); livro (diário do lançamento independente, sem spoiler).

Tom: prático, direto, humano, com história real, sem pose de guru. Proibido: clichês ("no mundo de hoje", "game changer", "sucesso é..."), linguagem corporativa vazia, inventar dados, citar a data de lançamento do livro, falar de prospect ou negociação em andamento, citar cliente sem autorização, números internos de empresa, política partidária. Em 8 de cada 10 posts nenhuma empresa aparece no texto.

LinkedIn: 1ª linha é o gancho (até 12 palavras); história real → virada → aprendizado → pergunta para comentário; 900 a 1.500 caracteres; parágrafos de 1 a 2 linhas; no máximo 3 hashtags.
Instagram: gancho na 1ª linha, legenda curta ou média, CTA claro ("link na bio" para livro, palestra ou site), 3 a 5 hashtags de nicho.
Crescimento só orgânico. Um post por dia nas duas redes, adaptado a cada uma, nunca copiado.`;

export class AiError extends Error {}

type Usage = { input_tokens: number; output_tokens: number };

export async function askClaude(opts: {
  prompt: string;
  system?: string;
  maxTokens?: number;
}): Promise<{ text: string; usage: Usage | null }> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new AiError("Configure ANTHROPIC_API_KEY na Vercel para usar o Claude aqui.");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 50_000);
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: aiModel(),
        max_tokens: opts.maxTokens ?? 2000,
        system: opts.system ?? BRAND_SYSTEM,
        messages: [{ role: "user", content: opts.prompt }],
      }),
      signal: controller.signal,
      cache: "no-store",
    });
    const body = (await res.json().catch(() => null)) as {
      content?: { type: string; text?: string }[];
      usage?: Usage;
      error?: { message?: string };
    } | null;
    if (!res.ok) {
      const detail = body?.error?.message ?? `HTTP ${res.status}`;
      if (res.status === 401) throw new AiError("A chave da Anthropic foi recusada. Confira ANTHROPIC_API_KEY.");
      if (res.status === 429) throw new AiError("Limite da API da Anthropic atingido. Tente de novo em instantes.");
      throw new AiError(`A API da Anthropic respondeu com erro: ${detail}`);
    }
    const text = (body?.content ?? [])
      .filter((c) => c.type === "text" && c.text)
      .map((c) => c.text)
      .join("\n")
      .trim();
    if (!text) throw new AiError("O Claude não devolveu texto.");
    return { text, usage: body?.usage ?? null };
  } catch (e) {
    if (e instanceof AiError) throw e;
    if (e instanceof Error && e.name === "AbortError") throw new AiError("O Claude demorou demais para responder. Tente de novo.");
    throw new AiError("Não foi possível falar com a API da Anthropic agora.");
  } finally {
    clearTimeout(timer);
  }
}

/** Extrai o primeiro JSON (objeto ou lista) de uma resposta. */
export function extractJson<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.search(/[[{]/);
  if (start < 0) throw new AiError("A resposta do Claude veio sem o formato esperado.");
  const open = candidate[start];
  const close = open === "{" ? "}" : "]";
  const end = candidate.lastIndexOf(close);
  try {
    return JSON.parse(candidate.slice(start, end + 1)) as T;
  } catch {
    throw new AiError("A resposta do Claude veio sem o formato esperado.");
  }
}

// ─── Tarefas ──────────────────────────────────────────────────────────────

export type IdeaOut = { titulo: string; gancho?: string; formato?: string; detalhes?: string };

export async function generateIdeas(opts: {
  line: { slug: string; name: string; objective: string | null; scope: string | null; formats: string[] };
  count: number;
  hint?: string;
  recentTitles: string[];
}) {
  const prompt = `Gere ${opts.count} ideias de post para a linha editorial "${opts.line.name}".
Objetivo da linha: ${opts.line.objective ?? "—"}
O que entra: ${opts.line.scope ?? "—"}
Formatos da linha: ${opts.line.formats.join(", ") || "—"}
${opts.hint ? `Direção do Pedro: ${opts.hint}\n` : ""}Títulos recentes (não repetir): ${opts.recentTitles.slice(0, 30).join(" | ") || "nenhum"}

Cada ideia: título curto (até 8 palavras), gancho da 1ª linha, formato (um dos formatos da linha) e detalhes em até 2 frases (o que contar e por que funciona). Não invente dados nem nomes de clientes.

Responda só com JSON: [{"titulo": "...", "gancho": "...", "formato": "...", "detalhes": "..."}]`;
  const { text } = await askClaude({ prompt, maxTokens: 2500 });
  const list = extractJson<IdeaOut[]>(text);
  if (!Array.isArray(list)) throw new AiError("A resposta do Claude veio sem a lista de ideias.");
  return list
    .filter((i) => i && typeof i.titulo === "string" && i.titulo.trim())
    .slice(0, opts.count)
    .map((i) => ({
      titulo: i.titulo.trim().slice(0, 200),
      gancho: i.gancho?.toString().trim().slice(0, 300) || undefined,
      formato: i.formato?.toString().trim().slice(0, 120) || undefined,
      detalhes: i.detalhes?.toString().trim().slice(0, 2000) || undefined,
    }));
}

export async function writeCaption(opts: {
  network: "linkedin" | "instagram";
  post: { title: string; format: string | null; lineName: string | null; notes: string | null; sourceName: string | null; sourceUrl: string | null };
  current: string | null;
  other: string | null;
  instruction?: string;
}) {
  const rede = opts.network === "linkedin" ? "LinkedIn" : "Instagram";
  const prompt = `${opts.current ? `Reescreva a legenda do ${rede}` : `Escreva a legenda do ${rede}`} para este post.
Título: ${opts.post.title}
Formato: ${opts.post.format ?? "—"}
Linha editorial: ${opts.post.lineName ?? "—"}
${opts.post.sourceName ? `Fonte: ${opts.post.sourceName}${opts.post.sourceUrl ? ` (${opts.post.sourceUrl})` : ""}\n` : ""}${opts.post.notes ? `Notas: ${opts.post.notes}\n` : ""}${opts.current ? `\nLegenda atual do ${rede}:\n"""${opts.current}"""\n` : ""}${opts.other ? `\nLegenda da outra rede (adapte, não copie):\n"""${opts.other}"""\n` : ""}${opts.instruction ? `\nPedido do Pedro: ${opts.instruction}\n` : ""}
Siga as regras do ${rede}. Responda só com a legenda pronta, sem comentários antes ou depois.`;
  const { text } = await askClaude({ prompt, maxTokens: 1800 });
  return text.replace(/^"""|"""$/g, "").trim();
}

export type AnalysisOut = { resumo: string; pontos: { titulo: string; detalhe: string; acao?: string }[] };

export async function analyzePerformance(opts: { period: string; table: string; totals: string }) {
  const prompt = `Analise o desempenho das publicações do Pedro no período ${opts.period}.

Totais por rede:
${opts.totals}

Publicações (uma por linha):
${opts.table}

Encontre padrões reais nos números: formatos, temas, dias, ganchos e, nos vídeos, retenção (tempo médio e taxa de visualização). Compare com a mediana, não com o melhor post. Seja honesto quando a amostra for pequena. Termine com pontos de melhoria acionáveis para as próximas semanas, cada um com uma ação concreta.

Responda só com JSON: {"resumo": "3 a 5 frases", "pontos": [{"titulo": "...", "detalhe": "o que os números mostram", "acao": "o que fazer"}]} com 3 a 6 pontos.`;
  const { text } = await askClaude({ prompt, maxTokens: 2500 });
  const out = extractJson<AnalysisOut>(text);
  if (!out || typeof out.resumo !== "string") throw new AiError("A análise veio sem resumo.");
  return {
    resumo: out.resumo.trim(),
    pontos: (Array.isArray(out.pontos) ? out.pontos : [])
      .filter((p) => p && p.titulo && p.detalhe)
      .slice(0, 8)
      .map((p) => ({ titulo: String(p.titulo), detalhe: String(p.detalhe), acao: p.acao ? String(p.acao) : undefined })),
  };
}

export async function answerRequest(opts: {
  title: string;
  details: string | null;
  kind: string;
  post: { title: string; date: string; format: string | null; captionLinkedin: string | null; captionInstagram: string | null } | null;
}) {
  const prompt = `O Pedro fez esta solicitação no cockpit de social media.
Tipo: ${opts.kind}
Pedido: ${opts.title}
${opts.details ? `Detalhes: ${opts.details}\n` : ""}${
    opts.post
      ? `\nPost ligado (${opts.post.date}): ${opts.post.title}
Formato: ${opts.post.format ?? "—"}
Legenda LinkedIn: ${opts.post.captionLinkedin ?? "—"}
Legenda Instagram: ${opts.post.captionInstagram ?? "—"}\n`
      : ""
  }
Resolva o pedido com o que dá para fazer só com texto (você não tem acesso a Canva, Metricool, internet nem arquivos). Entregue o resultado pronto para usar. Se o pedido depender de arte, vídeo, agendamento ou pesquisa na web, diga em uma linha que isso fica com o agente e entregue a parte de texto que adiantar o trabalho.`;
  const { text } = await askClaude({ prompt, maxTokens: 2500 });
  return text;
}
