import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import * as schema from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";
import { seedWebsite } from "@/test/fixtures";

/**
 * The admin sidebar's counts: each one counts what it says and nothing else,
 * one that fails shows nothing instead of breaking the admin, "new" starts
 * from when THIS administrator last opened the page, and nobody else can read
 * any of it.
 */

const state = vi.hoisted(() => ({ db: null as unknown, session: null as unknown, cookie: undefined as string | undefined }));
vi.mock("@/lib/db", () => ({ db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }) }));
vi.mock("@/lib/auth-guard", () => ({ getSession: async () => state.session }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (name === "admin_seen" && state.cookie ? { value: state.cookie } : undefined) }),
}));
vi.mock("@/lib/partners/server", () => ({ partnerDeps: () => ({ settings: { environment: () => "test" } }) }));

import { NextRequest } from "next/server";

import { GET, POST } from "@/app/(site)/admin/badges/route";
import { getAdminBadges, getBadgeNotice, NEW_SOURCES, WAITING_SOURCES } from "@/lib/admin/badges";
import { readSeen, SEEN_COOKIE, writeSeen } from "@/lib/admin/badges-seen";
import { assembleBadges, badgeNumber, noticeCount, SEEN_PATHS, seenPathOf, type AdminBadges } from "@/lib/admin/badges-shared";
import { listServiceOrders, markServiceOrderDelivered } from "@/lib/admin/service-orders";
import { getSocialPosting } from "@/lib/admin/social-posting";
import { ADMIN_NAV_ITEMS } from "@/app/(site)/admin/_ui/nav";

let test: TestDb;
const ADMIN = "admin@repget.test";
const asAdmin = { user: { id: "admin_user", email: ADMIN, emailVerified: true }, session: { id: "s", activeOrganizationId: null } };
const NOW = new Date();
const HOUR = 60 * 60 * 1000;
const ago = (hours: number) => new Date(NOW.getTime() - hours * HOUR);

beforeAll(async () => {
  vi.stubEnv("ADMIN_EMAILS", ADMIN);
  test = await createTestDb();
  state.db = test.db;
});

beforeEach(() => {
  state.session = asAdmin;
  state.cookie = undefined;
});

const read = (seen: Parameters<typeof getAdminBadges>[0] = {}) => getAdminBadges(seen, { fresh: true, now: new Date() });

/** What changed in one page's badge after adding rows. */
async function change(href: string, add: () => Promise<unknown>) {
  const before = (await read())[href];
  await add();
  const after = (await read())[href];
  return { waiting: (after?.waiting ?? 0) - (before?.waiting ?? 0), fresh: (after?.fresh ?? 0) - (before?.fresh ?? 0), detail: after?.detail ?? "" };
}

/** Rows whose parents do not matter here: foreign keys off for one insert. */
async function loose(work: () => Promise<unknown>) {
  await test.client.exec("set session_replication_role = replica");
  try {
    await work();
  } finally {
    await test.client.exec("set session_replication_role = default");
  }
}

