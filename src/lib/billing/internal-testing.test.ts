import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { and, eq } from "drizzle-orm";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { agencyWorkspaces, audits, creditLedger, creditSettings, creditSpends, geoPrompts, plans, socialAccounts, socialSuggestions, socialTeams, subscriptions, websites } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";
import { seedWebsite } from "@/test/fixtures";

/**
 * Internal testing access (the owner's decision, 2026-11-05) on a real in-process
 * database, through the real actions and jobs: a listed website with no
 * subscription gets audits and social tools; nothing else opens, nothing else in
 * the workspace changes, and nothing is posted by itself.
 */

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }),
}));
async function contextFor(websiteId: string) {
  const db = state.db as TestDb["db"];
  const [site] = await db.select().from(websites).where(eq(websites.id, websiteId));
  return { site, orgId: site.organizationId, ownerOrgId: site.organizationId, userId: "owner", access: "owner" as const };
}
vi.mock("@/lib/tenant", () => ({ requireWebsite: vi.fn(contextFor) }));
vi.mock("@/lib/websites/require-editor", () => ({
  requireEditor: vi.fn(async (id: string) => ({ ok: true, context: await contextFor(id) })),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((to: string) => {
    throw new Error(`redirect ${to}`);
  }),
}));
vi.mock("@/lib/i18n/app-locale", async () => {
  const { getMessages } = await import("@/lib/i18n/messages");
  return { getAppMessages: async () => ({ t: getMessages("en"), locale: "en" }) };
});
const inngestMock = vi.hoisted(() => ({
  send: vi.fn(),
  createFunction: vi.fn((config: unknown, handler: unknown) => ({ config, handler })),
}));
vi.mock("@/inngest/client", () => ({ inngest: inngestMock }));
vi.mock("@/lib/notifications/create", () => ({ notify: vi.fn() }));
vi.mock("@/lib/ai/client", () => ({
  anthropic: { messages: { create: vi.fn() } },
  isAiConfigured: () => true,
  MODELS: { GENERATION: "claude-sonnet-5" },
}));
vi.mock("@/lib/providers/dataforseo", () => ({ isDataForSeoConfigured: () => false, discussionSearch: vi.fn() }));
const crawler = vi.hoisted(() => ({ crawlSite: vi.fn() }));
vi.mock("@/lib/audit/crawler", () => crawler);
const usageTrack = vi.hoisted(() => ({ track: vi.fn() }));
vi.mock("@/lib/usage", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/usage")>()), track: usageTrack.track }));

import { auditWebsite } from "@/inngest/functions/audit-website";
import { startAudit } from "@/lib/audit/actions";
import { isEntitledToSpend, requireEntitledForSpend } from "@/lib/billing/entitled";
import { requireWebsitePlan } from "@/lib/billing/require-plan";
import { requestBacklink } from "@/lib/backlinks/actions";
import { listChatThreads } from "@/lib/chat/actions";
import { runGeoCheck } from "@/lib/geo/actions";
import { socialAccess } from "@/lib/social/accounts";
import { connectSocialUsername, findSocialSuggestions, postSocialSuggestion, startSocialConnect } from "@/lib/social/actions";
import { publishSuggestion } from "@/lib/social/publish";
import { suggestForWebsite } from "@/lib/social/suggest";
import { checkLimit } from "@/lib/usage";
import { videoAccess } from "@/lib/video/settings";

let test: TestDb;
beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});

