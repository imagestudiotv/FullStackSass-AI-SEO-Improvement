import {
  BarChart3,
  CalendarDays,
  CreditCard,
  FileText,
  Globe,
  LayoutDashboard,
  Link2,
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

export const navItems: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Websites", href: "/websites", icon: Globe },
  { title: "Content", href: "/content", icon: CalendarDays, disabled: true },
  { title: "Articles", href: "/articles", icon: FileText, disabled: true },
  { title: "Backlinks", href: "/backlinks", icon: Link2, disabled: true },
  { title: "Analytics", href: "/analytics", icon: BarChart3, disabled: true },
  { title: "Billing", href: "/billing", icon: CreditCard },
  { title: "Settings", href: "/settings", icon: Settings },
];