describe("what waits for somebody", () => {
  it("website projects: to quote and to deliver, not quoted, delivered or declined", async () => {
    const { orgId } = await seedWebsite(test);
    const base = { organizationId: orgId, kind: "new", brief: "x", contactName: "x", contactEmail: "x@x.example" };
    const priced = { scope: "s", creditCost: 10 };
    const result = await change("/admin/website-projects", () =>
      test.db.insert(schema.websiteProjects).values([
        { ...base, requestKey: "1", status: "quote_requested" },
        { ...base, requestKey: "2", status: "quote_requested" },
        { ...base, requestKey: "3", status: "quoted", ...priced },
        { ...base, requestKey: "4", status: "paid", ...priced, creditsPaid: 10, paidAt: NOW },
        { ...base, requestKey: "5", status: "fulfilled", ...priced, creditsPaid: 10, paidAt: NOW },
        { ...base, requestKey: "6", status: "declined" },
      ]),
    );
    expect(result).toEqual({ waiting: 3, fresh: 0, detail: "2 to quote, 1 to deliver" });
  });

  it("feedback: unread only", async () => {
    const base = { kind: "idea", message: "m", email: "a@b.example", source: "website" };
    expect(
      await change("/admin/feedback", () => test.db.insert(schema.feedback).values([base, { ...base, status: "planned" }, { ...base, status: "done" }])),
    ).toMatchObject({ waiting: 1 });
  });

  it("Earn Credits: pending claims, and a story also on Success stories", async () => {
    const a = await seedWebsite(test);
    const base = { organizationId: a.orgId, message: "m", rewardCredits: 1 };
    const before = (await read())["/admin/success-stories"]?.waiting ?? 0;
    expect(
      await change("/admin/earn-credits", () =>
        test.db.insert(schema.earnSubmissions).values([
          { ...base, kind: "story" },
          { ...base, kind: "post" },
          { ...base, kind: "tutorial", status: "approved" },
          { ...base, kind: "feedback", status: "declined" },
        ]),
      ),
    ).toMatchObject({ waiting: 2 });
    expect((await read())["/admin/success-stories"].waiting).toBe(before + 1);
  });

  it("service orders: paid services, not credit packs, delivered ones or a website project's order; delivering one is recorded once", async () => {
    const { orgId } = await seedWebsite(test);
    const addon = async (kind: string) =>
      (await test.db.insert(schema.addons).values({ slug: `${kind}_${randomUUID()}`, name: "Citations", priceCents: 1, kind }).returning())[0].id;
    const service = await addon("service");
    const pack = await addon("credits");
    const base = { organizationId: orgId, pricePaidCents: 0, currency: "eur", creditsPaid: 250 };
    const project = randomUUID();
    await test.db.insert(schema.websiteProjects).values({
      id: project, organizationId: orgId, kind: "new", brief: "x", contactName: "x", contactEmail: "x@x.example", requestKey: "so", status: "paid", scope: "s", creditCost: 1, creditsPaid: 1, paidAt: NOW,
    });
    const order = randomUUID();
    expect(
      await change("/admin/service-orders", () =>
        test.db.insert(schema.addonPurchases).values([
          { ...base, id: order, addonId: service },
          { ...base, addonId: service, status: "fulfilled" },
          { ...base, addonId: pack },
          { ...base, id: project, addonId: service },
        ]),
      ),
    ).toMatchObject({ waiting: 1 });
    expect((await listServiceOrders()).filter((row) => row.status === "paid").map((row) => row.id)).toEqual([order]);
    expect((await markServiceOrderDelivered(order, "x")).ok).toBe(false);
    expect((await markServiceOrderDelivered(project, "Not here")).ok).toBe(false);
    expect((await markServiceOrderDelivered(order, "The list")).ok).toBe(true);
    expect((await markServiceOrderDelivered(order, "Again")).ok).toBe(false);
    expect((await read())["/admin/service-orders"]).toBeUndefined();
    const logged = await test.db.select().from(schema.adminAuditLog);
    expect(logged.filter((row) => row.action === "service_order.delivered")).toHaveLength(1);
  });

  it("Partner Network: articles held for review, not approved, published or unmanaged ones", async () => {
    const { websiteId } = await seedWebsite(test);
    const base = { websiteId, title: "t", bodyHtml: "<p>x</p>" };
    expect(
      await change("/admin/network", () =>
        test.db.insert(schema.articles).values([
          { ...base, status: "draft", reviewStatus: "pending" },
          { ...base, status: "draft", reviewStatus: "approved", reviewApprovedHash: "changed since" },
          { ...base, status: "draft" },
          { ...base, status: "published", reviewStatus: "pending", publishedUrl: "https://x.example/p" },
        ]),
      ),
    ).toMatchObject({ waiting: 2 });
  });

  it("Network Operations: deliveries with no known outcome, not one still running", async () => {
    const { websiteId } = await seedWebsite(test);
    const [article] = await test.db.insert(schema.articles).values({ websiteId, title: "t" }).returning();
    const [other] = await test.db.insert(schema.articles).values({ websiteId, title: "u" }).returning();
    const base = { websiteId, articleId: article.id, channel: "direct", trigger: "manual", revisionHash: "h", requestedStatus: "publish" };
    expect(
      await change("/admin/network/operations", () =>
        test.db.insert(schema.publicationDispatches).values([
          { ...base, status: "uncertain" },
          { ...base, status: "expired" },
          { ...base, status: "in_flight", claimedAt: ago(1) },
          { ...base, articleId: other.id, status: "in_flight", claimedAt: new Date() },
          { ...base, status: "sent" },
          { ...base, status: "failed" },
        ]),
      ),
    ).toMatchObject({ waiting: 3 });
  });

  it("articles that failed recently, and websites whose analysis failed", async () => {
    const { websiteId, orgId } = await seedWebsite(test);
    expect(
      await change("/admin/articles", () =>
        test.db.insert(schema.articles).values([
          { websiteId, title: "t", status: "failed" },
          { websiteId, title: "t", status: "failed", updatedAt: ago(24 * 40) },
          { websiteId, title: "t", status: "draft" },
        ]),
      ),
    ).toMatchObject({ waiting: 1 });
    expect(
      await change("/admin/websites", () => test.db.insert(schema.websites).values({ organizationId: orgId, url: "https://f.example", domain: "f.example", status: "failed" })),
    ).toMatchObject({ waiting: 1, fresh: 1 });
  });

  it("the blog: paid Get Featured requests, failed autopilot topics and new comments", async () => {
    const base = { postSlug: "p", email: "a@b.example", websiteUrl: "https://b.example", message: "m" };
    const result = await change("/admin/blog", async () => {
      await test.db.insert(schema.blogSponsorships).values([{ ...base, status: "paid" }, { ...base, status: "pending" }, { ...base, status: "published" }]);
      await test.db.insert(schema.blogAutopilotTopics).values([{ topic: "a", status: "failed" }, { topic: "b" }]);
      await loose(() =>
        test.db.insert(schema.blogComments).values([
          { postId: randomUUID(), discussionId: randomUUID(), userId: "u", body: "new" },
          { postId: randomUUID(), discussionId: randomUUID(), userId: "u", body: "old", createdAt: ago(100) },
          { postId: randomUUID(), discussionId: randomUUID(), userId: "u", body: "gone", removedAt: new Date() },
        ]),
      );
    });
    expect(result).toEqual({ waiting: 2, fresh: 1, detail: "1 paid Get Featured requests, 1 failed autopilot topics, 1 new comments" });
  });

  it("social posting: paused accounts and recent failures, with the reason on the page", async () => {
    const { websiteId } = await seedWebsite(test);
    const result = await change("/admin/social-posting", async () => {
      await test.db.insert(schema.socialAccounts).values([
        { websiteId, platform: "x", username: "a", pausedAt: NOW, pausedReason: "Plan limit reached", warmupEndsAt: NOW },
        { websiteId, platform: "threads", username: "b", warmupEndsAt: NOW },
      ]);
      await test.db.insert(schema.socialSuggestions).values([
        { websiteId, platform: "x", kind: "post", day: "2026-11-24", body: "b", status: "failed", error: "refused" },
        { websiteId, platform: "x", kind: "post", day: "2026-11-24", body: "c", status: "failed", updatedAt: ago(100) },
        { websiteId, platform: "x", kind: "post", day: "2026-11-24", body: "d", status: "new" },
        // Put back to be posted by hand: its customer sees no failure, the team does.
        { websiteId, platform: "x", kind: "post", day: "2026-11-24", body: "e", status: "new", error: "refused" },
      ]);
      await test.db.insert(schema.videoIdeas).values([
        { websiteId, day: "2026-11-24", style: "s", language: "en", title: "v", script: {}, caption: "c", status: "failed" },
        { websiteId, day: "2026-11-24", style: "s", language: "en", title: "w", script: {}, caption: "c", status: "ready" },
        { websiteId, day: "2026-11-24", style: "s", language: "en", title: "y", script: {}, caption: "c", status: "ready", error: "TikTok: refused" },
        { websiteId, day: "2026-11-24", style: "s", language: "en", title: "z", script: {}, caption: "c", status: "ready", error: "no_accounts" },
      ]);
    });
    expect(result).toMatchObject({ waiting: 1, fresh: 4 });
    const page = await getSocialPosting();
    expect(page.paused[0]).toMatchObject({ platform: "x", reason: "Plan limit reached" });
    expect(page.failed.map((row) => row.title)).toEqual(expect.arrayContaining(["b", "v", "c", "e", "y"]));
    expect(page.failed.map((row) => row.title)).not.toContain("z");
  });

  it("the affiliate program: applications, review cases, commissions, payouts and failed events, in this environment only", async () => {
    const before = await read();
    const at = (href: string) => before[href]?.waiting ?? 0;
    const app = { answers: {}, applicantEmail: "a@b.example", applicantName: "A", submittedAt: NOW };
    await test.db.insert(schema.partnerApplications).values([app, { ...app, status: "approved" }]);
    await test.db.insert(schema.partnerReviewCases).values([
      { kind: "fraud", dedupeKey: "1", summary: "s" },
      { kind: "fraud", dedupeKey: "2", summary: "s", status: "resolved" },
    ]);
    const event = { environment: "test", eventType: "x", objectId: "o", eventCreatedAt: NOW };
    await test.db.insert(schema.partnerProviderEvents).values([{ ...event, stripeEventId: "e1", status: "failed" }, { ...event, stripeEventId: "e2" }]);
    const ids = () => ({ partnerId: randomUUID(), attributionId: randomUUID(), paymentFactId: randomUUID(), programVersionId: randomUUID() });
    const commission = (over: Record<string, unknown>) => ({
      environment: "test", currency: "eur", baseAmount: BigInt(100), rateBasisPoints: 1000, tierKey: "t", amount: BigInt(10), programVersion: 1, earnedAt: NOW, maturesAt: NOW, ...ids(), ...over,
    });
    await loose(async () => {
      await test.db.insert(schema.partnerCommissions).values([
        commission({ reviewState: "needs_review" }),
        commission({ reviewState: "needs_review", environment: "live" }),
        commission({}),
      ] as never);
      const settlement = (over: Record<string, unknown>) => ({
        environment: "test", partnerId: randomUUID(), currency: "eur", runKey: randomUUID(), grossAmount: BigInt(10), offsetAmount: BigInt(0), transferAmount: BigInt(10), transferGroup: randomUUID(), payoutMethod: "credits", createdBy: "x", ...over,
      });
      await test.db.insert(schema.partnerSettlements).values([
        settlement({ state: "needs_review" }),
        settlement({ state: "payout_failed" }),
        settlement({ state: "reserved" }),
        settlement({ state: "needs_review", environment: "live" }),
      ] as never);
    });
    const after = await read();
    expect(after["/admin/partners/applications"].waiting - at("/admin/partners/applications")).toBe(1);
    expect(after["/admin/partners/reviews"].waiting - at("/admin/partners/reviews")).toBe(1);
    expect(after["/admin/partners"].waiting - at("/admin/partners")).toBe(1);
    expect(after["/admin/partners/commissions"].waiting - at("/admin/partners/commissions")).toBe(1);
    expect(after["/admin/partners/payouts"].waiting - at("/admin/partners/payouts")).toBe(2);
  });
});

