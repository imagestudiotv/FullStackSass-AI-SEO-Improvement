/**
 * Admin -> Customer activity: the pure half (owner, 2026-11-26: "I have to
 * check the activities of the new customers in real time").
 *
 * What a raw event row means in words and where it links, which workspaces a
 * filter keeps, the plan badge, and the "Needs attention" rules. Nothing here
 * reads the database or the clock - the queries are in customer-activity.ts -
 * so every rule is a small function with its own test.
 */

/* ------------------------------------------------------------------------- */
/* Events                                                                     */
/* ------------------------------------------------------------------------- */

export const ACTIVITY_GROUPS = ["account", "billing", "content", "social", "problems"] as const;
export type ActivityGroup = (typeof ACTIVITY_GROUPS)[number];

export const GROUP_LABEL: Record<ActivityGroup, string> = {
  account: "Account",
  billing: "Plan & payments",
  content: "Content",
  social: "Social",
  problems: "Problems",
};

/** Every event the feed shows, each in exactly one group. */
export const KIND_GROUP = {
  signup: "account",
  workspace_created: "account",
  website_added: "account",
  analysis_done: "account",
  feedback_sent: "account",
  free_started: "billing",
  trial_started: "billing",
  plan_started: "billing",
  plan_changed: "billing",
  plan_cancelled: "billing",
  trial_ended: "billing",
  payment_paid: "billing",
  payment_no_charge: "billing",
  payment_refunded: "billing",
  content_plan: "content",
  article_started: "content",
  article_written: "content",
  article_delivered: "content",
  social_posted: "social",
  video_approved: "social",
  video_posted: "social",
  analysis_failed: "problems",
  payment_failed: "problems",
  research_failed: "problems",
  research_empty: "problems",
  article_failed: "problems",
  delivery_failed: "problems",
} as const satisfies Record<string, ActivityGroup>;

export type ActivityKind = keyof typeof KIND_GROUP;

export function isActivityKind(value: unknown): value is ActivityKind {
  return typeof value === "string" && Object.hasOwn(KIND_GROUP, value);
}

/** The kinds a group filter keeps; every kind for "all" or an unknown value. */
export function kindsForGroup(group: string | null | undefined): ActivityKind[] {
  const all = Object.keys(KIND_GROUP) as ActivityKind[];
  if (!group || !(ACTIVITY_GROUPS as readonly string[]).includes(group)) return all;
  return all.filter((kind) => KIND_GROUP[kind] === group);
}

/** One row as the union query returns it (customer-activity.ts). */
export type RawActivity = {
  kind: ActivityKind;
  at: Date;
  organizationId: string | null;
  websiteId: string | null;
  /** The row the event was read from: a user, website, article, payment... */
  refId: string;
  /** Kind-specific: an email, a title, a plan name, a description. */
  label: string | null;
  /** Kind-specific: a status, an error, a currency. */
  extra: string | null;
  /** Kind-specific: an amount in cents, a topic count. */
  amount: number | null;
  /** The article an article event is about (its version or delivery row is refId). */
  articleId: string | null;
};

export type ActivityEvent = RawActivity & {
  /** Unique within the feed, stable across refreshes: marks rows that are new. */
  key: string;
  group: ActivityGroup;
  text: string;
  /** The admin page this event is about, when there is one. */
  href: string | null;
  hrefLabel: string | null;
};

