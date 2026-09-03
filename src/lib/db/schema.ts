/**
 * Database schema.
 *
 * Auth tables live in ./auth-tables (Better Auth owns their shape). Everything
 * below is application schema, written in one pass so there is a single
 * migration rather than three.
 *
 * Conventions:
 *  - Application tables use uuid primary keys via pk().
 *  - Foreign keys to organization/user are TEXT (Better Auth uses text ids).
 *  - Column names are snake_case in SQL, camelCase in TypeScript.
 */

import { relations } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector,
} from "drizzle-orm/pg-core";

import { organization } from "./auth-tables";
import { organizationId, pk, timestamps, userId } from "./columns";

export * from "./auth-tables";

/** FK to websites.id. Declared here because websites lives in this module. */
const websiteId = () =>
  uuid("website_id")
    .notNull()
    .references(() => websites.id, { onDelete: "cascade" });

/* ------------------------------------------------------------------------- */
/* Billing and plans                                                          */
/* ------------------------------------------------------------------------- */

/**
 * A plan is one purchasable price point: a tier at a billing interval. Monthly
 * and annual Growth are therefore two ROWS sharing a `tier`, not one row with
 * two prices — Stripe prices are immutable and per-interval, so this mirrors
 * the objects we create there and keeps the mapping one-to-one.
 *
 * `priceCents` is in `currency`. Do not mix currencies across rows: Stripe
 * prices are currency-locked at creation, so a change means new prices.
 */
export const plans = pgTable(
  "plans",
  {
    id: pk(),
    name: text("name").notNull(),
    /** Stable key shared by a tier's monthly and annual rows ("growth"). */
    tier: text("tier").notNull().default("legacy"),
    /** "month" | "year". */
    interval: text("interval").notNull().default("month"),
    /** ISO 4217, lowercase, as Stripe expects ("eur"). */
    currency: text("currency").notNull().default("eur"),
    stripePriceId: text("stripe_price_id"),
    paypalPlanId: text("paypal_plan_id"),
    priceCents: integer("price_cents").notNull(),
    articleLimit: integer("article_limit").notNull(),
    keywordLimit: integer("keyword_limit").notNull(),
    siteLimit: integer("site_limit").notNull(),
    monthlyCredits: integer("monthly_credits").notNull(),
    /** Ordering on the pricing page; lowest first. */
    sortOrder: integer("sort_order").default(0).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    ...timestamps,
  },
  (table) => [
    // One row per tier+interval. Makes the seed script an idempotent upsert
    // keyed on meaning rather than on the display name, which may change.
    uniqueIndex("plans_tier_interval_uidx").on(table.tier, table.interval),
  ],
);

/**
 * One subscription row per organization, enforced by the unique index.
 *
 * Without it, two concurrent first-time billing requests each insert a row and
 * create a separate Stripe customer, after which getOrCreateCustomer (newest
 * row) and checkLimit (unordered) can read DIFFERENT subscriptions for the
 * same org — splitting billing from limits. The database is the only reliable
 * place to enforce this; an application-level check still races.
 */
export const subscriptions = pgTable(
  "subscriptions",
  {
    id: pk(),
    organizationId: organizationId(),
    /** "stripe" | "paypal". Which processor owns this subscription. */
    provider: text("provider").default("stripe").notNull(),
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    /** PayPal has no customer object; only the subscription id is stored. */
    paypalSubscriptionId: text("paypal_subscription_id"),
    planId: uuid("plan_id").references(() => plans.id, { onDelete: "restrict" }),
    status: text("status").default("inactive").notNull(),
    /**
     * Read from the webhook, never derived. Deriving a period start by
     * subtracting a month from the end is what produced the date-overflow bug
     * in usage.ts; storing both ends removes the guesswork entirely.
     */
    currentPeriodStart: timestamp("current_period_start"),
    currentPeriodEnd: timestamp("current_period_end"),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("subscriptions_organization_id_uidx").on(table.organizationId),
    // Webhooks arrive keyed by the processor's id, never by organization.
    index("subscriptions_stripe_subscription_id_idx").on(
      table.stripeSubscriptionId,
    ),
    index("subscriptions_paypal_subscription_id_idx").on(
      table.paypalSubscriptionId,
    ),
  ],
);

