import { and, eq, ne, sql as raw } from "drizzle-orm";

import { db } from "@/lib/db";
import { networkSites, placements, websites } from "@/lib/db/schema";

/**
 * Chooses which site provides a link.
 *
 * A bad match is worse than no match: a dental clinic linked from a crypto blog
 * is either ignored by search engines or read as manipulation, and the customer
 * has still spent a credit for it. So this refuses rather than settles — an
 * unmatched request waits, which is the honest outcome while the network is
 * small.
 */

export type MatchCandidate = {
  websiteId: string;
  organizationId: string;
  domain: string;
  niche: string | null;
  authority: number | null;
  linksGivenThisMonth: number;
  monthlyCap: number;
  score: number;
};

/**
 * Niche groups. Two sites match when they share a group, not when their niche
 * strings are equal — "dental clinic" and "dentist" are the same market and a
 * string comparison would miss it.
 *
 * Deliberately coarse. Over-narrow grouping leaves everyone unmatched, which is
 * the failure mode that actually kills a young network.
 */
const NICHE_GROUPS: Record<string, string[]> = {
  health: ["health", "dental", "dentist", "medical", "clinic", "wellness", "fitness", "therapy", "pharmacy", "veterinary"],
  home: ["home", "construction", "plumbing", "electrical", "roofing", "interior", "garden", "cleaning", "renovation", "furniture"],
  legal_finance: ["legal", "law", "solicitor", "accounting", "finance", "insurance", "mortgage", "tax", "banking", "investment"],
  tech: ["software", "saas", "technology", "it", "web", "app", "hosting", "cyber", "data", "ai"],
  marketing: ["marketing", "seo", "advertising", "design", "branding", "media", "pr", "content"],
  retail: ["retail", "ecommerce", "shop", "store", "fashion", "clothing", "jewellery", "beauty", "cosmetics"],
  hospitality: ["restaurant", "cafe", "hotel", "travel", "tourism", "catering", "bar", "food", "event"],
  education: ["education", "school", "training", "course", "tutoring", "university", "learning"],
  automotive: ["automotive", "car", "vehicle", "garage", "motor", "tyre"],
  professional: ["consulting", "recruitment", "hr", "logistics", "manufacturing", "engineering", "property", "real estate"],
};

/** Maps a free-text niche onto a group, or null when nothing fits. */
export function nicheGroup(niche: string | null): string | null {
  if (!niche) return null;
  const text = niche.toLowerCase();
  for (const [group, terms] of Object.entries(NICHE_GROUPS)) {
    if (terms.some((term) => text.includes(term))) return group;
  }
  return null;
}

/** Weights. Reciprocity and capacity are hard rules; the rest is preference. */
const SCORE = {
  sameNiche: 40,
  relatedFallback: 10,
  sameCountry: 20,
  authorityMax: 20,
  freshnessMax: 20,
} as const;

export type MatchInput = {
  /** The site that wants the link. */
  requesterWebsiteId: string;
  requesterOrgId: string;
  niche: string | null;
  language: string | null;
  country: string | null;
};

/**
 * Finds the best host for a link, or null when nothing suitable exists.
 *
 * Hard exclusions are applied in SQL; preference scoring happens afterwards in
 * TypeScript, where the niche grouping lives.
 */
