-- The partner program's database-level guarantees, beyond 0063's tables and
-- unique indexes. See docs/partner-program.md.
--
-- 1. THE LEDGER IS APPEND-ONLY. partner_ledger_entries is the financial
--    record of what RepGet owes each partner. Corrections are new entries
--    (lib/partners); an UPDATE, DELETE or TRUNCATE is refused by the
--    database itself, whichever code path - or person - attempts it.
--
-- 2. VERSION 1 OF THE PROGRAM POLICY, the defaults this release ships with
--    (lib/partners/domain/policies/program.ts DEFAULT_PROGRAM_POLICY):
--    Base 25%, Growth 30% from 10 qualifying customers, Premier 35% from 25;
--    90-day attribution and coupon windows; 12 months of commission; Net 30;
--    an automatic payout threshold of EUR 25.00 and none for other currencies.
--
-- Nothing here enables the program: the platform_controls rows
-- partner_program, partner_commissions and partner_payouts are absent, which
-- means disabled, until an administrator switches them on.

CREATE FUNCTION partner_ledger_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'partner_ledger_entries is append-only: % is not allowed', TG_OP
    USING ERRCODE = 'P0001';
END
$$ LANGUAGE plpgsql;
--> statement-breakpoint
REVOKE ALL ON FUNCTION partner_ledger_immutable() FROM PUBLIC;
--> statement-breakpoint
CREATE TRIGGER "partner_ledger_entries_no_update"
  BEFORE UPDATE OR DELETE ON "partner_ledger_entries"
  FOR EACH ROW EXECUTE FUNCTION partner_ledger_immutable();
--> statement-breakpoint
CREATE TRIGGER "partner_ledger_entries_no_truncate"
  BEFORE TRUNCATE ON "partner_ledger_entries"
  FOR EACH STATEMENT EXECUTE FUNCTION partner_ledger_immutable();
--> statement-breakpoint
INSERT INTO "partner_program_versions" ("version", "policy", "effective_from", "created_by")
VALUES (
  1,
  '{"version":1,"tiers":[{"key":"base","name":"Base Partner","rateBasisPoints":2500,"minCustomers":0},{"key":"growth","name":"Growth Partner","rateBasisPoints":3000,"minCustomers":10},{"key":"premier","name":"Premier Partner","rateBasisPoints":3500,"minCustomers":25}],"attributionWindowDays":90,"couponAttributionDays":90,"eligibilityMonths":12,"maturityDays":30,"payoutThresholds":{"eur":"2500"}}'::jsonb,
  '2026-01-01 00:00:00',
  'migration:0064'
)
ON CONFLICT ("version") DO NOTHING;
