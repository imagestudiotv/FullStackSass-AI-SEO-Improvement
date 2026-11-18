/**
 * Company suggestions under the homepage field as a name is typed, like
 * explee.com (Daniel, 2026-11-19: "imagestudio" offers imagestudio.com and
 * imagestudio.com.br, each with its logo): Brandfetch's Brand Search API.
 *
 * Its terms decide the shape (docs.brandfetch.com/brand-search-api): the
 * visitor's browser asks it directly with the public client ID - never our
 * server - results are used live and never stored, and the logos are
 * hotlinked from Brandfetch's CDN, not copied. Free up to 500,000 searches a
 * month. Without NEXT_PUBLIC_BRANDFETCH_CLIENT_ID nothing is asked, and the
 * field suggests only the typed website itself (lib/websites/public-preview.ts).
 */

export type BrandMatch = {
  name: string;
  domain: string;
  /** Brandfetch's CDN address for the logo, or null. */
  icon: string | null;
};

const ENDPOINT = "https://api.brandfetch.io/v2/search/";
/** Brandfetch answers with at most five. */
export const MAX_BRANDS = 5;
const HOST = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:[a-z]{2,63}|xn--[a-z0-9-]{2,59})$/i;

/** The client ID, written out so Next inlines it at build; null while unset. */
export function brandSearchClientId(raw: string | undefined = process.env.NEXT_PUBLIC_BRANDFETCH_CLIENT_ID): string | null {
  const id = raw?.trim();
  return id ? id : null;
}

/**
 * What to search for in what was typed: a name as it is, an address by its
 * name part ("https://www.imagestudio.com/about" -> "imagestudio"), so other
 * domains of the same name come up too. Null under two letters.
 */
export function brandQuery(raw: string): string | null {
  let value = raw.trim().toLowerCase();
  value = value.replace(/^[a-z][a-z0-9+.-]*:\/\//, "").replace(/^www\./, "");
  value = value.split(/[/?#@]/)[0] ?? "";
  if (value.includes(".")) value = value.split(".")[0] ?? "";
  value = value.replace(/\s+/g, " ").trim();
  return value.length >= 2 ? value.slice(0, 60) : null;
}

/** Brandfetch's answer, kept to well-formed matches. Anything else is no matches. */
export function brandMatches(body: unknown): BrandMatch[] {
  if (!Array.isArray(body)) return [];
  const seen = new Set<string>();
  const matches: BrandMatch[] = [];
  for (const item of body) {
    if (!item || typeof item !== "object") continue;
    const { name, domain, icon } = item as Record<string, unknown>;
    if (typeof domain !== "string" || !HOST.test(domain)) continue;
    const host = domain.toLowerCase();
    if (seen.has(host)) continue;
    seen.add(host);
    matches.push({
      name: typeof name === "string" && name.trim() ? name.trim() : host,
      domain: host,
      icon: typeof icon === "string" && icon.startsWith("https://") ? icon : null,
    });
    if (matches.length === MAX_BRANDS) break;
  }
  return matches;
}

/** Asks Brandfetch from the browser. Never throws: a failure is no matches. */
export async function searchBrands(
  query: string,
  clientId: string,
  signal?: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<BrandMatch[]> {
  try {
    const response = await fetcher(`${ENDPOINT}${encodeURIComponent(query)}?c=${encodeURIComponent(clientId)}`, {
      signal,
      credentials: "omit",
      headers: { accept: "application/json" },
    });
    if (!response.ok) return [];
    return brandMatches(await response.json());
  } catch {
    return [];
  }
}
