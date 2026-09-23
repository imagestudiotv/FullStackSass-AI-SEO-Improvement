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
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions,
});
