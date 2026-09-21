import {
  boolean,
  date,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ─── Enums ────────────────────────────────────────────────────────────────

export const deliverableStatus = pgEnum("deliverable_status", [
  "PLANEJADO",
  "EM_ANDAMENTO",
  "CONCLUIDO",
  "ATRASADO",
]);

export const taskStatus = pgEnum("task_status", [
  "A_FAZER",
  "EM_ANDAMENTO",
  "CONCLUIDA",
]);

export const taskPriority = pgEnum("task_priority", [
  "BAIXA",
  "MEDIA",
  "ALTA",
  "URGENTE",
]);

// ─── Tabelas principais ───────────────────────────────────────────────────

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const companies = pgTable("companies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  color: text("color").notNull().default("#6366f1"),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  // empresas com entregáveis de marketing aparecem no "Gerenciamento de Atividades"
  hasDeliverables: boolean("has_deliverables").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  color: text("color"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const deliverables = pgTable("deliverables", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  categoryId: integer("category_id").references(() => categories.id, {
    onDelete: "set null",
  }),
  title: text("title").notNull(),
  description: text("description"),
  monthRef: text("month_ref").notNull(), // formato: "2026-09"
  plannedQty: integer("planned_qty").notNull().default(1),
  deliveredQty: integer("delivered_qty").notNull().default(0),
  deadline: date("deadline"),
  status: deliverableStatus("status").notNull().default("PLANEJADO"),
  /** rede onde a entrega é publicada, quando se aplica */
  platform: text("platform"),
  owner: text("owner"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/**
 * Cada peça publicada, com o link. É a prova da entrega e a base das metas:
 * registrar um link avança o entregável a que pertence e as metas da empresa.
 */
export const deliverableItems = pgTable("deliverable_items", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  deliverableId: integer("deliverable_id").references(() => deliverables.id, {
    onDelete: "set null",
  }),
  monthRef: text("month_ref").notNull(),
  url: text("url").notNull(),
  platform: text("platform").notNull(), // instagram | linkedin | youtube | tiktok | facebook | x | outro
  format: text("format"), // estatico | carrossel | video | reels | vlog | artigo | outro
  title: text("title"),
  publishedAt: date("published_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * Metas recorrentes (ex.: 4 posts por semana no Instagram).
 * Não precisam ser recriadas todo mês: o progresso é contado a partir dos
 * links registrados no período.
 */
export const goals = pgTable("goals", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  platform: text("platform").notNull(),
  /** quando definido, só contam itens desse formato (ex.: vlog) */
  format: text("format"),
  targetQty: integer("target_qty").notNull(),
  period: text("period").notNull(), // week | month
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  companyId: integer("company_id").references(() => companies.id, {
    onDelete: "set null",
  }), // null = Pessoal
  dueDate: date("due_date"),
  priority: taskPriority("priority").notNull().default("MEDIA"),
  status: taskStatus("status").notNull().default("A_FAZER"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Fase 2: espelho local do Pipedrive (SOBE) ────────────────────────────

export const pipelineDeals = pgTable("pipeline_deals", {
  id: serial("id").primaryKey(),
  pipedriveId: integer("pipedrive_id").unique(),
  title: text("title").notNull(),
  orgId: integer("org_id"),
  orgName: text("org_name"),
  personId: integer("person_id"),
  personName: text("person_name"),
  ownerId: integer("owner_id"),
  ownerName: text("owner_name"),
  value: numeric("value", { precision: 14, scale: 2 }),
  currency: text("currency").default("BRL"),
  pipelineId: integer("pipeline_id"),
  pipelineName: text("pipeline_name"),
  stageId: integer("stage_id"),
  stageName: text("stage_name"),
  stageOrder: integer("stage_order"),
  status: text("status").default("open"), // open | won | lost
  expectedCloseDate: date("expected_close_date"),
  wonTime: timestamp("won_time"),
  // ── anotações locais (não vêm do Pipedrive e sobrevivem à sincronização)
  isRecurring: boolean("is_recurring").notNull().default(false),
  monthlyValue: numeric("monthly_value", { precision: 14, scale: 2 }),
  contractMonths: integer("contract_months"),
  lastActivityAt: timestamp("last_activity_at"),
  nextActivityAt: timestamp("next_activity_at"),
  nextActivitySubject: text("next_activity_subject"),
  addTime: timestamp("add_time"),
  updateTime: timestamp("update_time"),
  notes: text("notes"),
  raw: jsonb("raw"),
  syncedAt: timestamp("synced_at"),
});

export const activities = pgTable("activities", {
  id: serial("id").primaryKey(),
  pipedriveId: integer("pipedrive_id").unique(),
  dealId: integer("deal_id").references(() => pipelineDeals.id, {
    onDelete: "cascade",
  }),
  dealPipedriveId: integer("deal_pipedrive_id"),
  orgPipedriveId: integer("org_pipedrive_id"),
  subject: text("subject").notNull(),
  type: text("type"),
  note: text("note"),
  ownerName: text("owner_name"),
  dueAt: timestamp("due_at"),
  /** a atividade tem horário marcado (senão é "no dia", sem hora) */
  hasTime: boolean("has_time").notNull().default(false),
  done: boolean("done").notNull().default(false),
  syncedAt: timestamp("synced_at"),
});

/** Espelho das organizações do Pipedrive — base da lista de clientes. */
export const pdOrganizations = pgTable("pd_organizations", {
  id: serial("id").primaryKey(),
  pipedriveId: integer("pipedrive_id").notNull().unique(),
  name: text("name").notNull(),
  ownerName: text("owner_name"),
  syncedAt: timestamp("synced_at"),
});

export const pdPersons = pgTable("pd_persons", {
  id: serial("id").primaryKey(),
  pipedriveId: integer("pipedrive_id").notNull().unique(),
  name: text("name").notNull(),
  orgPipedriveId: integer("org_pipedrive_id"),
  email: text("email"),
  phone: text("phone"),
  syncedAt: timestamp("synced_at"),
});

export const integrations = pgTable("integrations", {
  id: serial("id").primaryKey(),
  provider: text("provider").notNull().unique(), // "pipedrive"
  status: text("status").notNull().default("disconnected"),
  lastSyncAt: timestamp("last_sync_at"),
  meta: jsonb("meta"),
});

// ─── Relations ────────────────────────────────────────────────────────────

export const companiesRelations = relations(companies, ({ many }) => ({
  deliverables: many(deliverables),
  tasks: many(tasks),
  items: many(deliverableItems),
  goals: many(goals),
}));

export const deliverablesRelations = relations(
  deliverables,
  ({ one, many }) => ({
    company: one(companies, {
      fields: [deliverables.companyId],
      references: [companies.id],
    }),
    category: one(categories, {
      fields: [deliverables.categoryId],
      references: [categories.id],
    }),
    items: many(deliverableItems),
  })
);

export const deliverableItemsRelations = relations(
  deliverableItems,
  ({ one }) => ({
    company: one(companies, {
      fields: [deliverableItems.companyId],
      references: [companies.id],
    }),
    deliverable: one(deliverables, {
      fields: [deliverableItems.deliverableId],
      references: [deliverables.id],
    }),
  })
);

export const goalsRelations = relations(goals, ({ one }) => ({
  company: one(companies, {
    fields: [goals.companyId],
    references: [companies.id],
  }),
}));

export const tasksRelations = relations(tasks, ({ one }) => ({
  company: one(companies, {
    fields: [tasks.companyId],
    references: [companies.id],
  }),
}));

export const pipelineDealsRelations = relations(pipelineDeals, ({ many }) => ({
  activities: many(activities),
}));

export const activitiesRelations = relations(activities, ({ one }) => ({
  deal: one(pipelineDeals, {
    fields: [activities.dealId],
    references: [pipelineDeals.id],
  }),
}));

// ─── Types ────────────────────────────────────────────────────────────────

export type Company = typeof companies.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Deliverable = typeof deliverables.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type PipelineDeal = typeof pipelineDeals.$inferSelect;
export type DeliverableItem = typeof deliverableItems.$inferSelect;
export type Goal = typeof goals.$inferSelect;
export type Activity = typeof activities.$inferSelect;
export type PdOrganization = typeof pdOrganizations.$inferSelect;
export type PdPerson = typeof pdPersons.$inferSelect;
export type DeliverableStatus = Deliverable["status"];
export type TaskStatus = Task["status"];
export type TaskPriority = Task["priority"];
