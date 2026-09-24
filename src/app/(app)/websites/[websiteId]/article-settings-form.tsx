"use client";

import { Check, Eye, Loader2, X } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Messages } from "@/lib/i18n/messages";
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

  /* Brand voice, merged in from the old "How we write" panel. */
  tone: string;
  vocabulary: string;
  avoid: string;
  /** One per line, as the customer types them. */
  usps: string;
  facts: string;
  articleInstructions: string;
};

export function ArticleSettingsForm({
  websiteId,
  initial,
  reviewed,
  t,
  tCommon,
}: {
  websiteId: string;
  initial: ArticleSettingsValues;
  /**
   * Whether these settings have ever been saved.
   *
   * False means the launch checklist is still waiting on this step, which is
   * what decides whether the confirm bar below is worth showing.
   */
  reviewed: boolean;
  /** This screen's copy, already in the reader's language. */
  t: Messages["app"]["article"];
  /** Shared words used on several screens. */
  tCommon: Messages["app"]["common"];
}) {
  const [values, setValues] = useState<ArticleSettingsValues>(initial);
  const [saved, setSaved] = useState<ArticleSettingsValues>(initial);
  const [pending, startTransition] = useTransition();
  /** The enlarged sample, or null. */
  const [preview, setPreview] = useState<{ src: string; label: string } | null>(
    null,
  );

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
          <h2 className="text-base font-semibold">{t.contentSeo}</h2>
          <p className="text-sm text-muted-foreground">{t.contentSeoHelp}</p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-5">
          <div className="min-w-0">
            <p className="text-sm font-medium">{t.publishAs}</p>
            <p className="text-sm text-muted-foreground">
              {values.publishAs === "live"
                ? t.publishLive
                : t.publishDraft}
            </p>
          </div>
          {/*
            A segmented control, not a checkbox. Live and Draft are both real
            choices with names; a tickbox labelled "publish as draft" makes
            one of them the absence of the other.
          */}
          <div
            role="radiogroup"
            aria-label={t.publishAs}
            className="flex shrink-0 rounded-full border bg-muted/50 p-1"
          >
            {(["live", "draft"] as const).map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={values.publishAs === option}
                onClick={() => set("publishAs", option)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  values.publishAs === option
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {option === "live" ? t.live : t.draft}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-5 border-t pt-5 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="article-style">{t.articleStyle}</Label>
            <select
              id="article-style"
              value={values.articleStyle}
              onChange={(e) => set("articleStyle", e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              {ARTICLE_STYLES.map((style) => (
                <option key={style.id} value={style.id}>
                  {t.styles[style.id]?.label ?? style.label}
                </option>
              ))}
            </select>
            {/*
              The hint follows the choice rather than listing all four: the
              design shows one line under the dropdown, and somebody deciding
              between styles wants to know what THIS one does.
            */}
            <p className="text-xs text-muted-foreground">
              {t.styles[values.articleStyle]?.hint ??
                styleHint(values.articleStyle)}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="internal-links">{t.internalLinks}</Label>
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
            <p className="text-xs text-muted-foreground">{t.internalLinksHelp}</p>
          </div>
        </div>

        <div className="space-y-3 border-t pt-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">{t.targetWordCount}</p>
              <p className="text-sm text-muted-foreground">
                {adaptive
                  ? t.adaptiveOn
                  : t.adaptiveOff}
              </p>
            </div>
            <div
              role="radiogroup"
              aria-label={t.targetWordCount}
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
                {tCommon.adaptive}
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
                {tCommon.custom}
              </button>
            </div>
          </div>

          {adaptive ? null : (
            <div className="max-w-xs space-y-1.5">
              <Label htmlFor="word-count">{t.wordsPerArticle}</Label>
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
                {tCommon.wordRange}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Content details ------------------------------------------------ */}
      <section className="space-y-5 rounded-2xl border bg-card p-6">
        <div>
          <h2 className="text-base font-semibold">{t.contentDetails}</h2>
          <p className="text-sm text-muted-foreground">
            {t.contentDetailsHelp}
          </p>
        </div>

        <UrlField
          id="sitemap-url"
          label={t.sitemapUrl}
          hint="Lets us find pages worth linking to from new articles."
          placeholder="https://example.com/sitemap.xml"
          value={values.sitemapUrl}
          onChange={(v) => set("sitemapUrl", v)}
        />
        <UrlField
          id="blog-url"
          label={t.blogAddress}
          hint="Where published articles should appear."
          placeholder="https://example.com/blog"
          value={values.blogUrl}
          onChange={(v) => set("blogUrl", v)}
        />
        <UrlField
          id="example-url"
          label={t.bestArticle}
          hint="One article you are happy with. We match its shape and depth."
          placeholder="https://example.com/blog/a-good-one"
          value={values.exampleArticleUrl}
          onChange={(v) => set("exampleArticleUrl", v)}
        />
      </section>

      {/* Engagement ------------------------------------------------------ */}
      <section className="space-y-6 rounded-2xl border bg-card p-6">
        <div>
          <h2 className="text-base font-semibold">{t.engagement}</h2>
          <p className="text-sm text-muted-foreground">
            {t.engagementHelp}
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="brand-color">{t.brandColour}</Label>
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
              aria-label={t.brandColour}
            />
            <Input
              value={values.brandColor}
              onChange={(e) => set("brandColor", e.target.value)}
              placeholder="#003388"
              className="max-w-40 font-mono"
              aria-label={t.brandColour}
            />
          </div>
        </div>

        <PresetGrid
          legend="Image style"
          hint="Applies to images inside the article body."
          options={IMAGE_STYLES}
          value={values.imageStyle}
          onChange={(v) => set("imageStyle", v)}
          kind="body"
          onPreview={setPreview}
        />

        <PresetGrid
          legend="Featured image"
          hint="The cover at the top of each article, also used in link previews."
          options={FEATURED_IMAGE_STYLES}
          value={values.featuredImageStyle}
          onChange={(v) => set("featuredImageStyle", v)}
          kind="featured"
          /* So "Match article images" names the style it will actually use. */
          matches={
            IMAGE_STYLES.find((s) => s.id === values.imageStyle)?.label
          }
          onPreview={setPreview}
        />

        <div className="space-y-1.5">
          <Label htmlFor="image-brief">{t.imageBrief}</Label>
          <textarea
            id="image-brief"
            rows={3}
            value={values.imageBrief}
            onChange={(e) => set("imageBrief", e.target.value)}
            placeholder={t.imageBriefPlaceholder}
            className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="image-instructions">
            {t.imageInstructions}{" "}
            <span className="font-normal text-muted-foreground">{t.optional}</span>
          </Label>
          <textarea
            id="image-instructions"
            rows={2}
            value={values.imageInstructions}
            onChange={(e) => set("imageInstructions", e.target.value)}
            placeholder={t.imageInstructionsPlaceholder}
            className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
        </div>

        <div className="space-y-1 border-t pt-5">
          <Toggle
            label={t.tableOfContents}
            hint="Adds a contents list built from the article headings."
            checked={values.tableOfContents}
            onChange={(v) => set("tableOfContents", v)}
          />
          <Toggle
            label={t.youtubeVideo}
            hint="Finds and embeds a relevant video."
            checked={values.youtubeVideo}
            onChange={(v) => set("youtubeVideo", v)}
          />
          <Toggle
            label={t.authorPerspective}
            hint="Writes with a point of view rather than impersonally."
            checked={values.authorPerspective}
            onChange={(v) => set("authorPerspective", v)}
          />
          <Toggle
            label={t.mentionSimilar}
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
            label={t.poweredBy}
            hint="A small credit at the end of each article. Turning it off applies to articles not yet published."
            checked={values.poweredByLink}
            onChange={(v) => set("poweredByLink", v)}
          />
        </div>
      </section>

      {/* How we write ---------------------------------------------------- */}
      <section className="space-y-5 rounded-2xl border bg-card p-6">
        <div>
          <h2 className="text-base font-semibold">{t.howWeWrite}</h2>
          <p className="text-sm text-muted-foreground">
            {tCommon.voiceBehindArticles}
            </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="tone">{t.toneLabel}</Label>
          <Input
            id="tone"
            value={values.tone}
            onChange={(e) => set("tone", e.target.value)}
            placeholder={t.tonePlaceholder}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="instructions">{t.rulesLabel}</Label>
          <textarea
            id="instructions"
            rows={2}
            value={values.articleInstructions}
            onChange={(e) => set("articleInstructions", e.target.value)}
            placeholder={t.rulesPlaceholder}
            className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="facts">{t.factsLabel}</Label>
          <textarea
            id="facts"
            rows={3}
            value={values.facts}
            onChange={(e) => set("facts", e.target.value)}
            placeholder={"Open since 2004\nFive dentists on the team\nFree parking on site"}
            className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
          {/*
            Worth spelling out why this field earns its place: the writer is
            forbidden from inventing details about a business, which leaves
            articles vague about the customer specifically. These are the
            only specifics it is allowed to state, because a human confirmed
            them.
          */}
          <p className="text-xs text-muted-foreground">
            {tCommon.factsOnePerLine}
            </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="usps">{t.uspsLabel}</Label>
          <textarea
            id="usps"
            rows={3}
            value={values.usps}
            onChange={(e) => set("usps", e.target.value)}
            placeholder={"Same-day emergency appointments\nWe see nervous patients"}
            className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
          <p className="text-xs text-muted-foreground">{t.onePerLine}</p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="vocabulary">{t.preferLabel}</Label>
            <Input
              id="vocabulary"
              value={values.vocabulary}
              onChange={(e) => set("vocabulary", e.target.value)}
              placeholder={t.preferPlaceholder}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="avoid">{t.avoidLabel}</Label>
            <Input
              id="avoid"
              value={values.avoid}
              onChange={(e) => set("avoid", e.target.value)}
              placeholder={t.avoidPlaceholder}
            />
          </div>
        </div>
      </section>

      {/* Author bio ------------------------------------------------------ */}
      <section className="space-y-5 rounded-2xl border bg-card p-6">
        <div>
          <h2 className="text-base font-semibold">{t.author}</h2>
          <p className="text-sm text-muted-foreground">
            {t.authorHelp}
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="author-name">{t.authorName}</Label>
            <Input
              id="author-name"
              value={values.authorName}
              onChange={(e) => set("authorName", e.target.value)}
              placeholder={t.authorNamePlaceholder}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="author-bio">{t.shortBio}</Label>
          <textarea
            id="author-bio"
            rows={3}
            value={values.authorBio}
            onChange={(e) => set("authorBio", e.target.value)}
            placeholder={t.shortBioPlaceholder}
            className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
          <p className="text-xs text-muted-foreground">
            {t.noBylineHelp}
          </p>
        </div>
      </section>

      {/*
        The fixed save bar.

        Rendered only when something has changed. The spacer below it stops
        the last field hiding behind the bar; z-40 keeps it over the page and
        under the chat widget, which sets its own much higher stacking.
      */}
      {/*
        NO SPACER HERE. The bar is fixed to the viewport and covers whatever
        is at the bottom of the PAGE, which is not this component - the
        schedule and brand-voice panels render after it. Space inside the
        form would push the form's own content down and leave the panels
        below it just as covered.

        The page reserves the room instead; see publishing/page.tsx.
      */}
      {/*
        The enlarged sample.

        A plain overlay rather than a dialog component: it holds one image and
        a close control, and the page has no other modal to be consistent
        with. Escape and a click on the backdrop both close it, because those
        are the two things everybody tries.

        z-50 puts it over the save bar at z-40 - the bar is pinned to the
        bottom and would otherwise cut across a full-height image.
      */}
      {preview ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${preview.label} style sample`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/60 p-4 backdrop-blur-sm"
          onClick={() => setPreview(null)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setPreview(null);
          }}
          tabIndex={-1}
        >
          <div
            className="relative max-h-full w-full max-w-lg overflow-hidden rounded-2xl bg-card shadow-xl"
            /* The image is not a dismiss target; only the backdrop is. */
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- local asset */}
            <img
              src={preview.src}
              alt={`${preview.label} style sample`}
              className="w-full bg-muted object-contain"
            />
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <p className="text-sm font-medium">{preview.label}</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPreview(null)}
                aria-label={t.closePreview}
              >
                <X className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {/*
        Keeping every default is a decision, and it needs a button.

        The save bar below appears only while something has CHANGED, which is
        right for a settings form - but it left one state with no way out: a
        customer who read these settings, decided the defaults suited them and
        wanted to move on had nothing to press, and the launch checklist kept
        "Configure your article preferences" open forever. The client:
        "If by any chance user don't change anything they can't having this
        mark completed. But there are chances people can keep settings by
        default, especial for the first days until they understand the
        platform."

        So a customer who has never saved gets a confirm bar instead. It calls
        the same action, which records the review - see
        articleSettingsReviewedAt - and the step ticks.

        Gone once the settings have been saved even once: it exists to close
        the step, and a permanent "these are fine" control on a form nobody is
        editing is clutter.
      */}
      {!reviewed && !dirty ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/40 px-4 py-3">
          <p className="text-sm text-muted-foreground">
            {tCommon.defaultsAreFine}
          </p>
          <Button onClick={handleSave} disabled={pending} size="sm">
            {pending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Check className="size-4" aria-hidden="true" />
            )}
            {tCommon.keepDefaults}
          </Button>
        </div>
      ) : null}

      {dirty ? (
        <>
          {/*
            KEPT INSIDE THE CONTENT COLUMN, ON BOTH SIDES.

            `fixed` positions against the viewport, not the main area, so a
            bar spanning the full width crosses both of the things that frame
            it.

            RIGHT: the setup tracker and the chat launcher are pinned to the
            bottom-right corner, above this bar in the stacking order. Edge to
            edge, the bar ran underneath them and its Save button - which sits
            at the right end of the row - was the part they covered. The one
            control the bar exists for was the one you could not press.
            sm:pr-[21rem] clears right-4 (1rem) plus the panel's w-80 (20rem),
            at the same `sm` breakpoint the panel appears on.

            LEFT: the sidebar is an in-flow column, not an overlay, so the bar
            ignored it and slid underneath - the strip and its top border ran
            across the navigation, which reads as the bar belonging to the
            whole window rather than to the form it is about. md:left-60
            matches the sidebar's own w-60 at the same `md` breakpoint it
            appears on.

            Below those breakpoints neither element renders, so the bar keeps
            the full width on a phone and loses no room.
          */}
          <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur sm:pr-[21rem] md:left-60">
            <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
              <p className="text-sm text-muted-foreground">{t.unsavedChanges}</p>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  onClick={() => setValues(saved)}
                  disabled={pending}
                >
                  {tCommon.discard}
                </Button>
                <Button onClick={handleSave} disabled={pending}>
                  {pending ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      {tCommon.checking}
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
 * A row of style presets, each showing what that style produces.
 *
 * THE SAMPLES ARE REAL. Every thumbnail was generated with the same wording
 * the article generator uses (IMAGE_STYLE_PROMPTS, via
 * scripts/generate-style-samples.mjs), so a card shows what picking it
 * actually does rather than a stock picture chosen because it looks good. If
 * a style's wording changes, the script is re-run and the sample changes with
 * it; a sample that no longer matches its prompt would be worse than none,
 * because it is a promise about output.
 *
 * All eight use the same subject - one person at a laptop - so the only thing
 * differing between cards is the style. A different scene per card would turn
 * a style comparison into a subject comparison.
 *
 * "Match article images" has no sample: it follows whatever the body style is,
 * so any picture would claim a fixed look it does not have. It shows the
 * chosen body style's name instead, which is the truthful answer.
 */
function PresetGrid({
  legend,
  hint,
  options,
  value,
  onChange,
  /** "body" or "featured" - picks which sample set to show. */
  kind,
  /** What "Match article images" currently resolves to. */
  matches,
  onPreview,
}: {
  legend: string;
  hint: string;
  options: { id: string; label: string; hint: string }[];
  value: string;
  onChange: (value: string) => void;
  kind: "body" | "featured";
  matches?: string;
  onPreview: (sample: { src: string; label: string }) => void;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{legend}</legend>
      <p className="text-xs text-muted-foreground">{hint}</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {options.map((option) => {
          const active = option.id === value;
          const src =
            option.id === "match"
              ? null
              : `/style-samples/${kind}-${option.id}.webp`;

          return (
            <div
              key={option.id}
              className={`relative overflow-hidden rounded-xl border transition-colors ${
                active
                  ? "border-primary ring-1 ring-primary"
                  : "hover:border-muted-foreground/40"
              }`}
            >
              {/*
                The card itself is the radio. The preview is a separate
                button on top of it, because a click on the thumbnail should
                SELECT the style - that is what somebody means by clicking a
                choice - and only the eye icon should enlarge it.
              */}
              <button
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onChange(option.id)}
                className="block w-full text-left"
              >
                {src ? (
                  /* eslint-disable-next-line @next/next/no-img-element --
                     A fixed-size local thumbnail; next/image would add an
                     optimiser round trip for an asset already the right
                     size and format. */
                  <img
                    src={src}
                    alt={`${option.label} style sample`}
                    className="aspect-[4/3] w-full bg-muted object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex aspect-[4/3] w-full items-center justify-center bg-muted px-2 text-center">
                    <span className="text-xs text-muted-foreground">
                      {matches ? `Uses ${matches}` : "Follows the body style"}
                    </span>
                  </div>
                )}

                <span className="block px-3 py-2">
                  <span className="block text-sm font-medium">
                    {option.label}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {option.hint}
                  </span>
                </span>
              </button>

              {src ? (
                <button
                  type="button"
                  onClick={() => onPreview({ src, label: option.label })}
                  aria-label={`Preview the ${option.label} style`}
                  className="absolute top-2 right-2 rounded-full bg-background/90 p-1.5 text-muted-foreground shadow-sm backdrop-blur transition-colors hover:text-foreground"
                >
                  <Eye className="size-3.5" aria-hidden="true" />
                </button>
              ) : null}
            </div>
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
