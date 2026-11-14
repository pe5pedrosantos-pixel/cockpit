-- Mídias dos posts (Vercel Blob). Idempotente: roda sozinho na primeira
-- abertura da aba Social Media depois do deploy, ou pelo npm run db:migrate.
CREATE TABLE IF NOT EXISTS "sm_media" (
	"id" serial PRIMARY KEY NOT NULL,
	"post_id" integer NOT NULL,
	"kind" text DEFAULT 'imagem' NOT NULL,
	"url" text NOT NULL,
	"pathname" text,
	"content_type" text,
	"size" integer,
	"position" integer DEFAULT 0 NOT NULL,
	"name" text,
	"source" text DEFAULT 'upload' NOT NULL,
	"original_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sm_media" ADD CONSTRAINT "sm_media_post_id_sm_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."sm_posts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sm_media_post_idx" ON "sm_media" USING btree ("post_id","position");