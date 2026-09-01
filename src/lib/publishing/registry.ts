import type { CmsProvider, ProviderId } from "@/lib/publishing/provider";
import { ghostProvider } from "@/lib/publishing/providers/ghost-provider";
import { shopifyProvider } from "@/lib/publishing/providers/shopify-provider";
import { webhookProvider } from "@/lib/publishing/providers/webhook-provider";
import { wordpressProvider } from "@/lib/publishing/providers/wordpress-provider";

/**
 * Every CMS the product can publish to.
 *
 * A provider missing from this list is unreachable — the connect UI renders
 * from it and publishing resolves through it — so registering here is the one
 * step that makes an adapter real.
 *
 * Order is the order customers see. WordPress first because it is the common
 * case; the webhook last because it is the fallback for everything else.
 */
const PROVIDERS: CmsProvider[] = [
  wordpressProvider,
  ghostProvider,
  shopifyProvider,
  webhookProvider,
];

export function listProviders(): CmsProvider[] {
  return PROVIDERS;
}

/**
 * Resolves a provider by id.
 *
 * Returns null rather than throwing for an unknown id: `kind` comes from a
 * database row, and a row written by an older version naming a provider we no
 * longer ship should degrade to "cannot publish" rather than crash the page
 * that lists integrations.
 */
export function getProvider(id: string): CmsProvider | null {
  return PROVIDERS.find((provider) => provider.id === id) ?? null;
}

/** True when the id names a provider we ship. */
export function isProviderId(id: string): id is ProviderId {
  return PROVIDERS.some((provider) => provider.id === id);
}

/**
 * The public shape of a provider, for the connect form.
 *
 * Deliberately excludes the functions: this crosses to the client, where a
 * method would not survive serialisation anyway.
 */
export type ProviderInfo = {
  id: string;
  name: string;
  description: string;
  helpUrl?: string;
  fields: CmsProvider["fields"];
};

export function providerInfo(provider: CmsProvider): ProviderInfo {
  return {
    id: provider.id,
    name: provider.name,
    description: provider.description,
    helpUrl: provider.helpUrl,
    fields: provider.fields,
  };
}
