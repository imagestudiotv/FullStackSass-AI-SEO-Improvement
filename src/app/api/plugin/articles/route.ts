import { NextResponse, type NextRequest } from "next/server";

import { and, asc, eq, isNull } from "drizzle-orm";

import { db } from "@/lib/db";
import { articles } from "@/lib/db/schema";
import { resolveIntegrationKey } from "@/lib/plugin/keys";

/**
 * Articles waiting to be published: GET /api/plugin/articles
 *
 * The plugin PULLS rather than us pushing. That is the whole reason the plugin
 * exists: a WordPress site behind a firewall, on a staging domain, or with the
 * REST API locked down cannot receive a push, and those installs are exactly
 * the ones where the application-password flow fails.
 *
 * Pulling also means we never hold write credentials to the customer's site.
 * The plugin already runs there with permission to create posts.
 */

export const dynamic = "force-dynamic";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "content-type, x-integration-key",
  "access-control-allow-methods": "GET, OPTIONS",
};

/** Articles returned per poll. Bounded so one call cannot return everything. */
const BATCH_SIZE = 5;

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(request: NextRequest) {
  const resolved = await resolveIntegrationKey(
    request.headers.get("x-integration-key"),
  );

  if (!resolved) {
    return NextResponse.json(
      { ok: false, error: "That integration key is not valid." },
      { status: 401, headers: CORS },
    );
  }

  /**
   * Scoped to the key's own website. The key identifies exactly one site, so
   * there is no id in the request to tamper with — a plugin cannot ask for
   * another customer's articles because it has no way to name one.
   */
  const rows = await db
    .select({
      id: articles.id,
      title: articles.title,
      slug: articles.slug,
      bodyHtml: articles.bodyHtml,
      metaDescription: articles.metaDescription,
      imageUrl: articles.imageUrl,
      imageAlt: articles.imageAlt,
    })
    .from(articles)
    .where(
      and(
        eq(articles.websiteId, resolved.websiteId),
        // Approved but not yet live. A draft is still being worked on, and a
        // published row already has its post.
        eq(articles.status, "draft"),
        isNull(articles.publishedUrl),
      ),
    )
    // Oldest first: the queue should drain in the order it filled.
    .orderBy(asc(articles.createdAt))
    .limit(BATCH_SIZE);

  return NextResponse.json(
    {
      ok: true,
      articles: rows
        // An article with no body is mid-generation, not ready to publish.
        .filter((row) => Boolean(row.bodyHtml))
        .map((row) => ({
          id: row.id,
          title: row.title,
          slug: row.slug,
          html: row.bodyHtml,
          excerpt: row.metaDescription,
          image: row.imageUrl
            ? { url: row.imageUrl, alt: row.imageAlt ?? row.title }
            : null,
        })),
    },
    { headers: CORS },
  );
}
