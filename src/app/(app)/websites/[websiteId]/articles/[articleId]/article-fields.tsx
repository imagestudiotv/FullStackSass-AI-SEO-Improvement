"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/workspace/field";
import { format } from "@/lib/i18n/format";
import type { Messages } from "@/lib/i18n/messages";

import {
  META_MAX,
  META_SHOWN,
  savedForm,
  slugDropsLetters,
  slugFromInput,
  TITLE_MAX,
  type ArticleFields,
  type FieldKey,
} from "./draft-state";

/**
 * Title, meta description and address: the fields that travel with the
 * text and are saved with it. Limits are the server's (the title is cut at
 * 200 characters, the description at 300), enforced as you type rather than
 * discovered after a save; the address shows what it will be saved as,
 * because the server tidies it (and drops accented letters). How a search
 * result may show them is in the supporting panel (search-appearance.tsx).
 */
export function ArticleFields({
  values,
  onChange,
  disabled,
  wordPressLive,
  t,
  tWorkspace,
}: {
  values: ArticleFields;
  onChange: (key: FieldKey, value: string) => void;
  disabled: boolean;
  /** Published to WordPress directly: its updates keep the first address. */
  wordPressLive: boolean;
  t: Messages["app"]["editor"];
  tWorkspace: Messages["app"]["workspace"];
}) {
  const titleMissing = savedForm("title", values.title) === "";
  const slug = slugFromInput(values.slug);
  // The address set in its own (monospaced) span, wherever the language puts it in the sentence.
  const [savedAsBefore = "", savedAsAfter = ""] = t.slugSavedAs.split("{slug}");

  return (
    <div className="space-y-5">
      <Field
        id="article-title"
        label={t.title}
        required
        error={titleMissing ? t.titleRequired : null}
        count={{ value: values.title.length, max: TITLE_MAX }}
        t={tWorkspace}
      >
        {(props) => (
          <Input
            {...props}
            value={values.title}
            maxLength={TITLE_MAX}
            disabled={disabled}
            onChange={(event) => onChange("title", event.target.value)}
          />
        )}
      </Field>

      <Field
        id="article-meta"
        label={t.metaDescription}
        hint={format(t.metaHint, { count: META_SHOWN })}
        count={{ value: values.metaDescription.length, max: META_MAX }}
        t={tWorkspace}
      >
        {(props) => (
          <Textarea
            {...props}
            rows={3}
            value={values.metaDescription}
            maxLength={META_MAX}
            disabled={disabled}
            onChange={(event) => onChange("metaDescription", event.target.value)}
          />
        )}
      </Field>

      <Field
        id="article-slug"
        label={t.slugLabel}
        hint={
          <>
            {t.slugHelp}
            <span className="mt-1 block text-foreground">
              {values.slug.trim() === "" ? (
                t.slugEmptyNote
              ) : (
                <>
                  {savedAsBefore}
                  <span className="font-mono break-all">{slug}</span>
                  {savedAsAfter}
                </>
              )}
            </span>
            {slugDropsLetters(values.slug) ? <span className="mt-1 block text-amber-800">{t.slugDropped}</span> : null}
            {wordPressLive ? <span className="mt-1 block">{t.slugWordPressNote}</span> : null}
          </>
        }
        t={tWorkspace}
      >
        {(props) => (
          <Input
            {...props}
            value={values.slug}
            disabled={disabled}
            spellCheck={false}
            autoCapitalize="none"
            placeholder={t.slugPlaceholder}
            onChange={(event) => onChange("slug", event.target.value)}
          />
        )}
      </Field>
    </div>
  );
}
