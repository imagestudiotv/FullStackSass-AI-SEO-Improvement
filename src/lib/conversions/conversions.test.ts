import { eq } from "drizzle-orm";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { account, billingCheckouts, organization, plans, user } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";

import { checkoutVisitor, conversionId, pendingConversions, rememberCheckoutVisitor, rememberPayer } from "./conversions";
import { ANALYTICS_CONSENT_COOKIE } from "./config";
import { gaClientId, gaSessionId } from "./ga-identity";

const jarState = vi.hoisted(() => ({ values: {} as Record<string, string>, set: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({
  get: (name: string) => jarState.values[name] ? { value: jarState.values[name] } : undefined,
  set: jarState.set,
}) }));

/**
 * The three conversions for Google Ads (client, 2026-10-09): which sign-ups
 * and free-articles starts a signed-in page reports, the payer's GA identity
 * kept at checkout (only after Accept), and the first real payment reported
 * to GA4 once, from the webhook. Real rows; Google replaced at its boundary.
 */

let test: TestDb;
let planId: string;
const NOW = new Date("2026-10-10T12:00:00Z");
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000);

beforeAll(async () => {
  test = await createTestDb();
  await test.db.insert(organization).values([{ id: "org_a", name: "Acme", slug: "acme", createdAt: NOW }]);
  await test.db.insert(user).values([
    { id: "u_new", name: "N", email: "new@example.com", createdAt: minutesAgo(10), updatedAt: minutesAgo(10) },
    { id: "u_old", name: "O", email: "old@example.com", createdAt: minutesAgo(61), updatedAt: minutesAgo(61) },
  ]);
  await test.db.insert(account).values([
    { id: "a1", accountId: "g-1", providerId: "google", issuer: "google", userId: "u_new", createdAt: minutesAgo(10), updatedAt: minutesAgo(10) },
    { id: "a2", accountId: "u_old", providerId: "credential", issuer: "credential", userId: "u_old", createdAt: minutesAgo(61), updatedAt: minutesAgo(61) },
  ]);
  const [plan] = await test.db
    .insert(plans)
    .values({ name: "Growth", tier: "growth", stripePriceId: "price_growth", priceCents: 4900, articleLimit: 30, keywordLimit: 100, siteLimit: 1, monthlyCredits: 0 })
    .returning();
  planId = plan.id;
});

beforeEach(async () => {
  jarState.values = {};
  jarState.set.mockClear();
  vi.stubEnv("NEXT_PUBLIC_GA4_MEASUREMENT_ID", "G-ABC123XYZ");
  vi.stubEnv("NEXT_PUBLIC_GTM_ID", "");
  vi.stubEnv("GA4_API_SECRET", "secret_ABCDEFGH");
  await test.db.delete(billingCheckouts);
});
afterEach(() => {
  vi.unstubAllEnvs();
});

async function checkout(values: Partial<typeof billingCheckouts.$inferInsert>) {
  const [row] = await test.db
    .insert(billingCheckouts)
    .values({ organizationId: "org_a", provider: "stripe", planId, status: "completed", trialDays: 30, updatedAt: minutesAgo(5), ...values })
    .returning();
  return row;
}

describe("GA's cookies", () => {
  it("reads the client id and both session cookie formats", () => {
    expect(gaClientId("GA1.1.1234567890.1700000000")).toBe("1234567890.1700000000");
    expect(gaClientId("GA1.2.99.88")).toBe("99.88");
    expect(gaClientId("nonsense")).toBeNull();
    expect(gaClientId("GA1.1.abc.def")).toBeNull();
    expect(gaClientId(undefined)).toBeNull();
    expect(gaSessionId("GS1.1.1700000000.3.1.1700000100.0.0.0")).toBe("1700000000");
    expect(gaSessionId("GS2.1.s1700000000$o3$g1$t1700000100$j0$l0$h0")).toBe("1700000000");
    expect(gaSessionId("GS2.1.x1$o3")).toBeNull();
  });
});

