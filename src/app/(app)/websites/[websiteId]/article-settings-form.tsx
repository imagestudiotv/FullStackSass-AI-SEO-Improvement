"use client";

import { Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ARTICLE_STYLES,
  FEATURED_IMAGE_STYLES,
  IMAGE_STYLES,
  styleHint,
} from "@/lib/websites/article-options";
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

  sitemapUrl: string;
  blogUrl: string;
  exampleArticleUrl: string;

  brandColor: string;
  imageStyle: string;
  featuredImageStyle: string;
  imageBrief: string;
  imageInstructions: string;

  tableOfContents: boolean;
  youtubeVideo: boolean;
  authorPerspective: boolean;
  mentionSimilarProducts: boolean;
  poweredByLink: boolean;

  authorName: string;
  authorBio: string;
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

      {/* Content details ------------------------------------------------ */}
      <section className="space-y-5 rounded-2xl border bg-card p-6">
        <div>
          <h2 className="text-base font-semibold">Content details</h2>
          <p className="text-sm text-muted-foreground">
            Where your content lives, so we can link to it and match its shape.
          </p>
        </div>

        <UrlField
          id="sitemap-url"
          label="Sitemap URL"
          hint="Lets us find pages worth linking to from new articles."
          placeholder="https://example.com/sitemap.xml"
          value={values.sitemapUrl}
          onChange={(v) => set("sitemapUrl", v)}
        />
        <UrlField
          id="blog-url"
          label="Main blog address"
          hint="Where published articles should appear."
          placeholder="https://example.com/blog"
          value={values.blogUrl}
          onChange={(v) => set("blogUrl", v)}
        />
        <UrlField
          id="example-url"
          label="Your best article example"
          hint="One article you are happy with. We match its shape and depth."
          placeholder="https://example.com/blog/a-good-one"
          value={values.exampleArticleUrl}
          onChange={(v) => set("exampleArticleUrl", v)}
        />
      </section>

      {/* Engagement ------------------------------------------------------ */}
      <section className="space-y-6 rounded-2xl border bg-card p-6">
        <div>
          <h2 className="text-base font-semibold">Engagement</h2>
          <p className="text-sm text-muted-foreground">
            How articles look, and what gets added alongside the words.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="brand-color">Brand colour</Label>
          <div className="flex items-center gap-2">
            {/*
              A native colour input beside a text field. The swatch is how
              most people pick; the hex box is how somebody with a brand
              guide pastes the exact value they were given.
            */}
            <input
              id="brand-color"
              type="color"
              value={
                /^#[0-9a-f]{6}$/i.test(values.brandColor)
                  ? values.brandColor
                  : "#000000"
              }
              onChange={(e) => set("brandColor", e.target.value)}
              className="size-9 shrink-0 cursor-pointer rounded-md border bg-transparent p-1"
              aria-label="Brand colour swatch"
            />
            <Input
              value={values.brandColor}
              onChange={(e) => set("brandColor", e.target.value)}
              placeholder="#003388"
              className="max-w-40 font-mono"
              aria-label="Brand colour hex"
            />
          </div>
        </div>

        <PresetGrid
          legend="Image style"
          hint="Applies to images inside the article body."
          options={IMAGE_STYLES}
          value={values.imageStyle}
          onChange={(v) => set("imageStyle", v)}
        />

        <PresetGrid
          legend="Featured image"
          hint="The cover at the top of each article, also used in link previews."
          options={FEATURED_IMAGE_STYLES}
          value={values.featuredImageStyle}
          onChange={(v) => set("featuredImageStyle", v)}
        />

        <div className="space-y-1.5">
          <Label htmlFor="image-brief">
            How your brand should look in images
          </Label>
          <textarea
            id="image-brief"
            rows={3}
            value={values.imageBrief}
            onChange={(e) => set("imageBrief", e.target.value)}
            placeholder="Cinematic, minimal, cool greys with accents of electric blue."
            className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="image-instructions">
            Extra image instructions{" "}
            <span className="font-normal text-muted-foreground">Optional</span>
          </Label>
          <textarea
            id="image-instructions"
            rows={2}
            value={values.imageInstructions}
            onChange={(e) => set("imageInstructions", e.target.value)}
            placeholder="e.g. Never show faces."
            className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
        </div>

        <div className="space-y-1 border-t pt-5">
          <Toggle
            label="Table of contents"
            hint="Adds a contents list built from the article headings."
            checked={values.tableOfContents}
            onChange={(v) => set("tableOfContents", v)}
          />
          <Toggle
            label="YouTube video"
            hint="Finds and embeds a relevant video."
            checked={values.youtubeVideo}
            onChange={(v) => set("youtubeVideo", v)}
          />
          <Toggle
            label="Author perspective"
            hint="Writes with a point of view rather than impersonally."
            checked={values.authorPerspective}
            onChange={(v) => set("authorPerspective", v)}
          />
          <Toggle
            label="Mention similar products and tools"
            hint="References and compares alternatives, for richer coverage."
            checked={values.mentionSimilarProducts}
            onChange={(v) => set("mentionSimilarProducts", v)}
          />
          {/*
            The client was specific about this one: on by default, and
            turning it off "applies to articles that are not published yet".
            A credit line already live on someone else's site is not ours to
            reach back and edit, so the copy says so rather than implying a
            retroactive change.
          */}
          <Toggle
            label="Powered by RepGet link"
            hint="A small credit at the end of each article. Turning it off applies to articles not yet published."
            checked={values.poweredByLink}
            onChange={(v) => set("poweredByLink", v)}
          />
        </div>
      </section>

      {/* Author bio ------------------------------------------------------ */}
      <section className="space-y-5 rounded-2xl border bg-card p-6">
        <div>
          <h2 className="text-base font-semibold">Author</h2>
          <p className="text-sm text-muted-foreground">
            The byline shown on each article, here and on your live site.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="author-name">Author name</Label>
            <Input
              id="author-name"
              value={values.authorName}
              onChange={(e) => set("authorName", e.target.value)}
              placeholder="Your name, or the brand"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="author-bio">Short bio</Label>
          <textarea
            id="author-bio"
            rows={3}
            value={values.authorBio}
            onChange={(e) => set("authorBio", e.target.value)}
            placeholder="One or two sentences on who is writing and why they know."
            className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
          <p className="text-xs text-muted-foreground">
            Left empty, articles publish without a byline.
          </p>
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


