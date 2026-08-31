import { isPublicWebsiteUrl } from "@/lib/websites/url";

/**
 * WordPress REST API client.
 *
 * Uses Application Passwords (WordPress 5.6+), not the user's login password.
 * They are per-application, revocable from the WordPress profile screen, and
 * do not grant access to the admin UI — so a leak is contained and the customer
 * can cut us off without changing their own password.
 *
 * No plugin required for v1. The REST API covers creating posts, categories and
 * media, which is everything publishing needs.
 */

const TIMEOUT_MS = 30_000;

export class WordPressError extends Error {
  constructor(
    message: string,
    readonly kind:
      | "auth"
      | "not_found"
      | "unreachable"
      | "rest_disabled"
      | "permission"
      | "unknown",
    readonly status?: number,
  ) {
    super(message);
    this.name = "WordPressError";
  }
}

export type WordPressCredentials = {
  /** Site root, e.g. "https://example.com". */
  siteUrl: string;
  username: string;
  /** Application Password, not the account password. */
  applicationPassword: string;
};

function authHeader(credentials: WordPressCredentials): string {
  // Application passwords are displayed with spaces for readability; the API
  // rejects them unless the spaces are stripped.
  const password = credentials.applicationPassword.replace(/\s+/g, "");
  return `Basic ${Buffer.from(`${credentials.username}:${password}`).toString("base64")}`;
}

function apiUrl(siteUrl: string, path: string): string {
  return `${siteUrl.replace(/\/+$/, "")}/wp-json/wp/v2${path}`;
}

async function request<T>(
  credentials: WordPressCredentials,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  /**
   * Re-validated on every call, not only when the integration is created. The
   * site URL is user-supplied and stored; without this check an attacker could
   * save an internal address and use our server as a proxy into our own
   * network on some later publish.
   */
  if (!isPublicWebsiteUrl(credentials.siteUrl)) {
    throw new WordPressError(
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
        ...init.headers,
        authorization: authHeader(credentials),
        "content-type": "application/json",
        accept: "application/json",
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new WordPressError("The site took too long to respond", "unreachable");
    }
    throw new WordPressError(
      error instanceof Error ? error.message : "Could not reach the site",
      "unreachable",
    );
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 401 || response.status === 403) {
    /**
     * WordPress returns 401 for bad credentials but ALSO for a correct
     * application password when the site sits behind another auth layer, so
     * the message names both causes rather than only blaming the password.
     */
    throw new WordPressError(
      "WordPress rejected the username or application password. Check both, and that the site is not behind extra HTTP authentication.",
      response.status === 403 ? "permission" : "auth",
      response.status,
    );
  }

  if (response.status === 404) {
    throw new WordPressError(
      "The WordPress REST API was not found at this address. Confirm the site URL, and that the REST API is not disabled by a plugin.",
      "rest_disabled",
      404,
    );
  }

  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const body = (await response.json()) as { message?: string };
      if (body.message) detail = body.message;
    } catch {
      // Body was not JSON; the status alone is the best available message.
    }
    throw new WordPressError(detail, "unknown", response.status);
  }

  // A 204 or empty body is valid for some endpoints.
  const text = await response.text();
  return (text ? JSON.parse(text) : null) as T;
}

/** Site name and tagline from the REST root. Display text only. */
async function fetchSiteInfo(
  credentials: WordPressCredentials,
): Promise<{ name?: string; description?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(
      `${credentials.siteUrl.replace(/\/+$/, "")}/wp-json`,
      { signal: controller.signal, headers: { accept: "application/json" } },
    );
    if (!response.ok) return {};
    return (await response.json()) as { name?: string; description?: string };
  } finally {
    clearTimeout(timer);
  }
}

export type ConnectionInfo = {
  name: string;
  description: string;
  userLogin: string;
  canPublish: boolean;
};

/**
 * Verifies credentials before they are stored.
 *
 * Checks that the user can actually create posts, not merely that the password
 * works: a Subscriber-role account authenticates fine and then fails on every
 * publish, which would be discovered much later and look like our bug.
 */
export async function testConnection(
  credentials: WordPressCredentials,
): Promise<ConnectionInfo> {
  const me = await request<{
    name?: string;
    slug?: string;
    capabilities?: Record<string, boolean>;
  }>(credentials, "/users/me?context=edit");

  /**
   * Site name and tagline live at /wp-json (one level above /wp/v2), so this
   * is fetched separately. Failure is tolerated: it is display text only, and
   * the credential check above is what actually matters.
   */
  const site: { name?: string; description?: string } =
    await fetchSiteInfo(credentials).catch(() => ({}));

  const canPublish = Boolean(
    me.capabilities?.publish_posts ?? me.capabilities?.edit_posts,
  );

  if (!canPublish) {
    throw new WordPressError(
      "That WordPress user cannot publish posts. Use an account with the Author, Editor or Administrator role.",
      "permission",
    );
  }

  return {
    name: site.name ?? credentials.siteUrl,
    description: site.description ?? "",
    userLogin: me.slug ?? me.name ?? credentials.username,
    canPublish,
  };
}

export type PublishInput = {
  title: string;
  contentHtml: string;
  /** WordPress derives one from the title when omitted. */
  slug?: string | null;
  excerpt?: string | null;
  /** "publish" makes it live; "draft" leaves it for review. */
  status: "publish" | "draft";
};

export type PublishResult = {
  remoteId: string;
  remoteUrl: string;
  status: string;
};

export async function publishPost(
  credentials: WordPressCredentials,
  input: PublishInput,
): Promise<PublishResult> {
  const post = await request<{
    id: number;
    link: string;
    status: string;
  }>(credentials, "/posts", {
    method: "POST",
    body: JSON.stringify({
      title: input.title,
      content: input.contentHtml,
      status: input.status,
      ...(input.slug ? { slug: input.slug } : {}),
      ...(input.excerpt ? { excerpt: input.excerpt } : {}),
    }),
  });

  return {
    remoteId: String(post.id),
    remoteUrl: post.link,
    status: post.status,
  };
}

/** Updates a post we published earlier, identified by its WordPress id. */
export async function updatePost(
  credentials: WordPressCredentials,
  remoteId: string,
  input: PublishInput,
): Promise<PublishResult> {
  const post = await request<{ id: number; link: string; status: string }>(
    credentials,
    `/posts/${encodeURIComponent(remoteId)}`,
    {
      method: "POST",
      body: JSON.stringify({
        title: input.title,
        content: input.contentHtml,
        status: input.status,
        ...(input.excerpt ? { excerpt: input.excerpt } : {}),
      }),
    },
  );

  return {
    remoteId: String(post.id),
    remoteUrl: post.link,
    status: post.status,
  };
}
