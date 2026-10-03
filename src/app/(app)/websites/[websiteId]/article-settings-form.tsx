"use client";

import { ImageIcon, Link2, MessageSquareQuote, PenLine, Sparkles, UserRound } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";

import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/workspace/field";
import { SaveBar } from "@/components/workspace/save-bar";
import { WorkspaceSection } from "@/components/workspace/section";
import { useUnsavedChanges } from "@/components/workspace/use-unsaved-changes";
import { format, plural } from "@/lib/i18n/format";
import type { Messages } from "@/lib/i18n/messages";
import { ARTICLE_STYLES, FEATURED_IMAGE_STYLE_IDS, IMAGE_STYLE_IDS } from "@/lib/websites/article-options";
import { saveArticleSettings } from "@/lib/websites/article-settings";
import { styleSampleSrc } from "@/lib/websites/style-samples";
import { cn } from "@/lib/utils";

import { BrandColourField } from "./publishing/brand-colour-field";
import { ConfirmDefaultsBar } from "./publishing/confirm-defaults-bar";
import { SaveModeTag, SectionIntro } from "./publishing/save-mode-tag";
import {
  bottomBar,
  countChanges,
  FIELD_IDS,
  firstInvalid,
  LIMITS,
  mergeAfterSave,
  normalise,
  saveBarState,
  SECTION_IDS,
  toFormValues,
  toInput,
  validate,
  type ArticleSettingsValues,
  type FieldError,
  type FieldErrors,
  type FieldKey,
  type StoredArticleSettings,
} from "./publishing/settings-model";
import { StylePicker, type StyleCard } from "./publishing/style-picker";

export type { ArticleSettingsValues, StoredArticleSettings };

/** A native select drawn exactly like Input (h-8, rounded-lg, same focus ring). */
const SELECT_CLASS =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive md:text-sm";

/**
 * Article Settings, sections A-F: everything saved by the ONE Save button.
 *
 * ONE SAVE, pinned to the bottom of the viewport (the client asked for a
 * fixed Save rather than one per card). Writing and publishing (section G,
 * GenerationPanel) is NOT part of it: those controls save the moment they
 * change, as they always have, and every section is tagged with which rule it
 * follows so nobody presses Save expecting it to cover them, or misses a Save
 * they needed.
 *
 * EDITS DURING A SAVE ARE KEPT. Fields stay editable while a save is in
 * flight; when it returns, only the snapshot that was actually sent is marked
 * saved, and anything typed since stays pending (with a note saying so).
 *
 * VALIDATED BEFORE SENDING, against the server's own limits, so the bar
 * never says "Saved" for a value the server would clamp, truncate or drop.
 */
