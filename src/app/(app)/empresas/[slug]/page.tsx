import { notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertsPanel } from "@/components/alerts-panel";
import { DeliverableFormDialog } from "@/components/deliverable-form";
import { DeliverablesKanban } from "@/components/deliverables-kanban";
import { EntregasFilters } from "@/components/filters";
import { TaskFormDialog } from "@/components/task-form";
import { TaskItem } from "@/components/task-item";
import { buildAlerts, summarizeCompanyMonth } from "@/lib/alerts";
import { currentMonthRef, monthLabel } from "@/lib/format";
import {
  getActiveCompanies,
  getCategories,
  getCompanyBySlug,
  getCompanyHistory,
  getDeliverables,
} from "@/lib/queries";
import { toDeliverableCard, toTaskItem } from "@/lib/serialize";
import { db } from "@/lib/db";
import { tasks } from "@/lib/db/schema";
import { asc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function CompanyPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ mes?: string }>;
}) {
  const { slug } = await params;
  const { mes } = await searchParams;
  const monthRef = mes ?? currentMonthRef();

  const company = await getCompanyBySlug(slug);
  if (!company) notFound();

  const [companies, categories, items, history, companyTasks] =
    await Promise.all([
      getActiveCompanies(),
      getCategories(),
      getDeliverables(company.id, monthRef),
      getCompanyHistory(company),
      db.query.tasks.findMany({
        where: eq(tasks.companyId, company.id),
        with: { company: true },
        orderBy: [asc(tasks.dueDate)],
      }),
    ]);

  const cards = items.map(toDeliverableCard);
  const summary = summarizeCompanyMonth(company, monthRef, items);
  const alerts = buildAlerts([summary], []);

  const companyOptions = companies
    .filter((c) => c.hasDeliverables)
    .map((c) => ({ id: c.id, name: c.name }));
  const categoryOptions = categories.map((c) => ({ id: c.id, name: c.name }));

  // progresso por categoria
  const byCategory = new Map<
    string,
    { planned: number; delivered: number }
  >();
  for (const d of cards) {
    const key = d.categoryName ?? "Sem categoria";
    const cur = byCategory.get(key) ?? { planned: 0, delivered: 0 };
    cur.planned += d.plannedQty;
    cur.delivered += Math.min(d.deliveredQty, d.plannedQty);
    byCategory.set(key, cur);
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold text-white"
            style={{ backgroundColor: company.color }}
          >
            {company.name.slice(0, 2).toUpperCase()}
          </span>
          <div>
            <h1 className="font-display text-[24px] font-extrabold tracking-[-0.025em]">
              {company.name}
            </h1>
            {company.description && (
              <p className="text-sm text-ink-muted">
                {company.description}
              </p>
            )}
          </div>
        </div>
        <EntregasFilters
          companies={[]}
          selectedMonth={monthRef}
          showCompany={false}
        />
      </header>

      {/* Progresso do mês */}
      <Card>
        <CardContent className="flex flex-col gap-4 p-5">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold">
                {company.name} — {monthLabel(monthRef)}
              </p>
              <p className="text-sm tabular-nums text-ink-muted">
                {summary.totalDelivered} de {summary.totalPlanned} itens · 
                <strong className="text-ink">{summary.percent}%</strong>
              </p>
            </div>
            <Progress value={summary.percent} color={company.color} className="h-3" />
            {summary.paceNeeded !== null && (
              <p className="mt-2 text-xs text-ink-muted">
                Ritmo necessário: cerca de 
                {summary.paceNeeded % 1 === 0
                  ? summary.paceNeeded
                  : summary.paceNeeded.toFixed(1)}{" "}
                {summary.paceNeeded > 1 ? "entregas" : "entrega"} por dia (
                faltam {summary.remaining} em {summary.daysLeft} dias)
              </p>
            )}
            {summary.remaining === 0 && summary.totalPlanned > 0 && (
              <p className="mt-2 text-xs font-medium text-money">
                Todas as entregas do mês estão concluídas.
              </p>
            )}
          </div>

          {byCategory.size > 0 && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[...byCategory.entries()].map(([name, v]) => {
                const p =
                  v.planned > 0
                    ? Math.round((v.delivered / v.planned) * 100)
                    : 0;
                return (
                  <div
                    key={name}
                    className="rounded-lg border border-border p-3"
                  >
                    <div className="mb-1.5 flex items-center justify-between text-xs">
                      <span className="font-medium">{name}</span>
                      <span className="tabular-nums text-ink-muted">
                        {v.delivered} de {v.planned}
                      </span>
                    </div>
                    <Progress value={p} className="h-1.5" />
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="entregas">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <TabsList>
            <TabsTrigger value="entregas">Entregas</TabsTrigger>
            <TabsTrigger value="tarefas">Tarefas</TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
          </TabsList>
          <div className="flex gap-2">
            <TaskFormDialog
              companies={companyOptions}
              defaultCompanyId={company.id}
            />
            <DeliverableFormDialog
              companies={companyOptions}
              categories={categoryOptions}
              defaultMonth={monthRef}
              defaultCompanyId={company.id}
            />
          </div>
        </div>

        <TabsContent value="entregas" className="flex flex-col gap-4">
          <AlertsPanel
            alerts={alerts.filter((a) => a.level !== "ok")}
            emptyMessage={`${company.name} está em dia.`}
          />
          <DeliverablesKanban
            items={cards}
            companies={companyOptions}
            categories={categoryOptions}
            defaultMonth={monthRef}
            showCompany={false}
          />
        </TabsContent>

        <TabsContent value="tarefas" className="flex flex-col gap-2">
          {companyTasks.length === 0 && (
            <p className="text-sm text-ink-muted">
              Nenhuma tarefa para {company.name}.
            </p>
          )}
          {companyTasks.map((t) => (
            <TaskItem key={t.id} task={toTaskItem(t)} companies={companyOptions} />
          ))}
        </TabsContent>

        <TabsContent value="historico" className="flex flex-col gap-3">
          {history.length === 0 && (
            <p className="text-sm text-ink-muted">
              Ainda não há histórico de entregas.
            </p>
          )}
          {history.map((h) => (
            <Card key={h.monthRef}>
              <CardContent className="flex items-center gap-4 p-4">
                <div className="w-36 shrink-0">
                  <p className="text-sm font-semibold">
                    {monthLabel(h.monthRef)}
                  </p>
                  <p className="text-xs text-ink-muted tabular-nums">
                    {h.totalDelivered}/{h.totalPlanned} itens
                  </p>
                </div>
                <Progress
                  value={h.percent}
                  color={company.color}
                  className="flex-1"
                />
                <span className="w-14 text-right text-sm font-semibold tabular-nums">
                  {h.percent}%
                </span>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
