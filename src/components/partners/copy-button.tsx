"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

/** Copies a ready-made text. Copying fails silently: the text stays selectable on the page. */
export function CopyButton({ text, label, copiedLabel, describedBy }: { text: string; label: string; copiedLabel: string; describedBy?: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Selectable on the page; nothing else to do.
    }
  }
  return (
    <Button type="button" variant="outline" size="sm" onClick={copy} aria-describedby={describedBy}>
      {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
      <span aria-live="polite">{copied ? copiedLabel : label}</span>
    </Button>
  );
}
