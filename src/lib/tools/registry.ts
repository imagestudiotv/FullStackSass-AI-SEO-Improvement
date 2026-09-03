/**
 * The free tools catalogue.
 *
 * One list drives the hub grid, each tool page's "more free tools" section and
 * the nav, so a new tool is added in exactly one place.
 *
 * The promise on the hub is "every tool runs a real check and shows the full
 * result instantly", and that is the bar for appearing here. Tools needing live
 * SERP positions, search volumes, traffic estimates or backlink counts are
 * deliberately absent: those need a DataForSEO subscription that is not active
 * yet, and a tool that cannot answer is worse than no tool — it is the one page
 * where someone decides whether we are worth trusting. When those credentials
 * are live, they belong here as their own entries.
 */

export type ToolCategory =
  | "Technical SEO"
  | "AI visibility"
  | "Content & meta";

export type Tool = {
  /** Path segment under /tools, or a full path for the audit. */
  href: string;
  title: string;
  /** One line for the card. Says what it does, not why it matters. */
  blurb: string;
  /** Emoji tile, matching the reference's illustrated cards. */
  emoji: string;
  category: ToolCategory;
};

/** Order here is the order shown within a category. */
export const TOOLS: Tool[] = [
  /* --- Technical SEO ---------------------------------------------------- */
  {
    href: "/audit",
    title: "SEO Score Checker",
    blurb: "One 0-100 score from a real crawl.",
    emoji: "🎯",
    category: "Technical SEO",
  },
  {
    href: "/tools/robots-checker",
    title: "Robots.txt Checker",
    blurb: "Verdicts for search and AI bots together.",
    emoji: "🚦",
    category: "Technical SEO",
  },
  {
    href: "/tools/sitemap-checker",
    title: "Sitemap Checker & Finder",
    blurb: "Find and validate XML sitemaps.",
    emoji: "🗺️",
    category: "Technical SEO",
  },
  {
    href: "/tools/meta-tag-checker",
    title: "Meta Tag Checker",
    blurb: "Every tag Google and social sites read.",
    emoji: "🏷️",
    category: "Technical SEO",
  },

  /* --- AI visibility ---------------------------------------------------- */
  {
    href: "/tools/ai-crawler-checker",
    title: "AI Crawler Checker",
    blurb: "Test GPTBot, ClaudeBot and PerplexityBot access.",
    emoji: "🤖",
    category: "AI visibility",
  },
  {
    href: "/tools/llms-txt-generator",
    title: "llms.txt Generator",
    blurb: "Build a valid llms.txt from your live site.",
    emoji: "📄",
    category: "AI visibility",
  },
  {
    href: "/tools/llm-html-checker",
    title: "LLM HTML Visibility Checker",
    blurb: "How much of your text can AI actually read?",
    emoji: "👓",
    category: "AI visibility",
  },

  /* --- Content & meta --------------------------------------------------- */
  {
    href: "/tools/snippet-preview",
    title: "SEO Title Checker",
    blurb: "Score your title for SERP CTR, live.",
    emoji: "🔖",
    category: "Content & meta",
  },
  {
    href: "/tools/keyword-density",
    title: "Keyword Density Checker",
    blurb: "What your page actually talks about.",
    emoji: "📊",
    category: "Content & meta",
  },
  {
    href: "/tools/meta-description-generator",
    title: "Meta Description Generator",
    blurb: "Five descriptions with a reason to click.",
    emoji: "✍️",
    category: "Content & meta",
  },
];

/** Categories in display order. */
export const TOOL_CATEGORIES: ToolCategory[] = [
  "Technical SEO",
  "AI visibility",
  "Content & meta",
];

export function toolsByCategory(category: ToolCategory): Tool[] {
  return TOOLS.filter((tool) => tool.category === category);
}

export function toolByHref(href: string): Tool | undefined {
  return TOOLS.find((tool) => tool.href === href);
}

/**
 * Other tools to show at the foot of a tool page.
 *
 * Same category first — someone checking robots.txt is more likely to want the
 * sitemap checker than a meta description writer — then anything else, so the
 * section is always full even for a small category.
 */
export function relatedTools(href: string, limit = 6): Tool[] {
  const current = toolByHref(href);
  const others = TOOLS.filter((tool) => tool.href !== href);
  if (!current) return others.slice(0, limit);

  return [
    ...others.filter((t) => t.category === current.category),
    ...others.filter((t) => t.category !== current.category),
  ].slice(0, limit);
}