export function formatCents(cents: number, currency: string | null): string {
  const code = (currency ?? "eur").toUpperCase();
  try {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency: code }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${code}`;
  }
}

function clip(value: string | null | undefined, length: number): string {
  const text = (value ?? "").replace(/\s+/g, " ").trim();
  return text.length > length ? `${text.slice(0, length - 1)}…` : text;
}

const quoted = (value: string | null, length = 80) => (value ? `: “${clip(value, length)}”` : "");

/** The admin list of one website, searched by its domain. */
export const websiteHref = (domain: string) => `/admin/websites?q=${encodeURIComponent(domain)}`;
export const articleHref = (id: string) => `/admin/articles/${encodeURIComponent(id)}`;
export const paymentsHref = (organizationId: string, status?: string) =>
  `/admin/payments?org=${encodeURIComponent(organizationId)}${status ? `&status=${status}` : ""}`;
export const timelineHref = (organizationId: string) => `/admin/customer-activity?org=${encodeURIComponent(organizationId)}`;

/**
 * Words and link for one raw row. `domain` is the event's website's domain,
 * when it has one and it still exists.
 */
export function describeActivity(raw: RawActivity, domain: string | null): ActivityEvent {
  const base = { ...raw, key: `${raw.kind}:${raw.refId}`, group: KIND_GROUP[raw.kind] };
  const site = domain ? { href: websiteHref(domain), hrefLabel: "Website" } : { href: null, hrefLabel: null };
  const article = raw.articleId ? { href: articleHref(raw.articleId), hrefLabel: "Article" } : { href: null, hrefLabel: null };
  const org = raw.organizationId;
  const payments = org ? { href: paymentsHref(org), hrefLabel: "Payments" } : { href: null, hrefLabel: null };
  const amount = raw.amount ?? 0;

  switch (raw.kind) {
    case "signup":
      return { ...base, text: `Signed up${raw.label ? ` as ${raw.label}` : ""}`, href: raw.label ? `/admin/users?q=${encodeURIComponent(raw.label)}` : null, hrefLabel: raw.label ? "User" : null };
    case "workspace_created":
      return { ...base, text: "Workspace created", href: org ? `/admin/organizations?q=${encodeURIComponent(raw.label ?? "")}` : null, hrefLabel: org ? "Workspace" : null };
    case "website_added":
      return { ...base, text: `Website added${domain ? `: ${domain}` : raw.label ? `: ${raw.label}` : ""}`, ...site };
    case "analysis_done":
      return { ...base, text: "Website analysed (profile read)", ...site };
    case "analysis_failed":
      return { ...base, text: "Website analysis failed", ...site };
    case "feedback_sent":
      return { ...base, text: `Feedback sent (${raw.extra ?? "message"})${quoted(raw.label)}`, href: `/admin/feedback/${encodeURIComponent(raw.refId)}`, hrefLabel: "Feedback" };
    case "free_started":
      return { ...base, text: "Started Free", ...site };
    case "trial_started":
      return { ...base, text: `Trial started on ${raw.label ?? "a plan"}${raw.extra && raw.extra !== "trialing" ? ` (now ${raw.extra.replace(/_/g, " ")})` : ""}`, ...site };
    case "plan_started":
      return { ...base, text: `Plan started: ${raw.label ?? "a plan"}${raw.extra && raw.extra !== "active" ? ` (now ${raw.extra.replace(/_/g, " ")})` : ""}`, ...site };
    case "plan_changed":
      return { ...base, text: `Plan ${raw.extra === "downgrade" ? "downgraded" : "upgraded"} to ${raw.label ?? "another plan"} (PayPal)`, ...payments };
    case "plan_cancelled":
      return { ...base, text: `Cancelled ${raw.label ?? "the plan"}${raw.extra === "ended" ? " (ended at once)" : " (ends at the period's end)"}`, ...site };
    case "trial_ended":
      return { ...base, text: "Trial ended without a payment", ...site };
    case "payment_paid":
      return { ...base, text: `Payment of ${formatCents(amount, raw.extra)} succeeded${quoted(raw.label, 60)}`, ...payments };
    case "payment_no_charge":
      return { ...base, text: `No-charge invoice (trial or full discount)${quoted(raw.label, 60)}`, ...payments };
    case "payment_refunded":
      return { ...base, text: `Payment of ${formatCents(amount, raw.extra)} (since refunded)${quoted(raw.label, 60)}`, ...payments };
    case "payment_failed":
      return { ...base, text: `Payment of ${formatCents(amount, raw.extra)} failed${quoted(raw.label, 60)}`, href: org ? paymentsHref(org, "failed") : null, hrefLabel: org ? "Payments" : null };
    case "content_plan":
      return { ...base, text: `Content plan built: ${amount} ${amount === 1 ? "topic" : "topics"}`, ...site };
    case "research_failed":
      return { ...base, text: "Search term research failed before it could run", ...site };
    case "research_empty":
      return { ...base, text: "Search term research ran but brought no new content plan", ...site };
    case "article_started":
      return { ...base, text: `Article started${quoted(raw.label)}`, ...article };
    case "article_written":
      return { ...base, text: `Article written (draft)${quoted(raw.label)}`, ...article };
    case "article_failed":
      return { ...base, text: `Article failed${quoted(raw.label)}${raw.extra ? `. ${clip(raw.extra, 120)}` : ""}`, ...article };
    case "article_delivered":
      return { ...base, text: `Article delivered to the site${raw.extra === "publish" ? " (live)" : raw.extra ? ` (as ${raw.extra})` : ""}${quoted(raw.label)}`, ...article };
    case "delivery_failed":
      return { ...base, text: `Delivery to the site failed${quoted(raw.label)}${raw.extra ? `. ${clip(raw.extra, 120)}` : ""}`, ...article };
    case "social_posted":
      return { ...base, text: `Social post posted${raw.label ? ` on ${raw.label}` : ""}`, ...site };
    case "video_approved":
      return { ...base, text: `Video approved to be made${quoted(raw.label)}`, ...site };
    case "video_posted":
      return { ...base, text: `Video posted${quoted(raw.label)}`, ...site };
  }
}

/* ------------------------------------------------------------------------- */
/* Workspaces: plan badge, ours, filters                                      */
/* ------------------------------------------------------------------------- */

/** What the page knows of one workspace (customer-activity.ts workspaceFacts). */
export type WorkspaceFacts = {
  id: string;
  name: string;
  createdAt: Date;
  /** The owner's address (the first member when there is no owner). */
  ownerEmail: string | null;
  /** Every member's address, lower case, for search and the "ours" rule. */
  memberEmails: string[];
  domains: string[];
  websiteIds: string[];
  agency: boolean;
  onFree: boolean;
  /** The workspace's best subscription: active, then trialing, then past due, then the newest. */
  subscription: { status: string; planName: string | null; tier: string | null } | null;
};

export type PlanKind = "agency" | "trial" | "paid" | "free" | "none";
export type PlanBadge = { kind: PlanKind; label: string };

/**
 * The plan badge: Agency, Trial (· plan), the paid plan's own name (Grow,
 * Scale, Grow + Visibility...), Free, or No plan. A past-due plan still
 * counts as paid - its badge says so.
 */
export function planBadge(facts: Pick<WorkspaceFacts, "agency" | "onFree" | "subscription">): PlanBadge {
  if (facts.agency) return { kind: "agency", label: "Agency" };
  const sub = facts.subscription;
  if (sub?.status === "trialing") return { kind: "trial", label: sub.planName ? `Trial · ${sub.planName}` : "Trial" };
  if (sub && (sub.status === "active" || sub.status === "past_due")) {
    const name = sub.planName ?? "Paid plan";
    return { kind: "paid", label: sub.status === "past_due" ? `${name} · past due` : name };
  }
  if (facts.onFree) return { kind: "free", label: "Free" };
  return { kind: "none", label: "No plan" };
}

/**
 * One of our own workspaces, hidden unless "Include our own workspaces" is
 * on: an agency workspace (the same "ours" the Organizations list marks), a
 * workspace an administrator (ADMIN_EMAILS) belongs to, or one holding an
 * INTERNAL_TEST_WEBSITE_IDS website.
 */
export function isOurWorkspace(
  facts: Pick<WorkspaceFacts, "agency" | "memberEmails" | "websiteIds">,
  adminEmails: readonly string[],
  internalWebsiteIds: readonly string[],
): boolean {
  if (facts.agency) return true;
  const admins = new Set(adminEmails.map((email) => email.toLowerCase()));
  if (facts.memberEmails.some((email) => admins.has(email.toLowerCase()))) return true;
  const internal = new Set(internalWebsiteIds.map((id) => id.toLowerCase()));
  return facts.websiteIds.some((id) => internal.has(id.toLowerCase()));
}

export type ActivityFilters = {
  /** "free" | "trial" | "paid" | anything else for every plan. */
  plan: string;
  search: string;
  includeOurs: boolean;
};

export function matchesSearch(facts: Pick<WorkspaceFacts, "name" | "memberEmails" | "domains">, search: string): boolean {
  const term = search.trim().toLowerCase();
  if (!term) return true;
  return (
    facts.name.toLowerCase().includes(term) ||
    facts.memberEmails.some((email) => email.toLowerCase().includes(term)) ||
    facts.domains.some((domain) => domain.toLowerCase().includes(term))
  );
}

/** Whether a workspace's events are in the feed under these filters. */
export function workspaceInScope(facts: WorkspaceFacts, filters: ActivityFilters, ours: boolean): boolean {
  if (ours && !filters.includeOurs) return false;
  const kind = planBadge(facts).kind;
  if (filters.plan === "free" && kind !== "free") return false;
  if (filters.plan === "trial" && kind !== "trial") return false;
  if (filters.plan === "paid" && kind !== "paid") return false;
  return matchesSearch(facts, filters.search);
}

/** "just now", "4 min ago", "3 h ago", "2 d ago"; never negative. */
export function relativeTime(at: Date, now: Date): string {
  const seconds = Math.max(0, Math.round((now.getTime() - at.getTime()) / 1000));
  if (seconds < 45) return "just now";
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.floor(hours / 24)} d ago`;
}

