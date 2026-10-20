CREATE TABLE "article_translation_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"article_id" uuid NOT NULL,
	"language" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"last_tried_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "article_translation_attempts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "translation_of" uuid;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "language_code" text;--> statement-breakpoint
ALTER TABLE "websites" ADD COLUMN "extra_languages" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "websites" ADD COLUMN "extra_languages_since" timestamp;--> statement-breakpoint
ALTER TABLE "article_translation_attempts" ADD CONSTRAINT "article_translation_attempts_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "article_translation_attempts_uidx" ON "article_translation_attempts" USING btree ("article_id","language");--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_translation_of_articles_id_fk" FOREIGN KEY ("translation_of") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "articles_translation_uidx" ON "articles" USING btree ("translation_of","language_code") WHERE "articles"."translation_of" is not null;