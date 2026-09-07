import {
  BarChart3,
  Bot,
  FileText,
  Globe,
  Link2,
  Send,
  Stethoscope,
  TrendingDown,
  type LucideIcon,
} from "lucide-react";

/**
 * The sections of a website's own area.
 *
 * These were one page: eight panels stacked in a single scroll, each loading
 * its own data. That meant every visit paid for all eight — an audit, keyword
 * research, analytics, decay detection, AI visibility, the backlink network,
 * publishing integrations and the profile — to look at one of them.
 *
 * Split into routes, each page loads only what it shows.
 *
 * The order follows the dependency, not the stacked page's old top-to-bottom.
 * The profile is an input to the two sections after it: keyword research and
 * article generation both read industry, description and target audience. It
 * also sits beside Website health because the same analysis job writes both —
 * the findings and the profile are two halves of one pass over the site.
 *
 * It used to be last, after Publishing, which read as a trailing settings
 * screen to visit once articles were already going out. A wrong industry or
 * audience never errors; it quietly produces off-target keywords and then
 * months of off-target articles. That review belongs before the first one.
 *
 * So: what is wrong, what we understand about you, what we will write, how it
 * is performing, then the plumbing.
 */

export type WebsiteSection = {
  /** URL segment under /websites/[id]. Empty string is the index. */
  segment: string;
  title: string;
  /** One line for the sub-nav tooltip and the section header. */
  description: string;
  icon: LucideIcon;
};

export const WEBSITE_SECTIONS: WebsiteSection[] = [
  {
    segment: "",
    title: "Website health",
    description:
      "What is holding this site back on Google, with the exact page each problem is on.",
    icon: Stethoscope,
  },
  {
    segment: "profile",
    title: "Website profile",
    description:
      "What we understand about this business. Everything here shapes what we write.",
    icon: Globe,
  },
  {
    segment: "content",
    title: "Planned articles",
    description:
      "The search terms worth going after, grouped into topics, and the articles planned from them.",
    icon: FileText,
  },
  {
    segment: "google",
    title: "Google results",
    description:
      "Which searches bring people to this website, and how that changes as we publish.",
    icon: BarChart3,
  },
  {
    segment: "traffic",
    title: "Losing traffic",
    description:
      "Pages getting fewer clicks than they did a month ago, from Search Console data.",
    icon: TrendingDown,
  },
  {
    segment: "ai-visibility",
    title: "AI visibility",
    description:
      "Whether an AI assistant names this business when someone asks for a business like it.",
    icon: Bot,
  },
  {
    segment: "backlinks",
    title: "Links from other websites",
    description:
      "Links earned from the network, and the ones this site hosts in return.",
    icon: Link2,
  },
  {
    segment: "publishing",
    title: "Publishing",
    description:
      "Where finished articles are published, and the connection that carries them.",
    icon: Send,
  },
];

/** Absolute path for a section of one website. */
export function sectionHref(websiteId: string, segment: string): string {
  return segment
    ? `/websites/${websiteId}/${segment}`
    : `/websites/${websiteId}`;
}

export function getSection(segment: string): WebsiteSection | undefined {
  return WEBSITE_SECTIONS.find((section) => section.segment === segment);
}
