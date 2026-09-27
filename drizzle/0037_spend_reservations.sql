CREATE TABLE "operation_leases" (
	"key" text PRIMARY KEY NOT NULL,
	"holder" uuid NOT NULL,
	"expires_at" timestamp NOT NULL,
	"acquired_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "spend_reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"operation" text NOT NULL,
	"organization_id" text,
	"website_id" uuid,
	"state" text DEFAULT 'reserved' NOT NULL,
	"limit_value" integer NOT NULL,
	"window_seconds" integer,
	"window_since" timestamp,
	"counted_at" timestamp DEFAULT now() NOT NULL,
	"spend_outcome" text,
	"consumed_at" timestamp,
	"released_at" timestamp,
	"release_reason" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "spend_reservations_key_counted_idx" ON "spend_reservations" USING btree ("key","counted_at");--> statement-breakpoint
CREATE INDEX "spend_reservations_state_created_idx" ON "spend_reservations" USING btree ("state","created_at");--> statement-breakpoint
-- Row Level Security, like every other table (see 0026_enable_rls.sql).
ALTER TABLE "spend_reservations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "operation_leases" ENABLE ROW LEVEL SECURITY;
