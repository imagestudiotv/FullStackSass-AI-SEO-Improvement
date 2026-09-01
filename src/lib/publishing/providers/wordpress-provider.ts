import {
  publishPost,
  testConnection as testWordPress,
  updatePost,
  uploadMedia as uploadWordPressMedia,
  WordPressError,
  type WordPressCredentials,
} from "@/lib/publishing/wordpress";
import {
  ProviderError,
  type CmsProvider,
  type Credentials,
} from "@/lib/publishing/provider";

/**
 * WordPress, as a provider.
 *
 * The REST client underneath is unchanged — it was already correct, already
 * carried the SSRF guard and the useful error messages, and rewriting working
 * publishing code to fit a new interface would risk the one integration
 * customers already depend on. This is an adapter over it, nothing more.
 */

function toWordPress(credentials: Credentials): WordPressCredentials {
  return {
    siteUrl: credentials.siteUrl,
    username: credentials.username,
    applicationPassword: credentials.applicationPassword,
  };
}

/** Translates the existing error type into the shared one. */
function rethrow(error: unknown): never {
  if (error instanceof WordPressError) {
    // "rest_disabled" is WordPress's name for the shared "api_disabled" case.
    const kind = error.kind === "rest_disabled" ? "api_disabled" : error.kind;
    throw new ProviderError(error.message, kind, error.status);
  }
  throw error;
}

export const wordpressProvider: CmsProvider = {
  id: "wordpress",
  name: "WordPress",
  description: "Publish straight to your WordPress site.",
  helpUrl: "https://wordpress.org/documentation/article/application-passwords/",
  fields: [
    {
      key: "siteUrl",
      label: "Website address",
      placeholder: "https://example.com",
      url: true,
    },
    {
      key: "username",
      label: "WordPress username",
      help: "The account you log in with. It needs the Author role or higher.",
    },
    {
      key: "applicationPassword",
      label: "Application password",
      help: "Users → Profile → Application Passwords in your WordPress admin. Not your login password.",
      secret: true,
    },
  ],

  async testConnection(credentials) {
    try {
      const info = await testWordPress(toWordPress(credentials));
      return { siteName: info.name, accountLabel: info.userLogin };
    } catch (error) {
      rethrow(error);
    }
  },

  async createPost(credentials, input) {
    try {
      const result = await publishPost(toWordPress(credentials), {
        ...input,
        // WordPress media ids are numeric; the shared interface uses strings.
        featuredMediaId: input.featuredMediaId
          ? Number(input.featuredMediaId)
          : null,
      });
      return result;
    } catch (error) {
      rethrow(error);
    }
  },

  async updatePost(credentials, remoteId, input) {
    try {
      return await updatePost(toWordPress(credentials), remoteId, {
        ...input,
        featuredMediaId: input.featuredMediaId
          ? Number(input.featuredMediaId)
          : null,
      });
    } catch (error) {
      rethrow(error);
    }
  },

  async uploadMedia(credentials, file) {
    try {
      const media = await uploadWordPressMedia(toWordPress(credentials), file);
      return { id: String(media.id), url: media.url };
    } catch (error) {
      rethrow(error);
    }
  },
};