describe("a page's own account of its badge (Daniel, 2026-11-26: 2 on Blog, nothing new on the page)", () => {
  it("Admin -> Blog lists exactly what its badge counts, each with where it is dealt with", async () => {
    const base = { postSlug: "p", email: "a@b.example", websiteUrl: "https://b.example", message: "m" };
    await test.db.insert(schema.blogSponsorships).values({ ...base, status: "paid" });
    await test.db.insert(schema.blogAutopilotTopics).values({ topic: "could not be written", status: "failed" });
    // Times from this clock, not the database's default, so the cookie below is surely later.
    await test.db.delete(schema.blogComments);
    await loose(() => test.db.insert(schema.blogComments).values({ postId: randomUUID(), discussionId: randomUUID(), userId: "u", body: "new", createdAt: ago(1) }));

    const badge = (await read())["/admin/blog"];
    const notice = await getBadgeNotice("/admin/blog");
    expect(notice.reduce((sum, item) => sum + item.count, 0)).toBe(badge.count);
    expect(notice.map((item) => [item.kind, item.what, item.href])).toEqual([
      ["waiting", "paid Get Featured requests", "/admin/blog/sponsorships"],
      ["waiting", "failed autopilot topics", "/admin/blog/autopilot#failed-topics"],
      ["new", "new comments", "/admin/blog/comments"],
    ]);
    expect(noticeCount({ count: 1, what: "failed autopilot topics", one: "failed autopilot topic" })).toBe("1 failed autopilot topic");
    expect(noticeCount({ count: 2, what: "failed autopilot topics", one: "failed autopilot topic" })).toBe("2 failed autopilot topics");

    // The comments opened: their line goes, as the badge's count does.
    state.cookie = writeSeen({}, asAdmin.user.id, "/admin/blog/comments");
    expect((await getBadgeNotice("/admin/blog")).map((item) => item.what)).toEqual(["paid Get Featured requests", "failed autopilot topics"]);
    // A failed topic removed (or tried again) no longer counts.
    await test.db.delete(schema.blogAutopilotTopics).where(eq(schema.blogAutopilotTopics.status, "failed"));
    await test.db.delete(schema.blogSponsorships).where(eq(schema.blogSponsorships.status, "paid"));
    expect(await getBadgeNotice("/admin/blog")).toEqual([]);
  });

  it("explains every count of the Blog badge, and nothing for a page without one", async () => {
    for (const source of [...WAITING_SOURCES, ...NEW_SOURCES].filter((entry) => entry.href === "/admin/blog")) expect(source.handled, source.what).toBeDefined();
    expect(await getBadgeNotice("/admin/nothing-here")).toEqual([]);
  });

  it("is for administrators only", async () => {
    state.session = null;
    await expect(getBadgeNotice("/admin/blog")).rejects.toThrow();
  });
});

