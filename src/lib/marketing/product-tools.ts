/**
 * RepGet's tools - ONE list for the whole public site (client, 2026-11-27).
 *
 * The site used to count them three ways: "Six tools" in the header menu,
 * "9 capabilities" in the homepage's platform section and "Four growth
 * engines" under it, while the pricing table ticked five. The owner agreed on
 * five, in this order:
 *
 *  1. Articles        - the SEO content plan and the articles it writes;
 *  2. Backlinks       - the Partner Network;
 *  3. AI Visibility   - whether AI assistants name the business;
 *  4. Social          - posts, videos and replies;
 *  5. Website Health  - the audit and Losing Traffic.
 *
 * Growth Copilot is the assistant that runs them all, so it is described
 * with them but never counted. The header menu, the homepage's "Top
 * features", /features and the pricing section's ticks all follow this list
 * (product-tools.test.ts keeps them in step), and the words that state the
 * count say "five".
 */
export const PRODUCT_TOOLS = ["articles", "backlinks", "aiVisibility", "social", "websiteHealth"] as const;

export type ProductTool = (typeof PRODUCT_TOOLS)[number];

/** How many tools there are, for the words that say it ("Five tools"). */
export const PRODUCT_TOOL_COUNT = PRODUCT_TOOLS.length;

/**
 * The dashboard recordings on /features and the homepage (owner, 2026-11-27),
 * cut to a silent loop of 12-20 seconds, 1280 px wide, H.264 with the index at
 * the front, and a poster from the same moment. Each was checked frame by
 * frame before it was cut: only the owner's own site (imagestudio.com) and
 * RepGet's sample addresses appear, never a customer, an email address or a
 * key - the settings recording is cut to the article settings for that
 * reason.
 */
export const FEATURE_CLIPS = {
  plannedArticles: "planned-articles",
  keywordResearch: "keyword-research",
  articleSettings: "article-settings",
  backlinks: "backlinks",
  aiVisibility: "ai-visibility",
  socialContent: "social-content",
  opportunities: "opportunities",
  websiteHealth: "website-health",
  losingTraffic: "losing-traffic",
  googleSearch: "google-search-analytics",
  growthCopilot: "growth-copilot",
  tasks: "tasks",
  homeDashboard: "home-dashboard",
} as const;

export type FeatureClipKey = keyof typeof FEATURE_CLIPS;

/** Every clip is 1280 x 720 (the recordings are 16:9). */
export const CLIP_WIDTH = 1280;
export const CLIP_HEIGHT = 720;

/** A clip's files under public/features/: the loop and its poster. */
export function featureClip(key: FeatureClipKey): { mp4: string; poster: string } {
  const name = FEATURE_CLIPS[key];
  return { mp4: `/features/${name}.mp4`, poster: `/features/${name}.jpg` };
}

/**
 * The features of each tool, and of Growth Copilot, in the order /features
 * shows them, each with its recording. The first of each tool is the one the
 * homepage's "Top features" shows.
 */
export const TOOL_FEATURES: Record<ProductTool | "copilot", readonly FeatureClipKey[]> = {
  articles: ["plannedArticles", "keywordResearch", "articleSettings"],
  backlinks: ["backlinks"],
  aiVisibility: ["aiVisibility"],
  social: ["socialContent", "opportunities"],
  websiteHealth: ["websiteHealth", "losingTraffic", "googleSearch"],
  copilot: ["growthCopilot", "tasks", "homeDashboard"],
};

/**
 * Where each tool's "learn more" leads: a public page that exists in every
 * language (localePath keeps the visitor's), never an address made up for it.
 * Articles has no page of its own; the Image Studio case study walks through
 * its plan-write-publish loop on a real site. Social and Growth Copilot lead
 * to their free tools.
 */
export const TOOL_LINKS: Record<ProductTool | "copilot", string> = {
  articles: "/success-stories/image-studio",
  backlinks: "/backlinks",
  aiVisibility: "/rank-on-chatgpt",
  social: "/tools/social-media-post-generator",
  websiteHealth: "/audit",
  copilot: "/tools/growth-copilot",
};

/** The anchors on /features, so the homepage and the menu can point at one tool. */
export const TOOL_ANCHORS: Record<ProductTool | "copilot", string> = {
  articles: "articles",
  backlinks: "backlinks",
  aiVisibility: "ai-visibility",
  social: "social",
  websiteHealth: "website-health",
  copilot: "growth-copilot",
};
