"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setFreePlanCap } from "@/lib/admin/free-plan";

/**
 * The launch cap, changed without a deploy. Asks before lowering it to the
 * accounts already started or below, which closes Free to new sign-ups.
 */
export function FreePlanCapForm({ cap, taken }: { cap: number; taken: number }) {
  const router = useRouter();
  const id = useId();
  const [value, setValue] = useState(String(cap));
  const [pending, start] = useTransition();

  function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = Number(value);
    if (next <= taken && !window.confirm(`${taken} accounts have started Free. A cap of ${next} closes Free to new sign-ups. Save it?`)) return;
    start(async () => {
      const result = await setFreePlanCap(next).catch(() => null);
      if (!result?.ok) {
        toast.error(result?.error ?? "The server did not finish this. Try again.");
        return;
      }
      toast.success(`The cap is now ${next}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={save} className="flex flex-wrap items-end gap-3 px-4 py-4 sm:px-5">
      <div className="space-y-1.5">
        <label htmlFor={id} className="text-sm font-medium">
          Free spots (cap)
        </label>
        <Input
          id={id}
          type="number"
          min={0}
          max={10000}
          step={1}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="w-32"
        />
      </div>
      <Button type="submit" disabled={pending || value === String(cap)}>
        Save cap
      </Button>
      <p className="w-full text-xs text-muted-foreground">
        Shown on the Free card as &quot;{taken} / {value || "?"} free spots taken&quot;. At the cap, new sign-ups are offered the paid
        plans&apos; free trial instead; nobody already on Free loses it.
      </p>
    </form>
  );
}
