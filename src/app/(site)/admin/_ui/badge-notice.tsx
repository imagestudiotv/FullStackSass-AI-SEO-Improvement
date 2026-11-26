import { BellDot } from "lucide-react";
import Link from "next/link";

import { badgeNumber, noticeCount, type BadgeNoticeItem } from "@/lib/admin/badges-shared";

/**
 * What a page's number in the sidebar counts, at the top of the page, each
 * with a link to where it is dealt with (Daniel, 2026-11-26: "I see on blog
 * dashboard 2 notifications, but I don't see anything there as new, all
 * articles are published"). Nothing when there is nothing to count.
 */
export function BadgeNotice({ page, items, note }: { page: string; items: BadgeNoticeItem[]; note?: string }) {
  const shown = items.filter((item) => item.count > 0);
  if (shown.length === 0) return null;
  const total = shown.reduce((sum, item) => sum + item.count, 0);
  return (
    <section aria-labelledby="badge-notice-title" className="rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 sm:px-5">
      <h2 id="badge-notice-title" className="flex items-center gap-2 text-sm font-semibold">
        <BellDot className="size-4 text-warning" aria-hidden="true" />
        {`Why ${page} shows ${badgeNumber(total)} in the menu`}
      </h2>
      <ul className="mt-2 space-y-1.5 text-sm">
        {shown.map((item) => (
          <li key={item.what} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="font-medium tabular-nums">{noticeCount(item)}</span>
            <span aria-hidden="true" className="text-muted-foreground">
              -
            </span>
            <Link href={item.href} className="rounded-sm font-medium underline underline-offset-4 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
      {note ? <p className="mt-2 text-xs text-muted-foreground">{note}</p> : null}
    </section>
  );
}
