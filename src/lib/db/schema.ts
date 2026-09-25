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

import { relations, sql } from "drizzle-orm";
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

import { organization, user } from "./auth-tables";
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
 * One subscription row per WEBSITE, enforced by the unique index on
 * website_id.
 *
 * It used to be one per organization. That changed in migration 0021 when
 * each site became separately billable — a workspace with three paid sites
 * has three rows here, all naming the same organization.
 *
 * The Stripe CUSTOMER is therefore not stored here: it belongs to the payer,
 * not to a site, and lives in `billing_customers`. See the note there for
 * what went wrong while it did live on this table.
 */
export const subscriptions = pgTable(
  "subscriptions",
  {
    id: pk(),
    organizationId: organizationId(),
    /**
     * The website this subscription pays for.
     *
     * Each website is billed separately, so a workspace with three sites has
     * three subscriptions rather than one plan covering all of them. The
     * organization is kept alongside because Stripe customers, invoices and
     * the credit ledger still belong to the person paying, not to one site.
     *
     * Nullable only so existing rows survive the migration; a subscription
     * created from here on always names its website.
     */
    websiteId: uuid("website_id").references(() => websites.id, {
      onDelete: "cascade",
    }),
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
    /**
     * One subscription per WEBSITE, not per organization. The old unique index
     * on organization_id is what made a second paid site impossible.
     */
    uniqueIndex("subscriptions_website_id_uidx").on(table.websiteId),
    index("subscriptions_organization_id_idx").on(table.organizationId),
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
 * The Stripe customer for an organization.
 *
 * WHY THIS IS NOT ON `subscriptions`: a Stripe CUSTOMER belongs to the person
 * paying, but a subscription row now belongs to one WEBSITE. Storing the
 * customer id there meant that someone who had not bought anything yet needed
 * a subscription row to hold it — a placeholder with a null website and
 * status "inactive". That was wrong twice over:
 *
 *   1. It was written with ON CONFLICT (organization_id), a unique index that
 *      migration 0021 dropped when billing moved per website. Postgres rejects
 *      an ON CONFLICT with no matching constraint, so the FIRST checkout any
 *      workspace attempted failed outright.
 *   2. getSubscription() takes one row for the org with no ordering, so even
 *      once inserted, that inactive placeholder could be returned instead of a
 *      real paid subscription — showing a paying customer as unpaid.
 *
 * One row per organization, created the first time they reach checkout.
 */
export const billingCustomers = pgTable("billing_customers", {
  organizationId: text("organization_id")
    .primaryKey()
    .references(() => organization.id, { onDelete: "cascade" }),
  /**
   * Stripe's customer id. Nullable-free: a row exists only once we have one.
   *
   * Not unique — test and live mode are separate datasets, and a workspace
   * that moves between them legitimately replaces this value.
   */
  stripeCustomerId: text("stripe_customer_id").notNull(),
  ...timestamps,
});

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
  /**
   * Whether a finished article goes live by itself.
   *
   * Off by default, deliberately. Publishing to someone's live website without
   * them looking first is not a default to opt people out of — the first
   * article they never saw is the one that reads wrong, and it is already
   * public. On, articles publish; off, they are sent as drafts for review.
   */
  autoPublish: boolean("auto_publish").default(false).notNull(),
  /**
   * Whether articles are written on a schedule or only when asked.
   *
   * "automatic" is the default for a new website: the product is sold as
   * autopilot, and a customer on a 30-article plan should not have to
   * remember to click thirty times a month.
   *
   * The migration sets existing rows to "manual" rather than taking the
   * default. Turning generation on for sites that were created before the
   * feature existed would start spending someone's plan without them asking.
   */
  generationMode: text("generation_mode").default("automatic").notNull(),
  /**
   * Weekdays articles may be generated on, 0 = Sunday. Null means every day.
   *
   * A B2B site usually does not want articles appearing on a Sunday, and a
   * schedule nobody can shape gets turned off entirely.
   */
  publishingDays: jsonb("publishing_days"),

  /* --- Article settings, from the client's design ------------------- */

  /**
   * Whether articles arrive live or as drafts.
   *
   * SEPARATE FROM autoPublish, which decides IF we publish at all. This
   * decides WHAT we publish as when we do. A customer can want articles
   * pushed automatically and still want to read them before the world does,
   * and collapsing the two would force that person to publish nothing
   * automatically.
   */
  publishAs: text("publish_as").default("live").notNull(),
  /**
   * Editorial register: "expert", "conversational", "friendly"…
   *
   * Free text rather than an enum, because the list is presentational and
   * the writer prompt reads it directly; a new style should be a line in the
   * UI, not a migration.
   */
  articleStyle: text("article_style").default("expert").notNull(),
  /** Internal links to aim for per article. */
  internalLinkTarget: integer("internal_link_target").default(3).notNull(),
  /**
   * Null means ADAPTIVE — the length is chosen per article type.
   *
   * A number forces one fixed length across every format, which is the
   * "Custom" branch of the design's toggle. Null rather than a sentinel like
   * 0 so the two states cannot be confused with "no words".
   */
  targetWordCount: integer("target_word_count"),

  /** Where the sitemap lives, for finding pages worth linking to. */
  sitemapUrl: text("sitemap_url"),
  /** The blog's own index, so new articles are filed alongside the others. */
  blogUrl: text("blog_url"),
  /** An article the customer is happy with, as a style reference. */
  exampleArticleUrl: text("example_article_url"),

  /** Hex, used in generated images. */
  brandColor: text("brand_color"),
  /** Preset id for images INSIDE the article body. */
  imageStyle: text("image_style").default("realistic").notNull(),
  /** Preset id for the cover image, chosen separately from the body style. */
  featuredImageStyle: text("featured_image_style").default("sketch").notNull(),
  /** How the brand should look in pictures, in the customer's own words. */
  imageBrief: text("image_brief"),
  /** Anything to avoid in images — "never show faces" and the like. */
  imageInstructions: text("image_instructions"),

  /** Adds a contents list built from the article's headings. */
  tableOfContents: boolean("table_of_contents").default(false).notNull(),
  /** Finds and embeds a relevant video. */
  youtubeVideo: boolean("youtube_video").default(false).notNull(),
  /** Writes in the first person, as somebody with a view. */
  authorPerspective: boolean("author_perspective").default(true).notNull(),
  /** References comparable products and tools. */
  mentionSimilarProducts: boolean("mention_similar_products")
    .default(false)
    .notNull(),
  /**
   * The "Powered by RepGet" credit line.
   *
   * Defaults ON, and the client said so explicitly. Turning it off applies
   * only to articles not yet published — a line already live on someone
   * else's site is not ours to reach back and edit.
   */
  poweredByLink: boolean("powered_by_link").default(true).notNull(),

  /** Byline shown on the article, in the dashboard and on the live page. */
  authorName: text("author_name"),
  authorBio: text("author_bio"),
  authorAvatarUrl: text("author_avatar_url"),
  /**
   * When the customer last saved Article Settings.
   *
   * The launch checklist needs to know somebody LOOKED, which is not the same
   * as somebody changing something: keeping the defaults is a legitimate
   * choice, and the step used to require a brand_voice row that only appears
   * when a voice field is filled in. Written by saveArticleSettings whatever
   * the form contained.
   */
  articleSettingsReviewedAt: timestamp("article_settings_reviewed_at"),

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
    /**
     * How many times the customer has asked for a different picture.
     *
     * Each regeneration costs a few cents and earns nothing, so it is capped.
     * Counted per article rather than per workspace: someone with thirty
     * articles a month is not abusing anything by trying twice on each.
     */
    imageAttempts: integer("image_attempts").default(0).notNull(),
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
  /**
   * A standing instruction applied to every article for this site.
   *
   * Separate from calendar_items.custom_instructions, which steers ONE
   * article. The two answer different questions: "make this piece about X" is
   * per-article, "never mention a year in a title" is a rule, and retyping a
   * rule on every article is how it gets forgotten.
   */
  articleInstructions: text("article_instructions"),
  /**
   * Up to three of the customer's own articles they are happy with.
   *
   * Asked for instead of "describe your tone", which people answer with
   * adjectives that mean nothing to a model. Three real URLs are evidence,
   * and the generator reads them rather than guessing what "professional but
   * approachable" means.
   */
  exampleArticleUrls: jsonb("example_article_urls"),
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

/**
 * Search Console clicks per page per day, from Google's PAGE report.
 *
 * gsc_metrics is broken down by page AND search term, and Google leaves rare
 * and private searches out of any report that includes the search term - so a
 * page's clicks added up from it came out far too low, and unevenly so. Losing
 * Traffic judged pages on those numbers. This is the same data grouped by page
 * only, which Google reports in full.
 */
export const gscPageMetrics = pgTable(
  "gsc_page_metrics",
  {
    id: pk(),
    websiteId: websiteId(),
    date: date("date").notNull(),
    pageUrl: text("page_url").notNull(),
    clicks: integer("clicks").default(0).notNull(),
    impressions: integer("impressions").default(0).notNull(),
    /** Google's impression-weighted average position for that page and day. */
    position: real("position"),
  },
  (table) => [
    uniqueIndex("gsc_page_metrics_unique_idx").on(
      table.websiteId,
      table.date,
      table.pageUrl,
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
/**
 * One row per website per day: the site-wide totals Google reports.
 *
 * WHY THIS EXISTS BESIDE gsc_metrics AND ga_metrics. Those hold the breakdown -
 * clicks by page and search term, sessions by page - and adding them up gives
 * the wrong total in both directions:
 *
 *  - Search Console leaves rare and private searches out of any report broken
 *    down by query, so summing gsc_metrics UNDERCOUNTS. imagestudio.com showed
 *    131 clicks where Search Console itself showed about 300 for the month.
 *  - GA4 counts a session once for every page it viewed when the report is
 *    broken down by page, so summing ga_metrics OVERCOUNTS sessions and users.
 *
 * Headline numbers read from here; the breakdown tables still feed "what
 * people searched", top pages and Losing Traffic.
 *
 * The two halves are written by separate import steps, so each is nullable: a
 * site with only Search Console connected has null GA columns, which is "not
 * connected", not "zero visits".
 */
export const siteDailyMetrics = pgTable(
  "site_daily_metrics",
  {
    id: pk(),
    websiteId: websiteId(),
    date: date("date").notNull(),
    gscClicks: integer("gsc_clicks"),
    gscImpressions: integer("gsc_impressions"),
    /** Google's own impression-weighted average position for the day. */
    gscPosition: real("gsc_position"),
    gaSessions: integer("ga_sessions"),
    gaUsers: integer("ga_users"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("site_daily_metrics_unique_idx").on(table.websiteId, table.date),
  ],
);

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
  (table) => [
    index("credit_ledger_org_idx").on(table.organizationId),
    /*
      One plan grant per workspace per billing month, enforced by the
      database. grantMonthlyCredits used to check for the month's row and then
      insert it, so two page loads at the same moment could both see "not yet"
      and grant the month's credits twice.
    */
    uniqueIndex("credit_ledger_plan_grant_unique_idx")
      .on(table.organizationId, table.referenceId)
      .where(sql`${table.type} = 'plan_grant'`),
  ],
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
/**
 * A subscription payment, from either processor.
 *
 * The brief asks for an invoice page. Stripe customers already have one — the
 * customer portal lists every invoice with a PDF — but a PayPal subscriber has
 * nothing: PayPal offers no portal API we can open on their behalf, so their
 * only record lives inside their own PayPal account.
 *
 * Recording payments as they arrive gives both providers the same in-app
 * history. Stripe's own invoice PDF stays the authoritative document and is
 * linked when we have its URL; this table is the index, not a replacement for
 * it. Nothing is reconstructed after the fact — a row exists only because a
 * webhook told us the money moved.
 */
export const payments = pgTable(
  "payments",
  {
    id: pk(),
    organizationId: organizationId(),
    /** "stripe" | "paypal". */
    provider: text("provider").notNull(),
    /**
     * The processor's own id for this payment. Unique per provider, so a
     * replayed webhook updates rather than duplicating — the same guarantee
     * addon_purchases gets from its session id.
     */
    externalId: text("external_id").notNull(),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull(),
    /** "paid" | "failed" | "refunded". */
    status: text("status").notNull(),
    /** Stripe's hosted invoice or receipt, when the event carries one. */
    invoiceUrl: text("invoice_url"),
    /** What it was for, in the customer's terms. */
    description: text("description"),
    paidAt: timestamp("paid_at").defaultNow().notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("payments_provider_external_uidx").on(
      table.provider,
      table.externalId,
    ),
    index("payments_org_paid_idx").on(table.organizationId, table.paidAt),
  ],
);

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


/* ------------------------------------------------------------------------- */
/* Administration                                                             */
/* ------------------------------------------------------------------------- */

/**
 * What an administrator did, and to whom.
 *
 * Written before the admin area could move money or delete accounts, because
 * a refund with no record is unanswerable: when a customer says they were
 * never refunded, or two operators both think the other handled it, the only
 * thing that settles it is a row written at the time.
 *
 * Append only. Nothing in the product updates or deletes these, which is the
 * point — a log that can be edited proves nothing. The actor is recorded as an
 * EMAIL rather than a user id foreign key, so removing a staff account cannot
 * erase what they did.
 */
export const adminAuditLog = pgTable(
  "admin_audit_log",
  {
    id: pk(),
    /** Who acted, from the ADMIN_EMAILS allowlist at the time. */
    actorEmail: text("actor_email").notNull(),
    /** Machine-readable kind: "payment.refunded", "credits.adjusted". */
    action: text("action").notNull(),
    /**
     * What was acted on. Deliberately loose text, not a foreign key: the row
     * must survive the thing it describes being deleted, which is exactly the
     * case an account deletion creates.
     */
    targetType: text("target_type").notNull(),
    targetId: text("target_id"),
    /** The affected workspace, when there is one. Text, like every org id. */
    organizationId: text("organization_id"),
    /** One line a human can read months later without opening the code. */
    summary: text("summary").notNull(),
    /** Anything worth keeping that does not fit the columns above. */
    detail: jsonb("detail"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("admin_audit_log_created_idx").on(table.createdAt),
    index("admin_audit_log_org_idx").on(table.organizationId, table.createdAt),
  ],
);


/* ------------------------------------------------------------------------- */
/* Website access                                                             */
/* ------------------------------------------------------------------------- */

/**
 * Who may work on one website, and in what capacity.
 *
 * Membership of the workspace says someone belongs to the account; this says
 * which sites they may touch. A freelance editor brought in for one client's
 * site should not see the others, and workspace membership alone cannot
 * express that.
 *
 * Roles:
 *   owner   the person who added the site; billing and deletion
 *   editor  may write, edit and publish articles on this site
 *   viewer  may read only
 *
 * The owner is NOT stored here. Ownership follows websites.organization_id
 * and the workspace's own owner, so it cannot be revoked by deleting a row
 * and leaving a site nobody controls.
 */
export const websiteMembers = pgTable(
  "website_members",
  {
    id: pk(),
    websiteId: websiteId(),
    /** Text, like every user reference: Better Auth ids are text. */
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** "editor" | "viewer". */
    role: text("role").default("editor").notNull(),
    /** Who granted it, for the same reason the admin log records an actor. */
    invitedBy: text("invited_by").references(() => user.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (table) => [
    // One role per person per site; a second grant updates rather than stacks.
    uniqueIndex("website_members_site_user_uidx").on(
      table.websiteId,
      table.userId,
    ),
    index("website_members_user_idx").on(table.userId),
  ],
);

/**
 * An invitation to work on one website, sent to somebody with no account yet.
 *
 * WHY NOT Better Auth's `invitation` TABLE: that one is scoped to an
 * organization, and joining a workspace is a different and larger thing than
 * being given access to a single site. A freelance editor brought in for one
 * client must not gain the others, which is the whole reason website_members
 * exists — routing invitations through the organization table would undo it.
 *
 * THE TOKEN IS STORED HASHED. It is a bearer credential: whoever holds it
 * becomes an editor on a customer's website. Storing it in the clear would
 * mean a leaked backup, a stray log line or read access to this table is
 * enough to take over a site. Only the hash is here; the token itself exists
 * in the emailed link and nowhere else — which is also why a lost invitation
 * is re-sent as a NEW one rather than recovered.
 */
export const websiteInvitations = pgTable(
  "website_invitations",
  {
    id: pk(),
    websiteId: websiteId(),
    /** Lower-cased at the call site, so a match is a plain equality test. */
    email: text("email").notNull(),
    /** "editor" | "viewer", the same two roles as websiteMembers. */
    role: text("role").default("editor").notNull(),
    /** sha256 of the token. Never the token itself. See the note above. */
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    /**
     * When it was accepted. Null while pending.
     *
     * Kept rather than deleted so the row remains a record of who let whom
     * in, which the admin log cannot reconstruct once the invitation is gone.
     */
    acceptedAt: timestamp("accepted_at"),
    invitedBy: text("invited_by").references(() => user.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (table) => [
    /**
     * One live invitation per address per site. A second invite updates the
     * row — issuing a fresh token and expiry — rather than leaving two valid
     * links, of which revoking one would silently leave the other working.
     */
    uniqueIndex("website_invitations_site_email_uidx").on(
      table.websiteId,
      table.email,
    ),
    // The accept route looks an invitation up by its hash alone.
    uniqueIndex("website_invitations_token_uidx").on(table.tokenHash),
  ],
);
