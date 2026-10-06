CREATE TABLE "finance_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"direction" text DEFAULT 'entrada' NOT NULL,
	"entity" text DEFAULT 'pj' NOT NULL,
	"payer" text NOT NULL,
	"kind" text DEFAULT 'salario' NOT NULL,
	"description" text,
	"amount" numeric(14, 2) NOT NULL,
	"month_ref" text NOT NULL,
	"nf_status" text DEFAULT 'pendente' NOT NULL,
	"nf_number" text,
	"nf_issued_at" date,
	"received" boolean DEFAULT false NOT NULL,
	"received_at" date,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
