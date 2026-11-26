import { describe, expect, it } from "vitest";

import {
  analysisFailed,
  articleFailed,
  describeActivity,
  isOurWorkspace,
  KIND_GROUP,
  kindsForGroup,
  noContentPlan,
  noPlanDue,
  paymentFailed,
  planBadge,
  relativeTime,
  sortAttention,
  trialEndingNoArticle,
  trialNoArticle,
  workspaceInScope,
  type ActivityKind,
  type RawActivity,
  type TrialFacts,
  type WorkspaceFacts,
} from "./customer-activity-rules";

/** Admin -> Customer activity: the event words and links, the filters, the badge and the attention rules. */

const NOW = new Date("2026-11-26T12:00:00.000Z");
const HOUR = 60 * 60 * 1000;
const ago = (hours: number) => new Date(NOW.getTime() - hours * HOUR);

const raw = (kind: ActivityKind, extra: Partial<RawActivity> = {}): RawActivity => ({
  kind,
  at: ago(1),
  organizationId: "org_1",
  websiteId: "site_1",
  refId: "ref_1",
  label: null,
  extra: null,
  amount: null,
  articleId: null,
  ...extra,
});

const workspace = (extra: Partial<WorkspaceFacts> = {}): WorkspaceFacts => ({
  id: "org_1",
  name: "Ana's shop",
  createdAt: ago(10),
  ownerEmail: "ana@example.com",
  memberEmails: ["ana@example.com"],
  domains: ["anashop.example"],
  websiteIds: ["site_1"],
  agency: false,
  onFree: false,
  subscription: null,
  ...extra,
});

describe("describeActivity", () => {
  it("puts every kind in one group and the group filter keeps only its kinds", () => {
    expect(kindsForGroup("problems")).toEqual(
      expect.arrayContaining(["analysis_failed", "payment_failed", "article_failed", "research_empty", "delivery_failed"]),
    );
    expect(kindsForGroup("problems")).not.toContain("payment_paid");
    expect(kindsForGroup("billing")).toContain("trial_started");
    expect(kindsForGroup("social")).toEqual(["social_posted", "video_approved", "video_posted"]);
    expect(kindsForGroup("all")).toHaveLength(Object.keys(KIND_GROUP).length);
    expect(kindsForGroup("nonsense")).toHaveLength(Object.keys(KIND_GROUP).length);
  });

  it("says what happened and links to the admin page it is about", () => {
    const signup = describeActivity(raw("signup", { label: "ana@example.com", websiteId: null }), null);
    expect(signup.text).toBe("Signed up as ana@example.com");
    expect(signup.href).toBe("/admin/users?q=ana%40example.com");
    expect(signup.group).toBe("account");

    const site = describeActivity(raw("website_added"), "anashop.example");
    expect(site.text).toBe("Website added: anashop.example");
    expect(site.href).toBe("/admin/websites?q=anashop.example");

    const trial = describeActivity(raw("trial_started", { label: "Grow", extra: "trialing" }), "anashop.example");
    expect(trial.text).toBe("Trial started on Grow");
    const converted = describeActivity(raw("trial_started", { label: "Grow", extra: "active" }), null);
    expect(converted.text).toBe("Trial started on Grow (now active)");
    expect(converted.href).toBeNull();

    const paid = describeActivity(raw("payment_paid", { amount: 4900, extra: "eur", label: "Grow monthly" }), null);
    expect(paid.text).toBe("Payment of €49.00 succeeded: “Grow monthly”");
    expect(paid.href).toBe("/admin/payments?org=org_1");
    const failed = describeActivity(raw("payment_failed", { amount: 8900, extra: "eur" }), null);
    expect(failed.text).toBe("Payment of €89.00 failed");
    expect(failed.href).toBe("/admin/payments?org=org_1&status=failed");
    expect(failed.group).toBe("problems");

    const plan = describeActivity(raw("content_plan", { amount: 12 }), "anashop.example");
    expect(plan.text).toBe("Content plan built: 12 topics");

    const written = describeActivity(raw("article_written", { refId: "art_9", articleId: "art_9", label: "How to brew" }), null);
    expect(written.text).toBe("Article written (draft): “How to brew”");
    expect(written.href).toBe("/admin/articles/art_9");

    const delivered = describeActivity(raw("article_delivered", { refId: "log_1", articleId: "art_9", extra: "publish", label: "How to brew" }), null);
    expect(delivered.text).toBe("Article delivered to the site (live): “How to brew”");
    expect(delivered.href).toBe("/admin/articles/art_9");
    expect(delivered.key).toBe("article_delivered:log_1");

    const articleError = describeActivity(raw("article_failed", { articleId: "art_2", label: "Bad one", extra: "Model timed out" }), null);
    expect(articleError.text).toBe("Article failed: “Bad one”. Model timed out");

    const feedback = describeActivity(raw("feedback_sent", { refId: "fb_1", label: "x".repeat(200), extra: "problem" }), null);
    expect(feedback.text.length).toBeLessThan(120);
    expect(feedback.href).toBe("/admin/feedback/fb_1");
  });
});

