/**
 * Vocabulário do ERP pessoal: entradas e saídas de dinheiro, PJ e PF.
 * Compartilhado entre a página, as ações e o dashboard.
 */

export const FINANCE_KINDS: Record<string, string> = {
  salario: "Salário",
  comissao: "Comissão",
  luvas: "Luvas",
  outro: "Outro",
};

/** Tipos de saída (só contas fixas; os cartões entram mês a mês). */
export const OUT_KINDS: Record<string, string> = {
  fixo: "Conta fixa",
  cartao: "Cartão de crédito",
  parcela: "Parcela",
  tributo: "Tributo",
  outro: "Outro",
};

export const NF_STATUS: Record<string, string> = {
  pendente: "NF a emitir",
  emitida: "NF emitida",
  nao_aplica: "Sem NF",
};

export const ENTITIES: Record<string, string> = {
  pj: "Pessoa jurídica",
  pf: "Pessoa física",
};

/** Quem paga hoje. A lista cresce sozinha com o que for lançado. */
export const DEFAULT_PAYERS = ["Sobe", "Orka Eng", "Grid Co.", "AWB Mkt"];

/** Cor de cada pagador, a mesma da planilha original. */
const PAYER_COLORS: Record<string, string> = {
  sobe: "#8DC58A",
  "orka eng": "#E3A6A6",
  "grid co.": "#7FA2E6",
  "awb mkt": "#E8C96B",
};

export function payerColor(payer: string): string {
  return PAYER_COLORS[payer.trim().toLowerCase()] ?? "#A0A7B4";
}

export function kindLabel(k: string): string {
  return FINANCE_KINDS[k] ?? OUT_KINDS[k] ?? k;
}

export type Direction = "entrada" | "saida";

/** Saldo de cada mês: entradas menos saídas da PJ e da PF. */
export interface MonthBalance {
  monthRef: string;
  income: number;
  outPj: number;
  outPf: number;
  left: number;
}

export function monthBalances(
  rows: { direction: string; entity: string; amount: number; monthRef: string }[],
  months: string[]
): MonthBalance[] {
  return months.map((m) => {
    const of = rows.filter((r) => r.monthRef === m);
    const income = of.filter((r) => r.direction === "entrada").reduce((s, r) => s + r.amount, 0);
    const outPj = of
      .filter((r) => r.direction === "saida" && r.entity === "pj")
      .reduce((s, r) => s + r.amount, 0);
    const outPf = of
      .filter((r) => r.direction === "saida" && r.entity !== "pj")
      .reduce((s, r) => s + r.amount, 0);
    return { monthRef: m, income, outPj, outPf, left: income - outPj - outPf };
  });
}

/** "8.500,00", "8500", "R$ 8.500" → 8500 */
export function parseMoney(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const clean = raw.replace(/[^\d,.-]/g, "");
  if (!clean) return null;
  const normalized = clean.includes(",")
    ? clean.replace(/\./g, "").replace(",", ".")
    : clean;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

/** "2026-10" + 2 → "2026-12" */
export function addMonths(monthRef: string, n: number): string {
  const [y, m] = monthRef.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "2026-10" → "out/26" */
export function monthShort(monthRef: string): string {
  const [y, m] = monthRef.split("-").map(Number);
  return `${SHORT[m - 1]}/${String(y).slice(2)}`;
}

/** Reais com centavos só quando houver: "R$ 7.800" ou "R$ 1.234,50". */
export function money(value: number): string {
  const cents = Math.round(value * 100) % 100 !== 0;
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: 2,
  });
}
