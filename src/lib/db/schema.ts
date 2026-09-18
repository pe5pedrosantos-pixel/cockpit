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
  owner: text("owner"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
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
  subject: text("subject").notNull(),
  type: text("type"),
  ownerName: text("owner_name"),
  dueAt: timestamp("due_at"),
  done: boolean("done").notNull().default(false),
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
}));

export const deliverablesRelations = relations(deliverables, ({ one }) => ({
  company: one(companies, {
    fields: [deliverables.companyId],
    references: [companies.id],
  }),
  category: one(categories, {
    fields: [deliverables.categoryId],
    references: [categories.id],
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
export type DeliverableStatus = Deliverable["status"];
export type TaskStatus = Task["status"];
export type TaskPriority = Task["priority"];
