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
  uniqueIndex,
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
  /** link da publicação; pode faltar (post registrado sem link) */
  url: text("url"),
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

// ─── Funil próprio (Pedro Santos: palestras e consultorias) ────────────────
// Não passa pelo Pipedrive da SOBE: é o CRM pessoal, alimentado pelo site.

export const leads = pgTable("leads", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  organization: text("organization"),
  role: text("role"),
  /** palestra | consultoria | mentoria | outro */
  interest: text("interest"),
  message: text("message"),
  /** novo | contato | briefing | proposta | negociacao | fechado | perdido */
  stage: text("stage").notNull().default("novo"),
  value: numeric("value", { precision: 14, scale: 2 }),
  /** data do evento/palestra, quando houver */
  eventDate: date("event_date"),
  nextStep: text("next_step"),
  nextStepDate: date("next_step_date"),
  lostReason: text("lost_reason"),
  /** site | manual | indicacao | linkedin | instagram | evento */
  source: text("source").notNull().default("manual"),
  utmSource: text("utm_source"),
  utmCampaign: text("utm_campaign"),
  pageUrl: text("page_url"),
  /** já foi aberto no cockpit? (lead novo do site fica destacado até ser visto) */
  seen: boolean("seen").notNull().default(false),
  stageChangedAt: timestamp("stage_changed_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const leadNotes = pgTable("lead_notes", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id")
    .notNull()
    .references(() => leads.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
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

export const leadsRelations = relations(leads, ({ many }) => ({
  notes: many(leadNotes),
}));

export const leadNotesRelations = relations(leadNotes, ({ one }) => ({
  lead: one(leads, { fields: [leadNotes.leadId], references: [leads.id] }),
}));

/**
 * ERP pessoal: entradas (e, depois, saídas) de dinheiro na PJ e na PF.
 * Cada linha é um valor esperado num mês, com o controle da nota fiscal
 * e do recebimento.
 */
export const financeEntries = pgTable("finance_entries", {
  id: serial("id").primaryKey(),
  direction: text("direction").notNull().default("entrada"), // entrada | saida
  entity: text("entity").notNull().default("pj"), // pj | pf
  payer: text("payer").notNull(), // quem paga (Sobe, Orka Eng, ...)
  kind: text("kind").notNull().default("salario"), // salario | comissao | luvas | outro
  description: text("description"),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  monthRef: text("month_ref").notNull(),
  nfStatus: text("nf_status").notNull().default("pendente"), // pendente | emitida | nao_aplica
  nfNumber: text("nf_number"),
  nfIssuedAt: date("nf_issued_at"),
  received: boolean("received").notNull().default(false),
  receivedAt: date("received_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Social media da marca Pedro Santos ───────────────────────────────────
// Espelho da Central de Social Media. O Pedro cria e aprova aqui; o agente
// do Claude lê e grava pelo conector MCP (/api/mcp/<segredo>).

/** Linhas editoriais (vendas-mkt, relacionamento, livro...). */
export const smLines = pgTable("sm_lines", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  color: text("color").notNull().default("#3D5A99"),
  position: integer("position").notNull().default(0),
  active: boolean("active").notNull().default(true),
  /** "3 posts por semana" */
  frequency: text("frequency"),
  objective: text("objective"),
  /** o que entra nesta linha */
  scope: text("scope"),
  formats: jsonb("formats").$type<string[]>().notNull().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/**
 * Um post do calendário: a peça do dia (ou uma extra), com as legendas de
 * cada rede, a arte e o estado da aprovação.
 * status: planejado | producao | aguardando_ok | ajuste | aprovado |
 *         agendado | publicado | cancelado
 */
export const smPosts = pgTable("sm_posts", {
  id: serial("id").primaryKey(),
  date: date("date").notNull(),
  /** peça além da principal do dia (vídeo esporádico, por exemplo) */
  extra: boolean("extra").notNull().default(false),
  lineSlug: text("line_slug"),
  title: text("title").notNull(),
  format: text("format"),
  /** branco | laranja | azul-marinho | video — nunca igual ao post anterior */
  background: text("background"),
  status: text("status").notNull().default("planejado"),
  networks: jsonb("networks").$type<string[]>().notNull().default(["linkedin", "instagram"]),
  timeLinkedin: text("time_linkedin").default("17:30"),
  timeInstagram: text("time_instagram").default("19:00"),
  captionLinkedin: text("caption_linkedin"),
  captionInstagram: text("caption_instagram"),
  firstCommentLinkedin: text("first_comment_linkedin"),
  firstCommentInstagram: text("first_comment_instagram"),
  /** link da arte no Canva (ou do vídeo) */
  artUrl: text("art_url"),
  /** imagem pública para prévia (PNG/JPG exportado) */
  previewUrl: text("preview_url"),
  sourceName: text("source_name"),
  sourceUrl: text("source_url"),
  notes: text("notes"),
  /** o que falta para a peça sair (escrito pelo agente) */
  pending: text("pending"),
  /** pedido de ajuste do Pedro */
  adjustRequest: text("adjust_request"),
  approvedAt: timestamp("approved_at"),
  metricoolIdLinkedin: text("metricool_id_linkedin"),
  metricoolIdInstagram: text("metricool_id_instagram"),
  urlLinkedin: text("url_linkedin"),
  urlInstagram: text("url_instagram"),
  /** id de origem (ex.: "2026-11-09" na Central) para importar sem duplicar */
  externalKey: text("external_key").unique(),
  /** quem mexeu por último: pedro | claude | ia */
  updatedBy: text("updated_by").notNull().default("pedro"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type SmLogEntry = { at: string; by: string; text: string };

/**
 * Solicitações nos dois sentidos.
 * direction: para_claude (o Pedro pede; o agente executa) | para_pedro
 * target: claude | metricool | canva | higgsfield | instagram | linkedin | pedro
 * status: aberta | em_andamento | concluida | cancelada
 */
export const smRequests = pgTable("sm_requests", {
  id: serial("id").primaryKey(),
  direction: text("direction").notNull().default("para_claude"),
  target: text("target").notNull().default("claude"),
  kind: text("kind").notNull().default("outro"),
  title: text("title").notNull(),
  details: text("details"),
  postId: integer("post_id").references(() => smPosts.id, { onDelete: "set null" }),
  status: text("status").notNull().default("aberta"),
  priority: text("priority").notNull().default("normal"),
  dueDate: date("due_date"),
  result: text("result"),
  resultUrl: text("result_url"),
  log: jsonb("log").$type<SmLogEntry[]>().notNull().default([]),
  createdBy: text("created_by").notNull().default("pedro"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

/** Métricas por publicação, trazidas do Metricool pelo agente. */
export const smMetrics = pgTable(
  "sm_metrics",
  {
    id: serial("id").primaryKey(),
    network: text("network").notNull(), // instagram | linkedin
    url: text("url").notNull(),
    kind: text("kind"), // post | carrossel | reels | video | documento
    publishedAt: timestamp("published_at"),
    text: text("text"),
    likes: integer("likes"),
    comments: integer("comments"),
    saves: integer("saves"),
    shares: integer("shares"),
    reach: integer("reach"),
    impressions: integer("impressions"),
    clicks: integer("clicks"),
    videoViews: integer("video_views"),
    follows: integer("follows"),
    avgWatchSeconds: numeric("avg_watch_seconds", { precision: 10, scale: 2 }),
    totalWatchSeconds: numeric("total_watch_seconds", { precision: 14, scale: 2 }),
    /** taxa de visualização do reel, em % */
    viewRate: numeric("view_rate", { precision: 6, scale: 2 }),
    postId: integer("post_id").references(() => smPosts.id, { onDelete: "set null" }),
    syncedAt: timestamp("synced_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("sm_metrics_network_url_idx").on(t.network, t.url)]
);

export type SmPoint = { titulo: string; detalhe: string; acao?: string };

/** Leituras do desempenho com pontos de melhoria. */
export const smAnalyses = pgTable("sm_analyses", {
  id: serial("id").primaryKey(),
  period: text("period"),
  summary: text("summary").notNull(),
  points: jsonb("points").$type<SmPoint[]>().notNull().default([]),
  /** claude (agente) | ia (Claude dentro do cockpit) */
  source: text("source").notNull().default("claude"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/** Banco de ideias por linha. status: nova | aprovada | usada | descartada */
export const smIdeas = pgTable("sm_ideas", {
  id: serial("id").primaryKey(),
  lineSlug: text("line_slug"),
  title: text("title").notNull(),
  hook: text("hook"),
  format: text("format"),
  details: text("details"),
  status: text("status").notNull().default("nova"),
  source: text("source").notNull().default("claude"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/** Histórico das rotinas do agente (semanal, mensal, agendamentos). */
export const smRuns = pgTable("sm_runs", {
  id: serial("id").primaryKey(),
  routine: text("routine").notNull(),
  result: text("result").notNull().default("ok"), // ok | parcial | falha
  summary: text("summary").notNull(),
  details: text("details"),
  ranAt: timestamp("ran_at").defaultNow().notNull(),
});

/** Configurações (grade semanal, horários, links). */
export const smSettings = pgTable("sm_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

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
export type Lead = typeof leads.$inferSelect;
export type LeadNote = typeof leadNotes.$inferSelect;
export type FinanceEntry = typeof financeEntries.$inferSelect;
export type SmLine = typeof smLines.$inferSelect;
export type SmPost = typeof smPosts.$inferSelect;
export type SmRequest = typeof smRequests.$inferSelect;
export type SmMetric = typeof smMetrics.$inferSelect;
export type SmAnalysis = typeof smAnalyses.$inferSelect;
export type SmIdea = typeof smIdeas.$inferSelect;
export type SmRun = typeof smRuns.$inferSelect;
