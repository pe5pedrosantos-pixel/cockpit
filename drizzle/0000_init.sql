CREATE TYPE "public"."deliverable_status" AS ENUM('PLANEJADO', 'EM_ANDAMENTO', 'CONCLUIDO', 'ATRASADO');--> statement-breakpoint
CREATE TYPE "public"."task_priority" AS ENUM('BAIXA', 'MEDIA', 'ALTA', 'URGENTE');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('A_FAZER', 'EM_ANDAMENTO', 'CONCLUIDA');--> statement-breakpoint
CREATE TABLE "activities" (
	"id" serial PRIMARY KEY NOT NULL,
	"pipedrive_id" integer,
	"deal_id" integer,
	"subject" text NOT NULL,
	"type" text,
	"due_at" timestamp,
	"done" boolean DEFAULT false NOT NULL,
	"synced_at" timestamp,
	CONSTRAINT "activities_pipedrive_id_unique" UNIQUE("pipedrive_id")
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"color" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "categories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"color" text DEFAULT '#6366f1' NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"has_deliverables" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "companies_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "deliverables" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"category_id" integer,
	"title" text NOT NULL,
	"description" text,
	"month_ref" text NOT NULL,
	"planned_qty" integer DEFAULT 1 NOT NULL,
	"delivered_qty" integer DEFAULT 0 NOT NULL,
	"deadline" date,
	"status" "deliverable_status" DEFAULT 'PLANEJADO' NOT NULL,
	"owner" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integrations" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"status" text DEFAULT 'disconnected' NOT NULL,
	"last_sync_at" timestamp,
	"meta" jsonb,
	CONSTRAINT "integrations_provider_unique" UNIQUE("provider")
);
--> statement-breakpoint
CREATE TABLE "pipeline_deals" (
	"id" serial PRIMARY KEY NOT NULL,
	"pipedrive_id" integer,
	"title" text NOT NULL,
	"org_name" text,
	"person_name" text,
	"owner_name" text,
	"value" numeric(14, 2),
	"currency" text DEFAULT 'BRL',
	"pipeline_name" text,
	"stage_name" text,
	"stage_order" integer,
	"status" text DEFAULT 'open',
	"expected_close_date" date,
	"last_activity_at" timestamp,
	"next_activity_at" timestamp,
	"notes" text,
	"raw" jsonb,
	"synced_at" timestamp,
	CONSTRAINT "pipeline_deals_pipedrive_id_unique" UNIQUE("pipedrive_id")
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"company_id" integer,
	"due_date" date,
	"priority" "task_priority" DEFAULT 'MEDIA' NOT NULL,
	"status" "task_status" DEFAULT 'A_FAZER' NOT NULL,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_deal_id_pipeline_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."pipeline_deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliverables" ADD CONSTRAINT "deliverables_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliverables" ADD CONSTRAINT "deliverables_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;