export function ArticleSettingsForm({
  websiteId,
  initial,
  reviewed,
  canEdit,
  t,
  tCommon,
  tWorkspace,
}: {
  websiteId: string;
  initial: StoredArticleSettings;
  /**
   * Whether these settings have ever been saved. False shows the "keep the
   * defaults" bar, which closes the launch checklist's preferences step.
   */
  reviewed: boolean;
  /** False for a viewer: every control is read-only and nothing can be saved. */
  canEdit: boolean;
  t: Messages["app"]["article"];
  tCommon: Messages["app"]["common"];
  tWorkspace: Messages["app"]["workspace"];
}) {
  const [values, setValues] = useState<ArticleSettingsValues>(() => toFormValues(initial));
  /** The last values the server confirmed, as it stores them. */
  const [saved, setSaved] = useState<ArticleSettingsValues>(() => toFormValues(initial));
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [savedThisVisit, setSavedThisVisit] = useState(false);
  /** The last save returned while newer edits were waiting. */
  const [editsKept, setEditsKept] = useState(false);
  /** Errors show once a field has been left, or after Save was pressed. */
  const [touched, setTouched] = useState<Partial<Record<FieldKey, true>>>({});
  const [attempted, setAttempted] = useState(false);

  /** The latest committed values, read when a save returns (see save()). */
  const latest = useRef(values);
  useEffect(() => {
    latest.current = values;
  }, [values]);

  const changes = countChanges(values, saved);
  const errors = validate(values);
  useUnsavedChanges(canEdit && changes > 0, tWorkspace.leaveConfirm);

  function set<K extends FieldKey>(key: K, value: ArticleSettingsValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setFailure(null);
  }

  function touch(key: FieldKey) {
    setTouched((prev) => (prev[key] ? prev : { ...prev, [key]: true }));
  }

  function errorFor(key: FieldKey): string | null {
    if (!attempted && !touched[key]) return null;
    return errorText(errors[key]);
  }

  function errorText(error: FieldError | undefined): string | null {
    if (!error) return null;
    switch (error.code) {
      case "links":
        return t.linksError;
      case "words":
        return t.wordsError;
      case "url":
        return t.urlError;
      case "colour":
        return t.brandColourError;
      case "tooManyLines":
        return plural(t.tooManyLines, error.over, { max: error.max });
      case "lineTooLong":
        return format(t.lineTooLong, { line: error.line, max: error.max });
      case "tooLong":
        // The field's own counter says "n characters over the limit".
        return null;
    }
  }

  async function save() {
    if (!canEdit || saving) return;

    // Only what changed can block: an unchanged value is what is stored already.
    const blocking: FieldErrors = {};
    for (const key of Object.keys(errors) as FieldKey[]) {
      if (values[key] !== saved[key]) blocking[key] = errors[key];
    }
    const first = firstInvalid(blocking);
    if (first) {
      setAttempted(true);
      setFailure(t.fixFields);
      const element = FIELD_IDS[first] ? document.getElementById(FIELD_IDS[first]) : null;
      element?.focus({ preventScroll: true });
      element?.scrollIntoView({ block: "center" });
      return;
    }

    const sent = values;
    const stored = normalise(sent);
    setSaving(true);
    setFailure(null);
    let result: Awaited<ReturnType<typeof saveArticleSettings>>;
    try {
      result = await saveArticleSettings(websiteId, toInput(stored));
    } catch {
      result = { ok: false, error: t.saveError };
    }
    setSaving(false);
    if (!result.ok) {
      setFailure(result.error);
      return;
    }

    // Mark ONLY the snapshot that was sent as saved; edits made since stay pending.
    setSaved(stored);
    setValues((current) => mergeAfterSave(current, sent, stored));
    setEditsKept(countChanges(mergeAfterSave(latest.current, sent, stored), stored) > 0);
    setSavedThisVisit(true);
    setAttempted(false);
    setTouched({});
  }

  function discard() {
    setValues(saved);
    setFailure(null);
    setAttempted(false);
    setTouched({});
    setEditsKept(false);
  }

  const bar = bottomBar({ canEdit, reviewed: reviewed || savedThisVisit, changes });
  const readOnly = !canEdit;
  /* How each section is kept - only for people who have a Save button. */
  const intro = (help: string) => (
    <SectionIntro help={help}>{canEdit ? <SaveModeTag mode="button" t={tWorkspace} /> : null}</SectionIntro>
  );

  /* --- Image style cards ------------------------------------------------ */

  const bodyLabel = (id: string) => t.bodyImageStyles[id]?.label ?? id;
  const bodyCards: StyleCard[] = IMAGE_STYLE_IDS.map((id) => ({
    id,
    label: bodyLabel(id),
    hint: t.bodyImageStyles[id]?.hint ?? "",
    thumb: styleSampleSrc("body", id, "thumb"),
    large: styleSampleSrc("body", id, "large"),
  }));
  const bodyKnown = (IMAGE_STYLE_IDS as readonly string[]).includes(values.imageStyle);
  const followed = bodyKnown ? bodyLabel(values.imageStyle) : null;
  const coverCards: StyleCard[] = FEATURED_IMAGE_STYLE_IDS.map((id) =>
    id === "match"
      ? {
          // Derived, never stored: shows whichever image style is chosen above,
          // updating as that changes. The stored value stays "match".
          id,
          label: t.coverImageStyles.match?.label ?? id,
          hint: t.coverImageStyles.match?.hint ?? "",
          thumb: bodyKnown ? styleSampleSrc("body", values.imageStyle, "thumb") : null,
          large: bodyKnown ? styleSampleSrc("body", values.imageStyle, "large") : null,
          caption: followed ? format(t.matchFollows, { style: followed }) : t.matchFollowsUnknown,
          previewTitle: followed ? format(t.previewMatchTitle, { style: followed }) : undefined,
          sampleStyle: followed ?? undefined,
        }
      : {
          id,
          label: t.coverImageStyles[id]?.label ?? id,
          hint: t.coverImageStyles[id]?.hint ?? "",
          thumb: styleSampleSrc("featured", id, "thumb"),
          large: styleSampleSrc("featured", id, "large"),
        },
  );
  const coverKnown = (FEATURED_IMAGE_STYLE_IDS as readonly string[]).includes(values.featuredImageStyle);

  const articleStyleKnown = ARTICLE_STYLES.some((style) => style.id === values.articleStyle);
  const adaptive = values.targetWordCount === null;

  const toggles: { key: "tableOfContents" | "youtubeVideo" | "authorPerspective" | "mentionSimilarProducts" | "comparisonTable" | "poweredByLink"; label: string; hint: string }[] = [
    { key: "tableOfContents", label: t.tableOfContents, hint: t.tocHint },
    { key: "youtubeVideo", label: t.youtubeVideo, hint: t.youtubeHint },
    { key: "authorPerspective", label: t.authorPerspective, hint: t.perspectiveHint },
    { key: "mentionSimilarProducts", label: t.mentionSimilar, hint: t.similarHint },
    { key: "comparisonTable", label: t.comparisonTable, hint: t.comparisonHint },
    { key: "poweredByLink", label: t.poweredBy, hint: t.poweredByHint },
  ];

  return (
    <>
      {/* A. Writing and SEO ------------------------------------------------ */}
      <WorkspaceSection
        id={SECTION_IDS.writing}
        icon={PenLine}
        title={t.sectionWriting}
        description={intro(t.sectionWritingHelp)}
        bodyClassName="space-y-5"
      >
        <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
          <Field
            id="article-style"
            label={t.articleStyle}
            // The hint follows the choice: someone deciding wants to know what THIS one does.
            hint={t.styles[values.articleStyle]?.hint}
            t={tWorkspace}
          >
            {(props) => (
              <select
                {...props}
                value={values.articleStyle}
                onChange={(event) => set("articleStyle", event.target.value)}
                disabled={readOnly}
                className={SELECT_CLASS}
              >
                {articleStyleKnown ? null : (
                  <option value={values.articleStyle}>{format(t.unknownOption, { value: values.articleStyle })}</option>
                )}
                {ARTICLE_STYLES.map((style) => (
                  <option key={style.id} value={style.id}>
                    {t.styles[style.id]?.label ?? style.label}
                  </option>
                ))}
              </select>
            )}
          </Field>

          <Field
            id="internal-links"
            label={t.internalLinks}
            hint={t.internalLinksHelp}
            error={errorFor("internalLinkTarget")}
            t={tWorkspace}
          >
            {(props) => (
              <Input
                {...props}
                type="number"
                inputMode="numeric"
                min={LIMITS.links.min}
                max={LIMITS.links.max}
                step={1}
                value={values.internalLinkTarget}
                onChange={(event) => set("internalLinkTarget", event.target.value)}
                onBlur={() => touch("internalLinkTarget")}
                disabled={readOnly}
                className="max-w-32"
              />
            )}
          </Field>
        </div>

        <div className="space-y-4 border-t pt-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <p id="word-mode-label" className="text-sm font-medium text-foreground">
                {t.targetWordCount}
              </p>
              <p id="word-mode-hint" className="text-xs leading-5 text-muted-foreground">
                {adaptive ? t.adaptiveOn : t.adaptiveOff}
              </p>
            </div>
            <WordCountChoice
              adaptive={adaptive}
              disabled={readOnly}
              labels={{ adaptive: tCommon.adaptive, custom: tCommon.custom }}
              onChange={(nextAdaptive) =>
                set(
                  "targetWordCount",
                  nextAdaptive ? null : (values.targetWordCount ?? saved.targetWordCount ?? String(LIMITS.words.fallback)),
                )
              }
            />
          </div>

          {adaptive ? null : (
            <Field
              id="word-count"
              label={t.wordsPerArticle}
              hint={tCommon.wordRange}
              error={errorFor("targetWordCount")}
              t={tWorkspace}
              className="max-w-xs"
            >
              {(props) => (
                <Input
                  {...props}
                  type="number"
                  inputMode="numeric"
                  min={LIMITS.words.min}
                  max={LIMITS.words.max}
                  step={100}
                  value={values.targetWordCount ?? ""}
                  onChange={(event) => set("targetWordCount", event.target.value)}
                  onBlur={() => touch("targetWordCount")}
                  disabled={readOnly}
                  className="max-w-40"
                />
              )}
            </Field>
          )}
        </div>
      </WorkspaceSection>

      {/* B. Content sources ------------------------------------------------ */}
      <WorkspaceSection
        id={SECTION_IDS.sources}
        icon={Link2}
        title={t.sectionSources}
        description={intro(t.sectionSourcesHelp)}
      >
        <div className="grid gap-x-4 gap-y-5 md:grid-cols-2">
          {(
            [
              { key: "sitemapUrl", id: "sitemap-url", label: t.sitemapUrl, hint: t.sitemapHint, placeholder: "https://example.com/sitemap.xml" },
              { key: "blogUrl", id: "blog-url", label: t.blogAddress, hint: t.blogHint, placeholder: "https://example.com/blog" },
              { key: "exampleArticleUrl", id: "example-url", label: t.bestArticle, hint: t.exampleHint, placeholder: "https://example.com/blog/a-good-one" },
            ] as const
          ).map((field) => (
            <Field
              key={field.key}
              id={field.id}
              label={field.label}
              hint={field.hint}
              error={errorFor(field.key)}
              optional
              t={tWorkspace}
            >
              {(props) => (
                <Input
                  {...props}
                  type="url"
                  inputMode="url"
                  autoComplete="url"
                  spellCheck={false}
                  placeholder={field.placeholder}
                  value={values[field.key]}
                  onChange={(event) => set(field.key, event.target.value)}
                  onBlur={() => touch(field.key)}
                  disabled={readOnly}
                />
              )}
            </Field>
          ))}
        </div>
      </WorkspaceSection>

      {/* C. Images and branding ------------------------------------------- */}
      <WorkspaceSection
        id={SECTION_IDS.images}
        icon={ImageIcon}
        title={t.sectionImages}
        description={intro(t.sectionImagesHelp)}
        bodyClassName="space-y-6"
      >
        <BrandColourField
          value={values.brandColor}
          onChange={(value) => set("brandColor", value)}
          onBlur={() => touch("brandColor")}
          error={errorFor("brandColor")}
          disabled={readOnly}
          t={t}
          tWorkspace={tWorkspace}
        />

        <div className="space-y-6 border-t pt-5">
          <StylePicker
            id="image-style"
            label={t.imageStyleLabel}
            hint={t.imageStyleHint}
            cards={bodyCards}
            value={values.imageStyle}
            onChange={(id) => set("imageStyle", id)}
            disabled={readOnly}
            note={bodyKnown ? undefined : format(t.unknownImageStyle, { value: values.imageStyle })}
            t={t}
            tWorkspace={tWorkspace}
          />
          <StylePicker
            id="cover-style"
            label={t.coverStyleLabel}
            hint={t.coverStyleHint}
            cards={coverCards}
            value={values.featuredImageStyle}
            onChange={(id) => set("featuredImageStyle", id)}
            disabled={readOnly}
            note={coverKnown ? undefined : format(t.unknownImageStyle, { value: values.featuredImageStyle })}
            t={t}
            tWorkspace={tWorkspace}
          />
          <p className="text-xs leading-5 text-muted-foreground">{t.samplesNote}</p>
        </div>

        <div className="grid gap-x-4 gap-y-5 border-t pt-5 lg:grid-cols-2">
          <Field id="image-brief" label={t.imageBrief} hint={t.imageBriefHint} optional t={tWorkspace}>
            {(props) => (
              <Textarea
                {...props}
                rows={3}
                value={values.imageBrief}
                onChange={(event) => set("imageBrief", event.target.value)}
                placeholder={t.imageBriefPlaceholder}
                disabled={readOnly}
              />
            )}
          </Field>
          <Field id="image-instructions" label={t.imageInstructions} optional t={tWorkspace}>
            {(props) => (
              <Textarea
                {...props}
                rows={3}
                value={values.imageInstructions}
                onChange={(event) => set("imageInstructions", event.target.value)}
                placeholder={t.imageInstructionsPlaceholder}
                disabled={readOnly}
              />
            )}
          </Field>
        </div>
      </WorkspaceSection>

      {/* D. Article enhancements ------------------------------------------ */}
      <WorkspaceSection
        id={SECTION_IDS.enhancements}
        icon={Sparkles}
        title={t.sectionEnhancements}
        description={intro(t.sectionEnhancementsHelp)}
      >
        <ul className="divide-y">
          {toggles.map((toggle) => (
            <li key={toggle.key} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0 space-y-0.5">
                <p id={`${toggle.key}-label`} className="text-sm font-medium text-foreground">
                  {toggle.label}
                </p>
                <p id={`${toggle.key}-hint`} className="text-xs leading-5 text-muted-foreground">
                  {toggle.hint}
                </p>
              </div>
              <Switch
                checked={values[toggle.key]}
                onCheckedChange={(checked) => set(toggle.key, checked)}
                aria-labelledby={`${toggle.key}-label`}
                aria-describedby={`${toggle.key}-hint`}
                disabled={readOnly}
                className="mt-0.5"
              />
            </li>
          ))}
        </ul>
      </WorkspaceSection>

      {/* E. Brand voice ---------------------------------------------------- */}
      <WorkspaceSection
        id={SECTION_IDS.voice}
        icon={MessageSquareQuote}
        title={t.sectionVoice}
        description={intro(t.sectionVoiceHelp)}
        bodyClassName="space-y-5"
      >
        <Field
          id="tone"
          label={t.toneLabel}
          count={{ value: values.tone.length, max: LIMITS.text.tone }}
          optional
          t={tWorkspace}
        >
          {(props) => (
            <Input
              {...props}
              value={values.tone}
              onChange={(event) => set("tone", event.target.value)}
              placeholder={t.tonePlaceholder}
              disabled={readOnly}
            />
          )}
        </Field>

        <Field
          id="instructions"
          label={t.rulesLabel}
          count={{ value: values.articleInstructions.length, max: LIMITS.text.articleInstructions }}
          optional
          t={tWorkspace}
        >
          {(props) => (
            <Textarea
              {...props}
              rows={3}
              value={values.articleInstructions}
              onChange={(event) => set("articleInstructions", event.target.value)}
              placeholder={t.rulesPlaceholder}
              disabled={readOnly}
            />
          )}
        </Field>

        <div className="grid gap-x-4 gap-y-5 lg:grid-cols-2">
          <Field
            id="facts"
            label={t.factsLabel}
            // The writer may state only these specifics, because a person confirmed them.
            hint={tCommon.factsOnePerLine}
            error={errorFor("facts")}
            optional
            t={tWorkspace}
          >
            {(props) => (
              <Textarea
                {...props}
                rows={5}
                value={values.facts}
                onChange={(event) => set("facts", event.target.value)}
                onBlur={() => touch("facts")}
                placeholder={t.factsPlaceholder}
                disabled={readOnly}
              />
            )}
          </Field>
          <Field
            id="usps"
            label={t.uspsLabel}
            hint={t.onePerLine}
            error={errorFor("usps")}
            optional
            t={tWorkspace}
          >
            {(props) => (
              <Textarea
                {...props}
                rows={5}
                value={values.usps}
                onChange={(event) => set("usps", event.target.value)}
                onBlur={() => touch("usps")}
                placeholder={t.uspsPlaceholder}
                disabled={readOnly}
              />
            )}
          </Field>
        </div>

        <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
          <Field
            id="vocabulary"
            label={t.preferLabel}
            count={{ value: values.vocabulary.length, max: LIMITS.text.vocabulary }}
            optional
            t={tWorkspace}
          >
            {(props) => (
              <Input
                {...props}
                value={values.vocabulary}
                onChange={(event) => set("vocabulary", event.target.value)}
                placeholder={t.preferPlaceholder}
                disabled={readOnly}
              />
            )}
          </Field>
          <Field
            id="avoid"
            label={t.avoidLabel}
            count={{ value: values.avoid.length, max: LIMITS.text.avoid }}
            optional
            t={tWorkspace}
          >
            {(props) => (
              <Input
                {...props}
                value={values.avoid}
                onChange={(event) => set("avoid", event.target.value)}
                placeholder={t.avoidPlaceholder}
                disabled={readOnly}
              />
            )}
          </Field>
        </div>
      </WorkspaceSection>

      {/* F. Author --------------------------------------------------------- */}
      <WorkspaceSection
        id={SECTION_IDS.author}
        icon={UserRound}
        title={t.sectionAuthor}
        description={intro(t.sectionAuthorHelp)}
        bodyClassName="space-y-5"
      >
        <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
          <Field id="author-name" label={t.authorName} optional t={tWorkspace}>
            {(props) => (
              <Input
                {...props}
                value={values.authorName}
                onChange={(event) => set("authorName", event.target.value)}
                placeholder={t.authorNamePlaceholder}
                autoComplete="off"
                disabled={readOnly}
              />
            )}
          </Field>
        </div>
        <Field id="author-bio" label={t.shortBio} optional t={tWorkspace}>
          {(props) => (
            <Textarea
              {...props}
              rows={3}
              value={values.authorBio}
              onChange={(event) => set("authorBio", event.target.value)}
              placeholder={t.shortBioPlaceholder}
              disabled={readOnly}
            />
          )}
        </Field>
      </WorkspaceSection>

      {bar === "confirm" ? (
        <ConfirmDefaultsBar
          saving={saving}
          failure={failure}
          onConfirm={save}
          tCommon={tCommon}
          tWorkspace={tWorkspace}
        />
      ) : bar === "save" ? (
        <SaveBar
          state={saveBarState({ changes, saving, failure, savedThisVisit })}
          onSave={save}
          onDiscard={discard}
          note={
            editsKept && changes > 0 ? (
              tWorkspace.editsKept
            ) : (
              // From sm up only: on a phone the bar's text column is narrow and the
              // scope is already on every section, so the bar stays short.
              <span className="hidden sm:inline">{t.saveBarNote}</span>
            )
          }
          t={tWorkspace}
        />
      ) : null}
    </>
  );
}

/**
 * Adaptive or Custom word count: a two-option radio group (arrow keys move
 * and choose, one Tab stop). Choosing only changes the form.
 */
function WordCountChoice({
  adaptive,
  disabled,
  labels,
  onChange,
}: {
  adaptive: boolean;
  disabled: boolean;
  labels: { adaptive: string; custom: string };
  onChange: (adaptive: boolean) => void;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const options = [
    { adaptive: true, label: labels.adaptive },
    { adaptive: false, label: labels.custom },
  ];

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === "Home" ? 0 : event.key === "End" ? 1 : 1 - index;
    onChange(options[next].adaptive);
    refs.current[next]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-labelledby="word-mode-label"
      aria-describedby="word-mode-hint"
      className="inline-flex shrink-0 rounded-lg border bg-muted/40 p-0.5"
    >
      {options.map((option, index) => {
        const checked = option.adaptive === adaptive;
        return (
          <button
            key={option.label}
            ref={(node) => {
              refs.current[index] = node;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(option.adaptive)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cn(
              "h-7 rounded-md px-3 text-sm whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none",
              checked ? "bg-background font-medium text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