describe("pendingConversions", () => {
  const who = (userId: string) => ({ userId, userCreatedAt: userId === "u_new" ? minutesAgo(10) : minutesAgo(61), organizationId: "org_a" });

  it("reports a sign-up in the hour after it, with how they signed up", async () => {
    expect(await pendingConversions(test.db, who("u_new"), NOW)).toEqual([
      { id: conversionId("sign_up", "u_new"), name: "sign_up", params: { method: "google" } },
    ]);
    expect(await pendingConversions(test.db, who("u_old"), NOW)).toEqual([]);
  });

  it("reports the start of free articles in the hour after the checkout completed, and nothing else", async () => {
    const trial = await checkout({});
    await checkout({ trialDays: 0 }); // paid at once: the server reports the purchase
    await checkout({ status: "open" });
    await checkout({ updatedAt: minutesAgo(90) });
    expect(await pendingConversions(test.db, who("u_old"), NOW)).toEqual([
      { id: conversionId("start_trial", trial.id), name: "start_trial", params: { plan: "Growth" } },
    ]);
  });

  it("asks the database nothing when the deployment has no Google tag", async () => {
    vi.stubEnv("NEXT_PUBLIC_GA4_MEASUREMENT_ID", "");
    await checkout({});
    expect(await pendingConversions(test.db, who("u_new"), NOW)).toEqual([]);
  });

  it("gives Google opaque ids, never ours", () => {
    const id = conversionId("sign_up", "u_new");
    expect(id).toMatch(/^[0-9a-f]{32}$/);
    expect(id).not.toContain("u_new");
  });
});

describe("the payer's GA identity", () => {
  const jar = (cookies: Record<string, string>) => (name: string) => cookies[name];

  it("is read only after Accept, and only when GA has identified the browser", () => {
    const ga = { _ga: "GA1.1.111.222", _ga_ABC123XYZ: "GS2.1.s1700000000$o1" };
    expect(checkoutVisitor(jar({ ...ga, repget_consent: "2.granted" }), NOW)).toEqual({
      clientId: "111.222",
      sessionId: "1700000000",
      capturedAt: NOW.toISOString(),
    });
    expect(checkoutVisitor(jar({ ...ga, repget_consent: "2.denied" }), NOW)).toBeNull();
    expect(checkoutVisitor(jar({ ...ga, repget_consent: "1.granted" }), NOW)).toBeNull();
    expect(checkoutVisitor(jar(ga), NOW)).toBeNull();
    expect(checkoutVisitor(jar({ repget_consent: "2.granted" }), NOW)).toBeNull();
  });

  it("is kept on the checkout without touching its date", async () => {
    const row = await checkout({ status: "open" });
    await rememberCheckoutVisitor(test.db, row.id, { clientId: "111.222", sessionId: null, capturedAt: NOW.toISOString() });
    const [after] = await test.db.select().from(billingCheckouts).where(eq(billingCheckouts.id, row.id));
    expect(after.analytics).toEqual({ clientId: "111.222", sessionId: null, capturedAt: NOW.toISOString() });
    expect(after.updatedAt).toEqual(row.updatedAt);
  });

  it("issues an HttpOnly first-party withdrawal proof only for an accepted checkout", async () => {
    const row = await checkout({});
    jarState.values = { repget_consent: "2.granted", _ga: "GA1.1.111.222", _ga_ABC123XYZ: "GS2.1.s1700000000$o1" };
    await rememberPayer(test.db, row.id);
    expect(jarState.set).toHaveBeenCalledWith(ANALYTICS_CONSENT_COOKIE, expect.stringMatching(/^[0-9a-f]{32}$/), expect.objectContaining({ httpOnly: true, path: "/", sameSite: "lax" }));
    const [after] = await test.db.select().from(billingCheckouts).where(eq(billingCheckouts.id, row.id));
    expect(after.analytics).toMatchObject({ clientId: "111.222", consentKey: jarState.set.mock.calls[0][1] });
  });

  it("a declined resumed checkout clears its saved identity even before browser synchronization", async () => {
    const key = "a".repeat(32);
    const row = await checkout({ analytics: { clientId: "111.222", sessionId: null, capturedAt: NOW.toISOString(), consentKey: key } });
    jarState.values = { repget_consent: "2.denied", [ANALYTICS_CONSENT_COOKIE]: key };
    await rememberPayer(test.db, row.id);
    expect(jarState.set).not.toHaveBeenCalled();
    expect((await test.db.select().from(billingCheckouts).where(eq(billingCheckouts.id, row.id)))[0].analytics).toBeNull();
  });
});
