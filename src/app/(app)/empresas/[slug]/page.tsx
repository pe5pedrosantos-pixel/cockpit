import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertsPanel } from "@/components/alerts-panel";
import { DeliverableFormDialog } from "@/components/deliverable-form";
import { DeliverablesKanban } from "@/components/deliverables-kanban";
import { EntregasFilters } from "@/components/filters";
import { GoalsPanel } from "@/components/goals-panel";
import { LinkImportDialog } from "@/components/link-import";
import { PublishedList } from "@/components/published-list";
import { TaskFormDialog } from "@/components/task-form";
import { TaskItem } from "@/components/task-item";
import { buildAlerts, summarizeCompanyMonth } from "@/lib/alerts";
import { db } from "@/lib/db";
import { deliverables, tasks } from "@/lib/db/schema";
import { currentMonthRef, monthLabel, num } from "@/lib/format";
import { goalProgress } from "@/lib/goals";
import {
  getActiveCompanies,
  getActiveGoals,
  getCategories,
  getCompanyBySlug,
  getCompanyHistory,
  getCompanyItems,
  getDeliverables,
} from "@/lib/queries";
import { toDeliverableCard, toTaskItem } from "@/lib/serialize";

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

  const [companies, categories, items, history, companyTasks, goals, published, allDeliverables] =
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
      getActiveGoals(company.id),
      getCompanyItems(company.id),
      db
        .select({ id: deliverables.id, title: deliverables.title, monthRef: deliverables.monthRef })
        .from(deliverables)
        .where(eq(deliverables.companyId, company.id)),
    ]);

  const cards = items.map(toDeliverableCard);
  const summary = summarizeCompanyMonth(company, monthRef, items);
  const alerts = buildAlerts([summary], []);

  const goalRows = goals.map((g) => {
    const p = goalProgress(g, published);
    return {
      id: g.id,
      title: g.title,
      platform: g.platform,
      format: g.format,
      targetQty: g.targetQty,
      period: g.period as "week" | "month",
      done: p.done,
      remaining: p.remaining,
      percent: p.percent,
      daysLeft: p.daysLeft,
      behind: p.behind,
      periodStart: p.period.start,
      periodEnd: p.period.end,
    };
  });

  const companyOptions = companies
    .filter((c) => c.hasDeliverables)
    .map((c) => ({ id: c.id, name: c.name }));
  const categoryOptions = categories.map((c) => ({ id: c.id, name: c.name }));

  const byCategory = new Map<string, { planned: number; delivered: number }>();
  for (const d of cards) {
    const key = d.categoryName ?? d.title;
    const cur = byCategory.get(key) ?? { planned: 0, delivered: 0 };
    cur.planned += d.plannedQty;
    cur.delivered += Math.min(d.deliveredQty, d.plannedQty);
    byCategory.set(key, cur);
  }

  const hasPlan = summary.totalPlanned > 0;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-lg font-display text-sm font-extrabold text-white"
            style={{ backgroundColor: company.color }}
          >
            {company.name
              .split(/\s+/)
              .map((w) => w[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()}
          </span>
          <div>
            <h1 className="font-display text-[24px] font-extrabold tracking-[-0.025em]">
              {company.name}
            </h1>
            {company.description && (
              <p className="text-[13.5px] text-ink-muted">{company.description}</p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <LinkImportDialog
            companyId={company.id}
            companyName={company.name}
            defaultMonth={monthRef}
            deliverables={allDeliverables}
            goalsOnly={goals.length > 0 && allDeliverables.length === 0}
          />
          <EntregasFilters companies={[]} selectedMonth={monthRef} showCompany={false} />
        </div>
      </header>

      {(goalRows.length > 0 || !hasPlan) && (
        <GoalsPanel goals={goalRows} companyId={company.id} color={company.color} />
      )}

      {hasPlan && (
        <Card>
          <CardContent className="flex flex-col gap-4 py-5">
            <div>
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-display text-[15px] font-semibold">
                  Plano de {monthLabel(monthRef).split("/")[0].toLowerCase()}
                </p>
                <p className="text-[12.5px] tabular-nums text-ink-muted">
                  {summary.totalDelivered} de {summary.totalPlanned} entregues
                  <span className="ml-2 font-display text-[15px] font-extrabold text-ink">
                    {summary.percent}%
                  </span>
                </p>
              </div>
              <Progress value={summary.percent} color={company.color} className="h-2" />
              {summary.paceNeeded !== null && (
                <p className="mt-2 text-[12px] text-ink-muted">
                  Faltam {summary.remaining} em {summary.daysLeft} dias — cerca de{" "}
                  {num(summary.paceNeeded)} por dia.
                </p>
              )}
              {summary.remaining === 0 && (
                <p className="mt-2 text-[12px] font-medium text-money">
                  Todas as entregas do mês estão concluídas.
                </p>
              )}
            </div>

            {byCategory.size > 1 && (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[...byCategory.entries()].map(([name, v]) => {
                  const p = v.planned > 0 ? Math.round((v.delivered / v.planned) * 100) : 0;
                  return (
                    <div key={name} className="rounded-md border border-border p-3">
                      <div className="mb-1.5 flex items-center justify-between gap-2 text-[12px]">
                        <span className="truncate font-medium">{name}</span>
                        <span className="shrink-0 tabular-nums text-ink-muted">
                          {v.delivered} de {v.planned}
                        </span>
                      </div>
                      <Progress value={p} color={company.color} />
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue={hasPlan ? "entregas" : "publicado"}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <TabsList>
            <TabsTrigger value="entregas">Entregas</TabsTrigger>
            <TabsTrigger value="publicado">
              Publicado{published.length > 0 ? ` (${published.length})` : ""}
            </TabsTrigger>
            <TabsTrigger value="tarefas">Tarefas</TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
          </TabsList>
          <div className="flex gap-2 pb-2">
            <TaskFormDialog companies={companyOptions} defaultCompanyId={company.id} />
            <DeliverableFormDialog
              companies={companyOptions}
              categories={categoryOptions}
              defaultMonth={monthRef}
              defaultCompanyId={company.id}
            />
          </div>
        </div>

        <TabsContent value="entregas" className="flex flex-col gap-4">
          {hasPlan && (
            <AlertsPanel
              alerts={alerts.filter((a) => a.level !== "ok")}
              emptyMessage={`${company.name} está em dia neste mês.`}
            />
          )}
          <DeliverablesKanban
            items={cards}
            companies={companyOptions}
            categories={categoryOptions}
            defaultMonth={monthRef}
            showCompany={false}
          />
        </TabsContent>

        <TabsContent value="publicado">
          <PublishedList
            items={published.map((p) => ({
              id: p.id,
              url: p.url,
              platform: p.platform,
              format: p.format,
              title: p.title,
              monthRef: p.monthRef,
              publishedAt: p.publishedAt,
              deliverableTitle: p.deliverable?.title ?? null,
            }))}
          />
        </TabsContent>

        <TabsContent value="tarefas" className="flex flex-col gap-2">
          {companyTasks.length === 0 && (
            <p className="text-[13.5px] text-ink-muted">Nenhuma tarefa para {company.name}.</p>
          )}
          {companyTasks.map((t) => (
            <TaskItem key={t.id} task={toTaskItem(t)} companies={companyOptions} />
          ))}
        </TabsContent>

        <TabsContent value="historico" className="flex flex-col gap-2">
          {history.length === 0 && (
            <p className="text-[13.5px] text-ink-muted">Ainda não há histórico de entregas.</p>
          )}
          {history.map((h) => (
            <div
              key={h.monthRef}
              className="flex items-center gap-4 rounded-lg border border-border bg-paper px-4 py-3"
            >
              <div className="w-32 shrink-0">
                <p className="text-[13.5px] font-medium">{monthLabel(h.monthRef)}</p>
                <p className="text-[11.5px] tabular-nums text-ink-muted">
                  {h.totalDelivered} de {h.totalPlanned}
                  {h.extra > 0 && (
                    <span className="text-money">, +{h.extra} extra</span>
                  )}
                </p>
              </div>
              <Progress value={h.percent} color={company.color} className="flex-1" />
              <span className="w-12 text-right font-display text-[14px] font-extrabold tabular-nums">
                {h.percent}%
              </span>
            </div>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
