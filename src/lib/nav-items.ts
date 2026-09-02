import {
  CreditCard,
  Rocket,
  Globe,
  LayoutDashboard,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  /** Routes that do not exist yet are shown but not clickable. */
  disabled?: boolean;
};

/*
 * Backlinks and Analytics are deliberately absent.
 *
 * Both are per-website features and live on a website's own page, so a
 * top-level link would have to guess which site the user meant. They were
 * previously listed as permanently greyed-out items pointing at routes that
 * do not exist — which reads as broken rather than forthcoming.
 */

export const navItems: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Get started", href: "/onboarding", icon: Rocket },
  { title: "Websites", href: "/websites", icon: Globe },
  { title: "Billing", href: "/billing", icon: CreditCard },
  { title: "Settings", href: "/settings", icon: Settings },
];
