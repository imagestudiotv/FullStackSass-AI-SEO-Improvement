import { Inngest } from "inngest";

/**
 * INNGEST_EVENT_KEY and INNGEST_SIGNING_KEY are read from the environment
 * automatically. Neither is needed by the local dev server; both are required
 * in production.
 */
export const inngest = new Inngest({
  id: "ai-seo-platform",
});