describe("what is new since the page was last opened", () => {
  it("counts from that moment, per page", async () => {
    const { orgId } = await seedWebsite(test);
    const id = `u_${randomUUID()}`;
    await test.db.insert(schema.user).values({ id, name: "N", email: `${id}@x.example`, createdAt: new Date() });
    await test.db.insert(schema.payments).values({ organizationId: orgId, provider: "stripe", externalId: randomUUID(), amountCents: 1, currency: "eur", status: "paid", paidAt: NOW, createdAt: NOW });
    await test.db.insert(schema.freePlanAccounts).values({ organizationId: orgId, domain: `${id}.example` });
    const fresh = await read();
    for (const href of ["/admin/users", "/admin/payments", "/admin/free-plan", "/admin/organizations", "/admin/websites"]) {
      expect(fresh[href].fresh, href).toBeGreaterThan(0);
    }
    const later = new Date(Date.now() + HOUR);
    const opened = await read({ "/admin/users": later });
    expect(opened["/admin/users"]).toBeUndefined();
    expect(opened["/admin/payments"].fresh).toBe(fresh["/admin/payments"].fresh);
  });

  it("with no record of opening it, the last day is new", async () => {
    const before = (await read())["/admin/users"]?.fresh ?? 0;
    const id = `u_${randomUUID()}`;
    await test.db.insert(schema.user).values({ id, name: "Old", email: `${id}@x.example`, createdAt: ago(48) });
    expect((await read())["/admin/users"]?.fresh ?? 0).toBe(before);
  });
});

