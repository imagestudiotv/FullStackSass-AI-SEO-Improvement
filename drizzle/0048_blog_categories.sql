-- The blog's categories, managed in Admin -> Blog instead of three constants
-- in the code (client request, 2026-10-01). Additive: one new table, which a
-- build older than this migration ignores. It starts with the three
-- categories the blog has had, with the same names, addresses and
-- descriptions, so every existing post and category page stays as it is.

CREATE TABLE "blog_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"blurb" text DEFAULT '' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "blog_categories_name_uidx" ON "blog_categories" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "blog_categories_slug_uidx" ON "blog_categories" USING btree ("slug");--> statement-breakpoint
INSERT INTO "blog_categories" ("name", "slug", "blurb", "sort_order") VALUES
	('Guides', 'guides', 'Plain-English explanations of how search and AI assistants actually work.', 0),
	('Comparisons', 'comparisons', 'How the options differ, and which one fits the job you have.', 1),
	('Playbooks', 'playbooks', 'Step-by-step work you can do this week, in the order to do it.', 2)
ON CONFLICT DO NOTHING;
