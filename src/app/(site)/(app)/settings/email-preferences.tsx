"use client";

import { Mail } from "lucide-react";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";

import { Switch } from "@/components/ui/switch";
import { WorkspaceSection } from "@/components/workspace/section";
import { saveTipsEmails } from "@/lib/email/preference-actions";
import type { EmailsCopy } from "@/lib/i18n/emails";

/**
 * The Account page's Emails section: one switch, for the lifecycle emails a
 * person may turn off (docs/emails.md). The essential ones are named in the
 * help text so nobody thinks this stops their billing emails.
 *
 * Saved on change, like the language picker above it; reverted if the
 * server refuses, so the switch never shows a state the account is not in.
 */
export function EmailPreferences({ initialTips, t }: { initialTips: boolean; t: EmailsCopy }) {
  const id = useId();
  const [tips, setTips] = useState(initialTips);
  const [pending, start] = useTransition();

  function change(next: boolean) {
    setTips(next);
    start(async () => {
      const result = await saveTipsEmails(next).catch(() => null);
      if (!result?.ok) {
        setTips(!next);
        toast.error(t.error);
        return;
      }
      toast.success(t.saved);
    });
  }

  return (
    <WorkspaceSection id="emails" icon={Mail} title={t.settingsTitle} description={t.settingsSubtitle}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p id={`${id}-label`} className="text-sm font-medium">
            {t.tipsLabel}
          </p>
          <p id={`${id}-help`} className="mt-0.5 text-sm text-muted-foreground">
            {t.tipsHelp}
          </p>
        </div>
        <Switch
          checked={tips}
          onCheckedChange={change}
          disabled={pending}
          aria-labelledby={`${id}-label`}
          aria-describedby={`${id}-help`}
        />
      </div>
    </WorkspaceSection>
  );
}
