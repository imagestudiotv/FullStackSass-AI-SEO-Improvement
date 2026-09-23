"use client";

import { Check, Copy, Gift } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { Messages } from "@/lib/i18n/messages";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Stat } from "@/components/ui/states";
import type { ReferralSummary } from "@/lib/referrals/shared";

/**
 * Referral card.
 *
 * States the terms plainly rather than burying them: the reward is account
 * credit, not cash, and it arrives when the referred customer pays rather than
 * when they sign up. Someone who discovers either of those after sharing a
 * link with twenty people has been misled, and there is no version of that
 * which ends well.
 */
export function ReferralCard({
  summary,
  rewardCredits,
  appUrl,
  t,
  tCommon,
}: {
  summary: ReferralSummary;
  rewardCredits: number;
  appUrl: string;
  /** This screen's copy, already in the reader's language. */
  t: Messages["app"]["referral"];
  /** Shared words: the credits explainer. */
  tCommon: Messages["app"]["common"];
}) {
  const [copied, setCopied] = useState(false);
  const link = `${appUrl}/r/${summary.code}`;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success(t.linkCopied);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be refused outright; the field is selectable, so
      // say that rather than failing silently.
      toast.error(t.copyFailed);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Gift className="size-4" aria-hidden="true" />
          {t.referSomeone}
        </CardTitle>
        <CardDescription>
          Share your link. When someone you refer starts a paid plan, you get{" "}
          {rewardCredits} link credits.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={link}
            readOnly
            // Selecting the whole link on focus makes manual copying one action
            // rather than a careful drag.
            onFocus={(e) => e.currentTarget.select()}
            aria-label={t.linkLabel}
            className="font-mono text-sm"
          />
          <Button onClick={handleCopy} variant="outline">
            {copied ? (
              <Check className="size-4" />
            ) : (
              <Copy className="size-4" />
            )}
            {copied ? t.copied : t.copy}
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Stat
            label={t.creditsEarned}
            value={summary.earned}
            tone={summary.earned > 0 ? "positive" : "default"}
          />
          <Stat
            label={t.waitingToConvert}
            value={summary.pending}
            hint={t.signedUpNotPaying}
          />
        </div>

        {summary.referrals.length > 0 ? (
          <div>
            <p className="mb-2 text-sm font-medium">{t.peopleReferred}</p>
            <ul className="divide-y rounded-xl border">
              {summary.referrals.map((row) => (
                <li
                  key={row.id}
                  className="flex items-center justify-between gap-3 px-3 py-2.5"
                >
                  {/*
                    The website leads, because that is what the referrer
                    recognises — they shared a link with someone who runs a
                    site, not with a workspace. The person's name is the
                    second line, and stands alone before a site is connected.
                  */}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {row.referredDomain ??
                        row.referredName ??
                        t.someoneReferred}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {row.referredDomain && row.referredName
                        ? `${row.referredName} · joined ${new Date(row.createdAt).toLocaleDateString()}`
                        : row.referredDomain
                          ? `Joined ${new Date(row.createdAt).toLocaleDateString()}`
                          : `No website yet · joined ${new Date(row.createdAt).toLocaleDateString()}`}
                    </p>
                  </div>
                  {row.status === "rewarded" ? (
                    <Badge>+{row.rewardCredits} credits</Badge>
                  ) : row.status === "rejected" ? (
                    <Badge variant="outline">{t.notEligible}</Badge>
                  ) : (
                    <Badge variant="secondary">{t.waiting}</Badge>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {/*
          The terms, stated once and plainly. Credit rather than cash is the
          part people most often assume otherwise.
        */}
        <p className="text-xs text-muted-foreground">
          {tCommon.creditsExplainer}
          </p>
      </CardContent>
    </Card>
  );
}
