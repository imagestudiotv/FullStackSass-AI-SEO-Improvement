import { Inngest } from "inngest";

/**
 * INNGEST_EVENT_KEY and INNGEST_SIGNING_KEY are read from the environment
 * automatically. Neither is needed by the local dev server; both are required
 * in production.
 *
 * THE SIGNING KEY IS THE ONLY AUTHENTICATION ON /api/inngest, and every
 * background job is reachable through it: article generation, credit
 * movements, publishing. Without a key the SDK serves the endpoint UNSIGNED
 * rather than refusing to start — right for local development, and silently
 * catastrophic for a deployment that lost the variable, because an
 * unauthenticated POST could then invoke any job with any organization id.
 *
 * So it is passed explicitly and checked below, rather than left implicit.
 *
 * The check is a WARNING, not a throw. `next build` evaluates every route
 * module to collect page data, so a module-scope throw fails the build on any
 * machine without the variable — CI, a fresh clone, a preview deploy — which
 * is the same reasoning lib/db/index.ts records for its lazy client. The
 * endpoint itself still rejects unsigned requests; this line exists so the
 * cause is visible in the logs rather than being discovered by an attacker.
 */
const signingKey = process.env.INNGEST_SIGNING_KEY;

if (process.env.NODE_ENV === "production" && !signingKey) {
  console.error(
    "[inngest] INNGEST_SIGNING_KEY is not set. /api/inngest cannot verify " +
      "requests, and every background job is reachable through it. Set it now.",
  );
}

export const inngest = new Inngest({
  id: "ai-seo-platform",
  ...(signingKey ? { signingKey } : {}),
});
