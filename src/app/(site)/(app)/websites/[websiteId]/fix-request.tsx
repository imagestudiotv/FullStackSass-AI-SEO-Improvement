import { Wrench } from "lucide-react";

import { Button } from "@/components/ui/button";
import { WorkspaceSection } from "@/components/workspace/section";
import type { Locale } from "@/lib/i18n/config";

import { countText, quoteMailto, type HealthText, type SeverityTotals } from "./health-model";

/**
 * Requesting a quote to have the audit issues fixed.
 *
 * The brief: "they send a request and we review all errors and provide the
 * price for fixing." The price depends on what is actually wrong, so there is
 * nothing to charge up front - this opens an email with the details already
 * filled in rather than pretending a fixed price exists.
 *
 * Unchanged in what it does: a mailto link, so nothing reaches our server,
 * nothing is recorded and nothing is charged; the customer's own mail app
 * sends it, or does not. What changed is that the email now carries the list
 * of findings the copy has always promised, and that the button is not
 * offered while the support address is a placeholder (an @example.com one,
 * lib/config/site.ts), where a request would go nowhere.
 */
export function FixRequest({
  domain,
  supportEmail,
  checkedAt,
  findings,
  totals,
  developerCount,
  locale,
  t,
}: {
  domain: string;
  /** Null while the support address is a placeholder (lib/config/site.ts). */
  supportEmail: string | null;
  checkedAt: string;
  /** Each finding by name with the pages it affects, most serious first. */
  findings: { label: string; count: number }[];
  /** Stored problems per severity (the score's own counting). */
  totals: SeverityTotals;
  /** Findings (distinct types) that realistically need a developer. */
  developerCount: number;
  locale: Locale;
  t: HealthText;
}) {
  if (totals.critical + totals.warning + totals.info === 0) return null;

  const href = supportEmail
    ? quoteMailto({ email: supportEmail, domain, checkedAt, findings, totals, locale, t })
    : null;

  return (
    <WorkspaceSection
      id="fix-request"
      icon={Wrench}
      title={t.fixTitle}
      /*
        Says when they do NOT need us. A list that is mostly copy edits is one
        they can do in an afternoon, and telling them so is worth more than a
        sale they would resent.
      */
      description={developerCount === 0 ? t.fixSelf : countText(t.fixDeveloper, developerCount, locale)}
      actions={
        href ? (
          <Button variant="outline" asChild>
            <a href={href}>{t.requestQuote}</a>
          </Button>
        ) : null
      }
      bodyClassName="pt-3"
    >
      <p className="max-w-3xl text-xs leading-5 text-muted-foreground">{href ? t.fixHow : t.fixUnavailable}</p>
    </WorkspaceSection>
  );
}
