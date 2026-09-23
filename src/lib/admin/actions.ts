"use server";

import {
  and,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNull,
  or,
  sql as raw,
} from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/admin/guard";
import { ADMIN_PAGE_SIZE, sinceFrom, type Page } from "@/lib/admin/shared";
import { db } from "@/lib/db";
import {
  articles,
  member,
  organization,
  payments,
  plans,
  subscriptions,
  usageEvents,
  user,
  websiteMembers,
  websites,
} from "@/lib/db/schema";
import { sanitizeHtml, countWords } from "@/lib/articles/generate";
import type { ActionResult } from "@/lib/websites/actions";

/**
 * Administrator queries.
 *
 * These deliberately read ACROSS organizations, which every other query in the
 * codebase is written to prevent. That is the point of the feature — the
 * operator needs to review articles from every site — but it means every
 * function here must begin with requireAdmin(), without exception. A missing
 * guard is a full cross-tenant data leak rather than a bug in one page.
 */

export type PlatformStats = {
  organizations: number;
  users: number;
  websites: number;
  articles: number;
  publishedArticles: number;
  activeSubscriptions: number;
  monthlyRevenueCents: number;
  providerCostUsd: number;
};

export async function getPlatformStats(): Promise<PlatformStats> {
  await requireAdmin();

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [counts] = await db
    .select({
      organizations: raw<number>`(select count(*) from organization)::int`,
      users: raw<number>`(select count(*) from "user")::int`,
      websites: raw<number>`(select count(*) from websites)::int`,
      articles: raw<number>`(select count(*) from articles)::int`,
      publishedArticles: raw<number>`(select count(*) from articles where status = 'published')::int`,
    })
    .from(raw`(select 1) as _`);

  /**
   * Revenue counts only entitled subscriptions. Counting cancelled ones would
   * overstate the figure the operator uses to judge the business.
   */
  const [revenue] = await db
    .select({
      active: raw<number>`count(*)::int`,
      cents: raw<number>`coalesce(sum(${plans.priceCents}), 0)::int`,
    })
    .from(subscriptions)
    .innerJoin(plans, eq(subscriptions.planId, plans.id))
    .where(raw`${subscriptions.status} in ('active', 'trialing', 'past_due')`);

  const [cost] = await db
    .select({
      total: raw<number>`coalesce(sum(${usageEvents.costUsd}), 0)::float`,
    })
    .from(usageEvents)
    .where(raw`${usageEvents.createdAt} >= ${monthStart.toISOString()}::timestamp`);

  return {
    organizations: counts?.organizations ?? 0,
    users: counts?.users ?? 0,
    websites: counts?.websites ?? 0,
    articles: counts?.articles ?? 0,
    publishedArticles: counts?.publishedArticles ?? 0,
    activeSubscriptions: revenue?.active ?? 0,
    monthlyRevenueCents: revenue?.cents ?? 0,
    providerCostUsd: cost?.total ?? 0,
  };
}

export type AdminOrganization = {
  id: string;
  name: string;
  createdAt: Date;
  memberCount: number;
  websiteCount: number;
  articleCount: number;
  planName: string | null;
  status: string | null;
  ownerEmail: string | null;
  /** True when this is one of our own workspaces, not a customer's. */
  isAgency: boolean;
};