/** "2026-11-26 14:03:21 UTC". */
export function exactUtc(at: Date): string {
  return `${at.toISOString().slice(0, 19).replace("T", " ")} UTC`;
}

/* ------------------------------------------------------------------------- */
/* Needs attention                                                            */
/* ------------------------------------------------------------------------- */

export const HOUR_MS = 60 * 60 * 1000;
/** A trial with no article started this long after it began. */
export const TRIAL_NO_ARTICLE_MS = 6 * HOUR_MS;
/** A ready, entitled website with no content plan this long after both. */
export const NO_PLAN_MS = 1 * HOUR_MS;
/** How long a failed article stays in the box. */
export const ARTICLE_FAILED_MS = 48 * HOUR_MS;
/** How long a failed payment stays in the box. */
export const PAYMENT_FAILED_MS = 7 * 24 * HOUR_MS;
/** A trial ending within this, with no article written. */
export const TRIAL_ENDING_MS = 24 * HOUR_MS;
/** How long a website whose analysis failed stays in the box. */
export const ANALYSIS_FAILED_MS = 30 * 24 * HOUR_MS;

export type AttentionRule =
  | "trial_no_article"
  | "analysis_failed"
  | "no_content_plan"
  | "article_failed"
  | "payment_failed"
  | "trial_ending_no_article";

