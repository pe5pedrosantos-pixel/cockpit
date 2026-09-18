import type { Company, Deliverable, Task } from "./db/schema";
import { daysLeftInMonth, pct, todayISO } from "./format";

export type AlertLevel = "critical" | "warning" | "ok";

export interface Alert {
  level: AlertLevel;
  message: string;
  companySlug?: string;
}

export interface CompanyMonthSummary {
  company: Company;
  monthRef: string;
  totalPlanned: number;
  totalDelivered: number;
  percent: number;
  remaining: number;
  daysLeft: number;
  /** entregas por dia necessárias para cumprir a meta */
  paceNeeded: number | null;
  level: AlertLevel;
  overdueCount: number;
}

/** Um entregável está atrasado se o prazo passou e ele não foi concluído. */
export function isOverdue(d: Deliverable): boolean {
  if (d.status === "CONCLUIDO") return false;
  if (d.status === "ATRASADO") return true;
  if (!d.deadline) return false;
  return d.deadline < todayISO();
}

/** Status efetivo para exibição (marca atraso automaticamente). */
export function effectiveStatus(d: Deliverable): Deliverable["status"] {
  if (d.status !== "CONCLUIDO" && isOverdue(d)) return "ATRASADO";
  return d.status;
}

export function summarizeCompanyMonth(
  company: Company,
  monthRef: string,
  items: Deliverable[]
): CompanyMonthSummary {
  const totalPlanned = items.reduce((s, d) => s + d.plannedQty, 0);
  const totalDelivered = items.reduce(
    (s, d) => s + Math.min(d.deliveredQty, d.plannedQty),
    0
  );
  const remaining = Math.max(totalPlanned - totalDelivered, 0);
  const percent = pct(totalDelivered, totalPlanned);
  const daysLeft = daysLeftInMonth(monthRef);
  const overdueCount = items.filter(isOverdue).length;

  const paceNeeded =
    remaining > 0 && daysLeft > 0
      ? Math.round((remaining / daysLeft) * 10) / 10
      : null;

  let level: AlertLevel = "ok";
  if (overdueCount > 0 || (remaining > 0 && daysLeft === 0)) {
    level = "critical";
  } else if (remaining > 0 && daysLeft > 0) {
    // ritmo esperado: se o % de execução está atrás do % do mês decorrido
    const totalDays = daysLeft + (new Date().getDate() - 1);
    const monthProgress = totalDays > 0 ? 1 - daysLeft / totalDays : 1;
    if (percent / 100 < monthProgress - 0.1) level = "warning";
    else if (daysLeft <= 5) level = "warning";
  }

  return {
    company,
    monthRef,
    totalPlanned,
    totalDelivered,
    percent,
    remaining,
    daysLeft,
    paceNeeded,
    level,
    overdueCount,
  };
}

/** Gera alertas em linguagem natural — usa somente dados reais cadastrados. */
export function buildAlerts(
  summaries: CompanyMonthSummary[],
  overdueTasks: Task[]
): Alert[] {
  const alerts: Alert[] = [];
  const today = todayISO();
  const day = Number(today.slice(8, 10));

  for (const s of summaries) {
    if (s.totalPlanned === 0) continue;
    const name = s.company.name;

    if (s.overdueCount > 0) {
      alerts.push({
        level: "critical",
        companySlug: s.company.slug,
        message: `${name} possui ${s.overdueCount} ${
          s.overdueCount === 1 ? "entrega atrasada" : "entregas atrasadas"
        }.`,
      });
    }

    if (s.remaining > 0 && s.daysLeft > 0) {
      alerts.push({
        level: s.level === "critical" ? "critical" : "warning",
        companySlug: s.company.slug,
        message: `Estamos no dia ${day} e você ainda precisa entregar ${s.remaining} de ${s.totalPlanned} itens previstos para ${name}. ${
          s.daysLeft === 1
            ? "Hoje é o último dia do mês."
            : `Restam ${s.daysLeft} dias para o fim do mês.`
        }`,
      });
      if (s.paceNeeded !== null && s.paceNeeded >= 1) {
        alerts.push({
          level: "warning",
          companySlug: s.company.slug,
          message: `Ritmo necessário para ${name}: aproximadamente ${
            s.paceNeeded % 1 === 0 ? s.paceNeeded : s.paceNeeded.toFixed(1)
          } ${s.paceNeeded > 1 ? "entregas" : "entrega"} por dia para cumprir a meta.`,
        });
      }
    }

    if (s.remaining === 0 && s.totalPlanned > 0) {
      alerts.push({
        level: "ok",
        companySlug: s.company.slug,
        message: `${name} está com 100% das entregas do mês concluídas.`,
      });
    } else if (s.percent >= 75 && s.level === "ok") {
      alerts.push({
        level: "ok",
        companySlug: s.company.slug,
        message: `${name} está com ${s.percent}% das entregas do mês concluídas — dentro do planejado.`,
      });
    }
  }

  if (overdueTasks.length > 0) {
    alerts.push({
      level: "critical",
      message: `${overdueTasks.length} ${
        overdueTasks.length === 1 ? "tarefa está atrasada" : "tarefas estão atrasadas"
      }.`,
    });
  }

  const order: Record<AlertLevel, number> = { critical: 0, warning: 1, ok: 2 };
  return alerts.sort((a, b) => order[a.level] - order[b.level]);
}
