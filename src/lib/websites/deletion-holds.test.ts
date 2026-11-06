import { randomUUID } from "node:crypto";

import { desc, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { member, user } from "@/lib/db/auth-tables";
import {
  adminAuditLog,
  articles,
  backlinkRequests,
  creditLedger,
  organization,
  placements,
  websiteMembers,
  websites,
} from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";
import { seedWebsite } from "@/test/fixtures";

/**
 * Deleting a website or a workspace that hosts another customer's backlinks,
 * through the real customer and admin actions and permission checks: what the
 * partner's credits do in each placement state, and that nothing is half done,
 * done twice or done for the wrong caller. On separate connections:
 * deletion.concurrency.test.ts.
 */

const state = vi.hoisted(() => ({ db: null as unknown, session: null as unknown }));
vi.mock("@/lib/db", () => ({ db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }) }));
vi.mock("@/lib/auth-guard", () => ({ getSession: async () => state.session }));
vi.mock("@/lib/auth", () => ({ ensureOrganization: async () => {} }));
vi.mock("@/lib/admin/guard", () => ({ requireAdmin: vi.fn(async () => ({ email: "ops@example.test" })) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`redirect:${to}`);
  },
  notFound: () => {
    throw new Error("notFound");
  },
}));
vi.mock("@/inngest/send", () => ({ queueJob: vi.fn() }));
vi.mock("@/inngest/client", () => ({
  inngest: { send: vi.fn(async () => ({ ids: [] })), createFunction: (config: unknown, handler: unknown) => ({ config, handler }) },
}));
vi.mock("@/lib/stripe/client", () => ({
  isStripeConfigured: () => false,
  stripe: new Proxy({}, {
    get: () => {
      throw new Error("Stripe must not be called by deletion");
    },
  }),
}));

import { deleteManyWebsites, deleteOrganization, deleteUser, deleteWebsite as adminDeleteWebsite } from "@/lib/admin/operations";
import { getAvailable } from "@/lib/backlinks/credits";
import { applyCheck, FAILURES_BEFORE_REMOVED, recordArticlePublication } from "@/lib/backlinks/placements";
import { deleteWebsite } from "@/lib/websites/actions";
import { deleteWebsiteIfBillingResolved, deleteWorkspaceIfBillingResolved } from "@/lib/websites/deletion";

let test: TestDb;

beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});

const CREDITS = 40;
const STARTING_BALANCE = 100;

async function signIn(orgId: string, invitedAs?: { websiteId: string; role: "editor" | "viewer" }) {
  const id = `u_${randomUUID()}`;
  await test.db.insert(user).values({ id, name: "C", email: `${id}@e.test`, emailVerified: true, createdAt: new Date(), updatedAt: new Date() });
  await test.db.insert(member).values({ id: `m_${randomUUID()}`, organizationId: orgId, userId: id, role: "owner", createdAt: new Date() });
  if (invitedAs) await test.db.insert(websiteMembers).values({ websiteId: invitedAs.websiteId, userId: id, role: invitedAs.role });
  state.session = { user: { id, email: `${id}@e.test`, emailVerified: true }, session: { id: `s_${id}`, activeOrganizationId: orgId } };
  return id;
}

/** A host with an article, and a partner holding credits; signed in as the host's owner. No subscriptions. */
async function world() {
  const host = await seedWebsite(test, { status: null });
  const partner = await seedWebsite(test, { status: null });
  await test.db.insert(creditLedger).values({ organizationId: partner.orgId, type: "purchase", amount: STARTING_BALANCE, idempotencyKey: `purchase:${randomUUID()}` });
  await test.db.insert(creditLedger).values({ organizationId: host.orgId, type: "purchase", amount: STARTING_BALANCE, idempotencyKey: `purchase:${randomUUID()}` });
  const [article] = await test.db
    .insert(articles)
    .values({ websiteId: host.websiteId, title: "Host article", status: "draft", bodyHtml: "<p>Text</p>" })
    .returning();
  await signIn(host.orgId);
  return { host, partner, article };
}

type World = Awaited<ReturnType<typeof world>>;