describe("plan badge, ours and scope", () => {
  it("labels Agency, Trial, the paid plan's name, Free and No plan", () => {
    expect(planBadge(workspace({ agency: true, onFree: true }))).toEqual({ kind: "agency", label: "Agency" });
    expect(planBadge(workspace({ subscription: { status: "trialing", planName: "Grow", tier: "grow" } }))).toEqual({ kind: "trial", label: "Trial · Grow" });
    expect(planBadge(workspace({ subscription: { status: "active", planName: "Grow + Visibility", tier: "grow_visibility" } }))).toEqual({ kind: "paid", label: "Grow + Visibility" });
    expect(planBadge(workspace({ subscription: { status: "past_due", planName: "Scale", tier: "scale" } }))).toEqual({ kind: "paid", label: "Scale · past due" });
    expect(planBadge(workspace({ onFree: true, subscription: { status: "canceled", planName: "Grow", tier: "grow" } }))).toEqual({ kind: "free", label: "Free" });
    expect(planBadge(workspace())).toEqual({ kind: "none", label: "No plan" });
  });

  it("treats agency workspaces, an administrator's workspace and an internal test website as ours", () => {
    expect(isOurWorkspace(workspace({ agency: true }), [], [])).toBe(true);
    expect(isOurWorkspace(workspace({ memberEmails: ["Boss@RepGet.com"] }), ["boss@repget.com"], [])).toBe(true);
    expect(isOurWorkspace(workspace(), [], ["SITE_1"])).toBe(true);
    expect(isOurWorkspace(workspace(), ["boss@repget.com"], ["other"])).toBe(false);
  });

  it("filters by plan and search, and hides ours unless included", () => {
    const free = workspace({ onFree: true });
    const filters = { plan: "all", search: "", includeOurs: false };
    expect(workspaceInScope(free, filters, false)).toBe(true);
    expect(workspaceInScope(free, filters, true)).toBe(false);
    expect(workspaceInScope(free, { ...filters, includeOurs: true }, true)).toBe(true);
    expect(workspaceInScope(free, { ...filters, plan: "free" }, false)).toBe(true);
    expect(workspaceInScope(free, { ...filters, plan: "paid" }, false)).toBe(false);
    expect(workspaceInScope(free, { ...filters, search: "ANASHOP" }, false)).toBe(true);
    expect(workspaceInScope(free, { ...filters, search: "ana@" }, false)).toBe(true);
    expect(workspaceInScope(free, { ...filters, search: "shop" }, false)).toBe(true);
    expect(workspaceInScope(free, { ...filters, search: "globex" }, false)).toBe(false);
  });

  it("says how long ago, never in the future", () => {
    expect(relativeTime(new Date(NOW.getTime() - 10_000), NOW)).toBe("just now");
    expect(relativeTime(new Date(NOW.getTime() + 60_000), NOW)).toBe("just now");
    expect(relativeTime(new Date(NOW.getTime() - 4 * 60_000), NOW)).toBe("4 min ago");
    expect(relativeTime(ago(3), NOW)).toBe("3 h ago");
    expect(relativeTime(ago(72), NOW)).toBe("3 d ago");
  });
});

