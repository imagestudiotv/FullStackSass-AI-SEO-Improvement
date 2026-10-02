import { and, desc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { isUnfollowed } from "@/lib/backlinks/follow";
import { db } from "@/lib/db";
import { articles, backlinkRequests, linkChecks, placements, websites } from "@/lib/db/schema";
import { notify } from "@/lib/notifications/create";

/**
 * The nofollow rule: a network backlink found on its live page marked
 * nofollow, sponsored or ugc passes little SEO value, so the host is told to
 * fix it and the beneficiary is told why (client, 2026-10-01: other link
 * platforms "alerted me to fix it to dofollow").
 *
 * It is a warning, never an accounting event: the link IS live, credits stay
 * where verification put them (lib/backlinks/placements.ts), and the
 * dashboard lists it under the "nofollow" issue (lib/reporting/backlinks.ts)
 * until a check sees it followed.
 *
 * ONCE PER CHANGE. Alerts go out on the check where a link BECOMES unfollowed
 * - its first sighting, or the first after one that was followed - not on
 * every daily re-check of a link that stays that way. Links RepGet itself
 * sent nofollow before placements were delivered followed were already seen
 * that way, so they raise no alert; the dashboard still lists them.
 */
export async function alertIfNewlyUnfollowed(placementId: string): Promise<boolean> {
  const sightings = await db
    .select({ rel: linkChecks.rel })
    .from(linkChecks)
    .where(and(eq(linkChecks.placementId, placementId), eq(linkChecks.outcome, "alive")))
    .orderBy(desc(linkChecks.checkedAt))
    .limit(2);
  const [latest, previous] = sightings;
  if (!latest || !isUnfollowed(latest.rel)) return false;
  if (previous && isUnfollowed(previous.rel)) return false;

  const host = alias(websites, "host");
  const beneficiary = alias(websites, "beneficiary");
  const [row] = await db
    .select({
      liveUrl: placements.liveUrl,
      articleTitle: articles.title,
      hostId: host.id,
      hostDomain: host.domain,
      hostOrgId: host.organizationId,
      beneficiaryId: beneficiary.id,
      beneficiaryDomain: beneficiary.domain,
      beneficiaryOrgId: beneficiary.organizationId,
    })
    .from(placements)
    .innerJoin(backlinkRequests, eq(backlinkRequests.id, placements.requestId))
    .innerJoin(beneficiary, eq(beneficiary.id, backlinkRequests.websiteId))
    .innerJoin(host, eq(host.id, placements.hostWebsiteId))
    .leftJoin(articles, eq(articles.id, placements.articleId))
    .where(eq(placements.id, placementId))
    .limit(1);
  if (!row) return false;

  const rel = latest.rel ?? "";
  const where = row.articleTitle ? `"${row.articleTitle}"` : (row.liveUrl ?? "your article");
  await notify({
    organizationId: row.hostOrgId,
    type: "backlink.nofollow",
    title: `A partner link on ${row.hostDomain} is marked nofollow`,
    body: `The link to ${row.beneficiaryDomain} in ${where} has rel="${rel}" on the live page, so it passes no SEO value. Edit the post and remove nofollow / sponsored from that link.`,
    href: `/websites/${row.hostId}/backlinks/hosted?issue=nofollow`,
  });
  await notify({
    organizationId: row.beneficiaryOrgId,
    type: "backlink.nofollow",
    title: `Your backlink from ${row.hostDomain} is marked nofollow`,
    body: `It is live, but the page marks it rel="${rel}", so it passes little SEO value. The site owner has been asked to fix it.`,
    href: `/websites/${row.beneficiaryId}/backlinks/links?issue=nofollow`,
  });
  return true;
}
