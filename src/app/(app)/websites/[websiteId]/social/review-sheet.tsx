"use client";

import { Clock, ExternalLink, Save, Send, SkipForward } from "lucide-react";
import Link from "next/link";
import { useId, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Notice } from "@/components/workspace/notice";
import { copyTextNow } from "@/lib/copy-text";
import type { Locale } from "@/lib/i18n/config";
import { format, formatDate } from "@/lib/i18n/format";
import {
  editScheduledPost,
  postScheduledNow,
  postSocialSuggestion,
  saveSocialDraft,
  skipSocialSuggestion,
} from "@/lib/social/actions";
import { isSocialPlatform, PLATFORMS } from "@/lib/social/platforms";

import { latest, pasteText, platformName, stageOf, whereOf, type AccountView, type SuggestionView } from "./opportunities";
import { Ago, atTime, CopyTextButton, PlatformTile, useSocialAction, type T } from "./social-shared";

/** A row's headline: the discussion it answers, or the own post's title. */
export function headline(row: SuggestionView, t: T): string {
  const name = platformName(row.platform);
  if (row.kind === "reply") return row.threadTitle || format(t.replyOn, { platform: name });
  return row.title || format(t.postOn, { platform: name });
}

/**
 * The review drawer (client's design, 2026-11-03): the discussion, the text
 * to edit, and what can be done with it at its stage - post a suggestion or
 * a draft with one click, save a draft, edit or publish a scheduled post now,
 * or read what was posted. Full width on a phone; Escape closes it.
 */
export function ReviewSheet({
  suggestion,
  open,
  onOpenChange,
  ...props
}: {
  suggestion: SuggestionView | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  websiteId: string;
  /** An editor, and the platform is in the plan (a trial: Quora only). */
  editable: boolean;
  canEdit: boolean;
  account: AccountView | null;
  priceLabel: string;
  locale: Locale;
  t: T;
}) {
  return (
    <Sheet open={open && suggestion !== null} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        closeLabel={props.t.close}
        className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-lg"
      >
        {/* Keyed: another suggestion starts from its own text, not the last one's edit. */}
        {suggestion ? <Review key={suggestion.id} suggestion={suggestion} onDone={() => onOpenChange(false)} {...props} /> : null}
      </SheetContent>
    </Sheet>
  );
}

