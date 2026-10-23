import {
  Building2,
  Coins,
  FileText,
  Gauge,
  Handshake,
  MessageSquare,
  Network,
  Newspaper,
  Quote,
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
  "blog.placement_published": { label: "Featured placement published", icon: Newspaper },
  "blog.placement_declined": { label: "Featured placement declined", icon: Newspaper },
  "blog.placement_reopened": { label: "Featured placement back to review", icon: Newspaper },
  "blog.image_deleted": { label: "Blog picture deleted", icon: Newspaper },
  "blog.translation_created": { label: "Blog translation started", icon: Newspaper },
  "blog.autopilot_settings_saved": { label: "Blog autopilot settings changed", icon: Newspaper },
  "blog.autopilot_topics_added": { label: "Blog autopilot topics added", icon: Newspaper },
  "blog.autopilot_topic_saved": { label: "Blog autopilot topic changed", icon: Newspaper },
  "blog.autopilot_topic_deleted": { label: "Blog autopilot topic removed", icon: Trash2, removal: true },
  "blog.autopilot_run_started": { label: "Blog autopilot article started", icon: Newspaper },
  "feedback.status_changed": { label: "Feedback status changed", icon: MessageSquare },
  "feedback.replied": { label: "Feedback replied to", icon: MessageSquare },
  "feedback.deleted": { label: "Feedback deleted", icon: Trash2, removal: true },
  "testimonial.created": { label: "Testimonial added", icon: Quote },
  "testimonial.saved": { label: "Testimonial saved", icon: Quote },
  "testimonial.published": { label: "Testimonial published", icon: Quote },
  "testimonial.unpublished": { label: "Testimonial unpublished", icon: Quote },
  "testimonial.deleted": { label: "Testimonial deleted", icon: Quote },

  "platform.control_changed": { label: "Platform control changed", icon: Gauge },
  "publication.dispatch_resolved": { label: "Delivery resolved", icon: Gauge },
  "authority.collection_requested": { label: "Domain Authority refresh requested", icon: Gauge },
  "valuation.policy_published": { label: "Valuation policy published", icon: Gauge },

  "partner.application_approved": { label: "Partner application approved", icon: Handshake },
  "partner.application_rejected": { label: "Partner application rejected", icon: Handshake },
  "partner.suspended": { label: "Partner suspended", icon: Handshake },
  "partner.reactivated": { label: "Partner reactivated", icon: Handshake },
  "partner.payout_hold_set": { label: "Partner payouts held", icon: Handshake },
  "partner.payout_hold_released": { label: "Partner payout hold released", icon: Handshake },
  "partner.control_changed": { label: "Affiliate program switch changed", icon: Handshake },
  "partner.attribution_disqualified": { label: "Partner referral disqualified", icon: Handshake },
  "partner.attribution_confirmed": { label: "Partner referral confirmed", icon: Handshake },
  "partner.commission_adjusted": { label: "Partner commission adjusted", icon: Handshake },
  "partner.commission_held": { label: "Partner commission held", icon: Handshake },
  "partner.commission_released": { label: "Partner commission released", icon: Handshake },
  "partner.commission_approved": { label: "Partner commission approved", icon: Handshake },
  "partner.commission_rejected": { label: "Partner commission rejected", icon: Handshake },
  "partner.coupon_created": { label: "Partner coupon created", icon: Handshake },
  "partner.coupon_deactivated": { label: "Partner coupon deactivated", icon: Handshake },
  "partner.review_resolved": { label: "Partner review case resolved", icon: Handshake },
  "partner.settlement_created": { label: "Partner payout prepared", icon: Handshake },
  "partner.settlement_retried": { label: "Partner payout retried", icon: Handshake },
  "partner.settlement_canceled": { label: "Partner payout cancelled", icon: Handshake },
  "partner.transfer_reversal_requested": { label: "Partner transfer reversal requested", icon: Handshake },
  "partner.reconciliation_run": { label: "Partner reconciliation run", icon: Handshake },
  "partner.provider_events_retried": { label: "Partner Stripe work retried", icon: Handshake },
  "partner.referral_code_changed": { label: "Partner link name changed", icon: Handshake },
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
  partner: "Partner",
  partner_application: "Partner application",
  partner_attribution: "Partner referral",
  partner_commission: "Partner commission",
  partner_coupon: "Partner coupon",
  partner_review_case: "Partner review case",
  partner_settlement: "Partner payout",
  partner_program: "Affiliate program",
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
    case "partner":
      return id ? { href: `/admin/partners/partners/${id}`, destination: "the partner" } : null;
    case "partner_application":
      return { href: "/admin/partners/applications", destination: "partner applications" };
    case "partner_attribution":
      return { href: "/admin/partners/attribution", destination: "partner referrals" };
    case "partner_commission":
      return { href: "/admin/partners/commissions", destination: "partner commissions" };
    case "partner_coupon":
      return { href: "/admin/partners/coupons", destination: "partner coupons" };
    case "partner_review_case":
      return { href: "/admin/partners/reviews", destination: "partner review cases" };
    case "partner_settlement":
      return id ? { href: `/admin/partners/payouts/${id}`, destination: "the partner payout" } : { href: "/admin/partners/payouts", destination: "partner payouts" };
    case "partner_program":
      return { href: "/admin/partners", destination: "the affiliate program" };
    default:
      return null;
  }
}
