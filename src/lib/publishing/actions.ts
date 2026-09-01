"use server";

import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { inngest } from "@/inngest/client";
import { decryptSecret, encryptSecret, maskSecret } from "@/lib/crypto";
import { db } from "@/lib/db";
import { articles, integrations, publishLogs } from "@/lib/db/schema";
import { ProviderError, type Credentials } from "@/lib/publishing/provider";
import { getProvider, listProviders, providerInfo } from "@/lib/publishing/registry";
import type { IntegrationView, ProviderInfo } from "@/lib/publishing/shared";
import { requireWebsite } from "@/lib/tenant";
import { normalizeWebsiteUrl, InvalidUrlError } from "@/lib/websites/url";
import type { ActionResult } from "@/lib/websites/actions";

/**
 * Publishing integrations.
 *
 * Credentials are WRITE access to the customer's live site, so they are
 * encrypted before storage and NEVER returned to the client — not even to the
 * owner. The UI shows a masked hint and the site name, which is enough to
 * confirm which account is connected.
 *
 * Everything here is provider-agnostic: which fields exist, which are secret,
 * and how a connection is verified all come from the provider itself. Adding a
 * CMS means writing an adapter and registering it, not editing this file.
 */

/**
 * Stored credential values, keyed by the provider's field names. Secret fields
 * hold ciphertext; a parallel `_hints` map holds their masked forms so the UI
 * can show which value is connected without ever seeing it.
 */
type StoredCredentials = {
  /** Masked forms of the secret fields, for display only. */
  _hints?: Record<string, string>;
  /** Field values. Secrets hold ciphertext. */
  [key: string]: string | Record<string, string> | undefined;
};

/** Every provider the product supports, for the connect UI. */
export async function listAvailableProviders(): Promise<ProviderInfo[]> {
  return listProviders().map(providerInfo);
}

/**
 * Every integration on a website.
 *
 * A website can publish to more than one place — a WordPress blog and a
 * webhook into something else — so this returns a list rather than the single
 * integration the WordPress-only version assumed.
 */
export async function listIntegrations(
  websiteId: string,
): Promise<IntegrationView[]> {
  const { site } = await requireWebsite(websiteId);

  const rows = await db
    .select()
    .from(integrations)
    .where(eq(integrations.websiteId, site.id))
    .orderBy(desc(integrations.createdAt));

  /**
   * The integrations table also holds non-CMS connections — Google Analytics
   * and Search Console live here too. Filtered by the registry rather than by
   * an exclusion list, so a future non-publishing integration cannot appear in
   * the publishing panel by default.
   */
  return rows.flatMap((row) => {
    const provider = getProvider(row.kind);
    if (!provider) return [];

    const stored = (row.credentials as StoredCredentials | null) ?? null;
    const meta = (row.meta as { siteName?: string; accountLabel?: string } | null) ?? null;

    return [{
      id: row.id,
      kind: row.kind,
      providerName: provider.name,
      status: row.status,
      verifiedAt: row.verifiedAt,
      siteName: meta?.siteName ?? null,
      accountLabel: meta?.accountLabel ?? null,
      /** "••••abcd" — enough to recognise, useless to an attacker. */
      secretHints: stored?._hints ?? {},
    }];
  });
}

/**
 * Connects, or reconnects, a CMS.
 *
 * The connection is TESTED before anything is stored. Storing first would
 * leave a customer with an integration that looks connected and fails on every
 * publish, discovered days later when an article silently does not appear.
 */