/** A partner's link on the host, in a stage reached directly: nothing about it has been charged. */
async function link(
  w: World,
  status: string,
  options: { requestStatus?: string; liveUrl?: string; onArticle?: boolean; hostWebsiteId?: string | null; requestId?: string } = {},
) {
  const requestId =
    options.requestId ??
    (
      await test.db
        .insert(backlinkRequests)
        .values({ websiteId: w.partner.websiteId, targetUrl: `https://partner.test/${randomUUID()}`, status: options.requestStatus ?? "matched", creditsReserved: CREDITS })
        .returning()
    )[0].id;
  const [placement] = await test.db
    .insert(placements)
    .values({
      requestId,
      hostWebsiteId: options.hostWebsiteId === undefined ? w.host.websiteId : options.hostWebsiteId,
      articleId: options.onArticle === false ? null : w.article.id,
      anchor: "anchor",
      credits: CREDITS,
      status,
      managed: true,
      liveUrl: options.liveUrl ?? null,
    })
    .returning();
  return { requestId, placementId: placement.id };
}

const placementOf = async (id: string) => (await test.db.select().from(placements).where(eq(placements.id, id)))[0];
const requestOf = async (id: string) => (await test.db.select().from(backlinkRequests).where(eq(backlinkRequests.id, id)))[0];
const siteExists = async (id: string) => (await test.db.select({ id: websites.id }).from(websites).where(eq(websites.id, id))).length > 0;
const workspaceExists = async (id: string) => (await test.db.select({ id: organization.id }).from(organization).where(eq(organization.id, id))).length > 0;
/** Every row of a workspace's ledger, ids and all: nothing edited, deleted or added. */
const ledgerOf = (organizationId: string) => test.db.select().from(creditLedger).where(eq(creditLedger.organizationId, organizationId)).orderBy(desc(creditLedger.createdAt), desc(creditLedger.id));

/** Everything money-related about the link, for "no change at all". */
async function snapshot(w: World, placed: { requestId: string; placementId: string }) {
  return {
    site: await siteExists(w.host.websiteId),
    placement: await placementOf(placed.placementId),
    request: await requestOf(placed.requestId),
    partnerLedger: await ledgerOf(w.partner.orgId),
    hostLedger: await ledgerOf(w.host.orgId),
    partner: await getAvailable(w.partner.orgId),
  };
}

const HELD = { balance: STARTING_BALANCE, reserved: CREDITS, available: STARTING_BALANCE - CREDITS };
const FREE = { balance: STARTING_BALANCE, reserved: 0, available: STARTING_BALANCE };

/** The three ways a website goes, by the real entry points. */
const deletions: [string, (w: World) => Promise<{ ok: boolean }>][] = [
  ["the owner", (w) => deleteWebsite(w.host.websiteId)],
  ["an administrator", (w) => adminDeleteWebsite(w.host.websiteId, "customer asked", "DELETE")],
  ["an administrator's bulk delete", (w) => deleteManyWebsites([w.host.websiteId], "customer asked", "DELETE")],
  ["deleting the workspace", (w) => deleteOrganization(w.host.orgId, "erasure request", "DELETE")],
];

