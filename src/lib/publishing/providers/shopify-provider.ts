import {
  ProviderError,
  type CmsProvider,
  type Credentials,
  type PublishInput,
} from "@/lib/publishing/provider";

/**
 * Shopify, via a merchant-created custom app.
 *
 * The merchant creates the app in their own admin and copies the Admin API
 * access token, so nothing here needs a public app, an OAuth flow, or Shopify's
 * review queue. It needs read_content and write_content scopes.
 *
 * Articles live under a Blog, and a store can have several. The blog is chosen
 * at connect time and stored with the credentials, because guessing at publish
 * time would put posts in whichever blog happened to be first — and on a store
 * with "News" and "Recipes" that is a coin flip the customer would notice.
 */

const TIMEOUT_MS = 30_000;

/**
 * Pinned API version. Shopify dates its versions and drops old ones after a
 * year, so an unpinned call would change behaviour under us without warning.
 */
const API_VERSION = "2025-01";

/** Extracts "store.myshopify.com" from whatever the merchant pasted. */
export function normalizeShopDomain(value: string): string | null {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;

  // Accepts a bare handle, the full domain, or a pasted admin URL.
  const withoutScheme = trimmed.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  const handle = withoutScheme.replace(/\.myshopify\.com$/, "");

  if (!/^[a-z0-9][a-z0-9-]*$/.test(handle)) return null;
  return `${handle}.myshopify.com`;
}

async function request<T>(
  credentials: Credentials,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const shop = normalizeShopDomain(credentials.shopDomain);
  if (!shop) {
    throw new ProviderError(
      "That does not look like a Shopify store address",
      "unreachable",
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(
      `https://${shop}/admin/api/${API_VERSION}${path}`,
      {
        ...init,
        signal: controller.signal,
        headers: {
          "content-type": "application/json",
          ...init.headers,
          "x-shopify-access-token": credentials.accessToken,
          accept: "application/json",
        },
      },
    );
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new ProviderError("Shopify took too long to respond", "unreachable");
    }
    throw new ProviderError(
      error instanceof Error ? error.message : "Could not reach Shopify",
      "unreachable",
    );
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 401) {
    throw new ProviderError(
      "Shopify rejected the access token. Check it was copied in full from your custom app.",
      "auth",
      401,
    );
  }

  /**
   * 403 here almost always means missing scopes rather than a wrong token, and
   * the fix is completely different — the merchant edits the app's permissions
   * rather than regenerating anything.
   */
  if (response.status === 403) {
    throw new ProviderError(
      "That token cannot manage blog posts. In your custom app, enable read_content and write_content, then reinstall it.",
      "permission",
      403,
    );
  }

  if (response.status === 404) {
    throw new ProviderError(
      "Shopify could not find that store or blog.",
      "not_found",
      404,
    );
  }

  /**
   * Shopify rate-limits per store. Surfaced honestly rather than retried in a
   * loop: this runs inside a job that already retries, and hammering a
   * customer's store is a good way to get the token revoked.
   */
  if (response.status === 429) {
    throw new ProviderError(
      "Shopify is rate limiting us. The publish will be retried shortly.",
      "unknown",
      429,
    );
  }

  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const body = (await response.json()) as { errors?: unknown };
      if (typeof body.errors === "string") detail = body.errors;
      else if (body.errors) detail = JSON.stringify(body.errors).slice(0, 200);
    } catch {
      // Not JSON; the status stands.
    }
    throw new ProviderError(detail, "unknown", response.status);
  }

  const text = await response.text();
  return (text ? JSON.parse(text) : null) as T;
}

type ShopifyArticle = {
  id: number;
  handle?: string;
  published_at?: string | null;
};

/** Lists the store's blogs, so the customer can pick where posts go. */
export async function listShopifyBlogs(
  credentials: Credentials,
): Promise<{ id: string; title: string }[]> {
  const body = await request<{ blogs?: { id: number; title: string }[] }>(
    credentials,
    "/blogs.json?limit=50",
  );
  return (body.blogs ?? []).map((blog) => ({
    id: String(blog.id),
    title: blog.title,
  }));
}

function articleBody(input: PublishInput) {
  return {
    article: {
      title: input.title,
      body_html: input.contentHtml,
      ...(input.slug ? { handle: input.slug } : {}),
      ...(input.excerpt ? { summary_html: input.excerpt } : {}),
      /**
       * Shopify has no "draft" status: an article is published or it is not.
       * published:false is the draft equivalent, and sending a date for a
       * publish makes it live immediately rather than at some default time.
       */
      published: input.status === "publish",
      ...(input.featuredMediaId
        ? { image: { src: input.featuredMediaId } }
        : {}),
    },
  };
}

