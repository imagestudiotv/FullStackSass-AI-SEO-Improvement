import { notFound } from "next/navigation";

import { getReviewArticle } from "@/lib/admin/network";
import { ReviewWorkspace } from "./review-workspace";

export const dynamic = "force-dynamic";

export default async function AdminNetworkArticlePage({ params }: PageProps<"/admin/network/[articleId]">) {
  const { articleId } = await params;
  const review = await getReviewArticle(articleId);
  if (!review) notFound();
  return <ReviewWorkspace review={review} />;
}
