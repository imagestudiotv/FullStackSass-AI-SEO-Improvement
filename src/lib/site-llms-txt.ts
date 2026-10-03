import { getMessages } from "@/lib/i18n/messages";
import { INTEGRATION_DOCS } from "@/lib/publishing/docs";
import { TOOLS } from "@/lib/tools/registry";

/**
 * RepGet's own /llms.txt (client's launch review, 2026-10-03).
 *
 * A plain-text guide for AI assistants: what RepGet is, then the pages worth
 * reading, each with a one-line note. Same format as the files RepGet's own
 * generator writes for customers (lib/tools/llms-txt.ts) - "# Name", a "> "
 * summary, "## " sections of "- [Page](url): note" - so the product follows
 * the standard it sells.
 *
 * BUILT FROM THE SITE'S OWN DATA, so it cannot go stale: the tool list is the
 * registry the /tools hub renders, the guides are the integration docs, the
 * posts are whatever is published. A new tool, guide or post appears here with
 * no edit to this file.
 *
 * NOTHING NEW IS SAID HERE. The summary is the homepage's own title and
 * description, and every note is that page's existing meta description - the
 * i18n ones read from the English messages, the rest kept identical to the
 * page (site-llms-txt.test.ts checks each against its page file).
 *
 * Left out for now: /backlink-exchange and /publishers. Their descriptions use
 * the link-exchange framing the client asked to reword, and this file would
 * repeat it to every assistant. Add them back once the new wording is approved.
 */

export type LlmsPost = { slug: string; title: string; description: string };

type Link = { label: string; path: string; note?: string | null };

/** Homepage title + description (app/(marketing)/page.tsx), as one summary. */
const SUMMARY =
  "RepGet is an AI SEO platform for content and backlinks. Automate SEO with RepGet. Research keywords, publish optimized content, build quality backlinks, track rankings and improve visibility in Google and AI search.";

/**
 * Notes for pages whose description is written in the page itself rather than
 * in the messages. Each must stay identical to that page's meta description.
 */
export const PAGE_NOTES = {
  "/pricing": "Simple monthly pricing. Cancel any time.",
  "/tools":
    "Free tools to check your site: SEO score, robots.txt, sitemaps, AI crawler access, llms.txt, keyword density and more. No signup, real results.",
  "/docs/integrations":
    "How to connect WordPress, Ghost, Shopify or your own endpoint so articles publish automatically.",
  "/blog":
    "Guides, comparisons and playbooks for getting found on Google and cited by AI assistants - written for people who run a business, not a marketing team.",
  "/privacy": "What data RepGet collects, why, and how it is stored and protected.",
  "/terms": "The terms that apply when you use RepGet.",
  "/refunds": "Our 14-day money-back guarantee and how refunds work at RepGet.",
} as const;

/** Square brackets would end a Markdown link label early. */
function label(text: string): string {
  return text.replace(/([[\]])/g, "\\$1");
}

/** One line per note: a stray newline would break the list. */
function oneLine(text: string | null | undefined): string | null {
  const clean = text?.replace(/\s+/g, " ").trim();
  return clean ? clean : null;
}

function section(site: string, heading: string, links: Link[]): string[] {
  if (links.length === 0) return [];
  return [
    "",
    `## ${heading}`,
    "",
    ...links.map((link) => {
      const note = oneLine(link.note);
      const url = `${site}${link.path}`;
      return note ? `- [${label(link.label)}](${url}): ${note}` : `- [${label(link.label)}](${url})`;
    }),
  ];
}

export function buildSiteLlmsTxt(siteUrl: string, posts: LlmsPost[]): string {
  const site = siteUrl.replace(/\/+$/, "");
  const t = getMessages("en");

  const lines = [
    "# RepGet",
    "",
    `> ${SUMMARY}`,
    ...section(site, "Product", [
      { label: "Pricing", path: "/pricing", note: PAGE_NOTES["/pricing"] },
      { label: t.faq.metaTitle, path: "/faq", note: t.faq.metaDescription },
      { label: t.successStories.metaTitle, path: "/success-stories", note: t.successStories.metaDescription },
      { label: t.about.metaTitle, path: "/about", note: t.about.metaDescription },
      { label: t.contact.metaTitle, path: "/contact", note: t.contact.metaDescription },
    ]),
    ...section(site, "Free tools", [
      { label: "All free tools", path: "/tools", note: PAGE_NOTES["/tools"] },
      ...TOOLS.map((tool) => ({ label: tool.title, path: tool.href, note: tool.blurb })),
    ]),
    ...section(site, "Integration guides", [
      { label: "Integration guides", path: "/docs/integrations", note: PAGE_NOTES["/docs/integrations"] },
      ...INTEGRATION_DOCS.map((doc) => ({
        label: doc.name,
        path: `/docs/integrations/${doc.slug}`,
        note: doc.summary,
      })),
    ]),
    ...section(site, "Blog", [
      { label: "Blog", path: "/blog", note: PAGE_NOTES["/blog"] },
      ...posts.map((post) => ({ label: post.title, path: `/blog/${post.slug}`, note: post.description })),
    ]),
    // "Optional" is the llms.txt convention for pages an assistant may skip.
    ...section(site, "Optional", [
      { label: t.affiliate.metaTitle, path: "/affiliate", note: t.affiliate.metaDescription },
      { label: "Privacy Policy", path: "/privacy", note: PAGE_NOTES["/privacy"] },
      { label: "Terms of Service", path: "/terms", note: PAGE_NOTES["/terms"] },
      { label: "Refund Policy", path: "/refunds", note: PAGE_NOTES["/refunds"] },
    ]),
    "",
  ];

  return lines.join("\n");
}
