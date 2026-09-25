import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { integrations, leads, pipelineDeals } from "@/lib/db/schema";
import { LEAD_INTERESTS } from "@/lib/leads";
import { Card, CardContent, CardHeader, CardTitle, Stat } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { DayHeadline } from "@/components/day-headline";
import { SyncButton } from "@/components/sync-button";
import { TaskItem } from "@/components/task-item";
import { WonDeals } from "@/components/won-deals";
import { buildAlerts } from "@/lib/alerts";
import { isPipedriveConfigured } from "@/lib/pipedrive/client";
import {
  getActiveCompanies,
  getActiveGoals,
  getDueActivities,
  getMonthSummaries,
  getOverdueTasks,
  getRecentItems,
  getTodayTasks,
} from "@/lib/queries";
import { goalProgress } from "@/lib/goals";
import { CrmActivityList } from "@/components/crm-activities";
import { monthlyOf, summarizeRevenue, wonDate } from "@/lib/revenue";
import {
  brl,
  currentMonthRef,
  greeting,
  monthLabel,
  num,
  todayISO,
} from "@/lib/format";
import { toTaskItem } from "@/lib/serialize";

export const dynamic = "force-dynamic";

const DIAS = [
  "domingo",
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
];
const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

function diaPorExtenso(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return `${DIAS[date.getUTCDay()]}, ${d} de ${MESES[m - 1]}`;
}

