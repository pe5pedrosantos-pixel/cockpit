import { and, asc, desc, eq, lt, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  categories,
  companies,
  deliverables,
  tasks,
  type Company,
} from "@/lib/db/schema";
import { todayISO } from "@/lib/format";
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
    with: { company: true, category: true },
    orderBy: [asc(deliverables.deadline), asc(deliverables.id)],
  });
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
