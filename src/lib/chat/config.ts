/**
 * The AI chat on the Home page (client, 2026-10-31; docs/ai-chat.md): the
 * customer asks about their website and RepGet answers from its own data,
 * and offers to do things - each only after the customer presses Confirm.
 *
 * No server imports: the Home page's chat panel reads these too.
 */

/** Messages a workspace sends free each day (UTC); after that each costs `chat_message` credits. */
export const CHAT_FREE_PER_DAY = 5;
/** A conversation is deleted this many days after its last message (client: 30 days). */
export const CHAT_KEEP_DAYS = 30;
/** The longest message a customer can send. */
export const MAX_MESSAGE_CHARS = 2000;
/** Earlier messages of the conversation the model is given with a new question. */
export const HISTORY_MESSAGES = 16;
/** Conversations listed in the history. */
export const MAX_THREADS_LISTED = 30;

export type ChatLink = { label: string; href: string };

/**
 * The RepGet pages the assistant may link to, by name. It names a page; the
 * address is built here, so it can never send the customer anywhere else.
 */
export const CHAT_PAGES = [
  "dashboard",
  "planned_articles",
  "website_health",
  "google",
  "losing_traffic",
  "ai_visibility",
  "backlinks",
  "social",
  "videos",
  "profile",
  "integrations",
  "publishing",
  "credits",
  "billing",
] as const;
export type ChatPage = (typeof CHAT_PAGES)[number];

export function isChatPage(value: unknown): value is ChatPage {
  return typeof value === "string" && (CHAT_PAGES as readonly string[]).includes(value);
}

export function chatPageHref(page: ChatPage, websiteId: string): string {
  const site = `/websites/${websiteId}`;
  switch (page) {
    case "dashboard":
      return "/dashboard";
    case "planned_articles":
      return `${site}/content`;
    case "website_health":
      return site;
    case "google":
      return `${site}/google`;
    case "losing_traffic":
      return `${site}/traffic`;
    case "ai_visibility":
      return `${site}/ai-visibility`;
    case "backlinks":
      return `${site}/backlinks`;
    case "social":
      return `${site}/social`;
    case "videos":
      return `${site}/videos`;
    case "profile":
      return `${site}/profile`;
    case "integrations":
      return `${site}/integrations`;
    case "publishing":
      return `${site}/publishing`;
    case "credits":
      return "/credits";
    case "billing":
      return "/billing";
  }
}

/** The start of the UTC day `now` is in: the free messages count from there. */
export function startOfUtcDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** A conversation's title: its first question, on one line, shortened. */
export function threadTitle(question: string): string {
  const line = question.replace(/\s+/g, " ").trim();
  return line.length > 80 ? `${line.slice(0, 77).trimEnd()}...` : line;
}
