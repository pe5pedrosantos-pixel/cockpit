ALTER TABLE "activities" ADD COLUMN "deal_pipedrive_id" integer;--> statement-breakpoint
ALTER TABLE "activities" ADD COLUMN "owner_name" text;--> statement-breakpoint
ALTER TABLE "pipeline_deals" ADD COLUMN "org_id" integer;--> statement-breakpoint
ALTER TABLE "pipeline_deals" ADD COLUMN "person_id" integer;--> statement-breakpoint
ALTER TABLE "pipeline_deals" ADD COLUMN "owner_id" integer;--> statement-breakpoint
ALTER TABLE "pipeline_deals" ADD COLUMN "pipeline_id" integer;--> statement-breakpoint
ALTER TABLE "pipeline_deals" ADD COLUMN "stage_id" integer;--> statement-breakpoint
ALTER TABLE "pipeline_deals" ADD COLUMN "next_activity_subject" text;--> statement-breakpoint
ALTER TABLE "pipeline_deals" ADD COLUMN "add_time" timestamp;--> statement-breakpoint
ALTER TABLE "pipeline_deals" ADD COLUMN "update_time" timestamp;