import { crawlSite } from "@/lib/audit/crawler";
import { InvalidUrlError, normalizeWebsiteUrl } from "@/lib/websites/url";

/**
 * llms.txt generator.
 *
 * llms.txt is a proposed convention: a markdown file at the site root telling
 * an AI assistant what the site is and which pages matter, so it does not have
 * to infer that from navigation and boilerplate.
 *
 * Generated from a real crawl rather than a template. A generator that just
 * fills in a domain name produces a file the owner has to write themselves
 * anyway, which is no help at all.
 */

/** Pages read to build the file. Enough for real structure, quick enough to wait for. */
const MAX_PAGES = 12;

/** Links listed in the generated file. */
const MAX_LINKS = 10;

export type LlmsTxtResult = {
  domain: string;
  siteName: string;
  summary: string | null;
  pagesRead: number;
  /** The generated file, ready to copy. */
  content: string;
  /** Where it belongs. */
  path: string;
};

export type LlmsTxtOutcome =
  | { ok: true; result: LlmsTxtResult }
  | { ok: false; error: string };

/**
 * A readable label for a URL.
 *
 * Prefers the page's own title, falling back to its path turned into words,
 * because a list of raw paths is exactly the thing llms.txt exists to replace.
 */
function labelFor(title: string | null, url: string): string {
  const clean = title?.trim().replace(/\s+/g, " ");
  if (clean) {
    /**
     * Sites append their brand to every title ("Pricing | Acme"). Kept only
     * when it is the whole title, so the homepage keeps its name.
     */
    const withoutBrand = clean.split(/\s+[|·—–]\s+/)[0].trim();
    return withoutBrand.length >= 3 ? withoutBrand : clean;
  }

  try {
    const { pathname } = new URL(url);
    const last = pathname.split("/").filter(Boolean).pop();
    if (!last) return "Home";
    return last
      .replace(/\.(html?|php|aspx?)$/i, "")
      .replace(/[-_]+/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  } catch {
    return url;
  }
}

/** Escapes the characters that would break a markdown link. */
function escapeMarkdown(text: string): string {
  return text.replace(/([[\]])/g, "\\$1");
}

export async function generateLlmsTxt(
  input: string,
): Promise<LlmsTxtOutcome> {
  let normalized;
  try {
    normalized = normalizeWebsiteUrl(input);
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof InvalidUrlError
          ? error.message
          : "Enter a valid website address",
    };
  }

  let crawl;
  try {
    crawl = await crawlSite(normalized.url, MAX_PAGES);
  } catch {
    return {
      ok: false,
      error: "We could not reach that website. Check the address and try again.",
    };
  }

  const pages = crawl.pages.filter((page) => page.statusCode < 400);
  if (pages.length === 0) {
    return {
      ok: false,
      error:
        "We could not read any pages on that website. It may be blocking automated visitors.",
    };
  }

  const home = pages[0];
  const siteName =
    home.ogSiteName?.trim() ||
    labelFor(home.title, home.finalUrl) ||
    normalized.domain;

  const summary = home.metaDescription?.trim() || null;

  /**
   * The homepage is the site, not a page within it, so it is not listed among
   * the links — the file already opens with the site's own name and summary.
   */
  const links = pages
    .slice(1)
    .map((page) => ({
      label: escapeMarkdown(labelFor(page.title, page.finalUrl)),
      url: page.finalUrl,
      note: page.metaDescription?.trim() ?? null,
    }))
    .slice(0, MAX_LINKS);

  const lines: string[] = [`# ${siteName}`];

  if (summary) lines.push("", `> ${summary}`);

  if (links.length > 0) {
    lines.push("", "## Pages", "");
    for (const link of links) {
      lines.push(
        link.note
          ? `- [${link.label}](${link.url}): ${link.note}`
          : `- [${link.label}](${link.url})`,
      );
    }
  }

  lines.push("");

  return {
    ok: true,
    result: {
      domain: normalized.domain,
      siteName,
      summary,
      pagesRead: pages.length,
      content: lines.join("\n"),
      path: `${new URL(normalized.url).origin}/llms.txt`,
    },
  };
}
