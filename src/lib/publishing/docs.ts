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
    /**
     * The plugin, listed FIRST and before the application-password route.
     *
     * Both connect a WordPress site and a customer only needs one, so the
     * order is a recommendation. The plugin is the one that works when the
     * other does not: a host that blocks the REST API, a site behind a
     * firewall, a security plugin that has locked things down - exactly the
     * cases where application passwords fail, and fail confusingly.
     *
     * It also means we never hold a credential for their site. The plugin
     * PULLS; nothing is pushed in from outside.
     *
     * This guide existed only as CONNECT-GUIDE.txt at the root of the repo -
     * complete, carefully written, and reachable by nobody. A customer
     * installing the plugin had the download button and no instructions.
     */
    slug: "wordpress-plugin",
    name: "WordPress plugin",
    summary:
      "Publish to WordPress with our plugin. Works when the REST API is blocked, and we never hold a password to your site.",
    requirements: [
      "A self-hosted WordPress site (wordpress.org, not a free wordpress.com plan)",
      "WordPress 5.6 or newer, and PHP 7.4 or newer",
      "An administrator account on the WordPress site - editors and authors cannot see the settings page",
      "An active plan for this website in RepGet",
    ],
    steps: [
      {
        title: "Download the plugin from RepGet",
        body: "Open Websites → your site → Integrations and find the WordPress plugin panel. Press Download the plugin. This saves repget-connector.zip, about 6 KB. LEAVE IT ZIPPED - do not unpack it, and do not open it first. Some browsers unpack a zip automatically on download, which is the single most common reason the install then fails.",
      },
      {
        title: "Create an integration key",
        body: "In the same panel, press New key and give it a name you will recognise, such as Main site. The key is shown ONCE and stored only as a hash, so there is genuinely no way to look it up later - copy it now. If you lose it, revoke it and make another; nothing is lost by doing that.",
      },
      {
        title: "Upload the plugin to WordPress",
        body: "In your WordPress admin, go to Plugins → Add New Plugin → Upload Plugin. Choose the repget-connector.zip file exactly as it downloaded, press Install Now, then Activate Plugin.",
      },
      {
        title: "Open Settings → RepGet",
        body: "It lives under Settings rather than as its own top-level menu item, which is where most people look first. Only administrators can see this page, because the key controls what gets published to the site.",
      },
      {
        title: "Paste the key and connect",
        body: "Put your integration key in the Integration Key field and press Save and connect. The Status row then shows a green tick and the name of the website the key belongs to.",
      },
      {
        title: "Check the website name is the right one",
        body: "If Status names a DIFFERENT website, the key belongs to another site in your RepGet workspace. Keys belong to one website, not to your whole account - go back and copy the key for the site you meant. This is the most common mistake when you manage several websites, and it is easy to miss because the connection genuinely succeeded.",
      },
      {
        title: "Fetch your first articles",
        body: "Press Check for articles now. It reports how many were published, for example \"3 articles published.\" Zero is a normal answer and does not mean anything is wrong - it means nothing is waiting yet. Articles arrive as ordinary published posts with the featured image set, and you can edit, unpublish or delete them like any other post.",
      },
    ],
    troubleshooting: [
      {
        problem: '"The package could not be installed"',
        fix: "The zip was unpacked and re-zipped somewhere along the way, which some browsers do automatically on download. Download it again and upload the file exactly as it arrives, without opening it first.",
      },
      {
        problem: '"The key was rejected. Check it was copied in full."',
        fix: "One message covers every cause deliberately, so that somebody guessing at keys learns nothing from the reply. Check three things in order: was the key copied IN FULL (a partial copy is by far the most common cause); is it still ACTIVE, or was it revoked in RepGet; and is it the key for THIS website rather than another site in your workspace.",
      },
      {
        problem: "I cannot see the Settings → RepGet page",
        fix: "You need an administrator account. Editors and authors cannot see it, because the key controls what gets published.",
      },
      {
        problem: "Articles are not appearing",
        fix: "Press Check for articles now and read what it reports. Confirm the Status row still says Connected. Then check in RepGet that the articles are actually finished - anything still marked Planned or Writing has not been written yet, so there is nothing for the plugin to fetch.",
      },
      {
        problem: "Articles arrive later than an hour after they are ready",
        fix: "The plugin checks hourly by itself, but WordPress's scheduler only runs when somebody visits your site - so on a quiet site the check happens late. That is how WordPress works rather than a fault. Press Check for articles now to fetch immediately, or ask your host to set up a real cron job if the timing matters to you.",
      },
      {
        problem: "I lost my key",
        fix: "Revoke the old one in RepGet and create a new one, then paste it into Settings → RepGet and save again. Nothing is lost by doing this, and the old key stops working the moment you revoke it.",
      },
    ],
  },
  {
    slug: "wordpress",
    name: "WordPress",
    summary:
      "Publish straight to a self-hosted WordPress site using an application password. No plugin to install - but see the plugin guide if your host blocks the REST API.",
    requirements: [
      "A self-hosted WordPress site (wordpress.org, not a free wordpress.com plan)",
      "An account on it with the Editor or Administrator role",
      "WordPress 5.6 or newer, which is when application passwords arrived",
    ],
    steps: [
      {
        title: "Open your WordPress profile",
        body: "Sign in to WordPress and go to Users → Profile. If you administer several accounts, use the one you want articles published under - the author shown on each post is this account.",
      },
      {
        title: "Create an application password",
        body: "Scroll to the bottom of that page, to Application Passwords. Type a name you will recognise later, such as SEO Platform, and press Add New Application Password.",
      },
      {
        title: "Copy the password exactly",
        body: "WordPress shows it once, in groups separated by spaces. Copy the whole thing including the spaces - it is not your login password, and your login password will not work here.",
      },
      {
        title: "Connect it here",
        body: "On your website page, open Publishing and choose WordPress. Enter your site address, your WordPress username, and the application password you just copied.",
      },
      {
        title: "Publish a test article",
        body: "Press Publish test article. We create a real draft on your site and hand back a link to it. If that works, scheduled articles will too - and the draft is safe to delete.",
      },
    ],
    troubleshooting: [
      {
        problem: "Application Passwords is missing from the profile page",
        fix: "The section is hidden when WordPress is not served over HTTPS, and on some managed hosts that disable it. Check the site loads on https:// first, then ask your host whether the REST API is enabled.",
      },
      {
        problem: '"Sorry, you are not allowed to create posts"',
        fix: "The account authenticates but cannot publish. Give it the Editor or Administrator role - Author is not enough for everything we do.",
      },
      {
        problem: "A security plugin blocks the connection",
        fix: "Wordfence, iThemes and similar plugins can block REST API requests. Allow /wp-json/wp/v2/ for authenticated requests, or allow our requests specifically.",
      },
    ],
    officialUrl:
      "https://developer.wordpress.org/advanced-administration/security/application-passwords/",
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
        body: "Take the Admin API key, not the Content API key. It looks like two values joined by a colon - copy the whole string including the colon. The Content key can only read, so it fails at the first publish.",
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
        fix: "Use the address of your Ghost admin, without a trailing path - https://example.com, not https://example.com/ghost.",
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
        fix: "The token is missing write_content. Reopen the app configuration, add it, and reinstall - changing scopes issues a new token.",
      },
    ],
    officialUrl:
      "https://help.shopify.com/en/manual/apps/app-types/custom-apps",
  },
  {
    slug: "webflow",
    name: "Webflow",
    summary:
      "Publish into a CMS collection on your Webflow site using a Site API token.",
    requirements: [
      "A Webflow site on a paid plan - the CMS API is not available on the free tier",
      "A CMS collection for your blog, with a rich text field for the body",
      "Permission to create API tokens on that site",
    ],
    steps: [
      {
        title: "Create a Site API token",
        body: "In Webflow, open Site settings → Apps & integrations → API access, then Generate API token. Give it CMS read and write - a read-only token connects fine and then fails at the first publish.",
      },
      {
        title: "Copy the token",
        body: "Webflow shows it once. Copy the whole value before closing the dialog.",
      },
      {
        title: "Find your blog collection ID",
        body: "Open the collection in the Designer. The id is the last part of the URL, a long string of letters and numbers.",
      },
      {
        title: "Connect it here",
        body: "Open Publishing on your website page, choose Webflow, and enter the token and collection id. We check the collection has somewhere to put an article body before accepting it.",
      },
      {
        title: "Publish a test article",
        body: "Press Publish test article. We create a real item in the collection so you can confirm it lands where you expect.",
      },
    ],
    troubleshooting: [
      {
        problem: '"That collection has no rich text field"',
        fix: "Webflow collections are whatever the designer built, and an article needs somewhere to put its body. Add a Rich Text field to the collection, or point us at your blog collection rather than another one.",
      },
      {
        problem: "The article does not appear on the live site",
        fix: "Webflow items created through the API only go live once the site is published. Press Publish in the Designer, or turn on auto-publishing for the collection.",
      },
      {
        problem: '"That token cannot write to the CMS"',
        fix: "The token was created without cms:write. Tokens cannot be edited after creation - generate a new one with both CMS scopes.",
      },
    ],
    officialUrl:
      "https://developers.webflow.com/data/reference/authentication/site-token",
  },
  {
    slug: "wix",
    name: "Wix",
    summary: "Publish to the blog on your Wix site using an API key.",
    requirements: [
      "A Wix site with the Blog app installed",
      "Owner or admin access, so you can create API keys",
    ],
    steps: [
      {
        title: "Open the API keys page",
        body: "In the Wix dashboard, go to Settings → API keys, then Generate API key.",
      },
      {
        title: "Give it blog permissions",
        body: "Assign a role that includes Blog - without it the key authenticates but cannot create posts.",
      },
      {
        title: "Copy the key and the Site ID",
        body: "The key is shown once. The Site ID is listed beside the site on the same screen. Both are needed: one Wix account can own several sites, so the key alone does not say which.",
      },
      {
        title: "Connect it here",
        body: "Open Publishing, choose Wix, and enter both values. We list your existing posts to confirm the key can reach the blog.",
      },
    ],
    troubleshooting: [
      {
        problem: '"Wix could not find that site, or the site has no blog"',
        fix: "Either the Site ID belongs to a different site, or the Blog app is not installed. Add Blog from the Wix App Market and try again.",
      },
      {
        problem: "The article body shows as one block in the editor",
        fix: "Expected. Wix stores rich content in its own format; we send the article as a single HTML block, which renders correctly on the published page but appears as one embedded element while editing.",
      },
    ],
    officialUrl: "https://dev.wix.com/docs/rest/articles/get-started/api-keys",
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
        body: "Every request carries an HMAC-SHA256 of the raw body, keyed with your signing secret. Compare it before trusting the payload - an endpoint that skips this will accept anything anyone posts to it.",
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
