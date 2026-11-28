import { and, eq, gte } from "drizzle-orm";

import { anthropic, MODELS } from "@/lib/ai/client";
import { dataBlock, dataRule } from "@/lib/ai/untrusted";
import { db } from "@/lib/db";
import { competitors, geoResults, websites } from "@/lib/db/schema";
import { keepLiveDomains } from "@/lib/websites/verify-domain";
import { AI_VISIBILITY_SOURCE } from "./competitor-sources";

/**
 * The competitors AI assistants name, copied into the business profile.
 *
 * AI visibility listed the businesses ChatGPT recommends instead of the
 * customer while their Business profile said "Competitors: 0" (review of
 * 2026-11-27): the two never met. After each AI visibility check the names
 * most often recommended are turned into websites and added to the profile,
 * as suggestions (source "ai_visibility"):
 *  - a name that already is a web address is used as it is; the others get
 *    their official website from one Haiku call, which may answer "unknown";
 *  - every address must resolve and answer (keepLiveDomains), as analysis's
 *    own suggestions must - a model's guess is not a competitor;
 *  - never the website itself, never a directory, marketplace or social
 *    network;
 *  - added, never overwriting: a competitor the customer typed stays theirs,
 *    and one they removed stays removed (DISMISSED, kept as a marker).
 */

export { AI_VISIBILITY_SOURCE, DISMISSED_SOURCE } from "./competitor-sources";

/** Answers read: the last two months of checks. */
const WINDOW_DAYS = 60;
/** At most this many new suggestions per sync, and this many from AI visibility in all. */
const PER_SYNC = 5;
const MAX_FROM_VISIBILITY = 10;

const HOST = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:[a-z]{2,63}|xn--[a-z0-9-]{2,59})$/i;

/** Places that list businesses rather than being one. */
const NOT_A_COMPETITOR = [
  "google.", "yelp.", "tripadvisor.", "facebook.com", "instagram.com", "linkedin.com", "youtube.com", "tiktok.com",
  "x.com", "twitter.com", "pinterest.", "amazon.", "ebay.", "etsy.", "wikipedia.org", "reddit.com", "booking.com",
  "trustpilot.", "yellowpages.", "maps.apple.com", "airbnb.", "fiverr.com", "upwork.com",
];

/** A web address, as the profile stores one, or null: "https://www.Example.com/a" -> "example.com". */
export function hostOf(value: string): string | null {
  const host = value.trim().toLowerCase().replace(/^[a-z][a-z0-9+.-]*:\/\//, "").replace(/^www\./, "").split(/[/?#\s]/)[0] ?? "";
  return HOST.test(host) ? host : null;
}

export function isListingSite(host: string): boolean {
  return NOT_A_COMPETITOR.some((mark) => (mark.endsWith(".") ? host.startsWith(mark) || host.includes(`.${mark}`) : host === mark || host.endsWith(`.${mark}`)));
}

/** The names recommended in the window, most often first; ties by first seen. */
export function rankedNames(lists: unknown[]): string[] {
  const counts = new Map<string, { name: string; count: number; first: number }>();
  let order = 0;
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      if (typeof item !== "string") continue;
      const name = item.trim().replace(/\s+/g, " ");
      const key = name.toLowerCase();
      if (name.length < 2 || name.length > 80) continue;
      const entry = counts.get(key);
      if (entry) entry.count++;
      else counts.set(key, { name, count: 1, first: order++ });
    }
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.first - b.first).map((entry) => entry.name);
}

const SCHEMA = {
  type: "object",
  properties: {
    websites: {
      type: "array",
      items: {
        type: "object",
        properties: {
          n: { type: "integer" },
          domain: { type: "string", description: "The business's own website domain, e.g. example.com, or an empty string when not certain." },
        },
        required: ["n", "domain"],
        additionalProperties: false,
      },
    },
  },
  required: ["websites"],
  additionalProperties: false,
} as const;

