import { and, desc, eq, isNotNull, isNull } from "drizzle-orm";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import { REWRITES_PER_WEBSITE_PER_DAY } from "@/inngest/functions/generate-article";
import { getArticle } from "@/lib/articles/actions";
import { checkReleasable } from "@/lib/articles/review";
import { requireSession } from "@/lib/auth-guard";
import { partnerLinkUrls } from "@/lib/backlinks/partner-links";
import { requireWebsitePlan } from "@/lib/billing/require-plan";
import { db } from "@/lib/db";
import { integrationKeys } from "@/lib/db/schema";
import { getAppMessages } from "@/lib/i18n/app-locale";
import { articleTitleText, PREPARING_TITLE } from "@/lib/i18n/article-delivery";
import { MAX_IMAGE_BYTES } from "@/lib/images/storage";
import { pluginUpdates, siteInfoPluginVersion } from "@/lib/plugin/protocol";
import { listIntegrations } from "@/lib/publishing/actions";
import { latestUncertain } from "@/lib/publishing/dispatch";
import { requireWebsitePage, WebsiteNotFoundError } from "@/lib/tenant";

import { ArticleEditor } from "./article-editor";
import { ArticlePreparing } from "./article-preparing";
import { ArticleIndexingStatus } from "@/components/articles/indexing-status";
import { ResearchPanel } from "@/components/articles/research-panel";
import { formatWhen, HISTORY_LIMIT, loadPublishing, partnerLinksInText, pickDestination } from "./article-data";
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
    // A held article with no planned title: the marker is not a title.
    return { title: article && article.title !== PREPARING_TITLE ? article.title : "Article" };
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

  /*
    The two-step flow: the team has it, or it is still being written. Nothing
    below is read for it - the links in its text, its publishing panel - and
    getArticle has already emptied it.
  */
  if (article.preparing) {
    const [integrations, connectedPlugin, { locale, t }] = await Promise.all([
      listIntegrations(websiteId),
      db
        .select({ id: integrationKeys.id })
        .from(integrationKeys)
        .where(and(eq(integrationKeys.websiteId, gate.site.id), isNull(integrationKeys.revokedAt), isNotNull(integrationKeys.lastUsedAt)))
        .limit(1),
      getAppMessages(gate.userId),
    ]);
    return (
      <ArticlePreparing
        websiteId={websiteId}
        title={articleTitleText(article.title, locale)}
        stage={article.preparing}
        postUrl={article.publishedUrl}
        status={article.status}
        viewOnSiteLabel={t.app.editor.viewOnSite}
        destination={pickDestination(integrations, connectedPlugin.length > 0)}
        autoPublish={gate.site.autoPublish ? (gate.site.publishAs === "draft" ? "draft" : "live") : "off"}
        canEdit={gate.access !== "viewer"}
        locale={locale}
        plannedArticlesLabel={t.app.nav.plannedArticles}
        breadcrumbLabel={t.app.editor.breadcrumbLabel}
        tStatus={t.app.status}
      />
    );
  }

  const [partnerLinks, cmsIntegrations, uncertain, plugin, { locale, t }, release] = await Promise.all([
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
      .select({ id: integrationKeys.id, siteInfo: integrationKeys.siteInfo })
      .from(integrationKeys)
      .where(
        and(
          eq(integrationKeys.websiteId, gate.site.id),
          isNull(integrationKeys.revokedAt),
          isNotNull(integrationKeys.lastUsedAt),
        ),
      )
      .orderBy(desc(integrationKeys.lastUsedAt))
      .limit(1),
    getAppMessages(gate.userId),
    // Download only what may leave RepGet - the same gate as publishing (ticket 2026-11-19).
    checkReleasable(article.id),
  ]);

  const destination = pickDestination(cmsIntegrations, plugin.length > 0);
  // Where the article's own-site links ("/services") lead once published, so Preview can follow them there.
  const siteOrigin = previewSiteOrigin(gate.site.url);
  const { facts, history } = await loadPublishing({
    siteId: gate.site.id,
    article,
    pluginPublishesDrafts: pluginUpdates(siteInfoPluginVersion(plugin[0]?.siteInfo)),
    autoPublish: gate.site.autoPublish,
    publishAs: gate.site.publishAs,
    destination,
    uncertain: Boolean(uncertain),
    locale,
  });

  /*
    No popup over the article (2026-11-27): reading an article is never
    blocked. A website with nowhere to publish is asked to connect by the
    publishing panel's own banner beside the article (article-publishing.tsx,
    "Connect your website to publish"), which does not stand in the way.
  */
  return (
    <>
    <ResearchPanel websiteId={websiteId} articleId={articleId} locale={locale} />
    <ArticleIndexingStatus websiteId={gate.site.id} articleId={article.id} locale={locale} />
    <ArticleEditor
      websiteId={websiteId}
      // The stored error is written for logs (internal names, raw provider
      // answers); only its classification reaches the browser.
      article={{ ...article, title: articleTitleText(article.title, locale), error: null }}
      failureKind={article.status === "failed" ? generationFailureKind(article.error) : null}
      canEdit={gate.access !== "viewer"}
      locale={locale}
      websiteDomain={gate.site.domain}
      siteOrigin={siteOrigin}
      partnerLinks={article.withTeam ? partnerLinksInText(partnerLinks, article.bodyHtml) : partnerLinks}
      facts={facts}
      history={history}
      historyLimit={HISTORY_LIMIT}
      uncertain={Boolean(uncertain)}
      downloadable={release.ok}
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
    </>
  );
}
