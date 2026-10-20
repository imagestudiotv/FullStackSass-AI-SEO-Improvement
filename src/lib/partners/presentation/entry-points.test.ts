import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import Stripe from "stripe";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { partnerSignupEligibility, partnerStripeAccounts, webhookEvents } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";
import { fakeConnect, partnerTestDeps, readiness, seedPartner, seedUser, seedWorkspace, setControl } from "@/test/partners";

/**
 * Part 2's entry points, end to end below the browser: the signup hook reads
 * the partner cookie and the signup method from Better Auth's context; /go
 * sets ONLY the partner cookie and redirects only to allowlisted pages; the
 * Connect webhook verifies signatures, stores events for recovery, and
 * ignores accounts that are not partners'.
 */

const state = vi.hoisted(() => ({ db: null as unknown, deps: null as unknown, signature: "" }));
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }),
  isDatabaseConfigured: () => true,
}));
vi.mock("@/lib/partners/server", () => ({
  partnerDeps: () => state.deps,
  partnerInfrastructure: () => state.deps,
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "stripe-signature": state.signature }) }));

import { GET as go } from "@/app/go/[code]/route";
import { POST as connectWebhook } from "@/app/api/stripe/connect-webhook/route";
import { capturePartnerSignup } from "./signup-hook";
import { PARTNER_COOKIE } from "./tracking-cookie";

let test: TestDb;
const SECRET = "whsec_test_partner_connect";
const stripe = new Stripe("sk_test_fake");

beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
  await setControl(test.db, "partner_program", true);
});

beforeEach(() => {
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_fake");
  vi.stubEnv("STRIPE_CONNECT_WEBHOOK_SECRET", SECRET);
});

async function openLink(code: string, query = "", cookie?: string) {
  const request = new NextRequest(`https://repget.test/go/${code}${query}`, { headers: cookie ? { cookie } : {} });
  return go(request, { params: Promise.resolve({ code }) } as never);
}

describe("/go/<code>", () => {
  it("sets only the partner cookie, httpOnly, and never the legacy referral cookie", async () => {
    const env = partnerTestDeps(test.db);
    state.deps = env.deps;
    const partner = await seedPartner(test.db);
    const response = await openLink(partner.code);
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://repget.test/");
    expect(response.headers.get("cache-control")).toBe("no-store");
    const cookie = response.cookies.get(PARTNER_COOKIE);
    expect(cookie?.value).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("lax");
    expect(response.cookies.get("ref")).toBeUndefined();
  });

  it("redirects only to allowlisted pages of this site", async () => {
    const env = partnerTestDeps(test.db);
    state.deps = env.deps;
    const partner = await seedPartner(test.db);
    expect((await openLink(partner.code, "?to=/pricing")).headers.get("location")).toBe("https://repget.test/pricing");
    expect((await openLink(partner.code, "?to=//evil.example")).headers.get("location")).toBe("https://repget.test/");
    expect((await openLink(partner.code, "?to=https://evil.example")).headers.get("location")).toBe("https://repget.test/");
    expect((await openLink(partner.code, "?to=/admin")).headers.get("location")).toBe("https://repget.test/");
  });

  it("still lands the visitor on the site for an unknown code or a failure", async () => {
    state.deps = { ...partnerTestDeps(test.db).deps, uow: null };
    const broken = await openLink("abcdefghjk");
    expect(broken.status).toBe(307);
    expect(broken.cookies.get(PARTNER_COOKIE)).toBeUndefined();
  });
});

describe("the signup hook", () => {
  it("reads the partner cookie and the method from Better Auth's context", async () => {
    const env = partnerTestDeps(test.db);
    state.deps = env.deps;
    const partner = await seedPartner(test.db);
    const token = (await openLink(partner.code)).cookies.get(PARTNER_COOKIE)!.value;
    const person = await seedUser(test.db, { createdAt: env.clock.now() });
    await seedWorkspace(test.db, person.id, { createdAt: env.clock.now() });
    await capturePartnerSignup(
      { id: person.id, email: person.email, createdAt: env.clock.now() },
      { path: "/callback/:id", headers: new Headers({ cookie: `other=1; ${PARTNER_COOKIE}=${token}`, "user-agent": "UA" }) },
    );
    const [row] = await test.db.select().from(partnerSignupEligibility).where(eq(partnerSignupEligibility.userId, person.id));
    expect(row).toMatchObject({ signupMethod: "google", eligible: true, linkOutcome: "attribute", candidatePartnerId: partner.partnerId });
  });

  it("never throws, whatever goes wrong", async () => {
    state.deps = { ...partnerTestDeps(test.db).deps, uow: null };
    await expect(capturePartnerSignup({ id: "u", email: "u@example.test" }, null)).resolves.toBeUndefined();
  });
});

