/**
 * The shape of a testimonial card, and the public review score.
 *
 * The cards themselves are no longer written here: they are managed in
 * Admin -> Testimonials (lib/admin/testimonials.ts, table `testimonials`),
 * and only PUBLISHED ones reach the homepage (lib/marketing/
 * testimonials-db.ts). Publishing a card records who confirmed the person
 * agreed to it, and the client's sample cards (design package 2026-10-11:
 * quotes written for the mockup, AI-generated faces, names taken from
 * another company's reviews) cannot be published until their content is
 * replaced with a real customer's approved words.
 *
 * The review score stays here: null until a public profile with real
 * reviews exists. A made-up score is a misrepresentation anyone can check.
 *
 * A card from anyone connected to RepGet - its owners, staff or their own
 * businesses - must say so in `role` (e.g. "Photo & Film Studio, run by
 * RepGet's founder"): a hidden connection makes a real quote misleading.
 *
 * NO IMPORTS: shared by the server pages and the admin editor's preview.
 */

export type Testimonial = {
  /** The quote itself, in the customer's own words. */
  quote: string;
  /** Who said it. */
  name: string;
  /** Their role and company, e.g. "Founder, Tatem Web Design". */
  role: string;
  /**
   * Path to a photograph under /public, or null for initials instead. A
   * 128 x 128 WebP: the card shows it at 64px as it is, unresized.
   *
   * Null is the honest default: a stock portrait standing in for a real named
   * customer is a fake face on a real quote.
   */
  avatar?: string | null;
  /**
   * Whether we can show a "Verified customer" mark.
   *
   * Only true where the person is a paying customer we can identify — the
   * badge is a claim about who they are, not a decoration.
   */
  verified?: boolean;
};

export type ReviewScore = {
  /** Where the rating lives, e.g. "Trustpilot" or "Google". */
  platform: string;
  /** The score as published, e.g. 4.8. */
  score: number;
  /** Out of, e.g. 5. */
  outOf: number;
  /** How many reviews it is based on. A score with no count is not evidence. */
  count: number;
  /** The public profile, so anybody can check the number for themselves. */
  url: string;
};

/** The real public review score. Null until a profile exists with reviews in it. */
export const REVIEW_SCORE: ReviewScore | null = null;
