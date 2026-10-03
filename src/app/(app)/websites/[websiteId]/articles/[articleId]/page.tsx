import { and, eq, isNotNull, isNull } from "drizzle-orm";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import { REWRITES_PER_WEBSITE_PER_DAY } from "@/inngest/functions/generate-article";
import { getArticle } from "@/lib/articles/actions";
import { requireSession } from "@/lib/auth-guard";
import { partnerLinkUrls } from "@/lib/backlinks/partner-links";
import { requireWebsitePlan } from "@/lib/billing/require-plan";
import { db } from "@/lib/db";
import { integrationKeys } from "@/lib/db/schema";
import { getAppMessages } from "@/lib/i18n/app-locale";
import { MAX_IMAGE_BYTES } from "@/lib/images/storage";
import { listIntegrations } from "@/lib/publishing/actions";
import { latestUncertain } from "@/lib/publishing/dispatch";
import { requireWebsitePage, WebsiteNotFoundError } from "@/lib/tenant";

import { ArticleEditor } from "./article-editor";
import { formatWhen, HISTORY_LIMIT, loadPublishing, pickDestination } from "./article-data";
import { generationFailureKind } from "./failure-copy";
import { previewSiteOrigin } from "./site-origin";

// Status changes while generation and publishing run; never serve a cached view.
export const dynamic = "force-dynamic";

/** A malformed article id is a missing page, not a database error. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Regenerations per article over its lifetime (MAX_REGENERATIONS in lib/articles/image-actions.ts, a "use server" module that can export only actions). */
const IMAGE_REGENERATIONS = 5;

/** One read per request, shared by the tab title and the page. getArticle checks access itself. */
const loadArticle = cache((websiteId: string, articleId: string) => getArticle(websiteId, articleId));

export async function generateMetadata({
  params,
}: PageProps<"/websites/[websiteId]/articles/[articleId]">): Promise<Metadata> {
  const { websiteId, articleId } = await params;
  if (!UUID_RE.test(articleId)) return { title: "Article" };
  try {
    const article = await loadArticle(websiteId, articleId);
    return { title: article?.title ?? "Article" };
  } catch {
    // The page itself answers a missing or foreign article (404) or a signed-out visit.
    return { title: "Article" };
  }
}

export default async function ArticlePage({
  params,
}: PageProps<"/websites/[websiteId]/articles/[articleId]">) {
  await requireSession();
  const { websiteId, articleId } = await params;

  /**
   * The website is resolved BEFORE the paywall, so the paywall can ask about
   * this site and the access the caller actually holds on it (a guest is
   * judged on this one site, never on their own empty workspace). It is
   * also the access check: a site that is not the caller's is a 404.
   */
  const gate = await requireWebsitePage(websiteId);
  // Paywall. See lib/billing/require-plan.ts.
  await requireWebsitePlan(gate);

  if (!UUID_RE.test(articleId)) notFound();

  // try/catch wraps only the fetch: JSX returned inside it is rendered later
  // and would not be covered by the handler.
  let article;
  try {
    article = await loadArticle(websiteId, articleId);
  } catch (error) {
    if (error instanceof WebsiteNotFoundError) notFound();
    throw error;
  }
  if (!article) notFound();

  const [partnerLinks, cmsIntegrations, uncertain, plugin, { locale, t }] = await Promise.all([
    // Partner Network links in this article, highlighted in its preview and editor.
    partnerLinkUrls(article.id),
    listIntegrations(websiteId),
    // A send whose outcome is unknown (lib/publishing/dispatch.ts).
    latestUncertain(article.id),
    /*
      The WordPress plugin keeps no integrations row, so it is looked up on
      its own: a key that has checked in at least once and is not revoked.
    */
    db
      .select({ id: integrationKeys.id })
      .from(integrationKeys)
      .where(
        and(
          eq(integrationKeys.websiteId, gate.site.id),
          isNull(integrationKeys.revokedAt),
          isNotNull(integrationKeys.lastUsedAt),
        ),
      )
      .limit(1),
    getAppMessages(gate.userId),
  ]);

  const destination = pickDestination(cmsIntegrations, plugin.length > 0);
  // Where the article's own-site links ("/services") lead once published, so Preview can follow them there.
  const siteOrigin = previewSiteOrigin(gate.site.url);
  const { facts, history } = await loadPublishing({
    siteId: gate.site.id,
    article,
    autoPublish: gate.site.autoPublish,
    publishAs: gate.site.publishAs,
    destination,
    uncertain: Boolean(uncertain),
    locale,
  });

  return (
    <ArticleEditor
      websiteId={websiteId}
      // The stored error is written for logs (internal names, raw provider
      // answers); only its classification reaches the browser.
      article={{ ...article, error: null }}
      failureKind={article.status === "failed" ? generationFailureKind(article.error) : null}
      canEdit={gate.access !== "viewer"}
      locale={locale}
      websiteDomain={gate.site.domain}
      siteOrigin={siteOrigin}
      partnerLinks={partnerLinks}
      facts={facts}
      history={history}
      historyLimit={HISTORY_LIMIT}
      uncertain={Boolean(uncertain)}
      lastSaved={formatWhen(article.updatedAt, locale)}
      rewriteLimit={REWRITES_PER_WEBSITE_PER_DAY}
      imageMaxAttempts={IMAGE_REGENERATIONS}
      imageMaxBytes={MAX_IMAGE_BYTES}
      plannedArticlesLabel={t.app.nav.plannedArticles}
      uncertainText={{
        title: t.app.reports.uncertainTitle,
        help: t.app.reports.uncertainHelp,
        confirm: t.app.reports.uncertainConfirm,
        confirmed: t.app.reports.uncertainConfirmed,
      }}
      t={t.app.editor}
      tImage={t.app.image}
      tCommon={t.app.common}
      tStatus={t.app.status}
      tEditorUi={t.app.editorUi}
      tWorkspace={t.app.workspace}
    />
  );
}
