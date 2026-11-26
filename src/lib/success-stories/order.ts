import { IMAGE_STUDIO } from "@/lib/marketing/case-study-image-studio";

/**
 * THE ORDER OF THE CUSTOMER STORIES (client, 2026-11-19: "imagestudio
 * website will be always first stable fixed, no matter the other businesses
 * we will be adding, all insertions will follow after the imagestudio
 * website"). One rule for every place that lists them - the homepage's
 * Customer stories, /success-stories and /discover - so no page can drift.
 *
 * 1. Image Studio first, always: whatever its date or sort order says.
 *    Several cards can be about it (its Customer stories post, the built-in
 *    case-study card); one is kept - a post's over the built-in card, which
 *    is only there so Image Studio is never missing.
 * 2. One card per business (client, 2026-11-26: "Keep only the success
 *    story; keep the blog post too of course, but don't display it twice"):
 *    a business with a story from Admin -> Success stories is shown by that
 *    story alone - its blog Customer stories posts are not listed as cards
 *    of their own (they stay in the blog, at their own address). The same
 *    business is the same website, or the same name when either card has
 *    no website (sameBusiness).
 * 3. Then everything else by sortOrder (a blog customer story is 0; a story
 *    from Admin -> Success stories is 1, 2, 3... as the administrator
 *    ordered them), then in the order added (oldest first), then by id so
 *    the order never flickers between two requests.
 */

/** One card, from whichever source (lib/success-stories/stories.ts builds them). */
export type StoryCard = {
  /** Unique across sources: "image-studio", "post:<uuid>", "story:<uuid>". */
  id: string;
  /** The built-in Image Studio card, a blog customer story, or a story from Admin -> Success stories. */
  source: "image-studio" | "blog" | "story";
  title: string;
  description: string;
  /** The business's or person's name. */
  name: string;
  logoUrl: string | null;
  href: string;
  /** http(s) only; null when there is none. */
  websiteUrl: string | null;
  /** The byline's label; null is "Customer story" in the reader's language. */
  label: string | null;
  /** Ascending, after Image Studio. */
  sortOrder: number;
  /** ISO; when it was published. Null sorts last. */
  addedAt: string | null;
};

function hostOf(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

/**
 * True for a card about Image Studio: the built-in one, one whose website is
 * imagestudio.com, or one named "Image Studio" with no website (a website
 * elsewhere is another business that happens to share the name).
 */
export function isImageStudioCard(card: Pick<StoryCard, "source" | "name" | "websiteUrl">): boolean {
  if (card.source === "image-studio") return true;
  return sameBusiness(card, { name: "Image Studio", websiteUrl: IMAGE_STUDIO.site });
}

function nameKey(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * True when two cards are about the same business: the same website (www.
 * and the path aside) when both have one - two websites are two businesses
 * that happen to share a name - otherwise the same name, case and spacing
 * aside.
 */
export function sameBusiness(a: Pick<StoryCard, "name" | "websiteUrl">, b: Pick<StoryCard, "name" | "websiteUrl">): boolean {
  const [hostA, hostB] = [hostOf(a.websiteUrl), hostOf(b.websiteUrl)];
  if (hostA && hostB) return hostA === hostB;
  const name = nameKey(a.name);
  return name !== "" && name === nameKey(b.name);
}

function compareRest(a: StoryCard, b: StoryCard): number {
  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
  if (a.addedAt !== b.addedAt) {
    if (a.addedAt === null) return 1;
    if (b.addedAt === null) return -1;
    return a.addedAt < b.addedAt ? -1 : 1;
  }
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** The cards in the order every page shows them (see the top of this file). */
export function orderStoryCards<T extends StoryCard>(cards: readonly T[]): T[] {
  const stories = cards.filter((card) => card.source === "story");
  const shown = cards.filter((card) => card.source !== "blog" || !stories.some((story) => sameBusiness(card, story)));
  const imageStudio = shown.filter(isImageStudioCard);
  const pinned = imageStudio.find((card) => card.source !== "image-studio") ?? imageStudio[0];
  const rest = shown.filter((card) => !isImageStudioCard(card)).sort(compareRest);
  return pinned ? [pinned, ...rest] : rest;
}
