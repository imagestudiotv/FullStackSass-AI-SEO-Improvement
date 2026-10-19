/**
 * Feedback for RepGet itself (client, 2026-10-19): what the forms may send,
 * and the states an administrator gives it. No server code here - the forms
 * import it.
 */

export const FEEDBACK_KINDS = ["idea", "problem", "other"] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];

/** new -> planned | done | wont_do, set by an administrator. */
export const FEEDBACK_STATUSES = ["new", "planned", "done", "wont_do"] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

export const FEEDBACK_LIMITS = {
  messageMin: 10,
  message: 5000,
  name: 100,
  email: 254,
  /** More links than this reads as spam. */
  links: 5,
  /**
   * A screenshot as it reaches the server. Server actions take 1 MB in all
   * (Next.js's default), so the form shrinks a bigger picture in the browser
   * first (shrinkScreenshot) and the server re-encodes it anyway.
   */
  screenshotBytes: 900 * 1024,
  /** The widest a screenshot is kept. */
  screenshotWidth: 1600,
} as const;

/** Messages per page in Admin -> Feedback. Here, not in the "use server" admin module: that may export async actions only. */
export const FEEDBACK_ADMIN_PAGE_SIZE = 25;

export const SCREENSHOT_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

/** Why a message was not sent. Each form says it in the reader's language. */
export type FeedbackErrorCode =
  | "kind"
  | "message_short"
  | "message_long"
  | "email"
  | "name"
  | "links"
  | "screenshot_type"
  | "screenshot_size"
  | "screenshot_unreadable"
  | "too_many"
  | "busy";

export type FeedbackResult = { ok: true } | { ok: false; code: FeedbackErrorCode };

/** A plausible address: something@something.tld, no spaces. The reply is what proves it. */
export function isEmailAddress(value: string): boolean {
  return value.length <= FEEDBACK_LIMITS.email && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

/** Links in a message: "https://", "http://" and "www." each count once. */
export function linkCount(message: string): number {
  return (message.match(/https?:\/\/|\bwww\./gi) ?? []).length;
}
