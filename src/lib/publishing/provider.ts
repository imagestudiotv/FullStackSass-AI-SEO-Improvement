/**
 * The contract every CMS adapter implements.
 *
 * Publishing was written for WordPress and only WordPress: the kind was
 * hardcoded in five places, credentials were a WordPress-shaped object, and the
 * UI was a WordPress panel. Adding a second CMS by copying that would double
 * the surface and guarantee the two drift apart.
 *
 * So a provider is a small, closed interface: describe your fields, verify a
 * connection, create a post, update a post. Everything a CMS does beyond that
 * — taxonomies, collections, product pages — stays inside its own adapter.
 *
 * Credentials are WRITE access to a customer's live website. They are
 * encrypted before storage and never returned to the client, so a provider
 * declares which of its fields are secret and the storage layer handles the
 * rest without needing to know what the field means.
 */

/** Stable identifier, stored in integrations.kind. Never change one in place. */
export type ProviderId = "wordpress" | "ghost" | "shopify" | "webhook";

/**
 * One credential a provider needs.
 *
 * Described rather than hardcoded so the connect form renders itself from the
 * provider, and adding a CMS does not mean writing another form.
 */
export type CredentialField = {
  key: string;
  label: string;
  /** Shown under the field. Say where to find the value, not what it is. */
  help?: string;
  placeholder?: string;
  /** Encrypted at rest, masked in the UI, never sent back to the client. */
  secret?: boolean;
  /** A URL field is validated and normalised before it is stored. */
  url?: boolean;
};

/** What a successful connection test learned about the account. */
export type ConnectionInfo = {
  /** Site or shop name, so the customer can confirm which account is linked. */
  siteName: string;
  /** The connected account, where the platform exposes one. */
  accountLabel: string | null;
};

export type PublishInput = {
  title: string;
  contentHtml: string;
  slug: string | null;
  excerpt: string | null;
  /** "publish" makes it live; "draft" leaves it for review. */
  status: "publish" | "draft";
  /** Provider-specific id of an uploaded image, when one was uploaded. */
  featuredMediaId?: string | null;
};

export type PublishResult = {
  /** The platform's own id, needed to update the post later. */
  remoteId: string;
  /** Public URL, when the platform returns one. */
  remoteUrl: string;
  /** Echoed back: a platform may downgrade a publish to a draft. */
  status: string;
};

/** An uploaded image, as the platform refers to it afterwards. */
export type UploadedMedia = {
  id: string;
  url: string;
};

/**
 * Errors a provider raises.
 *
 * `kind` drives the message the customer sees. A wrong password and an
 * unreachable site both fail, but they need completely different advice, and
 * "publish failed" tells nobody anything.
 */
export type ProviderErrorKind =
  | "auth"
  | "permission"
  | "not_found"
  | "unreachable"
  /**
   * The platform is reachable but its publishing API is not available —
   * WordPress with the REST API disabled by a plugin, or a Shopify app without
   * the blog scope. Kept distinct from "not_found" because the fix is entirely
   * different: the customer changes a setting rather than a URL.
   */
  | "api_disabled"
  | "unsupported"
  | "unknown";

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly kind: ProviderErrorKind,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

/** Decrypted credentials, keyed by the provider's own field names. */
export type Credentials = Record<string, string>;

export type CmsProvider = {
  id: ProviderId;
  /** Shown in the UI. */
  name: string;
  /** One line on what connecting does, in the customer's terms. */
  description: string;
  /** Where the customer finds these values, as a real help URL. */
  helpUrl?: string;
  fields: CredentialField[];

  /**
   * Verifies credentials before they are stored.
   *
   * Must check that the account can actually CREATE posts, not merely that it
   * authenticates: a read-only token authenticates fine and then fails on
   * every publish, which surfaces much later and looks like our bug.
   */
  testConnection(credentials: Credentials): Promise<ConnectionInfo>;

  createPost(
    credentials: Credentials,
    input: PublishInput,
  ): Promise<PublishResult>;

  updatePost(
    credentials: Credentials,
    remoteId: string,
    input: PublishInput,
  ): Promise<PublishResult>;

  /**
   * Uploads an image, when the platform supports it.
   *
   * Optional: a provider that cannot take media simply omits this, and
   * publishing proceeds without a header image rather than failing.
   */
  uploadMedia?(
    credentials: Credentials,
    file: { data: Buffer; contentType: string; filename: string; alt: string },
  ): Promise<UploadedMedia>;
};