describe("needs attention", () => {
  const trial = (extra: Partial<TrialFacts> = {}): TrialFacts => ({
    subscriptionId: "sub_1",
    organizationId: "org_1",
    websiteId: "site_1",
    status: "trialing",
    startedAt: ago(7),
    endsAt: new Date(NOW.getTime() + 60 * HOUR),
    firstArticleStartedAt: null,
    articleWritten: false,
    ...extra,
  });

  it("a trial with no article started more than 6 hours after it started", () => {
    expect(trialNoArticle(trial(), NOW)?.why).toBe("Trial started 7 h ago and no article has been started.");
    expect(trialNoArticle(trial(), NOW)?.href).toBe("/admin/customer-activity?org=org_1");
    expect(trialNoArticle(trial({ startedAt: ago(5) }), NOW)).toBeNull();
    expect(trialNoArticle(trial({ startedAt: ago(6) }), NOW)).toBeNull();
    expect(trialNoArticle(trial({ firstArticleStartedAt: ago(1) }), NOW)).toBeNull();
    expect(trialNoArticle(trial({ status: "active" }), NOW)).toBeNull();
  });

  it("a trial ending within 24 hours with no article written", () => {
    const ending = trial({ endsAt: new Date(NOW.getTime() + 5 * HOUR) });
    expect(trialEndingNoArticle(ending, NOW)?.why).toBe("Trial ends 2026-11-26 17:00:00 UTC (in 5 h) and no article has been written.");
    expect(trialEndingNoArticle(trial(), NOW)).toBeNull();
    expect(trialEndingNoArticle({ ...ending, articleWritten: true }, NOW)).toBeNull();
    expect(trialEndingNoArticle({ ...ending, endsAt: ago(1) }, NOW)).toBeNull();
    expect(trialEndingNoArticle({ ...ending, endsAt: null }, NOW)).toBeNull();
  });

  it("a website whose analysis failed, for 30 days", () => {
    const site = { websiteId: "site_1", organizationId: "org_1", domain: "anashop.example", status: "failed", updatedAt: ago(2) };
    expect(analysisFailed(site, NOW)?.href).toBe("/admin/websites?q=anashop.example");
    expect(analysisFailed({ ...site, status: "ready" }, NOW)).toBeNull();
    expect(analysisFailed({ ...site, updatedAt: ago(31 * 24) }, NOW)).toBeNull();
  });

  it("an entitled, ready website with no content plan an hour after both, unless firstArticleStatus says it is on its way", () => {
    const site = {
      websiteId: "site_1",
      organizationId: "org_1",
      domain: "anashop.example",
      readyAt: ago(3),
      entitledAt: ago(2),
      hasContentPlan: false,
      status: { code: "research_not_started", message: "Its research has not started yet." },
    };
    const item = noContentPlan(site, NOW);
    expect(item?.why).toBe("No content plan yet. Its research has not started yet.");
    // The clock starts when it is both ready and entitled.
    expect(item?.since).toEqual(ago(2));
    expect(noPlanDue({ ...site, entitledAt: new Date(NOW.getTime() - 30 * 60_000) }, NOW)).toBe(false);
    expect(noContentPlan({ ...site, readyAt: new Date(NOW.getTime() - 30 * 60_000) }, NOW)).toBeNull();
    expect(noContentPlan({ ...site, hasContentPlan: true }, NOW)).toBeNull();
    expect(noContentPlan({ ...site, status: { code: "researching", message: "" } }, NOW)).toBeNull();
    expect(noContentPlan({ ...site, status: { code: "free_paused", message: "" } }, NOW)).toBeNull();
    expect(noContentPlan({ ...site, status: { code: "research_gave_up", message: "Gave up." } }, NOW)?.why).toContain("Gave up.");
    expect(noContentPlan({ ...site, status: null }, NOW)?.why).toContain("could not be read");
  });

  it("an article that failed in the last 48 hours and was not retried successfully", () => {
    const article = {
      articleId: "art_1",
      organizationId: "org_1",
      websiteId: "site_1",
      title: "How to brew",
      status: "failed",
      error: "Model timed out",
      failedAt: ago(3),
      retriedOk: false,
    };
    expect(articleFailed(article, NOW)?.why).toBe("Article failed: “How to brew”. Model timed out");
    expect(articleFailed(article, NOW)?.href).toBe("/admin/articles/art_1");
    expect(articleFailed({ ...article, retriedOk: true }, NOW)).toBeNull();
    expect(articleFailed({ ...article, status: "draft" }, NOW)).toBeNull();
    expect(articleFailed({ ...article, failedAt: ago(49) }, NOW)).toBeNull();
  });

  it("a payment failed in the last 7 days", () => {
    const payment = {
      paymentId: "pay_1",
      organizationId: "org_1",
      websiteId: null,
      status: "failed",
      amountCents: 8900,
      currency: "eur",
      description: "Scale monthly",
      paidAt: ago(24),
    };
    expect(paymentFailed(payment, NOW)?.why).toBe("Payment of €89.00 failed: Scale monthly.");
    expect(paymentFailed({ ...payment, status: "paid" }, NOW)).toBeNull();
    expect(paymentFailed({ ...payment, paidAt: ago(8 * 24) }, NOW)).toBeNull();
  });

  it("lists the longest-waiting problem first", () => {
    const a = trialNoArticle(trial({ startedAt: ago(30), subscriptionId: "a" }), NOW)!;
    const b = trialNoArticle(trial({ startedAt: ago(10), subscriptionId: "b" }), NOW)!;
    expect(sortAttention([b, a]).map((item) => item.key)).toEqual(["trial_no_article:a", "trial_no_article:b"]);
  });
});
