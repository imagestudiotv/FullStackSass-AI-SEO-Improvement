"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setArticlesPerDay } from "@/lib/admin/daily-limits";

import { DialogError, DialogNotes, Spinner } from "../organizations/dialog-fields";

/** Mirrors MAX_DAILY_LIMIT in lib/publishing/daily-cap.ts; the server still decides. */
const MAX = 100;

/**
 * "Articles per day" for one website (lib/publishing/daily-cap.ts): how many
 * articles the scheduler may start for it per day, whatever its monthly
 * allowance. Opened from the website's row menu (website-actions.tsx).
 */
export function DailyLimitDialog({
  websiteId,
  domain,
  perDay,
  open,
  onClose,
}: {
  websiteId: string;
  domain: string;
  /** The limit in force; null when there is none. */
  perDay: number | null;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [value, setValue] = useState(perDay === null ? "" : String(perDay));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const number = Number(value);
  const valid = value.trim() !== "" && Number.isInteger(number) && number >= 1 && number <= MAX;

  function close() {
    setValue(perDay === null ? "" : String(perDay));
    setError(null);
    onClose();
  }

  function save(next: number | null) {
    setError(null);
    startTransition(async () => {
      const result = await setArticlesPerDay(websiteId, next);
      if (!result.ok) {
        setError(result.error);
        toast.error(result.error);
        return;
      }
      toast.success(
        result.data.perDay === null
          ? `${domain}: no daily limit`
          : `${domain}: at most ${result.data.perDay} article${result.data.perDay === 1 ? "" : "s"} a day`,
      );
      onClose();
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next || pending ? null : close())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="wrap-anywhere">Articles per day for {domain}</DialogTitle>
          <DialogDescription>
            The most articles RepGet writes for this website on its own each day, whatever its monthly allowance.
            {perDay === null ? " Now: no daily limit." : ` Now: ${perDay} a day.`}
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (valid && !pending) save(number);
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="articles-per-day">Articles per day</Label>
            <Input
              id="articles-per-day"
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX}
              step={1}
              value={value}
              onChange={(event) => setValue(event.target.value)}
              disabled={pending}
              aria-describedby="articles-per-day-hint"
              className="w-32"
            />
            <p id="articles-per-day-hint" className="text-xs text-muted-foreground">
              A whole number from 1 to {MAX}.
            </p>
          </div>

          <DialogNotes>
            <li>Applies from the next scheduled run (06:00 and 14:00 UTC). Articles already started today count.</li>
            <li>Topics not written move forward on the calendar; none are lost.</li>
            <li>&quot;Write&quot; pressed by hand is not limited.</li>
            <li>Recorded in the admin log.</li>
          </DialogNotes>

          <DialogError message={error} />

          <DialogFooter className="gap-2 sm:justify-between">
            {perDay !== null ? (
              <Button type="button" variant="outline" disabled={pending} onClick={() => save(null)}>
                Remove limit
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="ghost" disabled={pending} onClick={close}>
                Cancel
              </Button>
              <Button type="submit" disabled={!valid || pending}>
                {pending ? <Spinner /> : null}
                Save
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
