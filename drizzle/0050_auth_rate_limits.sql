-- Shared authentication limits. Apply before deploying the new auth code.
-- No customer rows or existing tables change. Keys are SHA-256 digests.
CREATE TABLE "auth_rate_limits" (
  "key" text PRIMARY KEY,
  "count" integer NOT NULL CHECK ("count" > 0),
  "last_request" bigint NOT NULL
);
--> statement-breakpoint
CREATE INDEX "auth_rate_limits_expiry_idx" ON "auth_rate_limits" ("last_request");
--> statement-breakpoint
ALTER TABLE "auth_rate_limits" ENABLE ROW LEVEL SECURITY;
