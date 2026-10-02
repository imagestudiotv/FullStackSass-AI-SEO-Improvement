/**
 * How a table in an article looks in RepGet's own views - the editor, the
 * previews and the public blog - so the comparison table reads as it does
 * on a customer's site (client, 2026-10-02: "Videography vs Cinematography
 * at a Glance"): ruled cells, a shaded header row, and its own sideways
 * scroll on a phone rather than the page's.
 *
 * Class names, not a stylesheet: @tailwindcss/typography is not installed, so
 * article HTML is styled with descendant selectors like everything around it.
 */
export const ARTICLE_TABLE_CLASSES =
  "[&_table]:my-6 [&_table]:block [&_table]:max-w-full [&_table]:overflow-x-auto [&_table]:border-collapse [&_table]:text-sm " +
  "[&_th]:border [&_th]:bg-muted/60 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:align-top [&_th]:font-semibold " +
  "[&_td]:border [&_td]:px-3 [&_td]:py-2 [&_td]:align-top [&_th_p]:my-0 [&_td_p]:my-0";
