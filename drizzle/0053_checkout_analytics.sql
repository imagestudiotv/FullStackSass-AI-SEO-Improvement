-- The payer's Google Analytics identity at checkout, kept only after they
-- accepted the cookie banner (lib/conversions/conversions.ts). A new, empty,
-- nullable column: no existing row changes.
ALTER TABLE "billing_checkouts" ADD COLUMN "analytics" jsonb;