export type AttentionItem = {
  rule: AttentionRule;
  /** Unique per problem. */
  key: string;
  organizationId: string;
  websiteId: string | null;
  why: string;
  since: Date;
  href: string;
  hrefLabel: string;
};

export type TrialFacts = {
  subscriptionId: string;
  organizationId: string;
  websiteId: string;
  status: string;
  /** When the subscription row was created: the trial's start. */
  startedAt: Date;
  /** The trial's end (current_period_end while trialing). */
  endsAt: Date | null;
  /** The website's first own article (translations aside), if any. */
  firstArticleStartedAt: Date | null;
  /** Any own article of the website has a body. */
  articleWritten: boolean;
};

/** A trialing subscription with no article started more than 6 hours after the trial started. */
export function trialNoArticle(trial: TrialFacts, now: Date): AttentionItem | null {
  if (trial.status !== "trialing" || trial.firstArticleStartedAt) return null;
  const waited = now.getTime() - trial.startedAt.getTime();
  if (waited <= TRIAL_NO_ARTICLE_MS) return null;
  return {
    rule: "trial_no_article",
    key: `trial_no_article:${trial.subscriptionId}`,
    organizationId: trial.organizationId,
    websiteId: trial.websiteId,
    why: `Trial started ${Math.floor(waited / HOUR_MS)} h ago and no article has been started.`,
    since: trial.startedAt,
    href: timelineHref(trial.organizationId),
    hrefLabel: "Timeline",
  };
}

/** A trial ending within 24 hours with no article written. */
export function trialEndingNoArticle(trial: TrialFacts, now: Date): AttentionItem | null {
  if (trial.status !== "trialing" || trial.articleWritten || !trial.endsAt) return null;
  const left = trial.endsAt.getTime() - now.getTime();
  if (left <= 0 || left > TRIAL_ENDING_MS) return null;
  return {
    rule: "trial_ending_no_article",
    key: `trial_ending_no_article:${trial.subscriptionId}`,
    organizationId: trial.organizationId,
    websiteId: trial.websiteId,
    why: `Trial ends ${exactUtc(trial.endsAt)} (in ${Math.max(1, Math.round(left / HOUR_MS))} h) and no article has been written.`,
    since: trial.startedAt,
    href: timelineHref(trial.organizationId),
    hrefLabel: "Timeline",
  };
}

export type FailedWebsiteFacts = {
  websiteId: string;
  organizationId: string;
  domain: string;
  status: string;
  /** websites.updated_at: the failure, for a website still failed. */
  updatedAt: Date;
};

/** A website whose analysis failed (status "failed"), changed in the last 30 days. */
export function analysisFailed(site: FailedWebsiteFacts, now: Date): AttentionItem | null {
  if (site.status !== "failed") return null;
  if (now.getTime() - site.updatedAt.getTime() > ANALYSIS_FAILED_MS) return null;
  return {
    rule: "analysis_failed",
    key: `analysis_failed:${site.websiteId}`,
    organizationId: site.organizationId,
    websiteId: site.websiteId,
    why: "The website analysis failed: it has to be checked again.",
    since: site.updatedAt,
    href: websiteHref(site.domain),
    hrefLabel: "Website",
  };
}

