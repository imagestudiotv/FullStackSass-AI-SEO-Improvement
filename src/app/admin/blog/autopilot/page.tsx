import { Bot } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { getBlogAutopilotAdmin } from "@/lib/admin/blog-autopilot";
import { AUTOPILOT_LANGUAGES, romeHourLabel, utcHourLabel } from "@/lib/blog/autopilot/settings";
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
        description="Writes one article a day for RepGet's blog, in the blog's own style with every field filled in, and the same article in each language you choose. Each one is saved as a draft for you to read and publish - nothing goes live by itself."
      />

      <div className="space-y-6">
        <AutopilotSettingsForm settings={data.settings} hours={hours} languages={languages} />

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
              description="The first article is written at the chosen hour once the autopilot is on."
            />
          ) : (
            <ul className="divide-y">
              {data.runs.map((run) => {
                const status = RUN_STATUS[run.status] ?? { tone: "neutral" as const, label: run.status };
                return (
                  <li key={run.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm sm:px-5">
                    <span className="w-28 shrink-0 tabular-nums text-muted-foreground">{formatDate(run.startedAt, "en", { day: "numeric", month: "short", year: "numeric" })}</span>
                    <span className="min-w-0 flex-1">
                      {run.postId ? (
                        <Link href={`/admin/blog/${run.postId}`} className="font-medium underline-offset-4 hover:underline">
                          {run.topic ?? "Article"}
                        </Link>
                      ) : (
                        <span className="font-medium">{run.topic ?? "No topic"}</span>
                      )}
                      {run.trigger === "manual" ? <span className="ml-2 text-xs text-muted-foreground">started by hand</span> : null}
                      {run.error ? <span className="mt-0.5 block text-xs text-danger">{run.error}</span> : null}
                    </span>
                    <AdminStatus tone={status.tone} label={status.label} />
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
