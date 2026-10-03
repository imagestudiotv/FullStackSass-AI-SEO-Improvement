import { listPosts } from "@/lib/blog/posts";
import { buildSiteLlmsTxt, type LlmsPost } from "@/lib/site-llms-txt";
import { siteUrl } from "@/lib/site-url";

/**
 * /llms.txt - RepGet's guide for AI assistants. Content and reasoning live in
 * lib/site-llms-txt.ts; this only serves it.
 *
 * Built per request, like the sitemap, because it lists the published blog
 * posts. A database failure leaves the post list out rather than failing the
 * whole file: the product pages, tools and guides need no database.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  let posts: LlmsPost[] = [];
  try {
    posts = await listPosts();
  } catch (error) {
    console.error("[llms.txt] blog posts unavailable, serving without them", error);
  }

  return new Response(buildSiteLlmsTxt(siteUrl(), posts), {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      // An hour at the edge: assistants re-read it rarely, posts change rarely.
      "cache-control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