beforeEach(() => {
  inngestMock.send.mockReset();
  inngestMock.send.mockResolvedValue({ ids: [] });
  crawler.crawlSite.mockReset();
  vi.stubGlobal("fetch", vi.fn(async () => {
    throw new Error("nothing may be sent to a platform");
  }));
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

/** A workspace like Daniel's: a paid website, and a second one with no subscription. */
async function workspace(options: { firstSite?: string | null } = {}) {
  const paid = await seedWebsite(test, { status: options.firstSite === undefined ? "active" : options.firstSite });
  const add = async (domain: string) =>
    (
      await test.db
        .insert(websites)
        .values({ organizationId: paid.orgId, url: `https://${domain}`, domain, status: "ready", brandName: "RepGet", language: "English", country: "Ireland" })
        .returning()
    )[0];
  const listed = await add(`listed-${paid.websiteId.slice(0, 8)}.example`);
  const sibling = await add(`sibling-${paid.websiteId.slice(0, 8)}.example`);
  return { orgId: paid.orgId, paidId: paid.websiteId, listed, sibling };
}

const list = (...ids: string[]) => vi.stubEnv("INTERNAL_TEST_WEBSITE_IDS", ids.join(", "));
const AUDIT_AND_SOCIAL = { freeArticles: true, internalTesting: true };

async function runAuditJobToCrawl(data: unknown) {
  const job = auditWebsite as unknown as { handler: (ctx: unknown) => Promise<unknown> };
  crawler.crawlSite.mockRejectedValue(new Error("crawl reached"));
  return job.handler({
    event: { data },
    step: { run: (_: string, fn: () => unknown) => fn() },
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  });
}

async function account(websiteId: string, platform: string, options: { bundle?: boolean } = {}) {
  await test.db.insert(socialAccounts).values({
    websiteId,
    platform,
    username: `${platform}_user`,
    bundleAccountId: options.bundle ? `acc_${platform}` : null,
    warmupEndsAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
  });
}

const writesOnePost = vi.fn(async () => ({
  drafts: { posts: [{ slot: 1, title: null, body: "Shade beats golden hour." }], replies: [] },
  usage: { inputTokens: 1, outputTokens: 1, model: "claude-sonnet-5" },
}));

describe("a listed website with no subscription", () => {
  it("runs an audit: the action queues it and the job's own check, inside the paid step, lets it crawl", async () => {
    const { listed } = await workspace();
    list(listed.id);
    expect(await startAudit(listed.id)).toEqual({ ok: true, data: null });
    const data = inngestMock.send.mock.calls[0][0].data;
    expect(data.websiteId).toBe(listed.id);
    await expect(runAuditJobToCrawl(data)).rejects.toThrow("crawl reached");
    expect(crawler.crawlSite).toHaveBeenCalledTimes(1);
  });

  it("uses the social tools on all six platforms", async () => {
    const { listed } = await workspace();
    list(listed.id);
    const access = await socialAccess(listed.id);
    expect(access).toMatchObject({ level: "paid", manualOnly: true });
    expect(access.platforms).toHaveLength(6);
    expect(await connectSocialUsername(listed.id, "quora", "repget")).toEqual({ ok: true, data: null });
    expect(await findSocialSuggestions(listed.id)).toEqual({ ok: true, data: null });
  });

  it("charges what is priced to the workspace's wallet, and refuses when it is short", async () => {
    const { listed, orgId } = await workspace();
    list(listed.id);
    await test.db.delete(creditSettings);
    await test.db.insert(creditSettings).values([
      { key: "price:audit_rerun", value: 5 },
      { key: "price:social_post", value: 1 },
    ]);
    try {
      await test.db.insert(audits).values({ websiteId: listed.id, score: 80 });
      await account(listed.id, "x");
      const [row] = await test.db
        .insert(socialSuggestions)
        .values({ websiteId: listed.id, platform: "x", kind: "post", day: "2026-11-06", body: "Shade beats golden hour." })
        .returning();
      expect(await startAudit(listed.id)).toMatchObject({ ok: false, error: expect.stringContaining("This costs 5 credits") });
      expect(await postSocialSuggestion(listed.id, row.id, { body: row.body })).toMatchObject({ ok: false, error: "not_enough_credits" });

      await test.db.insert(creditLedger).values({ organizationId: orgId, type: "purchase", amount: 6 });
      expect((await startAudit(listed.id)).ok).toBe(true);
      expect((await postSocialSuggestion(listed.id, row.id, { body: row.body })).ok).toBe(true);
      const spends = await test.db.select().from(creditSpends).where(eq(creditSpends.organizationId, orgId));
      expect(spends.map((spend) => spend.credits).sort()).toEqual([1, 5]);
    } finally {
      await test.db.delete(creditSettings);
    }
  });
});

describe("nothing goes out by itself", () => {
  it("a connected account's own post waits for a click, where a paid website's would be scheduled", async () => {
    const { listed, paidId } = await workspace();
    list(listed.id);
    vi.stubEnv("BUNDLE_SOCIAL_API_KEY", "test-key");
    await account(listed.id, "x", { bundle: true });
    await account(paidId, "x", { bundle: true });
    await test.db.update(websites).set({ brandName: "Studio", language: "English" }).where(eq(websites.id, paidId));

    const here = await suggestForWebsite(listed.id, { write: writesOnePost });
    expect(here).toMatchObject({ created: 1, scheduled: [] });
    const [row] = await test.db.select().from(socialSuggestions).where(eq(socialSuggestions.websiteId, listed.id));
    expect(row).toMatchObject({ status: "new", scheduledFor: null });

    // The same code, the same account settings, on the website that has a plan.
    expect((await suggestForWebsite(paidId, { write: writesOnePost })).scheduled).toHaveLength(1);
  });

  it("the publishing job hands a post back instead of sending it, even if one were scheduled", async () => {
    const { listed, orgId } = await workspace();
    list(listed.id);
    vi.stubEnv("BUNDLE_SOCIAL_API_KEY", "test-key");
    await account(listed.id, "x", { bundle: true });
    await test.db.insert(socialTeams).values({ websiteId: listed.id, teamId: "team_listed" });
    const [row] = await test.db
      .insert(socialSuggestions)
      .values({ websiteId: listed.id, platform: "x", kind: "post", day: "2026-11-06", body: "Shade beats golden hour.", status: "scheduled", scheduledFor: new Date() })
      .returning();

    expect(await publishSuggestion(row.id)).toBe("skipped");
    expect(fetch).not.toHaveBeenCalled();
    const [after] = await test.db.select().from(socialSuggestions).where(eq(socialSuggestions.id, row.id));
    expect(after).toMatchObject({ status: "new", scheduledFor: null, bundlePostId: null });
    expect(await test.db.select().from(creditSpends).where(eq(creditSpends.organizationId, orgId))).toEqual([]);
  });
});

describe("the scope", () => {
  it("an unlisted website in the same workspace is refused, audits and social alike", async () => {
    const { listed, sibling } = await workspace();
    list(listed.id);
    expect(await startAudit(sibling.id)).toEqual({ ok: false, error: "Choose a plan for this website first" });
    expect(await socialAccess(sibling.id)).toEqual({ level: "none", platforms: [] });
    expect(await connectSocialUsername(sibling.id, "quora", "someone")).toEqual({ ok: false, error: "no_plan" });
    await expect(requireEntitledForSpend(sibling.id, AUDIT_AND_SOCIAL)).rejects.toThrow(/subscription is not active/);
    expect(inngestMock.send).not.toHaveBeenCalled();
  });

  it("a listed website is refused for everything that does not ask for this", async () => {
    const { listed } = await workspace();
    list(listed.id);

    // Articles and keywords: the check their paths make, and their limits.
    expect((await isEntitledToSpend(listed.id, { freeArticles: true })).ok).toBe(false);
    await expect(requireEntitledForSpend(listed.id, { freeArticles: true })).rejects.toThrow(/subscription is not active/);
    expect(await checkLimit(listed.id, "articles")).toMatchObject({ allowed: false, reason: "no_active_plan" });
    expect(await checkLimit(listed.id, "keywords")).toMatchObject({ allowed: false, reason: "no_active_plan" });

    // AI visibility.
    await test.db.insert(geoPrompts).values({ websiteId: listed.id, prompt: "Who is good at this?", active: true });
    expect(await runGeoCheck(listed.id)).toEqual({ ok: false, error: "Choose a plan for this website first" });

    // Backlinks and the Partner Network.
    expect(await requestBacklink(listed.id, { targetUrl: `https://${listed.domain}/page` })).toMatchObject({ ok: false });

    // Chat's paid level (and its trial level).
    expect(await listChatThreads(listed.id)).toEqual({ ok: false, error: "no_plan" });

    // Videos, which share social accounts.
    expect(await videoAccess(listed.id)).toBe("none");
  });

  it("only the audit and social paths ask for it", () => {
    const root = path.resolve("src");
    const found: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const file = path.join(dir, name);
        if (statSync(file).isDirectory()) walk(file);
        else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) && /internalTesting: true/.test(readFileSync(file, "utf8").replace(/^\s*\*.*$/gm, ""))) {
          found.push(path.relative(root, file).replaceAll("\\", "/"));
        }
      }
    };
    walk(root);
    expect(found.sort()).toEqual([
      "app/(site)/(app)/websites/[websiteId]/page.tsx",
      "app/(site)/(app)/websites/[websiteId]/social/page.tsx",
      "inngest/functions/audit-website.ts",
      "lib/audit/actions.ts",
      "lib/social/accounts.ts",
    ]);
  });

  it.each([[undefined], [""], [" , "]])("with the variable %j, it refuses everything", async (value) => {
    const { listed } = await workspace();
    vi.stubEnv("INTERNAL_TEST_WEBSITE_IDS", value);
    expect(await startAudit(listed.id)).toEqual({ ok: false, error: "Choose a plan for this website first" });
    expect(await isEntitledToSpend(listed.id, AUDIT_AND_SOCIAL)).toMatchObject({ ok: false });
    expect(await socialAccess(listed.id)).toEqual({ level: "none", platforms: [] });
  });

  it("a website with an inactive subscription stays refused, with its plan or without one", async () => {
    const { listed, sibling, orgId } = await workspace();
    list(listed.id, sibling.id);
    const [plan] = await test.db.select({ id: plans.id }).from(plans).limit(1);
    await test.db.insert(subscriptions).values([
      { organizationId: orgId, websiteId: listed.id, provider: "stripe", status: "canceled", planId: plan.id },
      // checkLimit calls this one "no_active_plan": the row is what refuses it.
      { organizationId: orgId, websiteId: sibling.id, provider: "stripe", status: "canceled", planId: null },
    ]);
    expect(await startAudit(listed.id)).toEqual({ ok: false, error: "This website's subscription is not active. Update billing to continue." });
    expect(await socialAccess(listed.id)).toEqual({ level: "none", platforms: [] });
    expect(await startAudit(sibling.id)).toEqual({ ok: false, error: "Choose a plan for this website first" });
    expect(await socialAccess(sibling.id)).toEqual({ level: "none", platforms: [] });
  });

  it("a cancellation after the audit was queued stops the job at its own check", async () => {
    const { listed, orgId } = await workspace();
    list(listed.id);
    expect((await startAudit(listed.id)).ok).toBe(true);
    await test.db.insert(subscriptions).values({ organizationId: orgId, websiteId: listed.id, provider: "stripe", status: "canceled" });
    await expect(runAuditJobToCrawl(inngestMock.send.mock.calls[0][0].data)).rejects.toThrow(/subscription is not active/);
    expect(crawler.crawlSite).not.toHaveBeenCalled();
  });

  it("a listed website that has its own plan just has its plan, auto-posting included", async () => {
    const { websiteId } = await seedWebsite(test);
    list(websiteId);
    const access = await socialAccess(websiteId);
    expect(access.level).toBe("paid");
    expect(access.manualOnly).toBeUndefined();
  });

  it("writes no subscription, credits or agency row, and leaves the paid website alone", async () => {
    const { listed, orgId, paidId } = await workspace();
    list(listed.id);
    await startAudit(listed.id);
    await socialAccess(listed.id);
    await isEntitledToSpend(listed.id, AUDIT_AND_SOCIAL);

    const own = await test.db.select().from(subscriptions).where(eq(subscriptions.organizationId, orgId));
    expect(own.map((row) => row.websiteId)).toEqual([paidId]);
    expect(await test.db.select().from(creditLedger).where(eq(creditLedger.organizationId, orgId))).toEqual([]);
    expect(await test.db.select().from(creditSpends).where(eq(creditSpends.organizationId, orgId))).toEqual([]);
    expect(await test.db.select().from(agencyWorkspaces).where(eq(agencyWorkspaces.organizationId, orgId))).toEqual([]);
    expect(await socialAccess(paidId)).toMatchObject({ level: "paid" });
    expect((await socialAccess(paidId)).manualOnly).toBeUndefined();
  });
});

