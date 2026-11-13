-- Nov 13 billing: credits bought for a quote (lib/credits/quote-topup.ts).
-- Additive only: one new table and one new, INACTIVE add-on row. Nothing existing changes.
-- Hand-written draft; the coordinator numbers and generates the final migration.
CREATE TABLE IF NOT EXISTS "credit_topups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text,
	"website_project_id" uuid,
	"quote_revision" text NOT NULL,
	"quote_credits" integer NOT NULL,
	"available_credits" integer NOT NULL,
	"credits" integer NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" text NOT NULL,
	"rate_cents" integer NOT NULL,
	"rate_credits" integer NOT NULL,
	"provider" text NOT NULL,
	"stripe_session_id" text,
	"status" text DEFAULT 'open' NOT NULL,
	"addon_purchase_id" uuid,
	"paid_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "credit_topups_amounts_check" CHECK ("credit_topups"."credits" > 0 and "credit_topups"."amount_cents" > 0 and "credit_topups"."rate_cents" > 0 and "credit_topups"."rate_credits" > 0),
	CONSTRAINT "credit_topups_provider_check" CHECK ("credit_topups"."provider" in ('stripe', 'paypal')),
	CONSTRAINT "credit_topups_status_check" CHECK ("credit_topups"."status" in ('open', 'paid', 'failed'))
);
--> statement-breakpoint
ALTER TABLE "credit_topups" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "credit_topups" ADD CONSTRAINT "credit_topups_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_topups" ADD CONSTRAINT "credit_topups_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_topups" ADD CONSTRAINT "credit_topups_website_project_id_website_projects_id_fk" FOREIGN KEY ("website_project_id") REFERENCES "public"."website_projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_topups" ADD CONSTRAINT "credit_topups_addon_purchase_id_addon_purchases_id_fk" FOREIGN KEY ("addon_purchase_id") REFERENCES "public"."addon_purchases"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "credit_topups_org_idx" ON "credit_topups" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "credit_topups_project_idx" ON "credit_topups" USING btree ("website_project_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "credit_topups_session_key" ON "credit_topups" USING btree ("stripe_session_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "credit_topups_purchase_key" ON "credit_topups" USING btree ("addon_purchase_id");--> statement-breakpoint
-- The add-on every quote top-up is recorded under (addon_purchases.addon_id is NOT NULL).
-- INACTIVE on purpose: Billing's pack list, stripe:setup, the partner credit rate and buyAddon all read
-- active add-ons only, so it is never sold as a pack, never given a Stripe price, and never sets a rate.
-- credits_granted 0: what a top-up grants is its credit_topups row's credits (lib/addons/fulfil.ts).
INSERT INTO "addons" ("slug", "name", "description", "price_cents", "currency", "credits_granted", "credit_price", "kind", "sort_order", "is_active") VALUES
	('credits_custom', 'Credits for a quote', 'Exactly the credits a quote needs, priced at the smallest credit pack''s rate.', 0, 'eur', 0, NULL, 'credits', 99, false)
ON CONFLICT ("slug") DO NOTHING;

--> statement-breakpoint
-- Nov 13 engagement (client, 2026-11-13): "Upvote and comments on blogs and companies should
-- reflect on all languages, without inserting for each language separately." An article and its
-- translations (blog_posts.translation_of) now share ONE discussion: one upvote per member, one
-- list of comments, the same counts on every language version, in the customer directory and in
-- Earn Credits (lib/blog/engagement.ts). A company profile is a customer-story post, so it follows.
--
-- DRAFT, hand-written (not drizzle-kit generate): the backfill, the deduplication and the trigger
-- are not in schema.ts. Safe to run twice: every step is IF NOT EXISTS / CREATE OR REPLACE or only
-- touches rows not yet migrated.
--
-- What it does to existing rows:
--  1. blog_posts.discussion_id = the original's id (translation_of), or the post's own id.
--  2. Every upvote and comment gets its post's discussion_id.
--  3. A member with upvotes on several versions of one article keeps their FIRST one (oldest
--     created_at, then id); each other one is COPIED to blog_post_upvote_duplicates (as it was,
--     with the kept upvote's id) and only then removed from blog_post_upvotes. Nothing is lost
--     silently: count(blog_post_upvotes) before = count after + count(duplicates).
--  4. Comments are never merged or deleted: each keeps its id, author, text, post_id (the
--     language it was written in), timestamps and moderation (removed_at/removed_by/deleted_at).
--     Comment upvotes are per comment, so none become duplicates.
-- No credits are written: Earn Credits' Discover bonus is a one-time ledger row per member
-- (idempotency key discover-bonus:<user>), counted again from these tables only at a claim.

-- 1. The discussion of each post.
ALTER TABLE "blog_posts" ADD COLUMN IF NOT EXISTS "discussion_id" uuid;--> statement-breakpoint
UPDATE "blog_posts" AS p
SET "discussion_id" = COALESCE(
	(SELECT COALESCE(o."translation_of", o."id") FROM "blog_posts" AS o WHERE o."id" = p."translation_of"),
	p."id"
)
WHERE p."discussion_id" IS NULL;--> statement-breakpoint
ALTER TABLE "blog_posts" ALTER COLUMN "discussion_id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "blog_posts" ALTER COLUMN "discussion_id" SET NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_posts_discussion_idx" ON "blog_posts" USING btree ("discussion_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "blog_posts_id_discussion_uidx" ON "blog_posts" USING btree ("id","discussion_id");--> statement-breakpoint

-- A new post's discussion is decided here, whoever inserts it (the editor, "Translate", the
-- autopilot, a script): a translation joins its original's, anything else starts its own. The
-- value the insert carried is ignored. After that it never changes, so deleting an original
-- (translation_of SET NULL on its translations) leaves the translations' discussion together.
CREATE OR REPLACE FUNCTION blog_post_discussion() RETURNS trigger AS $$
BEGIN
	IF TG_OP = 'UPDATE' THEN
		NEW."discussion_id" := OLD."discussion_id";
		RETURN NEW;
	END IF;
	NEW."discussion_id" := COALESCE(
		(SELECT o."discussion_id" FROM "blog_posts" AS o WHERE o."id" = NEW."translation_of"),
		NEW."id"
	);
	RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
REVOKE ALL ON FUNCTION blog_post_discussion() FROM PUBLIC;--> statement-breakpoint
DO $$
DECLARE api_role text;
BEGIN
	-- Trigger-only function: the Supabase API roles must not be able to call it (rls.postgres.test.ts, migration 0056).
	FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
		IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
			EXECUTE format('REVOKE ALL ON FUNCTION blog_post_discussion() FROM %I', api_role);
		END IF;
	END LOOP;
END $$;--> statement-breakpoint
DROP TRIGGER IF EXISTS "blog_posts_discussion" ON "blog_posts";--> statement-breakpoint
CREATE TRIGGER "blog_posts_discussion" BEFORE INSERT OR UPDATE OF "discussion_id" ON "blog_posts"
	FOR EACH ROW EXECUTE FUNCTION blog_post_discussion();--> statement-breakpoint

-- 2. Upvotes and comments name their discussion.
ALTER TABLE "blog_post_upvotes" ADD COLUMN IF NOT EXISTS "discussion_id" uuid;--> statement-breakpoint
UPDATE "blog_post_upvotes" AS v SET "discussion_id" = p."discussion_id"
FROM "blog_posts" AS p
WHERE p."id" = v."post_id" AND v."discussion_id" IS NULL;--> statement-breakpoint
ALTER TABLE "blog_comments" ADD COLUMN IF NOT EXISTS "discussion_id" uuid;--> statement-breakpoint
UPDATE "blog_comments" AS c SET "discussion_id" = p."discussion_id"
FROM "blog_posts" AS p
WHERE p."id" = c."post_id" AND c."discussion_id" IS NULL;--> statement-breakpoint

-- 3. One upvote per member and discussion; the others recorded, then removed.
CREATE TABLE IF NOT EXISTS "blog_post_upvote_duplicates" (
	"id" uuid PRIMARY KEY NOT NULL,
	"post_id" uuid NOT NULL,
	"discussion_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"kept_upvote_id" uuid NOT NULL,
	"reason" text DEFAULT 'same_discussion' NOT NULL,
	"recorded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "blog_post_upvote_duplicates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'blog_post_upvote_duplicates_post_id_blog_posts_id_fk') THEN
		ALTER TABLE "blog_post_upvote_duplicates" ADD CONSTRAINT "blog_post_upvote_duplicates_post_id_blog_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."blog_posts"("id") ON DELETE cascade ON UPDATE no action;
	END IF;
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'blog_post_upvote_duplicates_user_id_user_id_fk') THEN
		ALTER TABLE "blog_post_upvote_duplicates" ADD CONSTRAINT "blog_post_upvote_duplicates_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
	END IF;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_post_upvote_duplicates_discussion_user_idx" ON "blog_post_upvote_duplicates" USING btree ("discussion_id","user_id");--> statement-breakpoint
INSERT INTO "blog_post_upvote_duplicates" ("id", "post_id", "discussion_id", "user_id", "created_at", "kept_upvote_id", "reason")
SELECT ranked."id", ranked."post_id", ranked."discussion_id", ranked."user_id", ranked."created_at", ranked."kept", 'same_discussion'
FROM (
	SELECT v.*,
		row_number() OVER w AS "rank",
		first_value(v."id") OVER w AS "kept"
	FROM "blog_post_upvotes" AS v
	WINDOW w AS (PARTITION BY v."discussion_id", v."user_id" ORDER BY v."created_at", v."id")
) AS ranked
WHERE ranked."rank" > 1
ON CONFLICT ("id") DO NOTHING;--> statement-breakpoint
DELETE FROM "blog_post_upvotes" AS v
USING "blog_post_upvote_duplicates" AS d
WHERE d."id" = v."id";--> statement-breakpoint

-- 4. The new keys. (post_id, discussion_id) must be a real post's pair, so an upvote or comment
-- can never name another article's discussion; the old one-per-post index gives way to
-- one-per-discussion.
ALTER TABLE "blog_post_upvotes" ALTER COLUMN "discussion_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "blog_comments" ALTER COLUMN "discussion_id" SET NOT NULL;--> statement-breakpoint
DROP INDEX IF EXISTS "blog_post_upvotes_post_user_uidx";--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "blog_post_upvotes_discussion_user_uidx" ON "blog_post_upvotes" USING btree ("discussion_id","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_post_upvotes_post_idx" ON "blog_post_upvotes" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_comments_discussion_created_idx" ON "blog_comments" USING btree ("discussion_id","created_at");--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'blog_post_upvotes_post_discussion_fk') THEN
		ALTER TABLE "blog_post_upvotes" ADD CONSTRAINT "blog_post_upvotes_post_discussion_fk" FOREIGN KEY ("post_id","discussion_id") REFERENCES "public"."blog_posts"("id","discussion_id") ON DELETE cascade ON UPDATE no action;
	END IF;
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'blog_comments_post_discussion_fk') THEN
		ALTER TABLE "blog_comments" ADD CONSTRAINT "blog_comments_post_discussion_fk" FOREIGN KEY ("post_id","discussion_id") REFERENCES "public"."blog_posts"("id","discussion_id") ON DELETE cascade ON UPDATE no action;
	END IF;
END $$;

--> statement-breakpoint
-- Compatibility (coordinator, 2026-11-13): this migration runs BEFORE the new code is deployed, and must
-- survive a code rollback. The previous code inserts upvotes and comments without discussion_id (and with
-- onConflictDoNothing(), which honours the new unique index too). This fills it from the post, so those
-- inserts keep working; a value the new code sets is kept (the composite foreign key still checks it).
CREATE OR REPLACE FUNCTION blog_engagement_discussion() RETURNS trigger AS $$
BEGIN
	IF NEW."discussion_id" IS NULL THEN
		NEW."discussion_id" := (SELECT p."discussion_id" FROM "blog_posts" AS p WHERE p."id" = NEW."post_id");
	END IF;
	RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
REVOKE ALL ON FUNCTION blog_engagement_discussion() FROM PUBLIC;--> statement-breakpoint
DO $$
DECLARE api_role text;
BEGIN
	-- Trigger-only function: the Supabase API roles must not be able to call it (rls.postgres.test.ts, migration 0056).
	FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
		IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
			EXECUTE format('REVOKE ALL ON FUNCTION blog_engagement_discussion() FROM %I', api_role);
		END IF;
	END LOOP;
END $$;--> statement-breakpoint
DROP TRIGGER IF EXISTS "blog_post_upvotes_discussion" ON "blog_post_upvotes";--> statement-breakpoint
CREATE TRIGGER "blog_post_upvotes_discussion" BEFORE INSERT ON "blog_post_upvotes"
	FOR EACH ROW EXECUTE FUNCTION blog_engagement_discussion();--> statement-breakpoint
DROP TRIGGER IF EXISTS "blog_comments_discussion" ON "blog_comments";--> statement-breakpoint
CREATE TRIGGER "blog_comments_discussion" BEFORE INSERT ON "blog_comments"
	FOR EACH ROW EXECUTE FUNCTION blog_engagement_discussion();--> statement-breakpoint
-- Nov 13 ticket, area "ads": rewarded ads on Earn Credits (lib/earn/rewarded-ads.ts).
-- Hand-written draft. Additive and idempotent. The coordinator numbers it and
-- regenerates it with drizzle-kit; this file only has to match schema.ts.
CREATE TABLE IF NOT EXISTS "rewarded_ad_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"status" text DEFAULT 'started' NOT NULL,
	"reason" text,
	"reward_credits" integer NOT NULL,
	"day" date NOT NULL,
	"started_at" timestamp NOT NULL,
	"ended_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "rewarded_ad_views_reward_check" CHECK ("rewarded_ad_views"."reward_credits" > 0)
);
--> statement-breakpoint
ALTER TABLE "rewarded_ad_views" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "rewarded_ad_views" ADD CONSTRAINT "rewarded_ad_views_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "rewarded_ad_views" ADD CONSTRAINT "rewarded_ad_views_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "rewarded_ad_views_one_open_uidx" ON "rewarded_ad_views" USING btree ("user_id") WHERE "rewarded_ad_views"."status" = 'started';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rewarded_ad_views_user_day_idx" ON "rewarded_ad_views" USING btree ("user_id","day","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rewarded_ad_views_org_day_idx" ON "rewarded_ad_views" USING btree ("organization_id","day","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rewarded_ad_views_day_idx" ON "rewarded_ad_views" USING btree ("day","status");

