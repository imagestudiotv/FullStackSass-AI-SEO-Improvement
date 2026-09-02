"use server";

import { and, desc, eq, ilike, or, sql as raw } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/admin/guard";
import { db } from "@/lib/db";
import {
  articles,
  member,
  organization,
  plans,
  subscriptions,
  usageEvents,
  user,
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
): Promise<AdminOrganization[]> {
  await requireAdmin();

  const rows = await db
    .select({
      id: organization.id,
      name: organization.name,
      createdAt: organization.createdAt,
      planName: plans.name,
      status: subscriptions.status,
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
    .leftJoin(subscriptions, eq(subscriptions.organizationId, organization.id))
    .leftJoin(plans, eq(subscriptions.planId, plans.id))
    .where(search ? ilike(organization.name, `%${search}%`) : undefined)
    .orderBy(desc(organization.createdAt))
    .limit(100);

  return rows;
}

export type AdminArticle = {
  id: string;
  title: string;
  status: string;
  wordCount: number | null;
  updatedAt: Date;
  websiteId: string;
  domain: string;
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
  limit?: number;
}): Promise<AdminArticle[]> {
  await requireAdmin();

  const conditions = [];
  if (options.search) {
    conditions.push(
      or(
        ilike(articles.title, `%${options.search}%`),
        ilike(websites.domain, `%${options.search}%`),
      ),
    );
  }
  if (options.status && options.status !== "all") {
    conditions.push(eq(articles.status, options.status));
  }

  return db
    .select({
      id: articles.id,
      title: articles.title,
      status: articles.status,
      wordCount: articles.wordCount,
      updatedAt: articles.updatedAt,
      websiteId: articles.websiteId,
      domain: websites.domain,
      organizationName: organization.name,
    })
    .from(articles)
    .innerJoin(websites, eq(articles.websiteId, websites.id))
    .innerJoin(organization, eq(websites.organizationId, organization.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(articles.updatedAt))
    .limit(options.limit ?? 100);
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

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  organizationName: string | null;
};

export async function listUsers(search = ""): Promise<AdminUser[]> {
  await requireAdmin();

  return db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
      organizationName: organization.name,
    })
    .from(user)
    .leftJoin(member, eq(member.userId, user.id))
    .leftJoin(organization, eq(member.organizationId, organization.id))
    .where(
      search
        ? or(ilike(user.email, `%${search}%`), ilike(user.name, `%${search}%`))
        : undefined,
    )
    .orderBy(desc(user.createdAt))
    .limit(100);
}
