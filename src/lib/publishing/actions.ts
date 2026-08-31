"use server";

import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { inngest } from "@/inngest/client";
import { decryptSecret, encryptSecret, maskSecret } from "@/lib/crypto";
import { db } from "@/lib/db";
import { articles, integrations, publishLogs } from "@/lib/db/schema";
import {
  testConnection,
  WordPressError,
  type WordPressCredentials,
} from "@/lib/publishing/wordpress";
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
 */

export type IntegrationView = {
  id: string;
  kind: string;
  status: string;
  verifiedAt: Date | null;
  siteName: string | null;
  username: string | null;
  /** "••••abcd" — enough to recognise, useless to an attacker. */
  passwordHint: string | null;
};

type StoredCredentials = {
  siteUrl: string;
  username: string;
  /** Encrypted. Never leaves the server in this form or any other. */
  applicationPassword: string;
  passwordHint: string;
};

export async function getIntegration(
  websiteId: string,
): Promise<IntegrationView | null> {
  const { site } = await requireWebsite(websiteId);

  const [row] = await db
    .select()
    .from(integrations)
    .where(
      and(eq(integrations.websiteId, site.id), eq(integrations.kind, "wordpress")),
    )
    .limit(1);

  if (!row) return null;

  const creds = (row.credentials as StoredCredentials | null) ?? null;
  const meta = (row.meta as { siteName?: string } | null) ?? null;

  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    verifiedAt: row.verifiedAt,
    siteName: meta?.siteName ?? null,
    username: creds?.username ?? null,
    passwordHint: creds?.passwordHint ?? null,
  };
}

/**
 * Verifies credentials against the live site, then stores them encrypted.
 *
 * Tested BEFORE saving so a typo is reported immediately rather than
 * discovered on the first publish, when the article is already written.
 */
export async function connectWordPress(
  websiteId: string,
  input: { siteUrl: string; username: string; applicationPassword: string },
): Promise<ActionResult<{ siteName: string }>> {
  const { site } = await requireWebsite(websiteId);

  let siteUrl: string;
  try {
    siteUrl = normalizeWebsiteUrl(input.siteUrl).url;
  } catch (error) {
    if (error instanceof InvalidUrlError) return { ok: false, error: error.message };
    throw error;
  }

  const username = input.username.trim();
  const applicationPassword = input.applicationPassword.trim();
  if (!username || !applicationPassword) {
    return { ok: false, error: "Username and application password are required" };
  }

  const credentials: WordPressCredentials = {
    siteUrl,
    username,
    applicationPassword,
  };

  let info;
  try {
    info = await testConnection(credentials);
  } catch (error) {
    if (error instanceof WordPressError) return { ok: false, error: error.message };
    throw error;
  }

  const stored: StoredCredentials = {
    siteUrl,
    username,
    applicationPassword: encryptSecret(applicationPassword),
    passwordHint: maskSecret(applicationPassword),
  };

  const values = {
    credentials: stored,
    status: "connected",
    verifiedAt: new Date(),
    meta: { siteName: info.name, userLogin: info.userLogin },
    updatedAt: new Date(),
  };

  const [existing] = await db
    .select({ id: integrations.id })
    .from(integrations)
    .where(
      and(eq(integrations.websiteId, site.id), eq(integrations.kind, "wordpress")),
    )
    .limit(1);

  if (existing) {
    await db.update(integrations).set(values).where(eq(integrations.id, existing.id));
  } else {
    await db
      .insert(integrations)
      .values({ websiteId: site.id, kind: "wordpress", ...values });
  }

  revalidatePath(`/websites/${site.id}`);
  return { ok: true, data: { siteName: info.name } };
}

export async function disconnectWordPress(
  websiteId: string,
): Promise<ActionResult<null>> {
  const { site } = await requireWebsite(websiteId);

  // Deleted, not merely marked disconnected: keeping a credential we no longer
  // use is a liability with no benefit.
  await db
    .delete(integrations)
    .where(
      and(eq(integrations.websiteId, site.id), eq(integrations.kind, "wordpress")),
    );

  revalidatePath(`/websites/${site.id}`);
  return { ok: true, data: null };
}

/** Decrypts stored credentials. Server-only; never expose the result. */
export async function loadCredentials(
  websiteId: string,
): Promise<{ credentials: WordPressCredentials; integrationId: string } | null> {
  const [row] = await db
    .select()
    .from(integrations)
    .where(
      and(eq(integrations.websiteId, websiteId), eq(integrations.kind, "wordpress")),
    )
    .limit(1);

  if (!row) return null;
  const stored = row.credentials as StoredCredentials | null;
  if (!stored) return null;

  return {
    integrationId: row.id,
    credentials: {
      siteUrl: stored.siteUrl,
      username: stored.username,
      applicationPassword: decryptSecret(stored.applicationPassword),
    },
  };
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

  const integration = await getIntegration(site.id);
  if (!integration || integration.status !== "connected") {
    return { ok: false, error: "Connect WordPress first" };
  }

  await inngest.send({
    name: "article/publish.requested",
    data: { articleId, websiteId: site.id, organizationId: orgId, status },
  });

  revalidatePath(`/websites/${site.id}/articles/${articleId}`);
  return { ok: true, data: null };
}
