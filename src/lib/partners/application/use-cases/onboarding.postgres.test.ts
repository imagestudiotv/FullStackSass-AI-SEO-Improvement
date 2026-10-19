import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/inngest/client", () => ({ inngest: { send: vi.fn() } }));

import { jobOutbox, partnerProfiles, partnerStripeAccounts } from "@/lib/db/schema";
import type { Database } from "@/lib/db/types";
import { createPostgresTestDb, testPostgresUrl } from "@/test/postgres";
import { fakeConnect, partnerTestDeps, seedPartner, seedUser, setControl } from "@/test/partners";

import type { AdminContext } from "../contracts/commands";
import type { PartnerRecord } from "../ports/repositories";
import { startPayoutSetup } from "./manage-payout-account";
import { approveApplication, welcomeJobId } from "./review-application";
import { submitApplication } from "./submit-application";

/**
 * Part 2 on a REAL Postgres: two administrators (or one double click, or a
 * retry) approving the same application at once, and a partner clicking
 * "set up payouts" in four tabs at once. Exactly one profile, one welcome
 * email job, one connected-account row and one Stripe account.
 */

const available = Boolean(testPostgresUrl());
let env: Awaited<ReturnType<typeof createPostgresTestDb>>;
let dbs: Database[];
const admin: AdminContext = { kind: "admin", userId: "a", email: "admin@repget.test" };

beforeAll(async () => {
  if (!available) return;
  env = await createPostgresTestDb(4);
  dbs = env.dbs as unknown as Database[];
  await setControl(dbs[0], "partner_program", true);
}, 120_000);

afterAll(async () => {
  if (available) await env.dispose();
});

describe.skipIf(!available)("approval and payout setup under concurrency (real Postgres)", () => {
  it("four simultaneous approvals make one profile and one welcome job", async () => {
    const person = await seedUser(dbs[0]);
    const submitted = await submitApplication(partnerTestDeps(dbs[0]).deps, { kind: "applicant", userId: person.id, email: person.email, name: person.name }, {
      website: "https://partner.example",
      audience: "Agencies across Europe, about 2,000 readers",
      promotion: "Newsletter features and webinars",
      country: "IT",
    });
    if (!submitted.ok) throw new Error(submitted.reason);
    const results = await Promise.all(dbs.map((db) => approveApplication(partnerTestDeps(db).deps, admin, submitted.value.applicationId)));
    expect(results.every((r) => r.ok)).toBe(true);
    const ids = new Set(results.map((r) => (r.ok ? r.value.partner.id : null)));
    expect(ids.size).toBe(1);
    expect(results.filter((r) => r.ok && r.value.created)).toHaveLength(1);
    const [partnerId] = [...ids] as string[];
    expect(await dbs[0].select().from(partnerProfiles).where(eq(partnerProfiles.userId, person.id))).toHaveLength(1);
    expect(await dbs[0].select().from(jobOutbox).where(eq(jobOutbox.eventId, welcomeJobId(partnerId)))).toHaveLength(1);
  });

  it("four simultaneous payout setups reserve one account and reach one Stripe account", async () => {
    const seeded = await seedPartner(dbs[0]);
    const [row] = await dbs[0].select().from(partnerProfiles).where(eq(partnerProfiles.id, seeded.partnerId));
    const access = { context: { kind: "partner" as const, userId: seeded.userId, partnerId: seeded.partnerId }, partner: row as unknown as PartnerRecord };
    const connect = fakeConnect();
    const results = await Promise.all(dbs.map((db) => startPayoutSetup(partnerTestDeps(db, { connect: connect.gateway }).deps, access)));
    expect(results.every((r) => r.ok)).toBe(true);
    const accounts = await dbs[0].select().from(partnerStripeAccounts).where(eq(partnerStripeAccounts.partnerId, seeded.partnerId));
    expect(accounts).toHaveLength(1);
    const keys = new Set(connect.calls.filter((c) => c.method === "createConnectedAccount").map((c) => (c.args as { idempotencyKey: string }).idempotencyKey));
    expect(keys.size).toBe(1);
    expect(accounts[0].stripeAccountId).toMatch(/^acct_/);
  });
});
