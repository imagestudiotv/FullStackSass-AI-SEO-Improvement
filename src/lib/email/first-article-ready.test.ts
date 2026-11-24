import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { member, organization, user } from "@/lib/db/auth-tables";
import { articles, articleVersions, integrations, lifecycleEmails, platformControls, websites } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";

/**
 * "Your first article is ready to publish" (client, 2026-11-24): once per
 * website, free or paid, when the customer can open and read the article -
 * after the RepGet team's approval when it is held - and never about an old one.
 */

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({ db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }) }));
const sent = vi.hoisted(() => ({
  sendEmail: vi.fn<(options: { to: string; subject: string; text: string; html: string; headers?: Record<string, string> }) => Promise<{ ok: true; id: string }>>(async () => ({ ok: true as const, id: "msg" })),
}));
vi.mock("@/lib/email/send", () => sent);
vi.mock("@/inngest/send", () => ({ queueJob: vi.fn(async () => true) }));
vi.mock("@/inngest/client", () => ({ inngest: { send: vi.fn(), createFunction: vi.fn() } }));
vi.mock("@/lib/plugin/sync", () => ({ nudgePluginIfDue: vi.fn(async () => "nothing-due") }));

import { notifyReady } from "@/lib/articles/release";
import { LIFECYCLE_CONTROL_KEY, setTips } from "@/lib/email/lifecycle";
import { emailFirstArticleReady } from "@/lib/email/lifecycle-triggers";

process.env.BETTER_AUTH_SECRET = "test-secret-for-unsubscribe-links";

let test: TestDb;
beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});
const control = (key: string, enabled: boolean) =>
  test.db.insert(platformControls).values({ key, enabled }).onConflictDoUpdate({ target: platformControls.key, set: { enabled } });
beforeEach(async () => {
  sent.sendEmail.mockClear();
  await control(LIFECYCLE_CONTROL_KEY, true);
  await control("two_step_articles", false);
});

async function account(locale: string | null = null) {
  const userId = `user_${randomUUID()}`;
  const orgId = `org_${randomUUID()}`;
  await test.db.insert(user).values({ id: userId, name: "Ada", email: `${userId}@example.test`, locale });
  await test.db.insert(organization).values({ id: orgId, name: "Workspace", slug: orgId, createdAt: new Date() });
  await test.db.insert(member).values({ id: randomUUID(), organizationId: orgId, userId, role: "owner", createdAt: new Date() });
  const [site] = await test.db.insert(websites).values({ organizationId: orgId, url: "https://shop.example", domain: "shop.example", status: "ready" }).returning({ id: websites.id });
  return { userId, orgId, websiteId: site.id };
}
async function article(websiteId: string, values: Partial<typeof articles.$inferInsert> = {}, versions = 1) {
  const [row] = await test.db.insert(articles).values({ websiteId, title: "How to choose", status: "draft", bodyHtml: "<p>x</p>", ...values }).returning({ id: articles.id });
  for (let i = 0; i < versions; i += 1) await test.db.insert(articleVersions).values({ articleId: row.id, bodyHtml: "<p>x</p>" });
  return row.id;
}