export default async function DashboardPage() {
  const monthRef = currentMonthRef();
  const today = todayISO();

  const [
    summaries,
    todayTasks,
    overdueTasks,
    companies,
    openDeals,
    [integration],
    wonDeals,
    goals,
    recentItems,
    crmActivities,
    newLeads,
  ] = await Promise.all([
    getMonthSummaries(monthRef),
    getTodayTasks(),
    getOverdueTasks(),
    getActiveCompanies(),
    db.select().from(pipelineDeals).where(eq(pipelineDeals.status, "open")),
    db.select().from(integrations).where(eq(integrations.provider, "pipedrive")),
    db.select().from(pipelineDeals).where(eq(pipelineDeals.status, "won")),
    getActiveGoals(),
    getRecentItems(),
    getDueActivities(),
    db
      .select()
      .from(leads)
      .where(eq(leads.seen, false))
      .orderBy(desc(leads.createdAt))
      .limit(8),
  ]);

  const overdueActivities = openDeals.filter(
    (d) => d.nextActivityAt && d.nextActivityAt.toISOString().slice(0, 10) < today
  ).length;
  const noFollowUp = openDeals.filter((d) => !d.nextActivityAt).length;

  const companyById = new Map(companies.map((c) => [c.id, c]));
  const goalRows = goals
    .map((g) => ({ g, p: goalProgress(g, recentItems), c: companyById.get(g.companyId) }))
    .filter((r) => r.c);

  const alerts = [
    ...buildAlerts(summaries, overdueTasks, { overdueActivities, noFollowUp }),
    ...goalRows
      .filter((r) => r.p.behind)
      .map((r) => ({
        level: "warning" as const,
        companySlug: r.c!.slug,
        message: `${r.c!.name}: ${r.g.title.toLowerCase()} em ${r.p.done} de ${r.g.targetQty} ${
          r.g.period === "week" ? "esta semana" : "este mês"
        }, faltam ${r.p.daysLeft} ${r.p.daysLeft === 1 ? "dia" : "dias"}.`,
      })),
    ...(newLeads.length > 0
      ? [
          {
            level: "warning" as const,
            message: `${newLeads.length} ${
              newLeads.length === 1 ? "lead novo do site esperando" : "leads novos do site esperando"
            } retorno no funil Pedro Santos.`,
          },
        ]
      : []),
  ].sort((a, b) => (a.level === b.level ? 0 : a.level === "critical" ? -1 : 1));
  const companyOptions = companies.map((c) => ({ id: c.id, name: c.name }));
  const pipelineTotal = openDeals.reduce((s, d) => s + parseFloat(d.value ?? "0"), 0);
  const revenue = summarizeRevenue(wonDeals);
  const active = summaries.filter((s) => s.totalPlanned > 0);

  return (
    <div className="flex flex-col gap-9">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <DayHeadline
          greeting={greeting()}
          dateLabel={diaPorExtenso(today)}
          alerts={alerts}
        />
        <SyncButton
          lastSyncAt={integration?.lastSyncAt?.toISOString() ?? null}
          configured={isPipedriveConfigured()}
          auto
        />
      </div>

      {/* Leads novos do site (funil Pedro Santos) */}
      {newLeads.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-[15px] font-semibold tracking-tight">
              Leads novos do site
            </h2>
            <Link
              href="/leads"
              className="text-[12.5px] text-ink-muted underline-offset-2 hover:text-coral hover:underline"
            >
              Abrir funil Pedro Santos
            </Link>
          </div>
          <div className="flex flex-col gap-2">
            {newLeads.map((l) => (
              <Link
                key={l.id}
                href="/leads"
                className="flex items-center gap-3 rounded-lg border border-coral/30 bg-attention-bg px-3 py-2.5 hover:border-coral"
              >
                <span className="h-2 w-2 shrink-0 rounded-full bg-coral" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {l.name}
                  {l.organization && <span className="font-normal text-ink-muted">, {l.organization}</span>}
                </span>
                <span className="shrink-0 text-[11.5px] text-ink-muted">
                  {l.interest ? (LEAD_INTERESTS[l.interest] ?? l.interest) : "Contato"}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Comercial */}
      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-[15px] font-semibold tracking-tight">
            Comercial na SOBE
          </h2>
          <Link
            href="/funil"
            className="text-[12.5px] text-ink-muted underline-offset-2 hover:text-coral hover:underline"
          >
            Abrir funil
          </Link>
        </div>

        {openDeals.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Em negociação agora" value={brl(pipelineTotal)} />
            <Stat label="Negócios abertos" value={openDeals.length} />
            <Stat
              label="Atividades atrasadas"
              value={overdueActivities}
              tone={overdueActivities > 0 ? "attention" : "default"}
            />
            <Stat
              label="Sem próximo passo marcado"
              value={noFollowUp}
              tone={noFollowUp > 0 ? "attention" : "default"}
            />
          </div>
        ) : (
          <Card>
            <CardContent className="py-6">
              <p className="text-[13.5px] text-ink-muted">
                O funil ainda não foi sincronizado.{" "}
                <Link href="/integracoes" className="text-coral underline underline-offset-2">
                  Conectar o Pipedrive
                </Link>
                .
              </p>
            </CardContent>
          </Card>
        )}
      </section>

      {/* Receita fechada */}
      {wonDeals.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-[15px] font-semibold tracking-tight">
            Receita fechada
          </h2>
          <div className="grid items-start gap-3 lg:grid-cols-3">
            <div className="flex flex-col gap-3">
              <Stat
                label={`Fechado em ${monthLabel(monthRef).split("/")[0].toLowerCase()}`}
                value={brl(revenue.wonThisMonth)}
                note={`${brl(revenue.wonThisYear)} acumulado no ano`}
                tone={revenue.wonThisMonth > 0 ? "money" : "default"}
              />
              <Stat
                label="Receita recorrente por mês"
                value={revenue.mrr > 0 ? brl(revenue.mrr) : "Não marcada"}
                note={
                  revenue.mrr > 0
                    ? `${brl(revenue.mrr * 12)} por ano`
                    : "Marque os contratos mensais na lista de fechados"
                }
                tone={revenue.mrr > 0 ? "money" : "default"}
              />
            </div>
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Últimos negócios fechados</CardTitle>
              </CardHeader>
              <CardContent>
                <WonDeals
                  deals={revenue.recent.map((d) => ({
                    id: d.id,
                    title: d.title,
                    orgName: d.orgName,
                    value: parseFloat(d.value ?? "0"),
                    wonAt: wonDate(d),
                    isRecurring: d.isRecurring,
                    monthly: monthlyOf(d),
                  }))}
                />
              </CardContent>
            </Card>
          </div>
        </section>
      )}

      {/* Entregas do mês */}
      {active.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-[15px] font-semibold tracking-tight">
              Entregas de {monthLabel(monthRef).split("/")[0].toLowerCase()}
            </h2>
            <Link
              href="/entregas"
              className="text-[12.5px] text-ink-muted underline-offset-2 hover:text-coral hover:underline"
            >
              Ver todas
            </Link>
          </div>
          <Card>
            <CardContent className="flex flex-col gap-5 py-5">
              {active.map((s) => (
                <Link
                  key={s.company.id}
                  href={`/empresas/${s.company.slug}`}
                  className="group block"
                >
                  <div className="mb-2 flex items-baseline justify-between gap-4">
                    <span className="flex items-center gap-2 text-[13.5px] font-medium group-hover:text-coral">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: s.company.color }}
                      />
                      {s.company.name}
                    </span>
                    <span className="text-[12.5px] text-ink-muted tabular-nums">
                      {s.totalDelivered} de {s.totalPlanned} entregues
                      <span className="ml-2 font-display text-[15px] font-extrabold text-ink">
                        {s.percent}%
                      </span>
                    </span>
                  </div>
                  <Progress
                    value={s.percent}
                    color={s.company.color}
                    label={`${s.company.name}: ${s.percent}% entregue`}
                  />
                  {s.paceNeeded !== null && (
                    <p className="mt-1.5 text-[12px] text-ink-muted">
                      Faltam {s.remaining} em {s.daysLeft} dias — cerca de{" "}
                      {num(s.paceNeeded)} por dia para fechar o mês.
                    </p>
                  )}
                </Link>
              ))}
            </CardContent>
          </Card>
        </section>
      )}

      {/* Metas recorrentes */}
      {goalRows.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-[15px] font-semibold tracking-tight">
            Metas da semana e do mês
          </h2>
          <Card>
            <CardContent className="grid gap-x-8 gap-y-4 py-5 sm:grid-cols-2">
              {goalRows.map(({ g, p, c }) => (
                <Link key={g.id} href={`/empresas/${c!.slug}`} className="group block">
                  <div className="mb-1.5 flex items-baseline justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-2 text-[13px] group-hover:text-coral">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: c!.color }}
                      />
                      <span className="truncate">
                        <span className="font-medium">{c!.name}</span>{" "}
                        <span className="text-ink-muted">{g.title}</span>
                      </span>
                    </span>
                    <span
                      className={`shrink-0 font-display text-[14px] font-extrabold tabular-nums ${
                        p.behind ? "text-coral" : p.remaining === 0 ? "text-money" : "text-ink"
                      }`}
                    >
                      {p.done}/{g.targetQty}
                    </span>
                  </div>
                  <Progress
                    value={p.percent}
                    color={p.behind ? "var(--coral)" : p.remaining === 0 ? "var(--money)" : c!.color}
                    label={`${c!.name} ${g.title}: ${p.done} de ${g.targetQty}`}
                  />
                  <p className="mt-1 text-[11.5px] text-ink-faint">
                    {g.period === "week" ? "esta semana" : "este mês"}
                    {p.remaining > 0 &&
                      `, ${p.daysLeft} ${p.daysLeft === 1 ? "dia restante" : "dias restantes"}`}
                    {`; ${g.period === "week" ? "semana passada" : "mês passado"} ${p.previousDone} de ${g.targetQty}`}
                  </p>
                </Link>
              ))}
            </CardContent>
          </Card>
        </section>
      )}

      {/* Atividades comerciais do Pipedrive */}
      {crmActivities.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-[15px] font-semibold tracking-tight">
              Atividades comerciais
            </h2>
            <Link
              href="/clientes"
              className="text-[12.5px] text-ink-muted underline-offset-2 hover:text-coral hover:underline"
            >
              Ver clientes
            </Link>
          </div>
          <CrmActivityList activities={crmActivities} />
        </section>
      )}

      {/* Tarefas de hoje */}
      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-[15px] font-semibold tracking-tight">
            Para fazer hoje
          </h2>
          <Link
            href="/tarefas"
            className="text-[12.5px] text-ink-muted underline-offset-2 hover:text-coral hover:underline"
          >
            Todas as tarefas
          </Link>
        </div>
        {todayTasks.length === 0 ? (
          <Card>
            <CardContent className="py-6">
              <p className="text-[13.5px] text-ink-muted">
                Nenhuma tarefa marcada para hoje.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-2">
            {todayTasks.map((t) => (
              <TaskItem
                key={t.id}
                companies={companyOptions}
                task={toTaskItem(t)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