describe.each(deletions)("deleted by %s", (_who, remove) => {
  it.each([
    ["pending", "matched"],
    ["drafted", "matched"],
    ["unverified", "pending"],
  ])("a %s link: closed, its hold back with the partner, and no ledger row for anyone", async (status, requestStatus) => {
    const w = await world();
    const placed = await link(w, status, { requestStatus });
    const partnerLedger = await ledgerOf(w.partner.orgId);
    expect(await getAvailable(w.partner.orgId)).toEqual(HELD);

    expect((await remove(w)).ok).toBe(true);

    expect(await siteExists(w.host.websiteId)).toBe(false);
    expect(await placementOf(placed.placementId)).toMatchObject({ status: "cancelled", articleId: null, hostWebsiteId: null });
    expect(await requestOf(placed.requestId)).toMatchObject({ status: "cancelled", creditsReserved: 0 });
    expect(await getAvailable(w.partner.orgId)).toEqual(FREE);
    expect(await ledgerOf(w.partner.orgId)).toEqual(partnerLedger);
  });

  it("a published link: nothing yet, and the verifier settles it", async () => {
    const w = await world();
    const placed = await link(w, "published", { liveUrl: "https://host.test/post" });

    expect((await remove(w)).ok).toBe(true);

    // The post is on the website and this deletes nothing there: the link may be up.
    expect(await placementOf(placed.placementId)).toMatchObject({ status: "published", articleId: null, hostWebsiteId: null, liveUrl: "https://host.test/post" });
    expect(await getAvailable(w.partner.orgId)).toEqual(HELD);

    // Never seen: released, nothing charged.
    let last;
    for (let i = 0; i < FAILURES_BEFORE_REMOVED; i++) last = await applyCheck(placed.placementId, "missing", 404, new Date(Date.now() + i * 1000));
    expect(last).toBe("unverified");
    expect(await placementOf(placed.placementId)).toMatchObject({ status: "cancelled" });
    expect(await getAvailable(w.partner.orgId)).toEqual(FREE);
  });

  it("a published link the verifier then sees: charged once, with no host left to reward", async () => {
    const w = await world();
    const placed = await link(w, "published", { liveUrl: "https://host.test/post" });
    const hostLedger = await ledgerOf(w.host.orgId);

    expect((await remove(w)).ok).toBe(true);
    expect(await applyCheck(placed.placementId, "alive", 200)).toBe("went_live");

    expect((await ledgerOf(w.partner.orgId)).map((row) => row.amount)).toEqual(expect.arrayContaining([STARTING_BALANCE, -CREDITS]));
    expect(await getAvailable(w.partner.orgId)).toEqual({ balance: STARTING_BALANCE - CREDITS, reserved: 0, available: STARTING_BALANCE - CREDITS });
    if (await workspaceExists(w.host.orgId)) expect(await ledgerOf(w.host.orgId)).toEqual(hostLedger);
  });

  it.each([
    ["live", "live"],
    ["removed", "cancelled"],
    ["cancelled", "cancelled"],
  ])("a %s link: nothing moves", async (status, requestStatus) => {
    const w = await world();
    const placed = await link(w, status, { requestStatus });
    await test.db.update(backlinkRequests).set({ creditsReserved: 0 }).where(eq(backlinkRequests.id, placed.requestId));
    const request = await requestOf(placed.requestId);
    const partnerLedger = await ledgerOf(w.partner.orgId);

    expect((await remove(w)).ok).toBe(true);

    expect((await placementOf(placed.placementId)).status).toBe(status);
    expect(await requestOf(placed.requestId)).toEqual(request);
    expect(await getAvailable(w.partner.orgId)).toEqual(FREE);
    expect(await ledgerOf(w.partner.orgId)).toEqual(partnerLedger);
  });

  it("a link waiting for an article is found by its host, and several links are all released", async () => {
    const w = await world();
    const noArticle = await link(w, "pending", { onArticle: false });
    const drafted = await link(w, "drafted");

    expect((await remove(w)).ok).toBe(true);

    expect((await placementOf(noArticle.placementId)).status).toBe("cancelled");
    expect((await placementOf(drafted.placementId)).status).toBe("cancelled");
    expect(await getAvailable(w.partner.orgId)).toEqual(FREE);
  });

  it("a link on one of its articles is found even when its host is no longer recorded", async () => {
    const w = await world();
    const placed = await link(w, "drafted", { hostWebsiteId: null });

    expect((await remove(w)).ok).toBe(true);

    expect((await placementOf(placed.placementId)).status).toBe("cancelled");
    expect(await getAvailable(w.partner.orgId)).toEqual(FREE);
  });

  it("a request another host's placement has taken over keeps its hold, which is that placement's now", async () => {
    const w = await world();
    const elsewhere = await seedWebsite(test, { status: null });
    const old = await link(w, "unverified");
    const taken = await link(w, "drafted", { requestId: old.requestId, onArticle: false, hostWebsiteId: elsewhere.websiteId });

    expect((await remove(w)).ok).toBe(true);

    expect((await placementOf(old.placementId)).status).toBe("cancelled");
    expect((await placementOf(taken.placementId)).status).toBe("drafted");
    expect(await requestOf(old.requestId)).toMatchObject({ status: "matched", creditsReserved: CREDITS });
    expect(await getAvailable(w.partner.orgId)).toEqual(HELD);
  });
});

describe("the website only receives the link", () => {
  it("its request and placement go with it, its hold with them, and the host's side does not move", async () => {
    const w = await world();
    const placed = await link(w, "drafted");
    const hostLedger = await ledgerOf(w.host.orgId);
    const partnerLedger = await ledgerOf(w.partner.orgId);
    await signIn(w.partner.orgId);

    expect((await deleteWebsite(w.partner.websiteId)).ok).toBe(true);

    expect(await placementOf(placed.placementId)).toBeUndefined();
    expect(await requestOf(placed.requestId)).toBeUndefined();
    expect(await getAvailable(w.partner.orgId)).toEqual(FREE);
    expect(await ledgerOf(w.partner.orgId)).toEqual(partnerLedger);
    expect(await ledgerOf(w.host.orgId)).toEqual(hostLedger);
    expect(await siteExists(w.host.websiteId)).toBe(true);
  });

  it("its workspace's deletion erases its requests and ledger, and takes nothing from the host's", async () => {
    const w = await world();
    await link(w, "drafted");
    const hostLedger = await ledgerOf(w.host.orgId);

    expect((await deleteOrganization(w.partner.orgId, "erasure request", "DELETE")).ok).toBe(true);

    expect(await test.db.select().from(backlinkRequests).where(eq(backlinkRequests.websiteId, w.partner.websiteId))).toEqual([]);
    expect(await ledgerOf(w.host.orgId)).toEqual(hostLedger);
    expect(await siteExists(w.host.websiteId)).toBe(true);
  });
});

