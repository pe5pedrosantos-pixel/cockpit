import { and, asc, desc, eq, gte, lt, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  categories,
  companies,
  deliverableItems,
  deliverables,
  activities,
  goals,
  pdOrganizations,
  pdPersons,
  pipelineDeals,
  tasks,
  type Company,
} from "@/lib/db/schema";
import { currentMonthRef, todayISO } from "@/lib/format";
import { activityDay, activityTime, type ActivityRowData } from "@/lib/activities";
import { summarizeCompanyMonth, type CompanyMonthSummary } from "@/lib/alerts";

export async function getActiveCompanies() {
  return db
    .select()
    .from(companies)
    .where(eq(companies.isActive, true))
    .orderBy(asc(companies.name));
}

export async function getAllCompanies() {
  return db.select().from(companies).orderBy(asc(companies.name));
}

export async function getCompanyBySlug(slug: string) {
  const [c] = await db.select().from(companies).where(eq(companies.slug, slug));
  return c ?? null;
}

export async function getCategories() {
  return db.select().from(categories).orderBy(asc(categories.name));
}

export async function getDeliverables(companyId?: number, monthRef?: string) {
  const conditions = [];
  if (companyId) conditions.push(eq(deliverables.companyId, companyId));
  if (monthRef) conditions.push(eq(deliverables.monthRef, monthRef));
  return db.query.deliverables.findMany({
    where: conditions.length ? and(...conditions) : undefined,
    with: {
      company: true,
      category: true,
      items: { columns: { id: true } },
    },
    orderBy: [asc(deliverables.deadline), asc(deliverables.id)],
  });
}

/** Links publicados de uma empresa (todos os meses), mais recentes primeiro. */
export async function getCompanyItems(companyId: number) {
  return db.query.deliverableItems.findMany({
    where: eq(deliverableItems.companyId, companyId),
    with: { deliverable: { columns: { title: true } } },
    orderBy: [desc(deliverableItems.publishedAt), desc(deliverableItems.id)],
  });
}

export async function getActiveGoals(companyId?: number) {
  return db
    .select()
    .from(goals)
    .where(
      companyId
        ? and(eq(goals.isActive, true), eq(goals.companyId, companyId))
        : eq(goals.isActive, true)
    )
    .orderBy(asc(goals.period), asc(goals.id));
}

/** Itens que podem contar para metas: do início do mês anterior em diante. */
export async function getRecentItems() {
  const [y, m] = currentMonthRef().split("-").map(Number);
  const prev = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
  return db
    .select()
    .from(deliverableItems)
    .where(gte(deliverableItems.monthRef, prev));
}

export async function getMonthSummaries(
  monthRef: string
): Promise<CompanyMonthSummary[]> {
  // duas consultas no total — nunca uma por empresa
  const [list, items] = await Promise.all([
    db
      .select()
      .from(companies)
      .where(
        and(eq(companies.isActive, true), eq(companies.hasDeliverables, true))
      )
      .orderBy(asc(companies.name)),
    db.select().from(deliverables).where(eq(deliverables.monthRef, monthRef)),
  ]);

  const byCompany = new Map<number, typeof items>();
  for (const item of items) {
    const arr = byCompany.get(item.companyId);
    if (arr) arr.push(item);
    else byCompany.set(item.companyId, [item]);
  }

  return list.map((company) =>
    summarizeCompanyMonth(company, monthRef, byCompany.get(company.id) ?? [])
  );
}

export async function getTasks() {
  return db.query.tasks.findMany({
    with: { company: true },
    orderBy: [asc(tasks.dueDate), desc(tasks.priority), asc(tasks.id)],
  });
}

export async function getTodayTasks() {
  const today = todayISO();
  const all = await db.query.tasks.findMany({
    with: { company: true },
    where: ne(tasks.status, "CONCLUIDA"),
    orderBy: [asc(tasks.dueDate)],
  });
  return all.filter((t) => t.dueDate && t.dueDate <= today);
}

export async function getOverdueTasks() {
  const today = todayISO();
  return db.query.tasks.findMany({
    with: { company: true },
    where: and(ne(tasks.status, "CONCLUIDA"), lt(tasks.dueDate, today)),
    orderBy: [asc(tasks.dueDate)],
  });
}

/** Histórico: resumo por mês para uma empresa. */
export async function getCompanyHistory(company: Company) {
  const items = await db
    .select()
    .from(deliverables)
    .where(eq(deliverables.companyId, company.id))
    .orderBy(desc(deliverables.monthRef));

  const byMonth = new Map<string, typeof items>();
  for (const item of items) {
    const list = byMonth.get(item.monthRef) ?? [];
    list.push(item);
    byMonth.set(item.monthRef, list);
  }
  return [...byMonth.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([monthRef, list]) => summarizeCompanyMonth(company, monthRef, list));
}

// ─── CRM ──────────────────────────────────────────────────────────────────

type ActivityJoin = {
  a: typeof activities.$inferSelect;
  dealTitle: string | null;
  dealOrg: string | null;
  orgName: string | null;
};

