import {
  BarChart3,
  Bot,
  FileText,
  LayoutDashboard,
  Link2,
  Puzzle,
  Rocket,
  Settings,
  Stethoscope,
  TrendingDown,
  type LucideIcon,
} from "lucide-react";

import type { Messages } from "@/lib/i18n/messages";

/**
 * The sidebar.
 *
 * Everything sits at one level. The per-website sections used to nest under a
 * "Websites" parent, which meant the work a customer actually does every day
 * — planned articles, the backlink exchange, what Google is doing — was two
 * clicks deep and only appeared once a site was open. Flat costs nothing to
 * scan and leaves an obvious place to add features.
 *
 * Order follows the job, not the data model: what is being written, what is
 * being earned, then what is being measured.
 */

export type NavItem = {
  /**
   * A key into the `nav` dictionary, not the text.
   *
   * This array is built at import time, before any request and so before any
   * locale is known — holding English here is exactly why the sidebar stayed
   * English while the pages translated. The component looks the key up.
   */
  title: keyof Messages["app"]["nav"];
  icon: LucideIcon;
  /**
   * A fixed path, or a segment under /websites/[id] for the per-website
   * sections. Exactly one of the two.
   */
  href?: string;
  /** URL segment under /websites/[id]. Empty string is the website index. */
  segment?: string;
  /** Renders a divider above this item. */
  separatorBefore?: boolean;
  /**
   * Marks the item as expandable, with its children loaded at render time
   * rather than listed here.
   *
   * Only add-ons use this: what can be bought is rows in a table, not a
   * constant, so the list cannot live in this file. The flag keeps the
   * knowledge that the item expands next to every other item's shape, while
   * leaving the contents to whoever has the data.
   */
  expands?: "addons";
};

export const navItems: NavItem[] = [
  { title: "dashboard", href: "/dashboard", icon: LayoutDashboard },

  /**
   * The launch checklist, at the client's request: "we can keep also the Get
   * started but rename it with Set up, and here we will place the most
   * important steps to running successfully the platform."
   *
   * Points at /setup, which lives inside the dashboard, rather than at the
   * signup wizard — signup is finished by the time anyone sees this sidebar.
   * Hidden once every required step is done; see sidebar-nav.
   */
  { title: "setUp", href: "/setup", icon: Rocket },

  /**
   * Per-website sections, promoted out of the old submenu. Each resolves
   * against the selected website; the sidebar hides them when a customer has
   * no website yet, since they would all be dead links.
   */
  { title: "plannedArticles", segment: "content", icon: FileText },
  { title: "backlinkExchange", segment: "backlinks", icon: Link2 },
  { title: "websiteHealth", segment: "", icon: Stethoscope },
  /**
   * Google Analytics 4 and Search Console: connect them here, and read them
   * here once connected.
   *
   * Renamed from "Google Results" at the client's request — "the smart thing
   * we can do is adding Google Search in the left dashboard menu, so we can
   * find it always here when we need to integrate google search or either
   * google analytics." Connecting used to be reachable only from a setup
   * step, so once that step was ticked off, or skipped since it is optional,
   * there was no route back to it without knowing the URL.
   *
   * One entry rather than two, even though it does two jobs. The panel
   * already shows the connect prompt when there is no connection and the
   * numbers once there is, and two sidebar rows sharing a path would both
   * highlight as active — the sidebar decides that from the pathname alone.
   */
  { title: "googleConnect", segment: "google", icon: BarChart3 },

  { title: "aiVisibility", segment: "ai-visibility", icon: Bot },
  { title: "losingTraffic", segment: "traffic", icon: TrendingDown },

  /**
   * Settings last, behind a divider: it is where the things you configure
   * once live — publishing, billing, the website profile — as opposed to the
   * things you check.
   */
  { title: "settings", href: "/settings", icon: Settings, separatorBefore: true },

  /**
   * Add-ons, after Settings.
   *
   * They existed only inside the Billing page, which meant a customer had to
   * already know they were there to find them — an odd place to hide the
   * things you want people to buy. Expands to list what is on offer, and the
   * item itself goes to the panel that sells them.
   */
  {
    title: "addons",
    href: "/billing#addons",
    icon: Puzzle,
    expands: "addons",
  },
];
