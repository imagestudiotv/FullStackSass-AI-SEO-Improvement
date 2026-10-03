import { requireAdmin } from "@/lib/admin/guard";
import { listCategories } from "@/lib/blog/categories";
import { BlogPostEditor } from "../blog-post-editor";

export const dynamic = "force-dynamic";
export const metadata = { title: "New post" };

/** A blank post; its first save creates it. */
export default async function AdminNewBlogPostPage() {
  // listCategories has no guard of its own: the admin check comes first.
  await requireAdmin();
  return <BlogPostEditor post={null} categories={await listCategories()} />;
}
