import {
  Building2,
  Coins,
  FileText,
  Gauge,
  Network,
  Newspaper,
  Receipt,
  ScrollText,
  Trash2,
  type LucideIcon,
} from "lucide-react";

import type { AdminAction, AuditRow } from "@/lib/admin/audit";

/**
 * How the activity log names what happened.
 *
 * A Record over AdminAction, not a hand-picked list: every code the platform
 * can write must have a label, so adding a code to AdminAction without one
 * fails the type check instead of leaving it unfilterable. (The old filter
 * offered 9 of the codes; the rest could only be reached by typing the URL.)
 *
 * Icons follow the admin nav, so an entry reads as belonging to the section
 * where it is handled. Deletions share one icon, in the danger colour; the
 * label says the same thing in words.
 */

export type ActionMeta = {
  label: string;
  icon: LucideIcon;
  /** Something was deleted or removed. The label already says so. */
  removal?: boolean;
};

/** In the order the filter lists them: grouped by the area they belong to. */
export const ACTION_META: Record<AdminAction, ActionMeta> = {
  "payment.refunded": { label: "Payment refunded", icon: Receipt },
  "credits.adjusted": { label: "Credits adjusted", icon: Coins },

  "organization.limits_changed": { label: "Workspace limits changed", icon: Building2 },
  "organization.deactivated": { label: "Workspace deactivated", icon: Building2 },
  "organization.reactivated": { label: "Workspace reactivated", icon: Building2 },
  "organization.deleted": { label: "Workspace deleted", icon: Trash2, removal: true },
  "website.deleted": { label: "Website deleted", icon: Trash2, removal: true },
  "user.deleted": { label: "User deleted", icon: Trash2, removal: true },

  "article.updated": { label: "Article edited", icon: FileText },
  "article.deleted": { label: "Article deleted", icon: Trash2, removal: true },

  "network.placement_added": { label: "Partner link placed", icon: Network },
  "network.placement_removed": { label: "Partner link removed", icon: Trash2, removal: true },
  "network.placement_credits": { label: "Partner link credits changed", icon: Network },
  "network.article_approved": { label: "Partner article approved", icon: Network },
  "network.article_reopened": { label: "Partner article reopened", icon: Network },
  "network.article_edited": { label: "Partner article edited", icon: Network },

  "blog.post_created": { label: "Blog post created", icon: Newspaper },
  "blog.post_saved": { label: "Blog post saved", icon: Newspaper },
  "blog.post_published": { label: "Blog post published", icon: Newspaper },
  "blog.post_unpublished": { label: "Blog post unpublished", icon: Newspaper },
  "blog.post_deleted": { label: "Blog post deleted", icon: Trash2, removal: true },
  "blog.category_created": { label: "Blog category added", icon: Newspaper },
  "blog.category_saved": { label: "Blog category changed", icon: Newspaper },
  "blog.category_deleted": { label: "Blog category deleted", icon: Trash2, removal: true },

  "platform.control_changed": { label: "Platform control changed", icon: Gauge },
  "publication.dispatch_resolved": { label: "Delivery resolved", icon: Gauge },
  "authority.collection_requested": { label: "Domain Authority refresh requested", icon: Gauge },
  "valuation.policy_published": { label: "Valuation policy published", icon: Gauge },
};

/** Every code, labelled, for the Action filter. */
export const ACTION_OPTIONS = (Object.keys(ACTION_META) as AdminAction[]).map((value) => ({
  value,
  label: ACTION_META[value].label,
}));

/**
 * The label for a stored code. The column is plain text, so a row may carry a
 * code this build does not know (an older or newer one): it is shown as
 * written rather than hidden. Own-property check, so "constructor" in a row or
 * URL is not mistaken for a known code.
 */
export function actionMeta(code: string): ActionMeta {
  return Object.hasOwn(ACTION_META, code)
    ? ACTION_META[code as AdminAction]
    : { label: code, icon: ScrollText };
}

const TARGET_LABELS: Record<string, string> = {
  payment: "Payment",
  organization: "Workspace",
  website: "Website",
  user: "User",
  article: "Article",
  placement: "Partner link",
  blog_post: "Blog post",
  blog_category: "Blog category",
  platform_control: "Platform control",
  publication_dispatch: "Delivery",
  authority: "Domain Authority",
  valuation_policy: "Valuation policy",
};

/** What kind of thing the entry acted on, in words. */
export function targetLabel(targetType: string): string {
  if (Object.hasOwn(TARGET_LABELS, targetType)) return TARGET_LABELS[targetType];
  const words = targetType.replace(/[_.-]+/g, " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : "Unknown";
}

export type TargetLink = { href: string; destination: string };

/**
 * Where the entry's target is handled today, when an admin page exists for it.
 *
 * Only routes that exist: there are no organization, user or website detail
 * pages, and a deleted user, website or workspace has nothing to open. A
 * deleted blog post is not linked either. An article may have been removed
 * by its customer since; its page then says it does not exist.
 */
export function targetLink(row: Pick<AuditRow, "action" | "targetType" | "targetId" | "organizationId">): TargetLink | null {
  const id = row.targetId ? encodeURIComponent(row.targetId) : null;
  switch (row.targetType) {
    case "article":
      return id ? { href: `/admin/articles/${id}`, destination: "the article" } : null;
    case "blog_post":
      return id && row.action !== "blog.post_deleted" ? { href: `/admin/blog/${id}`, destination: "the blog post" } : null;
    case "blog_category":
      return { href: "/admin/blog", destination: "the blog" };
    case "payment":
      return row.organizationId
        ? { href: `/admin/payments?org=${encodeURIComponent(row.organizationId)}`, destination: "this workspace's payments" }
        : null;
    case "placement":
      return { href: "/admin/network", destination: "the Partner Network" };
    case "platform_control":
    case "publication_dispatch":
    case "authority":
    case "valuation_policy":
      return { href: "/admin/network/operations", destination: "Network Operations" };
    default:
      return null;
  }
}
