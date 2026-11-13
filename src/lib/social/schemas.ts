import { z } from "zod";
import {
  BACKGROUND_KEYS,
  POST_STATUS_KEYS,
  REQUEST_KIND_KEYS,
  REQUEST_STATUS_KEYS,
  TARGET_KEYS,
} from "@/lib/social/constants";

/**
 * Formatos de entrada da aba Social Media, com nomes em português.
 * Os mesmos esquemas validam os formulários do cockpit e as ferramentas do
 * conector MCP que o Claude usa.
 */

const text = (max: number) => z.string().trim().max(max);
/** texto opcional: "" vira null (apaga o campo) */
const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => (v === undefined ? undefined : v ? v : null));
/** link opcional: só http(s), para não virar javascript: na tela */
const optUrl = (max: number) =>
  optText(max).refine((v) => v == null || /^https?:\/\//i.test(v), "Use um link que comece com http:// ou https://");
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data no formato AAAA-MM-DD");
const hhmm = z.string().regex(/^\d{2}:\d{2}$/, "Hora no formato HH:MM");

export const postInput = z.object({
  id: z.number().int().positive().optional().describe("id do post; sem id, cria um novo"),
  chaveExterna: optText(80).describe("id de origem para importar sem duplicar (ex.: 2026-11-09)"),
  data: isoDate.optional().describe("dia do post (AAAA-MM-DD); obrigatório ao criar"),
  extra: z.boolean().optional().describe("true para peça além da principal do dia"),
  linha: optText(60).describe("slug da linha editorial: vendas-mkt, relacionamento, livro..."),
  titulo: text(200).optional().describe("título/gancho da peça; obrigatório ao criar"),
  formato: optText(120).describe("ex.: Carrossel de tese (7 slides), Reel, Card estilo X"),
  fundo: z.enum(BACKGROUND_KEYS).nullable().optional().describe("branco | laranja | azul-marinho | video"),
  status: z.enum(POST_STATUS_KEYS).optional(),
  redes: z.array(z.enum(["linkedin", "instagram"])).min(1).optional(),
  horaLinkedin: hhmm.nullable().optional(),
  horaInstagram: hhmm.nullable().optional(),
  legendaLinkedin: optText(6000),
  legendaInstagram: optText(4000),
  primeiroComentarioLinkedin: optText(1500),
  primeiroComentarioInstagram: optText(1500),
  arteUrl: optUrl(1000).describe("link da arte no Canva ou do vídeo"),
  previewUrl: optUrl(1000).describe("imagem pública (PNG/JPG) para prévia"),
  fonteNome: optText(300),
  fonteUrl: optUrl(1000),
  notas: optText(4000),
  pendencia: optText(2000).describe("o que falta para a peça sair"),
  ajuste: optText(2000).describe("pedido de ajuste do Pedro"),
  metricoolIdLinkedin: optText(40),
  metricoolIdInstagram: optText(40),
  urlLinkedin: optUrl(1000).describe("link do post publicado no LinkedIn"),
  urlInstagram: optUrl(1000).describe("link do post publicado no Instagram"),
});

export type PostInput = z.infer<typeof postInput>;

export const lineInput = z.object({
  slug: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, "Use letras minúsculas, números e hífen"),
  nome: text(120).min(2).optional(),
  cor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor em hexadecimal, ex.: #3D5A99").optional(),
  ordem: z.number().int().min(0).max(99).optional(),
  ativa: z.boolean().optional(),
  frequencia: optText(120),
  objetivo: optText(1000),
  oQueEntra: optText(2000),
  formatos: z.array(text(120)).max(20).optional(),
});

export type LineInput = z.infer<typeof lineInput>;

export const requestInput = z.object({
  titulo: text(200).min(3, "Escreva o pedido"),
  detalhes: optText(6000),
  tipo: z.enum(REQUEST_KIND_KEYS).default("outro"),
  destino: z.enum(TARGET_KEYS).default("claude").describe("claude | metricool | canva | higgsfield | instagram | linkedin | pedro"),
  postId: z.number().int().positive().nullable().optional(),
  prioridade: z.enum(["normal", "alta"]).default("normal"),
  prazo: isoDate.nullable().optional(),
});

export type RequestInput = z.infer<typeof requestInput>;

export const requestUpdate = z.object({
  id: z.number().int().positive(),
  status: z.enum(REQUEST_STATUS_KEYS).optional(),
  resultado: optText(8000).describe("o que foi feito ou a resposta"),
  link: optUrl(1000).describe("link do resultado (arte, post, doc)"),
  nota: text(2000).optional().describe("nota curta para o histórico da solicitação"),
});

export const metricItem = z.object({
  rede: z.enum(["instagram", "linkedin"]),
  url: text(1000).regex(/^https?:\/\//i, "url precisa começar com http(s)://"),
  tipo: optText(40),
  publicadoEm: z.string().max(40).nullable().optional().describe("data/hora ISO da publicação"),
  texto: optText(500),
  curtidas: z.number().int().min(0).nullable().optional(),
  comentarios: z.number().int().min(0).nullable().optional(),
  salvos: z.number().int().min(0).nullable().optional(),
  compartilhamentos: z.number().int().min(0).nullable().optional(),
  alcance: z.number().int().min(0).nullable().optional(),
  impressoes: z.number().int().min(0).nullable().optional().describe("views/impressões"),
  cliques: z.number().int().min(0).nullable().optional(),
  visualizacoesVideo: z.number().int().min(0).nullable().optional(),
  seguidores: z.number().int().min(0).nullable().optional().describe("seguidores ganhos com o post"),
  tempoMedioSeg: z.number().min(0).nullable().optional(),
  tempoTotalSeg: z.number().min(0).nullable().optional(),
  taxaVisualizacao: z.number().min(0).max(1000).nullable().optional().describe("em %"),
  postId: z.number().int().positive().nullable().optional(),
});

export type MetricItem = z.infer<typeof metricItem>;

export const analysisInput = z.object({
  periodo: optText(120),
  resumo: text(6000).min(10),
  pontos: z
    .array(z.object({ titulo: text(200), detalhe: text(1500), acao: text(600).optional() }))
    .max(12)
    .default([]),
});

export const ideaInput = z.object({
  linha: optText(60),
  titulo: text(200).min(3),
  gancho: optText(300),
  formato: optText(120),
  detalhes: optText(2000),
});

export const runInput = z.object({
  rotina: text(120).min(2).describe("ex.: Peças da semana, Calendário do mês, Agendamento"),
  resultado: z.enum(["ok", "parcial", "falha"]).default("ok"),
  resumo: text(2000).min(3),
  detalhes: optText(8000),
  quando: z.string().max(40).optional().describe("data/hora ISO da execução; padrão: agora (use ao importar histórico)"),
});
