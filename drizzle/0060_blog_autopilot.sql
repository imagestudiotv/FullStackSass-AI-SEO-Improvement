CREATE TABLE "blog_autopilot" (
	"key" text PRIMARY KEY DEFAULT 'blog' NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"run_hour" integer DEFAULT 6 NOT NULL,
	"languages" jsonb DEFAULT '["es","fr","it","de"]'::jsonb NOT NULL,
	"updated_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "blog_autopilot" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "blog_autopilot_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_date" date NOT NULL,
	"trigger" text NOT NULL,
	"topic_id" uuid,
	"status" text DEFAULT 'running' NOT NULL,
	"post_id" uuid,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error" text,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"finished_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "blog_autopilot_runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "blog_autopilot_topics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"topic" text NOT NULL,
	"keyword" text,
	"notes" text,
	"source" text DEFAULT 'admin' NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"post_id" uuid,
	"error" text,
	"created_by" text,
	"written_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "blog_autopilot_topics" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "blog_autopilot_runs" ADD CONSTRAINT "blog_autopilot_runs_topic_id_blog_autopilot_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."blog_autopilot_topics"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_autopilot_runs" ADD CONSTRAINT "blog_autopilot_runs_post_id_blog_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."blog_posts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_autopilot_topics" ADD CONSTRAINT "blog_autopilot_topics_post_id_blog_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."blog_posts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "blog_autopilot_runs_scheduled_day_uidx" ON "blog_autopilot_runs" USING btree ("run_date") WHERE "blog_autopilot_runs"."trigger" = 'schedule';--> statement-breakpoint
CREATE INDEX "blog_autopilot_runs_started_idx" ON "blog_autopilot_runs" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "blog_autopilot_topics_status_order_idx" ON "blog_autopilot_topics" USING btree ("status","sort_order");