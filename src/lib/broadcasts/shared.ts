/**
 * Email broadcasts (ticket 2026-11-24): what the admin page and the server
 * share. Plain data only - no database, no Node - so the browser can import it.
 */

export const BROADCAST_AUDIENCES = ["all", "free", "paid", "inactive"] as const;
export type BroadcastAudience = (typeof BROADCAST_AUDIENCES)[number];

export function isBroadcastAudience(value: unknown): value is BroadcastAudience {
  return typeof value === "string" && (BROADCAST_AUDIENCES as readonly string[]).includes(value);
}

/** A person counts as inactive after this many days without a session. */
export const INACTIVE_DAYS = 30;

/** What each audience is, exactly as lib/broadcasts/audience.ts selects it. */
export const AUDIENCE_META: Record<BroadcastAudience, { label: string; definition: string }> = {
  all: {
    label: "All registered users",
    definition: "Everyone with a RepGet account.",
  },
  free: {
    label: "Free users only",
    definition: "People none of whose workspaces has a running subscription (active, in trial or past due) or agency access.",
  },
  paid: {
    label: "Paid subscribers only",
    definition: "People in a workspace with a running subscription (active, in trial or past due) or agency access.",
  },
  inactive: {
    label: "Inactive users only",
    definition: `People who joined more than ${INACTIVE_DAYS} days ago and have not used a session in the last ${INACTIVE_DAYS} days. RepGet keeps no record of a session after sign-out, so someone who signed out since counts as inactive.`,
  },
};

export type BroadcastStatus = "draft" | "scheduled" | "sending" | "sent" | "cancelled";

export const BROADCAST_STATUS: Record<BroadcastStatus, { label: string; tone: "neutral" | "info" | "pending" | "success" | "warning" }> = {
  draft: { label: "Draft", tone: "neutral" },
  scheduled: { label: "Scheduled", tone: "pending" },
  sending: { label: "Sending", tone: "info" },
  sent: { label: "Sent", tone: "success" },
  cancelled: { label: "Cancelled", tone: "warning" },
};

export type BroadcastImage = { url: string; alt: string };

export type BroadcastContent = {
  audience: BroadcastAudience;
  subject: string;
  previewText: string;
  bodyHtml: string;
  images: BroadcastImage[];
  ctaLabel: string;
  ctaUrl: string;
};

export const BROADCAST_LIMITS = {
  subject: 150,
  previewText: 200,
  /** HTML, formatting included. */
  bodyHtml: 30_000,
  images: 6,
  imageAlt: 200,
  ctaLabel: 60,
  ctaUrl: 500,
  /** How far ahead a broadcast can be scheduled. */
  scheduleDays: 90,
} as const;

/** Typed to send to more than one person. Exact and case-sensitive, checked by the server. */
export const SEND_WORD = "SEND";

/** Pictures an email can carry: Outlook shows neither WebP nor AVIF. */
export const BROADCAST_IMAGE_TYPES = ["image/png", "image/jpeg"] as const;
export const BROADCAST_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

export type BroadcastTemplateKey = "announcement" | "product" | "tips";

/** The mockup's three starting points. The administrator writes the news itself. */
export const BROADCAST_TEMPLATES: {
  key: BroadcastTemplateKey;
  label: string;
  /** The button's page on this site. */
  path: string;
  content: Pick<BroadcastContent, "subject" | "previewText" | "bodyHtml" | "ctaLabel">;
}[] = [
  {
    key: "announcement",
    label: "Announcement",
    path: "/dashboard",
    content: {
      subject: "RepGet update for all users",
      previewText: "A quick update from RepGet you should not miss.",
      bodyHtml:
        "<p>Hello from RepGet,</p><p>We wanted to share an important update with all our users. Thank you for being part of the platform.</p><p>Inside your dashboard you can now discover new improvements, better workflows, and stronger growth support.</p><p>Thank you,<br>The RepGet team</p>",
      ctaLabel: "Open RepGet",
    },
  },
  {
    key: "product",
    label: "Product update",
    path: "/dashboard",
    content: {
      subject: "New feature now live in RepGet",
      previewText: "See what is new in your account.",
      bodyHtml:
        "<p>Hello from RepGet,</p><p>We have just launched a new feature inside your account. This update is designed to help you move faster and get more value from the platform.</p><p>Log in to explore the changes and let us know what you think.</p><p>Thank you,<br>The RepGet team</p>",
      ctaLabel: "See the update",
    },
  },
  {
    key: "tips",
    label: "Growth tips",
    path: "/dashboard",
    content: {
      subject: "3 quick growth tips from RepGet",
      previewText: "Three practical ideas for this week.",
      bodyHtml:
        "<p>Hello from RepGet,</p><p>Here are three practical growth ideas you can apply this week:</p><ol><li><p>Refresh your top landing page headline.</p></li><li><p>Turn one article into multiple social posts.</p></li><li><p>Review your internal links and update weak pages.</p></li></ol><p>More insights are waiting in your dashboard.</p><p>Thank you,<br>The RepGet team</p>",
      ctaLabel: "Get growth ideas",
    },
  },
];
