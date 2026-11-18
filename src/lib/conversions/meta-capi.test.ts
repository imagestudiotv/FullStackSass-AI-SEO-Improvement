import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { billingCheckouts, organization, plans, user } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";

import { conversionId } from "./config";
import { rememberPayer } from "./conversions";
import { leadEventId, metaEventsBody, metaHash, metaRequestUser, readMetaUser, sendMetaEvents } from "./meta-capi";
import { metaLeadEvent } from "./meta-request";

/**
 * The server side of the client's Meta guide (2026-11-18): who an event is
 * about, only after Accept; the request Meta reads; the payer's identity
 * kept at checkout with InitiateCheckout; the Lead's shared id.
 */

const request = vi.hoisted(() => ({ cookies: {} as Record<string, string>, headers: {} as Record<string, string>, set: vi.fn() }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (request.cookies[name] ? { value: request.cookies[name] } : undefined), set: request.set }),
  headers: async () => ({ get: (name: string) => request.headers[name.toLowerCase()] ?? null }),
}));
const later = vi.hoisted(() => ({ tasks: [] as (() => Promise<unknown>)[] }));
vi.mock("next/server", async (original) => ({ ...(await original<typeof import("next/server")>()), after: (task: () => Promise<unknown>) => later.tasks.push(task) }));

const PIXEL = "1063151092935473";
const TOKEN = "EAAtesttoken1234567890abcdef";
const FBP = "fb.1.1763460000000.1234567890";
const FBC = "fb.1.1763460000000.IwAR0abc_DEF-123";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)";
const NOW = new Date("2026-11-18T12:00:00Z");
let test: TestDb;
let planId: string;

