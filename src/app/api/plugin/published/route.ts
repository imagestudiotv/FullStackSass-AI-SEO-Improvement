import { NextResponse, type NextRequest } from "next/server";

import { notify } from "@/lib/notifications/create";
import { resolveIntegrationKey } from "@/lib/plugin/keys";
import { markFirstArticleSentAndContinue } from "@/lib/publishing/policy";
import { recordArticlePublication } from "@/lib/backlinks/placements";
import { acknowledgePluginDispatch, type PluginReport } from "@/lib/publishing/acknowledge";

/**
 * Publication confirmed: POST /api/plugin/published
 *
 * The plugin reports back after creating (or failing to create) the post.
 * Without this the same article would be handed out on every poll forever,
 * because nothing else tells us it landed. The plugin is the only thing that
 * knows the resulting URL, so this is also where publishedUrl comes from.
 *
 * Each report settles exactly the hand-over it answers - see
 * lib/publishing/acknowledge.ts: 1.6.0+ plugins send `dispatchId` and the
 * status WordPress actually stored; older plugins are correlated by article.
 * A repeated report changes nothing; a late one is recorded as history.
 */

export const dynamic = "force-dynamic";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "content-type, x-integration-key, x-repget-plugin-version",
  "access-control-allow-methods": "POST, OPTIONS",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** WordPress post statuses a report may carry. */
const POST_STATUSES = new Set(["publish", "future", "draft", "pending", "private"]);

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
    dispatchId?: unknown;
    url?: unknown;
    remoteId?: unknown;
    error?: unknown;
    status?: unknown;
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
  const dispatchId = typeof body.dispatchId === "string" && UUID.test(body.dispatchId) ? body.dispatchId : null;

  // The plugin reports failures too; a post that could not be created must
  // not be recorded as live.
  const failure = typeof body.error === "string" ? body.error : null;
  /*
    What WordPress stored. 1.6.0 reports get_post_status after saving; 1.3.2
    to 1.5.x report the status they were asked for; older plugins send
    nothing and always published live, so absent means "publish".
  */
  const reported = typeof body.status === "string" && POST_STATUSES.has(body.status) ? body.status : "publish";
  const report: PluginReport = failure
    ? { kind: "failed", error: failure }
    : {
        kind: "sent",
        remoteUrl: typeof body.url === "string" ? body.url : null,
        remoteId: typeof body.remoteId === "string" || typeof body.remoteId === "number" ? String(body.remoteId) : null,
        remoteStatus: reported,
      };

  /**
   * Scoped to the key's website. An articleId (or dispatchId) from another
   * workspace matches nothing, so a key cannot settle someone else's article.
   */
  const ack = await acknowledgePluginDispatch({ websiteId: resolved.websiteId, articleId, dispatchId, report });

  if (ack.result === "unknown_article") {
    return NextResponse.json({ ok: false, error: "No such article." }, { status: 404, headers: CORS });
  }
  if (ack.result === "unknown_dispatch") {
    return NextResponse.json({ ok: false, error: "No such delivery for this article." }, { status: 404, headers: CORS });
  }
  if (ack.result === "moved") {
    // The post's new address: backlinks it carries are checked there.
    await recordArticlePublication(ack.article.id, ack.remoteUrl, ack.live ? "publish" : "draft");
    return NextResponse.json({ ok: true, recorded: "moved" }, { headers: CORS });
  }
  // Answered with 200 so the plugin drops the report from its queue.
  if (ack.result === "duplicate" || ack.result === "late") {
    return NextResponse.json({ ok: true, recorded: ack.result }, { headers: CORS });
  }

  const href = `/websites/${resolved.websiteId}/articles/${ack.article.id}`;
  if (ack.report.kind === "failed") {
    await notify({
      organizationId: resolved.organizationId,
      type: "article.failed",
      title: "An article could not be published",
      body: ack.report.error.slice(0, 200),
      href,
    });
    return NextResponse.json({ ok: true, recorded: "failed" }, { headers: CORS });
  }

  /*
    The real URL of any backlink this article carries, so it can be checked
    live before anyone is charged (lib/backlinks/placements.ts). A WordPress
    draft is not publication.
  */
  await recordArticlePublication(ack.article.id, ack.report.remoteUrl, ack.live ? "publish" : "draft");

  /*
    The website's first article is out. Record it, so the first-article
    rule never fires again, and - only for the call that recorded it -
    start writing the next two days' articles now rather than at the next
    scheduled run. See lib/publishing/policy.ts.
  */
  await markFirstArticleSentAndContinue(resolved.websiteId);

  await notify({
    organizationId: resolved.organizationId,
    type: "article.published",
    // A WordPress draft is not live; saying otherwise would send the
    // customer looking for a page nobody can visit.
    title: ack.live ? `"${ack.article.title}" is live` : `"${ack.article.title}" was saved as a draft`,
    body: ack.live ? ack.report.remoteUrl ?? undefined : "Publish it from WordPress when ready.",
    href,
  });

  return NextResponse.json({ ok: true, recorded: ack.live ? "published" : "draft" }, { headers: CORS });
}
