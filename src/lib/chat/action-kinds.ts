import type { CreditAction } from "@/lib/credits/prices";

/** What the assistant can offer to do (lib/chat/actions-catalog.ts). No server imports: the card reads it. */
export const CHAT_ACTION_KINDS = [
  "add_topics",
  "write_article",
  "rerun_website_check",
  "find_social_posts",
  "make_video",
  "new_video_ideas",
  "snooze_task",
  "add_backlink_page",
] as const;
export type ChatActionKind = (typeof CHAT_ACTION_KINDS)[number];

export function isChatActionKind(value: unknown): value is ChatActionKind {
  return typeof value === "string" && (CHAT_ACTION_KINDS as readonly string[]).includes(value);
}

/**
 * What confirming costs, as the card shows it: a credit price (Admin ->
 * Credits), one of the plan's monthly articles, or nothing. The website check
 * is free the first time; the card shows its price, the check itself decides.
 */
export const ACTION_PRICE: Record<ChatActionKind, { credits: CreditAction } | "article" | "free"> = {
  add_topics: "article",
  write_article: "article",
  rerun_website_check: { credits: "audit_rerun" },
  find_social_posts: "free",
  make_video: { credits: "video_post" },
  new_video_ideas: "free",
  snooze_task: "free",
  add_backlink_page: "free",
};

export type ChatActionView = {
  id: string;
  kind: ChatActionKind;
  details: string;
  status: "proposed" | "done" | "failed" | "cancelled";
  outcome: string | null;
};
