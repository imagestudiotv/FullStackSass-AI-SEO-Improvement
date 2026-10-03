import { notFound } from "next/navigation";

import { getBlogPostAdmin } from "@/lib/admin/blog";
import { listCategories } from "@/lib/blog/categories";
import { BlogPostEditor } from "../blog-post-editor";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edit post" };

export default async function AdminBlogPostPage({ params }: PageProps<"/admin/blog/[postId]">) {
  const { postId } = await params;
  // Guarded (requireAdmin) and UUID-checked: a malformed id is a 404. It runs before the unguarded listCategories.
  const post = await getBlogPostAdmin(postId);
  if (!post) notFound();
  return <BlogPostEditor post={post} categories={await listCategories()} />;
}