/**
 * Every webhook event we have already handled, by the processor's own event id.
 *
 * Stripe and PayPal both retry on non-2xx and can deliver duplicates even on
 * success, so handlers MUST be idempotent. The primary key is the event id:
 * inserting it is the lock, and a conflict means "already processed, skip".
 */
export const webhookEvents = pgTable("webhook_events", {
  /** The processor's event id, e.g. Stripe "evt_...". */
  id: text("id").primaryKey(),
  provider: text("provider").notNull(),
  type: text("type").notNull(),
  payload: jsonb("payload"),
  processedAt: timestamp("processed_at").defaultNow().notNull(),
});

export const usageEvents = pgTable(
  "usage_events",
  {
    id: pk(),
    organizationId: organizationId(),
    websiteId: uuid("website_id").references(() => websites.id, {
      onDelete: "set null",
    }),
    kind: text("kind").notNull(),
    provider: text("provider"),
    model: text("model"),
    quantity: integer("quantity").default(1).notNull(),
    costUsd: numeric("cost_usd", { precision: 10, scale: 6 }),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("usage_events_org_created_idx").on(
      table.organizationId,
      table.createdAt,
    ),
  ],
);

/* ------------------------------------------------------------------------- */
/* Websites and analysis                                                      */
/* ------------------------------------------------------------------------- */

export const websites = pgTable("websites", {
  id: pk(),
  organizationId: organizationId(),
  url: text("url").notNull(),
  domain: text("domain").notNull(),
  brandName: text("brand_name"),
  industry: text("industry"),
  country: text("country"),
  language: text("language"),
  description: text("description"),
  services: jsonb("services"),
  targetAudience: text("target_audience"),
  status: text("status").default("pending").notNull(),
  ...timestamps,
});

export const competitors = pgTable(
  "competitors",
  {
    id: pk(),
    websiteId: websiteId(),
    domain: text("domain").notNull(),
    source: text("source"),
    ...timestamps,
  },
  (table) => [
    // Analysis re-runs (a retry, or the user re-analysing) suggest the same
    // rivals again. Without this, onConflictDoNothing has no conflict target
    // to match and silently inserts a duplicate every time.
    uniqueIndex("competitors_website_domain_uidx").on(
      table.websiteId,
      table.domain,
    ),
  ],
);

export const crawls = pgTable("crawls", {
  id: pk(),
  websiteId: websiteId(),
  status: text("status").default("queued").notNull(),
  pagesFound: integer("pages_found").default(0).notNull(),
  pagesCrawled: integer("pages_crawled").default(0).notNull(),
  error: text("error"),
  startedAt: timestamp("started_at"),
  finishedAt: timestamp("finished_at"),
});

export const pages = pgTable(
  "pages",
  {
    id: pk(),
    websiteId: websiteId(),
    url: text("url").notNull(),
    title: text("title"),
    metaDescription: text("meta_description"),
    h1: text("h1"),
    headings: jsonb("headings"),
    wordCount: integer("word_count"),
    statusCode: integer("status_code"),
    internalLinks: jsonb("internal_links"),
    images: jsonb("images"),
    content: text("content"),
    /**
     * No vector index today: an HNSW index on an empty table is pointless and
     * slows inserts during crawling. Added on Day 12 when there are rows.
     */
    embedding: vector("embedding", { dimensions: 1536 }),
    crawledAt: timestamp("crawled_at"),
  },
  (table) => [
    index("pages_website_idx").on(table.websiteId),
    // One row per URL per site: a re-crawl must update the existing snapshot,
    // not append a second copy that later queries would double-count.
    uniqueIndex("pages_website_url_uidx").on(table.websiteId, table.url),
  ],
);

