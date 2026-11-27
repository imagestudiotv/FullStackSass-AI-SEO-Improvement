"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { setToolDailyCap, setToolEnabled } from "@/lib/admin/free-tools";

/**
 * One free tool's switch. Asks before switching a tool off: visitors then
 * see "temporarily unavailable" on its page at once.
 */
export function ToolSwitch({ tool, name, enabled }: { tool: string; name: string; enabled: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(enabled);
  const [pending, start] = useTransition();

  function change(next: boolean) {
    if (!next && !window.confirm(`Switch ${name} off? Its page shows "temporarily unavailable" and its server work stops.`)) return;
    setOn(next);
    start(async () => {
      const result = await setToolEnabled(tool, next).catch(() => null);
      if (!result?.ok) {
        setOn(!next);
        toast.error(result?.error ?? "The server did not finish this. Try again.");
        return;
      }
      toast.success(`${name} is ${next ? "on" : "off"}`);
      router.refresh();
    });
  }

  return <Switch checked={on} onCheckedChange={change} disabled={pending} aria-label={`${name}: ${on ? "on" : "off"}`} />;
}

/** One AI tool's daily spend cap, in dollars; empty and "Use default" go back to the default in code. */
export function ToolCapForm({
  tool,
  name,
  capCents,
  fromSetting,
}: {
  tool: string;
  name: string;
  capCents: number | null;
  fromSetting: boolean;
}) {
  const router = useRouter();
  const id = useId();
  const initial = capCents === null ? "" : (capCents / 100).toFixed(2);
  const [value, setValue] = useState(initial);
  const [pending, start] = useTransition();

  function save(cents: number | null) {
    start(async () => {
      const result = await setToolDailyCap(tool, cents).catch(() => null);
      if (!result?.ok) {
        toast.error(result?.error ?? "The server did not finish this. Try again.");
        return;
      }
      const after = result.data.dailyCapCents;
      setValue(after === null ? "" : (after / 100).toFixed(2));
      toast.success(after === null ? `${name}: no daily cap` : `${name}: $${(after / 100).toFixed(2)} a day`);
      router.refresh();
    });
  }

  return (
    <form
      className="flex items-center gap-1.5"
      onSubmit={(event) => {
        event.preventDefault();
        const trimmed = value.trim();
        save(trimmed === "" ? null : Math.round(Number(trimmed) * 100));
      }}
    >
      <label htmlFor={id} className="sr-only">
        Daily AI cap for {name}, in US dollars
      </label>
      <span className="text-sm text-muted-foreground" aria-hidden="true">
        $
      </span>
      <Input
        id={id}
        type="number"
        min={0}
        max={1000}
        step={0.01}
        value={value}
        placeholder="none"
        onChange={(event) => setValue(event.target.value)}
        className="h-8 w-24"
      />
      <Button type="submit" size="sm" variant="outline" disabled={pending || value === initial}>
        Save
      </Button>
      {fromSetting ? (
        <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => save(null)}>
          Use default
        </Button>
      ) : null}
    </form>
  );
}
