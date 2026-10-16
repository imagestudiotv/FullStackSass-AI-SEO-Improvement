import { INTEGRATION_DOCS } from "@/lib/publishing/docs";
import { TOOLS } from "@/lib/tools/registry";

/**
 * The public marketing pages, in English - one list for the sitemap
 * (app/sitemap.ts) and for the addresses that send an old language-prefixed
 * link to its English page (app/(marketing)/[locale]/[...rest]).
 *
 * Blog posts and categories are not here: they come from the database.
 */
export const PUBLIC_PAGES: { path: string; priority: number }[] = [
  { path: "/", priority: 1 },
  { path: "/audit", priority: 0.9 },
  { path: "/pricing", priority: 0.8 },
  { path: "/tools", priority: 0.8 },
  { path: "/blog/author/repget-team", priority: 0.5 },
  { path: "/blog", priority: 0.8 },
  { path: "/docs/integrations", priority: 0.7 },
  { path: "/backlink-exchange", priority: 0.7 },
  { path: "/publishers", priority: 0.7 },
  { path: "/backlinks", priority: 0.7 },
  { path: "/rank-on-chatgpt", priority: 0.7 },
  { path: "/affiliate", priority: 0.6 },
  { path: "/success-stories", priority: 0.6 },
  { path: "/success-stories/image-studio", priority: 0.6 },
  { path: "/faq", priority: 0.6 },
  { path: "/about", priority: 0.5 },
  { path: "/contact", priority: 0.4 },
  { path: "/privacy", priority: 0.2 },
  { path: "/terms", priority: 0.2 },
  { path: "/refunds", priority: 0.2 },
];

/** The free tools' pages, from the registry the hub renders (so a new tool is never missed). */
export const TOOL_PAGES: string[] = TOOLS.filter((tool) => tool.href.startsWith("/tools/")).map((tool) => tool.href);

/** One setup guide per publishing integration. */
export const INTEGRATION_DOC_PAGES: string[] = INTEGRATION_DOCS.map((doc) => `/docs/integrations/${doc.slug}`);

const ENGLISH_PAGES: ReadonlySet<string> = new Set([...PUBLIC_PAGES.map((page) => page.path), ...TOOL_PAGES, ...INTEGRATION_DOC_PAGES]);

/** True for an English public page (exact path, no query string). */
export function isPublicEnglishPage(path: string): boolean {
  return ENGLISH_PAGES.has(path);
}