function Review({
  suggestion,
  onDone,
  websiteId,
  editable,
  canEdit,
  account,
  priceLabel,
  locale,
  t,
}: {
  suggestion: SuggestionView;
  onDone: () => void;
  websiteId: string;
  editable: boolean;
  canEdit: boolean;
  account: AccountView | null;
  priceLabel: string;
  locale: Locale;
  t: T;
}) {
  const id = useId();
  const { pending, start, run, refuse, router } = useSocialAction(t, priceLabel);
  const [body, setBody] = useState(suggestion.body);
  const [title, setTitle] = useState(suggestion.title ?? "");
  const platform = isSocialPlatform(suggestion.platform) ? suggestion.platform : null;
  const spec = platform ? PLATFORMS[platform] : null;
  const hasTitle = Boolean(spec?.titleMax) && suggestion.kind === "post";
  const stage = stageOf(suggestion.status);
  const oneClick = stage === "suggested" || stage === "draft" || stage === "failed";
  const writable = editable && (oneClick || stage === "scheduled");
  const edited = body.trim() !== suggestion.body.trim() || (hasTitle && title.trim() !== (suggestion.title ?? "").trim());
  const name = platformName(suggestion.platform);
  const where = whereOf(suggestion);
  const max = spec?.maxLength ?? 4000;
  const tooLong = body.length > max;
  const invalid = body.trim().length === 0 || tooLong;
  const text = pasteText(hasTitle ? title : null, body);
  const edit = { body, title: hasTitle ? title : undefined };

  function postNow() {
    // Both in the click itself: browsers allow neither once the click has passed. The copy goes
    // first, while this page still has the focus the new tab is about to take (lib/copy-text.ts).
    const copying = copyTextNow(text);
    const win = window.open("about:blank", "_blank");
    if (win) win.opener = null;
    start(async () => {
      const copied = await copying;
      const result = await postSocialSuggestion(websiteId, suggestion.id, edit).catch(() => null);
      if (!result?.ok) {
        win?.close();
        refuse(result && !result.ok ? result : null);
        return;
      }
      if (win) win.location.href = result.data.url;
      // Quora and replies on Reddit and Bluesky only have the clipboard: never say "copied" when it is not.
      if (!copied && (!win || !result.data.filled)) toast.error(format(t.copyFailed, { platform: name }));
      else if (!win) toast.message(format(t.popupBlocked, { platform: name }));
      else if (copied) toast.success(format(t.copied, { platform: name }));
      onDone();
      router.refresh();
    });
  }

  const skip = () => run(() => skipSocialSuggestion(websiteId, suggestion.id), { then: onDone });

  return (
    <>
      <SheetHeader className="gap-2 border-b px-5 py-5 pr-12 sm:px-6">
        <p className="text-[0.7rem] font-semibold uppercase tracking-wider text-primary-strong">{t.eyebrow[stage]}</p>
        <SheetTitle className="text-lg leading-snug font-semibold tracking-tight">{headline(suggestion, t)}</SheetTitle>
        <SheetDescription className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          <PlatformTile platform={suggestion.platform} size="sm" />
          <span className="font-semibold text-foreground/80">{name}</span>
          <span aria-hidden="true">/</span>
          <span>{where ?? t.ownProfile}</span>
          <span aria-hidden="true">/</span>
          <Ago value={latest(suggestion)} locale={locale} />
        </SheetDescription>
      </SheetHeader>

      <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
        {stage === "failed" ? (
          <Notice
            tone="warning"
            action={
              suggestion.error === "not_enough_credits" ? (
                <Button asChild size="sm" variant="outline">
                  <Link href="/credits">{t.buyCredits}</Link>
                </Button>
              ) : null
            }
          >
            {suggestion.error === "not_enough_credits" ? t.failedCredits : format(t.failed, { reason: suggestion.error ?? "-" })}
          </Notice>
        ) : null}
        {!canEdit ? <Notice>{t.errors.view_only}</Notice> : !editable ? <Notice>{t.errors.not_included}</Notice> : null}

        <section aria-labelledby={`${id}-original`} className="space-y-2">
          <h3 id={`${id}-original`} className="text-xs font-semibold">
            {t.original}
          </h3>
          {suggestion.threadUrl ? (
            <div className="space-y-2 rounded-lg border bg-muted/40 p-3 text-sm">
              {suggestion.threadTitle ? <p className="font-medium">{suggestion.threadTitle}</p> : null}
              {suggestion.threadSnippet ? <p className="line-clamp-6 text-muted-foreground">{suggestion.threadSnippet}</p> : null}
              <a
                href={suggestion.threadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium underline-offset-4 hover:underline"
              >
                {t.openThread}
                <ExternalLink className="size-3" aria-hidden="true" />
              </a>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{format(t.ownPostNote, { platform: name })}</p>
          )}
          {suggestion.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- the article's own picture, on its own host
            <img src={suggestion.imageUrl} alt="" className="h-32 w-auto rounded-lg border object-cover" />
          ) : null}
        </section>

        {writable && account?.inWarmup ? (
          <Notice>{format(t.warmup, { date: formatDate(account.warmupEndsAt, locale, { day: "numeric", month: "long" }) })}</Notice>
        ) : null}

        {hasTitle ? (
          <div className="grid gap-1.5">
            <label htmlFor={`${id}-title`} className="text-xs font-semibold">
              {t.titleLabel}
            </label>
            {writable ? (
              <Input id={`${id}-title`} value={title} onChange={(event) => setTitle(event.target.value)} maxLength={spec?.titleMax} />
            ) : (
              <p id={`${id}-title`} className="text-sm font-medium">
                {suggestion.title}
              </p>
            )}
          </div>
        ) : null}

        <div className="grid gap-1.5">
          <label htmlFor={`${id}-body`} className="text-xs font-semibold">
            {suggestion.kind === "reply" ? t.replyField : t.postField}
          </label>
          {writable ? (
            <>
              <Textarea
                id={`${id}-body`}
                value={body}
                onChange={(event) => setBody(event.target.value)}
                rows={Math.min(14, Math.max(7, Math.ceil(body.length / 60)))}
                aria-describedby={`${id}-count ${id}-help`}
                aria-invalid={tooLong || undefined}
              />
              <div className="flex items-start justify-between gap-3 text-xs">
                <p id={`${id}-help`} className="text-muted-foreground">
                  {t.editHelp}
                </p>
                <p id={`${id}-count`} className={`shrink-0 tabular-nums ${tooLong ? "font-medium text-destructive" : "text-muted-foreground"}`}>
                  {format(t.characters, { count: String(body.length), max: String(max) })}
                </p>
              </div>
            </>
          ) : (
            <>
              <p id={`${id}-body`} className="rounded-lg border bg-muted/40 p-3 text-sm whitespace-pre-wrap">
                {suggestion.body}
              </p>
              {stage === "published" ? <p className="text-xs text-muted-foreground">{t.postedHelp}</p> : null}
            </>
          )}
        </div>

        {stage === "scheduled" && suggestion.scheduledFor ? (
          <div className="space-y-3 rounded-lg border bg-muted/40 p-3">
            <p className="flex items-start gap-2 text-sm font-medium">
              <Clock className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
              <span suppressHydrationWarning>{format(t.scheduled, { time: atTime(suggestion.scheduledFor, locale) })}</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {writable ? (
                <Button size="sm" disabled={pending || edited} onClick={() => run(() => postScheduledNow(websiteId, suggestion.id), { then: onDone })}>
                  <Send aria-hidden="true" />
                  {t.postNow}
                </Button>
              ) : null}
              <CopyTextButton text={text} t={t} />
              {writable ? (
                <Button size="sm" variant="ghost" disabled={pending} onClick={skip}>
                  <SkipForward aria-hidden="true" />
                  {t.skip}
                </Button>
              ) : null}
            </div>
            {writable && edited ? <p className="text-xs text-muted-foreground">{t.saveFirst}</p> : null}
          </div>
        ) : null}
        {stage === "publishing" ? <p className="text-sm text-muted-foreground">{t.publishing}</p> : null}
        {stage === "published" && suggestion.postedAt ? (
          <p className="text-sm text-muted-foreground">
            {format(t.posted, { date: formatDate(suggestion.postedAt, locale, { day: "numeric", month: "long" }) })}
          </p>
        ) : null}
      </div>

      {/* A viewer's scheduled post has nothing here: its Copy is in the schedule box above. */}
      {stage === "scheduled" && !writable ? null : (
        <SheetFooter className="mt-0 flex-row flex-wrap items-center justify-end gap-2 border-t px-5 py-4 sm:px-6">
          {writable && oneClick ? (
            <>
              <Button size="sm" variant="ghost" className="mr-auto" disabled={pending} onClick={skip}>
                <SkipForward aria-hidden="true" />
                {t.skip}
              </Button>
              <CopyTextButton text={text} label={t.copyText} variant="ghost" t={t} />
              {stage !== "failed" ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending || !edited || invalid}
                  onClick={() => run(() => saveSocialDraft(websiteId, suggestion.id, edit), { success: t.draftSaved, then: onDone })}
                >
                  <Save aria-hidden="true" />
                  {t.saveDraft}
                </Button>
              ) : null}
              <Button size="sm" disabled={pending || invalid} onClick={postNow}>
                <Send aria-hidden="true" />
                {pending ? t.posting : format(t.post, { price: priceLabel })}
              </Button>
            </>
          ) : writable && stage === "scheduled" ? (
            <Button
              size="sm"
              disabled={pending || !edited || invalid}
              onClick={() => run(() => editScheduledPost(websiteId, suggestion.id, edit), { success: t.saved, then: onDone })}
            >
              <Save aria-hidden="true" />
              {t.saveEdit}
            </Button>
          ) : (
            <>
              <CopyTextButton text={text} label={t.copyText} variant="ghost" t={t} />
              {suggestion.postedUrl || (stage === "published" && suggestion.threadUrl) ? (
                <Button asChild size="sm" variant="outline">
                  <a href={suggestion.postedUrl ?? suggestion.threadUrl ?? "#"} target="_blank" rel="noopener noreferrer">
                    {suggestion.postedUrl ? t.viewPost : t.openThread}
                    <ExternalLink aria-hidden="true" />
                  </a>
                </Button>
              ) : null}
            </>
          )}
        </SheetFooter>
      )}
    </>
  );
}
