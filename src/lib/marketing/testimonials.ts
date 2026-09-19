/**
 * Customer quotes and the public review score.
 *
 * DELIBERATELY EMPTY. The reference design carries named customers with
 * photographs and growth figures ("organic traffic increased from 120 visits
 * per month to over 12,000") and a Trustpilot 4.8/5 badge. Those are that
 * company's customers and that company's rating.
 *
 * We have neither yet, and the screen these appear on is the one where
 * somebody decides to enter their card details — so an invented name, face or
 * score there is not decoration, it is fabricated evidence used to take money.
 * A made-up review score is also a straightforward misrepresentation of a
 * third-party rating that anyone can check.
 *
 * So the layout is built and the data is empty: every surface that reads this
 * renders nothing at all until there is something true to put in it.
 *
 * TO GO LIVE, fill in TESTIMONIALS with quotes the customer has agreed in
 * writing to publish, and REVIEW_SCORE with the real figure from the real
 * profile. Nothing else needs changing — the cards appear on their own.
 */

export type Testimonial = {
  /** The quote itself, in the customer's own words. */
  quote: string;
  /** Who said it. */
  name: string;
  /** Their role and company, e.g. "Founder, Tatem Web Design". */
  role: string;
  /**
   * Path to a photograph under /public, or null for initials instead.
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

/** Real customer quotes. Empty until there are some. */
export const TESTIMONIALS: Testimonial[] = [];

/** The real public review score. Null until a profile exists with reviews in it. */
export const REVIEW_SCORE: ReviewScore | null = null;