describe("failing soft", () => {
  it("a count that cannot be read shows no badge, and the others stay", async () => {
    await test.db.insert(schema.feedback).values({ kind: "idea", message: "m", email: "a@b.example", source: "website" });
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    await test.client.exec('alter table "user" rename to "user_away"');
    try {
      const badges = await read();
      expect(badges["/admin/users"]).toBeUndefined();
      expect(badges["/admin/feedback"].waiting).toBeGreaterThan(0);
      expect(errors).toHaveBeenCalled();
    } finally {
      await test.client.exec('alter table "user_away" rename to "user"');
      errors.mockRestore();
    }
  });

  it("remembers what waits for a few seconds, and reads again when asked to", async () => {
    const now = new Date();
    const first = await getAdminBadges({}, { fresh: true, now });
    await test.db.insert(schema.feedback).values({ kind: "idea", message: "m", email: "a@b.example", source: "website" });
    expect((await getAdminBadges({}, { now: new Date(now.getTime() + 5_000) }))["/admin/feedback"]).toEqual(first["/admin/feedback"]);
    expect((await getAdminBadges({}, { fresh: true, now }))["/admin/feedback"].waiting).toBe(first["/admin/feedback"].waiting + 1);
  });
});

describe("the address", () => {
  const request = (method: "GET" | "POST", body?: unknown) =>
    new NextRequest("https://www.repget.com/admin/badges?fresh=1", { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

  it("does not exist for anybody else", async () => {
    for (const session of [null, { ...asAdmin, user: { ...asAdmin.user, email: "a@b.example" } }, { ...asAdmin, user: { ...asAdmin.user, emailVerified: false } }]) {
      state.session = session;
      expect((await GET(request("GET"))).status).toBe(404);
      expect((await POST(request("POST", { path: "/admin/users" }))).status).toBe(404);
      await expect(getAdminBadges({})).rejects.toThrow("Not found");
    }
  });

  it("opening a page clears its new count, in an httpOnly cookie limited to the admin", async () => {
    const id = `u_${randomUUID()}`;
    await test.db.insert(schema.user).values({ id, name: "N", email: `${id}@x.example`, createdAt: new Date(Date.now() - 5000) });
    expect(((await (await GET(request("GET"))).json()) as AdminBadges)["/admin/users"].fresh).toBeGreaterThan(0);
    const response = await POST(request("POST", { path: "/admin/users" }));
    expect(((await response.json()) as AdminBadges)["/admin/users"]).toBeUndefined();
    const cookie = response.cookies.get(SEEN_COOKIE)!;
    expect(cookie).toMatchObject({ httpOnly: true, path: "/admin", sameSite: "lax" });
    state.cookie = cookie.value;
    expect(((await (await GET(request("GET"))).json()) as AdminBadges)["/admin/users"]).toBeUndefined();
  });

  it("sets no cookie for a page with nothing to clear, or a body it does not understand", async () => {
    expect((await POST(request("POST", { path: "/admin/network" }))).cookies.get(SEEN_COOKIE)).toBeUndefined();
    expect((await POST(request("POST", { path: 5 }))).status).toBe(200);
    expect((await POST(new NextRequest("https://www.repget.com/admin/badges", { method: "POST", body: "{" }))).status).toBe(200);
  });
});

describe("the cookie", () => {
  it("belongs to one administrator, and anything malformed reads as never opened", () => {
    const value = writeSeen({}, "admin_user", "/admin/users", ago(2));
    expect(readSeen(value, "admin_user")["/admin/users"]?.getTime()).toBe(ago(2).getTime());
    expect(readSeen(value, "someone_else")).toEqual({});
    for (const bad of [undefined, "", "x", "null", "[]", '{"u":"admin_user"}', '{"u":"admin_user","t":{"/admin/users":"soon"}}', "x".repeat(5000)]) {
      expect(readSeen(bad, "admin_user")).toEqual({});
    }
    // A clock set wrong must not hide everything that arrives from now on.
    expect(readSeen(writeSeen({}, "admin_user", "/admin/users", new Date(Date.now() + 24 * HOUR)), "admin_user")).toEqual({});
  });

  it("fits in a cookie with every page opened", () => {
    let value = "";
    for (const path of SEEN_PATHS) value = writeSeen(readSeen(value, "a".repeat(40)), "a".repeat(40), path);
    expect(Object.keys(readSeen(value, "a".repeat(40)))).toHaveLength(SEEN_PATHS.length);
    expect(encodeURIComponent(value).length).toBeLessThan(1500);
  });
});

describe("the words", () => {
  it("add up per page, and cap at 99+", () => {
    expect(
      assembleBadges([
        { href: "/a", kind: "waiting", what: "to quote", count: 2 },
        { href: "/a", kind: "new", what: "new", count: 1 },
        { href: "/b", kind: "new", what: "new", count: 3 },
        { href: "/c", kind: "waiting", what: "x", count: 0 },
      ]),
    ).toEqual({
      "/a": { count: 3, waiting: 2, fresh: 1, text: "2 waiting, 1 new", detail: "2 to quote, 1 new" },
      "/b": { count: 3, waiting: 0, fresh: 3, text: "3 new", detail: "3 new" },
    });
    expect([1, 99, 100, 4000].map(badgeNumber)).toEqual(["1", "99", "99+", "99+"]);
  });

  it("every badge belongs to a page in the sidebar, and every page that clears one is counted", () => {
    const hrefs = new Set(ADMIN_NAV_ITEMS.map((item) => item.href));
    for (const source of [...WAITING_SOURCES, ...NEW_SOURCES]) expect(hrefs.has(source.href), source.href).toBe(true);
    expect(new Set(NEW_SOURCES.map((source) => source.seen))).toEqual(new Set(SEEN_PATHS));
  });

  it("knows which page a path opens", () => {
    expect(seenPathOf("/admin/users")).toBe("/admin/users");
    expect(seenPathOf("/admin/blog/comments")).toBe("/admin/blog/comments");
    expect(seenPathOf("/admin/blog")).toBeNull();
    expect(seenPathOf("/admin/userspace")).toBeNull();
  });
});

