import type { CredentialField } from "@/lib/publishing/provider";

/**
 * Types shared between publishing actions and the UI.
 *
 * Separate from actions.ts because that file carries "use server", where every
 * export must be an async function — a type exported from there is a build
 * error.
 */

export type IntegrationView = {
  id: string;
  /** Provider id, e.g. "wordpress". */
  kind: string;
  /** Display name, resolved from the registry. */
  providerName: string;
  status: string;
  verifiedAt: Date | null;
  siteName: string | null;
  /** The connected account, where the platform exposes one. */
  accountLabel: string | null;
  /**
   * Masked secrets by field key: "••••abcd". Enough for the customer to
   * recognise which credential is in use, useless to anyone else.
   */
  secretHints: Record<string, string>;
};

export type ProviderInfo = {
  id: string;
  name: string;
  description: string;
  helpUrl?: string;
  fields: CredentialField[];
};
