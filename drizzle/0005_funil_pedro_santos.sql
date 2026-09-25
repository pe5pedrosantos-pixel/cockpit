CREATE TABLE "lead_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"lead_id" integer NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"organization" text,
	"role" text,
	"interest" text,
	"message" text,
	"stage" text DEFAULT 'novo' NOT NULL,
	"value" numeric(14, 2),
	"event_date" date,
	"next_step" text,
	"next_step_date" date,
	"lost_reason" text,
	"source" text DEFAULT 'manual' NOT NULL,
	"utm_source" text,
	"utm_campaign" text,
	"page_url" text,
	"seen" boolean DEFAULT false NOT NULL,
	"stage_changed_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lead_notes" ADD CONSTRAINT "lead_notes_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;