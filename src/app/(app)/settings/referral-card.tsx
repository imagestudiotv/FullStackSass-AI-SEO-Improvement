"use client";

import { Check, Copy, Gift } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

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
}: {
  summary: ReferralSummary;
  rewardCredits: number;
  appUrl: string;
}) {
  const [copied, setCopied] = useState(false);
  const link = `${appUrl}/r/${summary.code}`;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success("Link copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be refused outright; the field is selectable, so
      // say that rather than failing silently.
      toast.error("Could not copy. Select the link and copy it manually.");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Gift className="size-4" aria-hidden="true" />
          Refer someone
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
            aria-label="Your referral link"
            className="font-mono text-sm"
          />
          <Button onClick={handleCopy} variant="outline">
            {copied ? (
              <Check className="size-4" />
            ) : (
              <Copy className="size-4" />
            )}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Stat
            label="Credits earned"
            value={summary.earned}
            tone={summary.earned > 0 ? "positive" : "default"}
          />
          <Stat
            label="Waiting to convert"
            value={summary.pending}
            hint="Signed up, not yet paying"
          />
        </div>

        {summary.referrals.length > 0 ? (
          <div>
            <p className="mb-2 text-sm font-medium">People you referred</p>
            <ul className="divide-y rounded-lg border">
              {summary.referrals.map((row) => (
                <li
                  key={row.id}
                  className="flex items-center justify-between gap-3 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm">
                      {row.referredName ?? "A workspace"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Joined {new Date(row.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  {row.status === "rewarded" ? (
                    <Badge>+{row.rewardCredits} credits</Badge>
                  ) : row.status === "rejected" ? (
                    <Badge variant="outline">Not eligible</Badge>
                  ) : (
                    <Badge variant="secondary">Waiting</Badge>
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
          Credits are added to your account and can be spent on link building.
          They are not cash and cannot be withdrawn. A referral counts once the
          person you referred pays for their first month, and each workspace can
          be referred once.
        </p>
      </CardContent>
    </Card>
  );
}
