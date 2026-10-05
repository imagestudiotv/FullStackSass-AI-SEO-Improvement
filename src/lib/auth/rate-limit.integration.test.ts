import { randomBytes } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { createTestDb } from "@/test/db";

/**
 * The stated limits through the REAL Better Auth instance (lib/auth.ts),
 * driven over its HTTP handler as a browser or an attacker would, with rate
 * limiting ON as in every deployed build (NODE_ENV=production). PGlite stands
 * in for the database; one-time codes are captured instead of emailed.
 *
 * Every test uses its own visitor addresses: the limiter's counts live in
 * the shared PostgreSQL table for the whole file.
 */

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }),
}));
vi.mock("@/lib/email/otp", () => ({ sendOtpEmail: vi.fn(async () => ({ ok: true })) }));

const BASE = "http://localhost:3000";
let auth: typeof import("@/lib/auth").auth;

beforeAll(async () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("BETTER_AUTH_SECRET", randomBytes(32).toString("hex"));
  vi.stubEnv("BETTER_AUTH_URL", BASE);
  vi.stubEnv("GOOGLE_CLIENT_ID", "test-client-id");
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "test-client-secret-not-real");
  state.db = (await createTestDb()).db;
  ({ auth } = await import("@/lib/auth"));
}, 180_000);

afterAll(() => {
  vi.unstubAllEnvs();
});

/** POST to the auth handler as a visitor with these address headers. */
async function post(path: string, body: unknown, ip: Record<string, string>) {
  const response = await auth.handler(
    new Request(`${BASE}/api/auth${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: BASE, ...ip },
      body: JSON.stringify(body),
    }),
  );
  let json: { code?: string } | null = null;
  try {
    json = await response.json();
  } catch {
    // Not every answer has a body.
  }
  return { status: response.status, code: json?.code, retryAfter: response.headers.get("x-retry-after") };
}

const wrongPassword = (ip: Record<string, string>) =>
  post("/sign-in/email", { email: "nobody@example.test", password: "not-the-password" }, ip);

describe("rate limits on the real auth handler", { timeout: 120_000 }, () => {
  it("records the real handler's requests in the shared database", async () => {
    await wrongPassword({ "x-real-ip": "203.0.113.9" });
    const database = state.db as Awaited<ReturnType<typeof createTestDb>>["db"];
    const records = await database.query.authRateLimits.findMany();
    expect(records.length).toBeGreaterThan(0);
    expect(records.every((row) => /^[a-f0-9]{64}$/.test(row.key))).toBe(true);
  });

  it("password sign-in: 10 tries in a row per visitor, then 429 with a retry time", async () => {
    const visitor = { "x-real-ip": "203.0.113.10" };
    const statuses = [];
    for (let i = 0; i < 10; i += 1) statuses.push((await wrongPassword(visitor)).status);
    expect(statuses).toEqual(Array(10).fill(401));

    const eleventh = await wrongPassword(visitor);
    expect(eleventh.status).toBe(429);
    expect(Number(eleventh.retryAfter)).toBeGreaterThan(0);
  });

  it("another visitor has their own allowance", async () => {
    for (let i = 0; i < 11; i += 1) await wrongPassword({ "x-real-ip": "203.0.113.20" });
    expect((await wrongPassword({ "x-real-ip": "203.0.113.21" })).status).toBe(401);
  });

  /** A chain of proxies in x-forwarded-for must not drop everyone into one shared bucket. */
  it("reads x-real-ip first, so a multi-hop x-forwarded-for still names the visitor", async () => {
    for (let i = 0; i < 10; i += 1) await wrongPassword({ "x-real-ip": "203.0.113.30" });
    const viaChain = await wrongPassword({ "x-real-ip": "203.0.113.30", "x-forwarded-for": "198.51.100.1, 10.0.0.1" });
    expect(viaChain.status).toBe(429);
    // The same chain with a different real address is a different visitor.
    expect((await wrongPassword({ "x-real-ip": "203.0.113.31", "x-forwarded-for": "198.51.100.1, 10.0.0.1" })).status).toBe(401);
  });

  it("sign-up: 10 accounts in a row per visitor, then 429", async () => {
    const visitor = { "x-real-ip": "203.0.113.40" };
    const statuses = [];
    for (let i = 0; i < 11; i += 1) {
      statuses.push((await post("/sign-up/email", { name: "Bulk", email: `bulk-${i}@example.test`, password: "long-enough-pw" }, visitor)).status);
    }
    expect(statuses).toEqual([...Array(10).fill(200), 429]);
  });

  /** Unused by the app, and a way round /change-password's limit: closed over HTTP. */
  it("verify-password is not reachable over HTTP", async () => {
    expect((await post("/verify-password", { password: "guess" }, { "x-real-ip": "203.0.113.80" })).status).toBe(404);
  });

  it("one-time codes: 3 requests a minute per visitor", async () => {
    const visitor = { "x-real-ip": "203.0.113.50" };
    const statuses = [];
    for (let i = 0; i < 4; i += 1) {
      statuses.push((await post("/email-otp/send-verification-otp", { email: "someone@example.test", type: "sign-in" }, visitor)).status);
    }
    expect(statuses).toEqual([200, 200, 200, 429]);
  });

  it("new passwords: 8 to 128 characters, enforced by the server", async () => {
    const at = (n: number) => ({ "x-real-ip": `203.0.113.${60 + n}` });
    const signUp = (password: string, n: number) =>
      post("/sign-up/email", { name: "Len", email: `len-${n}@example.test`, password }, at(n));
    expect(await signUp("a".repeat(7), 1)).toMatchObject({ status: 400, code: "PASSWORD_TOO_SHORT" });
    expect(await signUp("a".repeat(129), 2)).toMatchObject({ status: 400, code: "PASSWORD_TOO_LONG" });
    expect((await signUp("a".repeat(8), 3)).status).toBe(200);
    expect((await signUp("a".repeat(128), 4)).status).toBe(200);
  });
});