describe("the pages' paywall", () => {
  const owner = (site: typeof websites.$inferSelect) => ({ access: "owner" as const, ownerOrgId: site.organizationId, site } as never);

  it("does not bounce an owner on a site without a plan while another site's plan is live, opted in or not", async () => {
    const { listed, sibling } = await workspace();
    list(listed.id);
    await expect(requireWebsitePlan(owner(listed), { internalTesting: true })).resolves.toBeUndefined();
    await expect(requireWebsitePlan(owner(sibling))).resolves.toBeUndefined();
  });

  it("when the workspace's plan lapses: open for a listed site on the opted-in pages only", async () => {
    const { listed, sibling } = await workspace({ firstSite: "canceled" });
    list(listed.id);
    await expect(requireWebsitePlan(owner(listed), { internalTesting: true })).resolves.toBeUndefined();
    // Every other page of the same website, and the unlisted site on the same pages.
    await expect(requireWebsitePlan(owner(listed))).rejects.toThrow(/redirect \/onboarding\/plan/);
    await expect(requireWebsitePlan(owner(sibling), { internalTesting: true })).rejects.toThrow(/redirect \/onboarding\/plan/);
  });

  it("a guest on a listed site follows the same scope", async () => {
    const { listed, sibling } = await workspace();
    list(listed.id);
    const guest = (site: typeof websites.$inferSelect) => ({ access: "editor" as const, ownerOrgId: site.organizationId, site } as never);
    await expect(requireWebsitePlan(guest(listed), { internalTesting: true })).resolves.toBeUndefined();
    await expect(requireWebsitePlan(guest(listed))).rejects.toThrow(/redirect \/dashboard/);
    await expect(requireWebsitePlan(guest(sibling), { internalTesting: true })).rejects.toThrow(/redirect \/dashboard/);
  });
});

describe("connecting", () => {
  it("goes as far as bundle.social's own page, and no further here", async () => {
    const { listed } = await workspace();
    list(listed.id);
    // No key: refused for that reason, past the access check, nothing sent.
    vi.stubEnv("BUNDLE_SOCIAL_API_KEY", "");
    expect(await startSocialConnect(listed.id, "x")).toEqual({ ok: false, error: "not_configured" });
    expect(await test.db.select().from(socialAccounts).where(and(eq(socialAccounts.websiteId, listed.id), eq(socialAccounts.platform, "x")))).toEqual([]);
  });
});