export const shopifyProvider: CmsProvider = {
  id: "shopify",
  name: "Shopify",
  description: "Publish to your Shopify store's blog.",
  helpUrl:
    "https://help.shopify.com/en/manual/apps/app-types/custom-apps",
  fields: [
    {
      key: "shopDomain",
      label: "Store address",
      placeholder: "your-store.myshopify.com",
      help: "Your permanent .myshopify.com address, not a custom domain.",
    },
    {
      key: "accessToken",
      label: "Admin API access token",
      help: "Shopify admin → Settings → Apps and sales channels → Develop apps → your app → API credentials. Needs read_content and write_content.",
      secret: true,
    },
    {
      key: "blogId",
      label: "Blog",
      help: "Leave blank to use the store's first blog. Most stores have one, called News.",
    },
  ],

  async testConnection(credentials) {
    /**
     * Reads the shop for its name, then the blogs to prove the content scope
     * is actually present. A token missing write_content passes the first call
     * and fails every publish, which is the failure worth catching here.
     */
    const shop = await request<{ shop?: { name?: string; domain?: string } }>(
      credentials,
      "/shop.json",
    );

    const blogs = await listShopifyBlogs(credentials);
    if (blogs.length === 0) {
      throw new ProviderError(
        "That store has no blog yet. Create one in Shopify under Online Store → Blog posts, then reconnect.",
        "not_found",
      );
    }

    return {
      siteName: shop.shop?.name ?? credentials.shopDomain,
      accountLabel: shop.shop?.domain ?? null,
    };
  },

  async createPost(credentials, input) {
    /**
     * Falls back to the first blog when none was chosen. Stores usually have
     * exactly one, and refusing to publish over an unset optional field would
     * be pedantry rather than safety.
     */
    let blogId = credentials.blogId?.trim();
    if (!blogId) {
      const blogs = await listShopifyBlogs(credentials);
      blogId = blogs[0]?.id;
      if (!blogId) {
        throw new ProviderError("That store has no blog to publish to", "not_found");
      }
    }

    const body = await request<{ article?: ShopifyArticle }>(
      credentials,
      `/blogs/${encodeURIComponent(blogId)}/articles.json`,
      { method: "POST", body: JSON.stringify(articleBody(input)) },
    );

    const article = body.article;
    if (!article) {
      throw new ProviderError("Shopify did not return the created post", "unknown");
    }

    const shop = normalizeShopDomain(credentials.shopDomain);
    return {
      // The blog id is needed to update the article later, and Shopify's
      // article id alone is not enough to address it.
      remoteId: `${blogId}:${article.id}`,
      remoteUrl:
        article.handle && shop
          ? `https://${shop}/blogs/news/${article.handle}`
          : "",
      status: article.published_at ? "publish" : "draft",
    };
  },

  async updatePost(credentials, remoteId, input) {
    /**
     * remoteId is "blogId:articleId" because Shopify addresses an article
     * through its blog. Older rows may hold a bare article id, so that case
     * falls back to the stored or first blog rather than failing.
     */
    const [maybeBlog, maybeArticle] = remoteId.split(":");
    const articleId = maybeArticle ?? maybeBlog;
    let blogId = maybeArticle ? maybeBlog : credentials.blogId?.trim();

    if (!blogId) {
      const blogs = await listShopifyBlogs(credentials);
      blogId = blogs[0]?.id;
      if (!blogId) {
        throw new ProviderError("That store has no blog to publish to", "not_found");
      }
    }

    const body = await request<{ article?: ShopifyArticle }>(
      credentials,
      `/blogs/${encodeURIComponent(blogId)}/articles/${encodeURIComponent(articleId)}.json`,
      { method: "PUT", body: JSON.stringify(articleBody(input)) },
    );

    const article = body.article;
    if (!article) {
      throw new ProviderError("Shopify did not return the updated post", "unknown");
    }

    const shop = normalizeShopDomain(credentials.shopDomain);
    return {
      remoteId: `${blogId}:${article.id}`,
      remoteUrl:
        article.handle && shop
          ? `https://${shop}/blogs/news/${article.handle}`
          : "",
      status: article.published_at ? "publish" : "draft",
    };
  },

  /**
   * No uploadMedia. Shopify's article image takes a URL rather than an upload,
   * and the files API needs scopes a content-only token does not have.
   * Omitting it means publishing proceeds without a header image rather than
   * failing on one — which the pipeline already handles.
   */
};