export async function listOrganizations(
  search = "",
  page = 1,
  filters: { status?: string; kind?: string } = {},
): Promise<Page<AdminOrganization>> {
  await requireAdmin();

  const conditions = [];
  if (search) conditions.push(ilike(organization.name, `%${search}%`));

  /**
   * Subscription status.
   *
   * "none" is its own case rather than a status value: a workspace that never
   * subscribed has no row to match, so it needs IS NULL. Without it an
   * operator looking for accounts that never paid gets nothing back.
   */
  if (filters.status && filters.status !== "all") {
    conditions.push(
      filters.status === "none"
        ? isNull(subscriptions.status)
        : eq(subscriptions.status, filters.status),
    );
  }

  /**
   * Ours or a customer's. Agency workspaces skew every count on this page,
   * and separating them is the first thing anyone reading the list wants.
   */
  if (filters.kind === "agency") {
    conditions.push(
      raw`exists(select 1 from agency_workspaces ag where ag.organization_id = ${organization.id})`,
    );
  } else if (filters.kind === "customer") {
    conditions.push(
      raw`not exists(select 1 from agency_workspaces ag where ag.organization_id = ${organization.id})`,
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  /**
   * The count joins the same tables as the rows below.
   *
   * It used to select from `organization` alone, which was fine while the only
   * filter was a name. A status filter references `subscriptions`, so without
   * the join the count query cannot see the column it is filtering on.
   *
   * DISTINCT because the join multiplies: billing is per website now, so a
   * workspace paying for three sites holds three subscription rows and would
   * be counted three times. That is not visible in today's data — every
   * workspace has at most one — which is exactly why it is worth fixing here
   * rather than discovering it the day a customer buys a second site. The
   * rows below are unaffected: they are limited and keyed by workspace.
   */
  const [counted] = await db
    .select({ n: raw<number>`count(distinct ${organization.id})::int` })
    .from(organization)
    .leftJoin(subscriptions, eq(subscriptions.organizationId, organization.id))
    .where(where);

  const rows = await db
    .select({
      id: organization.id,
      name: organization.name,
      createdAt: organization.createdAt,
      /**
       * One subscription per workspace, chosen rather than joined.
       *
       * The left join here produced a ROW PER SUBSCRIPTION. Billing is per
       * website now, so a workspace paying for three sites appeared three
       * times in the list and consumed three of the twenty-five slots on the
       * page. Verified against the database: adding a second subscription to
       * one workspace made it appear twice.
       *
       * Active first, then newest, so a workspace with a live plan and an old
       * canceled one reports the live one. Subqueries rather than DISTINCT ON
       * because the answer has to survive the pagination below.
       */
      planName: raw<string | null>`(
        select p.name from subscriptions s
        join plans p on p.id = s.plan_id
        where s.organization_id = ${organization.id}
        order by (s.status = 'active') desc, s.created_at desc
        limit 1
      )`,
      status: raw<string | null>`(
        select s.status from subscriptions s
        where s.organization_id = ${organization.id}
        order by (s.status = 'active') desc, s.created_at desc
        limit 1
      )`,
      memberCount: raw<number>`(select count(*) from member m where m.organization_id = ${organization.id})::int`,
      websiteCount: raw<number>`(select count(*) from websites w where w.organization_id = ${organization.id})::int`,
      articleCount: raw<number>`(
        select count(*) from articles a
        join websites w on w.id = a.website_id
        where w.organization_id = ${organization.id}
      )::int`,
      isAgency: raw<boolean>`exists(
        select 1 from agency_workspaces ag
        where ag.organization_id = ${organization.id}
      )`,
      ownerEmail: raw<string | null>`(
        select u.email from member m
        join "user" u on u.id = m.user_id
        where m.organization_id = ${organization.id} and m.role = 'owner'
        limit 1
      )`,
    })
    .from(organization)
    /*
      Still joined, because the status FILTER matches against it — a workspace
      qualifies when any of its subscriptions has the chosen status. The
      duplicate rows that creates are collapsed by the groupBy below, and the
      columns above no longer read from the join.
    */
    .leftJoin(subscriptions, eq(subscriptions.organizationId, organization.id))
    .where(where)
    .groupBy(organization.id, organization.name, organization.createdAt)
    .orderBy(desc(organization.createdAt))
    .limit(ADMIN_PAGE_SIZE)
    .offset((page - 1) * ADMIN_PAGE_SIZE);

  return { rows, total: counted?.n ?? 0, page, pageSize: ADMIN_PAGE_SIZE };
}

export type AdminArticle = {
  id: string;
  title: string;
  status: string;
  wordCount: number | null;
  updatedAt: Date;
  websiteId: string;
  domain: string;
  organizationId: string;
  organizationName: string;
};

/**
 * Every article on the platform, for manual review.
 *
 * The client's requirement: "option also to manual reviewing all the articles
 * in the system from all websites, in this way I can make manual changes."
 */
export async function listAllArticles(options: {
  search?: string;
  status?: string;
  organizationId?: string;
  page?: number;
  /** A DATE_RANGES value, filtering on when the article was created. */
  created?: string;
}): Promise<Page<AdminArticle>> {
  await requireAdmin();

  const conditions = [];
  if (options.search) {
    /**
     * Matches the customer too, not just the article. An operator handling a
     * support conversation knows the workspace name, not the domain or the
     * headline, and searching for it returned nothing before.
     */
    conditions.push(
      or(
        ilike(articles.title, `%${options.search}%`),
        ilike(websites.domain, `%${options.search}%`),
        ilike(organization.name, `%${options.search}%`),
      ),
    );
  }
  if (options.status && options.status !== "all") {
    conditions.push(eq(articles.status, options.status));
  }
  const createdSince = sinceFrom(options.created);
  if (createdSince) conditions.push(gte(articles.createdAt, createdSince));

  /** Every article belonging to one workspace, for reviewing a customer. */
  if (options.organizationId) {
    conditions.push(eq(websites.organizationId, options.organizationId));
  }

  const page = options.page ?? 1;
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [counted] = await db
    .select({ n: raw<number>`count(*)::int` })
    .from(articles)
    .innerJoin(websites, eq(articles.websiteId, websites.id))
    .innerJoin(organization, eq(websites.organizationId, organization.id))
    .where(where);

  const rows = await db
    .select({
      id: articles.id,
      title: articles.title,
      status: articles.status,
      wordCount: articles.wordCount,
      updatedAt: articles.updatedAt,
      websiteId: articles.websiteId,
      domain: websites.domain,
      organizationId: websites.organizationId,
      organizationName: organization.name,
    })
    .from(articles)
    .innerJoin(websites, eq(articles.websiteId, websites.id))
    .innerJoin(organization, eq(websites.organizationId, organization.id))
    .where(where)
    .orderBy(desc(articles.updatedAt))
    .limit(ADMIN_PAGE_SIZE)
    .offset((page - 1) * ADMIN_PAGE_SIZE);

  return { rows, total: counted?.n ?? 0, page, pageSize: ADMIN_PAGE_SIZE };
}

export type AdminArticleDetail = AdminArticle & {
  bodyHtml: string | null;
  metaDescription: string | null;
  targetKeyword: string | null;
};

export async function getAdminArticle(
  articleId: string,
): Promise<AdminArticleDetail | null> {
  await requireAdmin();

  const [row] = await db
    .select({
      id: articles.id,
      title: articles.title,
      status: articles.status,
      wordCount: articles.wordCount,
      updatedAt: articles.updatedAt,
      websiteId: articles.websiteId,
      domain: websites.domain,
      organizationId: websites.organizationId,
      organizationName: organization.name,
      bodyHtml: articles.bodyHtml,
      metaDescription: articles.metaDescription,
      targetKeyword: articles.targetKeyword,
    })
    .from(articles)
    .innerJoin(websites, eq(articles.websiteId, websites.id))
    .innerJoin(organization, eq(websites.organizationId, organization.id))
    .where(eq(articles.id, articleId))
    .limit(1);

  return row ?? null;
}

/**
 * Edits any article on the platform.
 *
 * The body is sanitised on the way in exactly as the customer-facing editor
 * does. An admin is trusted, but the HTML still ends up published on a
 * customer's live site, and a pasted script would be just as harmful from here.
 */
export async function updateAnyArticle(
  articleId: string,
  input: { title?: string; bodyHtml?: string },
): Promise<ActionResult<null>> {
  await requireAdmin();

  const patch: Record<string, unknown> = { updatedAt: new Date() };

  if (typeof input.title === "string") {
    const title = input.title.trim();
    if (!title) return { ok: false, error: "Title cannot be empty" };
    patch.title = title.slice(0, 200);
  }
  if (typeof input.bodyHtml === "string") {
    const clean = sanitizeHtml(input.bodyHtml);
    patch.bodyHtml = clean;
    patch.wordCount = countWords(clean);
  }

  await db.update(articles).set(patch).where(eq(articles.id, articleId));

  revalidatePath("/admin/articles");
  revalidatePath(`/admin/articles/${articleId}`);
  return { ok: true, data: null };
}

/** One website this person can work on, and how they got there. */
export type AdminUserWebsite = {
  id: string;
  domain: string;
  /**
   * "admin" when their workspace owns the site, otherwise the role on their
   * website_members row ("editor" | "viewer").
   *
   * The two are genuinely different kinds of access, not two values of one
   * field: workspace access covers every site the workspace owns and cannot
   * be revoked per site, while an invitation covers exactly one. An operator
   * asked "why can this person see that?" needs to know which.
   */
  role: string;
  /** True when the access comes from owning the workspace. */
  viaWorkspace: boolean;
};

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  organizationId: string | null;
  organizationName: string | null;
  /** The workspace's subscription status, so suspension is visible here too. */
  organizationStatus: string | null;
  /**
   * What they pay for, as a plan NAME rather than a status.
   *
   * "Growth" answers the question an operator actually has when a customer
   * writes in; "active" only says a subscription exists. Null when the
   * workspace has never subscribed.
   */
  planName: string | null;
  planInterval: string | null;
  /** Every site they can work on, both routes in. Empty for most people. */
  websites: AdminUserWebsite[];
};

export async function listUsers(
  search = "",
  page = 1,
  filters: { membership?: string; joined?: string } = {},
): Promise<Page<AdminUser>> {
  await requireAdmin();

  const conditions = [];
  if (search) {
    conditions.push(
      or(ilike(user.email, `%${search}%`), ilike(user.name, `%${search}%`)),
    );
  }

  /**
   * People with no workspace at all.
   *
   * Signing up creates one, so an account without a membership means
   * something went wrong — a failed hook, or a workspace deleted out from
   * under them. They are invisible in a list sorted by workspace, and they
   * are exactly who an operator is looking for when a customer says they
   * cannot get in.
   */
  if (filters.membership === "none") {
    conditions.push(
      raw`not exists(select 1 from member m where m.user_id = ${user.id})`,
    );
  } else if (filters.membership === "some") {
    conditions.push(
      raw`exists(select 1 from member m where m.user_id = ${user.id})`,
    );
  }

  const since = sinceFrom(filters.joined);
  if (since) conditions.push(gte(user.createdAt, since));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  /**
   * Counts PEOPLE, not rows. The query below joins memberships, so someone in
   * three workspaces produces three rows — counting those would tell an
   * operator there are more accounts than exist.
   */
  const [counted] = await db
    .select({ n: raw<number>`count(*)::int` })
    .from(user)
    .where(where);

  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
      organizationId: organization.id,
      organizationName: organization.name,
      organizationStatus: subscriptions.status,
      planName: plans.name,
      planInterval: plans.interval,
    })
    .from(user)
    .leftJoin(member, eq(member.userId, user.id))
    .leftJoin(organization, eq(member.organizationId, organization.id))
    .leftJoin(
      subscriptions,
      eq(subscriptions.organizationId, organization.id),
    )
    /*
      The plan NAME, not just the status. "Growth" is what an operator needs
      when a customer writes in; "active" says a subscription exists without
      saying what it bought.
    */
    .leftJoin(plans, eq(plans.id, subscriptions.planId))
    .where(where)
    .orderBy(desc(user.createdAt))
    .limit(ADMIN_PAGE_SIZE)
    .offset((page - 1) * ADMIN_PAGE_SIZE);

  /**
   * The websites each person can reach, for the whole page at once.
   *
   * NOT a join onto the query above: a person in two workspaces holding four
   * sites each would multiply into eight rows and be listed eight times. NOT
   * a query per row either - that is fifty round trips for one screen. Two
   * queries keyed by user id, stitched in memory below.
   *
   * TWO ROUTES IN, kept apart because they are different tables and mean
   * different things:
   *
   *   1. Their workspace OWNS the site. That is admin access to every site
   *      the workspace holds, and it cannot be withdrawn per site.
   *   2. They were INVITED to one site (website_members) as editor or
   *      viewer, which grants nothing anywhere else.
   *
   * Someone can have both, so the workspace route wins in the stitch.
   */
  const ids = rows.map((row) => row.id);

  const [viaWorkspace, viaInvitation] = await Promise.all([
    ids.length === 0
      ? []
      : db
          .select({
            userId: member.userId,
            websiteId: websites.id,
            domain: websites.domain,
          })
          .from(member)
          .innerJoin(
            websites,
            eq(websites.organizationId, member.organizationId),
          )
          .where(inArray(member.userId, ids)),
    ids.length === 0
      ? []
      : db
          .select({
            userId: websiteMembers.userId,
            websiteId: websites.id,
            domain: websites.domain,
            role: websiteMembers.role,
          })
          .from(websiteMembers)
          .innerJoin(websites, eq(websites.id, websiteMembers.websiteId))
          .where(inArray(websiteMembers.userId, ids)),
  ]);

  const byUser = new Map<string, Map<string, AdminUserWebsite>>();

  function put(userId: string, site: AdminUserWebsite) {
    let sites = byUser.get(userId);
    if (!sites) {
      sites = new Map();
      byUser.set(userId, sites);
    }
    /*
      Workspace access wins a collision. Someone who owns a site AND was
      invited to it as a viewer is an admin on it; showing "viewer" would
      understate what they can do.
    */
    const existing = sites.get(site.id);
    if (existing?.viaWorkspace) return;
    sites.set(site.id, site);
  }

  for (const row of viaInvitation) {
    put(row.userId, {
      id: row.websiteId,
      domain: row.domain,
      role: row.role,
      viaWorkspace: false,
    });
  }
  // Second, so it overwrites an invitation on the same site.
  for (const row of viaWorkspace) {
    put(row.userId, {
      id: row.websiteId,
      domain: row.domain,
      role: "admin",
      viaWorkspace: true,
    });
  }

  return {
    rows: rows.map((row) => ({
      ...row,
      websites: [...(byUser.get(row.id)?.values() ?? [])].sort((a, b) =>
        a.domain.localeCompare(b.domain),
      ),
    })),
    total: counted?.n ?? 0,
    page,
    pageSize: ADMIN_PAGE_SIZE,
  };
}


