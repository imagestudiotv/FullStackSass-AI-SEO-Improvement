import Link from "next/link";
import { LegalPage } from "../legal-page";
import { SUPPORT_EMAIL } from "@/lib/config/site";

export const metadata = {
  title: "Terms of Service",
  description: "The terms that apply when you use AI SEO Platform.",
};

/**
 * Terms of service.
 *
 * Two clauses matter more than the rest and are stated plainly rather than
 * buried: the customer is responsible for what gets published under their
 * name, and we do not promise rankings. An SEO product that implies guaranteed
 * results is making a promise no one can keep.
 */
export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="31 August 2026">
      <p>
        These terms apply when you use AI SEO Platform (&quot;the
        service&quot;). By creating an account you agree to them.
      </p>

      <h2>What the service does</h2>
      <p>
        The service analyses websites you own, researches search terms, writes
        articles, and — if you connect a publishing integration — publishes
        those articles to your website. It can also connect to Google Search
        Console and Google Analytics to report on performance.
      </p>

      <h2>Your account</h2>
      <p>
        You must give accurate information when you sign up and keep your
        password secure. You are responsible for everything that happens under
        your account. Tell us promptly if you believe someone else has access to
        it.
      </p>

      <h2>Websites you add</h2>
      <p>
        You may only add websites you own or are authorised to manage. By adding
        a website you confirm you have permission for us to read it, analyse it,
        and publish to it if you connect publishing.
      </p>

      <h2>Content we generate</h2>
      <p>
        Articles are produced by AI models. You own the articles generated for
        your website. You are responsible for reviewing them before they are
        published, and for what appears on your website under your name.
      </p>
      <p>
        AI-generated text can contain mistakes. Review anything that states a
        fact about your business, your prices, or your industry before it goes
        live. We provide an editor for exactly this purpose.
      </p>

      <h2>No guarantee of results</h2>
      <p>
        <strong>
          We do not guarantee any particular search ranking, amount of traffic,
          or number of customers.
        </strong>{" "}
        Search engines decide what to rank and change their methods without
        notice. We apply established practices and report honestly on what
        happens; anyone promising guaranteed rankings is not being truthful with
        you.
      </p>

      <h2>The link network</h2>
      <p>
        If you join the link network, you agree to include links to other
        members&apos; websites in your published articles, in exchange for
        credits you can spend on links to your own. Links are matched by
        relevance, and you can leave at any time.
      </p>
      <p>
        If a link you paid for is removed by the other site, we return the
        credit to you.
      </p>

      <h2>Acceptable use</h2>
      <p>You may not use the service to:</p>
      <ul>
        <li>Publish illegal, deceptive or harmful content</li>
        <li>Add websites you do not own or manage</li>
        <li>Attempt to access another customer&apos;s data</li>
        <li>Overload, probe or disrupt the service</li>
        <li>Resell the service without our written agreement</li>
      </ul>

      <h2>Payment</h2>
      <p>
        Plans are billed monthly or annually in advance through Stripe. Prices
        are shown on the pricing page. Your plan sets limits on websites,
        articles, tracked search terms and link credits.
      </p>
      <p>
        You can cancel at any time from the billing page. Cancelling stops the
        next renewal; your access continues until the end of the period you have
        already paid for. See our{" "}
        <Link href="/refunds">refund policy</Link> for refunds.
      </p>

      <h2>Availability</h2>
      <p>
        We aim to keep the service available but do not guarantee uninterrupted
        access. We may need to suspend it for maintenance, and parts of it
        depend on third parties — Google, Stripe, and our AI and data providers
        — whose availability is outside our control.
      </p>

      <h2>Ending your account</h2>
      <p>
        You can close your account at any time. We may suspend or close an
        account that breaches these terms, and will explain why unless we are
        legally prevented from doing so.
      </p>

      <h2>Liability</h2>
      <p>
        To the extent the law allows, our total liability to you is limited to
        the amount you paid us in the twelve months before the claim. We are not
        liable for lost profits, lost rankings, or indirect losses.
      </p>
      <p>Nothing here limits liability that cannot legally be limited.</p>

      <h2>Changes</h2>
      <p>
        We may update these terms. If a change is significant we will tell you
        by email before it takes effect. Continuing to use the service after
        that means you accept the updated terms.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these terms:{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
      </p>
    </LegalPage>
  );
}
