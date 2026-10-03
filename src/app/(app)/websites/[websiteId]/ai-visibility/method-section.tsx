import { BookOpen } from "lucide-react";

import { WorkspaceSection } from "@/components/workspace/section";
import { positionWeight } from "@/lib/geo/score";
import { format } from "@/lib/i18n/format";
import type { Messages } from "@/lib/i18n/messages";

type GeoText = Messages["app"]["geo"];

/** Points a question earns at a position, from the formula the score uses. */
const points = (position: number) => Math.round(positionWeight(position) * 100);

/**
 * What a check measures and how each number is worked out, in plain words.
 *
 * Every statement here describes the code as it runs (lib/geo/check.ts,
 * lib/geo/score.ts, lib/geo/actions.ts, inngest/functions/check-geo.ts). The
 * position points are computed from positionWeight rather than written into
 * the copy, so the explanation cannot drift from the formula. The assistants
 * line lists only engines that appear in stored answers - never one that is
 * merely configured.
 */
export function MethodSection({ assistants, t }: { assistants: string[]; t: GeoText }) {
  const items: { title: string; body: string }[] = [
    { title: t.methodAskTitle, body: t.methodAskBody },
    { title: t.methodRecordTitle, body: t.methodRecordBody },
    {
      title: t.methodScoreTitle,
      body: format(t.methodScoreBody, { second: points(2), third: points(3), fourth: points(4) }),
    },
    { title: t.methodCompareTitle, body: t.methodCompareBody },
    { title: t.methodScheduleTitle, body: format(t.methodScheduleBody, { action: t.checkNow }) },
  ];
  if (assistants.length > 0) {
    items.push({ title: t.methodAssistantsTitle, body: format(t.methodAssistantsBody, { names: assistants.join(", ") }) });
  }

  return (
    <WorkspaceSection id="method" icon={BookOpen} title={t.methodTitle} description={t.methodHelp}>
      <dl className="grid gap-x-8 gap-y-5 md:grid-cols-2">
        {items.map((item) => (
          <div key={item.title} className="min-w-0 space-y-1">
            <dt className="text-sm font-medium">{item.title}</dt>
            <dd className="text-sm leading-6 text-muted-foreground">{item.body}</dd>
          </div>
        ))}
      </dl>
    </WorkspaceSection>
  );
}
