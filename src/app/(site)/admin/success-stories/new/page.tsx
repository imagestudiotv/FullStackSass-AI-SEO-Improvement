import { requireAdmin } from "@/lib/admin/guard";

import { SuccessStoryEditor } from "../story-editor";

export const dynamic = "force-dynamic";
export const metadata = { title: "New success story" };

/** A blank story; its first save creates it, last in the order after Image Studio. */
export default async function AdminNewSuccessStoryPage() {
  await requireAdmin();
  return <SuccessStoryEditor story={null} />;
}
