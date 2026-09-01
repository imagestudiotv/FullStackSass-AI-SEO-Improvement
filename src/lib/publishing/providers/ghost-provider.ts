import crypto from "node:crypto";

import {
  ProviderError,
  type CmsProvider,
  type Credentials,
  type PublishInput,
} from "@/lib/publishing/provider";
import { isPublicWebsiteUrl } from "@/lib/websites/url";

/**
 * Ghost.
 *
 * The Admin API authenticates with a short-lived JWT signed from the admin key
 * rather than a bearer token. The key arrives as "id:secret", where the secret
 * is hex — sign with the raw bytes, not the hex string, or every request comes
 * back 401 with a message that does not say why.
 *
 * Signed with node:crypto rather than a JWT library: this is one HS256
 * signature with a fixed header, and a dependency for that is not worth the
 * supply chain.
 */

const TIMEOUT_MS = 30_000;

/** Ghost rejects tokens valid for much longer, and we only need one call. */
const TOKEN_TTL_SECONDS = 300;

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Builds a signed Admin API token.
 *
 * The audience must be the API version path. Ghost validates it, so a token
 * signed for the wrong audience fails with a generic error.
 */
function adminToken(adminApiKey: string): string {
  const [id, secret] = adminApiKey.split(":");
  if (!id || !secret) {
    throw new ProviderError(
      "That does not look like a Ghost Admin API key. It should contain a colon, like 1a2b3c:4d5e6f…",
      "auth",
    );
  }

  const now = Math.floor(Date.now() / 1000);
  const header = base64url(
    JSON.stringify({ alg: "HS256", typ: "JWT", kid: id }),
  );
  const payload = base64url(
    JSON.stringify({
      iat: now,
      exp: now + TOKEN_TTL_SECONDS,
      aud: "/admin/",
    }),
  );

  // The secret is hex-encoded; signing the string itself produces a token
  // Ghost silently rejects.
  const signature = crypto
    .createHmac("sha256", Buffer.from(secret, "hex"))
    .update(`${header}.${payload}`)
    .digest();

  return `${header}.${payload}.${base64url(signature)}`;
}

function apiUrl(siteUrl: string, path: string): string {
  return `${siteUrl.replace(/\/+$/, "")}/ghost/api/admin${path}`;
}

async function request<T>(
  credentials: Credentials,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  /**
   * Re-validated on every call, not only at connect time. The site URL is
   * user-supplied and stored, so without this an internal address saved once
   * would turn our server into a proxy on some later publish.
   */
  if (!isPublicWebsiteUrl(credentials.siteUrl)) {
    throw new ProviderError(
      "That site address is not a public website",
      "unreachable",
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(apiUrl(credentials.siteUrl, path), {
      ...init,
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        ...init.headers,
        authorization: `Ghost ${adminToken(credentials.adminApiKey)}`,
        accept: "application/json",
        /**
         * Ghost requires an Accept-Version header and changes behaviour
         * without it. Pinned so a Ghost upgrade cannot silently change the
         * shape of what we get back.
         */
        "accept-version": "v5.0",
      },
    });
  } catch (error) {
    /**
     * adminToken() is called while building the headers, inside this try, so a
     * malformed key would otherwise be caught here and relabelled
     * "unreachable" — telling the customer their site is unreachable when the
     * real problem is the key they just pasted.
     */
    if (error instanceof ProviderError) throw error;

    if (error instanceof Error && error.name === "AbortError") {
      throw new ProviderError("The site took too long to respond", "unreachable");
    }
    throw new ProviderError(
      error instanceof Error ? error.message : "Could not reach the site",
      "unreachable",
    );
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 401 || response.status === 403) {
    throw new ProviderError(
      "Ghost rejected the Admin API key. Check it was copied in full, including the part after the colon.",
      response.status === 403 ? "permission" : "auth",
      response.status,
    );
  }

  if (response.status === 404) {
    throw new ProviderError(
      "No Ghost Admin API was found at that address. Confirm the site URL points at your Ghost install.",
      "api_disabled",
      404,
    );
  }

  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const body = (await response.json()) as {
        errors?: { message?: string; context?: string }[];
      };
      const first = body.errors?.[0];
      if (first?.message) {
        detail = first.context ? `${first.message} (${first.context})` : first.message;
      }
    } catch {
      // Not JSON; the status is the best available message.
    }
    throw new ProviderError(detail, "unknown", response.status);
  }

  const text = await response.text();
  return (text ? JSON.parse(text) : null) as T;
}

type GhostPost = {
  id: string;
  url?: string;
  status?: string;
  updated_at?: string;
};

/**
 * Ghost stores posts as Lexical documents, but accepts HTML when asked to
 * convert. `?source=html` is what makes that happen — without it the html
 * field is ignored and the post publishes empty.
 */
