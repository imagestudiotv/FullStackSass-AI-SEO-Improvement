"use client";

import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";
import type { ReactNode } from "react";

import { localePath, type Locale } from "@/lib/i18n/config";
import { TOOL_UNAVAILABLE } from "@/lib/tools/i18n/unavailable";

/**
 * The free tools' on/off switch, on the page (Admin -> Free tools). The tools
 * layouts read which tools are off and pass them here; the segment below the
 * layout is the tool's slug, so one gate covers every tool page without each
 * page knowing about it. A tool that is off shows a friendly "temporarily
 * unavailable" page instead - and its server work refuses too
 * (lib/tools/tool-tracking.ts), so the page is never the only guard.
 */
export function ToolGate({ disabled, locale, children }: { disabled: readonly string[]; locale: Locale; children: ReactNode }) {
  const segment = useSelectedLayoutSegment();
  if (!segment || !disabled.includes(segment)) return children;
  return <ToolUnavailable locale={locale} />;
}

export function ToolUnavailable({ locale }: { locale: Locale }) {
  const copy = TOOL_UNAVAILABLE[locale];
  return (
    <div className="mx-auto max-w-2xl px-4 py-24 text-center">
      <h1 className="text-3xl font-semibold tracking-tight text-balance">{copy.title}</h1>
      <p className="mx-auto mt-4 max-w-xl text-pretty text-muted-foreground">{copy.body}</p>
      <Link
        prefetch={false}
        href={localePath(locale, "/tools")}
        className="mt-8 inline-flex h-11 items-center rounded-full bg-primary px-7 font-medium text-primary-foreground transition-opacity hover:opacity-90"
      >
        {copy.link}
      </Link>
    </div>
  );
}
