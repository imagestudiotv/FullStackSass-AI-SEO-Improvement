import crypto from "node:crypto";

import {
  ProviderError,
  type CmsProvider,
  type Credentials,
  type PublishInput,
} from "@/lib/publishing/provider";
import { isPublicWebsiteUrl } from "@/lib/websites/url";

/**
 * A generic webhook, for everything else.
 *
 * There will always be a CMS we do not support — a bespoke site, a headless
 * setup, something in-house. Rather than telling those customers no, we POST
 * the article as JSON to a URL they control and let them do whatever their
 * stack needs.
 *
 * This is also the honest answer to "do you integrate with X?" for any X: yes,
 * if you can receive a webhook.
 *
 * Requests are SIGNED. The endpoint is a URL that creates content on the
 * customer's site, so without a signature anyone who learns it could publish
 * to their website. The signature lets them verify a request genuinely came
 * from us before acting on it.
 */

const TIMEOUT_MS = 30_000;

/**
 * The payload we POST. Documented here because it is a public contract: a
 * customer writes code against this shape, so changing a field name breaks
 * their integration silently.
 */
export type WebhookPayload = {
  /** "create" or "update". */
  event: "create" | "update";
  /** Present on update: the id the endpoint returned when it was created. */
  remoteId: string | null;
  article: {
    title: string;
    html: string;
    slug: string | null;
    excerpt: string | null;
    status: "publish" | "draft";
    imageUrl: string | null;
  };
  /** Unix seconds. Lets the receiver reject a replayed request. */
  timestamp: number;
};

/**
 * Signs the body with the shared secret.
 *
 * HMAC-SHA256 over the exact bytes sent, hex encoded, in an X-Signature
 * header — the same shape Stripe and GitHub use, so a customer has likely
 * implemented this before.
 */
function sign(body: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
}

async function send(
  credentials: Credentials,
  payload: WebhookPayload,
): Promise<{ remoteId: string; remoteUrl: string }> {
  /**
   * The endpoint is user-supplied and stored, so it is re-checked on every
   * send. Without this, an internal address saved once would have our server
   * POSTing into our own network on every publish.
   */
  if (!isPublicWebsiteUrl(credentials.endpointUrl)) {
    throw new ProviderError(
      "That endpoint is not a public URL",
      "unreachable",
    );
  }

  const body = JSON.stringify(payload);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(credentials.endpointUrl, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        "x-signature": sign(body, credentials.signingSecret),
        "x-event": payload.event,
      },
      body,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new ProviderError(
        "Your endpoint took too long to respond",
        "unreachable",
      );
    }
    throw new ProviderError(
      error instanceof Error ? error.message : "Could not reach your endpoint",
      "unreachable",
    );
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 401 || response.status === 403) {
    throw new ProviderError(
      "Your endpoint rejected the request. Check it is verifying the X-Signature header against the same signing secret.",
      response.status === 403 ? "permission" : "auth",
      response.status,
    );
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new ProviderError(
      `Your endpoint returned HTTP ${response.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`,
      "unknown",
      response.status,
    );
  }

  /**
   * A response is optional. An endpoint that returns an id lets us update the
   * same post later; one that returns nothing still works, it just means every
   * publish creates rather than edits — which is the receiver's choice to make.
   */
  let remoteId = "";
  let remoteUrl = "";
  try {
    const parsed = (await response.json()) as {
      id?: unknown;
      url?: unknown;
    };
    if (typeof parsed.id === "string" || typeof parsed.id === "number") {
      remoteId = String(parsed.id);
    }
    if (typeof parsed.url === "string") remoteUrl = parsed.url;
  } catch {
    // No body, or not JSON. Both are acceptable.
  }

  return { remoteId, remoteUrl };
}

function toPayload(
  input: PublishInput,
  event: "create" | "update",
  remoteId: string | null,
): WebhookPayload {
  return {
    event,
    remoteId,
    article: {
      title: input.title,
      html: input.contentHtml,
      slug: input.slug,
      excerpt: input.excerpt,
      status: input.status,
      imageUrl: input.featuredMediaId ?? null,
    },
    timestamp: Math.floor(Date.now() / 1000),
  };
}

export const webhookProvider: CmsProvider = {
  id: "webhook",
  name: "Custom (webhook)",
  description:
    "Send articles to any system that can receive a webhook. For custom or headless sites.",
  fields: [
    {
      key: "endpointUrl",
      label: "Endpoint URL",
      placeholder: "https://example.com/api/articles",
      help: "We POST the article here as JSON. It must be publicly reachable over HTTPS.",
      url: true,
    },
    {
      key: "signingSecret",
      label: "Signing secret",
      help: "Any long random string. We send an X-Signature header — an HMAC-SHA256 of the request body using this secret — so your endpoint can verify the request came from us.",
      secret: true,
    },
  ],

  /**
   * Verified with a real signed POST carrying a draft marked as a test.
   *
   * A HEAD or an empty ping would prove the URL resolves without proving the
   * endpoint accepts our payload or checks our signature — which are the two
   * things that actually break later.
   */
  async testConnection(credentials) {
    await send(credentials, {
      event: "create",
      remoteId: null,
      article: {
        title: "Test connection",
        html: "<p>This is a test from your SEO platform. Nothing was published.</p>",
        slug: null,
        excerpt: null,
        status: "draft",
        imageUrl: null,
      },
      timestamp: Math.floor(Date.now() / 1000),
    });

    let host = credentials.endpointUrl;
    try {
      host = new URL(credentials.endpointUrl).host;
    } catch {
      // Already validated by send(); the raw value is a fine fallback.
    }

    return { siteName: host, accountLabel: null };
  },

  async createPost(credentials, input) {
    const result = await send(credentials, toPayload(input, "create", null));
    return {
      // Falls back to a generated id so publish_logs always has something to
      // record, even from an endpoint that returns nothing.
      remoteId: result.remoteId || crypto.randomUUID(),
      remoteUrl: result.remoteUrl,
      status: input.status,
    };
  },

  async updatePost(credentials, remoteId, input) {
    const result = await send(credentials, toPayload(input, "update", remoteId));
    return {
      remoteId: result.remoteId || remoteId,
      remoteUrl: result.remoteUrl,
      status: input.status,
    };
  },

  /**
   * No uploadMedia. The payload carries an image URL when one exists, which is
   * simpler for a receiver than handling a multipart upload.
   */
};
