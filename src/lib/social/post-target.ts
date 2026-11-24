import { composeUrl, PLATFORMS, replyUrl, threadFromUrl, type SocialPlatform } from "./platforms";

/**
 * Where a suggestion is posted by hand, and the text as it is posted: ONE
 * rule, used by the page (it opens the address in the click itself) and by
 * the server (lib/social/actions.ts, which charges and records it), so the
 * two cannot disagree.
 *
 * No server imports: the Opportunities page's client components use it.
 */

export type PostEdit = { body: string; title?: string | null };

export type PostTextError = "empty" | "too_long";

/** The customer's text as it is posted, or why it cannot be. A title left out of the edit is the suggestion's own. */
export function postText(
  platform: SocialPlatform,
  ownTitle: string | null,
  edit: PostEdit,
): { ok: true; body: string; title: string | null } | { ok: false; error: PostTextError } {
  const spec = PLATFORMS[platform];
  const body = edit.body.trim();
  const title = edit.title === undefined ? ownTitle : edit.title?.trim() || null;
  if (!body) return { ok: false, error: "empty" };
  if (body.length > spec.maxLength || (title && spec.titleMax && title.length > spec.titleMax)) return { ok: false, error: "too_long" };
  return { ok: true, body, title };
}

/**
 * The page to open, and whether it has the text filled in (`filled`) or the
 * customer pastes it: Quora, and replies on Reddit and Bluesky.
 */
export function postTarget(
  suggestion: { platform: SocialPlatform; threadUrl: string | null; link: string | null; imageUrl: string | null },
  text: { body: string; title: string | null },
): { url: string; filled: boolean } {
  const { platform, threadUrl, link, imageUrl } = suggestion;
  const thread = threadUrl ? threadFromUrl(platform, threadUrl) : null;
  if (thread) {
    // replyUrl falls back to the discussion itself, where the text is pasted.
    const url = replyUrl(thread, text.body);
    return { url, filled: url !== thread.url };
  }
  const url = composeUrl(platform, { ...text, link, imageUrl });
  // Quora has no compose link, and a Reddit post too long for an address opens with its title only.
  const filled = platform === "reddit" ? url.includes("&text=") : platform !== "quora";
  return { url, filled };
}