/** Each business name's official website, where the model is certain of it. */
export async function websitesForNames(
  names: string[],
  market: { country: string | null; industry: string | null },
): Promise<{ domains: string[]; usage: { inputTokens: number; outputTokens: number } }> {
  if (names.length === 0) return { domains: [], usage: { inputTokens: 0, outputTokens: 0 } };
  const response = await anthropic.messages.create({
    model: MODELS.EXTRACTION,
    max_tokens: 1000,
    system: `For each numbered business name, give the domain of that business's own official website (for example "example.com"), only when you are certain which business it is and what its website is. Otherwise an empty string. Never guess a domain from the name, never give a directory, marketplace, social network or review site. ${dataRule("site_data")}`,
    output_config: { format: { type: "json_schema", schema: SCHEMA } },
    messages: [{
      role: "user",
      content: dataBlock("site_data", JSON.stringify({
        market: market.country, industry: market.industry,
        names: names.map((name, index) => `${index + 1}. ${name}`),
      })),
    }],
  });
  const usage = { inputTokens: response.usage?.input_tokens ?? 0, outputTokens: response.usage?.output_tokens ?? 0 };
  if (response.stop_reason !== "end_turn") return { domains: [], usage };
  const block = response.content.find((item) => item.type === "text");
  if (!block || block.type !== "text") return { domains: [], usage };
  const parsed = JSON.parse(block.text) as { websites?: unknown };
  const domains = (Array.isArray(parsed.websites) ? parsed.websites : []).flatMap((item) => {
    const domain = typeof item === "object" && item !== null ? (item as { domain?: unknown }).domain : null;
    const host = typeof domain === "string" ? hostOf(domain) : null;
    return host ? [host] : [];
  });
  return { domains, usage };
}

export type SyncResult = {
  added: string[];
  usage: { inputTokens: number; outputTokens: number } | null;
};

/**
 * Adds what AI visibility recommends to the profile's competitors. The model
 * call is the only cost (Haiku, a few hundred tokens), and is not made when
 * every name is already a web address or there is no room left.
 */
export async function syncAiVisibilityCompetitors(
  websiteId: string,
  options: { now?: Date; lookUp?: typeof websitesForNames; verify?: typeof keepLiveDomains } = {},
): Promise<SyncResult> {
  const lookUp = options.lookUp ?? websitesForNames;
  const verify = options.verify ?? keepLiveDomains;
  const [site] = await db
    .select({ domain: websites.domain, country: websites.country, industry: websites.industry })
    .from(websites)
    .where(eq(websites.id, websiteId))
    .limit(1);
  if (!site) return { added: [], usage: null };

  const since = new Date((options.now ?? new Date()).getTime() - WINDOW_DAYS * 86_400_000);
  const answers = await db
    .select({ competitors: geoResults.competitors })
    .from(geoResults)
    .where(and(eq(geoResults.websiteId, websiteId), gte(geoResults.checkedAt, since)));
  const names = rankedNames(answers.map((row) => row.competitors));
  if (names.length === 0) return { added: [], usage: null };

  const stored = await db
    .select({ domain: competitors.domain, source: competitors.source })
    .from(competitors)
    .where(eq(competitors.websiteId, websiteId));
  const room = Math.min(PER_SYNC, MAX_FROM_VISIBILITY - stored.filter((row) => row.source === AI_VISIBILITY_SOURCE).length);
  if (room <= 0) return { added: [], usage: null };

  const own = hostOf(site.domain) ?? site.domain.toLowerCase();
  const taken = new Set(stored.map((row) => row.domain.toLowerCase()));
  const usable = (host: string) => host !== own && !host.endsWith(`.${own}`) && !taken.has(host) && !isListingSite(host);

  // The most recommended first; only as many as could be added, with a little spare for the ones that fail.
  const top = names.slice(0, room * 3);
  const direct = top.flatMap((name) => {
    const host = hostOf(name);
    return host ? [host] : [];
  });
  const toLookUp = top.filter((name) => !hostOf(name));
  const looked = toLookUp.length > 0 ? await lookUp(toLookUp, { country: site.country, industry: site.industry }) : null;

  const candidates = [...new Set([...direct, ...(looked?.domains ?? [])])].filter(usable).slice(0, room * 2);
  const live = candidates.length > 0 ? (await verify(candidates)).live : [];
  const added = live.slice(0, room);
  if (added.length > 0) {
    await db
      .insert(competitors)
      .values(added.map((domain) => ({ websiteId, domain, source: AI_VISIBILITY_SOURCE })))
      // A row already there - the customer's, analysis's, or one they removed - is left exactly as it is.
      .onConflictDoNothing({ target: [competitors.websiteId, competitors.domain] });
  }
  return { added, usage: looked?.usage ?? null };
}
