import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { organization, user } from "@/lib/db/auth-tables";
import { supportChatState } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";

/**
 * The welcome claim asks Crisp (ticket 2026-11-19, item 6), on a disposable
 * database with the Crisp answer stubbed: a conversation Crisp holds refuses
 * the welcome and is remembered, so Crisp is asked once; "none" or
 * "unknown" (API unset, failing, slow) claims exactly as before; without an
 * email, or when anything else already refuses, Crisp is not asked at all.
 */

vi.mock("server-only", () => ({}));
const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({ db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }) }));
vi.mock("@/lib/email/send", () => ({ sendEmail: vi.fn() }));

import { claimWelcome, recordSupportChatEvent, welcomeForLayout, type WelcomeContext } from "./onboarding-welcome";

let test: TestDb;
beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});

const T0 = new Date("2026-11-20T10:00:00.000Z");
const at = (ms: number) => new Date(T0.getTime() + ms);

async function person(): Promise<WelcomeContext> {
  const id = `u_${randomUUID().slice(0, 8)}`;
  const org = `org_${randomUUID().slice(0, 8)}`;
  await test.db.insert(user).values({ id, name: id, email: `${id}@example.com`, createdAt: T0, updatedAt: T0 });
  await test.db.insert(organization).values({ id: org, name: org, slug: org, createdAt: T0 });
  return { userId: id, organizationId: org, accountCreatedAt: T0, ownsWorkspace: true, setupComplete: false, email: `${id}@example.com` };
}

const rowOf = async (userId: string) => (await test.db.select().from(supportChatState).where(eq(supportChatState.userId, userId)))[0];
// The PGlite test database stands in for the app's Postgres executor (same queries, another driver type).
const executor = () => test.db as unknown as Parameters<typeof claimWelcome>[2];

describe("claimWelcome and Crisp", () => {
  it("refuses when Crisp already holds a conversation, notes it once, and never asks again", async () => {
    const who = await person();
    const check = vi.fn(async () => "exists" as const);
    expect(await claimWelcome(who, at(60_000), executor(), check)).toEqual({ ok: false, reason: "conversation" });
    expect(check).toHaveBeenCalledWith(who.email);
    const row = await rowOf(who.userId);
    expect(row.welcomedAt).toBeNull();
    expect(row.firstMessageAt).toEqual(at(60_000));
    // Found in Crisp, not in the app: no in-app message time.
    expect(row.lastMessageAt).toBeNull();

    expect(await claimWelcome(who, at(120_000), executor(), check)).toEqual({ ok: false, reason: "conversation" });
    expect(check).toHaveBeenCalledTimes(1);
    expect(await welcomeForLayout(who, at(180_000))).toBe(false);
  });

  it.each(["none", "unknown"] as const)("claims as before when Crisp says %s", async (answer) => {
    const who = await person();
    const check = vi.fn(async () => answer);
    expect(await claimWelcome(who, at(60_000), executor(), check)).toEqual({ ok: true });
    expect((await rowOf(who.userId)).welcomedAt).toEqual(at(60_000));
    expect((await rowOf(who.userId)).firstMessageAt).toBeNull();
  });

  it("does not ask Crisp without an email, nor for someone refused anyway", async () => {
    const check = vi.fn(async () => "exists" as const);
    const anonymous = { ...(await person()), email: null };
    expect(await claimWelcome(anonymous, at(60_000), executor(), check)).toEqual({ ok: true });

    const writer = await person();
    await recordSupportChatEvent(writer.userId, writer.organizationId, "sent", at(1000));
    expect(await claimWelcome(writer, at(60_000), executor(), check)).toEqual({ ok: false, reason: "conversation" });

    const old = { ...(await person()), accountCreatedAt: new Date(T0.getTime() - 30 * 24 * 60 * 60 * 1000) };
    expect(await claimWelcome(old, at(60_000), executor(), check)).toEqual({ ok: false, reason: "not_new" });
    expect(check).not.toHaveBeenCalled();
  });

  it("never overwrites a welcome already claimed with a Crisp finding", async () => {
    const who = await person();
    expect(await claimWelcome(who, at(60_000), executor(), async () => "none")).toEqual({ ok: true });
    const { recordConversationFoundInCrisp } = await import("./onboarding-welcome");
    await recordConversationFoundInCrisp(who.userId, who.organizationId, at(90_000), executor());
    const row = await rowOf(who.userId);
    expect(row.welcomedAt).toEqual(at(60_000));
    expect(row.firstMessageAt).toBeNull();
  });
});
