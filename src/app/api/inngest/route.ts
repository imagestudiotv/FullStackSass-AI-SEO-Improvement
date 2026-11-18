import { serve } from "inngest/next";

import { inngest } from "@/inngest/client";
import { functions } from "@/inngest/functions";

/**
 * Every background job is reachable through this one endpoint, so the signing
 * key is the only thing between the internet and "generate an article for any
 * organization id you like". It is configured on the client — see
 * inngest/client.ts, which refuses to build without it in production.
 *
 * Verified against the live deployment: an unsigned POST carrying a crafted
 * article/generate.requested event returns 401, as does GET introspection.
 */

/**
 * Each background step runs inside one request to this endpoint, so the
 * longest step must fit Vercel's limit. Left at the 300-second default, the
 * plan of "RepGet vs Semrush" (2026-11-18) was cut off mid-answer: Inngest
 * reported "Your server returned HTTP 504 before the SDK responded", and every
 * retry paid for the same unfinished answer. With room for 64,000 tokens at
 * high effort, a comparison's plan can take longer than 300 seconds; 800 is
 * the most Vercel allows (Fluid compute, Pro).
 */
export const maxDuration = 800;

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions,
});
