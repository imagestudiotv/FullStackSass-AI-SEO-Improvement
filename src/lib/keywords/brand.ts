/**
 * Searches that name a business: the website's own, or another with a name
 * like it (client's Image Studio, 2026-10-16).
 *
 * "image studios santa monica" is somebody looking for a business called
 * Image Studios in Santa Monica - not a topic imagestudio.com can write about.
 * The keyword provider labelled it "commercial", it scored 76.9, and it was
 * planned as "Image Studios Santa Monica: A Local Photographer's Guide". Its
 * neighbours "ny image studio" and "image studios appleton" were labelled
 * navigational, and one of those became the off-topic "Renting a Photo
 * Studio in NY" earlier. A search for a business by name is answered by that
 * business's own homepage; an article wins neither the site's own name
 * (the homepage already does) nor a namesake's.
 *
 * So a keyword that contains the website's name - from its brand name or its
 * domain - counts as navigational, and navigational keywords stay out of the
 * automatic content plan (inngest/functions/research-keywords.ts). Like
 * isOutOfReach (score.ts), nothing is deleted: the keyword stays in the list
 * and the customer can still plan it by hand.
 *
 * Only names of 8 letters or more are matched, so a short or one-word name
 * ("Studio", "Acme") never swallows ordinary searches that contain it.
 */

/** Shortest name that is matched inside keywords. */
export const BRAND_MARK_MIN = 8;

/** Lower case letters and digits only, accents dropped: "Image-Studio" -> "imagestudio". */
export function compactName(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** The website's name as it appears inside searches: from its brand name and its domain. */
export function brandMarks(site: { brandName?: string | null; domain?: string | null }): string[] {
  const marks = new Set<string>();
  if (site.brandName) marks.add(compactName(site.brandName));
  if (site.domain) {
    // The name part of the domain: "www.image-studio.co.uk" -> "image-studio".
    const label = site.domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split(/[./:]/)[0] ?? "";
    marks.add(compactName(label));
  }
  return [...marks].filter((mark) => mark.length >= BRAND_MARK_MIN);
}

/** True for a search that contains the website's name - its own or a namesake's. */
export function isBrandSearch(term: string, marks: readonly string[]): boolean {
  if (marks.length === 0) return false;
  const compact = compactName(term);
  return marks.some((mark) => compact.includes(mark));
}
