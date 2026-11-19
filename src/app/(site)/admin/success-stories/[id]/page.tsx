import { notFound } from "next/navigation";

import { getSuccessStoryAdmin } from "@/lib/admin/success-stories";

import { SuccessStoryEditor } from "../story-editor";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edit success story" };

export default async function AdminSuccessStoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Guarded (requireAdmin) and UUID-checked: a malformed id is a 404.
  const story = await getSuccessStoryAdmin(id);
  if (!story) notFound();
  return <SuccessStoryEditor story={story} />;
}
