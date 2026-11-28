import { BookOpen } from "lucide-react";

import { WorkspaceSection } from "@/components/workspace/section";
import { positionWeight } from "@/lib/geo/score";
import type { GeoMethod } from "@/lib/geo/shared";
import { format } from "@/lib/i18n/format";
import type { Messages } from "@/lib/i18n/messages";

type GeoText = Messages["app"]["geo"];

/** Points a question earns at a position, from the formula the score uses. */
const points = (position: number) => Math.round(positionWeight(position) * 100);

/**
 * "Claude (claude-haiku-5-5, web search on), ChatGPT (gpt-5-mini, web search
 * was not available in this check)": web search as the latest check stored
 * it for each answer, not as the settings intend. An older check that did
 * not record its model shows the assistant and web search only.
 */
export function engineList(method: GeoMethod, t: GeoText): string {
  const search = { on: t.methodSearchOn, off: t.methodSearchOff, partly: t.methodSearchPartly } as const;
  return method.engines
    .map((engine) =>
      engine.model
        ? format(t.methodEngine, { name: engine.name, model: engine.model, search: search[engine.webSearch] })
        : `${engine.name} (${search[engine.webSearch]})`,
    )
    .join(", ");
}

/**
 * What is measured, in plain words: what each statement says is what the
 * method section shows (pure, so it can be tested in every language).
 */
export function methodItems(method: GeoMethod, assistants: string[], t: GeoText): { title: string; body: string }[] {
  const items: { title: string; body: string }[] = [
    {
      title: t.methodEnginesTitle,
      body: method.engines.length > 0 ? format(t.methodEnginesBody, { names: engineList(method, t) }) : t.methodNoEngines,
    },
    { title: t.methodAskTitle, body: format(t.methodAskBody, { runs: method.runs }) },
    {
      title: t.methodLanguageTitle,
      body: format(t.methodLanguageBody, { language: method.language, region: method.region ?? t.methodNoRegion }),
    },
    { title: t.methodRecordTitle, body: t.methodRecordBody },
    {
      title: t.methodScoreTitle,
      body: format(t.methodScoreBody, { second: points(2), third: points(3), fourth: points(4), runs: method.runs, share: Math.round(100 / Math.max(method.runs, 1)) }),
    },
    { title: t.methodCompareTitle, body: t.methodCompareBody },
    { title: t.methodScheduleTitle, body: format(t.methodScheduleBody, { action: t.checkNow, weekly: method.weeklyChecks }) },
  ];
  if (assistants.length > 0) {
    items.push({ title: t.methodAssistantsTitle, body: format(t.methodAssistantsBody, { names: assistants.join(", ") }) });
  }
  return items;
}

/**
 * What a check measures and how each number is worked out, in plain words.
 *
 * Every statement here describes the code as it runs (lib/geo/check.ts,
 * lib/geo/assistants.ts, lib/geo/score.ts, inngest/functions/check-geo.ts):
 * the assistants and models come from lib/geo/engines.ts enginesInUse - the
 * ones this deployment really asks - the runs per question, language,
 * market and weekly cap from the same settings the job reads. The position
 * points are computed from positionWeight rather than written into the copy,
 * so the explanation cannot drift from the formula. The last line lists only
 * assistants that appear in stored answers.
 */
export function MethodSection({ method, assistants, t }: { method: GeoMethod; assistants: string[]; t: GeoText }) {
  const items = methodItems(method, assistants, t);
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
