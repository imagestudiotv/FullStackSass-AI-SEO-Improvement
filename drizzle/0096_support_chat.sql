CREATE TABLE "support_chat_state" (
	"user_id" text PRIMARY KEY NOT NULL,
	"organization_id" text,
	"welcomed_at" timestamp,
	"welcome_opened_at" timestamp,
	"welcome_dismissed_at" timestamp,
	"welcome_answered_at" timestamp,
	"onboarding_completed_at" timestamp,
	"first_message_at" timestamp,
	"last_message_at" timestamp,
	"support_requests" integer DEFAULT 0 NOT NULL,
	"last_request_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "support_chat_state_requests_check" CHECK ("support_chat_state"."support_requests" >= 0)
);
--> statement-breakpoint
ALTER TABLE "support_chat_state" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "support_chat_state" ADD CONSTRAINT "support_chat_state_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_chat_state" ADD CONSTRAINT "support_chat_state_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "support_chat_state_welcomed_idx" ON "support_chat_state" USING btree ("welcomed_at");