import type { BetterAuthOptions } from "better-auth";

/**
 * How often each sign-in door may be knocked on, per visitor (client's launch
 * review, 2026-10-03: "explicit rate limits"). Stated here rather than left
 * to Better Auth's defaults, which allowed 3 password attempts every 10
 * seconds - 18 a minute, around the clock, per address.
 *
 * How Better Auth counts: every request on a path from one address -
 * successful or not - adds one, and the count only starts again once a whole
 * window passes with nothing allowed. So "10 a minute" means "10 in a row,
 * each less than a minute after the last". The numbers leave room for an
 * office or a mobile network where many people share one address, and are
 * still far below the 18 guesses a minute the defaults allowed.
 *
 * Paths are Better Auth's own, without /api/auth. A rule here replaces both
 * the library's built-in rule and its plugins' for that exact path; only one
 * window applies to a request. Paths in lib/auth.ts's disabledPaths answer
 * 404 before any limit, so they need none.
 *
 * Over the limit, Better Auth answers 429 with X-Retry-After; the sign-in
 * and settings forms say "too many attempts" in the reader's language.
 *
 * lib/auth.ts supplies the atomic PostgreSQL store in rate-limit-store.ts.
 * Buckets survive restarts and are shared across server instances. Apply
 * migration 0050 before deploying; a missing store fails closed.
 */
export function authRateLimit(nodeEnv: string | undefined = process.env.NODE_ENV): NonNullable<BetterAuthOptions["rateLimit"]> {
  return {
    /*
      On for every deployed build (Vercel production and previews both run
      NODE_ENV=production) - Better Auth's own default, stated. Off under
      `next dev` and tests, where every request comes from one address.
    */
    enabled: nodeEnv === "production",
    // customStorage is wired by lib/auth.ts; no per-process fallback.
    // Everything not named below: Better Auth's default, generous for real use.
    window: 10,
    max: 100,
    customRules: {
      // Guessing a password: 10 tries, each less than a minute after the last.
      "/sign-in/email": { window: 60, max: 10 },
      // Making accounts in bulk: 10, each less than 10 minutes after the last.
      "/sign-up/email": { window: 600, max: 10 },
      // Guessing the current password from a stolen session: 5 a minute.
      "/change-password": { window: 60, max: 5 },
      // Starting a Google sign-in: cheap, but not unlimited.
      "/sign-in/social": { window: 60, max: 10 },
    },
  };
}

/**
 * The one-time-code paths (send, check, sign in with it): 3 a minute each,
 * per address - the email-OTP plugin's default, stated because it is what
 * stops someone flooding an inbox with codes. Each code also allows only 3
 * guesses (allowedAttempts in lib/auth.ts).
 */
export const OTP_RATE_LIMIT = { window: 60, max: 3 };

/**
 * Where the visitor's address comes from. Vercel sets both headers itself and
 * overwrites anything a client sent; x-real-ip first, as the rest of the app
 * reads it (lib/tools/description-writer.ts). This matters more than it
 * looks: with no usable address Better Auth puts EVERY visitor in one shared
 * bucket per path, and five wrong passwords from anyone would lock everyone
 * out for a minute.
 */
export const AUTH_IP_HEADERS = ["x-real-ip", "x-forwarded-for"];
