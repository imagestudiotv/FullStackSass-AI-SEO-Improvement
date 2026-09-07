import { CheckCircle2, FileText, Link2, MousePointerClick, Stethoscope } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { ActivityItem } from "@/lib/dashboard/overview";

/**
 * What the platform did this week.
 *
 * The brief calls these "wins", and the framing matters: the customer is
 * paying for work that happens without them, so a week with no visible
 * evidence feels like a week of nothing. This is the panel that answers "what
 * am I paying for", which is why it leads with outcomes rather than events.
 */

const ICONS = {
  article: FileText,
  backlink: Link2,
  clicks: MousePointerClick,
  audit: Stethoscope,
} as const;

function formatRange(): string {
  const end = new Date();
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - 7);
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return `${fmt(start)} – ${fmt(end)}`;
}

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold">
              7-day wins
              {items.length > 0 ? (
                <Badge variant="secondary">
                  {items.length} {items.length === 1 ? "win" : "wins"}
                </Badge>
              ) : null}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {formatRange()}
            </p>
          </div>
        </div>

        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing to report from the last seven days. Published articles,
            new backlinks and search clicks all show up here as they happen.
          </p>
        ) : (
          <ul className="space-y-2">
            {items.map((item, index) => {
              const Icon = ICONS[item.kind] ?? CheckCircle2;
              return (
                <li
                  key={`${item.kind}-${index}`}
                  className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3"
                >
                  <Icon
                    className="mt-0.5 size-4 shrink-0 text-primary"
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-snug">
                      {item.title}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {item.detail}
                    </p>
                  </div>
                  {item.href ? (
                    <Link
                      href={item.href}
                      className="shrink-0 text-xs font-medium text-primary hover:underline"
                    >
                      View
                    </Link>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
