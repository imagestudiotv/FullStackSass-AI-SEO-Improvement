CREATE TABLE "site_banner" (
	"key" text PRIMARY KEY DEFAULT 'top' NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"copy" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ends_at" timestamp,
	"tone" text DEFAULT 'orange' NOT NULL,
	"updated_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "site_banner" ENABLE ROW LEVEL SECURITY;