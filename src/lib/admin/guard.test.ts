import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Admin authorization: an allowlisted address counts only once it is PROVEN
 * (emailVerified strictly true). requireAdmin() - the gate on admin pages,
 * server actions and operations - and isAdmin() - the gate on
 * /api/stripe/whoami and the menu - must give the same answer.
 */

const state = vi.hoisted(() => ({ session: null as unknown }));
vi.mock("@/lib/auth-guard", () => ({ getSession: vi.fn(async () => state.session) }));

import { adminFromSession, isAdmin, NotAdminError, requireAdmin } from "./guard";

function session(user: Record<string, unknown>) {
  return { user: { id: "user_1", email: "owner@admin.test", ...user }, session: { id: "s1" } };
}

async function decision() {
  const allowed = await requireAdmin().then(
    () => true,
    (error) => {
      expect(error).toBeInstanceOf(NotAdminError);
      return false;
    },
  );
  // The menu / API predicate never disagrees with the server gate.
  expect(await isAdmin()).toBe(allowed);
  return allowed;
}

beforeEach(() => {
  vi.stubEnv("ADMIN_EMAILS", "owner@admin.test, second@admin.test");
  state.session = null;
});

describe("admin authorization", () => {
  it("refuses an unauthenticated caller", async () => {
    expect(await decision()).toBe(false);
  });

  it("refuses an allowlisted address that is not verified", async () => {
    state.session = session({ emailVerified: false });
    expect(await decision()).toBe(false);
  });

  it.each([
    ["missing", {}],
    ["null", { emailVerified: null }],
    ["a truthy non-boolean", { emailVerified: "true" }],
    ["1", { emailVerified: 1 }],
  ])("refuses when verification information is %s", async (_label, user) => {
    state.session = session(user);
    expect(await decision()).toBe(false);
  });

  it("refuses a verified address that is not on the allowlist", async () => {
    state.session = session({ email: "customer@example.test", emailVerified: true });
    expect(await decision()).toBe(false);
  });

  it("admits a verified allowlisted administrator, matching case-insensitively", async () => {
    state.session = session({ email: "Owner@Admin.TEST", emailVerified: true });
    expect(await decision()).toBe(true);
    await expect(requireAdmin()).resolves.toEqual({ userId: "user_1", email: "Owner@Admin.TEST" });
  });

  it.each(["", " , ,"])("admits nobody when the allowlist is empty (%j)", async (value) => {
    vi.stubEnv("ADMIN_EMAILS", value);
    state.session = session({ emailVerified: true });
    expect(await decision()).toBe(false);
  });

  it("decides from the session's CURRENT email, so a changed address loses access", () => {
    expect(adminFromSession(session({ email: "moved@elsewhere.test", emailVerified: true }))).toBeNull();
  });
});
