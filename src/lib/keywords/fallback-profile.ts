import { and, desc, eq, gte, isNotNull, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { gscMetrics, websites } from "@/lib/db/schema";
import type { PageSnapshot } from "@/lib/websites/crawl";
import { extractProfile, type ExtractedProfile } from "@/lib/websites/extract";
import type { SeedInput, SeedKeyword } from "@/lib/keywords/seeds";

/**
 * A first content plan for a website RepGet could not read.
 *
 * WHY (client, 2026-11-27: "after few hours of registering they get 0
 * article"). Keyword research builds its seeds from the profile the website
 * analysis writes. When the site does not answer (down, firewalled, refusing
 * other countries), the analysis saves nothing, the seeds are empty and every
 * research run ends with no plan - so a Free sign-up with Search Console
 * connected (1,417 real searches imported) got no article at all.
 *
 * WHAT. When the profile is empty, research asks the profiler for one from
 * what IS known: the address (a domain often names the business and the
 * country) and the searches that already bring people to the site (Google
 * Search Console). The fields it fills are saved, only where they are empty,
 * so articles are written with the same context, and the customer can correct
 * them on the website page as always. If seeds still come back empty, the top
 * Search Console searches are the seeds: they are what real people typed.
 */

export function isEmptyProfile(profile: { industry: string | null; description: string | null; services: unknown }): boolean {
  const services = Array.isArray(profile.services) ? profile.services : [];
  return !profile.industry && !profile.description && services.length === 0;
}

/** The searches that brought people to the site in the last 120 days, most seen first. */
export async function topSearchQueries(websiteId: string, limit = 40, now: Date = new Date()): Promise<string[]> {
  const since = new Date(now.getTime() - 120 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const rows = await db
    .select({ query: sql<string>`lower(${gscMetrics.query})`, impressions: sql<number>`sum(${gscMetrics.impressions})::int` })
    .from(gscMetrics)
    .where(and(eq(gscMetrics.websiteId, websiteId), isNotNull(gscMetrics.query), gte(gscMetrics.date, since)))
    .groupBy(sql`lower(${gscMetrics.query})`)
    .orderBy(desc(sql`sum(${gscMetrics.impressions})`))
    .limit(limit * 2);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const row of rows) {
    const query = (row.query ?? "").trim().toLowerCase().replace(/\s+/g, " ");
    if (!query || query.length > 120 || seen.has(query)) continue;
    seen.add(query);
    out.push(query);
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * What the profiler reads instead of a homepage: the address and the
 * searches. Kept in the page block (lib/ai/untrusted.ts), like a crawled page.
 */
export function signalsSnapshot(input: { url: string; domain: string; queries: string[] }): PageSnapshot {
  const text = [
    "The homepage could not be read. Profile the business only from its web address and the Google searches that already show this site.",
    `Web address: ${input.url} (domain ${input.domain})`,
    input.queries.length
      ? `Google searches that show this site, most frequent first: ${input.queries.join(" | ")}`
      : "No search data is available.",
  ].join("\n");
  return {
    finalUrl: input.url,
    statusCode: 0,
    title: null,
    metaDescription: null,
    ogSiteName: null,
    lang: null,
    h1: null,
    headings: [],
    text,
    internalLinks: [],
    externalHosts: [],
    wordCount: text.split(/\s+/).length,
    internalUrls: [],
    images: [],
    canonical: null,
  } as unknown as PageSnapshot;
}

export async function profileFromSignals(input: { url: string; domain: string; queries: string[] }): Promise<ExtractedProfile> {
  return extractProfile(signalsSnapshot(input));
}

/** The profile with the inferred fields filling only what was empty: anything the customer or the analysis wrote wins. */
export function mergeProfile<T extends SeedInput>(current: T, inferred: ExtractedProfile): T {
  const services = Array.isArray(current.services) ? current.services : [];
  return {
    ...current,
    brandName: current.brandName ?? inferred.brandName,
    industry: current.industry ?? inferred.industry,
    country: current.country ?? inferred.country,
    language: current.language ?? inferred.language,
    description: current.description ?? inferred.description,
    targetAudience: current.targetAudience ?? inferred.targetAudience,
    services: services.length ? services : inferred.services,
  };
}

/** Saves the inferred fields on the website, only where the column is still empty. */
export async function saveInferredProfile(websiteId: string, inferred: ExtractedProfile): Promise<void> {
  await db
    .update(websites)
    .set({
      brandName: sql`coalesce(${websites.brandName}, ${inferred.brandName})`,
      industry: sql`coalesce(${websites.industry}, ${inferred.industry})`,
      country: sql`coalesce(${websites.country}, ${inferred.country})`,
      language: sql`coalesce(${websites.language}, ${inferred.language})`,
      description: sql`coalesce(${websites.description}, ${inferred.description})`,
      targetAudience: sql`coalesce(${websites.targetAudience}, ${inferred.targetAudience})`,
      services: inferred.services.length
        ? sql`case when coalesce(jsonb_typeof(${websites.services}), 'null') <> 'array' then ${JSON.stringify(inferred.services)}::jsonb when jsonb_array_length(${websites.services}) = 0 then ${JSON.stringify(inferred.services)}::jsonb else ${websites.services} end`
        : websites.services,
      updatedAt: new Date(),
    })
    .where(eq(websites.id, websiteId));
}

/** The searches themselves as seeds, when the model gave none: real phrases people typed. */
export function seedsFromQueries(queries: string[], brand: string | null, max = 30): SeedKeyword[] {
  const brandWords = (brand ?? "").toLowerCase().split(/\s+/).filter((word) => word.length > 3);
  return queries
    .filter((query) => !brandWords.some((word) => query.includes(word)))
    .slice(0, max)
    .map((term) => ({ term, intent: /\b(buy|price|prezzo|comprar|acheter|kaufen|shop|negozio|online)\b/.test(term) ? "transactional" : "informational" }));
}
