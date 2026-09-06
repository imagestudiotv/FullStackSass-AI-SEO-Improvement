/**
 * Setup instructions for each publishing integration.
 *
 * The brief: "There is also an instruction page for each integration
 * separately". These sit on the marketing site rather than behind the login,
 * because the question they answer — "where do I get an application password"
 * — is usually asked by whoever administers the CMS, who may not be the person
 * with an account.
 *
 * Written per provider rather than generated from the field list. A field
 * labelled "Application password" tells someone what to type; it does not tell
 * them that WordPress hides that screen until they scroll past Profile, or that
 * the spaces in the generated value are safe to include. Those details are the
 * whole reason the page exists.
 */

export type IntegrationDoc = {
  /** Matches the provider id, so the URL and the connect form agree. */
  slug: string;
  name: string;
  /** One line for the index card. */
  summary: string;
  /** What the customer needs before they start. */
  requirements: string[];
  steps: { title: string; body: string }[];
  /** Things that go wrong, and what they mean. */
  troubleshooting: { problem: string; fix: string }[];
  /** The platform's own documentation. */
  officialUrl?: string;
};

export const INTEGRATION_DOCS: IntegrationDoc[] = [
  {
    slug: "wordpress",
    name: "WordPress",
    summary:
      "Publish straight to a self-hosted WordPress site using an application password.",
    requirements: [
      "A self-hosted WordPress site (wordpress.org, not a free wordpress.com plan)",
      "An account on it with the Editor or Administrator role",
      "WordPress 5.6 or newer, which is when application passwords arrived",
    ],
    steps: [
      {
        title: "Open your WordPress profile",
        body: "Sign in to WordPress and go to Users → Profile. If you administer several accounts, use the one you want articles published under — the author shown on each post is this account.",
      },
      {
        title: "Create an application password",
        body: "Scroll to the bottom of that page, to Application Passwords. Type a name you will recognise later, such as SEO Platform, and press Add New Application Password.",
      },
      {
        title: "Copy the password exactly",
        body: "WordPress shows it once, in groups separated by spaces. Copy the whole thing including the spaces — it is not your login password, and your login password will not work here.",
      },
      {
        title: "Connect it here",
        body: "On your website page, open Publishing and choose WordPress. Enter your site address, your WordPress username, and the application password you just copied.",
      },
      {
        title: "Publish a test article",
        body: "Press Publish test article. We create a real draft on your site and hand back a link to it. If that works, scheduled articles will too — and the draft is safe to delete.",
      },
    ],
    troubleshooting: [
      {
        problem: "Application Passwords is missing from the profile page",
        fix: "The section is hidden when WordPress is not served over HTTPS, and on some managed hosts that disable it. Check the site loads on https:// first, then ask your host whether the REST API is enabled.",
      },
      {
        problem: '"Sorry, you are not allowed to create posts"',
        fix: "The account authenticates but cannot publish. Give it the Editor or Administrator role — Author is not enough for everything we do.",
      },
      {
        problem: "A security plugin blocks the connection",
        fix: "Wordfence, iThemes and similar plugins can block REST API requests. Allow /wp-json/wp/v2/ for authenticated requests, or allow our requests specifically.",
      },
    ],
    officialUrl:
      "https://wordpress.org/documentation/article/application-passwords/",
  },
  {
    slug: "ghost",
    name: "Ghost",
    summary: "Publish to a Ghost blog using an Admin API key.",
    requirements: [
      "A Ghost site you administer, self-hosted or Ghost(Pro)",
      "Ghost 4.0 or newer",
    ],
    steps: [
      {
        title: "Open your integrations settings",
        body: "In Ghost admin, go to Settings → Advanced → Integrations.",
      },
      {
        title: "Add a custom integration",
        body: "Choose Add custom integration and name it SEO Platform. Ghost then shows a Content API key and an Admin API key.",
      },
      {
        title: "Copy the ADMIN API key",
        body: "Take the Admin API key, not the Content API key. It looks like two values joined by a colon — copy the whole string including the colon. The Content key can only read, so it fails at the first publish.",
      },
      {
        title: "Connect it here",
        body: "Open Publishing on your website page, choose Ghost, and enter your Ghost site address along with the Admin API key.",
      },
      {
        title: "Publish a test article",
        body: "Press Publish test article. We create a draft in Ghost and return a link to it.",
      },
    ],
    troubleshooting: [
      {
        problem: '"Invalid token" or 401 on connecting',
        fix: "Almost always the Content API key rather than the Admin one. The Admin key contains a colon; the Content key does not.",
      },
      {
        problem: "The site address is rejected",
        fix: "Use the address of your Ghost admin, without a trailing path — https://example.com, not https://example.com/ghost.",
      },
    ],
    officialUrl: "https://ghost.org/docs/admin-api/#token-authentication",
  },
  {
    slug: "shopify",
    name: "Shopify",
    summary: "Publish articles to a blog on your Shopify store.",
    requirements: [
      "A Shopify store you own or staff-administer",
      "Permission to create a custom app in that store",
      "At least one blog created under Online Store → Blog posts",
    ],
    steps: [
      {
        title: "Allow custom app development",
        body: "In Shopify admin, go to Settings → Apps and sales channels → Develop apps. If it is your first time, press Allow custom app development and confirm.",
      },
      {
        title: "Create the app",
        body: "Press Create an app, name it SEO Platform, then open Configuration → Admin API integration.",
      },
      {
        title: "Grant blog permissions",
        body: "Enable write_content and read_content. Those two cover creating and updating blog articles; nothing else is needed, and granting more than necessary is worth avoiding.",
      },
      {
        title: "Install and copy the token",
        body: "Press Install app, then reveal the Admin API access token. Shopify shows it once. It begins with shpat_.",
      },
      {
        title: "Connect it here",
        body: "Open Publishing, choose Shopify, and enter your store address (example.myshopify.com), the access token, and pick which blog to publish to.",
      },
    ],
    troubleshooting: [
      {
        problem: "No blogs appear in the list",
        fix: "Shopify stores start without one. Create a blog under Online Store → Blog posts → Manage blogs, then reconnect.",
      },
      {
        problem: '"Access denied" when publishing',
        fix: "The token is missing write_content. Reopen the app configuration, add it, and reinstall — changing scopes issues a new token.",
      },
    ],
    officialUrl:
      "https://help.shopify.com/en/manual/apps/app-types/custom-apps",
  },
  {
    slug: "webhook",
    name: "Custom (webhook)",
    summary:
      "Send finished articles to any endpoint you control, for platforms we do not support directly.",
    requirements: [
      "An HTTPS endpoint that accepts a POST with a JSON body",
      "Somewhere to store the signing secret so you can verify requests",
    ],
    steps: [
      {
        title: "Build an endpoint",
        body: "Accept POST with a JSON body carrying the title, HTML body, slug, excerpt and status. Reply 2xx once you have stored it; anything else is treated as a failure and retried.",
      },
      {
        title: "Connect it here",
        body: "Open Publishing, choose Custom (webhook), and enter the endpoint URL and a signing secret you generate.",
      },
      {
        title: "Verify the signature",
        body: "Every request carries an HMAC-SHA256 of the raw body, keyed with your signing secret. Compare it before trusting the payload — an endpoint that skips this will accept anything anyone posts to it.",
      },
      {
        title: "Publish a test article",
        body: "Press Publish test article to send one real payload, so you can confirm your handler parses it before any scheduled article arrives.",
      },
    ],
    troubleshooting: [
      {
        problem: "Requests are being retried",
        fix: "We treat any non-2xx response as a failure. Return 200 as soon as the payload is stored, and do slower work afterwards.",
      },
      {
        problem: "Signature never matches",
        fix: "Compute the HMAC over the RAW request body, before any JSON parsing. Re-serialising the object changes the bytes and the signature will never agree.",
      },
    ],
  },
];

export function getIntegrationDoc(slug: string): IntegrationDoc | null {
  return INTEGRATION_DOCS.find((doc) => doc.slug === slug) ?? null;
}
