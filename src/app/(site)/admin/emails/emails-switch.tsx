"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";

import { Switch } from "@/components/ui/switch";
import { setLifecycleEmails } from "@/lib/admin/emails";

/**
 * The lifecycle emails' one switch. Asks before turning them on - from that
 * moment real customers are emailed - and not before turning them off,
 * which is the safe direction.
 */
export function LifecycleEmailsSwitch({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const id = useId();
  const [on, setOn] = useState(enabled);
  const [pending, start] = useTransition();

  function change(next: boolean) {
    if (next && !window.confirm("Turn lifecycle emails on? Customers will start receiving them from now on.")) return;
    setOn(next);
    start(async () => {
      const result = await setLifecycleEmails(next).catch(() => null);
      if (!result?.ok) {
        setOn(!next);
        toast.error("The server did not finish this. Try again.");
        return;
      }
      toast.success(next ? "Lifecycle emails are on" : "Lifecycle emails are off");
      router.refresh();
    });
  }

  return (
    <div className="flex items-start justify-between gap-4 px-4 py-4 sm:px-5">
      <div className="min-w-0">
        <p id={`${id}-label`} className="text-sm font-medium">
          Lifecycle emails {on ? "are on" : "are off"}
        </p>
        <p id={`${id}-help`} className="mt-0.5 text-sm text-muted-foreground">
          While off, none of the emails below is sent and nothing is logged. Once on, they follow what happens from then on, plus
          reminders that are still due (a free period ending tomorrow); there is no backlog of what happened while they were off.
        </p>
      </div>
      <Switch
        checked={on}
        onCheckedChange={change}
        disabled={pending}
        aria-labelledby={`${id}-label`}
        aria-describedby={`${id}-help`}
      />
    </div>
  );
}
