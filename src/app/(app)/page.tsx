import Link from "next/link";
import { ArrowRight, DollarSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { AlertsPanel } from "@/components/alerts-panel";
import { TaskItem } from "@/components/task-item";
import { buildAlerts } from "@/lib/alerts";
import {
  getActiveCompanies,
  getMonthSummaries,
  getOverdueTasks,
  getTodayTasks,
} from "@/lib/queries";
import {
  brl,
  currentMonthRef,
  dateLabel,
  greeting,
  monthLabel,
  todayISO,
} from "@/lib/format";
import { db } from "@/lib/db";
import { pipelineDeals } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const monthRef = currentMonthRef();
  const [summaries, todayTasks, overdueTasks, companies, openDeals] =
    await Promise.all([
      getMonthSummaries(monthRef),
      getTodayTasks(),
      getOverdueTasks(),
      getActiveCompanies(),
      db.select().from(pipelineDeals).where(eq(pipelineDeals.status, "open")),
    ]);

  const alerts = buildAlerts(summaries, overdueTasks);
  const companyOptions = companies.map((c) => ({ id: c.id, name: c.name }));
  const pipelineTotal = openDeals.reduce(
    (s, d) => s + parseFloat(d.value ?? "0"),
    0
  );

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          {greeting()}, Pedro 👋
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Resumo do dia · {dateLabel(todayISO())} · {monthLabel(monthRef)}
        </p>
      </header>

      {/* Alertas */}
      <AlertsPanel alerts={alerts.filter((a) => a.level !== "ok")} />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Comercial */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
              Comercial · SOBE
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {openDeals.length > 0 ? (
              <div className="flex flex-col gap-1">
                <p className="text-2xl font-semibold tabular-nums">
                  {brl(pipelineTotal)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {openDeals.length} negócios ativos no pipeline
                </p>
                <Link
                  href="/funil"
                  className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:underline"
                >
                  Ver funil <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-muted-foreground">
                  Pipeline ainda não sincronizado.
                </p>
                <Link
                  href="/integracoes"
                  className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:underline"
                >
                  Conectar Pipedrive <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Entregas por empresa */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
              Entregas do mês
            </CardTitle>
            <Link
              href="/entregas"
              className="text-xs font-medium text-indigo-600 hover:underline"
            >
              Ver tudo
            </Link>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {summaries.filter((s) => s.totalPlanned > 0).length === 0 && (
              <p className="text-sm text-muted-foreground">
                Nenhuma entrega planejada para {monthLabel(monthRef)}. Cadastre
                na página{" "}
                <Link href="/entregas" className="text-indigo-600 hover:underline">
                  Entregas
                </Link>
                .
              </p>
            )}
            {summaries
              .filter((s) => s.totalPlanned > 0)
              .map((s) => (
                <Link
                  key={s.company.id}
                  href={`/empresas/${s.company.slug}`}
                  className="group"
                >
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="inline-flex items-center gap-2 text-sm font-medium group-hover:text-indigo-700">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: s.company.color }}
                      />
                      {s.company.name}
                    </span>
                    <span className="text-sm tabular-nums text-muted-foreground">
                      {s.totalDelivered}/{s.totalPlanned} ·{" "}
                      <strong className="text-foreground">{s.percent}%</strong>
                    </span>
                  </div>
                  <Progress value={s.percent} color={s.company.color} />
                  {s.paceNeeded !== null && (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Ritmo necessário: ~
                      {s.paceNeeded % 1 === 0
                        ? s.paceNeeded
                        : s.paceNeeded.toFixed(1)}{" "}
                      {s.paceNeeded > 1 ? "entregas" : "entrega"}/dia ·{" "}
                      {s.daysLeft} dias restantes
                    </p>
                  )}
                </Link>
              ))}
          </CardContent>
        </Card>
      </div>

      {/* Tarefas de hoje */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
            Tarefas de hoje{" "}
            {todayTasks.length > 0 && (
              <Badge tone="primary" className="ml-1">
                {todayTasks.length}
              </Badge>
            )}
          </CardTitle>
          <Link
            href="/tarefas"
            className="text-xs font-medium text-indigo-600 hover:underline"
          >
            Todas as tarefas
          </Link>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {todayTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma tarefa para hoje. 🎉
            </p>
          ) : (
            todayTasks.map((t) => (
              <TaskItem
                key={t.id}
                companies={companyOptions}
                task={{
                  id: t.id,
                  title: t.title,
                  description: t.description,
                  companyId: t.companyId,
                  dueDate: t.dueDate,
                  priority: t.priority,
                  status: t.status,
                  companyName: t.company?.name ?? null,
                  companyColor: t.company?.color ?? null,
                }}
              />
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
