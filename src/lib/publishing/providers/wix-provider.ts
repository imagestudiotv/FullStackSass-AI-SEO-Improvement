import { remoteHash } from "@/lib/publishing/remote-hash";
import {
  ProviderError,
  type RemoteBaseline,
  type RemoteState,
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
      // The API key stays with the API host: never follow a redirect with it.
      redirect: "error",
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
type WixDraft = { title?: string; excerpt?: string; editedDate?: string; richContent?: unknown };

/**
 * The draft as Wix holds it; null when it is gone. The hash is of what this read
 * returns, and the baseline comes from this read too, never from a write's
 * answer. editedDate is what Wix's reference has listed for the last edit, but it
 * is not relied on: with no date, only the hash can show a post unchanged.
 */
async function readDraft(credentials: Credentials, remoteId: string): Promise<RemoteState | null> {
  try {
    const body = await request<{ draftPost?: WixDraft; post?: WixDraft }>(credentials, `/blog/v3/draft-posts/${encodeURIComponent(remoteId)}?fieldsets=RICH_CONTENT`);
    const draft = body.draftPost ?? body.post;
    if (!draft) return null;
    return {
      modifiedAt: draft.editedDate ?? null,
      hash: draft.richContent ? remoteHash([draft.title, draft.excerpt, draft.richContent]) : null,
      status: null,
      rawContent: null,
    };
  } catch (error) {
    if (error instanceof ProviderError && error.status === 404) return null;
    throw error;
  }
}

/** After a send: never fails it. Without this the next update has only the send's time to go by. */
async function baselineAfterSend(credentials: Credentials, remoteId: string): Promise<RemoteBaseline | undefined> {
  const state = await readDraft(credentials, remoteId).catch(() => null);
  return state ? { modifiedAt: state.modifiedAt, hash: state.hash } : undefined;
}

export const wixProvider: CmsProvider = {
  id: "wix",
  name: "Wix",
  description: "Publish to the blog on your Wix site.",
  // Wix moved this from /getting-started/ to /get-started/; the old path 404s.
  helpUrl: "https://dev.wix.com/docs/rest/articles/get-started/api-keys",
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
    // Create Draft Post answers { draftPost }, not { post }, and takes the address as seoSlug.
    const created = await request<{ draftPost?: WixPost }>(
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
            ...(input.slug ? { seoSlug: input.slug } : {}),
          },
        }),
      },
    );

    const id = created.draftPost?.id;
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
      remoteUrl: created.draftPost?.url?.path ?? "",
      status: input.status,
      baseline: await baselineAfterSend(credentials, id),
    };
  },

  /**
   * No precondition that this code can rely on, so this is read before writing,
   * and the update can still land on a save made in between
   * (lib/publishing/overwrite-guard.ts).
   */
  readRemote: readDraft,

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

    return { remoteId, remoteUrl: "", status: input.status, baseline: await baselineAfterSend(credentials, remoteId) };
  },
};
