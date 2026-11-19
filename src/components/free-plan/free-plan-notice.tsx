import { Sparkles } from "lucide-react";

import type { Locale } from "@/lib/i18n/config";
import { format } from "@/lib/i18n/format";
import { freePlanCopy } from "@/lib/i18n/free-plan";
import { freePlanValues } from "@/lib/plans/free-plan";

import { UpgradeLink } from "./upgrade-link";

type NoticeKey = "onFree" | "lockedBacklinks" | "lockedVideos" | "lockedAutomation" | "articlesUsed" | "postsUsed" | "auditUsed" | "snapshotUsed" | "copilotUsed" | "termsUsed" | "paused";

/**
 * The Free plan's upgrade prompt, inline where the locked feature or the
 * spent allowance is (Daniel, 2026-11-19: "continue warning to upgrade the
 * plan"; the brief: friendly, no popups). One sentence saying what needs a
 * paid plan, the paid plans' free trial, and Upgrade - with Buy credits too
 * where credits would do (posts, the paused AI budget).
 *
 * Rendered only for a website on Free: the page asks isFreePlanWebsite first.
 */
export function FreePlanNotice({
  locale,
  reason,
  websiteId,
  source,
  className = "",
}: {
  locale: Locale;
  reason: NoticeKey;
  websiteId: string;
  /** For the launch dashboard's upgrade clicks. */
  source: string;
  className?: string;
}) {
  const t = freePlanCopy(locale).app;
  const values = freePlanValues(locale);
  const credits = reason === "postsUsed" || reason === "paused";
  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm ${className}`}>
      <Sparkles className="size-4 shrink-0 text-primary" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-foreground">{format(t[reason], values)}</p>
        <p className="text-xs text-muted-foreground">{format(t.trialHint, values)}</p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {credits ? (
          <UpgradeLink href="/credits" source={`${source}:credits`} className="text-sm font-medium text-foreground underline underline-offset-2">
            {t.buyCredits}
          </UpgradeLink>
        ) : null}
        <UpgradeLink
          href={`/billing?site=${encodeURIComponent(websiteId)}#plan`}
          source={source}
          className="inline-flex h-9 items-center rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          {t.upgrade}
        </UpgradeLink>
      </div>
    </div>
  );
}
