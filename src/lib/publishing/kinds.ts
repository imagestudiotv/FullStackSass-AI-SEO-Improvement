import { and, eq, inArray } from "drizzle-orm";

import { integrations } from "@/lib/db/schema";
import type { ProviderId } from "@/lib/publishing/provider";

/**
 * The integration kinds that PUBLISH - one per CMS provider.
 *
 * The integrations table also holds the Google Search Console / Analytics
 * connection, and a check for "any connected integration" counted it as a
 * place to publish. imagestudio.com hit exactly that: with Google connected
 * and WordPress reached only through the plugin, pressing Publish skipped the
 * plugin and queued a CMS publish that failed with "No publishing integration
 * is connected", and the first article was never sent.
 *
 * Kept in step with ProviderId by the type below: adding a provider without
 * listing it here is a compile error, not a site that silently cannot publish.
 */
export const PUBLISHING_KINDS = [
  "wordpress",
  "ghost",
  "shopify",
  "webflow",
  "wix",
  "webhook",
] as const satisfies readonly ProviderId[];

// Every ProviderId must appear above.
type Missing = Exclude<ProviderId, (typeof PUBLISHING_KINDS)[number]>;
const _complete: [Missing] extends [never] ? true : Missing = true;
void _complete;

/** A connected integration that can publish. Use with `from(integrations)`. */
export function isPublishingConnection() {
  return and(
    eq(integrations.status, "connected"),
    inArray(integrations.kind, [...PUBLISHING_KINDS]),
  );
}
