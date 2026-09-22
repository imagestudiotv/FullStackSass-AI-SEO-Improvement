"use client";

import { Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ARTICLE_STYLES, styleHint } from "@/lib/websites/article-options";
import {
  saveArticleSettings,
  type ArticleSettingsInput,
} from "@/lib/websites/article-settings";

/**
 * Content & SEO, the first section of the client's Article Settings design.
 *
 * ONE SAVE FOR THE WHOLE SCREEN, pinned to the bottom of the viewport. The
 * client asked for exactly this: "we can have a Save button fixed here, so
 * once we scroll we can save the setting each time we want, instead of having
 * save buttons on each section we scroll." A long form with a save per card
 * makes you hunt for the right one, and leaves the screen in a state where
 * some sections are written and others are not.
 *
 * The bar appears only once something has changed, so it is not a permanent
 * strip over the content, and it says "Unsaved changes" rather than sitting
 * there silently — a button that is always present teaches people to stop
 * seeing it.
 */

export type ArticleSettingsValues = {
  publishAs: "live" | "draft";
  articleStyle: string;
  internalLinkTarget: number;
  targetWordCount: number | null;
};

export function ArticleSettingsForm({
  websiteId,
  initial,
}: {
  websiteId: string;
  initial: ArticleSettingsValues;
}) {
  const [values, setValues] = useState<ArticleSettingsValues>(initial);
  const [saved, setSaved] = useState<ArticleSettingsValues>(initial);
  const [pending, startTransition] = useTransition();

  /** Shallow compare is enough: every field is a primitive or null. */
  const dirty = (Object.keys(values) as (keyof ArticleSettingsValues)[]).some(
    (key) => values[key] !== saved[key],
  );

  function set<K extends keyof ArticleSettingsValues>(
    key: K,
    value: ArticleSettingsValues[K],
  ) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function handleSave() {
    startTransition(async () => {
      const payload: ArticleSettingsInput = { ...values };
      const result = await saveArticleSettings(websiteId, payload);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setSaved(values);
      toast.success("Settings saved");
    });
  }

  /** Adaptive is the null case; Custom needs a number to edit. */
  const adaptive = values.targetWordCount === null;

  return (
    <>
      <section className="space-y-6 rounded-2xl border bg-card p-6">
        <div>
          <h2 className="text-base font-semibold">Content &amp; SEO</h2>
          <p className="text-sm text-muted-foreground">
            How every article is written, and what happens to it once it is.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-5">
          <div className="min-w-0">
            <p className="text-sm font-medium">Publish as</p>
            <p className="text-sm text-muted-foreground">
              {values.publishAs === "live"
                ? "Articles go live on your site at their scheduled time."
                : "Articles are sent as drafts for you to review first."}
            </p>
          </div>
          {/*
            A segmented control, not a checkbox. Live and Draft are both real
            choices with names; a tickbox labelled "publish as draft" makes
            one of them the absence of the other.
          */}
          <div
            role="radiogroup"
            aria-label="Publish as"
            className="flex shrink-0 rounded-full border bg-muted/50 p-1"
          >
            {(["live", "draft"] as const).map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={values.publishAs === option}
                onClick={() => set("publishAs", option)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium capitalize transition-colors ${
                  values.publishAs === option
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-5 border-t pt-5 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="article-style">Article style</Label>
            <select
              id="article-style"
              value={values.articleStyle}
              onChange={(e) => set("articleStyle", e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              {ARTICLE_STYLES.map((style) => (
                <option key={style.id} value={style.id}>
                  {style.label}
                </option>
              ))}
            </select>
            {/*
              The hint follows the choice rather than listing all four: the
              design shows one line under the dropdown, and somebody deciding
              between styles wants to know what THIS one does.
            */}
            <p className="text-xs text-muted-foreground">
              {styleHint(values.articleStyle)}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="internal-links">Internal links</Label>
            <Input
              id="internal-links"
              type="number"
              min={0}
              max={20}
              value={values.internalLinkTarget}
              onChange={(e) =>
                set("internalLinkTarget", Number(e.target.value) || 0)
              }
            />
            <p className="text-xs text-muted-foreground">
              Target internal links per article.
            </p>
          </div>
        </div>

        <div className="space-y-3 border-t pt-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">Target word count</p>
              <p className="text-sm text-muted-foreground">
                {adaptive
                  ? "We pick the best length for each article type."
                  : "One fixed length across every format."}
              </p>
            </div>
            <div
              role="radiogroup"
              aria-label="Target word count"
              className="flex shrink-0 rounded-full border bg-muted/50 p-1"
            >
              <button
                type="button"
                role="radio"
                aria-checked={adaptive}
                onClick={() => set("targetWordCount", null)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  adaptive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Adaptive
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={!adaptive}
                onClick={() =>
                  set("targetWordCount", values.targetWordCount ?? 1200)
                }
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  !adaptive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Custom
              </button>
            </div>
          </div>

          {adaptive ? null : (
            <div className="max-w-xs space-y-1.5">
              <Label htmlFor="word-count">Words per article</Label>
              <Input
                id="word-count"
                type="number"
                min={300}
                max={5000}
                step={100}
                value={values.targetWordCount ?? 1200}
                onChange={(e) =>
                  set("targetWordCount", Number(e.target.value) || 300)
                }
              />
              <p className="text-xs text-muted-foreground">
                Between 300 and 5,000.
              </p>
            </div>
          )}
        </div>
      </section>

      {/*
        The fixed save bar.

        Rendered only when something has changed. The spacer below it stops
        the last field hiding behind the bar; z-40 keeps it over the page and
        under the chat widget, which sets its own much higher stacking.
      */}
      {dirty ? (
        <>
          <div className="h-20" aria-hidden="true" />
          <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur">
            <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
              <p className="text-sm text-muted-foreground">Unsaved changes</p>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  onClick={() => setValues(saved)}
                  disabled={pending}
                >
                  Discard
                </Button>
                <Button onClick={handleSave} disabled={pending}>
                  {pending ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    "Save"
                  )}
                </Button>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
