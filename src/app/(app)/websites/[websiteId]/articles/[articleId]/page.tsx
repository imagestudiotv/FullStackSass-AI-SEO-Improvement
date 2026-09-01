import { notFound } from "next/navigation";

import { requireSession } from "@/lib/auth-guard";
import { getArticle } from "@/lib/articles/actions";
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

  const [cmsIntegrations, logs] = await Promise.all([
    listIntegrations(websiteId),
    listPublishLogs(websiteId, article.id),
  ]);

  return (
    <ArticleEditor
      websiteId={websiteId}
      article={article}
      // Any connected destination is enough to offer publishing.
      canPublish={cmsIntegrations.some((i) => i.status === "connected")}
      destinationName={
        cmsIntegrations.find((i) => i.status === "connected")?.providerName ??
        null
      }
      publishLogs={logs}
    />
  );
}