export type AdminWebsite = {
  id: string;
  domain: string;
  url: string;
  status: string;
  organizationId: string;
  organizationName: string | null;
  createdAt: Date;
  articleCount: number;
  /** Null when the workspace has never subscribed. */
  subscriptionStatus: string | null;
};

/**
 * Every website on the platform, newest first.
 *
 * WHY THIS LIST EXISTS: a website could only be removed by deleting the
 * workspace that owned it, which is a far larger act - it takes the
 * customer's account, their other sites, their payment history and their
 * colleagues with it. An operator asked to remove ONE site (a customer who
 * added the wrong domain, a typo, a site sold to someone else) had no way to
 * do it that did not destroy four other things.
 *
 * Reads across tenants, so it starts at requireAdmin() like everything else
 * in this file.
 */
export async function listWebsites(
  search = "",
  page = 1,
  filters: { status?: string; added?: string } = {},
): Promise<Page<AdminWebsite>> {
  await requireAdmin();

  const conditions = [];
  if (search) {
    /*
      Domain OR workspace name. An operator is given one or the other -
      "delete example.com" or "clean up Acme's account" - and searching only
      one of them means half the requests find nothing.
    */
    conditions.push(
      or(
        ilike(websites.domain, `%${search}%`),
        ilike(websites.url, `%${search}%`),
        ilike(organization.name, `%${search}%`),
      ),
    );
  }

  if (filters.status && filters.status !== "all") {
    conditions.push(eq(websites.status, filters.status));
  }

  const since = sinceFrom(filters.added);
  if (since) conditions.push(gte(websites.createdAt, since));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  /*
    The join to organization is in the count as well as the page, because the
    search filters on organization.name - without it the total would count
    rows the filter excludes and the pager would promise pages that are empty.
  */
  const [counted] = await db
    .select({ n: raw<number>`count(*)::int` })
    .from(websites)
    .leftJoin(organization, eq(organization.id, websites.organizationId))
    .where(where);

  const rows = await db
    .select({
      id: websites.id,
      domain: websites.domain,
      url: websites.url,
      status: websites.status,
      organizationId: websites.organizationId,
      organizationName: organization.name,
      createdAt: websites.createdAt,
      /*
        Counted per row rather than joined and grouped: a join to articles
        would multiply the website rows and need a GROUP BY across every
        selected column, which is slower to read and no faster to run at this
        size.
      */
      articleCount: raw<number>`(select count(*) from articles a where a.website_id = ${websites.id})::int`,
      subscriptionStatus: subscriptions.status,
    })
    .from(websites)
    .leftJoin(organization, eq(organization.id, websites.organizationId))
    .leftJoin(
      subscriptions,
      eq(subscriptions.organizationId, websites.organizationId),
    )
    .where(where)
    .orderBy(desc(websites.createdAt))
    .limit(ADMIN_PAGE_SIZE)
    .offset((page - 1) * ADMIN_PAGE_SIZE);

  return { rows, total: counted?.n ?? 0, page, pageSize: ADMIN_PAGE_SIZE };
}


