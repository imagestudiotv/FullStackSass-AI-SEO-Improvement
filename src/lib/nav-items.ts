import {
  BarChart3,
  Bot,
  FileText,
  LayoutDashboard,
  Link2,
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
};

export const navItems: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },

  /**
   * Setup checklist, hidden once finished. Sits second because an unfinished
   * account has nothing to look at below it.
   */
  { title: "Get started", href: "/onboarding", icon: Rocket },

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
];
