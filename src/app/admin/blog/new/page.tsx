import { requireAdmin } from "@/lib/admin/guard";
import { BlogPostEditor } from "../blog-post-editor";

export const dynamic = "force-dynamic";

/** A blank post; its first save creates it. */
export default async function AdminNewBlogPostPage() {
  await requireAdmin();
  return <BlogPostEditor post={null} />;
}
