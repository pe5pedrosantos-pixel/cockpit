/** Formatos que a página manda para os componentes da aba Social Media. */

export interface PostData {
  id: number;
  date: string;
  extra: boolean;
  lineSlug: string | null;
  title: string;
  format: string | null;
  background: string | null;
  status: string;
  networks: string[];
  timeLinkedin: string | null;
  timeInstagram: string | null;
  captionLinkedin: string | null;
  captionInstagram: string | null;
  firstCommentLinkedin: string | null;
  firstCommentInstagram: string | null;
  artUrl: string | null;
  previewUrl: string | null;
  sourceName: string | null;
  sourceUrl: string | null;
  notes: string | null;
  pending: string | null;
  adjustRequest: string | null;
  approvedAt: string | null;
  metricoolIdLinkedin: string | null;
  metricoolIdInstagram: string | null;
  urlLinkedin: string | null;
  urlInstagram: string | null;
  updatedBy: string;
  updatedAt: string;
}

export interface LineData {
  id: number;
  slug: string;
  name: string;
  color: string;
  position: number;
  active: boolean;
  frequency: string | null;
  objective: string | null;
  scope: string | null;
  formats: string[];
}

export interface RequestData {
  id: number;
  direction: string;
  target: string;
  kind: string;
  title: string;
  details: string | null;
  postId: number | null;
  postTitle: string | null;
  postDate: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  result: string | null;
  resultUrl: string | null;
  log: { at: string; by: string; text: string }[];
  createdBy: string;
  createdAt: string;
  completedAt: string | null;
}

export interface IdeaData {
  id: number;
  lineSlug: string | null;
  title: string;
  hook: string | null;
  format: string | null;
  details: string | null;
  status: string;
  source: string;
  createdAt: string;
}

export interface MetricData {
  id: number;
  network: string;
  url: string;
  kind: string | null;
  publishedAt: string | null;
  text: string | null;
  likes: number | null;
  comments: number | null;
  saves: number | null;
  shares: number | null;
  reach: number | null;
  impressions: number | null;
  clicks: number | null;
  videoViews: number | null;
  follows: number | null;
  avgWatchSeconds: number | null;
  totalWatchSeconds: number | null;
  viewRate: number | null;
  postId: number | null;
}

export interface AnalysisData {
  id: number;
  period: string | null;
  summary: string;
  points: { titulo: string; detalhe: string; acao?: string }[];
  source: string;
  createdAt: string;
}

export interface RunData {
  id: number;
  routine: string;
  result: string;
  summary: string;
  details: string | null;
  ranAt: string;
}

/** Quem fez: rótulo curto para a interface. */
export const ACTOR_LABEL: Record<string, string> = {
  pedro: "Você",
  claude: "Claude (agente)",
  ia: "Claude no cockpit",
};

/** "2026-11-13T20:10:00.000Z" → "13/11 · 17:10" no fuso de São Paulo. */
export function when(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  const date = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" }).format(d);
  const time = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }).format(d);
  return `${date} · ${time}`;
}
