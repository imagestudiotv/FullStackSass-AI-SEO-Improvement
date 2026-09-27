-- Cutover step: lift the article write freeze (docs/migration-cutover.md).
--
--   psql "$DIRECT_URL" --single-transaction -v ON_ERROR_STOP=1 -f scripts/cutover/unfreeze-article-writes.sql
--
-- REFUSES unless 0042's baseline trigger is installed on public.articles and
-- enabled for normal writes (see the check below): lifting the freeze without
-- it re-opens the window the freeze exists to close.

SET lock_timeout = '15s';

-- The baseline trigger counts only if it is the one 0042 installs, and it
-- fires for ordinary application writes: named articles_allowance_baseline,
-- on public.articles (not a same-named trigger elsewhere), calling
-- public.article_allowance_baseline(), AFTER INSERT FOR EACH ROW (tgtype
-- bits: 1 = row, 2 = before, 4 = insert), and enabled as 'O' (origin) or
-- 'A' (always). 'D' (disabled) and 'R' (replica only - skipped by normal
-- sessions) do not count. The same check is in unfreeze-article-writes.sql,
-- article-baseline-backfill.sql and the articleBaselineTriggerMissing report.
--
-- Run with --single-transaction: a refusal here aborts the whole file, so
-- the freeze below is never dropped.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    WHERE t.tgname = 'articles_allowance_baseline'
      AND t.tgrelid = to_regclass('public.articles')
      AND NOT t.tgisinternal
      AND t.tgfoid = to_regprocedure('public.article_allowance_baseline()')
      AND t.tgenabled IN ('O', 'A')
      AND (t.tgtype & 1) = 1
      AND (t.tgtype & 2) = 0
      AND (t.tgtype & 4) = 4
  ) THEN
    RAISE EXCEPTION 'articles_allowance_baseline is missing, disabled, replica-only or not the trigger 0042 installs: apply 0042 before lifting the freeze';
  END IF;
END
$$;

DROP TRIGGER IF EXISTS cutover_article_write_freeze ON articles;
DROP FUNCTION IF EXISTS cutover_block_article_writes();