export async function findHost(
  input: MatchInput,
): Promise<MatchCandidate | null> {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  /**
   * ISO string, not a Date: postgres-js cannot bind a Date inside raw SQL and
   * fails with "argument must be of type string". Drizzle's own helpers accept
   * Dates, but these counts are raw subqueries.
   */
  const monthStartIso = monthStart.toISOString();

  const rows = await db
    .select({
      websiteId: networkSites.websiteId,
      organizationId: websites.organizationId,
      domain: websites.domain,
      niche: networkSites.niche,
      country: networkSites.country,
      language: networkSites.language,
      authority: networkSites.authority,
      monthlyCap: networkSites.monthlyCap,
      linksGivenThisMonth: raw<number>`(
        select count(*)::int from placements p
        where p.host_website_id = ${networkSites.websiteId}
          and p.created_at >= ${monthStartIso}::timestamp
          and p.status in ('pending', 'live')
      )`,
      /**
       * Reciprocity check. If the candidate has EVER received a link from the
       * requester, it must not link back: mutual links are the pattern search
       * engines discount most, and avoiding them is the whole reason credits
       * exist instead of direct swaps.
       */
      linksToRequester: raw<number>`(
        select count(*)::int from placements p
        join backlink_requests r on r.id = p.request_id
        where p.host_website_id = ${input.requesterWebsiteId}
          and r.website_id = ${networkSites.websiteId}
      )`,
    })
    .from(networkSites)
    .innerJoin(websites, eq(networkSites.websiteId, websites.id))
    .where(
      and(
        eq(networkSites.acceptingLinks, true),
        // Never itself.
        ne(networkSites.websiteId, input.requesterWebsiteId),
        // Never another site in the same organization: linking your own sites
        // together is a self-referential network, not an independent vote.
        ne(websites.organizationId, input.requesterOrgId),
        // Language must match or the link is useless to readers.
        input.language
          ? raw`(${networkSites.language} is null or lower(${networkSites.language}) = lower(${input.language}))`
          : raw`true`,
      ),
    );

  const requesterGroup = nicheGroup(input.niche);

  const scored = rows
    .filter((row) => row.linksToRequester === 0)
    .filter((row) => row.linksGivenThisMonth < row.monthlyCap)
    .map((row) => {
      let score = 0;

      const hostGroup = nicheGroup(row.niche);
      /**
       * Relevance is a HARD requirement, not a scored preference.
       *
       * An earlier version gave an unrecognised niche the same
       * benefit-of-the-doubt as a missing one, and same-country plus spare
       * capacity alone scored 40 — enough to clear the bar. A dentist was
       * offered a crypto blog. Country and capacity say nothing about whether
       * a link makes sense, so they can no longer carry a match on their own.
       */
      const relevant =
        // Both sides known and in the same group: a real topical match.
        (requesterGroup !== null && hostGroup !== null && requesterGroup === hostGroup) ||
        // Neither side classified: no evidence either way, so allow it. A new
        // network is mostly unclassified sites and refusing all of them would
        // leave every request unmatched.
        (requesterGroup === null && hostGroup === null);

      if (!relevant) return null;

      score +=
        requesterGroup !== null && hostGroup !== null
          ? SCORE.sameNiche
          : SCORE.relatedFallback;

      if (
        input.country &&
        row.country &&
        input.country.toLowerCase() === row.country.toLowerCase()
      ) {
        score += SCORE.sameCountry;
      }

      // Higher authority is better, capped so it cannot outweigh relevance.
      score += Math.min((row.authority ?? 0) / 100, 1) * SCORE.authorityMax;

      /**
       * Prefer sites with spare capacity, so links spread across the network
       * instead of concentrating on a few hosts. A site carrying every
       * outbound link is exactly what a link farm looks like.
       */
      const usage = row.monthlyCap > 0 ? row.linksGivenThisMonth / row.monthlyCap : 1;
      score += (1 - usage) * SCORE.freshnessMax;

      return {
        websiteId: row.websiteId,
        organizationId: row.organizationId,
        domain: row.domain,
        niche: row.niche,
        authority: row.authority,
        linksGivenThisMonth: row.linksGivenThisMonth,
        monthlyCap: row.monthlyCap,
        score: Math.round(score * 10) / 10,
      };
    })
    .filter((candidate): candidate is MatchCandidate => candidate !== null)
    // Relevance is already enforced above; this only drops the very weakest
    // of the remaining candidates.
    .filter((candidate) => candidate.score >= 20)
    .sort((a, b) => b.score - a.score);

  return scored[0] ?? null;
}

/** Explains why matching failed, so the UI says something useful. */
export async function describeNetwork(): Promise<{
  totalSites: number;
  acceptingSites: number;
  withCapacity: number;
}> {
  const [row] = await db
    .select({
      totalSites: raw<number>`count(*)::int`,
      acceptingSites: raw<number>`count(*) filter (where ${networkSites.acceptingLinks})::int`,
      withCapacity: raw<number>`count(*) filter (where ${networkSites.acceptingLinks} and ${networkSites.monthlyCap} > ${networkSites.linksGiven})::int`,
    })
    .from(networkSites);

  return {
    totalSites: row?.totalSites ?? 0,
    acceptingSites: row?.acceptingSites ?? 0,
    withCapacity: row?.withCapacity ?? 0,
  };
}

export { placements };
