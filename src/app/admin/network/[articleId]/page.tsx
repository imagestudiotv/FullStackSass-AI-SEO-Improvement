import { notFound } from "next/navigation";

import { getReviewArticle } from "@/lib/admin/network";
import { ReviewWorkspace } from "./review-workspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "Article review" };

/**
 * Article ids are UUIDs. Anything else cannot be an article, and handing it
 * to the loader makes Postgres reject the comparison with the uuid column -
 * which surfaced as the global error page instead of "not found".
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function AdminNetworkArticlePage({ params }: PageProps<"/admin/network/[articleId]">) {
  const { articleId } = await params;
  if (!UUID.test(articleId)) notFound();
  const review = await getReviewArticle(articleId);
  if (!review) notFound();
  return <ReviewWorkspace review={review} />;
}
