/**
 * Public pages that were removed, sent for good (308) to the page that took
 * their place, in every language (client, 2026-11-21):
 *
 * - /backlink-exchange repeated /backlinks, so the footer listed two similar
 *   pages; its address now opens /backlinks.
 * - /publishers ("Monetize your blog") came out of the footer to give the
 *   Affiliate Program more room; its address now opens that program, the
 *   footer's "Affiliate Program" link (/partners). /affiliate is the credit
 *   referral page, not this one.
 *
 * Both destinations exist in every language, so /de/publishers opens
 * /de/partners. The query is kept by Next (a partner's ?ref= still counts:
 * next.config.ts lists these before the partner-link rule).
 *
 * Imported by next.config.ts, so: no "@/" imports here. The languages are
 * written out for that reason; moved-pages.test.ts checks them against
 * PREFIXED_LOCALES.
 */
export const MOVED_PAGES: ReadonlyArray<{ from: string; to: string }> = [
  { from: "/backlink-exchange", to: "/backlinks" },
  { from: "/publishers", to: "/partners" },
];

/** The language prefixes in a URL (lib/i18n/config.ts PREFIXED_LOCALES). */
export const MOVED_PAGE_LOCALES = ["es", "fr", "it", "de"] as const;

export function movedPageRedirects() {
  const locales = MOVED_PAGE_LOCALES.join("|");
  return MOVED_PAGES.flatMap(({ from, to }) => [
    { source: from, destination: to, permanent: true },
    { source: `/:locale(${locales})${from}`, destination: `/:locale${to}`, permanent: true },
  ]);
}
