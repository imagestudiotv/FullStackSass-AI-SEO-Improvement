import { NextResponse, type NextRequest } from "next/server";


import { eq } from "drizzle-orm";

import { prepareForDelivery } from "@/lib/articles/delivery";
import { prepareStoredArticle } from "@/lib/articles/internal-links";
import { siteScope } from "@/lib/articles/link-guard";
import { placementUrlsForArticle } from "@/lib/backlinks/placements";
import { db } from "@/lib/db";
import { websites } from "@/lib/db/schema";
import { dueArticlesForPlugin, pluginPostsForWebsite } from "@/lib/plugin/due";
import { recordSyncUrl } from "@/lib/plugin/sync";
import { recordInstall, recordPluginVersion, resolveIntegrationKey } from "@/lib/plugin/keys";
import { claimDispatch } from "@/lib/publishing/dispatch";
import { pluginProtocol } from "@/lib/plugin/protocol";

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
  "access-control-allow-headers": "content-type, x-integration-key, x-repget-plugin-version, x-repget-sync-url",
  "access-control-allow-methods": "GET, OPTIONS",
};

/** Articles returned per poll. Bounded so one call cannot return everything. */
const BATCH_SIZE = 5;

/**
 * Network time for link checks per poll, across the whole batch. The plugin
 * waits on this request, so it stays well inside its timeout; links not
 * reached are delivered as they are and checked on the next poll.
 */
const LINK_CHECK_BUDGET_MS = 8_000;

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
  /*
    1.4.0+ sends its check-now address on every request, so a site that
    upgrades the plugin becomes instant-publish on its next hourly check
    without reconnecting. Stored only when on the site's own domain.
  */
  const reportedSyncUrl = request.headers.get("x-repget-sync-url");
  if (reportedSyncUrl) {
    await recordSyncUrl(resolved.keyId, resolved.websiteDomain, reportedSyncUrl);
    // Which install this is: Disconnect on a copy of the site must not revoke the live key.
    await recordInstall(resolved.keyId, reportedSyncUrl);
  }

  /*
    1.6.0+ echoes each hand-over's dispatch id in its report, so reports are
    matched exactly; older plugins report by article only and get the
    one-outstanding-revision rule (lib/publishing/dispatch.ts).
  */
  const pluginVersion = request.headers.get("x-repget-plugin-version");
  const protocol = pluginProtocol(pluginVersion);
  // So the card stops offering an update this site has installed (see recordPluginVersion).
  await recordPluginVersion(resolved.keyId, pluginVersion).catch(() => undefined);

  const [due, sent] = await Promise.all([
    dueArticlesForPlugin(resolved.websiteId, BATCH_SIZE),
    pluginPostsForWebsite(resolved.websiteId),
  ]);

  /*
    Links checked before the HTML leaves: drafts written before links were
    verified can hold "#" placeholders and invented paths, and this is the
    last point before they become a live post. Confirmed defects are fixed
    in the stored copy (its original kept as a version) and THAT copy is
    what is sent. Checks are cached per website, so a poll re-checks
    nothing it checked recently; what does not fit the time budget is left
    as it is, not removed. See lib/articles/internal-links.ts.
  */
  const deadline = Date.now() + LINK_CHECK_BUDGET_MS;
  const [site] = await db
    .select({ url: websites.url, domain: websites.domain, poweredByLink: websites.poweredByLink })
    .from(websites)
    .where(eq(websites.id, resolved.websiteId))
    .limit(1);
  const rows = [];
  for (const row of due) {
    // An article with no body is mid-generation, not ready to publish.
    if (!row.bodyHtml) continue;
    try {
      await prepareStoredArticle(row.id, resolved.websiteId, {
        budgetMs: Math.max(0, deadline - Date.now()),
      });
    } catch (error) {
      // Checking must not stop publishing: the stored copy goes as it is.
      console.error("[plugin] could not check an article's links", {
        articleId: row.id,
        error: error instanceof Error ? error.message : "unknown",
      });
    }
    /*
      THE DISPATCH BOUNDARY (lib/publishing/dispatch.ts). Handing an article
      to the plugin is sending it: the claim locks the article, re-checks the
      freeze, the review gate and the schedule, and records this revision as
      in flight - so an edit or a review change saved after this point is
      refused until the plugin reports back, rather than racing it. What is
      sent is exactly the claimed revision, as the status the claim decided
      from the settings now (a Publish press, the first-article rule, or
      "Publish as").
    */
    const claim = await claimDispatch({
      articleId: row.id,
      websiteId: resolved.websiteId,
      channel: "plugin",
      trigger: "plugin",
      protocol,
      owner: `plugin:${resolved.keyId}`,
    });
    if (!claim.ok) continue;
    rows.push({
      ...row,
      status: claim.status,
      dispatch: { id: claim.dispatchId, revision: claim.revisionHash },
      title: claim.article.title,
      slug: claim.article.slug,
      metaDescription: claim.article.metaDescription,
      imageUrl: claim.article.imageUrl,
      imageAlt: claim.article.imageAlt,
      // The credit line, responsive images, section links. See lib/articles/delivery.ts.
      bodyHtml: prepareForDelivery(claim.article.bodyHtml, {
        poweredBy: site?.poweredByLink ?? false,
        siteHosts: site ? siteScope(site).hosts : undefined,
        followUrls: await placementUrlsForArticle(row.id),
      }),
    });
  }

  return NextResponse.json(
    {
      ok: true,
      // Posts this plugin already created, for moving them to another
      // content type. Ignored by plugins before 1.5.0.
      sent: sent
        .filter((row) => row.postId && /^\d+$/.test(row.postId))
        .map((row) => ({ articleId: row.articleId, postId: Number(row.postId) })),
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
          // Decided at the claim: a Publish press, the first-article rule,
          // or the website's setting now. See lib/publishing/dispatch.ts.
          status: row.status,
          // Echoed back by 1.6.0+ in its report; ignored by older plugins.
          dispatch: row.dispatch,
        })),
    },
    { headers: CORS },
  );
}
