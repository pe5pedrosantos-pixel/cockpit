ALTER TABLE "pipeline_deals" ADD COLUMN "won_time" timestamp;--> statement-breakpoint
ALTER TABLE "pipeline_deals" ADD COLUMN "is_recurring" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "pipeline_deals" ADD COLUMN "monthly_value" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "pipeline_deals" ADD COLUMN "contract_months" integer;