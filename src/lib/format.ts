const TZ = "America/Sao_Paulo";

/** Data de hoje (YYYY-MM-DD) no fuso de São Paulo. */
export function todayISO(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Mês atual no formato "YYYY-MM". */
export function currentMonthRef(): string {
  return todayISO().slice(0, 7);
}

/** Quantos dias tem o mês de um monthRef ("2026-09" → 30). */
export function daysInMonth(monthRef: string): number {
  const [y, m] = monthRef.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

/** Dias restantes no mês (contando hoje). 0 se o mês já passou. */
export function daysLeftInMonth(monthRef: string): number {
  const today = todayISO();
  if (today.slice(0, 7) > monthRef) return 0;
  if (today.slice(0, 7) < monthRef) return daysInMonth(monthRef);
  const day = Number(today.slice(8, 10));
  return daysInMonth(monthRef) - day + 1;
}

const MONTHS_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

/** "2026-09" → "Setembro/2026" */
export function monthLabel(monthRef: string): string {
  const [y, m] = monthRef.split("-").map(Number);
  return `${MONTHS_PT[m - 1]}/${y}`;
}

/** "2026-09-18" → "18/09/2026" */
export function dateLabel(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

/** "2026-09-18" → "18/09" */
export function dateShort(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}`;
}

export function brl(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? parseFloat(value) : value ?? 0;
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

/** Número com vírgula decimal, sem casas quando for inteiro. */
export function num(value: number, decimals = 1): string {
  return value % 1 === 0
    ? String(value)
    : value.toLocaleString("pt-BR", { maximumFractionDigits: decimals });
}

export function pct(delivered: number, planned: number): number {
  if (planned <= 0) return 0;
  return Math.round((delivered / planned) * 1000) / 10;
}

/** Lista de monthRefs em volta do mês atual (para seletores). */
export function monthOptions(back = 6, forward = 3): string[] {
  const [y, m] = currentMonthRef().split("-").map(Number);
  const out: string[] = [];
  for (let i = -back; i <= forward; i++) {
    const d = new Date(y, m - 1 + i, 1);
    out.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    );
  }
  return out.reverse();
}

/** Saudação conforme horário de São Paulo. */
export function greeting(): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: TZ,
      hour: "2-digit",
      hour12: false,
    }).format(new Date())
  );
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}
