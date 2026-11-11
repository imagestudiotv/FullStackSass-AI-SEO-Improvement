/**
 * Discover & earn (client ticket, 2026-11-11,
 * repget-earn-credits-multiple-businesses.html): members upvote and comment on
 * the businesses of the blog's "Customer stories", and earn ONE bonus once both
 * goals are met. The upvotes and comments are the posts' own, shown on each
 * post's page (lib/blog/engagement.ts).
 *
 * Plain data and checks, shared by the page, its dialog and the server
 * actions: the browser checks a comment to say what is wrong at once, and the
 * server checks it again, because the browser's word decides nothing.
 */

/**
 * The client's figures: "20 upvotes + 10 comments = 20 bonus credits". Constants,
 * as the other ways to earn are (lib/earn/ways.ts): Admin -> Earn Credits has
 * no editable rewards.
 */
export const DISCOVER_GOAL = { upvotes: 20, comments: 10, bonus: 20 } as const;

/** A credited comment: at least 50 characters, at most 750 (the dialog's counter), and no links. */
export const DISCOVER_COMMENT = { min: 50, max: 750 } as const;

/** How many customer stories the queue shows. More than the upvote goal, so the goal can be reached. */
export const DISCOVER_LIMIT = 60;

/** The dialog's draft styles, in its order. */
export const DISCOVER_STYLES = ["question", "insight", "appreciation"] as const;
export type DiscoverStyle = (typeof DISCOVER_STYLES)[number];

export function isDiscoverStyle(value: unknown): value is DiscoverStyle {
  return typeof value === "string" && (DISCOVER_STYLES as readonly string[]).includes(value);
}

export type DiscoverProgress = { upvotes: number; comments: number };

export function discoverGoalReached(progress: DiscoverProgress): boolean {
  return progress.upvotes >= DISCOVER_GOAL.upvotes && progress.comments >= DISCOVER_GOAL.comments;
}

/**
 * A web address in any of its usual shapes: with a scheme, starting "www.",
 * a bare domain followed by a path ("lakeside.example/bread"), or a bare
 * domain with a common ending ("example.com", "shop.example.it").
 * The design's own check was the first two; the third keeps "visit mysite.com"
 * out of a credited comment as well.
 */
const LINK =
  /(?:[a-z][a-z0-9+.-]*:\/\/|\bwww\.|\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}\/\S|\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|net|org|io|co|it|de|fr|es|uk|eu|info|biz|app|dev|ai|me|ly|shop|store|online|site|xyz)\b)/i;

export function hasLink(text: string): boolean {
  return LINK.test(text);
}

export type CommentProblem = "short" | "too_long" | "link" | "unconfirmed";

/**
 * What stops a comment from being posted, in the design's order: too short,
 * a link, the review box not ticked. Null when it can be posted.
 */
export function commentProblem(body: string, confirmed: boolean): CommentProblem | null {
  const text = body.trim();
  if (text.length < DISCOVER_COMMENT.min) return "short";
  if (text.length > DISCOVER_COMMENT.max) return "too_long";
  if (hasLink(text)) return "link";
  if (!confirmed) return "unconfirmed";
  return null;
}
