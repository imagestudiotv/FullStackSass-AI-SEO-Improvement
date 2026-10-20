import {
  Banknote,
  Building2,
  ChartLine,
  Coins,
  FileText,
  Gauge,
  Globe,
  Handshake,
  Inbox,
  LayoutDashboard,
  Link2,
  MessageSquare,
  Network,
  Newspaper,
  Quote,
  Receipt,
  ScrollText,
  ShieldAlert,
  TicketPercent,
  UserCheck,
  Users,
  type LucideIcon,
} from "lucide-react";

/**
 * Every admin destination, grouped as the sidebar shows them.
 *
 * ONE definition for the sidebar, the mobile drawer, the Ctrl/Cmd+K palette
 * and the breadcrumbs, so a page can never be reachable from one and missing
 * from another. Network Operations has its own entry: it used to be reachable
 * only through a link on the Partner Network page.
 */

/**
 * The sidebar preference cookie. Here, in a plain module, so the server layout
 * reads the real string - imported from the "use client" shell it would be a
 * client reference, and the saved width would never be applied.
 */
export const SIDEBAR_COOKIE = "admin_sidebar";

export type AdminNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Words the palette also matches, beyond the label. */
  keywords?: string[];
  /** One line for the palette. */
  description: string;
};

export type AdminNavGroup = { label: string; items: AdminNavItem[] };

export const ADMIN_NAV: AdminNavGroup[] = [
  {
    label: "Overview",
    items: [
      {
        href: "/admin",
        label: "Overview",
        icon: LayoutDashboard,
        keywords: ["dashboard", "home", "attention", "stats"],
        description: "Platform summary and what needs attention",
      },
      {
        href: "/admin/analytics",
        label: "Site analytics",
        icon: ChartLine,
        keywords: ["google analytics", "ga4", "traffic", "visitors", "visits", "pageviews"],
        description: "Visits to repget.com from Google Analytics",
      },
    ],
  },
  {
    label: "Customers",
    items: [
      {
        href: "/admin/organizations",
        label: "Organizations",
        icon: Building2,
        keywords: ["workspaces", "agency", "customers", "accounts"],
        description: "Workspaces, plans and agency access",
      },
      {
        href: "/admin/websites",
        label: "Websites",
        icon: Globe,
        keywords: ["sites", "domains"],
        description: "Every customer website",
      },
      {
        href: "/admin/users",
        label: "Users",
        icon: Users,
        keywords: ["people", "accounts", "members"],
        description: "People with an account",
      },
      {
        href: "/admin/feedback",
        label: "Feedback",
        icon: MessageSquare,
        keywords: ["ideas", "problems", "bugs", "suggestions", "improvements", "requests", "replies"],
        description: "Ideas and problems sent by customers and visitors",
      },
    ],
  },
  {
    label: "Content",
    items: [
      {
        href: "/admin/articles",
        label: "Articles",
        icon: FileText,
        keywords: ["posts", "drafts", "published", "failed"],
        description: "Customer articles across all websites",
      },
      {
        href: "/admin/content-performance",
        label: "Content performance",
        icon: Gauge,
        keywords: ["research", "models", "cost", "generation", "pilot"],
        description: "Article research rollout, model costs and review findings",
      },
      {
        href: "/admin/network",
        label: "Partner Network",
        icon: Network,
        keywords: ["backlinks", "review", "placements", "missing links", "credits"],
        description: "Review queue, placements and missing links",
      },
      {
        href: "/admin/blog",
        label: "Blog",
        icon: Newspaper,
        keywords: ["repget blog", "posts", "categories", "featured placements", "sponsored", "get featured"],
        description: "RepGet's own public blog",
      },
      {
        href: "/admin/testimonials",
        label: "Testimonials",
        icon: Quote,
        keywords: ["reviews", "quotes", "feedback", "customers", "homepage"],
        description: "The homepage's testimonial cards",
      },
    ],
  },
  {
    /*
      The cash affiliate program (lib/partners). Named "Affiliate partners" so
      it is never confused with the Partner Network (backlinks) above.
    */
    label: "Affiliate partners",
    items: [
      {
        href: "/admin/partners",
        label: "Affiliate program",
        icon: Handshake,
        keywords: ["affiliates", "partners", "switches", "stripe connect", "commission"],
        description: "Program switches, readiness and what needs attention",
      },
      {
        href: "/admin/partners/applications",
        label: "Partner applications",
        icon: Inbox,
        keywords: ["apply", "approve", "reject", "affiliates"],
        description: "Review applications to the affiliate program",
      },
      {
        href: "/admin/partners/partners",
        label: "Partners",
        icon: UserCheck,
        keywords: ["affiliates", "suspend", "hold", "referral code"],
        description: "Approved affiliate partners",
      },
      {
        href: "/admin/partners/attribution",
        label: "Partner referrals",
        icon: Link2,
        keywords: ["attribution", "affiliates", "conflict", "disqualify"],
        description: "Which partner each customer is attributed to",
      },
      {
        href: "/admin/partners/commissions",
        label: "Partner commissions",
        icon: Coins,
        keywords: ["affiliates", "approve", "reject", "adjust", "earnings"],
        description: "Commission investigation, holds and adjustments",
      },
      {
        href: "/admin/partners/payouts",
        label: "Partner payouts",
        icon: Banknote,
        keywords: ["settlements", "stripe connect", "transfers", "reconcile", "affiliates"],
        description: "Monthly settlements: preview, run, retry and reconcile",
      },
      {
        href: "/admin/partners/reviews",
        label: "Partner review cases",
        icon: ShieldAlert,
        keywords: ["fraud", "affiliates", "disputes", "discrepancies"],
        description: "Fraud signals, conflicts and discrepancies to decide",
      },
      {
        href: "/admin/partners/coupons",
        label: "Partner coupons",
        icon: TicketPercent,
        keywords: ["campaigns", "promotion codes", "affiliates", "discount"],
        description: "Coupons and campaigns assigned to partners",
      },
    ],
  },
  {
    label: "Operations",
    items: [
      {
        href: "/admin/network/operations",
        label: "Network Operations",
        icon: Gauge,
        keywords: ["freeze", "drain", "deliveries", "managed review", "authority", "valuation"],
        description: "Publication freeze, review gate and deliveries",
      },
      {
        href: "/admin/payments",
        label: "Payments",
        icon: Receipt,
        keywords: ["refunds", "invoices", "billing", "stripe", "paypal"],
        description: "Payments and refunds",
      },
      {
        href: "/admin/activity",
        label: "Activity",
        icon: ScrollText,
        keywords: ["audit", "log", "history"],
        description: "The administrator audit log",
      },
    ],
  },
];