describe("the Connect webhook", () => {
  function signed(event: Record<string, unknown>, secret = SECRET) {
    const payload = JSON.stringify(event);
    state.signature = stripe.webhooks.generateTestHeaderString({ payload, secret });
    return new Request("https://repget.test/api/stripe/connect-webhook", { method: "POST", body: payload });
  }

  it("refuses a bad signature", async () => {
    const response = await connectWebhook(signed({ id: "evt_x", object: "event", type: "account.updated" }, "whsec_wrong"));
    expect(response.status).toBe(400);
  });

  it("syncs a partner's account from Stripe, once per event id, and stores it for recovery", async () => {
    const connect = fakeConnect();
    const env = partnerTestDeps(test.db, { connect: connect.gateway });
    state.deps = env.deps;
    const partner = await seedPartner(test.db);
    const accountId = `acct_${randomUUID().slice(0, 12)}`;
    await test.db.insert(partnerStripeAccounts).values({
      partnerId: partner.partnerId,
      environment: "test",
      stripeAccountId: accountId,
      status: "onboarding",
      creationKey: `k-${randomUUID()}`,
    });
    connect.accounts.set(accountId, readiness(accountId, { status: "ready", detailsSubmitted: true, payoutsEnabled: true, transfersCapability: "active", requirementsCurrentlyDue: [], metadataPartnerId: partner.partnerId }));
    const eventId = `evt_${randomUUID()}`;
    const event = { id: eventId, object: "event", type: "account.updated", account: accountId, livemode: false, created: 1790000000, data: { object: { id: accountId, object: "account" } } };

    expect((await connectWebhook(signed(event))).status).toBe(200);
    expect(await (await connectWebhook(signed(event))).json()).toMatchObject({ duplicate: true });
    const [row] = await test.db.select().from(partnerStripeAccounts).where(eq(partnerStripeAccounts.stripeAccountId, accountId));
    expect(row.status).toBe("ready");
    const [stored] = await test.db.select().from(webhookEvents).where(eq(webhookEvents.id, eventId));
    expect(stored).toMatchObject({ provider: "stripe_connect", status: "completed" });
    expect(connect.calls.filter((c) => c.method === "retrieveAccount")).toHaveLength(1);
  });

  it("acknowledges events for accounts that are not partners' without changing anything", async () => {
    const connect = fakeConnect();
    state.deps = partnerTestDeps(test.db, { connect: connect.gateway }).deps;
    const response = await connectWebhook(
      signed({ id: `evt_${randomUUID()}`, object: "event", type: "account.updated", account: "acct_stranger", livemode: false, created: 1790000000, data: { object: { id: "acct_stranger" } } }),
    );
    expect(response.status).toBe(200);
    expect(connect.calls).toHaveLength(0);
    const platformEvent = await connectWebhook(signed({ id: `evt_${randomUUID()}`, object: "event", type: "invoice.paid", livemode: false, created: 1, data: { object: {} } }));
    expect(await platformEvent.json()).toMatchObject({ ignored: "no_account" });
  });

  it("stores no bank or contact details from the event", async () => {
    state.deps = partnerTestDeps(test.db, { connect: fakeConnect().gateway }).deps;
    const eventId = `evt_${randomUUID()}`;
    const bank = { id: "ba_1", object: "bank_account", account_holder_name: "Jane Partner", bank_name: "STRIPE TEST BANK", last4: "6789", routing_number: "110000000", fingerprint: "fp_secret" };
    const response = await connectWebhook(signed({ id: eventId, object: "event", type: "account.external_account.updated", account: "acct_stranger", livemode: false, created: 1790000000, data: { object: bank } }));
    expect(response.status).toBe(200);
    const [stored] = await test.db.select().from(webhookEvents).where(eq(webhookEvents.id, eventId));
    const text = JSON.stringify(stored.payload);
    for (const secret of ["Jane Partner", "STRIPE TEST BANK", "6789", "110000000", "fp_secret"]) expect(text).not.toContain(secret);
    expect(stored.payload).toMatchObject({ id: eventId, type: "account.external_account.updated", account: "acct_stranger", data: { object: { id: "ba_1", object: "bank_account" } } });
  });
});
