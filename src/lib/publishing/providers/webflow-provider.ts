import {
  ProviderError,
  type CmsProvider,
  type Credentials,
  type PublishInput,
} from "@/lib/publishing/provider";

/**
 * Webflow.
 *
 * Webflow has no "posts" concept: a blog is a CMS COLLECTION the designer
 * created, and its fields are whatever they named them. So connecting needs
 * the collection id as well as a token, and publishing has to map our article
 * onto field slugs we do not control.
 *
 * Two things about that mapping are worth stating, because both produce
 * confusing failures otherwise:
 *
 *  - `name` and `slug` are the only fields Webflow guarantees on every
 *    collection. Everything else — the body, the summary — is site-specific,
 *    so we look at the collection's schema and use the first rich-text field
 *    we find rather than assuming a name like "post-body".
 *  - An item created through the API is a DRAFT until the site is published.
 *    We create it live where we can, but a customer whose site has unpublished
 *    changes will not see it until they publish in Webflow. Saying so beats
 *    them concluding we lost the article.
 */

const API = "https://api.webflow.com/v2";
const TIMEOUT_MS = 30_000;

type WebflowField = { slug: string; type: string; displayName?: string };

async function request<T>(
  token: string,
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
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        accept: "application/json",
        ...init?.headers,
      },
    });
  } catch {
    throw new ProviderError(
      "Could not reach Webflow. Check your connection and try again.",
      "unreachable",
    );
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 401) {
    throw new ProviderError(
      "Webflow rejected the token. Create a new Site API token with CMS read and write access.",
      "auth",
      401,
    );
  }
  if (response.status === 403) {
    throw new ProviderError(
      "That token cannot write to the CMS. Its scopes must include cms:write.",
      "permission",
      403,
    );
  }
  if (response.status === 404) {
    throw new ProviderError(
      "Webflow could not find that collection. Check the collection id.",
      "not_found",
      404,
    );
  }
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new ProviderError(
      `Webflow returned ${response.status}. ${body.slice(0, 160)}`.trim(),
      "unknown",
      response.status,
    );
  }

  return (await response.json()) as T;
}

/**
 * Finds the field slugs to write into.
 *
 * Collections are user-defined, so the body field could be called anything.
 * The first RichText field is the body; the first PlainText field that is not
 * the name is treated as the summary. Guessing wrong here writes the article
 * into the wrong box, which is why this reads the schema rather than assuming.
 */
async function resolveFields(
  token: string,
  collectionId: string,
): Promise<{ body: string | null; summary: string | null }> {
  const collection = await request<{ fields?: WebflowField[] }>(
    token,
    `/collections/${collectionId}`,
  );

  const fields = collection.fields ?? [];
  const body =
    fields.find((field) => field.type === "RichText")?.slug ?? null;
  const summary =
    fields.find(
      (field) =>
        field.type === "PlainText" &&
        field.slug !== "name" &&
        field.slug !== "slug",
    )?.slug ?? null;

  return { body, summary };
}

/** Builds the fieldData payload from whatever the collection actually has. */
async function buildFieldData(
  token: string,
  collectionId: string,
  input: PublishInput,
): Promise<Record<string, unknown>> {
  const { body, summary } = await resolveFields(token, collectionId);

  const fieldData: Record<string, unknown> = {
    name: input.title,
    // Webflow derives one when omitted, but ours is already SEO-checked.
    slug: input.slug ?? undefined,
  };

  if (body) fieldData[body] = input.contentHtml;
  if (summary && input.excerpt) fieldData[summary] = input.excerpt;

  return fieldData;
}

export const webflowProvider: CmsProvider = {
  id: "webflow",
  name: "Webflow",
  description: "Publish into a CMS collection on your Webflow site.",
  helpUrl: "https://developers.webflow.com/data/reference/token/authorization",
  fields: [
    {
      key: "apiToken",
      label: "Site API token",
      help: "Webflow → Site settings → Apps & integrations → API access. It needs CMS read and write.",
      secret: true,
    },
    {
      key: "collectionId",
      label: "Blog collection ID",
      help: "Open the collection in the Designer; the id is the last part of the URL.",
      placeholder: "580e63fc8c9a982ac9b8b745",
    },
  ],

  async testConnection(credentials: Credentials) {
    const token = credentials.apiToken;
    const collectionId = credentials.collectionId;

    // Verified before use: the collection call below returns 404 for both a
    // wrong id and a token that cannot see it, which is ambiguous on its own.
    const collection = await request<{
      displayName?: string;
      fields?: WebflowField[];
    }>(token, `/collections/${collectionId}`);

    /**
     * A collection with no rich-text field cannot hold an article. Catching it
     * now is far better than a successful "publish" that silently drops the
     * body — which looks like our bug and is discovered days later.
     */
    const hasBody = (collection.fields ?? []).some(
      (field) => field.type === "RichText",
    );
    if (!hasBody) {
      throw new ProviderError(
        "That collection has no rich text field, so there is nowhere to put the article body. Add one in the Designer, or pick your blog collection.",
        "unsupported",
      );
    }

    return {
      siteName: collection.displayName ?? "Webflow collection",
      accountLabel: null,
    };
  },

  async createPost(credentials: Credentials, input: PublishInput) {
    const token = credentials.apiToken;
    const collectionId = credentials.collectionId;
    const fieldData = await buildFieldData(token, collectionId, input);

    const created = await request<{ id: string; fieldData?: { slug?: string } }>(
      token,
      `/collections/${collectionId}/items`,
      {
        method: "POST",
        body: JSON.stringify({
          isArchived: false,
          // Webflow's own draft flag, so "draft" here means draft there.
          isDraft: input.status === "draft",
          fieldData,
        }),
      },
    );

    return {
      remoteId: created.id,
      /**
       * Webflow returns no public URL: the live address depends on the
       * collection's page template and whether the site has been published.
       * An empty string is honest; inventing a URL that 404s is not.
       */
      remoteUrl: "",
      status: input.status,
    };
  },

  async updatePost(
    credentials: Credentials,
    remoteId: string,
    input: PublishInput,
  ) {
    const token = credentials.apiToken;
    const collectionId = credentials.collectionId;
    const fieldData = await buildFieldData(token, collectionId, input);

    await request(token, `/collections/${collectionId}/items/${remoteId}`, {
      method: "PATCH",
      body: JSON.stringify({
        isArchived: false,
        isDraft: input.status === "draft",
        fieldData,
      }),
    });

    return { remoteId, remoteUrl: "", status: input.status };
  },
};