/** firstArticleStatus codes that mean "nothing is stuck yet" for a website without a content plan. */
const PLAN_NOT_STUCK = new Set(["written", "writing", "analysing", "researching", "free_paused"]);

export type NoPlanFacts = {
  websiteId: string;
  organizationId: string;
  domain: string;
  /** When the analysis finished (the profile extraction), else when the website was added. */
  readyAt: Date;
  /** When its plan, trial or Free started. */
  entitledAt: Date;
  hasContentPlan: boolean;
  /** firstArticleStatus for the website, when it could be read. */
  status: { code: string; message: string } | null;
};

/** The moment the one-hour clock starts: ready AND entitled. */
export function noPlanClock(site: Pick<NoPlanFacts, "readyAt" | "entitledAt">): Date {
  return site.readyAt > site.entitledAt ? site.readyAt : site.entitledAt;
}

/** Whether a website has waited long enough to be worth asking firstArticleStatus about. */
export function noPlanDue(site: Pick<NoPlanFacts, "readyAt" | "entitledAt" | "hasContentPlan">, now: Date): boolean {
  return !site.hasContentPlan && now.getTime() - noPlanClock(site).getTime() > NO_PLAN_MS;
}

/**
 * A paid, trial or Free website with no content plan an hour after it was
 * both ready and entitled - unless firstArticleStatus says it is on its way
 * (being analysed or researched, written, or Free's AI budget is paused).
 */
export function noContentPlan(site: NoPlanFacts, now: Date): AttentionItem | null {
  if (!noPlanDue(site, now)) return null;
  if (site.status && PLAN_NOT_STUCK.has(site.status.code)) return null;
  return {
    rule: "no_content_plan",
    key: `no_content_plan:${site.websiteId}`,
    organizationId: site.organizationId,
    websiteId: site.websiteId,
    why: `No content plan yet. ${site.status?.message ?? "Its status could not be read."}`,
    since: noPlanClock(site),
    href: websiteHref(site.domain),
    hrefLabel: "Website",
  };
}

export type FailedArticleFacts = {
  articleId: string;
  organizationId: string;
  websiteId: string;
  title: string;
  status: string;
  error: string | null;
  /** articles.updated_at: the failure, for an article still failed. */
  failedAt: Date;
  /** A later article for the same topic (calendar item, else title) of the website has a body. */
  retriedOk: boolean;
};

/** An article that failed (status failed) in the last 48 hours and was not retried successfully. */
export function articleFailed(article: FailedArticleFacts, now: Date): AttentionItem | null {
  if (article.status !== "failed" || article.retriedOk) return null;
  if (now.getTime() - article.failedAt.getTime() > ARTICLE_FAILED_MS) return null;
  return {
    rule: "article_failed",
    key: `article_failed:${article.articleId}`,
    organizationId: article.organizationId,
    websiteId: article.websiteId,
    why: `Article failed: “${clip(article.title, 70)}”${article.error ? `. ${clip(article.error, 120)}` : ""}`,
    since: article.failedAt,
    href: articleHref(article.articleId),
    hrefLabel: "Article",
  };
}

export type FailedPaymentFacts = {
  paymentId: string;
  organizationId: string;
  websiteId: string | null;
  status: string;
  amountCents: number;
  currency: string;
  description: string | null;
  paidAt: Date;
};

/** A payment failed in the last 7 days (still failed: a retry that succeeds turns the row paid). */
export function paymentFailed(payment: FailedPaymentFacts, now: Date): AttentionItem | null {
  if (payment.status !== "failed") return null;
  if (now.getTime() - payment.paidAt.getTime() > PAYMENT_FAILED_MS) return null;
  return {
    rule: "payment_failed",
    key: `payment_failed:${payment.paymentId}`,
    organizationId: payment.organizationId,
    websiteId: payment.websiteId,
    why: `Payment of ${formatCents(payment.amountCents, payment.currency)} failed${payment.description ? `: ${clip(payment.description, 60)}` : ""}.`,
    since: payment.paidAt,
    href: paymentsHref(payment.organizationId, "failed"),
    hrefLabel: "Payments",
  };
}

/** Oldest problem first: the one waiting longest. */
export function sortAttention(items: AttentionItem[]): AttentionItem[] {
  return [...items].sort((a, b) => a.since.getTime() - b.since.getTime() || a.key.localeCompare(b.key));
}