export const audits = pgTable("audits", {
  id: pk(),
  websiteId: websiteId(),
  score: integer("score"),
  summary: jsonb("summary"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const issues = pgTable("issues", {
  id: pk(),
  websiteId: websiteId(),
  auditId: uuid("audit_id").references(() => audits.id, {
    onDelete: "cascade",
  }),
  type: text("type").notNull(),
  severity: text("severity").default("info").notNull(),
  url: text("url"),
  detail: text("detail"),
});

/* ------------------------------------------------------------------------- */
/* Strategy and content                                                       */
/* ------------------------------------------------------------------------- */

export const clusters = pgTable("clusters", {
  id: pk(),
  websiteId: websiteId(),
  name: text("name").notNull(),
  pillarKeyword: text("pillar_keyword"),
  ...timestamps,
});

export const keywords = pgTable(
  "keywords",
  {
    id: pk(),
    websiteId: websiteId(),
    term: text("term").notNull(),
    volume: integer("volume"),
    difficulty: integer("difficulty"),
    cpc: numeric("cpc", { precision: 10, scale: 2 }),
    intent: text("intent"),
    clusterId: uuid("cluster_id").references(() => clusters.id, {
      onDelete: "set null",
    }),
    priorityScore: real("priority_score"),
    source: text("source"),
    ...timestamps,
  },
  (table) => [
    index("keywords_website_idx").on(table.websiteId),
    // Research re-runs return overlapping terms; without this the upsert has
    // no conflict target and every run duplicates the whole keyword set.
    uniqueIndex("keywords_website_term_uidx").on(table.websiteId, table.term),
  ],
);

export const calendarItems = pgTable("calendar_items", {
  id: pk(),
  websiteId: websiteId(),
  clusterId: uuid("cluster_id").references(() => clusters.id, {
    onDelete: "set null",
  }),
  title: text("title").notNull(),
  targetKeyword: text("target_keyword"),
  intent: text("intent"),
  scheduledFor: timestamp("scheduled_for"),
  status: text("status").default("planned").notNull(),
  customInstructions: text("custom_instructions"),
  ...timestamps,
});

export const articles = pgTable(
  "articles",
  {
    id: pk(),
    websiteId: websiteId(),
    calendarItemId: uuid("calendar_item_id").references(
      () => calendarItems.id,
      { onDelete: "set null" },
    ),
    title: text("title").notNull(),
    slug: text("slug"),
    bodyHtml: text("body_html"),
    metaDescription: text("meta_description"),
    targetKeyword: text("target_keyword"),
    wordCount: integer("word_count"),
    status: text("status").default("draft").notNull(),
    generationStep: text("generation_step"),
    publishedUrl: text("published_url"),
    /**
     * Header image. Stored as the CMS's own URL after upload rather than the
     * provider's: provider links expire within hours, which would leave the
     * customer with a broken image on a live page.
     */
    imageUrl: text("image_url"),
    imageAlt: text("image_alt"),
    error: text("error"),
    ...timestamps,
  },
  (table) => [
    index("articles_website_status_idx").on(table.websiteId, table.status),
  ],
);

export const articleVersions = pgTable("article_versions", {
  id: pk(),
  articleId: uuid("article_id")
    .notNull()
    .references(() => articles.id, { onDelete: "cascade" }),
  bodyHtml: text("body_html"),
  createdBy: userId(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const brandVoice = pgTable("brand_voice", {
  id: pk(),
  websiteId: uuid("website_id")
    .notNull()
    .unique()
    .references(() => websites.id, { onDelete: "cascade" }),
  tone: text("tone"),
  vocabulary: text("vocabulary"),
  avoid: text("avoid"),
  usps: jsonb("usps"),
  facts: jsonb("facts"),
  socialLinks: jsonb("social_links"),
  ...timestamps,
});

/* ------------------------------------------------------------------------- */
/* Publishing and analytics                                                   */
/* ------------------------------------------------------------------------- */

export const integrations = pgTable("integrations", {
  id: pk(),
  websiteId: websiteId(),
  kind: text("kind").notNull(),
  credentials: jsonb("credentials"),
  status: text("status").default("disconnected").notNull(),
  verifiedAt: timestamp("verified_at"),
  meta: jsonb("meta"),
  ...timestamps,
});

export const publishLogs = pgTable("publish_logs", {
  id: pk(),
  articleId: uuid("article_id")
    .notNull()
    .references(() => articles.id, { onDelete: "cascade" }),
  integrationId: uuid("integration_id").references(() => integrations.id, {
    onDelete: "set null",
  }),
  status: text("status").notNull(),
  remoteId: text("remote_id"),
  remoteUrl: text("remote_url"),
  error: text("error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const gscMetrics = pgTable(
  "gsc_metrics",
  {
    id: pk(),
    websiteId: websiteId(),
    pageUrl: text("page_url"),
    query: text("query"),
    clicks: integer("clicks").default(0).notNull(),
    impressions: integer("impressions").default(0).notNull(),
    ctr: real("ctr"),
    position: real("position"),
    date: date("date").notNull(),
  },
  (table) => [
    index("gsc_metrics_website_date_idx").on(table.websiteId, table.date),
    /**
     * Imports re-fetch overlapping date ranges — Search Console revises the
     * last few days as data settles — so the same row arrives repeatedly.
     * Without this the upsert has no conflict target and every import
     * duplicates the window, silently inflating every total.
     */
    uniqueIndex("gsc_metrics_unique_idx").on(
      table.websiteId,
      table.date,
      table.pageUrl,
      table.query,
    ),
  ],
);

export const gaMetrics = pgTable(
  "ga_metrics",
  {
    id: pk(),
    websiteId: websiteId(),
    pageUrl: text("page_url"),
    sessions: integer("sessions").default(0).notNull(),
    users: integer("users").default(0).notNull(),
    engagementRate: real("engagement_rate"),
    conversions: integer("conversions").default(0).notNull(),
    date: date("date").notNull(),
  },
  (table) => [
    index("ga_metrics_website_date_idx").on(table.websiteId, table.date),
    // Same reasoning as gsc_metrics: re-imported ranges must update in place.
    uniqueIndex("ga_metrics_unique_idx").on(
      table.websiteId,
      table.date,
      table.pageUrl,
    ),
  ],
);

/**
 * A question we ask an AI assistant on the customer's behalf.
 *
 * Customers increasingly find a business by asking an assistant "who is the
 * best dentist in Utrecht" rather than by searching. That answer is not a
 * ranking anyone can look up: no API reports whether a brand gets mentioned, so
 * the only honest way to measure it is to ask the question and read the reply.
 *
 * Prompts are stored rather than regenerated per run because changing the
 * question changes the answer, which would make a trend meaningless.
 */
export const geoPrompts = pgTable(
  "geo_prompts",
  {
    id: pk(),
    websiteId: websiteId(),
    /** The question, phrased as a customer would ask it. */
    prompt: text("prompt").notNull(),
    /** Set when we suggested it rather than the customer typing it. */
    isSuggested: boolean("is_suggested").default(false).notNull(),
    active: boolean("active").default(true).notNull(),
    ...timestamps,
  },
  (table) => [
    index("geo_prompts_website_idx").on(table.websiteId),
    // The same question twice would double its weight in the score.
    uniqueIndex("geo_prompts_website_prompt_key").on(
      table.websiteId,
      table.prompt,
    ),
  ],
);

/**
 * One assistant's answer to one prompt, at one moment.
 *
 * Append-only: a check is a measurement, and overwriting yesterday's would
 * destroy the trend that makes this worth paying for.
 *
 * `mentioned` is the headline, but `position` carries most of the value —
 * being named third is materially worse than first, and a brand sliding down
 * needs to know before it disappears entirely.
 */
export const geoResults = pgTable(
  "geo_results",
  {
    id: pk(),
    geoPromptId: uuid("geo_prompt_id")
      .notNull()
      .references(() => geoPrompts.id, { onDelete: "cascade" }),
    /** Denormalised so website-wide queries avoid a join on every read. */
    websiteId: websiteId(),
    /** Which assistant answered. */
    engine: text("engine").notNull(),
    mentioned: boolean("mentioned").default(false).notNull(),
    /** 1-based rank among the brands named; null when not mentioned. */
    position: integer("position"),
    /** True when the answer pointed at the customer's own domain. */
    cited: boolean("cited").default(false).notNull(),
    sourceUrl: text("source_url"),
    /** Every brand named, in order, for competitive context. */
    competitors: jsonb("competitors").$type<string[]>().default([]).notNull(),
    /** The sentence naming the brand, so the customer sees the evidence. */
    excerpt: text("excerpt"),
    checkedAt: timestamp("checked_at").defaultNow().notNull(),
  },
  (table) => [
    index("geo_results_website_idx").on(table.websiteId, table.checkedAt),
    index("geo_results_prompt_idx").on(table.geoPromptId, table.checkedAt),
  ],
);

export const geoPromptsRelations = relations(geoPrompts, ({ one, many }) => ({
  website: one(websites, {
    fields: [geoPrompts.websiteId],
    references: [websites.id],
  }),
  results: many(geoResults),
}));

export const geoResultsRelations = relations(geoResults, ({ one }) => ({
  prompt: one(geoPrompts, {
    fields: [geoResults.geoPromptId],
    references: [geoPrompts.id],
  }),
}));

/* ------------------------------------------------------------------------- */
/* Backlink network                                                           */
/* ------------------------------------------------------------------------- */

export const networkSites = pgTable("network_sites", {
  id: pk(),
  websiteId: uuid("website_id")
    .notNull()
    .unique()
    .references(() => websites.id, { onDelete: "cascade" }),
  niche: text("niche"),
  language: text("language"),
  country: text("country"),
  authority: integer("authority"),
  acceptingLinks: boolean("accepting_links").default(true).notNull(),
  monthlyCap: integer("monthly_cap").default(0).notNull(),
  linksGiven: integer("links_given").default(0).notNull(),
  linksReceived: integer("links_received").default(0).notNull(),
  ...timestamps,
});

export const creditLedger = pgTable(
  "credit_ledger",
  {
    id: pk(),
    organizationId: organizationId(),
    type: text("type").notNull(),
    /** Signed: positive for credits earned or purchased, negative for spent. */
    amount: integer("amount").notNull(),
    referenceId: text("reference_id"),
    note: text("note"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("credit_ledger_org_idx").on(table.organizationId)],
);

export const backlinkRequests = pgTable("backlink_requests", {
  id: pk(),
  websiteId: websiteId(),
  targetUrl: text("target_url").notNull(),
  anchorHint: text("anchor_hint"),
  status: text("status").default("pending").notNull(),
  creditsReserved: integer("credits_reserved").default(0).notNull(),
  ...timestamps,
});

export const placements = pgTable("placements", {
  id: pk(),
  requestId: uuid("request_id")
    .notNull()
    .references(() => backlinkRequests.id, { onDelete: "cascade" }),
  hostWebsiteId: uuid("host_website_id").references(() => websites.id, {
    onDelete: "set null",
  }),
  articleId: uuid("article_id").references(() => articles.id, {
    onDelete: "set null",
  }),
  liveUrl: text("live_url"),
  anchor: text("anchor"),
  credits: integer("credits").default(0).notNull(),
  status: text("status").default("pending").notNull(),
  lastVerifiedAt: timestamp("last_verified_at"),
  ...timestamps,
});

export const linkChecks = pgTable("link_checks", {
  id: pk(),
  placementId: uuid("placement_id")
    .notNull()
    .references(() => placements.id, { onDelete: "cascade" }),
  alive: boolean("alive").default(false).notNull(),
  httpStatus: integer("http_status"),
  checkedAt: timestamp("checked_at").defaultNow().notNull(),
});

/* ------------------------------------------------------------------------- */
/* Infrastructure                                                             */
/* ------------------------------------------------------------------------- */

export const providerCache = pgTable(
  "provider_cache",
  {
    id: pk(),
    provider: text("provider").notNull(),
    endpoint: text("endpoint").notNull(),
    paramsHash: text("params_hash").notNull(),
    response: jsonb("response"),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("provider_cache_params_hash_idx").on(table.paramsHash),
  ],
);

/**
 * Something finished, or failed, while the customer was not looking.
 *
 * Article generation, audits and keyword research all run as background jobs
 * taking minutes. Until now the only signal was a toast, which exists solely
 * while the tab is open — so someone who starts a job and closes the tab never
 * learns it finished, and worse, never learns it failed.
 *
 * Scoped to the ORGANISATION rather than the user, because the work belongs to
 * the workspace: when a colleague generates an article, everyone sharing that
 * workspace should see it. `userId` records who triggered it, for attribution
 * in the text, not for filtering.
 */
export const notifications = pgTable(
  "notifications",
  {
    id: pk(),
    organizationId: organizationId(),
    userId: userId(),
    /** Machine-readable kind, e.g. "article.ready" | "audit.failed". */
    type: text("type").notNull(),
    /** One line, written for the customer rather than for a log. */
    title: text("title").notNull(),
    /** Optional detail. A failure says what to do next. */
    body: text("body"),
    /** Where clicking goes. Relative, always inside the app. */
    href: text("href"),
    /** Null until read; the timestamp doubles as the read flag. */
    readAt: timestamp("read_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    /**
     * Every read is "this org, newest first", and the badge filters on
     * read_at. One index serves both.
     */
    index("notifications_org_idx").on(
      table.organizationId,
      table.readAt,
      table.createdAt,
    ),
  ],
);

/* ------------------------------------------------------------------------- */
/* Relations (only the joins actually used)                                   */
/* ------------------------------------------------------------------------- */

export const organizationAppRelations = relations(organization, ({ many }) => ({
  websites: many(websites),
}));

export const websitesRelations = relations(websites, ({ one, many }) => ({
  organization: one(organization, {
    fields: [websites.organizationId],
    references: [organization.id],
  }),
  pages: many(pages),
  keywords: many(keywords),
  articles: many(articles),
  integrations: many(integrations),
}));

export const pagesRelations = relations(pages, ({ one }) => ({
  website: one(websites, {
    fields: [pages.websiteId],
    references: [websites.id],
  }),
}));

export const clustersRelations = relations(clusters, ({ one, many }) => ({
  website: one(websites, {
    fields: [clusters.websiteId],
    references: [websites.id],
  }),
  keywords: many(keywords),
}));

export const keywordsRelations = relations(keywords, ({ one }) => ({
  website: one(websites, {
    fields: [keywords.websiteId],
    references: [websites.id],
  }),
  cluster: one(clusters, {
    fields: [keywords.clusterId],
    references: [clusters.id],
  }),
}));

export const articlesRelations = relations(articles, ({ one, many }) => ({
  website: one(websites, {
    fields: [articles.websiteId],
    references: [websites.id],
  }),
  versions: many(articleVersions),
  publishLogs: many(publishLogs),
}));

export const articleVersionsRelations = relations(
  articleVersions,
  ({ one }) => ({
    article: one(articles, {
      fields: [articleVersions.articleId],
      references: [articles.id],
    }),
  }),
);

export const publishLogsRelations = relations(publishLogs, ({ one }) => ({
  article: one(articles, {
    fields: [publishLogs.articleId],
    references: [articles.id],
  }),
  integration: one(integrations, {
    fields: [publishLogs.integrationId],
    references: [integrations.id],
  }),
}));

export const integrationsRelations = relations(integrations, ({ one }) => ({
  website: one(websites, {
    fields: [integrations.websiteId],
    references: [websites.id],
  }),
}));

/* ------------------------------------------------------------------------- */
/* Referrals                                                                  */
/* ------------------------------------------------------------------------- */

/**
 * A workspace's referral code.
 *
 * One per organisation, created on demand rather than for everyone up front:
 * most customers never refer anyone, and a table of unused codes is noise.
 *
 * Rewards are paid as ACCOUNT CREDIT, not cash. Cash payouts mean tax
 * reporting, a payout rail, and a fraud surface where a stolen card buys a
 * subscription that pays out real money before the chargeback lands. Credit
 * costs us margin instead of cash, cannot be withdrawn, and is worthless to a
 * fraudster — while still being worth something real to a genuine customer.
 */
export const referralCodes = pgTable(
  "referral_codes",
  {
    id: pk(),
    organizationId: organizationId(),
    /** The shareable code. Short, unambiguous, case-insensitive on lookup. */
    code: text("code").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    // One code per workspace, and no two workspaces share a code.
    uniqueIndex("referral_codes_org_key").on(table.organizationId),
    uniqueIndex("referral_codes_code_key").on(table.code),
  ],
);

/**
 * One referred signup.
 *
 * Created when someone signs up with a code, and only becomes payable once
 * that workspace actually pays for something. Rewarding a signup would pay for
 * throwaway accounts; rewarding a payment cannot be gamed without a real card
 * charge, which is the point.
 *
 * `status` moves pending -> rewarded, or pending -> rejected. Rows are never
 * deleted: a referral that was declined should stay auditable, because the
 * question "why did I not get paid for this" needs an answer.
 */
export const referrals = pgTable(
  "referrals",
  {
    id: pk(),
    /** Who gets the reward. */
    referrerOrgId: text("referrer_org_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    /** Who signed up. */
    referredOrgId: text("referred_org_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    /** "pending" | "rewarded" | "rejected". */
    status: text("status").default("pending").notNull(),
    /** Why a referral was rejected, for the referrer and for support. */
    rejectedReason: text("rejected_reason"),
    /** Credits awarded, once paid. */
    rewardCredits: integer("reward_credits"),
    rewardedAt: timestamp("rewarded_at"),
    ...timestamps,
  },
  (table) => [
    /**
     * A workspace can only ever be referred once. Without this, cancelling and
     * resubscribing would pay the referrer repeatedly for one customer.
     */
    uniqueIndex("referrals_referred_key").on(table.referredOrgId),
    index("referrals_referrer_idx").on(table.referrerOrgId, table.status),
  ],
);

export const referralCodesRelations = relations(referralCodes, ({ one }) => ({
  organization: one(organization, {
    fields: [referralCodes.organizationId],
    references: [organization.id],
  }),
}));

/* ------------------------------------------------------------------------- */
/* WordPress plugin                                                           */
/* ------------------------------------------------------------------------- */

/**
 * An Integration Key, pasted into our WordPress plugin.
 *
 * The existing WordPress connection asks the customer for a username and an
 * application password, which means finding a screen buried in WordPress admin
 * and understanding that an application password is not their login password.
 * The brief asks for the other direction: install the plugin, paste one key,
 * done.
 *
 * That inverts who holds credentials. Instead of us storing write access to
 * their site, THEY hold a key that identifies them to us, and the plugin pulls
 * articles rather than us pushing them. A leaked key can publish to one
 * website; it cannot read anything else, and revoking it is one row.
 *
 * Only a HASH is stored. The key is shown once at creation and never again —
 * if our database leaks, the keys in it are useless, which is the entire point
 * of hashing a credential we do not need to read back.
 */
export const integrationKeys = pgTable(
  "integration_keys",
  {
    id: pk(),
    websiteId: websiteId(),
    /** SHA-256 of the key. The key itself is never stored. */
    keyHash: text("key_hash").notNull(),
    /** First characters, so the customer can tell two keys apart. */
    keyPrefix: text("key_prefix").notNull(),
    /** Free-text label, e.g. which site it was installed on. */
    label: text("label"),
    /** Set on first successful use, so an unused key is visible as unused. */
    lastUsedAt: timestamp("last_used_at"),
    /** Reported by the plugin, for support: "6.4.3 / plugin 1.0.0". */
    siteInfo: text("site_info"),
    /** Null until revoked. Revoked keys are kept for the audit trail. */
    revokedAt: timestamp("revoked_at"),
    ...timestamps,
  },
  (table) => [
    // Every authenticated plugin request is a lookup by hash.
    uniqueIndex("integration_keys_hash_key").on(table.keyHash),
    index("integration_keys_website_idx").on(table.websiteId),
  ],
);

export const integrationKeysRelations = relations(
  integrationKeys,
  ({ one }) => ({
    website: one(websites, {
      fields: [integrationKeys.websiteId],
      references: [websites.id],
    }),
  }),
);

/* ------------------------------------------------------------------------- */
/* Add-ons                                                                    */
/* ------------------------------------------------------------------------- */

/**
 * A one-off purchase, separate from the subscription.
 *
 * Two kinds exist today: extra link credits, and services we deliver by hand
 * (the brief's "Top 250 live USA Local Citations"). They share a table because
 * they share everything that matters — a price, a Stripe product, and a record
 * that someone paid.
 *
 * Rows rather than constants because the prices are a commercial decision that
 * will change, and a price change should not need a deploy. `stripePriceId`
 * stays null until `npm run stripe:setup` creates the price, and checkout
 * refuses an add-on without one, so a half-configured add-on cannot take money.
 */
export const addons = pgTable(
  "addons",
  {
    id: pk(),
    /** Stable key used in code and Stripe metadata, e.g. "credits_50". */
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    priceCents: integer("price_cents").notNull(),
    currency: text("currency").default("eur").notNull(),
    stripePriceId: text("stripe_price_id"),
    /**
     * Link credits granted on purchase, or 0 for a service we fulfil by hand.
     * The webhook reads this to decide whether anything is granted
     * automatically — a manual service must not silently do nothing.
     */
    creditsGranted: integer("credits_granted").default(0).notNull(),
    /** "credits" | "service". Decides what happens after payment. */
    kind: text("kind").default("credits").notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex("addons_slug_key").on(table.slug)],
);

/**
 * One completed add-on purchase.
 *
 * Written by the Stripe webhook, never by the checkout redirect: someone can
 * close the tab before the redirect loads, or visit the success URL by hand.
 * If it is not recorded here, it was not paid for.
 *
 * Kept even after fulfilment, because "what did I buy and when" needs an
 * answer, and a manual service needs somewhere to track that it was delivered.
 */
export const addonPurchases = pgTable(
  "addon_purchases",
  {
    id: pk(),
    organizationId: organizationId(),
    addonId: uuid("addon_id")
      .notNull()
      .references(() => addons.id, { onDelete: "restrict" }),
    /** Stripe checkout session id. Unique, so a replayed webhook cannot double. */
    stripeSessionId: text("stripe_session_id").notNull(),
    /** What was actually charged, in case the price changes later. */
    pricePaidCents: integer("price_paid_cents").notNull(),
    currency: text("currency").notNull(),
    /** "paid" for credits; "paid" then "fulfilled" for a manual service. */
    status: text("status").default("paid").notNull(),
    fulfilledAt: timestamp("fulfilled_at"),
    ...timestamps,
  },
  (table) => [
    // The idempotency guarantee: one purchase per Stripe session, ever.
    uniqueIndex("addon_purchases_session_key").on(table.stripeSessionId),
    index("addon_purchases_org_idx").on(table.organizationId),
  ],
);

export const addonPurchasesRelations = relations(addonPurchases, ({ one }) => ({
  addon: one(addons, {
    fields: [addonPurchases.addonId],
    references: [addons.id],
  }),
}));

/**
 * A one-off Starter trial, bought without a subscription.
 *
 * The brief's Starter package "receives one article and one backlink, to
 * attrack to subscribe, and later upgrade the plans", and the reference design
 * states "No subscription required".
 *
 * That combination needs its own row. Entitlement is otherwise derived from an
 * active subscription, so a trial buyer has nothing granting them the article
 * they just paid for. The backlink needs nothing extra — link credits already
 * live in their own ledger.
 *
 * One row per organization, enforced by a unique index: the offer is "one per
 * website" in the reference, and without the constraint a customer could buy a
 * EUR 1 article repeatedly instead of ever subscribing.
 */
export const starterTrials = pgTable(
  "starter_trials",
  {
    id: pk(),
    organizationId: organizationId(),
    /** The purchase that paid for it, for support and refunds. */
    purchaseId: uuid("purchase_id")
      .notNull()
      .references(() => addonPurchases.id, { onDelete: "restrict" }),
    /** Articles the trial grants. One, but stored rather than assumed. */
    articleGrant: integer("article_grant").default(1).notNull(),
    /** Articles written against it, so the grant is spent exactly once. */
    articlesUsed: integer("articles_used").default(0).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("starter_trials_org_uidx").on(table.organizationId),
  ],
);
/* Agency workspaces                                                          */
/* ------------------------------------------------------------------------- */

/**
 * A workspace operated by us rather than sold to a customer.
 *
 * The brief: "For the start we will be using also 20-30 of our websites, in
 * this way we serve the users with backlinks until the platform grows. So we
 * need to make an account like agency level, where I insert all my websites
 * that will partecipate in backlink exchange."
 *
 * A row here rather than a plan tier, because this is not something anyone
 * buys. Inventing a price and a checkout for an internal account would be
 * ceremony around a decision that is really "this workspace is ours".
 *
 * A separate table rather than a column on organization: that table belongs to
 * Better Auth, and adding our columns to it makes every future auth upgrade a
 * merge conflict.
 */
export const agencyWorkspaces = pgTable(
  "agency_workspaces",
  {
    id: pk(),
    organizationId: organizationId(),
    /**
     * Websites this workspace may add. Agencies seed the network before it has
     * enough customers to sustain itself, so this is far above any plan.
     */
    siteLimit: integer("site_limit").default(50).notNull(),
    articleLimit: integer("article_limit").default(500).notNull(),
    keywordLimit: integer("keyword_limit").default(5000).notNull(),
    /** Why this workspace is an agency, for whoever finds the row later. */
    note: text("note"),
    ...timestamps,
  },
  (table) => [
    // One agency record per workspace.
    uniqueIndex("agency_workspaces_org_key").on(table.organizationId),
  ],
);
