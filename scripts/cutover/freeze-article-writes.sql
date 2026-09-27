-- Cutover step: FREEZE article inserts and deletes (docs/migration-cutover.md).
--
--   psql "$DIRECT_URL" --single-transaction -v ON_ERROR_STOP=1 -f scripts/cutover/freeze-article-writes.sql
--
-- WHY. Between the article baseline backfill (0041) and the trigger that keeps
-- it complete (0042), an article the old code inserts AND deletes is counted
-- by nobody - whether the migrations commit one by one (psql) or together
-- (drizzle-kit migrate: under READ COMMITTED, other sessions still commit
-- between its statements, and it takes no lock on articles until 0042's
-- CREATE TRIGGER). So article writes are stopped at the database for the
-- whole migration, whoever sends them: old server instances, old Inngest
-- workers, admin tools, and deletes cascading from a website or workspace.
--
-- HOW IT DRAINS. CREATE TRIGGER needs a SHARE ROW EXCLUSIVE lock on
-- articles, so it WAITS for every transaction that has already written to
-- articles to finish. Once this commits, every later INSERT or DELETE on
-- articles - including one inside a transaction that started earlier but
-- had not touched the table yet - fails with the error below. Reads are
-- never blocked.
--
-- lock_timeout keeps a long-running transaction from queueing every writer
-- behind this: if it times out, nothing changed; wait and run it again.

SET lock_timeout = '15s';

CREATE OR REPLACE FUNCTION cutover_block_article_writes() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'article writes are paused for a database migration; retry in a few minutes'
    USING ERRCODE = 'lock_not_available';
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS cutover_article_write_freeze ON articles;
CREATE TRIGGER cutover_article_write_freeze
  BEFORE INSERT OR DELETE ON articles
  FOR EACH ROW EXECUTE FUNCTION cutover_block_article_writes();

-- Evidence for the runbook: the freeze is on, and the write counters at the
-- moment it took effect.
SELECT 'freeze active' AS state,
       (SELECT count(*) FROM articles) AS articles,
       n_tup_ins AS inserted_total,
       n_tup_del AS deleted_total
FROM pg_stat_user_tables
WHERE relname = 'articles';
