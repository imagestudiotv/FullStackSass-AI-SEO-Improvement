import { requireAdmin } from "@/lib/admin/guard";
import { listCategories } from "@/lib/blog/categories";
import { blogLocale } from "@/lib/blog/locale";
import { BlogPostEditor } from "../blog-post-editor";

export const dynamic = "force-dynamic";
export const metadata = { title: "New post" };

/**
 * A blank post; its first save creates it. In the language of the Admin ->
 * Blog tab it was started from (?lang=it), English otherwise.
 */
export default async function AdminNewBlogPostPage({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  // listCategories has no guard of its own: the admin check comes first.
  await requireAdmin();
  const { lang } = await searchParams;
  return <BlogPostEditor post={null} categories={await listCategories()} newLocale={blogLocale(typeof lang === "string" ? lang : null)} />;
}
