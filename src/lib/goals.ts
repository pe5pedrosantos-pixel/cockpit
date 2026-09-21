import type { DeliverableItem, Goal } from "@/lib/db/schema";
import { todayISO } from "@/lib/format";

/**
 * Semana começa na segunda-feira (padrão brasileiro de trabalho).
 * Tudo em datas ISO (YYYY-MM-DD) no fuso de São Paulo.
 */
export function weekRange(iso = todayISO()): { start: string; end: string } {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const dow = (date.getUTCDay() + 6) % 7; // segunda = 0
  const start = new Date(date);
  start.setUTCDate(date.getUTCDate() - dow);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  const f = (x: Date) => x.toISOString().slice(0, 10);
  return { start: f(start), end: f(end) };
}

export function monthRange(iso = todayISO()): { start: string; end: string } {
  const [y, m] = iso.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const mm = String(m).padStart(2, "0");
  return { start: `${y}-${mm}-01`, end: `${y}-${mm}-${String(last).padStart(2, "0")}` };
}

/** Dias restantes no período, contando hoje. */
function daysLeft(end: string, today = todayISO()): number {
  const a = Date.parse(`${today}T00:00:00Z`);
  const b = Date.parse(`${end}T00:00:00Z`);
  return Math.max(Math.round((b - a) / 86_400_000) + 1, 0);
}

export interface GoalProgress {
  goal: Goal;
  period: { start: string; end: string };
  done: number;
  remaining: number;
  percent: number;
  daysLeft: number;
  /** o ritmo atual indica que a meta não fecha no período */
  behind: boolean;
}

/** Um item conta para a meta se for da mesma rede (e formato, se a meta exigir). */
export function itemMatchesGoal(item: DeliverableItem, goal: Goal): boolean {
  if (item.companyId !== goal.companyId) return false;
  if (item.platform !== goal.platform) return false;
  if (goal.format && item.format !== goal.format) return false;
  return true;
}

function itemDate(item: DeliverableItem): string {
  return item.publishedAt ?? item.createdAt.toISOString().slice(0, 10);
}

export function goalProgress(
  goal: Goal,
  items: DeliverableItem[],
  today = todayISO()
): GoalProgress {
  const period = goal.period === "week" ? weekRange(today) : monthRange(today);
  const done = items.filter((i) => {
    if (!itemMatchesGoal(i, goal)) return false;
    const d = itemDate(i);
    return d >= period.start && d <= period.end;
  }).length;

  const remaining = Math.max(goal.targetQty - done, 0);
  const left = daysLeft(period.end, today);
  const totalDays = goal.period === "week" ? 7 : daysLeft(period.end, period.start);
  const elapsed = Math.max(totalDays - left, 0);
  const expectedByNow = (goal.targetQty * elapsed) / Math.max(totalDays, 1);

  return {
    goal,
    period,
    done,
    remaining,
    percent: goal.targetQty > 0 ? Math.min(Math.round((done / goal.targetQty) * 100), 100) : 0,
    daysLeft: left,
    // atrasado quando está mais de 1 peça abaixo do esperado para o dia
    behind: remaining > 0 && done + 1 <= Math.floor(expectedByNow),
  };
}
