-- The two-step article flow's stored revision (docs/two-step-articles.md): what
-- the RepGet team last approved, or what was on the website when the flow was
-- switched on. Customers read it, and every path sends it, while a newer working
-- copy waits for approval. Empty until the flow writes it; unused with it off.
-- Rollback: ALTER TABLE "articles" DROP COLUMN "approved_revision";
ALTER TABLE "articles" ADD COLUMN "approved_revision" jsonb;
