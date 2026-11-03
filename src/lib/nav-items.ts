import {
  ChartLine,
  Clapperboard,
  ClipboardList,
  Coins,
  Eye,
  FileText,
  HeartPulse,
  House,
  Link2,
  ListTodo,
  Puzzle,
  Rocket,
  Settings,
  Share2,
  Sparkles,
  Target,
  TrendingDown,
  type LucideIcon,
} from "lucide-react";

import type { Messages } from "@/lib/i18n/messages";

/**
 * The sidebar, as the client designed it (2026-11-02):
 *
 *   Home (Growth Copilot, Tasks) · Planned Articles · Backlink Exchange ·
 *   Social Distribution (Opportunities, Social Content) ·
 *   Growth Audit (Website Health, Google Search & Analytics, AI Visibility, Losing Traffic) ·
 *   — Credits · Add-Ons · Settings — and Earn Credits at the bottom.
 *
 * A group's heading only opens and closes it; the pages are its children.
 * Design-system guidance agrees (a parent that is also a link makes the
 * chevron and the label do different things), and it is what his mockup does.
 * Every child has its own small icon, from his icon file.
 *
 * "Set up" stays above Home while the launch checklist is unfinished, and
 * goes once it is done (see sidebar-nav).
 */

export type NavKey = keyof Messages["app"]["nav"];

export type NavLink = {
  /**
   * A key into the `nav` dictionary, not the text: this array is built at
   * import time, before any locale is known.
   */
  title: NavKey;
  icon: LucideIcon;
  /** A fixed path, or a segment under /websites/[id]. Exactly one of the two. */
  href?: string;
  /** URL segment under /websites/[id]. Empty string is the website index. */
  segment?: string;
  /** Also lit on these pages (Settings, for the tabs its strip leads to). */
  alsoActive?: (pathname: string) => boolean;
};

export type NavGroup = {
  /** Remembered open or closed under this id. */
  id: "home" | "social" | "audit" | "addons";
  title: NavKey;
  icon: LucideIcon;
  /** Add-ons are rows in a table, so their children are passed in at render time. */
  children: NavLink[] | "addons";
  /** Open the first time someone sees the menu (Add-Ons start closed, as in the client's mockup). */
  defaultOpen: boolean;
};

export type NavEntry = (NavLink & { kind: "link"; separatorBefore?: boolean }) | (NavGroup & { kind: "group" });

/** The settings tabs: Business, Article Settings, Integrations (per website), Account and Billing. */
export function isSettingsPath(pathname: string): boolean {
  return (
    pathname.startsWith("/settings") ||
    pathname.startsWith("/billing") ||
    /^\/websites\/[^/]+\/(profile|publishing|integrations)(\/|$)/.test(pathname)
  );
}

export const navEntries: NavEntry[] = [
  { kind: "link", title: "setUp", href: "/setup", icon: Rocket },
  {
    kind: "group",
    id: "home",
    title: "home",
    icon: House,
    defaultOpen: true,
    children: [
      /** The AI chat, on a page of its own (client: "I prefer an independent section for the chat"). */
      { title: "growthCopilot", segment: "copilot", icon: Sparkles },
      /** The overview and the task list, which was the Dashboard. */
      { title: "tasks", href: "/dashboard", icon: ListTodo },
    ],
  },
  { kind: "link", title: "plannedArticles", segment: "content", icon: FileText },
  { kind: "link", title: "backlinkExchange", segment: "backlinks", icon: Link2 },
  {
    kind: "group",
    id: "social",
    title: "socialDistribution",
    icon: Share2,
    defaultOpen: true,
    children: [
      { title: "opportunities", segment: "social", icon: Target },
      { title: "socialContent", segment: "videos", icon: Clapperboard },
    ],
  },
  {
    kind: "group",
    id: "audit",
    title: "growthAudit",
    icon: ClipboardList,
    defaultOpen: true,
    children: [
      { title: "websiteHealth", segment: "", icon: HeartPulse },
      /** Google Search Console and Analytics: connect them here, and read them here once connected. */
      { title: "googleConnect", segment: "google", icon: ChartLine },
      { title: "aiVisibility", segment: "ai-visibility", icon: Eye },
      { title: "losingTraffic", segment: "traffic", icon: TrendingDown },
    ],
  },
  /** The workspace's credits: one balance spent across RepGet. Hidden for someone who owns no website. */
  { kind: "link", title: "credits", href: "/credits", icon: Coins, separatorBefore: true },
  { kind: "group", id: "addons", title: "addons", icon: Puzzle, defaultOpen: false, children: "addons" },
  { kind: "link", title: "settings", href: "/settings", icon: Settings, alsoActive: isSettingsPath },
];
