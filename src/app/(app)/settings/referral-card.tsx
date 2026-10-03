"use client";

import { Check, Copy, Gift } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { Field } from "@/components/workspace/field";
import { Notice } from "@/components/workspace/notice";
import { WorkspaceSection } from "@/components/workspace/section";
import type { Locale } from "@/lib/i18n/config";
import { format, formatDate, formatNumber } from "@/lib/i18n/format";
import type { Messages } from "@/lib/i18n/messages";
import type { ReferralRow, ReferralSummary } from "@/lib/referrals/shared";

/** getReferralSummary() lists at most this many referrals (its totals cover all of them). */
export const REFERRALS_LISTED = 50;

/**
 * The referral program: the link, what it has earned, and who signed up.
 *
 * The terms are stated plainly rather than buried: the reward is account
 * credit, not cash, and it arrives when the referred customer pays rather
 * than when they sign up.
 *
 * Every figure is the stored one: credits earned is the referral ledger net
 * of reversals, "waiting" counts every pending referral, and the people
 * count is the list itself - shown as "50+" when the list is capped, because
 * the list is all we have counted.
 *
 * id="referral" is the target of the sidebar's "Referral program" link
 * (/settings#referral); WorkspaceSection keeps it clear of the sticky header.
 */
export function ReferralCard({
  summary,
  rewardCredits,
  appUrl,
  locale,
  t,
  tCommon,
  tWorkspace,
}: {
  /** Null when the summary could not be read; the rest of Settings still works. */
  summary: ReferralSummary | null;
  rewardCredits: number;
  appUrl: string;
  /** For dates and numbers in the reader's convention. */
  locale: Locale;
  /** This screen's copy, already in the reader's language. */
  t: Messages["app"]["referral"];
  /** Shared words: the credits explainer. */
  tCommon: Messages["app"]["common"];
  /** Shared field words. */
  tWorkspace: Messages["app"]["workspace"];
}) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const linkField = useRef<HTMLInputElement>(null);

  // "Copied" goes back to "Copy" after a moment; a pending reset never outlives the page.
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const description = format(t.cardDescription, { credits: rewardCredits });
  const footer = <p className="text-xs leading-5 text-muted-foreground">{tCommon.creditsExplainer}</p>;

  if (!summary) {
    return (
      <WorkspaceSection id="referral" icon={Gift} title={t.referSomeone} description={description} footer={footer}>
        <Notice tone="danger" role="alert">
          {t.unavailable}
        </Notice>
      </WorkspaceSection>
    );
  }

  const link = `${appUrl}/r/${summary.code}`;
  /*
    UTC and the account's language, not the browser's, so the server and the
    browser render the same day.
  */
  const day = (at: Date) =>
    formatDate(at, locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  const capped = summary.referrals.length >= REFERRALS_LISTED;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopyFailed(false);
      setCopied(true);
      toast.success(t.linkCopied);
    } catch {
      /*
        Clipboard access can be refused outright. The field is selected for
        a manual copy, and the error says so beside it.
      */
      setCopied(false);
      setCopyFailed(true);
      linkField.current?.focus();
      linkField.current?.select();
      toast.error(t.copyFailed);
    }
  }

  return (
    <WorkspaceSection id="referral" icon={Gift} title={t.referSomeone} description={description} footer={footer}>
      <div className="space-y-6">
        <Field
          id="referral-link"
          label={t.linkLabel}
          hint={t.linkHelp}
          error={copyFailed ? t.copyFailed : null}
          t={tWorkspace}
        >
          {(props) => (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                {...props}
                ref={linkField}
                value={link}
                readOnly
                // Selecting the whole link on focus makes a manual copy one action.
                onFocus={(event) => event.currentTarget.select()}
                className="font-mono text-sm"
              />
              <Button type="button" variant="outline" onClick={handleCopy} className="shrink-0">
                {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
                {copied ? t.copied : t.copy}
              </Button>
            </div>
          )}
        </Field>

        <dl className="grid gap-4 sm:grid-cols-3">
          <div className="min-w-0 rounded-lg border bg-muted/20 p-4">
            <dt className="text-xs text-muted-foreground">{t.creditsEarned}</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
              {formatNumber(summary.earned, locale)}
            </dd>
          </div>
          <div className="min-w-0 rounded-lg border bg-muted/20 p-4">
            <dt className="text-xs text-muted-foreground">{t.waitingToConvert}</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
              {formatNumber(summary.pending, locale)}
            </dd>
            <dd className="mt-0.5 text-xs text-muted-foreground">{t.signedUpNotPaying}</dd>
          </div>
          <div className="min-w-0 rounded-lg border bg-muted/20 p-4">
            <dt className="text-xs text-muted-foreground">{t.peopleReferredStat}</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
              {capped
                ? `${formatNumber(REFERRALS_LISTED, locale)}+`
                : formatNumber(summary.referrals.length, locale)}
            </dd>
          </div>
        </dl>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">{t.peopleReferred}</h3>
          {summary.referrals.length === 0 ? (
            <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
              {t.noReferralsYet}
            </p>
          ) : (
            <>
              <ul className="divide-y rounded-lg border">
                {summary.referrals.map((row) => (
                  <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                    {/*
                      The website leads: the referrer shared a link with
                      someone who runs a site. The person's name is the
                      second line, and stands alone before a site exists.
                    */}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {row.referredDomain ?? row.referredName ?? t.someoneReferred}
                      </p>
                      <p className="text-xs text-muted-foreground">{referralLine(row, t, day)}</p>
                    </div>
                    <ReferralStatus row={row} t={t} />
                  </li>
                ))}
              </ul>
              {capped ? (
                <p className="text-xs text-muted-foreground">
                  {format(t.showingRecent, { count: REFERRALS_LISTED })}
                </p>
              ) : null}
            </>
          )}
        </div>
      </div>
    </WorkspaceSection>
  );
}

/** "Name · joined 3 Oct 2026 · Credits added 9 Oct 2026", from what is stored. */
export function referralLine(
  row: ReferralRow,
  t: Messages["app"]["referral"],
  day: (at: Date) => string,
): string {
  const joined = day(row.createdAt);
  const base =
    row.referredDomain && row.referredName
      ? format(t.joinedWithName, { name: row.referredName, date: joined })
      : row.referredDomain
        ? format(t.joined, { date: joined })
        : format(t.noWebsiteJoined, { date: joined });
  return row.status === "rewarded" && row.rewardedAt
    ? `${base} · ${format(t.rewardedOn, { date: day(row.rewardedAt) })}`
    : base;
}

/** Rewarded, not eligible or waiting - in words and an icon, never colour alone. */
function ReferralStatus({ row, t }: { row: ReferralRow; t: Messages["app"]["referral"] }) {
  if (row.status === "rewarded") {
    return <StatusBadge status="rewarded" label={format(t.creditsBadge, { count: row.rewardCredits ?? 0 })} />;
  }
  if (row.status === "rejected") {
    return <StatusBadge status="rejected" label={t.notEligible} tone="neutral" />;
  }
  return <StatusBadge status="pending" label={t.waiting} />;
}
