-- better-auth 1.7.3+ went back to the 1.6 account schema and no longer writes
-- account.issuer. Databases created on 1.7.0-1.7.2 (this one: 0000) have it
-- NOT NULL, so without this every new account - email sign-up and Google
-- sign-in - would fail. better-auth's 1.7 upgrade guide ("Account identity
-- keeps the provider key"): dropping NOT NULL is enough and reversible. The
-- guide's account_issuer_accountId_uidx index was never created here.
-- Safe to apply before the code: 1.7.2 still writes the column.
ALTER TABLE "account" ALTER COLUMN "issuer" DROP NOT NULL;
