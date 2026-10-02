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
     *
     * SET NULL, not cascade: deleting a website must not delete the record of
     * what was billed for it. The provider ids on this row are what reconciles
     * a charge months later. Deletion refuses while the subscription could
     * still bill (lib/websites/deletion.ts), so a detached row has ended.
     */
    websiteId: uuid("website_id").references(() => websites.id, {
      onDelete: "set null",
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
    /**
     * The website this subscription was bought for, per our checkout's
     * provider metadata. Kept when the row is DETACHED (website_id null) - a
     * duplicate, a superseded or a deleted site's subscription - so
     * reconciliation can say which site it concerns. No foreign key: the
     * site may be gone, and that is exactly when this matters.
     */
    claimedWebsiteId: uuid("claimed_website_id"),
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
 * Every checkout a customer was sent to, and what became of it.
 *
 * Written BEFORE the redirect to Stripe or PayPal, so website and workspace
 * deletion can see a checkout that is open but not yet paid, settle it with
 * the provider, and refuse while it can still be paid. Status is "open",
 * "completed", "expired", "abandoned" or "failed" - see
 * lib/billing/checkouts.ts.
 *
 * website_id is SET NULL so the record outlives a deleted site, like the
 * subscription it may have produced.
 */
export const billingCheckouts = pgTable(
  "billing_checkouts",
  {
    id: pk(),
    organizationId: organizationId(),
    websiteId: uuid("website_id").references(() => websites.id, {
      onDelete: "set null",
    }),
    /** "stripe" | "paypal". */
    provider: text("provider").notNull(),
    planId: uuid("plan_id").references(() => plans.id, { onDelete: "set null" }),
    stripeSessionId: text("stripe_session_id"),
    /** PayPal's id from creation; Stripe's once the checkout completes. */
    providerSubscriptionId: text("provider_subscription_id"),
    status: text("status").default("open").notNull(),
    /**
     * When Stripe says the session stops accepting payment. A HINT for when
     * to ask again, never proof: a session completed a second before it
     * expired, whose webhook is late, is still a subscription.
     */
    expiresAt: timestamp("expires_at"),
    /** Where the customer was sent, so a repeated request can reuse it. */
    checkoutUrl: text("checkout_url"),
    /** Trial days this checkout offered; 0 when not eligible. */
    trialDays: integer("trial_days").default(0).notNull(),
    /**
     * The provider idempotency key the create call used, and the exact
     * request, so a process that died before recording the provider's answer
     * can replay the same call and learn what was created.
     */
    idempotencyKey: text("idempotency_key"),
    requestParams: jsonb("request_params"),
    /** The provider's own word for the checkout when last asked. */
    providerState: text("provider_state"),
    lastCheckedAt: timestamp("last_checked_at"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("billing_checkouts_stripe_session_uidx").on(table.stripeSessionId),
    index("billing_checkouts_website_status_idx").on(table.websiteId, table.status),
    index("billing_checkouts_org_status_idx").on(
      table.organizationId,
      table.status,
    ),
    index("billing_checkouts_provider_subscription_idx").on(
      table.providerSubscriptionId,
    ),
  ],
);

/**
 * Provider cancellations we owe, until the provider confirms them.
 *
 * A subscription that activates for a website or workspace that was deleted
 * must be cancelled at the provider. Doing that inline in the webhook and
 * logging a failure left the retry to "the next event", which may never
 * come. The obligation is written in the same transaction that records the
 * subscription, and lib/billing/cancellations.ts works it off with backoff -
 * straight after the webhook, and from the billing-maintenance job whether
 * or not another event ever arrives.
 *
 * One row per provider subscription: owing the same cancellation twice is
 * one obligation.
 */
export const providerCancellations = pgTable(
  "provider_cancellations",
  {
    id: pk(),
    provider: text("provider").notNull(),
    providerSubscriptionId: text("provider_subscription_id").notNull(),
    /** Why it is owed, e.g. "detached_deleted_website". */
    reason: text("reason").notNull(),
    /** pending | completed | abandoned */
    status: text("status").default("pending").notNull(),
    attempts: integer("attempts").default(0).notNull(),
    nextAttemptAt: timestamp("next_attempt_at").defaultNow().notNull(),
    /** Held while one worker is calling the provider. */
    claimToken: uuid("claim_token"),
    claimedUntil: timestamp("claimed_until"),
    lastError: text("last_error"),
    completedAt: timestamp("completed_at"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("provider_cancellations_subscription_uidx").on(
      table.provider,
      table.providerSubscriptionId,
    ),
    index("provider_cancellations_due_idx").on(table.status, table.nextAttemptAt),
  ],
);

/**
 * Every webhook event we have seen, by the processor's own event id.
 *
 * Stripe and PayPal both retry on non-2xx and can deliver duplicates even on
 * success, so handlers MUST be idempotent.
 *
 * RECEIVING AN EVENT IS NOT THE SAME AS COMPLETING IT, and conflating the two
 * is what this table's `status` column exists to fix. The row used to be
 * inserted before the handler ran, with the insert itself acting as the lock:
 * a conflict meant "already done, skip". The handler's catch deleted the row so
 * a provider retry would work, which covers a thrown error and nothing else.
 *
 * It does not cover the process DYING - a function timeout, an out-of-memory
 * kill, an instance recycled mid-request. The row was then left behind with no
 * owner and no handler, every later retry of that event id hit the gate and was
 * acknowledged as a duplicate, and the event was never processed. Nothing
 * reported it: a permanently dropped subscription change or payment, indistin-
 * guishable from one handled correctly.
 *
 * So the lifecycle is explicit: claimed ("processing"), finished ("completed"),
 * or available again ("received"). A "processing" row whose lease has expired is
 * assumed abandoned and may be reclaimed by the next delivery, so a crash heals
 * itself on the provider's next retry rather than needing a database edit.
 *
 * FINANCIAL IDEMPOTENCY DOES NOT DEPEND ON THIS TABLE. It rests on the unique
 * indexes on payments (provider, external_id) and addon_purchases
 * (stripe_session_id), so even a genuinely double-processed event cannot take
 * money twice. This table stops work being LOST; those indexes stop it being
 * DOUBLED.
 */
export const webhookEvents = pgTable(
  "webhook_events",
  {
    /** The processor's event id, e.g. Stripe "evt_...". */
    id: text("id").primaryKey(),
    provider: text("provider").notNull(),
    type: text("type").notNull(),
    payload: jsonb("payload"),
    /**
     * When the row was first written. Kept under its original name so existing
     * reads and the admin tooling are unaffected; `completedAt` is what now
     * says the work actually finished.
     */
    processedAt: timestamp("processed_at").defaultNow().notNull(),

    /**
     * "received" | "processing" | "completed".
     *
     * DEFAULTS TO "completed", which matters for the migration: every row
     * already in this table represents work that finished under the old
     * insert-is-the-lock scheme. Defaulting to "received" would present the
     * entire history as reclaimable and invite a replay of months of events.
     */
    status: text("status").default("completed").notNull(),
    /** When the current attempt took the row. Null once completed. */
    claimedAt: timestamp("claimed_at"),
    completedAt: timestamp("completed_at"),
    /**
     * Attempts so far. A row climbing this without completing is the signal
     * that an event fails every time rather than being merely slow.
     */
    attempts: integer("attempts").default(0).notNull(),
    /** Why the last attempt failed, truncated. Never a credential. */
    lastError: text("last_error"),
    /**
     * Identifies the attempt holding the claim. Completing or releasing
     * requires it, so a worker whose lease expired and was taken over cannot
     * finish or free the new owner's claim.
     */
    claimToken: uuid("claim_token"),
    /**
     * When the recovery job may next retry a released event. Recovery does
     * not wait for the provider to redeliver.
     */
    nextAttemptAt: timestamp("next_attempt_at"),
  },
  (table) => [
    /** The stale-claim sweep reads exactly these two columns. */
    index("webhook_events_status_claimed_idx").on(table.status, table.claimedAt),
  ],
);

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
   * Whether a finished article goes out by itself (with publishAs, the
   * publishing mode - see lib/publishing/policy.ts).
   *
   * The COLUMN default stays off. New websites get "Publish live on the
   * planned day" (the client's decision) from the application, which writes
   * it explicitly when it creates a website - see
   * lib/websites/new-site-defaults.ts. A database default would also reach
   * websites created by an older build still running during a deploy or
   * after a rollback, which knows nothing of the review gate.
   */
  autoPublish: boolean("auto_publish").default(false).notNull(),
  /**
   * When this website's first article was sent to its site; null until then.
   *
   * The first article is published as soon as it is written whatever the
   * publishing setting says (lib/publishing/policy.ts), and this makes that
   * happen once. Set by every publishing path when a post is created.
   */
  firstArticleSentAt: timestamp("first_article_sent_at"),
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

  /**
   * Adds a contents list built from the article's headings. On for new
   * websites, written by the application (lib/websites/new-site-defaults.ts).
   */
  tableOfContents: boolean("table_of_contents").default(false).notNull(),
  /** Finds and embeds a relevant video. */
  youtubeVideo: boolean("youtube_video").default(false).notNull(),
  /** Writes in the first person, as somebody with a view. */
  authorPerspective: boolean("author_perspective").default(true).notNull(),
  /**
   * References comparable products and tools. On for new websites, written
   * by the application (lib/websites/new-site-defaults.ts).
   */
  mentionSimilarProducts: boolean("mention_similar_products")
    .default(false)
    .notNull(),
  /**
   * Writes one comparison table into each article - "Videography vs
   * Cinematography at a Glance" (client, 2026-10-02: important for reach).
   * Defaults ON in the database as well, so websites that existed before it
   * get it too; a build that predates it never writes tables, so the default
   * cannot change what an older build does.
   */
  comparisonTable: boolean("comparison_table").default(true).notNull(),
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
     * When RepGet first saw this article LIVE on the customer's site (a
     * delivery the CMS stored as published). Not set by a draft delivery, an
     * edit or a republish. Null: not live yet, or live before this was
     * recorded and the date cannot be established (migration 0045).
     */
    firstLiveAt: timestamp("first_live_at"),
    /**
     * "publish" or "draft" when somebody pressed Publish on a website that is
     * connected only through the WordPress plugin; null otherwise.
     *
     * The plugin PULLS articles, so a Publish press cannot push anything - it
     * is recorded here and the plugin's next check collects it with this
     * status. Cleared when the plugin reports the post created.
     */
    publishRequested: text("publish_requested"),
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
    /**
     * The RepGet team's review, for articles written for a website in the
     * managed Partner Network (lib/articles/review.ts).
     *
     * null      not in the managed workflow - published by the ordinary rules.
     *           Every article written before this existed stays null.
     * pending   written, waiting for an administrator to prepare and approve
     *           it. Held by every publishing path.
     * approved  released for delivery, but ONLY while the article still
     *           hashes to reviewApprovedHash: an edit after approval holds it
     *           again, so no job can publish a revision nobody approved.
     */
    reviewStatus: text("review_status"),
    /** Bumped by every review change, so two administrators cannot overwrite each other. */
    reviewVersion: integer("review_version").default(0).notNull(),
    reviewApprovedAt: timestamp("review_approved_at"),
    /** The approving administrator's email (as admin_audit_log records actors). */
    reviewApprovedBy: text("review_approved_by"),
    /** SHA-256 of the approved title, body and image. See reviewHashSql. */
    reviewApprovedHash: text("review_approved_hash"),
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

/**
 * One pending OAuth authorization, for the Google Search Console/Analytics
 * connect flow.
 *
 * WHY A TABLE RATHER THAN A SIGNED STRING. The state parameter used to be an
 * HMAC over "<websiteId>.<nonce>.<origin>", which proved the link came from us
 * and nothing else. A signature is not a session and it is not single-use, so
 * that state was:
 *
 *  - REPLAYABLE for ever. It never expired, and nothing recorded that it had
 *    been used, so one captured callback URL could be redeemed repeatedly.
 *  - NOT BOUND TO THE PERSON WHO STARTED IT. Anybody holding the URL could
 *    complete a connection someone else initiated, attaching their own Google
 *    account to that website.
 *  - UNABLE TO CARRY A PKCE VERIFIER, which by definition must be kept server
 *    side and never travel through the browser.
 *
 * The nonce was `Math.random()` as well, which is not a CSPRNG.
 *
 * Rows are consumed exactly once by a conditional UPDATE (see
 * lib/analytics/oauth-state.ts), so a replay finds nothing to consume. Expired
 * and consumed rows are pruned by the same helper rather than a scheduled job:
 * the flow is low volume and a sweep on use keeps the table self-maintaining.
 */
export const oauthStates = pgTable(
  "oauth_states",
  {
    /**
     * The state value sent to the provider: 32 random bytes, base64url.
     *
     * The primary key, so two requests cannot share one and an insert is the
     * allocation. Not a uuid: this is a bearer value that travels through the
     * provider and back, and it wants full entropy rather than a version-4
     * layout.
     */
    state: text("state").primaryKey(),
    /** Which provider this belongs to; "google" today. */
    provider: text("provider").notNull(),
    websiteId: uuid("website_id")
      .notNull()
      .references(() => websites.id, { onDelete: "cascade" }),
    /**
     * Who started it. The callback refuses unless the same user completes it,
     * which is what stops a forwarded callback URL working.
     */
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /**
     * The session that started it, so signing out and back in — or another of
     * the same person's browsers — cannot finish somebody else's flow.
     */
    sessionId: text("session_id"),
    /** "app" | "onboarding": which screen to return to. Never a URL. */
    origin: text("origin").default("app").notNull(),
    /**
     * PKCE verifier, kept server side and sent only to the token endpoint.
     * Nullable so a row written before PKCE still verifies.
     */
    codeVerifier: text("code_verifier"),
    /** Short: a consent screen is completed in seconds, not hours. */
    expiresAt: timestamp("expires_at").notNull(),
    /** Set by the single-use consume; a second attempt finds it non-null. */
    consumedAt: timestamp("consumed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("oauth_states_expires_idx").on(table.expiresAt),
    index("oauth_states_website_idx").on(table.websiteId),
  ],
);

export const publishLogs = pgTable("publish_logs", {
  id: pk(),
  articleId: uuid("article_id")
    .notNull()
    .references(() => articles.id, { onDelete: "cascade" }),
  integrationId: uuid("integration_id").references(() => integrations.id, {
    onDelete: "set null",
  }),
  /**
   * "published" means DELIVERED to the CMS - not necessarily live. It keeps
   * that meaning because earlier builds find a post to update by it (and a
   * rolled-back build still does). What the CMS actually stored is
   * remoteStatus.
   */
  status: text("status").notNull(),
  remoteId: text("remote_id"),
  remoteUrl: text("remote_url"),
  /**
   * The post status the CMS reported ("publish", "draft", "future", ...).
   * Null on rows written before it was recorded: unknown, never assumed live.
   */
  remoteStatus: text("remote_status"),
  /** The dispatch this row records. One "published" row per dispatch, so a repeated report logs once. */
  dispatchId: uuid("dispatch_id").references(() => publicationDispatches.id, { onDelete: "set null" }),
  error: text("error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("publish_logs_dispatch_uidx").on(table.dispatchId).where(sql`${table.dispatchId} is not null and ${table.status} = 'published'`),
]);

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
  /**
   * The owner's minimum for sites that link TO this website, on the scale of
   * the platform's authority metric (lib/authority/metric.ts - DataForSEO
   * Rank, 0-100). Null: no preference. The admin placement workflow enforces
   * it (lib/backlinks/managed.ts); a host whose metric is unknown cannot
   * satisfy a minimum.
   */
  minSourceRank: integer("min_source_rank"),
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
    /**
     * Stable id of the business operation this movement belongs to, e.g.
     * "purchase:<purchaseId>" or "placement:<id>:charge". Unique, so a
     * retried or concurrent delivery writes the movement once. Null for
     * rows written before it existed and for admin adjustments.
     */
    idempotencyKey: text("idempotency_key"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("credit_ledger_org_idx").on(table.organizationId),
    uniqueIndex("credit_ledger_idempotency_uidx")
      .on(table.idempotencyKey)
      .where(sql`${table.idempotencyKey} is not null`),
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
  /**
   * pending   - matched to a host, waiting for an article.
   * drafted   - the link is in a generated article that is not live yet.
   * published - the article is live at liveUrl; the link is not yet seen.
   * live      - the link was seen at liveUrl; credits moved.
   * removed   - a live link repeatedly missing; credits returned.
   * unverified- published, but the link was never seen; nothing charged.
   * See lib/backlinks/placements.ts.
   */
  status: text("status").default("pending").notNull(),
  /**
   * Placed by an administrator in the managed Partner Network, rather than by
   * automatic matching. Same lifecycle and credits; see lib/backlinks/managed.ts.
   */
  managed: boolean("managed").default(false).notNull(),
  /** The administrator who placed it (email), for managed placements. */
  createdBy: text("created_by"),
  /** Why this host, target and amount - written by the administrator. */
  reason: text("reason"),
  lastVerifiedAt: timestamp("last_verified_at"),
  /**
   * When the beneficiary last asked for an early re-check. Rate-limits the
   * request (lib/reporting/recheck.ts); it never moves credits by itself.
   */
  recheckRequestedAt: timestamp("recheck_requested_at"),
  publishedAt: timestamp("published_at"),
  liveAt: timestamp("live_at"),
  removedAt: timestamp("removed_at"),
  ...timestamps,
});

/**
 * Pages on a website its owner wants backlinks to, in priority order.
 *
 * PREFERENCES, not orders: the RepGet team reads these when placing links
 * (lib/backlinks/managed.ts). Nothing here reserves credits or starts
 * matching - that happens only when an administrator commits a placement.
 */
export const backlinkTargets = pgTable(
  "backlink_targets",
  {
    id: pk(),
    websiteId: websiteId(),
    /** A page on this website, verified to exist when it was added. */
    url: text("url").notNull(),
    /** What the page is, in the owner's words. */
    note: text("note"),
    /** high | medium | low. */
    priority: text("priority").default("medium").notNull(),
    /** Order within the list, lowest first. */
    position: integer("position").default(0).notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex("backlink_targets_site_url_uidx").on(table.websiteId, table.url)],
);

export const linkChecks = pgTable("link_checks", {
  id: pk(),
  placementId: uuid("placement_id")
    .notNull()
    .references(() => placements.id, { onDelete: "cascade" }),
  alive: boolean("alive").default(false).notNull(),
  httpStatus: integer("http_status"),
  /**
   * alive | missing | error. Only "missing" - the page answered and the link
   * was not on it - counts toward removal; an outage ("error") does not.
   * Null on rows written before the distinction existed.
   */
  outcome: text("outcome"),
  /**
   * The rel attribute of the matching link as found on the live page
   * ("noopener nofollow", "" for none). Null when no link was found or the
   * row predates it - unknown, not "followed".
   */
  rel: text("rel"),
  /** Why an "error" check failed (timeout, DNS), trimmed. No page content. */
  error: text("error"),
  checkedAt: timestamp("checked_at").defaultNow().notNull(),
});

/* ------------------------------------------------------------------------- */
/* Authority metrics and value estimates                                       */
/* ------------------------------------------------------------------------- */

/**
 * One provider metric for one domain, as last collected.
 *
 * A FACT ABOUT A PUBLIC DOMAIN, not about a tenant - like provider_cache it
 * is shared, so a domain linked from ten websites costs one lookup. What is
 * stored is exactly what the provider said and when: its metric name and
 * native scale travel with the value, so a DataForSEO Rank is never shown as
 * another company's score. Missing data stays missing: `value` is null until
 * a lookup succeeds, and `status` says why.
 *
 * status: pending (queued, never collected) | ok | no_data (the provider
 * knows no backlinks for the domain) | no_access (the account lacks the API,
 * e.g. DataForSEO 40204) | error (temporary; retried later).
 */
export const domainMetrics = pgTable(
  "domain_metrics",
  {
    id: pk(),
    domain: text("domain").notNull(),
    provider: text("provider").notNull(),
    metric: text("metric").notNull(),
    /** The top of the provider's scale for this value, e.g. 100. */
    scaleMax: integer("scale_max").notNull(),
    value: integer("value"),
    status: text("status").default("pending").notNull(),
    error: text("error"),
    /** When the provider's value was obtained. Null until one is. */
    observedAt: timestamp("observed_at"),
    /** Last collection attempt, successful or not. */
    attemptedAt: timestamp("attempted_at"),
    attempts: integer("attempts").default(0).notNull(),
    /** Not collected again before this. */
    nextAttemptAt: timestamp("next_attempt_at").defaultNow().notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("domain_metrics_domain_metric_uidx").on(table.domain, table.provider, table.metric),
    index("domain_metrics_due_idx").on(table.nextAttemptAt),
  ],
);

/**
 * How RepGet estimates the equivalent value of traffic and backlinks.
 *
 * VERSIONED and append-only: a figure on a report can always be traced to
 * the policy that produced it, and changing the rates is a new row, not an
 * edit that silently rewrites every past number. The policy in force is the
 * newest whose effectiveFrom has passed. No row: no estimate is shown
 * ("Estimate not configured") - RepGet never invents market prices.
 */
export const valuationPolicies = pgTable(
  "valuation_policies",
  {
    id: pk(),
    version: integer("version").notNull(),
    /** ISO 4217, e.g. "USD". Every rate below is in this currency. */
    currency: text("currency").notNull(),
    /**
     * keyword_cpc: each generated article's Search Console clicks times the
     *   cost per click of the keyword it targets (DataForSEO reports USD, so
     *   only a USD policy can use it);
     * fixed: those clicks times fixedClickRate;
     * none: traffic is not valued.
     */
    clickValueMode: text("click_value_mode").default("none").notNull(),
    fixedClickRate: numeric("fixed_click_rate", { precision: 10, scale: 2 }),
    /**
     * Value of ONE verified received backlink, by source authority band:
     * [{ "minRank": 0-100 | null, "value": number }]. The band with the
     * highest minRank at or below the source's rank applies; minRank null is
     * the rate for a source whose rank is unknown. Empty: not valued.
     */
    backlinkRates: jsonb("backlink_rates").default([]).notNull(),
    /** Where the rates come from, in words. Required. */
    sources: text("sources").notNull(),
    notes: text("notes"),
    effectiveFrom: timestamp("effective_from").notNull(),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("valuation_policies_version_uidx").on(table.version)],
);

/* ------------------------------------------------------------------------- */
/* Publication control                                                         */
/* ------------------------------------------------------------------------- */

/**
 * Operator switches that every publishing path reads at dispatch time.
 *
 *   publication_freeze - when enabled, NOTHING is sent to a customer's site:
 *     direct publishing, the plugin feed, scheduled and queued jobs all hold
 *     at their dispatch boundary. For incidents and for rollback.
 *   managed_review     - when enabled, new drafts on Partner Network websites
 *     enter the RepGet team's review. Off until an operator enables it once a
 *     deploy has completed, so no article is held for review while an older
 *     build that ignores the review gate may still be running.
 *
 * A missing row means disabled.
 */
export const platformControls = pgTable("platform_controls", {
  key: text("key").primaryKey(),
  enabled: boolean("enabled").default(false).notNull(),
  reason: text("reason"),
  updatedBy: text("updated_by"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/**
 * One attempt to send one revision of an article to a customer's site.
 *
 * THE DISPATCH BOUNDARY (lib/publishing/dispatch.ts). Every external send -
 * each direct-publish attempt, each plugin hand-over - first claims a row
 * here, in the transaction that locks the article and re-checks the review
 * gate, the exact revision, the schedule and the freeze. From that commit
 * the revision is IN FLIGHT: it may reach the site and can no longer be
 * recalled, so edits and review changes are refused until the outcome is
 * recorded. At most one in-flight row per article, enforced by the database.
 *
 * status: in_flight -> sent | failed (the site provably refused; nothing
 * created) | uncertain (a direct send with no answer: the post may exist; it
 * is resolved only by finding the post by its marker or by an audited
 * decision) | expired (a plugin hand-over whose lease ran out unacknowledged;
 * it may still be acknowledged - "abandoned" in rows before 0045) | released
 * (an operator released an unacknowledged legacy-plugin hand-over).
 * A lease running out is NOT completion: expired and uncertain rows are
 * outstanding until settled.
 */
export const publicationDispatches = pgTable(
  "publication_dispatches",
  {
    id: pk(),
    articleId: uuid("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    websiteId: websiteId(),
    /** direct | plugin */
    channel: text("channel").notNull(),
    /** Why it was sent: manual | automatic | first_article | approval | connection | plugin. */
    trigger: text("trigger").notNull(),
    /** reviewHash() of the revision sent (lib/articles/review.ts). */
    revisionHash: text("revision_hash").notNull(),
    /** publish | draft, as requested. */
    requestedStatus: text("requested_status").notNull(),
    status: text("status").default("in_flight").notNull(),
    /** The job run or request that owns it. */
    owner: text("owner"),
    /**
     * direct | plugin_v2 (the plugin echoes this dispatch's id) |
     * plugin_legacy (plugins before 1.6.0: correlated by article, and only
     * one revision may be outstanding at a time).
     */
    protocol: text("protocol"),
    /** The direct integration the request went to. Reconciliation uses it, not whatever is connected later. */
    integrationId: uuid("integration_id"),
    /**
     * What was sent, captured before sending: title, slug, requested status,
     * content hash and the ownership marker. Reconciling an old dispatch reads
     * this, never the article's current (mutable) fields.
     */
    requestSnapshot: jsonb("request_snapshot"),
    remoteId: text("remote_id"),
    remoteUrl: text("remote_url"),
    /** The post status the CMS reported for this delivery. */
    remoteStatus: text("remote_status"),
    /** Settled after a newer dispatch of the article existed: history, not current delivery. */
    late: boolean("late").default(false).notNull(),
    /** Ownership lookups run for an uncertain send, the last one, and what it found. */
    lookupAttempts: integer("lookup_attempts").default(0).notNull(),
    lastLookupAt: timestamp("last_lookup_at"),
    /** none | found | ambiguous | error */
    lookupResult: text("lookup_result"),
    /** An explicit, audited decision by a person (who, when, why). */
    reconciledBy: text("reconciled_by"),
    reconciledAt: timestamp("reconciled_at"),
    reconcileNote: text("reconcile_note"),
    error: text("error"),
    claimedAt: timestamp("claimed_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
  },
  (table) => [
    index("publication_dispatches_article_idx").on(table.articleId, table.claimedAt),
    uniqueIndex("publication_dispatches_in_flight_uidx")
      .on(table.articleId)
      .where(sql`${table.status} = 'in_flight'`),
  ],
);

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
 * Spend reservations: how many paid calls one key has claimed in one window.
 *
 * Taken BEFORE the paid call, in one atomic upsert, so simultaneous requests
 * cannot all read "under the limit" and then all spend — which counting
 * usage_events cannot prevent, because those are written after the call
 * finishes. See lib/billing/spend-quota.ts.
 *
 * Keys are opaque strings ("public-meta:global", "article-rewrite:<site>");
 * nothing here is tenant data, and anonymous callers appear only as a hash.
 */
export const spendQuotas = pgTable(
  "spend_quotas",
  {
    id: pk(),
    key: text("key").notNull(),
    windowStart: timestamp("window_start").notNull(),
    used: integer("used").default(0).notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("spend_quotas_key_window_key").on(table.key, table.windowStart),
    index("spend_quotas_window_idx").on(table.windowStart),
  ],
);

/**
 * One row per spend reservation: capacity for a paid call, taken before it.
 *
 * Supersedes spend_quotas, whose shared counter let a repeated release hand
 * back somebody else's slot. Each row moves reserved → consumed | released
 * through guarded updates; see lib/billing/spend-quota.ts.
 *
 * A LEDGER: no foreign keys, so deleting an article or a website does not
 * give its allowance back.
 */
export const spendReservations = pgTable(
  "spend_reservations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: text("key").notNull(),
    operation: text("operation").notNull(),
    /** The organization that pays: the website's owner. */
    organizationId: text("organization_id"),
    websiteId: uuid("website_id"),
    /** reserved | consumed | released */
    state: text("state").default("reserved").notNull(),
    /** The rule it was admitted under, so a late job can re-check it. */
    limitValue: integer("limit_value").notNull(),
    windowSeconds: integer("window_seconds"),
    windowSince: timestamp("window_since"),
    /** When the capacity was taken; window counting uses this. */
    countedAt: timestamp("counted_at").defaultNow().notNull(),
    /** paid | ambiguous | legacy, set on consume */
    spendOutcome: text("spend_outcome"),
    consumedAt: timestamp("consumed_at"),
    releasedAt: timestamp("released_at"),
    releaseReason: text("release_reason"),
    /**
     * Set, durably, BEFORE the paid call is made. From then on the
     * reservation can never be released: the provider may have billed even
     * if the process dies, the consume write fails or the job fails later.
     * `spendToken` identifies the attempt that set it, so only that attempt
     * may clear it again on a provable refusal.
     */
    spendStartedAt: timestamp("spend_started_at"),
    spendToken: uuid("spend_token"),
    /** What was paid for, e.g. the article id. Makes the baseline idempotent. */
    subjectId: text("subject_id"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("spend_reservations_key_counted_idx").on(table.key, table.countedAt),
    index("spend_reservations_state_created_idx").on(table.state, table.createdAt),
    /** One reservation per operation and subject: one baseline row per article. */
    uniqueIndex("spend_reservations_subject_uidx")
      .on(table.operation, table.key, table.subjectId)
      .where(sql`${table.subjectId} is not null`),
  ],
);

/** An expiring single-holder lease, released only by its holder. */
export const operationLeases = pgTable("operation_leases", {
  key: text("key").primaryKey(),
  holder: uuid("holder").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  acquiredAt: timestamp("acquired_at").defaultNow().notNull(),
});

/**
 * Background jobs we have promised to run: a transactional outbox.
 *
 * Written in the SAME transaction as the business change that needs the job
 * (an article queued, a website added), so the two commit together or not
 * at all. Delivery to Inngest happens after commit and is retried with
 * backoff until Inngest accepts it, by the request itself and by the
 * job-outbox cron - a queue outage delays work instead of stranding it.
 * `eventId` is also the Inngest event id, so a delivery repeated after a
 * lost acknowledgement is de-duplicated there. See lib/jobs/outbox.ts.
 */
export const jobOutbox = pgTable(
  "job_outbox",
  {
    id: pk(),
    /** Stable: the Inngest event id. */
    eventId: text("event_id").notNull(),
    name: text("name").notNull(),
    data: jsonb("data").notNull(),
    /** pending | sent | failed */
    status: text("status").default("pending").notNull(),
    attempts: integer("attempts").default(0).notNull(),
    nextAttemptAt: timestamp("next_attempt_at").defaultNow().notNull(),
    /** Held while one worker is sending. */
    claimToken: uuid("claim_token"),
    claimedUntil: timestamp("claimed_until"),
    lastError: text("last_error"),
    sentAt: timestamp("sent_at"),
    failedAt: timestamp("failed_at"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("job_outbox_event_uidx").on(table.eventId),
    index("job_outbox_due_idx").on(table.status, table.nextAttemptAt),
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
    /**
     * The plugin's "check now" address on the customer's site (1.4.0+),
     * which RepGet calls so Publish publishes immediately. Only ever an
     * admin-ajax.php URL on the website's own domain; see lib/plugin/sync.ts.
     */
    syncUrl: text("sync_url"),
    /**
     * WHICH WordPress install the key belongs to, for Disconnect
     * (app/api/plugin/disconnect): the WordPress that asked a one-click
     * connect for it, or else the first check-now address reported with it.
     * Set once and never overwritten - unlike syncUrl, which follows whoever
     * reported last: a staging copy of the site reports the same key from its
     * own address, and must never become "the install". Any well-formed
     * admin-ajax.php address, on any host: it identifies, it is never called.
     */
    installUrl: text("install_url"),
    /** When installUrl was set, on the database clock. */
    installSince: timestamp("install_since"),
    /** The last time a DIFFERENT address reported this key: a copy of the site, or a move. */
    otherInstallAt: timestamp("other_install_at"),
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

/**
 * One-click WordPress connection requests (plugin 1.7.0+): the handshake in
 * docs/wordpress-connect.md, which hands the plugin a key server to server so
 * nobody copies one. Short-lived; expired rows are deleted as new ones are
 * written (lib/plugin/connect.ts).
 */
export const pluginConnectRequests = pgTable(
  "plugin_connect_requests",
  {
    /** 32 random bytes, base64url: the only value that appears in RepGet URLs. */
    id: text("id").primaryKey(),
    /** "repget" (started from the Integrations card) or "wordpress" (started in the plugin). */
    origin: text("origin").notNull(),
    /** Known up front for "repget"; chosen on approval for "wordpress". */
    websiteId: uuid("website_id").references(() => websites.id, { onDelete: "cascade" }),
    createdByUserId: text("created_by_user_id"),
    createdSessionId: text("created_session_id"),
    /**
     * "repget" only: the key "Connect WordPress" made in the same press, for
     * plugin 1.6. Plugin 1.7 never uses it, so it is revoked when the
     * handshake issues the real key, and never counted against the cap.
     */
    linkKeyId: uuid("link_key_id").references(() => integrationKeys.id, { onDelete: "set null" }),
    /* Registered by the plugin, server to server (connect/start). */
    siteUrl: text("site_url"),
    siteHost: text("site_host"),
    returnUrl: text("return_url"),
    pluginState: text("plugin_state"),
    /** PKCE S256 challenge: base64url(sha256(verifier)); the verifier never leaves WordPress. */
    codeChallenge: text("code_challenge"),
    pluginVersion: text("plugin_version"),
    /**
     * Hash of the address that called start (the WordPress server): open
     * requests are capped per caller, since start needs no credentials.
     */
    callerHash: text("caller_hash"),
    /** The key the plugin held when it started, if valid: revoked once the new key verifies, if it belongs to another website. */
    presentedKeyId: uuid("presented_key_id").references(() => integrationKeys.id, { onDelete: "set null" }),
    /** The first RepGet session that opened the confirmation page. */
    viewerSessionId: text("viewer_session_id"),
    approvedByUserId: text("approved_by_user_id"),
    approvedAt: timestamp("approved_at"),
    /** SHA-256 of the one-time code; the code itself is never stored. */
    codeHash: text("code_hash"),
    codeExpiresAt: timestamp("code_expires_at"),
    consumedAt: timestamp("consumed_at"),
    issuedKeyId: uuid("issued_key_id").references(() => integrationKeys.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at").notNull(),
  },
  (table) => [
    index("plugin_connect_requests_expires_idx").on(table.expiresAt),
    index("plugin_connect_requests_caller_idx").on(table.callerHash),
    index("plugin_connect_requests_issued_key_idx").on(table.issuedKeyId),
  ],
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
    /**
     * The provider subscription this payment belongs to, as the provider
     * reported it (Stripe invoice parent, PayPal billing agreement). What a
     * refund-with-cancellation must cancel - never "the newest subscription
     * in the workspace". Null on rows recorded before it was kept.
     */
    providerSubscriptionId: text("provider_subscription_id"),
    /** Our row for that subscription, when it was recorded. */
    subscriptionId: uuid("subscription_id").references(() => subscriptions.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("payments_provider_external_uidx").on(
      table.provider,
      table.externalId,
    ),
    index("payments_org_paid_idx").on(table.organizationId, table.paidAt),
    index("payments_provider_subscription_idx").on(table.providerSubscriptionId),
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

/**
 * RepGet's own blog (/blog), written and published by administrators in the
 * admin panel (lib/admin/blog.ts). The first posts were constants in the
 * source; migration 0046 moved them here.
 *
 * Only `published` posts are public. The slug is the post's permanent
 * address: it cannot change once the post has been published, because every
 * link to it and whatever ranking it has earned depend on it.
 */
export const blogPosts = pgTable(
  "blog_posts",
  {
    id: pk(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    /** Meta description and card summary. */
    description: text("description").default("").notNull(),
    /** A blog_categories name. */
    category: text("category").notNull(),
    author: text("author").notNull(),
    /** Plain text, shown above the article. */
    shortAnswer: text("short_answer"),
    /** Sanitised on every save (lib/articles/sanitize.ts). */
    bodyHtml: text("body_html").default("").notNull(),
    /** Each answer is sanitised HTML, like the body. */
    faqs: jsonb("faqs")
      .$type<{ question: string; answer: string }[]>()
      .default([])
      .notNull(),
    sources: jsonb("sources")
      .$type<{ label: string; url: string }[]>()
      .default([])
      .notNull(),
    /** "draft" | "published". */
    status: text("status").default("draft").notNull(),
    /**
     * First publication. Kept when a post is unpublished, so its date stays
     * true and its slug stays locked if it comes back.
     */
    publishedAt: timestamp("published_at"),
    /** Last revision after publication: "Updated" on the post, and dateModified. */
    revisedAt: timestamp("revised_at"),
    /** Bumped on every save: a save made from an older copy is refused. */
    version: integer("version").default(0).notNull(),
    /** Administrators' email addresses. */
    createdBy: text("created_by"),
    updatedBy: text("updated_by"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("blog_posts_slug_uidx").on(table.slug),
    index("blog_posts_status_published_idx").on(table.status, table.publishedAt),
  ],
);

/**
 * The blog's categories, managed in Admin -> Blog (lib/admin/blog.ts).
 *
 * They used to be three constants in the code (Guides, Comparisons,
 * Playbooks); the client asked to add categories himself (2026-10-01).
 * Migration 0048 creates this table with those three.
 *
 * A post names its category by `name` (blog_posts.category), as it always
 * did; renaming a category renames it on its posts in the same transaction.
 * The slug is the category page's address (/blog/category/<slug>): set when
 * the category is created and never changed, like a published post's.
 */
export const blogCategories = pgTable(
  "blog_categories",
  {
    id: pk(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    /** One line under the category's heading, and its meta description. */
    blurb: text("blurb").default("").notNull(),
    /** Order on the blog index and in the editor. */
    sortOrder: integer("sort_order").default(0).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("blog_categories_name_uidx").on(table.name),
    uniqueIndex("blog_categories_slug_uidx").on(table.slug),
  ],
);
