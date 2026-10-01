import { notFound } from "next/navigation";

import { getBlogPostAdmin } from "@/lib/admin/blog";
import { listCategories } from "@/lib/blog/categories";
import { BlogPostEditor } from "../blog-post-editor";

export const dynamic = "force-dynamic";

export default async function AdminBlogPostPage({ params }: PageProps<"/admin/blog/[postId]">) {
  const { postId } = await params;
  const post = await getBlogPostAdmin(postId);
  if (!post) notFound();
  return <BlogPostEditor post={post} categories={await listCategories()} />;
}
