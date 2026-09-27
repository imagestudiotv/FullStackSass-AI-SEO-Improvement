import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestDb, type TestDb } from "@/test/db";

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }),
}));

import { organization, user, websites } from "@/lib/db/schema";

import {
  consumeOAuthState,
  createOAuthState,
  pruneOAuthStates,
} from "./oauth-state";

/**
 * Issue 13: OAuth state must be random, short-lived, single-use and bound to
 * the session that started it.
 *
 * The old state was an HMAC over "<websiteId>.<nonce>.<origin>" with a
 * Math.random() nonce, no expiry and no record of use.
 */

let test: TestDb;

const ORG = "org_1";
const USER = "user_1";
const OTHER_USER = "user_2";
const SESSION = "sess_1";
const OTHER_SESSION = "sess_2";
const NOW = new Date("2026-09-26T10:00:00Z");

let websiteId: string;

beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});

beforeEach(async () => {
  await test.client.exec(`
    delete from oauth_states;
    delete from websites;
    delete from "user";
    delete from organization;
  `);

  // createdAt has no database default on Better Auth's tables, and updatedAt on
  // "user" is notNull without one, so both are supplied. Same as deletion.test.
  const now = new Date();
  await test.db
    .insert(organization)
    .values([{ id: ORG, name: "Org", slug: "org", createdAt: now }]);
  await test.db.insert(user).values([
    { id: USER, name: "A", email: "a@example.com", createdAt: now, updatedAt: now },
    { id: OTHER_USER, name: "B", email: "b@example.com", createdAt: now, updatedAt: now },
  ]);
  const [site] = await test.db
    .insert(websites)
    .values({ organizationId: ORG, domain: "example.com", url: "https://example.com" })
    .returning({ id: websites.id });
  websiteId = site.id;
});

function make(overrides: Partial<Parameters<typeof createOAuthState>[0]> = {}) {
  return createOAuthState({
    provider: "google",
    websiteId,
    userId: USER,
    sessionId: SESSION,
    origin: "app",
    now: NOW,
    ...overrides,
  });
}

const consume = (
  value: string,
  overrides: Partial<Parameters<typeof consumeOAuthState>[0]> = {},
) =>
  consumeOAuthState({
    state: value,
    provider: "google",
    userId: USER,
    sessionId: SESSION,
    now: NOW,
    ...overrides,
  });

describe("createOAuthState", () => {
  it("issues an unguessable state and an S256 challenge", async () => {
    const { state: value, codeChallenge } = await make();

    // 32 random bytes, base64url: 43 characters, no padding.
    expect(value).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(codeChallenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("never repeats a state", async () => {
    const values = new Set<string>();
    for (let i = 0; i < 25; i += 1) values.add((await make()).state);
    expect(values.size).toBe(25);
  });

  it("keeps the verifier server side, not in the challenge", async () => {
    const { state: value, codeChallenge } = await make();
    const { rows } = await test.client.query<{ code_verifier: string }>(
      "select code_verifier from oauth_states where state = $1",
      [value],
    );
    // The challenge is a hash of the verifier, so they must differ; only the
    // challenge ever reaches the browser.
    expect(rows[0].code_verifier).not.toBe(codeChallenge);
    expect(rows[0].code_verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
});

describe("consumeOAuthState", () => {
  it("redeems a fresh state once and returns its context", async () => {
    const { state: value } = await make({ origin: "onboarding" });
    const result = await consume(value);

    expect(result.ok).toBe(true);
    expect(result.ok && result.state.websiteId).toBe(websiteId);
    expect(result.ok && result.state.origin).toBe("onboarding");
    expect(result.ok && result.state.codeVerifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("refuses a REPLAY - the whole point", async () => {
    const { state: value } = await make();
    expect((await consume(value)).ok).toBe(true);
    // The old signed state had no record of use and would verify for ever.
    expect(await consume(value)).toEqual({ ok: false, reason: "invalid" });
  });

  it("refuses an EXPIRED state", async () => {
    const { state: value } = await make();
    const later = new Date(NOW.getTime() + 11 * 60 * 1000);
    expect(await consume(value, { now: later })).toEqual({
      ok: false,
      reason: "invalid",
    });
  });

  it("treats the exact expiry instant as expired", async () => {
    const { state: value } = await make();
    const atExpiry = new Date(NOW.getTime() + 10 * 60 * 1000);
    expect((await consume(value, { now: atExpiry })).ok).toBe(false);
  });

  it("refuses a TAMPERED state", async () => {
    const { state: value } = await make();
    const flipped = `${value.slice(0, -1)}${value.endsWith("A") ? "B" : "A"}`;
    expect((await consume(flipped)).ok).toBe(false);
  });

  it("refuses an unknown state", async () => {
    expect((await consume("nope")).ok).toBe(false);
  });

  it("refuses empty and oversized input without touching the table", async () => {
    expect((await consume("")).ok).toBe(false);
    expect((await consume("x".repeat(513))).ok).toBe(false);
  });

  it("refuses a CROSS-SESSION use, and does not burn the state", async () => {
    const { state: value } = await make();

    // Someone else's browser holding the callback URL.
    expect(await consume(value, { sessionId: OTHER_SESSION })).toEqual({
      ok: false,
      reason: "invalid",
    });

    // Still redeemable by the person who actually started it: a failed
    // cross-session attempt must not deny them their own connection.
    expect((await consume(value)).ok).toBe(true);
  });

  it("refuses a DIFFERENT USER, and does not burn the state", async () => {
    const { state: value } = await make();
    expect((await consume(value, { userId: OTHER_USER })).ok).toBe(false);
    expect((await consume(value)).ok).toBe(true);
  });

  it("refuses a state issued for another provider", async () => {
    const { state: value } = await make();
    expect((await consume(value, { provider: "facebook" })).ok).toBe(false);
  });

  it("gives the row to exactly one of many CONCURRENT callbacks", async () => {
    const { state: value } = await make();

    // Duplicate delivery, or a customer double-clicking through the redirect.
    const results = await Promise.all(
      Array.from({ length: 10 }, () => consume(value)),
    );

    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok)).toHaveLength(9);
  });

  it("keeps states for different websites independent", async () => {
    const [second] = await test.db
      .insert(websites)
      .values({ organizationId: ORG, domain: "second.com", url: "https://second.com" })
      .returning({ id: websites.id });

    const a = await make();
    const b = await make({ websiteId: second.id });

    const ra = await consume(a.state);
    const rb = await consume(b.state);
    expect(ra.ok && ra.state.websiteId).toBe(websiteId);
    expect(rb.ok && rb.state.websiteId).toBe(second.id);
  });
});

describe("pruneOAuthStates", () => {
  it("removes expired rows and leaves live ones", async () => {
    const live = await make();
    await make({ now: new Date(NOW.getTime() - 60 * 60 * 1000) }); // long expired

    const deleted = await pruneOAuthStates(NOW);
    expect(deleted).toBe(1);
    expect((await consume(live.state)).ok).toBe(true);
  });
});
