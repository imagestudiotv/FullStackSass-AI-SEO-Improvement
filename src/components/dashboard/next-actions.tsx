import Link from "next/link";
import { ArrowRight, ListChecks } from "lucide-react";
import type { Locale } from "@/lib/i18n/config";
import { getNextActions } from "@/lib/dashboard/next-actions";
import { NEXT_ACTIONS_COPY } from "@/lib/i18n/next-actions";
import { CONTENT_COPY } from "@/lib/i18n/content-improvements";
import { snoozeNextAction, restoreNextActions } from "@/lib/dashboard/next-action-actions";

export async function NextActions({ websiteId, ownerOrgId, canManage, locale }: {
  websiteId: string; ownerOrgId: string; canManage: boolean; locale: Locale;
}) {
  const t = { ...NEXT_ACTIONS_COPY[locale], ...CONTENT_COPY[locale] };
  let actions;
  try {
    actions = await getNextActions(websiteId, ownerOrgId, canManage);
  } catch (error) {
    console.error("[dashboard] next actions failed", error);
    return <section aria-label={t.title} className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">{t.unavailable}</section>;
  }
  return (
    <section aria-labelledby="next-actions-title" className="rounded-xl border bg-card p-5 text-card-foreground">
      <h2 id="next-actions-title" className="flex items-center gap-2 font-semibold"><ListChecks className="size-5 text-primary" aria-hidden="true" />{t.title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t.help}</p>
      {actions.length ? <ul className="mt-3 divide-y">
        {actions.map(action => <li key={action.id} className="py-2">
          <Link href={action.href} className="flex min-h-14 items-center justify-between gap-4 rounded-md py-3 hover:bg-accent/50 focus-visible:outline-2 focus-visible:outline-ring">
            <span className="min-w-0">
              <span className="mb-1 block text-xs font-medium text-primary">{t[action.priority]}</span>
              <span className="block text-sm font-medium">{t[action.kind]}</span>
              {action.detail && <span className="mt-0.5 block break-words text-sm">{action.detail}</span>}
              <span className="mt-0.5 block break-words text-sm text-muted-foreground">{t[`${action.kind}Help`]}</span>
              {action.evidence && <span className="mt-1 block text-xs text-muted-foreground">
                {"before" in action.evidence
                  ? `${t[action.evidence.metric]}: ${action.evidence.before.toLocaleString(locale, { maximumFractionDigits: 1 })} → ${action.evidence.after.toLocaleString(locale, { maximumFractionDigits: 1 })}`
                  : `${t.impressions}: ${action.evidence.impressions.toLocaleString(locale)} · ${t.clicks}: ${action.evidence.clicks.toLocaleString(locale)}`}
                {" · "}{t.period} {action.evidence.end}
              </span>}
            </span>
            <ArrowRight className="size-4 shrink-0 text-primary" aria-hidden="true" />
          </Link>
          {canManage && <form action={snoozeNextAction.bind(null, websiteId)}>
            <input type="hidden" name="taskId" value={action.id} />
            <button className="min-h-9 rounded px-2 text-xs text-muted-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring">{t.snooze}</button>
          </form>}
        </li>)}
      </ul> : <p className="mt-3 text-sm text-muted-foreground">{t.empty}</p>}
      {canManage && <form action={restoreNextActions.bind(null, websiteId)} className="mt-2">
        <button className="min-h-9 rounded px-2 text-xs text-primary hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring">{t.restore}</button>
      </form>}
    </section>
  );
}
