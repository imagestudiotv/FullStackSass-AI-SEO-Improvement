import { and, eq, isNotNull, isNull } from "drizzle-orm";

import { db } from "@/lib/db";
import { integrationKeys } from "@/lib/db/schema";
import { notFound } from "next/navigation";

import { requireSession } from "@/lib/auth-guard";
import { latestUncertain } from "@/lib/publishing/dispatch";
import { UncertainPublication } from "./uncertain-publication";
import { getAppMessages } from "@/lib/i18n/app-locale";
import { requireWebsitePlan } from "@/lib/billing/require-plan";
import { getArticle } from "@/lib/articles/actions";
import { partnerLinkUrls } from "@/lib/backlinks/partner-links";
import { requireWebsitePage } from "@/lib/tenant";
import { listIntegrations, listPublishLogs } from "@/lib/publishing/actions";
import { WebsiteNotFoundError } from "@/lib/tenant";
import { ArticleEditor } from "./article-editor";

export const metadata = { title: "Article" };

// Status changes while generation runs; never serve a cached view.
export const dynamic = "force-dynamic";

export default async function ArticlePage({
  params,
}: PageProps<"/websites/[websiteId]/articles/[articleId]">) {
  await requireSession();
  const { websiteId, articleId } = await params;

  /**
   * The website is resolved BEFORE the paywall, so the paywall can ask about
   * this site and the access the caller actually holds on it.
   *
   * It used to call requirePlan(orgId) from requireOrg() - the CALLER's own
   * workspace. For a guest invited to one website that is the wrong workspace
   * entirely: a guest whose own workspace has no plan was redirected to a
   * plan screen for a site somebody else is already paying for. The owner's
   * workspace is not right for a guest either - it opens the owner's checkout
   * - so requireWebsitePlan judges a guest on this one site.
   *
   * requireWebsitePage 404s a site that is not the caller's, so this is also
   * the access check; it is request-cached, so the later call in the
   * Promise.all below costs nothing.
   */
  const gate = await requireWebsitePage(websiteId);
  // Paywall. See lib/billing/require-plan.ts.
  await requireWebsitePlan(gate);

  // try/catch wraps only the fetch: JSX returned inside it is rendered later
  // and would not be covered by the handler.
  let article;
  try {
    article = await getArticle(websiteId, articleId);
  } catch (error) {
    if (error instanceof WebsiteNotFoundError) {
      notFound();
    }
    throw error;
  }

  if (!article) {
    notFound();
  }
  // Partner Network links in this article, highlighted in its preview and editor.
  const partnerLinks = await partnerLinkUrls(article.id);

  const [cmsIntegrations, logs, websiteCtx, uncertain] = await Promise.all([
    listIntegrations(websiteId),
    listPublishLogs(websiteId, article.id),
    // Scopes to the caller's organisation and throws for anything else.
    // Needed only for the domain, to tell internal links from external.
    requireWebsitePage(websiteId),
    // A send whose outcome is unknown (lib/publishing/dispatch.ts).
    latestUncertain(article.id),
  ]);

  const { t } = await getAppMessages(websiteCtx.userId);

  /*
    The WordPress plugin keeps no integrations row, so it is looked up on its
    own. Without this a plugin-only site had no Publish button at all.
  */
  const [plugin] = await db
    .select({ id: integrationKeys.id })
    .from(integrationKeys)
    .where(
      and(
        eq(integrationKeys.websiteId, websiteId),
        isNull(integrationKeys.revokedAt),
        isNotNull(integrationKeys.lastUsedAt),
      ),
    )
    .limit(1);
  const pluginConnected = Boolean(plugin);

  return (
    <>
    {uncertain ? (
      <UncertainPublication
        websiteId={websiteId}
        articleId={article.id}
        canEdit={websiteCtx.access !== "viewer"}
        text={{
          title: t.app.reports.uncertainTitle,
          help: t.app.reports.uncertainHelp,
          confirm: t.app.reports.uncertainConfirm,
          confirmed: t.app.reports.uncertainConfirmed,
        }}
      />
    ) : null}
    <ArticleEditor
      websiteId={websiteId}
      article={article}
      // Any connected destination is enough to offer publishing - a direct
      // CMS connection, or the WordPress plugin once it has checked in.
      canPublish={
        cmsIntegrations.some((i) => i.status === "connected") ||
        pluginConnected
      }
      viaPlugin={
        !cmsIntegrations.some((i) => i.status === "connected") &&
        pluginConnected
      }
      destinationName={
        cmsIntegrations.find((i) => i.status === "connected")?.providerName ??
        null
      }
      websiteDomain={websiteCtx.site.domain}
      partnerLinks={partnerLinks}
      t={t.app.editor}
      tImage={t.app.image}
      tCommon={t.app.common}
      tStatus={t.app.status}
      tEditorUi={t.app.editorUi}
      publishLogs={logs}
    />
    </>
  );
}