describe("a deletion that does not happen changes nothing", () => {
  it.each(["editor", "viewer"] as const)("an invited %s is refused", async (role) => {
    const w = await world();
    const placed = await link(w, "drafted");
    const before = await snapshot(w, placed);
    const guest = await seedWebsite(test, { status: null });
    await signIn(guest.orgId, { websiteId: w.host.websiteId, role });

    const result = await deleteWebsite(w.host.websiteId);

    expect(result).toEqual({ ok: false, error: "Only the workspace that owns this website can delete it." });
    expect(await snapshot(w, placed)).toEqual(before);
  });

  it("another workspace is refused", async () => {
    const w = await world();
    const placed = await link(w, "drafted");
    const before = await snapshot(w, placed);
    const stranger = await seedWebsite(test, { status: null });
    await signIn(stranger.orgId);

    expect(await deleteWebsite(w.host.websiteId)).toEqual({ ok: false, error: "That website is not available." });
    expect(await snapshot(w, placed)).toEqual(before);
  });

  it("a website id given with the wrong workspace touches nothing", async () => {
    const w = await world();
    const placed = await link(w, "drafted");
    const before = await snapshot(w, placed);

    const result = await deleteWebsiteIfBillingResolved(test.db, { websiteId: w.host.websiteId, organizationId: w.partner.orgId });

    expect(result).toEqual({ ok: false, error: "Website not found." });
    expect(await snapshot(w, placed)).toEqual(before);
  });

  it("a billing refusal releases nothing: the website stays, and so does the link", async () => {
    const host = await seedWebsite(test);
    const partner = await seedWebsite(test, { status: null });
    await test.db.insert(creditLedger).values({ organizationId: partner.orgId, type: "purchase", amount: STARTING_BALANCE, idempotencyKey: `purchase:${randomUUID()}` });
    const [article] = await test.db.insert(articles).values({ websiteId: host.websiteId, title: "T", status: "draft", bodyHtml: "<p>Text</p>" }).returning();
    const w = { host, partner, article };
    const placed = await link(w, "drafted");
    const before = await snapshot(w, placed);
    await signIn(host.orgId);

    expect((await deleteWebsite(host.websiteId)).ok).toBe(false);
    expect((await adminDeleteWebsite(host.websiteId, "customer asked", "DELETE")).ok).toBe(false);
    expect((await deleteOrganization(host.orgId, "erasure request", "DELETE")).ok).toBe(false);

    expect(await snapshot(w, placed)).toEqual(before);
    expect(await workspaceExists(host.orgId)).toBe(true);
  });

  it("an administrator who did not confirm changes nothing", async () => {
    const w = await world();
    const placed = await link(w, "drafted");
    const before = await snapshot(w, placed);

    expect((await adminDeleteWebsite(w.host.websiteId, "customer asked", "no")).ok).toBe(false);
    expect((await deleteOrganization(w.host.orgId, "erasure request", "no")).ok).toBe(false);

    expect(await snapshot(w, placed)).toEqual(before);
  });
});

