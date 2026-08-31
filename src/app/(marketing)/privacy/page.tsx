import { LegalPage } from "../legal-page";

export const metadata = {
  title: "Privacy Policy",
  description:
    "What data AI SEO Platform collects, why, and how it is stored and protected.",
};

/**
 * Privacy policy.
 *
 * Required before Google will accept OAuth verification, and the analytics
 * scopes make that verification mandatory before real customers can connect
 * Search Console or Analytics.
 *
 * Every claim below describes what the code actually does — the Google scopes
 * really are read-only, credentials really are encrypted with AES-256-GCM, and
 * customer data really is scoped per organization. Nothing here is aspirational,
 * because a privacy policy that overstates the protections is worse than none.
 */
export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="31 August 2026">
      <p>
        This policy explains what information AI SEO Platform (&quot;we&quot;,
        &quot;the service&quot;) collects, why we collect it, and what we do
        with it. It applies to everyone who uses the service.
      </p>

      <h2>Who we are</h2>
      <p>
        AI SEO Platform is a service that analyses a customer&apos;s website,
        researches search terms, writes articles, and publishes them to that
        customer&apos;s own website. If you have a question about this policy or
        about your data, contact us at{" "}
        <a href="mailto:support@example.com">support@example.com</a>.
      </p>

      <h2>What we collect</h2>
      <p>
        <strong>Account information.</strong> Your name, email address, and (if
        you sign in with Google) your Google profile photo. We use this to
        identify you and to contact you about your account.
      </p>
      <p>
        <strong>Your website content.</strong> When you add a website, we fetch
        its public pages and store the text, headings, links and images we find,
        so we can understand what your business does and check the site for
        problems. We only fetch pages that are publicly available to anyone.
      </p>
      <p>
        <strong>Search and analytics data.</strong> If you connect Google Search
        Console or Google Analytics, we import performance figures — searches,
        clicks, impressions, rankings, sessions and page views — so we can show
        you how your pages perform. See &quot;Google user data&quot; below.
      </p>
      <p>
        <strong>Integration credentials.</strong> If you connect WordPress or
        Google, we store the credentials needed to keep that connection working.
      </p>
      <p>
        <strong>Payment information.</strong> Payments are processed by Stripe.
        We never see or store your full card details; we keep only the
        subscription status and a customer reference from Stripe.
      </p>
      <p>
        <strong>Usage records.</strong> We record which operations ran for your
        account — pages crawled, articles written, external API calls — so we
        can enforce plan limits and understand our own costs.
      </p>

      <h2>Google user data</h2>
      <p>
        If you choose to connect Google Search Console or Google Analytics, we
        request these permissions:
      </p>
      <ul>
        <li>
          <strong>Search Console (read only)</strong> — to read which searches
          brought people to your website, and how your pages rank.
        </li>
        <li>
          <strong>Analytics (read only)</strong> — to read visitor and session
          figures for your website.
        </li>
      </ul>
      <p>
        Both permissions are <strong>read only</strong>. We cannot modify,
        delete or publish anything in your Google account, and we never request
        the ability to do so.
      </p>
      <p>
        We use this data solely to show you how your website is performing
        inside your own account. We do not sell it, use it for advertising, use
        it to train machine-learning models, or share it with anyone other than
        the service providers listed below.
      </p>
      <p>
        You can disconnect Google at any time from your website&apos;s settings
        page, which deletes the stored tokens. You can also revoke our access
        directly at{" "}
        <a
          href="https://myaccount.google.com/permissions"
          target="_blank"
          rel="noopener noreferrer"
        >
          your Google account permissions page
        </a>
        .
      </p>
      <p>
        Our use of information received from Google APIs follows the{" "}
        <a
          href="https://developers.google.com/terms/api-services-user-data-policy"
          target="_blank"
          rel="noopener noreferrer"
        >
          Google API Services User Data Policy
        </a>
        , including its Limited Use requirements.
      </p>

      <h2>Artificial intelligence</h2>
      <p>
        We use Anthropic&apos;s Claude models to describe your business, suggest
        search terms, and write articles. To do this we send the relevant
        content — your website text, your business profile, and the article
        brief — to Anthropic for processing. We do not send your Google
        analytics data, your credentials, or your payment information.
      </p>

      <h2>How we protect your data</h2>
      <p>
        Integration credentials — WordPress application passwords and Google
        refresh tokens — are encrypted before they are stored, using AES-256-GCM
        with a key held separately from the database. They are never shown back
        to you or to anyone else, in any form.
      </p>
      <p>
        Every customer&apos;s data is scoped to their own workspace and cannot
        be read by another customer. Requests for records belonging to a
        different workspace are refused.
      </p>
      <p>
        No system is perfectly secure, and we do not claim otherwise. If we
        become aware of a breach affecting your data, we will tell you.
      </p>

      <h2>Who we share data with</h2>
      <p>
        We do not sell your data. We share it only with the providers needed to
        run the service:
      </p>
      <ul>
        <li>
          <strong>Supabase</strong> — database hosting
        </li>
        <li>
          <strong>Vercel</strong> — application hosting
        </li>
        <li>
          <strong>Stripe</strong> — payment processing
        </li>
        <li>
          <strong>Anthropic</strong> — AI text generation
        </li>
        <li>
          <strong>DataForSEO</strong> — search volume and keyword data
        </li>
        <li>
          <strong>Inngest</strong> — background job processing
        </li>
        <li>
          <strong>Sentry</strong> — error monitoring
        </li>
      </ul>

      <h2>How long we keep it</h2>
      <p>
        We keep your data for as long as your account is open. If you delete a
        website, its pages, keywords, articles and analytics are deleted with
        it. If you close your account, we delete your data within 30 days,
        except where we are required to keep billing records for tax purposes.
      </p>

      <h2>Your rights</h2>
      <p>
        You can ask us for a copy of your data, ask us to correct it, or ask us
        to delete it. Email{" "}
        <a href="mailto:support@example.com">support@example.com</a> and we will
        respond within 30 days. If you are in the EU or UK, you also have the
        right to complain to your local data protection authority.
      </p>

      <h2>Cookies</h2>
      <p>
        We use a single cookie to keep you signed in. We do not use advertising
        or tracking cookies.
      </p>

      <h2>Changes</h2>
      <p>
        If we change this policy we will update the date at the top of this
        page, and tell you by email if the change is significant.
      </p>
    </LegalPage>
  );
}
