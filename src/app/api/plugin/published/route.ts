import { NextResponse, type NextRequest } from "next/server";

import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { articles, publishLogs } from "@/lib/db/schema";
import { notify } from "@/lib/notifications/create";
import { resolveIntegrationKey } from "@/lib/plugin/keys";

/**
 * Publication confirmed: POST /api/plugin/published
 *
 * The plugin reports back after creating the post. Without this the same
 * article would be handed out on every poll forever, because nothing else
 * tells us it landed.
 *
 * The plugin is the only thing that knows the resulting URL, so this is also
 * where publishedUrl comes from.
 */

export const dynamic = "force-dynamic";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "content-type, x-integration-key",
  "access-control-allow-methods": "POST, OPTIONS",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(request: NextRequest) {
  const resolved = await resolveIntegrationKey(
    request.headers.get("x-integration-key"),
  );

  if (!resolved) {
    return NextResponse.json(
      { ok: false, error: "That integration key is not valid." },
      { status: 401, headers: CORS },
    );
  }

  let body: {
    articleId?: unknown;
    url?: unknown;
    remoteId?: unknown;
    error?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Expected a JSON body." },
      { status: 400, headers: CORS },
    );
  }

  const articleId = typeof body.articleId === "string" ? body.articleId : null;
  if (!articleId) {
    return NextResponse.json(
      { ok: false, error: "articleId is required." },
      { status: 400, headers: CORS },
    );
  }

  /**
   * Scoped to the key's website. An articleId from another workspace matches
   * nothing here, so a key cannot mark someone else's article as published.
   */
  const [article] = await db
    .select({ id: articles.id, title: articles.title })
    .from(articles)
    .where(
      and(
        eq(articles.id, articleId),
        eq(articles.websiteId, resolved.websiteId),
      ),
    )
    .limit(1);

  if (!article) {
    return NextResponse.json(
      { ok: false, error: "No such article." },
      { status: 404, headers: CORS },
    );
  }

  // The plugin reports failures too; a post that could not be created must not
  // be recorded as live.
  const failure = typeof body.error === "string" ? body.error : null;

  if (failure) {
    await db.insert(publishLogs).values({
      articleId: article.id,
      status: "failed",
      error: failure.slice(0, 500),
    });

    await notify({
      organizationId: resolved.organizationId,
      type: "article.failed",
      title: "An article could not be published",
      body: failure.slice(0, 200),
      href: `/websites/${resolved.websiteId}/articles/${article.id}`,
    });

    return NextResponse.json({ ok: true, recorded: "failed" }, { headers: CORS });
  }

  const url = typeof body.url === "string" ? body.url : null;
  const remoteId =
    typeof body.remoteId === "string" || typeof body.remoteId === "number"
      ? String(body.remoteId)
      : null;

  await db.insert(publishLogs).values({
    articleId: article.id,
    status: "published",
    remoteId,
    remoteUrl: url,
  });

  await db
    .update(articles)
    .set({ status: "published", publishedUrl: url, error: null, updatedAt: new Date() })
    .where(eq(articles.id, article.id));

  await notify({
    organizationId: resolved.organizationId,
    type: "article.published",
    title: `"${article.title}" is live`,
    body: url ?? undefined,
    href: `/websites/${resolved.websiteId}/articles/${article.id}`,
  });

  return NextResponse.json({ ok: true, recorded: "published" }, { headers: CORS });
}
