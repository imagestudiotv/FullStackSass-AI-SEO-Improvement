"use client";

import { useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  checkDescription,
  checkTitle,
  SNIPPET_LIMITS,
  type LengthVerdict,
} from "@/lib/tools/snippet";

import type { SnippetFormCopy } from "./copy";

/**
 * Search snippet preview.
 *
 * Runs entirely in the browser: the check is pure string length, so a round
 * trip per keystroke would be slower and cost us money for nothing.
 *
 * The preview deliberately looks like a search result rather than a form
 * field. "58 characters" means little; seeing your own title cut mid-word in
 * something that looks like Google is immediately obvious.
 */

const TONE: Record<LengthVerdict, string> = {
  short: "text-amber-700 dark:text-amber-400",
  good: "text-emerald-700 dark:text-emerald-400",
  long: "text-red-600 dark:text-red-400",
};

/**
 * Truncates the way a search result does — at a word boundary with an
 * ellipsis, not mid-character. Approximate, and labelled as such below.
 */
function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/** The advice for a check, in the visitor's language: the check decides the verdict, the copy says it. */
function advice(check: { length: number; verdict: LengthVerdict }, words: SnippetFormCopy["titleAdvice"], min: number, max: number): string {
  const text = check.length === 0 ? words.empty : check.verdict === "short" ? words.short : check.verdict === "long" ? words.long : words.good;
  return text.replace("{min}", String(min)).replace("{max}", String(max));
}

export function SnippetForm({ copy }: { copy: SnippetFormCopy }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");

  const titleCheck = checkTitle(title);
  const descCheck = checkDescription(description);

  const displayUrl = url.trim() || copy.displayUrl;

  return (
    <div className="space-y-8">
      <div className="space-y-5">
        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between">
            <Label htmlFor="title">{copy.pageTitle}</Label>
            <span className={`text-xs tabular-nums ${TONE[titleCheck.verdict]}`}>
              {titleCheck.length} / {SNIPPET_LIMITS.titleMax}
            </span>
          </div>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={copy.titlePlaceholder}
          />
          <p className="text-xs text-muted-foreground">{advice(titleCheck, copy.titleAdvice, SNIPPET_LIMITS.titleMin, SNIPPET_LIMITS.titleMax)}</p>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between">
            <Label htmlFor="description">{copy.descriptionLabel}</Label>
            <span className={`text-xs tabular-nums ${TONE[descCheck.verdict]}`}>
              {descCheck.length} / {SNIPPET_LIMITS.metaMax}
            </span>
          </div>
          <textarea
            id="description"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={copy.descPlaceholder}
            className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
          <p className="text-xs text-muted-foreground">{advice(descCheck, copy.descAdvice, SNIPPET_LIMITS.metaMin, SNIPPET_LIMITS.metaMax)}</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="url">{copy.urlLabel}</Label>
          <Input
            id="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={copy.urlPlaceholder}
          />
        </div>
      </div>

      {/* The preview. Styled to read as a search result, not a form output. */}
      <div>
        <p className="mb-3 text-sm font-medium">{copy.previewTitle}</p>
        <div className="rounded-lg border bg-background p-4">
          <p className="truncate text-xs text-muted-foreground">{displayUrl}</p>
          <p className="mt-1 text-lg text-[#1a0dab] dark:text-[#8ab4f8]">
            {title.trim()
              ? truncate(title.trim(), SNIPPET_LIMITS.titleMax)
              : copy.titleEmpty}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {description.trim()
              ? truncate(description.trim(), SNIPPET_LIMITS.metaMax)
              : copy.descEmpty}
          </p>
        </div>
        {/*
          Said plainly rather than implied. Google truncates on pixel width,
          which varies per character, so a character count is a good guide and
          not a guarantee — and a tool that pretends otherwise is one a
          customer eventually catches out.
        */}
        <p className="mt-3 text-xs text-muted-foreground">{copy.widthNote}</p>
      </div>
    </div>
  );
}
