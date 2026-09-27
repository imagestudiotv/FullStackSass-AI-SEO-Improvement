import { randomBytes } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { account, user } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";

/**
 * Admin access through the REAL Better Auth instance (lib/auth.ts), driven
 * over its HTTP handler exactly as a browser or an attacker would, against a
 * disposable PGlite database. Only the outside world is replaced: one-time
 * codes are captured instead of emailed, and next/headers returns the
 * cookies this test holds. The allowlist is a dummy address.
 *
 * The attack under test: signup is open and unverified, so someone registers
 * the administrator's address with their own password.
 */

const state = vi.hoisted(() => ({
  db: null as unknown,
  cookie: "",
  codes: new Map<string, string>(),
}));
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }),
}));
vi.mock("@/lib/email/otp", () => ({
  sendOtpEmail: vi.fn(async (options: { to: string; code: string }) => {
    state.codes.set(options.to.toLowerCase(), options.code);
    return { ok: true };
  }),
}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers(state.cookie ? { cookie: state.cookie } : {}),
}));

const ADMIN = "owner@admin.test";
const BASE = "http://localhost:3000";

let test: TestDb;
let auth: typeof import("@/lib/auth").auth;
let guard: typeof import("@/lib/admin/guard");

beforeAll(async () => {
  vi.stubEnv("BETTER_AUTH_SECRET", randomBytes(32).toString("hex"));
  vi.stubEnv("BETTER_AUTH_URL", BASE);
  vi.stubEnv("GOOGLE_CLIENT_ID", "test-client-id");
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "test-client-secret-not-real");
  vi.stubEnv("ADMIN_EMAILS", ADMIN);
  test = await createTestDb();
  state.db = test.db;
  ({ auth } = await import("@/lib/auth"));
  guard = await import("@/lib/admin/guard");
  // Replays every migration into PGlite and loads Better Auth. Alongside the
  // rest of the suite on a busy machine this has taken over the default 60 s.
}, 180_000);

afterAll(() => {
  vi.unstubAllEnvs();
});

/** POST to the auth handler; returns the status, JSON and session cookie. */
async function post(path: string, body: unknown, cookie = "") {
  const response = await auth.handler(
    new Request(`${BASE}/api/auth${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: BASE, ...(cookie ? { cookie } : {}) },
      body: JSON.stringify(body),
    }),
  );
  const setCookies = response.headers.getSetCookie?.() ?? [];
  const sessionCookie = setCookies
    .map((value) => value.split(";")[0])
    .filter((pair) => pair.includes("session_token"))
    .join("; ");
  let json: unknown = null;
  try {
    json = await response.json();
  } catch {
    // Some refusals have no JSON body.
  }
  return { status: response.status, json, cookie: sessionCookie };
}

async function adminAs(cookie: string) {
  state.cookie = cookie;
  const allowed = await guard.requireAdmin().then(
    () => true,
    () => false,
  );
  expect(await guard.isAdmin()).toBe(allowed);
  return allowed;
}

async function otpSignIn(email: string) {
  const sent = await post("/email-otp/send-verification-otp", { email, type: "sign-in" });
  expect(sent.status).toBe(200);
  const otp = state.codes.get(email);
  expect(otp).toBeTruthy();
  const signedIn = await post("/sign-in/email-otp", { email, otp });
  expect(signedIn.status).toBe(200);
  return signedIn.cookie;
}

// Real password hashing (scrypt) and several auth round trips per test: the
// default 30 s is too tight when the whole suite runs in parallel.
describe("admin access with the real sign-up and session flow", { timeout: 120_000 }, () => {
  let intruderCookie = "";

  it("an unauthenticated caller is not an admin", async () => {
    expect(await adminAs("")).toBe(false);
  });

  it("registering the allowlisted address with a password does not make you an admin", async () => {
    const signedUp = await post("/sign-up/email", {
      email: ADMIN,
      password: "intruder-password-123",
      name: "Intruder",
    });
    expect(signedUp.status).toBe(200);
    expect(signedUp.cookie).toContain("session_token");
    intruderCookie = signedUp.cookie;

    const [row] = await test.db.select().from(user).where(eq(user.email, ADMIN));
    expect(row.emailVerified).toBe(false);
    expect(await adminAs(intruderCookie)).toBe(false);
  });

  it("offers no endpoint that verifies the address while keeping the intruder's access", async () => {
    for (const path of [
      "/email-otp/verify-email",
      "/email-otp/request-password-reset",
      "/forget-password/email-otp",
      "/email-otp/reset-password",
      "/verify-email",
      "/request-password-reset",
      "/reset-password",
    ]) {
      const response = await post(path, { email: ADMIN, otp: "000000", newPassword: "x".repeat(12), password: "x".repeat(12) });
      expect({ path, status: response.status }).toEqual({ path, status: 404 });
    }
    // Email change is disabled at both endpoints, so an address cannot be swapped in.
    expect((await post("/change-email", { newEmail: "other@admin.test" }, intruderCookie)).status).not.toBe(200);
    expect((await post("/email-otp/change-email", { newEmail: "other@admin.test", otp: "000000" }, intruderCookie)).status).not.toBe(200);
    expect(await adminAs(intruderCookie)).toBe(false);
  });

  it("the owner proves the mailbox with a one-time code: verified, and the intruder's access is gone", async () => {
    const ownerCookie = await otpSignIn(ADMIN);

    const [row] = await test.db.select().from(user).where(eq(user.email, ADMIN));
    expect(row.emailVerified).toBe(true);
    expect(await adminAs(ownerCookie)).toBe(true);

    // The pre-registered password and its session were revoked by the proof.
    expect(await adminAs(intruderCookie)).toBe(false);
    const accounts = await test.db.select().from(account).where(eq(account.userId, row.id));
    expect(accounts.filter((a) => a.providerId === "credential")).toEqual([]);
    const retry = await post("/sign-in/email", { email: ADMIN, password: "intruder-password-123" });
    expect(retry.status).not.toBe(200);
  });

  it("a verified address that is not allowlisted is not an admin", async () => {
    const cookie = await otpSignIn("customer@example.test");
    expect(await adminAs(cookie)).toBe(false);
  });

  it("keeps Better Auth's refusal to link a provider to an unverified local account", () => {
    const linking = (auth.options as { account?: { accountLinking?: Record<string, unknown> } }).account
      ?.accountLinking;
    // Unset means Better Auth's default (true); it must never be switched off.
    expect(linking?.requireLocalEmailVerified ?? true).toBe(true);
    expect(linking?.allowDifferentEmails ?? false).toBe(false);
  });
});
