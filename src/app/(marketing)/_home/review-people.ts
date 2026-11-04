/**
 * How a reviewer appears on the homepage (hero pill and customer stories),
 * as the design sets them.
 */

/** Admin's avatar files that are only a drawing of letters: the design sets these cards in its own letters instead. */
const LETTER_AVATARS = new Set(["05", "07", "08", "11"].map((file) => `/preview/testimonials/sample-${file}.webp`));

/** The card's photograph, if it has a real one. */
export const photoOf = (avatar: string | null | undefined) => (avatar && !LETTER_AVATARS.has(avatar) ? avatar : null);

/** The letters on a card without a photograph: the first two words of the name, so "Oxford Magic Tours" is OM. */
export const lettersOf = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
