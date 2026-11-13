-- Social media da marca Pedro Santos. Idempotente: pode rodar pelo botão
-- "Preparar banco" da aba Social Media ou pelo npm run db:migrate.
CREATE TABLE IF NOT EXISTS "sm_analyses" (
	"id" serial PRIMARY KEY NOT NULL,
	"period" text,
	"summary" text NOT NULL,
	"points" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source" text DEFAULT 'claude' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sm_ideas" (
	"id" serial PRIMARY KEY NOT NULL,
	"line_slug" text,
	"title" text NOT NULL,
	"hook" text,
	"format" text,
	"details" text,
	"status" text DEFAULT 'nova' NOT NULL,
	"source" text DEFAULT 'claude' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sm_lines" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT '#3D5A99' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"frequency" text,
	"objective" text,
	"scope" text,
	"formats" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sm_lines_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sm_metrics" (
	"id" serial PRIMARY KEY NOT NULL,
	"network" text NOT NULL,
	"url" text NOT NULL,
	"kind" text,
	"published_at" timestamp,
	"text" text,
	"likes" integer,
	"comments" integer,
	"saves" integer,
	"shares" integer,
	"reach" integer,
	"impressions" integer,
	"clicks" integer,
	"video_views" integer,
	"follows" integer,
	"avg_watch_seconds" numeric(10, 2),
	"total_watch_seconds" numeric(14, 2),
	"view_rate" numeric(6, 2),
	"post_id" integer,
	"synced_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sm_posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"extra" boolean DEFAULT false NOT NULL,
	"line_slug" text,
	"title" text NOT NULL,
	"format" text,
	"background" text,
	"status" text DEFAULT 'planejado' NOT NULL,
	"networks" jsonb DEFAULT '["linkedin","instagram"]'::jsonb NOT NULL,
	"time_linkedin" text DEFAULT '17:30',
	"time_instagram" text DEFAULT '19:00',
	"caption_linkedin" text,
	"caption_instagram" text,
	"first_comment_linkedin" text,
	"first_comment_instagram" text,
	"art_url" text,
	"preview_url" text,
	"source_name" text,
	"source_url" text,
	"notes" text,
	"pending" text,
	"adjust_request" text,
	"approved_at" timestamp,
	"metricool_id_linkedin" text,
	"metricool_id_instagram" text,
	"url_linkedin" text,
	"url_instagram" text,
	"external_key" text,
	"updated_by" text DEFAULT 'pedro' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sm_posts_external_key_unique" UNIQUE("external_key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sm_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"direction" text DEFAULT 'para_claude' NOT NULL,
	"target" text DEFAULT 'claude' NOT NULL,
	"kind" text DEFAULT 'outro' NOT NULL,
	"title" text NOT NULL,
	"details" text,
	"post_id" integer,
	"status" text DEFAULT 'aberta' NOT NULL,
	"priority" text DEFAULT 'normal' NOT NULL,
	"due_date" date,
	"result" text,
	"result_url" text,
	"log" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_by" text DEFAULT 'pedro' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sm_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"routine" text NOT NULL,
	"result" text DEFAULT 'ok' NOT NULL,
	"summary" text NOT NULL,
	"details" text,
	"ran_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sm_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sm_metrics" ADD CONSTRAINT "sm_metrics_post_id_sm_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."sm_posts"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sm_requests" ADD CONSTRAINT "sm_requests_post_id_sm_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."sm_posts"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "sm_metrics_network_url_idx" ON "sm_metrics" USING btree ("network","url");