export async function connectProvider(
  websiteId: string,
  providerId: string,
  values: Record<string, string>,
): Promise<ActionResult<{ siteName: string }>> {
  const { site } = await requireWebsite(websiteId);

  const provider = getProvider(providerId);
  if (!provider) {
    return { ok: false, error: "That integration is not available" };
  }

  /**
   * Only the fields the provider declares are read. A crafted request cannot
   * smuggle extra keys into stored credentials this way.
   */
  const credentials: Credentials = {};
  for (const field of provider.fields) {
    const raw = (values[field.key] ?? "").trim();

    if (field.url) {
      // Normalised and SSRF-checked here as well as at call time, so a bad
      // address is rejected while the customer is looking at the form.
      if (!raw) {
        return { ok: false, error: `${field.label} is required` };
      }
      try {
        credentials[field.key] = normalizeWebsiteUrl(raw).url;
      } catch (error) {
        if (error instanceof InvalidUrlError) {
          return { ok: false, error: `${field.label}: ${error.message}` };
        }
        throw error;
      }
      continue;
    }

    /**
     * Optional fields are allowed through empty — Shopify's blog id is one,
     * and demanding it would force a customer to look up a value the provider
     * can work out itself.
     */
    if (!raw && field.secret) {
      return { ok: false, error: `${field.label} is required` };
    }
    credentials[field.key] = raw;
  }

  let info;
  try {
    info = await provider.testConnection(credentials);
  } catch (error) {
    if (error instanceof ProviderError) return { ok: false, error: error.message };
    throw error;
  }

  // Secrets are encrypted; their masked hints are stored alongside so the UI
  // can show which value is in use without ever holding the value.
  const stored: StoredCredentials = { _hints: {} };
  for (const field of provider.fields) {
    const value = credentials[field.key] ?? "";
    if (field.secret && value) {
      stored[field.key] = encryptSecret(value);
      stored._hints![field.key] = maskSecret(value);
    } else {
      stored[field.key] = value;
    }
  }

  const row = {
    credentials: stored,
    status: "connected",
    verifiedAt: new Date(),
    meta: { siteName: info.siteName, accountLabel: info.accountLabel },
    updatedAt: new Date(),
  };

  const [existing] = await db
    .select({ id: integrations.id })
    .from(integrations)
    .where(
      and(
        eq(integrations.websiteId, site.id),
        eq(integrations.kind, provider.id),
      ),
    )
    .limit(1);

  if (existing) {
    await db.update(integrations).set(row).where(eq(integrations.id, existing.id));
  } else {
    await db
      .insert(integrations)
      .values({ websiteId: site.id, kind: provider.id, ...row });
  }

  revalidatePath(`/websites/${site.id}`);
  return { ok: true, data: { siteName: info.siteName } };
}

export async function disconnectProvider(
  websiteId: string,
  providerId: string,
): Promise<ActionResult<null>> {
  const { site } = await requireWebsite(websiteId);

  // Scoped by website as well as kind, so an id from another tenant deletes
  // nothing rather than disconnecting someone else's site.
  await db
    .delete(integrations)
    .where(
      and(
        eq(integrations.websiteId, site.id),
        eq(integrations.kind, providerId),
      ),
    );

  revalidatePath(`/websites/${site.id}`);
  return { ok: true, data: null };
}

/**
 * Decrypted credentials for a publish, with the provider that owns them.
 *
 * Server-only by construction: this returns plaintext secrets, so it must
 * never be reachable from a client component. It is called from the publish
 * job alone.
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

    const stored = row.credentials as StoredCredentials | null;
    if (!stored) continue;

    const credentials: Credentials = {};
    for (const field of provider.fields) {
      const value = stored[field.key];
      if (typeof value !== "string") continue;
      credentials[field.key] = field.secret ? decryptSecret(value) : value;
    }

    return {
      integrationId: row.id,
      providerId: provider.id,
      credentials,
    };
  }

  return null;
}

export type PublishLogRow = {
  id: string;
  status: string;
  remoteUrl: string | null;
  error: string | null;
  createdAt: Date;
};

export async function listPublishLogs(
  websiteId: string,
  articleId: string,
): Promise<PublishLogRow[]> {
  const { site } = await requireWebsite(websiteId);

  // Joined through articles so a log from another tenant's article cannot be
  // read by passing its id.
  return db
    .select({
      id: publishLogs.id,
      status: publishLogs.status,
      remoteUrl: publishLogs.remoteUrl,
      error: publishLogs.error,
      createdAt: publishLogs.createdAt,
    })
    .from(publishLogs)
    .innerJoin(articles, eq(publishLogs.articleId, articles.id))
    .where(and(eq(articles.id, articleId), eq(articles.websiteId, site.id)))
    .orderBy(desc(publishLogs.createdAt))
    .limit(10);
}

/** Queues a publish. The HTTP call runs in a job so the UI is not held open. */
export async function publishArticle(
  websiteId: string,
  articleId: string,
  status: "publish" | "draft" = "publish",
): Promise<ActionResult<null>> {
  const { site, orgId } = await requireWebsite(websiteId);

  const [article] = await db
    .select({ id: articles.id, bodyHtml: articles.bodyHtml })
    .from(articles)
    .where(and(eq(articles.id, articleId), eq(articles.websiteId, site.id)))
    .limit(1);
  if (!article) return { ok: false, error: "Article not found" };
  if (!article.bodyHtml) {
    return { ok: false, error: "This article has not been written yet" };
  }

  const [connected] = await db
    .select({ id: integrations.id })
    .from(integrations)
    .where(
      and(
        eq(integrations.websiteId, site.id),
        eq(integrations.status, "connected"),
      ),
    )
    .limit(1);

  if (!connected) {
    return { ok: false, error: "Connect somewhere to publish to first" };
  }

  await inngest.send({
    name: "article/publish.requested",
    data: { articleId, websiteId: site.id, organizationId: orgId, status },
  });

  revalidatePath(`/websites/${site.id}/articles/${articleId}`);
  return { ok: true, data: null };
}
