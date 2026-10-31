/**
 * Funil próprio de Pedro Santos (palestras, consultorias, mentorias).
 * Vocabulário compartilhado entre a página, as ações e a API pública.
 */

export const LEAD_STAGES = [
  { key: "novo", label: "Novo lead" },
  { key: "contato", label: "Contato feito" },
  { key: "briefing", label: "Briefing / reunião" },
  { key: "proposta", label: "Proposta enviada" },
  { key: "negociacao", label: "Negociação" },
  { key: "fechado", label: "Fechado" },
  { key: "perdido", label: "Perdido" },
] as const;

export type LeadStage = (typeof LEAD_STAGES)[number]["key"];
export const OPEN_STAGES: LeadStage[] = ["novo", "contato", "briefing", "proposta", "negociacao"];

export const LEAD_INTERESTS: Record<string, string> = {
  palestra: "Palestras",
  vendas: "Vendas",
  livro: "Livro",
  marketing: "Marketing",
  youtube: "YouTube",
  consultoria: "Consultoria",
  mentoria: "Mentoria",
  treinamento: "Treinamento",
  outro: "Outro",
};

/** Cor da etiqueta de assunto no card, para o comercial bater o olho. */
export const LEAD_INTEREST_COLORS: Record<string, string> = {
  palestra: "bg-violet-100 text-violet-800",
  vendas: "bg-emerald-100 text-emerald-800",
  livro: "bg-amber-100 text-amber-800",
  marketing: "bg-sky-100 text-sky-800",
  youtube: "bg-rose-100 text-rose-800",
};

export const LEAD_SOURCES: Record<string, string> = {
  site: "Site",
  manual: "Manual",
  indicacao: "Indicação",
  linkedin: "LinkedIn",
  instagram: "Instagram",
  evento: "Evento",
  whatsapp: "WhatsApp",
};

export function stageLabel(key: string): string {
  return LEAD_STAGES.find((s) => s.key === key)?.label ?? key;
}

export function isStage(key: string): key is LeadStage {
  return LEAD_STAGES.some((s) => s.key === key);
}

/** Assunto reconhecido no texto (interesse, página ou origem), ou null. */
export function matchInterest(raw?: string | null): string | null {
  if (!raw) return null;
  const v = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (v.includes("palestr") || v.includes("keynote") || v.includes("evento")) return "palestra";
  if (v.includes("youtube")) return "youtube";
  if (v.includes("livro") || v.includes("lista_espera") || v.includes("lista de espera") || v.includes("book")) return "livro";
  if (v.includes("marketing") || v.includes("sobe")) return "marketing";
  if (v.includes("venda") || v.includes("comercial") || v.includes("sales")) return "vendas";
  if (v.includes("consult")) return "consultoria";
  if (v.includes("mentor")) return "mentoria";
  if (v.includes("trein") || v.includes("workshop") || v.includes("curso")) return "treinamento";
  return null;
}

/** Interesse vindo do site em texto livre → uma das chaves conhecidas. */
export function normalizeInterest(raw?: string | null): string | null {
  if (!raw) return null;
  return matchInterest(raw) ?? "outro";
}

/** Telefone BR → link do WhatsApp (assume +55 quando vier sem DDI). */
export function whatsappLink(phone?: string | null): string | null {
  if (!phone) return null;
  let d = phone.replace(/\D/g, "");
  if (d.length < 10) return null;
  if (!d.startsWith("55") || d.length <= 11) d = `55${d}`;
  return `https://wa.me/${d}`;
}
