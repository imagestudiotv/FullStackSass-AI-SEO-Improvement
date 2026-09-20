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
  title: string;
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
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },

  /**
   * The launch checklist, at the client's request: "we can keep also the Get
   * started but rename it with Set up, and here we will place the most
   * important steps to running successfully the platform."
   *
   * Points at /setup, which lives inside the dashboard, rather than at the
   * signup wizard — signup is finished by the time anyone sees this sidebar.
   * Hidden once every required step is done; see sidebar-nav.
   */
  { title: "Set up", href: "/setup", icon: Rocket },

  /**
   * Per-website sections, promoted out of the old submenu. Each resolves
   * against the selected website; the sidebar hides them when a customer has
   * no website yet, since they would all be dead links.
   */
  { title: "Planned Articles", segment: "content", icon: FileText },
  { title: "Backlink Exchange", segment: "backlinks", icon: Link2 },
  { title: "Website Health", segment: "", icon: Stethoscope },
  { title: "Google Results", segment: "google", icon: BarChart3 },
  { title: "AI Visibility", segment: "ai-visibility", icon: Bot },
  { title: "Losing Traffic", segment: "traffic", icon: TrendingDown },

  /**
   * Settings last, behind a divider: it is where the things you configure
   * once live — publishing, billing, the website profile — as opposed to the
   * things you check.
   */
  { title: "Settings", href: "/settings", icon: Settings, separatorBefore: true },

  /**
   * Add-ons, after Settings.
   *
   * They existed only inside the Billing page, which meant a customer had to
   * already know they were there to find them — an odd place to hide the
   * things you want people to buy. Expands to list what is on offer, and the
   * item itself goes to the panel that sells them.
   */
  {
    title: "Add-ons",
    href: "/billing#addons",
    icon: Puzzle,
    expands: "addons",
  },
];
