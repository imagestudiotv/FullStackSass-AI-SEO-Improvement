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

export const plans = pgTable("plans", {
  id: pk(),
  name: text("name").notNull(),
  stripePriceId: text("stripe_price_id"),
  priceCents: integer("price_cents").notNull(),
  articleLimit: integer("article_limit").notNull(),
  keywordLimit: integer("keyword_limit").notNull(),
  siteLimit: integer("site_limit").notNull(),
  monthlyCredits: integer("monthly_credits").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  ...timestamps,
});

export const subscriptions = pgTable("subscriptions", {
  id: pk(),
  organizationId: organizationId(),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  planId: uuid("plan_id").references(() => plans.id, { onDelete: "restrict" }),
  status: text("status").default("inactive").notNull(),
  currentPeriodEnd: timestamp("current_period_end"),
  ...timestamps,
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

export const competitors = pgTable("competitors", {
  id: pk(),
  websiteId: websiteId(),
  domain: text("domain").notNull(),
  source: text("source"),
  ...timestamps,
});

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
  (table) => [index("pages_website_idx").on(table.websiteId)],
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
  (table) => [index("keywords_website_idx").on(table.websiteId)],
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
  ],
);

export const gaMetrics = pgTable("ga_metrics", {
  id: pk(),
  websiteId: websiteId(),
  pageUrl: text("page_url"),
  sessions: integer("sessions").default(0).notNull(),
  users: integer("users").default(0).notNull(),
  engagementRate: real("engagement_rate"),
  conversions: integer("conversions").default(0).notNull(),
  date: date("date").notNull(),
});

export const geoPrompts = pgTable("geo_prompts", {
  id: pk(),
  websiteId: websiteId(),
  prompt: text("prompt").notNull(),
  active: boolean("active").default(true).notNull(),
  ...timestamps,
});

export const geoResults = pgTable("geo_results", {
  id: pk(),
  geoPromptId: uuid("geo_prompt_id")
    .notNull()
    .references(() => geoPrompts.id, { onDelete: "cascade" }),
  engine: text("engine").notNull(),
  mentioned: boolean("mentioned").default(false).notNull(),
  cited: boolean("cited").default(false).notNull(),
  sourceUrl: text("source_url"),
  competitors: jsonb("competitors"),
  checkedAt: timestamp("checked_at").defaultNow().notNull(),
});

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

export const notifications = pgTable("notifications", {
  id: pk(),
  organizationId: organizationId(),
  userId: userId(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  body: text("body"),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

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
