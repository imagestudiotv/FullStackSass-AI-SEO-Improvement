"use client";

import { Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { saveBlogAutopilotSettings } from "@/lib/admin/blog-autopilot";
import type { AutopilotSettings } from "@/lib/blog/autopilot/settings";

/** The autopilot's switch, its daily hour, how many articles a day, and the languages each article is also written in. */
export function AutopilotSettingsForm({
  settings,
  hours,
  maxPerDay,
  languages,
}: {
  settings: AutopilotSettings;
  hours: { value: number; label: string }[];
  /** The most articles a day (AUTOPILOT_MAX_PER_DAY, from the server: the settings module is server-only). */
  maxPerDay: number;
  languages: { code: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [enabled, setEnabled] = useState(settings.enabled);
  const [runHour, setRunHour] = useState(settings.runHour);
  const [perDay, setPerDay] = useState(settings.articlesPerDay);
  const [chosen, setChosen] = useState<string[]>(settings.languages);
  const id = useId();
  const changed =
    enabled !== settings.enabled ||
    runHour !== settings.runHour ||
    perDay !== settings.articlesPerDay ||
    chosen.slice().sort().join() !== settings.languages.slice().sort().join();
  const hourLabel = hours.find((hour) => hour.value === runHour)?.label ?? "";

  function save() {
    start(async () => {
      const result = await saveBlogAutopilotSettings({ enabled, runHour, articlesPerDay: perDay, languages: chosen }).catch(() => null);
      if (!result) {
        toast.error("The server did not finish this. Try again.");
        return;
      }
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.data.enabled ? "Autopilot on" : "Autopilot off");
      router.refresh();
    });
  }

  return (
    <section aria-labelledby={`${id}-heading`} className="rounded-xl border bg-card">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b px-4 py-4 sm:px-5">
        <div className="min-w-0">
          <h2 id={`${id}-heading`} className="font-medium">
            Daily article
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {!enabled
              ? "Off: nothing is written until you turn it on."
              : perDay === 1
                ? `On: an article is written every day at ${hourLabel}.`
                : `On: ${perDay} articles are written every day, one an hour from ${hourLabel}.`}
          </p>
        </div>
        <label className="flex items-center gap-3 text-sm font-medium">
          <Switch checked={enabled} onCheckedChange={setEnabled} aria-describedby={`${id}-heading`} />
          {enabled ? "On" : "Off"}
        </label>
      </div>

      <div className="grid gap-5 px-4 py-4 sm:grid-cols-2 sm:px-5">
        <div className="space-y-1.5">
          <label htmlFor={`${id}-hour`} className="text-sm font-medium">
            Write it at
          </label>
          <select
            id={`${id}-hour`}
            value={runHour}
            onChange={(event) => setRunHour(Number(event.target.value))}
            className="h-9 w-full rounded-md border bg-background px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            {hours.map((hour) => (
              <option key={hour.value} value={hour.value}>
                {hour.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">The drafts are ready for you within the hour, and the administrators get an email when they are.</p>

          <label htmlFor={`${id}-per-day`} className="block pt-3 text-sm font-medium">
            Articles a day
          </label>
          <select
            id={`${id}-per-day`}
            value={perDay}
            onChange={(event) => setPerDay(Number(event.target.value))}
            aria-describedby={`${id}-per-day-help`}
            className="h-9 w-full rounded-md border bg-background px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            {Array.from({ length: maxPerDay }, (_, index) => index + 1).map((count) => (
              <option key={count} value={count}>
                {count === 1 ? "1 article" : `${count} articles`}
              </option>
            ))}
          </select>
          <p id={`${id}-per-day-help`} className="text-xs text-muted-foreground">
            One an hour from that hour, one at a time, each from the next topic in the list. Each article with every language costs about $0.90. For one
            more right away, use &ldquo;Write the next one now&rdquo;.
          </p>
        </div>

        <fieldset className="space-y-1.5">
          <legend className="text-sm font-medium">Also write it in</legend>
          <div className="flex flex-wrap gap-x-5 gap-y-2 pt-1">
            {languages.map((language) => (
              <label key={language.code} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={chosen.includes(language.code)}
                  onChange={(event) =>
                    setChosen((current) =>
                      event.target.checked ? [...current, language.code] : current.filter((code) => code !== language.code),
                    )
                  }
                />
                {language.name}
              </label>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            The same article, adapted to each language and linked to the English one. Each needs your &ldquo;reviewed by a native speaker&rdquo; tick
            before it can be published.
          </p>
        </fieldset>
      </div>

      <div className="flex justify-end border-t px-4 py-3 sm:px-5">
        <Button onClick={save} disabled={pending || !changed}>
          <Save aria-hidden="true" />
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </section>
  );
}
