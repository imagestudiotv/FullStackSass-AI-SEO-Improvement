import { LegalPage } from "../legal-page";
import { SUPPORT_EMAIL } from "@/lib/config/site";

export const metadata = {
  title: "Refund Policy",
  description:
    "Our 14-day money-back guarantee and how refunds work at AI SEO Platform.",
};

/**
 * Refund policy and money-back guarantee.
 *
 * The client's brief lists both a refund policy and a money-back guarantee.
 * The terms below are deliberately concrete — a guarantee with vague conditions
 * is not a guarantee, and hedged wording is exactly what makes customers
 * distrust one.
 */
export default function RefundsPage() {
  return (
    <LegalPage title="Refund Policy" updated="31 August 2026">
      <h2 id="guarantee">14-day money-back guarantee</h2>
      <p>
        If you are not happy with the service, email us within{" "}
        <strong>14 days</strong> of your first payment and we will refund it in
        full. You do not need to explain why.
      </p>
      <p>
        This applies to your first payment on a new subscription. It does not
        apply to later renewals.
      </p>

      <h2>After the first 14 days</h2>
      <p>
        Subscriptions are billed in advance. If you cancel, your access
        continues until the end of the period you have paid for, and you are not
        charged again.
      </p>
      <p>
        We do not usually refund part of a period you have already used. If
        something has gone wrong on our side, tell us — we would rather resolve
        it than have you leave unhappy.
      </p>

      <h2>When we will always refund</h2>
      <ul>
        <li>You were charged after cancelling</li>
        <li>You were charged twice for the same period</li>
        <li>
          The service was unavailable for an extended period through our fault
        </li>
        <li>You were charged for a plan you did not choose</li>
      </ul>

      <h2>Annual plans</h2>
      <p>
        Annual plans are covered by the same 14-day guarantee. After that, if
        you cancel part-way through a year, we will refund the remaining whole
        months on request.
      </p>

      <h2>Link credits</h2>
      <p>
        Unused link credits are not refunded for cash — they are part of your
        plan rather than a separate purchase. If a link you paid for is removed
        by the other website, the credit is returned to your balance
        automatically.
      </p>

      <h2>How to request a refund</h2>
      <p>
        Email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> from
        the address on your account. We will reply within two working days, and
        approved refunds reach your card within 5–10 working days depending on
        your bank.
      </p>

      <h2>Cancelling</h2>
      <p>
        You can cancel at any time from the billing page in your account. No
        need to email us, and there is no cancellation fee.
      </p>
    </LegalPage>
  );
}
