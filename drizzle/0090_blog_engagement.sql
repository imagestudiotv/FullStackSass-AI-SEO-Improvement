-- Blog engagement (client, 2026-11-11): customer stories on the homepage and in Earn Credits,
-- comments and upvotes on blog posts (lib/blog/engagement.ts). Additive: five nullable columns
-- on blog_posts, three new tables, and the "Customer stories" category - added only when no
-- category with that name or address exists yet, so one made by hand in Admin -> Blog is kept.
ALTER TABLE "blog_posts" ADD COLUMN "business_logo_url" text;--> statement-breakpoint
ALTER TABLE "blog_posts" ADD COLUMN "business_name" text;--> statement-breakpoint
ALTER TABLE "blog_posts" ADD COLUMN "business_category" text;--> statement-breakpoint
ALTER TABLE "blog_posts" ADD COLUMN "business_website_url" text;--> statement-breakpoint
ALTER TABLE "blog_posts" ADD COLUMN "business_tagline" text;--> statement-breakpoint
CREATE TABLE "blog_post_upvotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "blog_post_upvotes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "blog_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"body" text NOT NULL,
	"removed_at" timestamp,
	"removed_by" text,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "blog_comments_body_length_check" CHECK (char_length("blog_comments"."body") between 1 and 750)
);
--> statement-breakpoint
ALTER TABLE "blog_comments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "blog_comment_upvotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"comment_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "blog_comment_upvotes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "blog_post_upvotes" ADD CONSTRAINT "blog_post_upvotes_post_id_blog_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."blog_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_post_upvotes" ADD CONSTRAINT "blog_post_upvotes_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_comments" ADD CONSTRAINT "blog_comments_post_id_blog_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."blog_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_comments" ADD CONSTRAINT "blog_comments_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_comment_upvotes" ADD CONSTRAINT "blog_comment_upvotes_comment_id_blog_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."blog_comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_comment_upvotes" ADD CONSTRAINT "blog_comment_upvotes_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "blog_post_upvotes_post_user_uidx" ON "blog_post_upvotes" USING btree ("post_id","user_id");--> statement-breakpoint
CREATE INDEX "blog_post_upvotes_user_idx" ON "blog_post_upvotes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "blog_comments_post_created_idx" ON "blog_comments" USING btree ("post_id","created_at");--> statement-breakpoint
CREATE INDEX "blog_comments_user_created_idx" ON "blog_comments" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "blog_comments_created_idx" ON "blog_comments" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "blog_comment_upvotes_comment_user_uidx" ON "blog_comment_upvotes" USING btree ("comment_id","user_id");--> statement-breakpoint
CREATE INDEX "blog_comment_upvotes_user_idx" ON "blog_comment_upvotes" USING btree ("user_id");--> statement-breakpoint
INSERT INTO "blog_categories" ("name", "slug", "blurb", "translations", "sort_order")
SELECT
	'Customer stories',
	'customer-stories',
	'Discover real websites and follow their progress with RepGet.',
	'{"es":{"name":"Casos de clientes","blurb":"Descubra sitios web reales y siga su progreso con RepGet."},"fr":{"name":"Histoires de clients","blurb":"Découvrez de vrais sites web et suivez leurs progrès avec RepGet."},"it":{"name":"Storie dei clienti","blurb":"Scopra siti web reali e segua i loro progressi con RepGet."},"de":{"name":"Kundengeschichten","blurb":"Entdecken Sie echte Websites und verfolgen Sie ihre Fortschritte mit RepGet."}}'::jsonb,
	COALESCE((SELECT max("sort_order") + 1 FROM "blog_categories"), 0)
WHERE NOT EXISTS (
	SELECT 1 FROM "blog_categories" WHERE "slug" = 'customer-stories' OR lower("name") = 'customer stories'
);
