import "server-only";

import { and, desc, eq } from "drizzle-orm";

import { decryptSecret } from "@/lib/crypto";
import { db } from "@/lib/db";
import { integrations } from "@/lib/db/schema";
import type { CmsProvider, Credentials } from "@/lib/publishing/provider";
import { getProvider } from "@/lib/publishing/registry";

/**
 * Reading a customer's publishing credentials in the clear.
 *
 * ITS OWN MODULE, DELIBERATELY, AND NOT A SERVER ACTION.
 *
 * This lived in publishing/actions.ts, which carries "use server" — and every
 * export of such a file is a callable RPC endpoint with a generated URL, not
 * merely a function that happens to run on the server. loadCredentials takes a
 * websiteId, checked no session and no ownership, and returned DECRYPTED
 * WordPress application passwords. Any signed-in user who supplied another
 * customer's website id would have been handed write access to that
 * customer's live website. A comment saying "called from the publish job
 * alone" is a description, not an enforcement.
 *
 * Moving it here removes the endpoint rather than adding a guard to it. The
 * background publish job has no session to check — it runs on a schedule, not
 * on behalf of a request — so a guard would have had to be bypassable by
 * design. "server-only" makes importing this from a client component a build
 * error, which is the protection that actually fits: reachable from a job,
 * unreachable from a browser.
 *
 * Anything here handles plaintext secrets. Nothing in this file may be
 * re-exported from a "use server" module.
 */

/**
 * The jsonb shape on an integration row. Exported so actions.ts uses this one
 * definition rather than keeping a second copy that can drift from it.
 */
export type StoredCredentials = {
  /** Masked forms of the secret fields, for display only. */
  _hints?: Record<string, string>;
  /** Field values. Secrets hold ciphertext. */
  [key: string]: string | Record<string, string> | undefined;
};

/**
 * Rebuilds usable credentials from what is stored on an integration row.
 *
 * The column is jsonb holding one object per provider field, with only the
 * secret fields encrypted individually — not one encrypted blob. Two callers
 * decoded that inline and one of them guessed the shape wrong, treating the
 * whole object as a single ciphertext string; `as string` made it compile and
 * it failed at runtime for every customer who pressed "Publish test article".
 * One function owns the format so the two paths cannot disagree again.
 */
export function readStoredCredentials(
  provider: CmsProvider,
  stored: StoredCredentials | null,
): Credentials | null {
  if (!stored || typeof stored !== "object") return null;

  const credentials: Credentials = {};
  for (const field of provider.fields) {
    const value = stored[field.key];
    // _hints holds an object; only string fields are real credential values.
    if (typeof value !== "string") continue;
    credentials[field.key] = field.secret ? decryptSecret(value) : value;
  }

  // Nothing readable means the row predates this format, or the encryption
  // key changed: either way the customer has to reconnect.
  return Object.keys(credentials).length > 0 ? credentials : null;
}

/**
 * Decrypted credentials for a publish, with the provider that owns them.
 *
 * Callable only from server code that has already established what it is
 * allowed to touch: the publish job, which is dispatched with a website id the
 * platform itself chose. Never call this with an id that came from a request.
 */
export async function loadCredentials(websiteId: string): Promise<{
  integrationId: string;
  providerId: string;
  credentials: Credentials;
} | null> {
  const rows = await db
    .select()
    .from(integrations)
    .where(
      and(
        eq(integrations.websiteId, websiteId),
        eq(integrations.status, "connected"),
      ),
    )
    .orderBy(desc(integrations.verifiedAt));

  for (const row of rows) {
    const provider = getProvider(row.kind);
    if (!provider) continue;

    const credentials = readStoredCredentials(
      provider,
      row.credentials as StoredCredentials | null,
    );
    if (!credentials) continue;

    return {
      integrationId: row.id,
      providerId: provider.id,
      credentials,
    };
  }

  return null;
}