/** A labelled URL field with its hint. */
function UrlField({
  id,
  label,
  hint,
  placeholder,
  value,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="url"
        inputMode="url"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

/**
 * A row of style presets.
 *
 * Buttons in a radiogroup rather than a select: the design shows them as
 * cards, and the choice is visual - a list of words would make somebody
 * guess what "Watercolour" looks like in their own articles.
 *
 * NO PREVIEW IMAGES YET, deliberately. The design shows a sample picture on
 * each card; showing a stock example would be pretending to show THEIR
 * article in that style. The label and its one-line hint stand in until
 * there are real generated samples to put there.
 */
function PresetGrid({
  legend,
  hint,
  options,
  value,
  onChange,
}: {
  legend: string;
  hint: string;
  options: { id: string; label: string; hint: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{legend}</legend>
      <p className="text-xs text-muted-foreground">{hint}</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {options.map((option) => {
          const active = option.id === value;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(option.id)}
              className={`rounded-xl border p-3 text-left transition-colors ${
                active
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "hover:bg-accent"
              }`}
            >
              <span className="block text-sm font-medium">{option.label}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {option.hint}
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/** One labelled switch. */
function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-sm text-muted-foreground">{hint}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors ${
          checked ? "bg-primary" : "bg-muted-foreground/30"
        }`}
      >
        <span
          className={`absolute top-0.5 size-5 rounded-full bg-background transition-all ${
            checked ? "left-[1.375rem]" : "left-0.5"
          }`}
        />
      </button>
    </div>
  );
}