describe("the first article's email", () => {
  it("goes to the owner with a link through sign-in to that article, once per website", async () => {
    const { userId, websiteId } = await account();
    const articleId = await article(websiteId);
    expect(await emailFirstArticleReady({ articleId, written: true })).toMatchObject({ status: "sent" });
    const [mail] = sent.sendEmail.mock.calls[0]!;
    expect(mail.to).toBe(`${userId}@example.test`);
    expect(mail.subject).toBe("Your first article is ready to publish");
    expect(mail.text).toContain("\"How to choose\", the first article for shop.example");
    expect(mail.text).toContain(`/sign-in?next=${encodeURIComponent(`/websites/${websiteId}/articles/${articleId}`)}`);
    expect(mail.text).toContain("connect your website");
    // Tips and reports: it can be unsubscribed from.
    expect(mail.headers?.["List-Unsubscribe"]).toBeTruthy();

    expect(await emailFirstArticleReady({ articleId, written: true })).toEqual({ status: "duplicate" });
    expect(sent.sendEmail).toHaveBeenCalledTimes(1);
  });

  it("is in the owner's language, and says what happens next", async () => {
    const { websiteId } = await account("it");
    await test.db.insert(integrations).values({ websiteId, kind: "wordpress", status: "connected" });
    await emailFirstArticleReady({ articleId: await article(websiteId), written: true });
    expect(sent.sendEmail.mock.calls[0]![0].subject).toBe("Il Suo primo articolo è pronto per la pubblicazione");
    expect(sent.sendEmail.mock.calls[0]![0].text).not.toContain("colleghi il Suo sito");

    const publishing = await account();
    await emailFirstArticleReady({ articleId: await article(publishing.websiteId), publishing: true, written: true });
    expect(sent.sendEmail.mock.calls[1]![0].subject).toBe("Your first article is ready");
    expect(sent.sendEmail.mock.calls[1]![0].text).toContain("being published on your website now");
  });

  it("is never about a later article, a rewrite, a translation or an old article", async () => {
    const later = await account();
    await article(later.websiteId, { status: "published" });
    expect(await emailFirstArticleReady({ articleId: await article(later.websiteId), written: true })).toEqual({ status: "skipped", reason: "not_first" });

    const rewritten = await account();
    expect(await emailFirstArticleReady({ articleId: await article(rewritten.websiteId, {}, 2), written: true })).toEqual({ status: "skipped", reason: "not_first" });

    const translated = await account();
    const original = await article(translated.websiteId);
    expect(await emailFirstArticleReady({ articleId: await article(translated.websiteId, { translationOf: original }) })).toMatchObject({ status: "skipped", reason: "translation" });

    const old = await account();
    expect(await emailFirstArticleReady({ articleId: await article(old.websiteId, { createdAt: new Date(Date.now() - 60 * 86_400_000) }) })).toEqual({ status: "skipped", reason: "old" });
    const live = await account();
    expect(await emailFirstArticleReady({ articleId: await article(live.websiteId, { publishedUrl: "https://shop.example/x" }) })).toEqual({ status: "skipped", reason: "old" });
    expect(await emailFirstArticleReady({ articleId: randomUUID() })).toEqual({ status: "skipped", reason: "no_article" });
    expect(sent.sendEmail).not.toHaveBeenCalled();
  });

  it("waits for the team's approval while the article is held, then goes with it", async () => {
    const { websiteId } = await account();
    const articleId = await article(websiteId, { reviewStatus: "pending" });
    expect(await emailFirstArticleReady({ articleId, written: true })).toEqual({ status: "skipped", reason: "held" });

    // The approval is what calls notifyReady, with the two-step flow on or off.
    await test.db.update(articles).set({ reviewStatus: "approved" }).where(eq(articles.id, articleId));
    await notifyReady(articleId, "customer_publishes");
    expect(sent.sendEmail).toHaveBeenCalledTimes(1);
    await notifyReady(articleId, "queued");
    expect(sent.sendEmail).toHaveBeenCalledTimes(1);

    const twoStep = await account();
    await control("two_step_articles", true);
    const held = await article(twoStep.websiteId, { reviewStatus: "pending" });
    expect(await emailFirstArticleReady({ articleId: held, written: true })).toEqual({ status: "skipped", reason: "held" });
  });

  it("respects the switch and the unsubscribe, and writes nothing while switched off", async () => {
    await control(LIFECYCLE_CONTROL_KEY, false);
    const off = await account();
    expect(await emailFirstArticleReady({ articleId: await article(off.websiteId), written: true })).toEqual({ status: "skipped", reason: "disabled" });
    expect(await test.db.select().from(lifecycleEmails).where(eq(lifecycleEmails.organizationId, off.orgId))).toHaveLength(0);

    await control(LIFECYCLE_CONTROL_KEY, true);
    const quiet = await account();
    await setTips(quiet.userId, false, "settings");
    expect(await emailFirstArticleReady({ articleId: await article(quiet.websiteId), written: true })).toEqual({ status: "skipped", reason: "unsubscribed" });
    expect(sent.sendEmail).not.toHaveBeenCalled();
  });

  it("never throws at the writing or the approval", async () => {
    expect(await emailFirstArticleReady({ articleId: "not-a-uuid" })).toMatchObject({ status: "failed" });
  });
});
