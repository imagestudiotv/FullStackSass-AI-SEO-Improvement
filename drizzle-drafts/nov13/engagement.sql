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
