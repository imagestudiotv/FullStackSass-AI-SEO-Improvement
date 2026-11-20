import { Sparkles } from "lucide-react";

import type { Locale } from "@/lib/i18n/config";
import { format } from "@/lib/i18n/format";
import { freePlanCopy } from "@/lib/i18n/free-plan";
import { freePlanValues } from "@/lib/plans/free-plan";
import { freePlanPause, isFreePlanWebsite } from "@/lib/plans/free-plan-server";
import { checkLimit } from "@/lib/usage";

import { UpgradeLink } from "./upgrade-link";

/**
 * The persistent "Free plan · 3 of 4 articles left · Upgrade" line in the
 * app shell (the sidebar's foot, and the phone menu's), for an owner looking
 * at their Free website. Quiet by design: one line, no badge counts, no
 * popups; it says the month's articles left, or that Free AI is paused.
 *
 * Renders nothing for any other website, and never breaks the shell: a
 * failed read leaves it out.
 */
export async function FreePlanIndicator({
  websiteId,
  locale,
}: {
  websiteId: string;
  /** The shell passes the workspace; the pause is read per website now (freePlanPause), so it is not needed. */
  organizationId?: string;
  locale: Locale;
}) {
  // Read first, render after: a failed read leaves the line out, and JSX is
  // never built inside the try (React would not catch its errors there).
  let line: string;
  let upgrade: string;
  try {
    if (!(await isFreePlanWebsite(websiteId))) return null;
    const [articles, pause] = await Promise.all([checkLimit(websiteId, "articles"), freePlanPause(websiteId)]);
    const t = freePlanCopy(locale).app;
    const values = freePlanValues(locale);
    const left = Math.max(0, articles.limit - articles.used);
    line = pause.paused
      ? t.pausedShort
      : left > 0
        ? format(t.indicator, { ...values, left })
        : format(t.indicatorNone, values);
    upgrade = t.upgrade;
  } catch {
    return null;
  }
  return (
    <div className="mx-3 mt-3 flex items-center gap-2 rounded-md border border-primary/25 bg-primary/5 px-3 py-2 text-xs">
      <Sparkles className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
      <span className="min-w-0 flex-1 text-muted-foreground">{line}</span>
      <UpgradeLink
        href={`/billing?site=${encodeURIComponent(websiteId)}#plan`}
        source="indicator"
        className="shrink-0 font-semibold text-primary underline-offset-2 hover:underline"
      >
        {upgrade}
      </UpgradeLink>
    </div>
  );
}
