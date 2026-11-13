"use client";

import { Loader2, Plus, Sparkles } from "lucide-react";
import type { FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/workspace/field";
import { Notice } from "@/components/workspace/notice";
import { MAX_PROMPT_LENGTH } from "@/lib/geo/shared";
import { format, plural } from "@/lib/i18n/format";
import type { Messages } from "@/lib/i18n/messages";

type GeoText = Messages["app"]["geo"];
type WorkspaceText = Messages["app"]["workspace"];

/** The id the "Add questions" next step moves focus to. */
export const NEW_QUESTION_INPUT_ID = "geo-new-question";

/** The "plan limit reached" notice, which says why Add and Suggest are disabled. */
const ALLOWANCE_NOTICE_ID = "geo-allowance-reached";

/**
 * Adding a question by hand, or asking for suggestions.
 *
 * Suggest is a paid model call, so it is offered only when there is room on
 * the plan to keep what comes back, and only where the server would allow it
 * (see the page's blocked reason). Typing and adding are free.
 */
export function AddQuestionForm({
  draft,
  onDraft,
  error,
  onSubmit,
  adding,
  suggesting,
  onSuggest,
  allowance,
  atAllowance,
  suggestBlocked,
  blockedReasonId,
  t,
  tw,
}: {
  draft: string;
  onDraft: (value: string) => void;
  error: string | null;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  adding: boolean;
  suggesting: boolean;
  onSuggest: () => void;
  allowance: number;
  atAllowance: boolean;
  /** AI or the plan is unavailable; the reason is shown at the top of the page. */
  suggestBlocked: boolean;
  /** The notice that says why, so the disabled Suggest button is described by it. */
  blockedReasonId?: string;
  t: GeoText;
  tw: WorkspaceText;
}) {
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-3">
      <Field
        id={NEW_QUESTION_INPUT_ID}
        label={t.addQuestionLabel}
        hint={t.askHelp}
        error={error}
        count={{ value: draft.length, max: MAX_PROMPT_LENGTH }}
        t={tw}
      >
        {(props) => (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              {...props}
              value={draft}
              onChange={(e) => onDraft(e.target.value)}
              placeholder={t.questionPlaceholder}
              maxLength={MAX_PROMPT_LENGTH}
              disabled={atAllowance}
              readOnly={adding}
              autoComplete="off"
              className="min-w-0 sm:flex-1"
            />
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button
                type="submit"
                disabled={adding || atAllowance || !draft.trim()}
                aria-describedby={atAllowance ? ALLOWANCE_NOTICE_ID : undefined}
              >
                {adding ? (
                  <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
                ) : (
                  <Plus aria-hidden="true" />
                )}
                {t.add}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={onSuggest}
                disabled={suggesting || adding || atAllowance || suggestBlocked}
                aria-describedby={
                  atAllowance ? ALLOWANCE_NOTICE_ID : suggestBlocked ? blockedReasonId : undefined
                }
              >
                {suggesting ? (
                  <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
                ) : (
                  <Sparkles aria-hidden="true" />
                )}
                {t.suggest}
              </Button>
            </div>
          </div>
        )}
      </Field>
      {atAllowance ? (
        <div id={ALLOWANCE_NOTICE_ID}>
          <Notice tone="info">{format(t.atAllowance, { max: allowance })}</Notice>
        </div>
      ) : null}
    </form>
  );
}

/**
 * Suggestions come back as a choice, all ticked: the client asked for
 * questions "selected from first glance", and nothing is stored until the
 * customer presses Add selected - so a suggestion they do not want costs them
 * nothing to leave out.
 */
export function SuggestionPicker({
  suggestions,
  selected,
  onToggle,
  onAddSelected,
  onDismiss,
  room,
  adding,
  t,
}: {
  suggestions: string[];
  selected: ReadonlySet<string>;
  onToggle: (suggestion: string) => void;
  onAddSelected: () => void;
  onDismiss: () => void;
  /** Questions the plan still allows. */
  room: number;
  adding: boolean;
  t: GeoText;
}) {
  const count = suggestions.filter((s) => selected.has(s)).length;
  return (
    <div role="group" aria-labelledby="geo-suggestions-title" className="space-y-3 rounded-lg border bg-muted/20 p-4">
      <div className="space-y-1">
        <h3 id="geo-suggestions-title" className="text-sm font-semibold">
          {t.suggestionsTitle}
        </h3>
        <p id="geo-suggestions-help" className="text-xs leading-5 text-muted-foreground">
          {t.suggestionsHelp} {plural(t.suggestionsRoom, room)}
        </p>
      </div>
      <ul className="space-y-2">
        {suggestions.map((suggestion, index) => (
          <li key={suggestion}>
            <label htmlFor={`geo-suggestion-${index}`} className="flex cursor-pointer items-start gap-2.5 text-sm">
              <input
                id={`geo-suggestion-${index}`}
                type="checkbox"
                checked={selected.has(suggestion)}
                onChange={() => onToggle(suggestion)}
                disabled={adding}
                /*
                  A native checkbox: an outline is drawn around it in every
                  browser, where a box-shadow ring is not.
                */
                className="mt-0.5 size-4 shrink-0 rounded accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              />
              <span className="min-w-0 break-words">{suggestion}</span>
            </label>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          onClick={onAddSelected}
          disabled={adding || count === 0 || count > room}
          aria-describedby="geo-suggestions-help"
        >
          {adding ? (
            <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
          ) : (
            <Plus aria-hidden="true" />
          )}
          {format(t.addSelected, { count })}
        </Button>
        <Button variant="ghost" onClick={onDismiss} disabled={adding}>
          {t.dismiss}
        </Button>
      </div>
    </div>
  );
}
