import {
  ProviderError,
  type CmsProvider,
  type Credentials,
  type PublishInput,
} from "@/lib/publishing/provider";

/**
 * Wix.
 *
 * Authenticated with an API key rather than OAuth, which keeps setup to two
 * values the customer can copy. Two Wix-specific details drive the shape here:
 *
 *  - Every request needs `wix-site-id` alongside the key. An API key belongs
 *    to an account, which may own several sites, so the key alone is ambiguous
 *    and Wix rejects the call rather than guessing.
 *  - The Blog API takes rich content as Ricos JSON, not HTML. Converting our
 *    articles to Ricos faithfully would mean reimplementing a document model;
 *    instead each post is sent as a single HTML block, which Wix renders
 *    intact. Headings, lists and links survive; the editor shows one embedded
 *    block rather than native paragraphs.
 */

const API = "https://www.wixapis.com";
const TIMEOUT_MS = 30_000;

async function request<T>(
  credentials: Credentials,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${API}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        authorization: credentials.apiKey,
        "wix-site-id": credentials.siteId,
        "content-type": "application/json",
        ...init?.headers,
      },
    });
  } catch {
    throw new ProviderError(
      "Could not reach Wix. Check your connection and try again.",
      "unreachable",
    );
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 401) {
    throw new ProviderError(
      "Wix rejected the API key. Check it was copied in full and has not been revoked.",
      "auth",
      401,
    );
  }
  if (response.status === 403) {
    throw new ProviderError(
      "That API key cannot manage the blog. Give its role the Blog permissions in the Wix dashboard.",
      "permission",
      403,
    );
  }
  if (response.status === 404) {
    throw new ProviderError(
      "Wix could not find that site, or the site has no blog. Check the Site ID and that the Blog app is installed.",
      "not_found",
      404,
    );
  }
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new ProviderError(
      `Wix returned ${response.status}. ${body.slice(0, 160)}`.trim(),
      "unknown",
      response.status,
    );
  }

  // DELETE and some PATCH calls return an empty body.
  const text = await response.text();
  return (text ? JSON.parse(text) : {}) as T;
}

/**
 * Wraps HTML in the minimal Ricos document Wix accepts.
 *
 * A single HTML node rather than a converted tree: see the note at the top of
 * this file. Wix renders the markup as-is, so formatting survives even though
 * the editor treats it as one block.
 */
function ricosFromHtml(html: string) {
  return {
    nodes: [
      {
        type: "HTML",
        id: "body",
        nodes: [],
        htmlData: { html },
      },
    ],
  };
}

type WixPost = { id?: string; url?: { path?: string }; title?: string };

export const wixProvider: CmsProvider = {
  id: "wix",
  name: "Wix",
  description: "Publish to the blog on your Wix site.",
  helpUrl: "https://dev.wix.com/docs/rest/articles/getting-started/api-keys",
  fields: [
    {
      key: "apiKey",
      label: "API key",
      help: "Wix dashboard → Settings → API keys. Give the key a role that includes Blog permissions.",
      secret: true,
    },
    {
      key: "siteId",
      label: "Site ID",
      help: "Shown beside the site in the API keys screen. An account can own several sites, so Wix needs to know which.",
      placeholder: "12a3b456-7c89-0d12-e345-f6789abc0def",
    },
  ],

  async testConnection(credentials: Credentials) {
    /**
     * Listing posts proves three things at once: the key is valid, it can see
     * this site, and the Blog app is installed. A key that merely authenticates
     * would pass a shallower check and then fail at the first publish.
     */
    const result = await request<{ posts?: WixPost[] }>(
      credentials,
      "/blog/v3/posts/query",
      {
        method: "POST",
        body: JSON.stringify({ query: { paging: { limit: 1 } } }),
      },
    );

    return {
      siteName: "Wix blog",
      // Wix returns no site name on this endpoint, and the id the customer
      // already typed is not worth echoing back as if we learned it.
      accountLabel:
        result.posts && result.posts.length > 0
          ? `${result.posts.length} existing post found`
          : "No posts yet",
    };
  },

  async createPost(credentials: Credentials, input: PublishInput) {
    const created = await request<{ post?: WixPost }>(
      credentials,
      "/blog/v3/draft-posts",
      {
        method: "POST",
        body: JSON.stringify({
          draftPost: {
            title: input.title,
            excerpt: input.excerpt ?? undefined,
            richContent: ricosFromHtml(input.contentHtml),
            /**
             * Wix creates a draft either way; publishing is a separate call.
             * Doing it in two steps means a failure to publish still leaves the
             * article saved rather than losing it entirely.
             */
            ...(input.slug ? { slugs: [input.slug] } : {}),
          },
        }),
      },
    );

    const id = created.post?.id;
    if (!id) {
      throw new ProviderError(
        "Wix accepted the post but returned no id, so it cannot be updated later.",
        "unknown",
      );
    }

    if (input.status === "publish") {
      await request(credentials, `/blog/v3/draft-posts/${id}/publish`, {
        method: "POST",
      });
    }

    return {
      remoteId: id,
      remoteUrl: created.post?.url?.path ?? "",
      status: input.status,
    };
  },

  async updatePost(
    credentials: Credentials,
    remoteId: string,
    input: PublishInput,
  ) {
    await request(credentials, `/blog/v3/draft-posts/${remoteId}`, {
      method: "PATCH",
      body: JSON.stringify({
        draftPost: {
          title: input.title,
          excerpt: input.excerpt ?? undefined,
          richContent: ricosFromHtml(input.contentHtml),
        },
      }),
    });

    if (input.status === "publish") {
      await request(credentials, `/blog/v3/draft-posts/${remoteId}/publish`, {
        method: "POST",
      });
    }

    return { remoteId, remoteUrl: "", status: input.status };
  },
};