function toActivityRow({ a, dealTitle, dealOrg, orgName }: ActivityJoin, today: string): ActivityRowData {
  const day = a.dueAt ? activityDay(a.dueAt, a.hasTime) : null;
  return {
    id: a.id,
    pipedriveId: a.pipedriveId,
    subject: a.subject,
    type: a.type,
    note: a.note,
    day,
    time: a.dueAt ? activityTime(a.dueAt, a.hasTime) : null,
    done: a.done,
    overdue: !a.done && day != null && day < today,
    dealTitle,
    orgName: dealOrg ?? orgName,
  };
}

function activityQuery() {
  return db
    .select({
      a: activities,
      dealTitle: pipelineDeals.title,
      dealOrg: pipelineDeals.orgName,
      orgName: pdOrganizations.name,
    })
    .from(activities)
    .leftJoin(pipelineDeals, eq(activities.dealId, pipelineDeals.id))
    .leftJoin(pdOrganizations, eq(activities.orgPipedriveId, pdOrganizations.pipedriveId));
}

/** Atividades abertas de hoje e atrasadas, das mais antigas para as de hoje. */
export async function getDueActivities(): Promise<ActivityRowData[]> {
  const today = todayISO();
  // margem de um dia: o filtro fino por dia local acontece abaixo
  const limit = new Date(`${today}T00:00:00Z`);
  limit.setUTCDate(limit.getUTCDate() + 2);
  const rows = await activityQuery()
    .where(and(eq(activities.done, false), lt(activities.dueAt, limit)))
    .orderBy(asc(activities.dueAt));
  return rows
    .map((r) => toActivityRow(r, today))
    .filter((r) => r.day != null && r.day <= today);
}

/** Todas as atividades de um negócio (abertas primeiro). */
export async function getDealActivities(dealId: number): Promise<ActivityRowData[]> {
  const today = todayISO();
  const rows = await activityQuery()
    .where(eq(activities.dealId, dealId))
    .orderBy(asc(activities.done), asc(activities.dueAt));
  return rows.map((r) => toActivityRow(r, today));
}

export interface ClientRow {
  pipedriveId: number;
  name: string;
  ownerName: string | null;
  contacts: { name: string; email: string | null; phone: string | null }[];
  openDeals: { id: number; pipedriveId: number | null; title: string; stageName: string | null; value: string | null }[];
  wonDeals: number;
  wonValue: number;
  nextActivity: { subject: string; day: string; time: string | null; overdue: boolean } | null;
  status: "cliente" | "negociacao" | "perdido" | "sem-negocio";
}

/** Organizações do Pipedrive com contatos, negócios e próxima atividade. */
export async function getClients(): Promise<ClientRow[]> {
  const today = todayISO();
  const [orgs, persons, deals, openActs] = await Promise.all([
    db.select().from(pdOrganizations).orderBy(asc(pdOrganizations.name)),
    db.select().from(pdPersons).orderBy(asc(pdPersons.name)),
    db.select().from(pipelineDeals),
    db.select().from(activities).where(eq(activities.done, false)).orderBy(asc(activities.dueAt)),
  ]);

  const dealOrg = new Map(deals.map((d) => [d.id, d.orgId]));
  const nextByOrg = new Map<number, ClientRow["nextActivity"]>();
  for (const a of openActs) {
    const orgId = a.orgPipedriveId ?? (a.dealId ? dealOrg.get(a.dealId) : null);
    if (!orgId || !a.dueAt || nextByOrg.has(orgId)) continue;
    const day = activityDay(a.dueAt, a.hasTime);
    nextByOrg.set(orgId, {
      subject: a.subject,
      day,
      time: activityTime(a.dueAt, a.hasTime),
      overdue: day < today,
    });
  }

  return orgs.map((o) => {
    const orgDeals = deals.filter((d) => d.orgId === o.pipedriveId);
    const open = orgDeals.filter((d) => d.status === "open");
    const won = orgDeals.filter((d) => d.status === "won");
    const status: ClientRow["status"] =
      won.length > 0
        ? "cliente"
        : open.length > 0
          ? "negociacao"
          : orgDeals.length > 0
            ? "perdido"
            : "sem-negocio";
    return {
      pipedriveId: o.pipedriveId,
      name: o.name,
      ownerName: o.ownerName,
      contacts: persons
        .filter((p) => p.orgPipedriveId === o.pipedriveId)
        .map((p) => ({ name: p.name, email: p.email, phone: p.phone })),
      openDeals: open.map((d) => ({
        id: d.id,
        pipedriveId: d.pipedriveId,
        title: d.title,
        stageName: d.stageName,
        value: d.value,
      })),
      wonDeals: won.length,
      wonValue: won.reduce(
        (s, d) => s + (d.isRecurring && d.monthlyValue ? Number(d.monthlyValue) : Number(d.value ?? 0)),
        0
      ),
      nextActivity: nextByOrg.get(o.pipedriveId) ?? null,
      status,
    };
  });
}