beforeAll(async () => {
  test = await createTestDb();
  await test.db.insert(organization).values({ id: "org_a", name: "Acme", slug: "acme", createdAt: NOW });
  await test.db.insert(user).values({ id: "user_1", name: "B", email: "Buyer@Example.com", createdAt: NOW, updatedAt: NOW });
  const [plan] = await test.db.insert(plans).values({ name: "Grow", tier: "grow", priceCents: 14900, articleLimit: 30, keywordLimit: 100, siteLimit: 1, monthlyCredits: 0 }).returning();
  planId = plan.id;
});
beforeEach(async () => {
  vi.stubEnv("NEXT_PUBLIC_META_PIXEL_ID", PIXEL);
  vi.stubEnv("META_CAPI_TOKEN", TOKEN);
  vi.stubEnv("META_TEST_EVENT_CODE", "");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://www.repget.com");
  vi.stubEnv("NEXT_PUBLIC_GA4_MEASUREMENT_ID", "");
  vi.spyOn(console, "error").mockImplementation(() => {});
  request.cookies = { repget_consent: "2.granted", _fbp: FBP, _fbc: FBC };
  request.headers = { "x-forwarded-for": "203.0.113.7, 10.0.0.1", "user-agent": UA };
  request.set.mockClear();
  later.tasks = [];
  await test.db.delete(billingCheckouts);
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
afterAll(async () => { await test.client.close(); });

const cookie = (values: Record<string, string>) => (name: string) => values[name];
const header = (values: Record<string, string>) => (name: string) => values[name] ?? null;

describe("who an event is about", () => {
  it("only after Accept, and only while server events are configured", () => {
    const granted = { repget_consent: "2.granted", _fbp: FBP };
    expect(metaRequestUser(cookie(granted), header({}))).toEqual({ fbp: FBP });
    expect(metaRequestUser(cookie({ ...granted, repget_consent: "2.denied" }), header({}))).toBeNull();
    expect(metaRequestUser(cookie({ _fbp: FBP }), header({}))).toBeNull();
    vi.stubEnv("META_CAPI_TOKEN", "");
    expect(metaRequestUser(cookie(granted), header({}))).toBeNull();
  });

  it("hashes the email address and account id, trimmed and lowercased; sends the rest as it is", () => {
    const person = metaRequestUser(cookie(request.cookies), header(request.headers), { id: "user_1", email: "  Buyer@Example.COM " });
    expect(person).toEqual({ fbp: FBP, fbc: FBC, ip: "203.0.113.7", userAgent: UA, em: metaHash("buyer@example.com"), externalId: metaHash("user_1") });
    expect(person?.em).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(person)).not.toContain("Buyer");
  });

  it("drops what is not what it claims to be", () => {
    const forged = { repget_consent: "2.granted", _fbp: "fb.1.x.<script>", _fbc: "javascript:1" };
    expect(metaRequestUser(cookie(forged), header({ "x-forwarded-for": "not-an-ip", "user-agent": UA }))).toBeNull();
    expect(readMetaUser({ fbp: FBP, em: "plain@example.com", ip: "999.1.1.1" })).toEqual({ fbp: FBP });
    expect(readMetaUser("nope")).toBeNull();
  });
});

describe("the request Meta reads", () => {
  const event = { name: "Lead" as const, id: "abc", time: NOW, path: "/audit", user: { fbp: FBP }, custom: { content_name: "free_audit" } };

  it("follows the guide's section 4, with a clean address and the test code only while set", () => {
    expect(metaEventsBody([event], null)).toEqual({
      data: [{ event_name: "Lead", event_time: Math.floor(NOW.getTime() / 1000), event_id: "abc", action_source: "website", event_source_url: "https://www.repget.com/audit", user_data: { fbp: FBP }, custom_data: { content_name: "free_audit" } }],
    });
    expect(metaEventsBody([event], "TEST11921").test_event_code).toBe("TEST11921");
  });

  it("is skipped without a token and never logs the address that carries it", async () => {
    const send = vi.fn(async () => new Response("{}", { status: 400 }));
    expect(await sendMetaEvents([event], send)).toBe("failed");
    expect((send.mock.calls[0] as unknown as [string])[0]).toBe(`https://graph.facebook.com/v26.0/${PIXEL}/events?access_token=${TOKEN}`);
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(TOKEN);
    expect(await sendMetaEvents([event], async () => { throw new Error(TOKEN); })).toBe("failed");
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(TOKEN);
    vi.stubEnv("META_CAPI_TOKEN", "");
    const unused = vi.fn();
    expect(await sendMetaEvents([event], unused)).toBe("skipped");
    expect(unused).not.toHaveBeenCalled();
  });
});

describe("the payer at checkout", () => {
  async function checkout() {
    const [row] = await test.db.insert(billingCheckouts).values({ organizationId: "org_a", provider: "stripe", planId, status: "open", trialDays: 3 }).returning();
    return row;
  }
  const grow = { name: "Grow", priceCents: 14900, currency: "eur" };

  it("keeps Meta's identity under the consent proof, without GA, and sends InitiateCheckout after the response", async () => {
    const send = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", send);
    const row = await checkout();
    await rememberPayer(test.db, row.id, { userId: "user_1", plan: grow });
    const [after] = await test.db.select().from(billingCheckouts).where(eq(billingCheckouts.id, row.id));
    const key = request.set.mock.calls[0][1];
    expect(after.analytics).toMatchObject({ consentKey: key, meta: { fbp: FBP, fbc: FBC, ip: "203.0.113.7", userAgent: UA, em: metaHash("buyer@example.com"), externalId: metaHash("user_1") } });
    expect(after.analytics).not.toHaveProperty("clientId");
    expect(send).not.toHaveBeenCalled();
    await Promise.all(later.tasks.map((task) => task()));
    const body = JSON.parse(String((send.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(body.data[0]).toMatchObject({
      event_name: "InitiateCheckout", event_id: conversionId("initiate_checkout", row.id), event_source_url: "https://www.repget.com/pricing",
      custom_data: { value: 149, currency: "EUR", content_name: "grow" },
    });
  });

  it("keeps and sends nothing without consent", async () => {
    const send = vi.fn();
    vi.stubGlobal("fetch", send);
    request.cookies = { repget_consent: "2.denied", _fbp: FBP };
    const row = await checkout();
    await rememberPayer(test.db, row.id, { userId: "user_1", plan: grow });
    expect((await test.db.select().from(billingCheckouts).where(eq(billingCheckouts.id, row.id)))[0].analytics).toBeNull();
    expect(later.tasks).toHaveLength(0);
    expect(send).not.toHaveBeenCalled();
  });
});

describe("the free audit's Lead", () => {
  it("has the browser's id: one per browser per UTC day", async () => {
    const lead = await metaLeadEvent("/es/audit", NOW);
    expect(lead).toMatchObject({ name: "Lead", id: leadEventId(FBP, "2026-11-18"), path: "/es/audit", custom: { content_name: "free_audit" } });
    // What lib/meta-pixel.ts computes in the browser, with Web Crypto.
    const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`repget:lead:${FBP}:2026-11-18`));
    expect(Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32)).toBe(lead?.id);
  });

  it("is nothing without consent", async () => {
    request.cookies = { _fbp: FBP };
    expect(await metaLeadEvent("/audit", NOW)).toBeNull();
  });
});
