import { notFound } from "next/navigation";

import { getAdminArticle } from "@/lib/admin/actions";
import { AdminArticleEditor } from "./admin-article-editor";

export const dynamic = "force-dynamic";

export default async function AdminArticlePage({
  params,
}: PageProps<"/admin/articles/[articleId]">) {
  const { articleId } = await params;
  const article = await getAdminArticle(articleId);

  if (!article) {
    notFound();
  }

  return <AdminArticleEditor article={article} />;
}
