import { Bot } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { getBlogAutopilotAdmin } from "@/lib/admin/blog-autopilot";
import { AUTOPILOT_LANGUAGES, AUTOPILOT_MAX_PER_DAY, romeHourLabel, utcHourLabel } from "@/lib/blog/autopilot/settings";
import { LANGUAGE_NAMES_EN } from "@/lib/blog/locale";
import { formatDate } from "@/lib/i18n/format";

import { AdminPage, AdminPageHeader } from "../../_ui/page";
import { AdminEmpty } from "../../_ui/states";
import { AdminStatus, type StatusTone } from "../../_ui/status";
import { AutopilotSettingsForm } from "./autopilot-settings";
import { AutopilotTopics } from "./autopilot-topics";

export const metadata: Metadata = { title: "Blog autopilot" };

const RUN_STATUS: Record<string, { tone: StatusTone; label: string }> = {
  running: { tone: "info", label: "Writing" },
  done: { tone: "success", label: "Written" },
  failed: { tone: "danger", label: "Failed" },
};

/** "(writing $1.10, pictures $0.75, translations $1.20)": only the parts that cost something. */
function costParts(costs: { writing: number; pictures: number; translations: number }): string {
  const parts = Object.entries(costs)
    .filter(([, usd]) => usd > 0)
    .map(([part, usd]) => `${part} $${usd.toFixed(2)}`);
  return parts.length > 1 ? ` (${parts.join(", ")})` : "";
}

/**
 * Admin -> Blog -> Autopilot (client, 2026-10-16): the switch, the hour and
 * languages, the topic list in the order it will be written, and the recent
 * runs. What the autopilot does: lib/blog/autopilot/settings.ts.
 */
export default async function BlogAutopilotPage() {
  const data = await getBlogAutopilotAdmin();
  const hours = Array.from({ length: 24 }, (_, hour) => ({ value: hour, label: `${utcHourLabel(hour)} (${romeHourLabel(hour)})` }));
  const languages = AUTOPILOT_LANGUAGES.map((code) => ({ code, name: LANGUAGE_NAMES_EN[code] }));

  return (
    <AdminPage width="default">
      <AdminPageHeader
        title="Blog autopilot"
        description="Writes RepGet's blog articles every day (one, or up to five) in the blog's own style with every field filled in, and the same article in each language you choose. Each one is saved as a draft for you to read and publish - nothing goes live by itself."
      />

      <div className="space-y-6">
        <AutopilotSettingsForm settings={data.settings} hours={hours} maxPerDay={AUTOPILOT_MAX_PER_DAY} languages={languages} />

        <AutopilotTopics queued={data.queued} writing={data.writing} failed={data.failed} written={data.written} />

        <section aria-labelledby="runs-heading" className="rounded-xl border bg-card">
          <div className="border-b px-4 py-3 sm:px-5">
            <h2 id="runs-heading" className="font-medium">
              Recent runs
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">Each day&apos;s article, and any written with &ldquo;Write one now&rdquo;.</p>
          </div>
          {data.runs.length === 0 ? (
            <AdminEmpty
              filtering={false}
              noun="runs"
              icon={Bot}
              title="No runs yet"
              description="The first article is written at the chosen hour once the autopilot is on - or now, with “Write the next one now”."
            />
          ) : (
            <ul className="divide-y">
              {data.runs.map((run) => {
                const status = RUN_STATUS[run.status] ?? { tone: "neutral" as const, label: run.status };
                return (
                  <li key={run.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm sm:px-5">
                    <span className="order-1 w-28 shrink-0 tabular-nums text-muted-foreground">{formatDate(run.startedAt, "en", { day: "numeric", month: "short", year: "numeric" })}</span>
                    {/* On a phone: the date and status on one line, the article below them. */}
                    <span className="order-3 min-w-0 basis-full sm:order-2 sm:flex-1 sm:basis-0">
                      {run.postId ? (
                        <Link href={`/admin/blog/${run.postId}`} className="font-medium underline-offset-4 hover:underline">
                          {run.topic ?? "Article"}
                        </Link>
                      ) : (
                        <span className="font-medium">{run.topic ?? "No topic"}</span>
                      )}
                      {run.trigger === "manual" ? <span className="ml-2 text-xs text-muted-foreground">started by hand</span> : null}
                      {run.words !== null || run.costUsd !== null ? (
                        <span className="mt-0.5 block text-xs text-muted-foreground tabular-nums">
                          {[
                            run.words !== null ? `${run.words.toLocaleString("en-US")} words` : null,
                            run.translations ? `${run.translations} translation${run.translations === 1 ? "" : "s"}` : null,
                            run.costUsd !== null ? `AI cost $${run.costUsd.toFixed(2)}${costParts(run.costs)}` : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      ) : null}
                      {run.warnings.length > 0 ? (
                        <details className="mt-1 text-xs text-muted-foreground">
                          <summary className="cursor-pointer select-none">
                            {run.warnings.length} thing{run.warnings.length === 1 ? "" : "s"} to check in the draft
                          </summary>
                          <ul className="mt-1 list-disc space-y-0.5 pl-5">
                            {run.warnings.map((warning) => (
                              <li key={warning}>{warning}</li>
                            ))}
                          </ul>
                        </details>
                      ) : null}
                      {run.error ? <span className="mt-0.5 block text-xs text-danger">{run.error}</span> : null}
                    </span>
                    <span className="order-2 ml-auto sm:order-3">
                      <AdminStatus tone={status.tone} label={status.label} />
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </AdminPage>
  );
}