describe("failing part way, and repeating", () => {
  it("a website deletion that fails after the release keeps every hold, and the retry releases once", async () => {
    const w = await world();
    const placed = await link(w, "drafted");
    const before = await snapshot(w, placed);

    await expect(
      deleteWebsiteIfBillingResolved(test.db, {
        websiteId: w.host.websiteId,
        organizationId: w.host.orgId,
        beforeDelete: async (_tx, { releasedLinks }) => {
          expect(releasedLinks).toBe(1);
          throw new Error("audit log unavailable");
        },
      }),
    ).rejects.toThrow("audit log unavailable");
    expect(await snapshot(w, placed)).toEqual(before);

    expect(await deleteWebsite(w.host.websiteId)).toEqual({ ok: true, data: null });
    expect(await getAvailable(w.partner.orgId)).toEqual(FREE);

    // Repeated: no website, nothing further moves.
    const after = await snapshot(w, placed);
    expect(await deleteWebsite(w.host.websiteId)).toEqual({ ok: false, error: "That website is not available." });
    expect(await adminDeleteWebsite(w.host.websiteId, "again", "DELETE")).toEqual({ ok: false, error: "Website not found." });
    expect(await snapshot(w, placed)).toEqual(after);
  });

  it("a workspace deletion that fails after the release keeps every hold, and the retry releases once", async () => {
    const w = await world();
    const placed = await link(w, "drafted");
    const before = await snapshot(w, placed);

    await expect(
      deleteWorkspaceIfBillingResolved(test.db, {
        organizationId: w.host.orgId,
        beforeDelete: async () => {
          throw new Error("audit log unavailable");
        },
      }),
    ).rejects.toThrow("audit log unavailable");
    expect(await snapshot(w, placed)).toEqual(before);
    expect(await workspaceExists(w.host.orgId)).toBe(true);

    expect((await deleteOrganization(w.host.orgId, "erasure request", "DELETE")).ok).toBe(true);
    expect(await getAvailable(w.partner.orgId)).toEqual(FREE);
    expect((await placementOf(placed.placementId)).status).toBe("cancelled");

    expect(await deleteOrganization(w.host.orgId, "erasure request", "DELETE")).toEqual({ ok: false, error: "Workspace not found." });
    expect(await getAvailable(w.partner.orgId)).toEqual(FREE);
  });
});

describe("the administrator's record", () => {
  it("the audit entry says how many links went, once the deletion commits", async () => {
    const w = await world();
    await link(w, "drafted");
    await link(w, "pending", { onArticle: false });
    await link(w, "live", { requestStatus: "live" });

    expect((await adminDeleteWebsite(w.host.websiteId, "customer asked", "DELETE")).ok).toBe(true);

    const [entry] = await test.db.select().from(adminAuditLog).where(eq(adminAuditLog.targetId, w.host.websiteId));
    expect(entry.summary).toContain("2 unpublished links withdrawn");
    expect(entry.detail).toMatchObject({ releasedLinks: 2 });
  });
});

describe("a workspace with several websites", () => {
  it("gives up the links on all of them", async () => {
    const w = await world();
    const [second] = await test.db
      .insert(websites)
      .values({ organizationId: w.host.orgId, url: `https://two-${w.host.orgId}.example`, domain: `two-${w.host.orgId}.example`, status: "ready" })
      .returning();
    const first = await link(w, "drafted");
    const other = await link(w, "pending", { onArticle: false, hostWebsiteId: second.id });

    expect((await deleteOrganization(w.host.orgId, "erasure request", "DELETE")).ok).toBe(true);

    expect((await placementOf(first.placementId)).status).toBe("cancelled");
    expect((await placementOf(other.placementId)).status).toBe("cancelled");
    expect(await getAvailable(w.partner.orgId)).toEqual(FREE);
    const [entry] = await test.db.select().from(adminAuditLog).where(eq(adminAuditLog.targetId, w.host.orgId));
    expect(entry.detail).toMatchObject({ releasedLinks: 2 });
  });
});

describe("deleting an account", () => {
  it("reaches no workspace: the website and the link's hold stay as they are", async () => {
    const w = await world();
    const placed = await link(w, "drafted");
    const before = await snapshot(w, placed);
    const userId = (state.session as { user: { id: string } }).user.id;

    const result = await deleteUser(userId, "erasure request", "DELETE");

    expect(result.ok).toBe(true);
    expect(await snapshot(w, placed)).toEqual(before);

    // The workspace it leaves empty can still be deleted, by the guarded path.
    expect((await deleteOrganization(w.host.orgId, "orphaned", "DELETE")).ok).toBe(true);
    expect(await getAvailable(w.partner.orgId)).toEqual(FREE);
  });
});

describe("recordArticlePublication after the website has gone", () => {
  it("cannot bring a withdrawn link back", async () => {
    const w = await world();
    const placed = await link(w, "drafted");

    expect((await deleteWebsite(w.host.websiteId)).ok).toBe(true);
    await recordArticlePublication(w.article.id, "https://host.test/late", "publish");

    expect(await placementOf(placed.placementId)).toMatchObject({ status: "cancelled", liveUrl: null });
    expect(await getAvailable(w.partner.orgId)).toEqual(FREE);
  });
});
