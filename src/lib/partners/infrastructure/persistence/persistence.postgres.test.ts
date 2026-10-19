import { randomUUID } from "node:crypto";

import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/inngest/client", () => ({ inngest: { send: vi.fn() } }));

import type { Database } from "@/lib/db/types";
import { createPostgresTestDb, testPostgresUrl } from "@/test/postgres";
import { seedPartner, seedUser } from "@/test/partners";

import { repositoriesFor } from "./unit-of-work";

/**
 * Part 1, on a REAL Postgres with independent connections (PGlite has one,
 * so it cannot race). Skipped unless TEST_POSTGRES_URL names a disposable
 * server. Concurrent writers that each believe they are first must still
 * produce exactly one profile, one attribution, one ledger entry.
 */

const available = Boolean(testPostgresUrl());
let env: Awaited<ReturnType<typeof createPostgresTestDb>>;
let dbs: Database[];

beforeAll(async () => {
  if (!available) return;
  env = await createPostgresTestDb(4);
  dbs = env.dbs as unknown as Database[];
}, 120_000);

afterAll(async () => {
  if (available) await env.dispose();
});

describe.skipIf(!available)("partner persistence under concurrency (real Postgres)", () => {
  it("replays every migration, including the ledger trigger", async () => {
    const [row] = await env.sql<{ n: number }[]>`
      select count(*)::int as n from pg_trigger where tgname like 'partner_ledger_entries_%'`;
    expect(row.n).toBe(2);
  });

  it("approval raced on four connections makes one profile", async () => {
    const owner = await seedUser(dbs[0]);
    const { applicationId } = await seedPartner(dbs[0]);
    const results = await Promise.all(
      dbs.map((db, index) =>
        db.transaction((tx) =>
          repositoriesFor(tx).partners.createOrGet({
            userId: owner.id,
            referralCode: `race${index}abcdef`.slice(0, 10),
            displayName: "Owner",
            contactEmail: owner.email,
            country: "IT",
            applicationId,
            approvedAt: new Date(),
            approvedByEmail: "admin@repget.test",
          }),
        ),
      ),
    );
    expect(results.filter((r) => r?.created)).toHaveLength(1);
    expect(new Set(results.map((r) => r?.partner.id)).size).toBe(1);
    const [count] = await env.sql<{ n: number }[]>`select count(*)::int as n from partner_profiles where user_id = ${owner.id}`;
    expect(count.n).toBe(1);
  });

  it("two partners racing for one customer organization: the first locks it", async () => {
    const partners = await Promise.all([seedPartner(dbs[0]), seedPartner(dbs[1]), seedPartner(dbs[2]), seedPartner(dbs[3])]);
    const organizationId = `org_${randomUUID()}`;
    const results = await Promise.all(
      dbs.map((db, index) =>
        db.transaction((tx) =>
          repositoriesFor(tx).attributions.createOrGet({
            organizationId,
            foundingUserId: "founder",
            partnerId: partners[index].partnerId,
            source: "link",
            clickId: null,
            couponId: null,
            status: "active",
            lockedAt: new Date(),
            ruleVersion: 1,
            reviewReason: null,
            fraudSignals: {},
          }),
        ),
      ),
    );
    const winners = results.filter((r) => r.created);
    expect(winners).toHaveLength(1);
    expect(new Set(results.map((r) => r.attribution.partnerId))).toEqual(new Set([winners[0].attribution.partnerId]));
  });

  it("the same ledger operation written concurrently is written once", async () => {
    const partner = await seedPartner(dbs[0]);
    const operationKey = `race:${randomUUID()}`;
    const results = await Promise.all(
      dbs.map((db) =>
        db.transaction((tx) =>
          repositoriesFor(tx).commissions.appendLedger({
            environment: "test",
            partnerId: partner.partnerId,
            currency: "eur",
            kind: "commission_earned",
            amount: BigInt(2475),
            operationKey,
            reason: "race",
            actor: "system",
          }),
        ),
      ),
    );
    expect(results.filter(Boolean)).toHaveLength(1);
    const sums = await repositoriesFor(dbs[0]).commissions.ledgerSum(partner.partnerId, "test", "eur");
    expect(sums.liability).toBe(BigInt(2475));
  });

  it("the ledger refuses edits from any connection", async () => {
    const error = await dbs[1].execute(sql`update partner_ledger_entries set amount = 0`).catch((e: unknown) => e);
    // Drizzle wraps the driver error; the trigger's message is its cause.
    expect(String((error as { cause?: { message?: string } }).cause?.message)).toMatch(/append-only/);
  });
});
