CREATE TABLE "deliverable_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"deliverable_id" integer,
	"month_ref" text NOT NULL,
	"url" text NOT NULL,
	"platform" text NOT NULL,
	"format" text,
	"title" text,
	"published_at" date,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "goals" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"title" text NOT NULL,
	"platform" text NOT NULL,
	"format" text,
	"target_qty" integer NOT NULL,
	"period" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pd_organizations" (
	"id" serial PRIMARY KEY NOT NULL,
	"pipedrive_id" integer NOT NULL,
	"name" text NOT NULL,
	"owner_name" text,
	"synced_at" timestamp,
	CONSTRAINT "pd_organizations_pipedrive_id_unique" UNIQUE("pipedrive_id")
);
--> statement-breakpoint
CREATE TABLE "pd_persons" (
	"id" serial PRIMARY KEY NOT NULL,
	"pipedrive_id" integer NOT NULL,
	"name" text NOT NULL,
	"org_pipedrive_id" integer,
	"email" text,
	"phone" text,
	"synced_at" timestamp,
	CONSTRAINT "pd_persons_pipedrive_id_unique" UNIQUE("pipedrive_id")
);
--> statement-breakpoint
ALTER TABLE "activities" ADD COLUMN "org_pipedrive_id" integer;--> statement-breakpoint
ALTER TABLE "activities" ADD COLUMN "note" text;--> statement-breakpoint
ALTER TABLE "activities" ADD COLUMN "has_time" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "deliverables" ADD COLUMN "platform" text;--> statement-breakpoint
ALTER TABLE "deliverable_items" ADD CONSTRAINT "deliverable_items_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliverable_items" ADD CONSTRAINT "deliverable_items_deliverable_id_deliverables_id_fk" FOREIGN KEY ("deliverable_id") REFERENCES "public"."deliverables"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;