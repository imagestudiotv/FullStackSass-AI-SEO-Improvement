"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { setAutoPublish, setGenerationMode } from "@/lib/websites/actions";
import { cn } from "@/lib/utils";

/**
 * How articles get written and what happens to them once they are.
 *
 * Two settings, in the order the work happens: whether we write on a schedule,
 * then whether what we wrote goes live by itself. Kept on one card because
 * answering the second question only makes sense once the first is answered —
 * "publish automatically" means something different when nothing is being
 * written automatically.
 */

/** 0 = Sunday, matching Date.getUTCDay() and the scheduler. */
const DAYS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];

function Toggle({
  id,
  checked,
  disabled,
  onChange,
}: {
  id: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors",
        checked ? "bg-primary" : "bg-input",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      {/*
        A real checkbox under the styling, so the control works from the
        keyboard and announces itself. A div with a click handler would look
        identical and be unusable for some customers.
      */}
      <input
        id={id}
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none inline-block size-5 rounded-full bg-background shadow transition-transform",
          checked ? "translate-x-[1.375rem]" : "translate-x-0.5",
        )}
      />
    </label>
  );
}

export function GenerationPanel({
  websiteId,
  mode,
  days,
  autoPublish,
  hasIntegration,
}: {
  websiteId: string;
  mode: "automatic" | "manual";
  days: number[];
  autoPublish: boolean;
  hasIntegration: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  /**
   * Optimistic. A toggle that waits for a round trip reads as broken, so the
   * control moves immediately and is put back if the save fails — it never
   * shows a state the database does not have.
   */
  const [auto, setAuto] = useState(mode === "automatic");
  const [selectedDays, setSelectedDays] = useState<number[]>(days);
  const [publish, setPublish] = useState(autoPublish);

  function saveMode(nextAuto: boolean, nextDays: number[]) {
    const previousAuto = auto;
    const previousDays = selectedDays;
    setAuto(nextAuto);
    setSelectedDays(nextDays);

    startTransition(async () => {
      const result = await setGenerationMode(
        websiteId,
        nextAuto ? "automatic" : "manual",
        nextDays,
      );
      if (!result.ok) {
        setAuto(previousAuto);
        setSelectedDays(previousDays);
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  }

  function togglePublish(next: boolean) {
    setPublish(next);
    startTransition(async () => {
      const result = await setAutoPublish(websiteId, next);
      if (!result.ok) {
        setPublish(!next);
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  }

  /**
   * Turns one day on or off.
   *
   * An empty list means "every day", and the buttons render as all-on to say
   * so. That made the first click do the opposite of what it looked like:
   * with nothing stored, clicking Saturday to switch it OFF added Saturday to
   * an empty list and produced Saturday-only. Someone removing weekends got
   * weekends-only, which is the worst possible outcome of that gesture.
   *
   * Expanding the empty list to all seven before removing makes the first
   * click mean what the buttons show.
   */
  function toggleDay(day: number) {
    const current =
      selectedDays.length === 0 ? DAYS.map((d) => d.value) : selectedDays;

    const next = current.includes(day)
      ? current.filter((d) => d !== day)
      : [...current, day];

    /**
     * Turning the last day off would stop generation with the buttons still
     * reading "any day", so it is treated as clearing the restriction
     * instead. A schedule that silently writes nothing is worse than one that
     * writes on days the customer did not pick.
     */
    saveMode(auto, next.length === 0 ? [] : next.sort((a, b) => a - b));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          Writing and publishing
          {pending ? (
            <Loader2
              className="size-4 animate-spin text-muted-foreground"
              aria-hidden="true"
            />
          ) : null}
        </CardTitle>
        <CardDescription>
          How your articles get written, and what happens to them when they are
          ready.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <label htmlFor="generation-mode" className="text-sm font-medium">
              Write articles automatically
            </label>
            <p className="text-sm text-muted-foreground">
              {auto
                ? "We work through your content plan on its own. You can still write any article yourself at any time."
                : "Nothing is written until you ask. Open a planned article and press Write."}
            </p>
          </div>
          <Toggle
            id="generation-mode"
            checked={auto}
            disabled={pending}
            onChange={(next) => saveMode(next, selectedDays)}
          />
        </div>

        {auto ? (
          <div className="space-y-2 border-l pl-4">
            <p className="text-sm font-medium">Days to write on</p>
            <p className="text-sm text-muted-foreground">
              {selectedDays.length === 0
                ? "Any day."
                : "Only on the days you pick."}
            </p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {DAYS.map((day) => {
                const on =
                  selectedDays.length === 0 || selectedDays.includes(day.value);
                return (
                  <Button
                    key={day.value}
                    type="button"
                    variant={on ? "default" : "outline"}
                    size="sm"
                    disabled={pending}
                    aria-pressed={on}
                    onClick={() => toggleDay(day.value)}
                    className="h-8 w-14"
                  >
                    {day.label}
                  </Button>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className="flex items-start justify-between gap-4 border-t pt-5">
          <div className="space-y-1">
            <label htmlFor="auto-publish" className="text-sm font-medium">
              Publish without asking me
            </label>
            <p className="text-sm text-muted-foreground">
              {publish
                ? "Finished articles go live on your website by themselves."
                : "Finished articles are saved as drafts for you to review first."}
            </p>
            {publish && !hasIntegration ? (
              <p className="text-sm text-muted-foreground">
                Connect a website below first. Until then articles stay as
                drafts.
              </p>
            ) : null}
          </div>
          <Toggle
            id="auto-publish"
            checked={publish}
            disabled={pending}
            onChange={togglePublish}
          />
        </div>
      </CardContent>
    </Card>
  );
}