export const ADMIN_NAV_ITEMS: AdminNavItem[] = ADMIN_NAV.flatMap((group) => group.items);

/**
 * The nav item a path belongs to: the LONGEST matching href, so
 * /admin/network/operations lights Network Operations, not Partner Network,
 * and /admin/network/<article> lights Partner Network. /admin matches only
 * itself - every path starts with it.
 */
export function activeNavItem(pathname: string): AdminNavItem | null {
  let best: AdminNavItem | null = null;
  for (const item of ADMIN_NAV_ITEMS) {
    const matches =
      item.href === "/admin"
        ? pathname === "/admin"
        : pathname === item.href || pathname.startsWith(`${item.href}/`);
    if (matches && (!best || item.href.length > best.href.length)) best = item;
  }
  return best;
}

/** Labels for the detail segments under a section, for the breadcrumb trail. */
const DETAIL_LABELS: { pattern: RegExp; label: string }[] = [
  { pattern: /^\/admin\/articles\/[^/]+$/, label: "Article" },
  { pattern: /^\/admin\/network\/(?!operations$)[^/]+$/, label: "Review" },
  { pattern: /^\/admin\/blog\/new$/, label: "New post" },
  { pattern: /^\/admin\/blog\/sponsorships$/, label: "Featured placements" },
  { pattern: /^\/admin\/blog\/images$/, label: "Images" },
  { pattern: /^\/admin\/blog\/autopilot$/, label: "Autopilot" },
  { pattern: /^\/admin\/blog\/[^/]+$/, label: "Edit post" },
  { pattern: /^\/admin\/testimonials\/new$/, label: "New testimonial" },
  { pattern: /^\/admin\/testimonials\/[^/]+$/, label: "Edit testimonial" },
  { pattern: /^\/admin\/feedback\/[^/]+$/, label: "Message" },
  { pattern: /^\/admin\/partners\/partners\/[^/]+$/, label: "Partner" },
];

export type Crumb = { href: string; label: string; current: boolean };

/** Admin > Section > (detail), the current page last. */
export function adminCrumbs(pathname: string): Crumb[] {
  const crumbs: Crumb[] = [{ href: "/admin", label: "Admin", current: pathname === "/admin" }];
  const item = activeNavItem(pathname);
  if (item && item.href !== "/admin") {
    crumbs.push({ href: item.href, label: item.label, current: pathname === item.href });
  }
  const detail = DETAIL_LABELS.find((entry) => entry.pattern.test(pathname));
  if (detail && (!item || pathname !== item.href)) {
    crumbs.push({ href: pathname, label: detail.label, current: true });
  }
  if (pathname === "/admin") crumbs[0] = { href: "/admin", label: "Overview", current: true };
  return crumbs;
}
