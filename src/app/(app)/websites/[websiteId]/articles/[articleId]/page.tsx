import { and, eq, isNotNull, isNull } from "drizzle-orm";

import { db } from "@/lib/db";
import { integrationKeys } from "@/lib/db/schema";
import { notFound } from "next/navigation";

import { requireSession } from "@/lib/auth-guard";
import { getAppMessages } from "@/lib/i18n/app-locale";
import { requirePlan } from "@/lib/billing/require-plan";
import { getArticle } from "@/lib/articles/actions";
import { requireWebsitePage } from "@/lib/tenant";
import { listIntegrations, listPublishLogs } from "@/lib/publishing/actions";
import { WebsiteNotFoundError } from "@/lib/tenant";
import { ArticleEditor } from "./article-editor";
import { requireOrg } from "@/lib/tenant";

export const metadata = { title: "Article" };

// Status changes while generation runs; never serve a cached view.
export const dynamic = "force-dynamic";

export default async function ArticlePage({
  params,
}: PageProps<"/websites/[websiteId]/articles/[articleId]">) {
  await requireSession();
  const { orgId } = await requireOrg();
  // Paywall. See lib/billing/require-plan.ts.
  await requirePlan(orgId);
  const { websiteId, articleId } = await params;

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

  const [cmsIntegrations, logs, websiteCtx] = await Promise.all([
    listIntegrations(websiteId),
    listPublishLogs(websiteId, article.id),
    // Scopes to the caller's organisation and throws for anything else.
    // Needed only for the domain, to tell internal links from external.
    requireWebsitePage(websiteId),
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
      t={t.app.editor}
      tImage={t.app.image}
      tCommon={t.app.common}
      tStatus={t.app.status}
      tEditorUi={t.app.editorUi}
      publishLogs={logs}
    />
  );
}
