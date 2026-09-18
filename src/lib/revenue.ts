import type { PipelineDeal } from "@/lib/db/schema";
import { currentMonthRef, todayISO } from "@/lib/format";

export interface RevenueSummary {
  /** total ganho no mês corrente */
  wonThisMonth: number;
  /** total ganho no ano corrente */
  wonThisYear: number;
  /** quantidade de negócios ganhos no mês */
  countThisMonth: number;
  /** receita mensal recorrente dos contratos marcados como recorrentes */
  mrr: number;
  /** ganhos mais recentes, do mais novo para o mais antigo */
  recent: PipelineDeal[];
}

/** Data em que o negócio foi ganho (com alternativas quando falta won_time). */
export function wonDate(d: PipelineDeal): string | null {
  if (d.wonTime) return d.wonTime.toISOString().slice(0, 10);
  if (d.expectedCloseDate) return d.expectedCloseDate;
  if (d.updateTime) return d.updateTime.toISOString().slice(0, 10);
  return null;
}

/**
 * Valor mensal de um contrato recorrente.
 * Se o valor mensal não foi informado, assume contrato anual e divide por 12.
 */
export function monthlyOf(d: PipelineDeal): number {
  if (!d.isRecurring) return 0;
  if (d.monthlyValue) return parseFloat(d.monthlyValue);
  const total = parseFloat(d.value ?? "0");
  const months = d.contractMonths && d.contractMonths > 0 ? d.contractMonths : 12;
  return total > 0 ? Math.round((total / months) * 100) / 100 : 0;
}

export function summarizeRevenue(deals: PipelineDeal[]): RevenueSummary {
  const won = deals.filter((d) => d.status === "won");
  const month = currentMonthRef();
  const year = todayISO().slice(0, 4);

  let wonThisMonth = 0;
  let wonThisYear = 0;
  let countThisMonth = 0;

  for (const d of won) {
    const when = wonDate(d);
    if (!when) continue;
    const amount = parseFloat(d.value ?? "0");
    if (when.startsWith(year)) wonThisYear += amount;
    if (when.startsWith(month)) {
      wonThisMonth += amount;
      countThisMonth++;
    }
  }

  const mrr = won.reduce((s, d) => s + monthlyOf(d), 0);

  const recent = [...won]
    .sort((a, b) => (wonDate(b) ?? "").localeCompare(wonDate(a) ?? ""))
    .slice(0, 6);

  return { wonThisMonth, wonThisYear, countThisMonth, mrr, recent };
}
