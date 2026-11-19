import { notFound } from "next/navigation";

import { getSuccessStoryAdmin } from "@/lib/admin/success-stories";
import { SuccessStoryView } from "@/app/(marketing)/success-stories/[slug]/story-page";

export const dynamic = "force-dynamic";
export const metadata = { title: "Preview success story" };

/**
 * A story as its public page will draw it, drafts included - for
 * administrators only (the admin layout's guard and getSuccessStoryAdmin's),
 * never indexed (the admin layout's robots). A draft has no public page:
 * /success-stories/<slug> is a 404 until it is published.
 */
export default async function AdminSuccessStoryPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const story = await getSuccessStoryAdmin(id);
  if (!story) notFound();
  return <SuccessStoryView story={story} locale="en" preview />;
}