export type AdminPayment = {
  id: string;
  organizationId: string;
  organizationName: string | null;
  provider: string;
  externalId: string;
  amountCents: number;
  currency: string;
  status: string;
  description: string | null;
  invoiceUrl: string | null;
  paidAt: Date;
};

/**
 * Every payment, newest first, for the refund screen.
 *
 * Reads across organizations like everything else in this file, so it starts
 * at requireAdmin().
 */
export async function listPayments(options: {
  search?: string;
  organizationId?: string;
  page?: number;
  status?: string;
  provider?: string;
  paid?: string;
} = {}): Promise<Page<AdminPayment>> {
  await requireAdmin();

  const conditions = [];
  if (options.search) {
    /**
     * By customer or by what the payment was for. An operator handling a
     * refund knows the workspace name, not the Stripe id.
     */
    conditions.push(
      or(
        ilike(organization.name, `%${options.search}%`),
        ilike(payments.description, `%${options.search}%`),
      ),
    );
  }
  if (options.organizationId) {
    conditions.push(eq(payments.organizationId, options.organizationId));
  }

  /**
   * The three questions an operator actually asks of this page: what failed,
   * what was refunded, and what came through which processor. Refunds in
   * particular were impossible to find — they sit among every successful
   * payment, newest first, and a customer disputing one names a date.
   */
  if (options.status && options.status !== "all") {
    conditions.push(eq(payments.status, options.status));
  }
  if (options.provider && options.provider !== "all") {
    conditions.push(eq(payments.provider, options.provider));
  }

  const paidSince = sinceFrom(options.paid);
  if (paidSince) conditions.push(gte(payments.paidAt, paidSince));

  const page = options.page ?? 1;
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [counted] = await db
    .select({ n: raw<number>`count(*)::int` })
    .from(payments)
    .leftJoin(organization, eq(payments.organizationId, organization.id))
    .where(where);

  const rows = await db
    .select({
      id: payments.id,
      organizationId: payments.organizationId,
      organizationName: organization.name,
      provider: payments.provider,
      externalId: payments.externalId,
      amountCents: payments.amountCents,
      currency: payments.currency,
      status: payments.status,
      description: payments.description,
      invoiceUrl: payments.invoiceUrl,
      paidAt: payments.paidAt,
    })
    .from(payments)
    .leftJoin(organization, eq(payments.organizationId, organization.id))
    .where(where)
    .orderBy(desc(payments.paidAt))
    .limit(ADMIN_PAGE_SIZE)
    .offset((page - 1) * ADMIN_PAGE_SIZE);

  return { rows, total: counted?.n ?? 0, page, pageSize: ADMIN_PAGE_SIZE };
}