function postBody(input: PublishInput, updatedAt?: string) {
  return {
    posts: [
      {
        title: input.title,
        html: input.contentHtml,
        status: input.status === "publish" ? "published" : "draft",
        ...(input.slug ? { slug: input.slug } : {}),
        ...(input.excerpt ? { custom_excerpt: input.excerpt.slice(0, 300) } : {}),
        ...(input.featuredMediaId ? { feature_image: input.featuredMediaId } : {}),
        /**
         * Ghost requires the last-known updated_at on an edit and rejects the
         * request without it. This is its optimistic-locking check: it stops
         * us overwriting an edit someone made in the Ghost editor meanwhile.
         */
        ...(updatedAt ? { updated_at: updatedAt } : {}),
      },
    ],
  };
}

export const ghostProvider: CmsProvider = {
  id: "ghost",
  name: "Ghost",
  description: "Publish straight to your Ghost blog.",
  helpUrl: "https://ghost.org/docs/admin-api/#token-authentication",
  fields: [
    {
      key: "siteUrl",
      label: "Ghost site address",
      placeholder: "https://example.com",
      url: true,
    },
    {
      key: "adminApiKey",
      label: "Admin API key",
      help: "Ghost admin → Settings → Integrations → Add custom integration. Copy the Admin API key, not the Content API key.",
      secret: true,
    },
  ],

  async testConnection(credentials) {
    /**
     * /users/me/ rather than /site/: the site endpoint answers for any valid
     * key, including a read-only one, so it would report success for a key
     * that cannot publish. This proves the key belongs to a real staff account.
     */
    const me = await request<{ users?: { name?: string; email?: string }[] }>(
      credentials,
      "/users/me/",
    );
    const site = await request<{ site?: { title?: string } }>(
      credentials,
      "/site/",
    ).catch(() => ({ site: undefined }));

    const user = me.users?.[0];
    return {
      siteName: site.site?.title ?? credentials.siteUrl,
      accountLabel: user?.name ?? user?.email ?? null,
    };
  },

  async createPost(credentials, input) {
    const body = await request<{ posts?: GhostPost[] }>(
      credentials,
      "/posts/?source=html",
      { method: "POST", body: JSON.stringify(postBody(input)) },
    );

    const post = body.posts?.[0];
    if (!post) {
      throw new ProviderError("Ghost did not return the created post", "unknown");
    }

    return {
      remoteId: post.id,
      remoteUrl: post.url ?? "",
      status: post.status === "published" ? "publish" : "draft",
    };
  },

  async updatePost(credentials, remoteId, input) {
    /**
     * Read first for updated_at. Ghost refuses an edit without it, and
     * fetching it here means an article edited in Ghost since we published is
     * detected rather than silently overwritten.
     */
    const current = await request<{ posts?: GhostPost[] }>(
      credentials,
      `/posts/${encodeURIComponent(remoteId)}/`,
    );
    const existing = current.posts?.[0];
    if (!existing) {
      throw new ProviderError("That post no longer exists in Ghost", "not_found");
    }

    const body = await request<{ posts?: GhostPost[] }>(
      credentials,
      `/posts/${encodeURIComponent(remoteId)}/?source=html`,
      {
        method: "PUT",
        body: JSON.stringify(postBody(input, existing.updated_at)),
      },
    );

    const post = body.posts?.[0];
    if (!post) {
      throw new ProviderError("Ghost did not return the updated post", "unknown");
    }

    return {
      remoteId: post.id,
      remoteUrl: post.url ?? "",
      status: post.status === "published" ? "publish" : "draft",
    };
  },

  /**
   * Ghost takes images as multipart uploads and returns a URL rather than an
   * id, so the "media id" carried through the pipeline is that URL — which is
   * exactly what feature_image expects.
   */
  async uploadMedia(credentials, file) {
    const form = new FormData();
    form.append(
      "file",
      new Blob([new Uint8Array(file.data)], { type: file.contentType }),
      file.filename,
    );
    form.append("purpose", "image");

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(apiUrl(credentials.siteUrl, "/images/upload/"), {
        method: "POST",
        signal: controller.signal,
        // No content-type: fetch sets the multipart boundary itself, and
        // setting it by hand produces a body the server cannot parse.
        headers: {
          authorization: `Ghost ${adminToken(credentials.adminApiKey)}`,
          accept: "application/json",
          "accept-version": "v5.0",
        },
        body: form,
      });

      if (!response.ok) {
        throw new ProviderError(
          `Ghost rejected the image (HTTP ${response.status})`,
          "unknown",
          response.status,
        );
      }

      const body = (await response.json()) as { images?: { url?: string }[] };
      const url = body.images?.[0]?.url;
      if (!url) {
        throw new ProviderError("Ghost did not return an image URL", "unknown");
      }

      return { id: url, url };
    } finally {
      clearTimeout(timer);
    }
  },
};
