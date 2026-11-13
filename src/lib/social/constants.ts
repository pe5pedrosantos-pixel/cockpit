/**
 * Vocabulário da aba Social Media (marca Pedro Santos).
 * Compartilhado entre telas, server actions, conector MCP e o Claude do cockpit.
 */

export const POST_STATUSES = [
  { key: "planejado", label: "Planejado" },
  { key: "producao", label: "Em produção" },
  { key: "aguardando_ok", label: "Aguardando seu OK" },
  { key: "ajuste", label: "Ajuste pedido" },
  { key: "aprovado", label: "Aprovado" },
  { key: "agendado", label: "Agendado" },
  { key: "publicado", label: "Publicado" },
  { key: "cancelado", label: "Cancelado" },
] as const;

export type PostStatus = (typeof POST_STATUSES)[number]["key"];

export const POST_STATUS_KEYS = POST_STATUSES.map((s) => s.key) as [PostStatus, ...PostStatus[]];

export function postStatusLabel(status: string) {
  return POST_STATUSES.find((s) => s.key === status)?.label ?? status;
}

/** Estados que pedem uma ação do Pedro: o único lugar onde o coral aparece. */
export const NEEDS_PEDRO: string[] = ["aguardando_ok"];
/** Estados que pedem uma ação do agente. */
export const NEEDS_AGENT: string[] = ["planejado", "producao", "ajuste", "aprovado"];

/** Fundo das peças. Regra da marca: nunca dois posts seguidos com o mesmo. */
export const BACKGROUNDS = [
  { key: "branco", label: "Branco", hex: "#FFFFFF", ink: "#0F1E3D" },
  { key: "laranja", label: "Laranja", hex: "#FF5C39", ink: "#FFFFFF" },
  { key: "azul-marinho", label: "Azul-marinho", hex: "#0F1E3D", ink: "#F4F1EA" },
  { key: "video", label: "Vídeo", hex: "#2A2A2A", ink: "#FFFFFF" },
] as const;

export const BACKGROUND_KEYS = BACKGROUNDS.map((b) => b.key) as [string, ...string[]];
/** Rotação dos fundos de arte (vídeo fica de fora). */
export const ROTATION = ["branco", "laranja", "azul-marinho"] as const;

export function background(key: string | null | undefined) {
  return BACKGROUNDS.find((b) => b.key === key) ?? null;
}

export const NETWORKS = [
  { key: "linkedin", label: "LinkedIn", short: "LI" },
  { key: "instagram", label: "Instagram", short: "IG" },
] as const;

/** Para quem a solicitação vai. */
export const TARGETS = [
  { key: "claude", label: "Claude (agente)" },
  { key: "metricool", label: "Metricool" },
  { key: "canva", label: "Canva" },
  { key: "higgsfield", label: "Higgsfield" },
  { key: "instagram", label: "Instagram" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "pedro", label: "Pedro" },
] as const;

export const TARGET_KEYS = TARGETS.map((t) => t.key) as [string, ...string[]];

export function targetLabel(key: string) {
  return TARGETS.find((t) => t.key === key)?.label ?? key;
}

export const REQUEST_KINDS = [
  { key: "arte", label: "Arte" },
  { key: "video", label: "Vídeo" },
  { key: "legenda", label: "Legenda" },
  { key: "ideias", label: "Ideias" },
  { key: "agendar", label: "Agendar" },
  { key: "metricas", label: "Atualizar métricas" },
  { key: "analise", label: "Análise" },
  { key: "ajuste", label: "Ajuste" },
  { key: "pesquisa", label: "Pesquisa" },
  { key: "aprovacao", label: "Aprovação" },
  { key: "material", label: "Material (fotos, vídeos)" },
  { key: "outro", label: "Outro" },
] as const;

export const REQUEST_KIND_KEYS = REQUEST_KINDS.map((k) => k.key) as [string, ...string[]];

export function kindLabel(key: string) {
  return REQUEST_KINDS.find((k) => k.key === key)?.label ?? key;
}

export const REQUEST_STATUSES = [
  { key: "aberta", label: "Aberta" },
  { key: "em_andamento", label: "Em andamento" },
  { key: "concluida", label: "Concluída" },
  { key: "cancelada", label: "Cancelada" },
] as const;

export const REQUEST_STATUS_KEYS = REQUEST_STATUSES.map((s) => s.key) as [string, ...string[]];

export function requestStatusLabel(key: string) {
  return REQUEST_STATUSES.find((s) => s.key === key)?.label ?? key;
}

export const IDEA_STATUSES = ["nova", "aprovada", "usada", "descartada"] as const;

/** Grade padrão da semana (0 = domingo), igual à da skill. */
export const DEFAULT_GRID: Record<string, { linha: string; peca: string }> = {
  "1": { linha: "vendas-mkt", peca: "Notícia comentada da semana" },
  "2": { linha: "relacionamento", peca: "História ou caso" },
  "3": { linha: "vendas-mkt", peca: "Tese em carrossel" },
  "4": { linha: "livro", peca: "Diário do lançamento" },
  "5": { linha: "relacionamento", peca: "Card de frase ou corte do Networking Talks" },
  "6": { linha: "vendas-mkt", peca: "Leve: POV, humor, collab de amigo" },
  "0": { linha: "livro", peca: "Reflexão ou trecho sem spoiler" },
};

export const DEFAULT_TIMES = { linkedin: "17:30", instagram: "19:00" };

export const DEFAULT_LINES = [
  {
    slug: "vendas-mkt",
    name: "Vendas e marketing",
    color: "#3D5A99",
    position: 1,
    frequency: "3 posts por semana",
    objective: "Autoridade: atrair empresários e líderes comerciais, que compram palestra e consultoria.",
    scope:
      "Notícia comentada; teses (People-Led Growth, venda high ticket, time comercial); cases da SOBE; conteúdo de amigos; o que está em alta no setor, sempre com fonte.",
    formats: ["Reel de notícia", "Carrossel de tese", "Talking head com tag de tema", "Card estilo post do X", "Collab"],
  },
  {
    slug: "relacionamento",
    name: "Relacionamento",
    color: "#FF5C39",
    position: 2,
    frequency: "2 posts por semana",
    objective: "Contar a tese do livro em histórias reais, humanizar e puxar conversa.",
    scope:
      "Histórias e casos reais; fotos de eventos com a história da conexão; Networking Talks; frases da tese; lado humano (música, Floripa, cerveja).",
    formats: ["Carrossel narrativo", "Foto de evento + legenda-história", "Card de frase", "Corte do Networking Talks", "Reel de bastidor"],
  },
  {
    slug: "livro",
    name: "Livro: diário do lançamento",
    color: "#8A6D3B",
    position: 3,
    frequency: "2 posts por semana",
    objective: "Lista de espera e pré-venda, contando a jornada real de um autor independente. Nunca a data de lançamento.",
    scope:
      "Escrita, título, capa, gráfica, revisão, pré-venda, dúvidas e decisões; trechos curtos sem spoiler; perguntas aos seguidores.",
    formats: ["Reels MEU PRIMEIRO LIVRO", "Carrossel do processo", "Card de trecho", "Bastidor filmado"],
  },
];

export const WEEKDAYS_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
export const WEEKDAYS_LONG = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

/** Dia da semana de uma data ISO (0 = domingo), sem depender do fuso. */
export function weekdayOf(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Soma dias a uma data ISO. */
export function addDays(iso: string, days: number) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}
