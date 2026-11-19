import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { createPostgresTestDb, testPostgresUrl } from "@/test/postgres";

/**
 * The onboarding welcome's claim on REAL Postgres, with claims racing on
 * separate connections: one welcome per account however many tabs or devices
 * ask at once, none after a conversation, and the chat events recorded once.
 * Skipped unless TEST_POSTGRES_URL names a disposable server.
 */

vi.mock("server-only", () => ({}));
const state = vi.hoisted(() => ({ db: null as unknown, pick: null as (() => unknown) | null }));
vi.mock("@/lib/db", () => ({ db: new Proxy({}, { get: (_t, p) => Reflect.get((state.pick ? state.pick() : state.db) as object, p) }) }));

import { organization, user } from "@/lib/db/auth-tables";
import { payments, supportChatState } from "@/lib/db/schema";
import { countSupportRequests } from "@/lib/support/crisp-events";
import { claimWelcome, recordSupportChatEvent, type WelcomeContext } from "@/lib/support/onboarding-welcome";

const available = Boolean(testPostgresUrl());
const T0 = new Date("2026-11-19T10:00:00.000Z");
const at = (ms: number) => new Date(T0.getTime() + ms);

describe.skipIf(!available)("onboarding welcome on real Postgres", () => {
  type Db = typeof import("@/lib/db").db;
  let dbs: Db[];
  let dispose: () => Promise<void>;

  beforeAll(async () => {
    const created = await createPostgresTestDb(3);
    dbs = created.dbs as unknown as Db[];
    dispose = created.dispose;
    state.db = dbs[0];
  }, 400_000);

  afterAll(async () => {
    await dispose?.();
  }, 300_000);

  async function person(): Promise<WelcomeContext> {
    const id = `u_${randomUUID().slice(0, 8)}`;
    const org = `org_${randomUUID().slice(0, 8)}`;
    await dbs[0].insert(user).values({ id, name: id, email: `${id}@example.com`, createdAt: T0, updatedAt: T0 });
    await dbs[0].insert(organization).values({ id: org, name: org, slug: org, createdAt: T0 });
    return { userId: id, organizationId: org, accountCreatedAt: T0, ownsWorkspace: true, setupComplete: false };
  }

  it("lets exactly one of many simultaneous claims win, and none after", async () => {
    const who = await person();
    let next = 0;
    state.pick = () => dbs[next++ % dbs.length];
    const claims = await Promise.all(Array.from({ length: 9 }, () => claimWelcome(who, at(60_000)))).finally(() => {
      state.pick = null;
    });
    expect(claims.filter((claim) => claim.ok)).toHaveLength(1);
    expect(await claimWelcome(who, at(120_000))).toEqual({ ok: false, reason: "welcomed" });
  });

  it("does not welcome someone who already wrote to support, or a paying workspace", async () => {
    const writer = await person();
    await recordSupportChatEvent(writer.userId, writer.organizationId, "sent", at(1000));
    expect(await claimWelcome(writer, at(60_000))).toEqual({ ok: false, reason: "conversation" });

    const payer = await person();
    await dbs[0].insert(payments).values({
      organizationId: payer.organizationId,
      provider: "stripe",
      externalId: `in_${randomUUID()}`,
      amountCents: 4900,
      currency: "eur",
      status: "paid",
    });
    expect(await claimWelcome(payer, at(60_000))).toEqual({ ok: false, reason: "customer" });
    const rows = await dbs[0].select().from(supportChatState).where(eq(supportChatState.userId, payer.userId));
    expect(rows).toHaveLength(0);
  });

  it("records the welcome's first open, dismissal and answer once, and counts requests by gap", async () => {
    const who = await person();
    expect((await claimWelcome(who, at(60_000))).ok).toBe(true);
    await recordSupportChatEvent(who.userId, who.organizationId, "opened", at(70_000));
    await recordSupportChatEvent(who.userId, who.organizationId, "opened", at(80_000));
    await recordSupportChatEvent(who.userId, who.organizationId, "closed", at(90_000));
    await recordSupportChatEvent(who.userId, who.organizationId, "sent", at(100_000));
    await recordSupportChatEvent(who.userId, who.organizationId, "sent", at(200_000));
    // Seven hours later: a second request.
    await recordSupportChatEvent(who.userId, who.organizationId, "sent", at(7 * 60 * 60 * 1000));
    const [row] = await dbs[0].select().from(supportChatState).where(eq(supportChatState.userId, who.userId));
    expect(row.welcomeOpenedAt?.toISOString()).toBe(at(70_000).toISOString());
    expect(row.welcomeDismissedAt?.toISOString()).toBe(at(90_000).toISOString());
    expect(row.welcomeAnsweredAt?.toISOString()).toBe(at(100_000).toISOString());
    expect(row.supportRequests).toBe(2);
    const counts = await countSupportRequests([who.userId, "nobody"]);
    expect(counts.get(who.userId)).toBe(2);
    expect(counts.get("nobody")).toBe(0);
  });

  it("does not count chat opened before any welcome as the welcome being opened", async () => {
    const who = await person();
    await recordSupportChatEvent(who.userId, who.organizationId, "opened", at(1000));
    const [row] = await dbs[0].select().from(supportChatState).where(eq(supportChatState.userId, who.userId));
    expect(row.welcomeOpenedAt).toBeNull();
    // Opening the chat is not a conversation: the welcome is still possible.
    expect((await claimWelcome(who, at(60_000))).ok).toBe(true);
  });
});
