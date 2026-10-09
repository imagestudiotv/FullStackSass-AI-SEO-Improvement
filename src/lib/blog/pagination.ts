/**
 * The blog's listings in pages (client, 2026-10-08): 30 articles to a page,
 * then the next one, at ?page=N. Page 1 is the plain address, never ?page=1,
 * so a listing has one canonical first page.
 */
export const BLOG_PAGE_SIZE = 30;

/**
 * The page asked for in ?page=. Anything that is not a plain page number
 * ("0", "-1", "abc", "01", a repeated parameter) is page 1, whose canonical
 * is the plain address; a number past the last page is the page's own 404.
 */
export function blogPage(value: string | string[] | undefined): number {
  if (typeof value !== "string" || !/^[1-9]\d{0,6}$/.test(value)) return 1;
  return Number(value);
}

/** A listing page's address. */
export function blogPageHref(path: string, page: number): string {
  return page === 1 ? path : `${path}?page=${page}`;
}

/** " — Page N" after a listing's title and in its description, from page 2 on, so every page's are its own. */
export function pageSuffix(page: number): string {
  return page > 1 ? ` — Page ${page}` : "";
}
