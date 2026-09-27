import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { adminAuditLog, articles, publicationDispatches, publishLogs } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";
import { seedWebsite } from "@/test/fixtures";

/**
 * The drain status the rollback relies on, and the audited decisions that
 * resolve an unknown outcome. "Drained" must not be claimed from "nothing
 * claimed in the last 10 minutes": a send whose lease ran out may still
 * complete remotely.
 */

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({ db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }) }));
vi.mock("@/lib/admin/guard", () => ({ requireAdmin: vi.fn(async () => ({ email: "ops@repget.test" })) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/inngest/client", () => ({ inngest: { send: vi.fn() } }));

import { getOperations, resolveDispatch } from "@/lib/admin/network-operations";
import { IN_FLIGHT_TIMEOUT_MS } from "@/lib/publishing/dispatch";

let test: TestDb;
beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});
beforeEach(async () => {
  await test.db.delete(publicationDispatches);
});

async function dispatch(status: string, fields: Partial<typeof publicationDispatches.$inferInsert> = {}) {
  const { websiteId } = await seedWebsite(test);
  const [a] = await test.db.insert(articles).values({ websiteId, title: `A ${status}`, status: "draft", bodyHtml: "<p>x</p>" }).returning();
  const [d] = await test.db
    .insert(publicationDispatches)
    // claimed_at written by the app, as claimDispatch does (UTC), not the database clock default.
    .values({ articleId: a.id, websiteId, channel: "direct", trigger: "manual", revisionHash: "h", requestedStatus: "publish", status, claimedAt: new Date(), ...fields })
    .returning();
  return d;
}

describe("drain status", () => {
  it("a send whose lease ran out keeps the system NOT drained, although nothing is 'in flight' now", async () => {
    await dispatch("in_flight", { claimedAt: new Date(Date.now() - IN_FLIGHT_TIMEOUT_MS - 60_000) });
    const ops = await getOperations();
    expect(ops.drain).toEqual({ inFlight: 0, inFlightStale: 1, uncertain: 0, unacknowledged: 0, drained: false });
    expect(ops.unresolved.map((u) => u.state)).toEqual(["in_flight_stale"]);
  });

  it("counts every unknown outcome, and is drained only when none is left", async () => {
    await dispatch("in_flight");
    const uncertain = await dispatch("uncertain");
    const expired = await dispatch("expired", { channel: "plugin", trigger: "plugin", protocol: "plugin_legacy" });
    await dispatch("abandoned", { channel: "plugin", trigger: "plugin" });
    await dispatch("sent");
    let ops = await getOperations();
    expect(ops.drain).toEqual({ inFlight: 1, inFlightStale: 0, uncertain: 1, unacknowledged: 2, drained: false });

    await expect(resolveDispatch({ dispatchId: uncertain.id, decision: "not_published", reason: "checked the site" })).resolves.toEqual({ ok: true, data: null });
    await expect(resolveDispatch({ dispatchId: expired.id, decision: "release", reason: "plugin uninstalled" })).resolves.toEqual({ ok: true, data: null });
    await test.db.delete(publicationDispatches).where(eq(publicationDispatches.status, "in_flight"));
    await test.db.delete(publicationDispatches).where(eq(publicationDispatches.status, "abandoned"));
    ops = await getOperations();
    expect(ops.drain.drained).toBe(true);
  });
});

describe("audited resolution", () => {
  it("records who decided, when and why - on the dispatch and in the admin log", async () => {
    const d = await dispatch("uncertain");
    await resolveDispatch({ dispatchId: d.id, decision: "not_published", reason: "checked wp-admin, no such post" });
    const [row] = await test.db.select().from(publicationDispatches).where(eq(publicationDispatches.id, d.id));
    expect(row).toMatchObject({ status: "failed", reconciledBy: "admin:ops@repget.test", reconcileNote: "checked wp-admin, no such post" });
    expect(row.reconciledAt).toBeInstanceOf(Date);
    const audit = await test.db.select().from(adminAuditLog).where(eq(adminAuditLog.targetId, d.id));
    expect(audit.map((a) => a.action)).toEqual(["publication.dispatch_resolved"]);
  });

  it("'found the post' records its id, so the next publish updates it instead of creating another", async () => {
    const d = await dispatch("uncertain");
    await expect(resolveDispatch({ dispatchId: d.id, decision: "published", reason: "found it", remoteId: "77", remoteUrl: "https://site.test/p/" })).resolves.toMatchObject({ ok: true });
    const logs = await test.db.select().from(publishLogs).where(eq(publishLogs.articleId, d.articleId));
    expect(logs).toMatchObject([{ status: "published", remoteId: "77", dispatchId: d.id }]);
  });

  it("refuses a decision without a reason, on a settled send, or a release of a direct send", async () => {
    const d = await dispatch("uncertain");
    await expect(resolveDispatch({ dispatchId: d.id, decision: "not_published", reason: " " })).resolves.toMatchObject({ ok: false });
    const sent = await dispatch("sent");
    await expect(resolveDispatch({ dispatchId: sent.id, decision: "not_published", reason: "x".repeat(5) })).resolves.toMatchObject({ ok: false });
    await expect(resolveDispatch({ dispatchId: d.id, decision: "release", reason: "x".repeat(5) })).resolves.toMatchObject({ ok: false });
    await expect(resolveDispatch({ dispatchId: randomUUID(), decision: "release", reason: "x".repeat(5) })).resolves.toMatchObject({ ok: false });
  });
});
