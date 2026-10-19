"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** The partner's link, selectable and copyable. Copying fails silently: the field stays selectable. */
export function ReferralLink({ url, label, copyLabel, copiedLabel }: { url: string; label: string; copyLabel: string; copiedLabel: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // The field is selectable; nothing else to do.
    }
  }
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <Input readOnly value={url} aria-label={label} onFocus={(event) => event.currentTarget.select()} className="font-mono text-sm" />
      <Button type="button" variant="outline" onClick={copy} className="shrink-0">
        {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
        <span aria-live="polite">{copied ? copiedLabel : copyLabel}</span>
      </Button>
    </div>
  );
}
