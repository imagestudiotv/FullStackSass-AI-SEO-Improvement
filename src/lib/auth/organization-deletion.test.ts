import { randomBytes, randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { organization } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";

/**
 * Better Auth's organization plugin serves /organization/delete, a bare row
 * delete open to any workspace owner. Nothing in the app calls it, and it skips
 * every rule of a workspace's deletion (lib/websites/deletion.ts). The real
 * handler, on a real database, signed in as the owner.
 */

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }),
}));
vi.mock("@/lib/email/otp", () => ({ sendOtpEmail: vi.fn(async () => ({ ok: true })) }));
vi.mock("@/inngest/send", () => ({ queueJob: vi.fn(async () => {}) }));

const BASE = "http://localhost:3000";
let auth: typeof import("@/lib/auth").auth;
let test: TestDb;

beforeAll(async () => {
  vi.stubEnv("BETTER_AUTH_SECRET", randomBytes(32).toString("hex"));
  vi.stubEnv("BETTER_AUTH_URL", BASE);
  vi.stubEnv("GOOGLE_CLIENT_ID", "test-client-id");
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "test-client-secret-not-real");
  test = await createTestDb();
  state.db = test.db;
  ({ auth } = await import("@/lib/auth"));
}, 180_000);

afterAll(() => {
  vi.unstubAllEnvs();
});

describe("POST /organization/delete", () => {
  it("is closed, for a workspace's own owner too: the workspace stays", async () => {
    const email = `${randomUUID()}@example.test`;
    const password = `Pw-${randomBytes(12).toString("hex")}`;
    const signUp = await auth.handler(
      new Request(`${BASE}/api/auth/sign-up/email`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: BASE, "x-forwarded-for": "203.0.113.7" },
        body: JSON.stringify({ email, password, name: "Owner" }),
      }),
    );
    expect(signUp.status).toBe(200);
    const cookie = (signUp.headers.getSetCookie?.() ?? [])
      .map((value) => value.split(";")[0])
      .join("; ");
    const workspaces = await test.db.select({ id: organization.id }).from(organization);
    expect(workspaces).toHaveLength(1);
    const organizationId = workspaces[0].id;

    const response = await auth.handler(
      new Request(`${BASE}/api/auth/organization/delete`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: BASE, cookie, "x-forwarded-for": "203.0.113.7" },
        body: JSON.stringify({ organizationId }),
      }),
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: "ORGANIZATION_DELETION_DISABLED" });
    expect(await test.db.select({ id: organization.id }).from(organization).where(eq(organization.id, organizationId))).toHaveLength(1);
  });
});
