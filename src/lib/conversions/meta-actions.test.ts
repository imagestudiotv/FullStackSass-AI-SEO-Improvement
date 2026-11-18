import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { account, billingCheckouts, organization, plans, user } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";

import { conversionId } from "./config";
import { metaHash } from "./meta-capi";

/**
 * The server's copy of the sign-up and the trial start (client's guide,
 * 2026-11-18, section 2 rows 4 and 6): only what the server itself finds
 * due for the caller, with the pixel's ids, only after Accept.
 */

const state = vi.hoisted(() => ({ db: null as unknown, session: null as unknown, cookies: {} as Record<string, string> }));
vi.mock("@/lib/db", () => ({ db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }) }));
vi.mock("@/lib/auth-guard", () => ({ getSession: async () => state.session }));
vi.mock("@/lib/tenant", () => ({ requireOrg: async () => ({ orgId: "org_a", userId: "u_new", role: "owner" }) }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (state.cookies[name] ? { value: state.cookies[name] } : undefined) }),
  headers: async () => ({ get: (name: string) => ({ "x-forwarded-for": "203.0.113.7", "user-agent": "UA" })[name.toLowerCase()] ?? null }),
}));

import { mirrorMetaConversions } from "./meta-actions";

const NOW = new Date();
const FBP = "fb.1.1763460000000.1234567890";
let test: TestDb;
let trialId: string;

beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
  await test.db.insert(organization).values({ id: "org_a", name: "Acme", slug: "acme", createdAt: NOW });
  await test.db.insert(user).values({ id: "u_new", name: "N", email: "New@Example.com", createdAt: NOW, updatedAt: NOW });
  await test.db.insert(account).values({ id: "a1", accountId: "u_new", providerId: "credential", issuer: "credential", userId: "u_new", createdAt: NOW, updatedAt: NOW });
  const [plan] = await test.db.insert(plans).values({ name: "Grow", tier: "grow", priceCents: 14900, articleLimit: 30, keywordLimit: 100, siteLimit: 1, monthlyCredits: 0 }).returning();
  const [trial] = await test.db.insert(billingCheckouts).values({ organizationId: "org_a", provider: "stripe", planId: plan.id, status: "completed", trialDays: 3, updatedAt: NOW }).returning();
  trialId = trial.id;
});
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_META_PIXEL_ID", "1063151092935473");
  vi.stubEnv("META_CAPI_TOKEN", "EAAtesttoken1234567890abcdef");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://www.repget.com");
  state.session = { user: { id: "u_new", email: "New@Example.com", createdAt: NOW } };
  state.cookies = { repget_consent: "2.granted", _fbp: FBP };
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
afterAll(async () => { await test.client.close(); });

describe("mirrorMetaConversions", () => {
  it("sends the due sign-up and trial start with the pixel's ids and the guide's parameters", async () => {
    const send = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", send);
    const signUp = conversionId("sign_up", "u_new");
    const trial = conversionId("start_trial", trialId);
    await mirrorMetaConversions([signUp, trial, "not-due"]);
    const body = JSON.parse(String((send.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(body.data).toHaveLength(2);
    expect(body.data[0]).toMatchObject({ event_name: "CompleteRegistration", event_id: signUp, custom_data: { content_name: "signup" }, user_data: { em: [metaHash("new@example.com")], external_id: [metaHash("u_new")], fbp: FBP } });
    expect(body.data[1]).toMatchObject({ event_name: "StartTrial", event_id: trial, custom_data: { value: 0, currency: "EUR", content_name: "grow" } });
  });

  it("sends nothing without Accept, without a session, or for ids the server does not find due", async () => {
    const send = vi.fn();
    vi.stubGlobal("fetch", send);
    state.cookies = { _fbp: FBP };
    await mirrorMetaConversions([conversionId("sign_up", "u_new")]);
    state.cookies = { repget_consent: "2.granted", _fbp: FBP };
    await mirrorMetaConversions(["forged"]);
    state.session = null;
    await mirrorMetaConversions([conversionId("sign_up", "u_new")]);
    expect(send).not.toHaveBeenCalled();
  });
});
