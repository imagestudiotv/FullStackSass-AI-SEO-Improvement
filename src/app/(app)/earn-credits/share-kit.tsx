"use client";

import { ArrowUpRight, Check, Copy, Gift, Layers, RotateCcw, Sparkles } from "lucide-react";
import { useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Notice } from "@/components/workspace/notice";
import { SHARE_CHANNELS, SHARE_LIMITS, shareHref, shareLength, shareOverLimit, shareTemplates, type ShareChannel } from "@/lib/earn/share-templates";
import type { Locale } from "@/lib/i18n/config";
import type { EarnShareCopy } from "@/lib/i18n/earn-share";
import { format, formatNumber } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";

import { copyText } from "./copy-text";

/**
 * The share kit on Earn Credits (client design, 2026-11-05): a ready-made
 * message per platform with this account's own link, to edit, copy and take to
 * the platform. It only ever writes to the clipboard and opens an address.
 * RepGet posts nothing, cannot know whether anything was posted, and never says
 * it was; and nothing here talks to the server, so copying cannot earn credits.
 * Those come from a referral's first payment and from a claim the team reviews
 * (the "Post about RepGet" card below it).
 */

/** The design's platform marks: lucide no longer carries brand icons. */
const CHANNEL_ICONS: Record<ShareChannel, ReactNode> = {
  linkedin: (
    <>
      <rect x="2" y="2" width="20" height="20" rx="3" />
      <path d="M7 10v8M7 7v.1M11 18v-8M11 13c0-3 6-4 6 1v4" />
    </>
  ),
  facebook: <path d="M18 3h-3a5 5 0 0 0-5 5v4H7v4h3v5h4v-5h3l1-4h-4V8c0-.7.4-1 1-1h3z" />,
  x: <path d="M4 4l16 16M20 4L4 20" />,
  whatsapp: (
    <>
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2z" />
      <path d="M8 8c0 4 4 8 8 8l2-2-3-2-1 2c-2-.5-3.5-2-4-4l2-1-2-3z" />
    </>
  ),
  email: (
    <>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="m2 7 10 7L22 7" />
    </>
  ),
};

function ChannelIcon({ channel, className }: { channel: ShareChannel; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {CHANNEL_ICONS[channel]}
    </svg>
  );
}

type Feedback = { tone: "status" | "alert"; text: string };

export function ShareKit({
  code,
  link,
  postCredits,
  referralCredits,
  locale,
  t,
}: {
  code: string;
  link: string;
  /** EARN_WAYS.post.credits and REFERRAL_REWARD_CREDITS: passed in, never repeated here. */
  postCredits: number;
  referralCredits: number;
  locale: Locale;
  t: EarnShareCopy;
}) {
  const originals = useMemo(() => shareTemplates(t.templates, { code, link }), [t.templates, code, link]);
  const [drafts, setDrafts] = useState(originals);
  const [active, setActive] = useState<ShareChannel>("linkedin");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const tabRefs = useRef<Partial<Record<ShareChannel, HTMLButtonElement | null>>>({});
  const baseId = useId();
  const countId = `${baseId}-count`;
  const problemId = `${baseId}-problem`;

  const text = drafts[active];
  const platform = t.tabLabels[active];
  const limit = SHARE_LIMITS[active];
  const length = shareLength(active, text);
  const over = shareOverLimit(active, text);
  const linkMissing = !text.includes(link);
  const empty = text.trim().length === 0;
  const { href, prefilled } = shareHref(active, text, { link, subject: t.subject });
  const number = (value: number) => formatNumber(value, locale);

  function choose(channel: ShareChannel) {
    setActive(channel);
    setFeedback(null);
  }

  function onTabKey(event: KeyboardEvent<HTMLButtonElement>) {
    const index = SHARE_CHANNELS.indexOf(active);
    const last = SHARE_CHANNELS.length - 1;
    const next =
      event.key === "ArrowRight" ? (index === last ? 0 : index + 1) : event.key === "ArrowLeft" ? (index === 0 ? last : index - 1) : event.key === "Home" ? 0 : event.key === "End" ? last : null;
    if (next === null) return;
    event.preventDefault();
    const channel = SHARE_CHANNELS[next];
    choose(channel);
    tabRefs.current[channel]?.focus();
  }

  /** When the browser refuses, the text is selected for a manual copy, and the reader is told what to press. */
  function refused() {
    areaRef.current?.focus();
    areaRef.current?.select();
    setFeedback({ tone: "alert", text: t.copyFailed });
  }

  async function copyPost() {
    if (await copyText(text)) setFeedback({ tone: "status", text: t.copied });
    else refused();
  }

  // Not awaited before the click's own navigation: the link opens either way, which is why it is a real link.
  async function copyAndOpen() {
    if (await copyText(text)) setFeedback({ tone: "status", text: format(prefilled ? t.openedPrefilled : t.openedPaste, { platform }) });
    else refused();
  }

  function reset() {
    setDrafts((current) => ({ ...current, [active]: originals[active] }));
    setFeedback({ tone: "status", text: t.restored });
  }

  return (
    <section id="share-kit" aria-labelledby={`${baseId}-title`} className="scroll-mt-20 overflow-hidden rounded-2xl border bg-card">
      <div className="flex flex-col gap-4 border-b bg-gradient-to-r from-card via-card to-primary/5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="min-w-0">
          <p className="text-xs font-bold tracking-[0.13em] text-primary uppercase">{t.eyebrow}</p>
          <h2 id={`${baseId}-title`} className="mt-1.5 text-xl font-bold tracking-tight sm:text-2xl">
            {t.title}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{t.body}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2.5 rounded-xl border bg-background px-3 py-2.5">
          <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">
            <Layers className="size-4" aria-hidden="true" />
          </span>
          <div>
            <strong className="block text-sm leading-tight text-primary">{format(t.flag, { credits: postCredits })}</strong>
            <small className="block text-xs text-muted-foreground">{t.flagNote}</small>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1.7fr)_minmax(15rem,0.8fr)]">
        <div className="min-w-0 p-4 sm:p-6 lg:border-r">
          <p id={`${baseId}-tabs`} className="mb-2.5 text-xs font-semibold">
            {t.tabsTitle}
          </p>
          <div role="tablist" aria-labelledby={`${baseId}-tabs`} className="flex gap-1.5 overflow-x-auto p-0.5 pb-3">
            {SHARE_CHANNELS.map((channel) => {
              const selected = channel === active;
              return (
                <button
                  key={channel}
                  ref={(node) => {
                    tabRefs.current[channel] = node;
                  }}
                  type="button"
                  role="tab"
                  id={`${baseId}-tab-${channel}`}
                  aria-selected={selected}
                  aria-controls={`${baseId}-panel`}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => choose(channel)}
                  onKeyDown={onTabKey}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                    selected ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:border-primary/40",
                  )}
                >
                  <ChannelIcon channel={channel} className="size-3.5" />
                  {t.tabLabels[channel]}
                </button>
              );
            })}
          </div>

          <div role="tabpanel" id={`${baseId}-panel`} aria-labelledby={`${baseId}-tab-${active}`}>
            <div className="overflow-hidden rounded-xl border bg-background focus-within:ring-2 focus-within:ring-ring/50">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/30 px-3.5 py-2.5">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                    <ChannelIcon channel={active} className="size-3.5" />
                  </span>
                  <div className="min-w-0">
                    <strong className="block text-xs">{t.draftLabels[active]}</strong>
                    <small className="block text-xs text-muted-foreground">{t.editable}</small>
                  </div>
                </div>
                <span id={countId} className={cn("text-xs tabular-nums", over > 0 ? "font-semibold text-destructive" : "text-muted-foreground")}>
                  {limit === null ? format(t.count, { count: number(length) }) : format(t.countLimit, { count: number(length), limit: number(limit) })}
                </span>
              </div>
              {/* A plain textarea, so its line breaks are the message's real ones. */}
              <textarea
                ref={areaRef}
                value={text}
                aria-label={t.draftLabels[active]}
                aria-describedby={over > 0 || linkMissing ? `${countId} ${problemId}` : countId}
                aria-invalid={over > 0 || undefined}
                spellCheck
                rows={active === "x" || active === "whatsapp" ? 6 : 11}
                onChange={(event) => {
                  const value = event.target.value;
                  setDrafts((current) => ({ ...current, [active]: value }));
                  setFeedback(null);
                }}
                className="block max-h-96 min-h-36 w-full resize-y bg-transparent px-4 py-3 text-sm leading-relaxed text-foreground outline-none"
              />
              <div className="flex flex-wrap items-center justify-between gap-2 border-t px-3.5 py-2.5">
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Sparkles className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
                  {t.includesLink}
                </span>
                <Button type="button" size="sm" onClick={copyPost} disabled={empty} className="max-sm:w-full">
                  <Copy aria-hidden="true" />
                  {t.copyPost}
                </Button>
              </div>
            </div>

            {active === "x" ? <p className="mt-2 text-xs text-muted-foreground">{t.xNote}</p> : null}
            <p className="mt-2 text-xs text-muted-foreground">{t.honest}</p>

            {over > 0 || linkMissing ? (
              <div id={problemId} className="mt-3 space-y-2">
                {over > 0 ? (
                  <Notice tone="danger" role="alert">
                    {format(t.overLimit, { platform, limit: number(limit ?? 0), over: number(over) })}
                  </Notice>
                ) : null}
                {linkMissing ? (
                  <Notice tone="warning" role="status">
                    <span className="break-words">{format(t.linkMissing, { link })}</span>
                  </Notice>
                ) : null}
              </div>
            ) : null}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {over > 0 || empty ? (
                <Button type="button" variant="outline" disabled>
                  <ArrowUpRight aria-hidden="true" />
                  {format(t.copyOpen, { platform })}
                </Button>
              ) : (
                <Button asChild variant="outline">
                  {/* A real link: the browser opens it, so no pop-up blocker stands between the click and the platform. Mail stays in this tab. */}
                  <a href={href} target={active === "email" ? undefined : "_blank"} rel="noopener noreferrer" onClick={() => void copyAndOpen()}>
                    <ArrowUpRight aria-hidden="true" />
                    {format(t.copyOpen, { platform })}
                  </a>
                </Button>
              )}
              <Button type="button" variant="ghost" onClick={reset}>
                <RotateCcw aria-hidden="true" />
                {t.reset}
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{t.editNote}</p>

            {feedback ? (
              <div className="mt-3">
                {feedback.tone === "alert" ? (
                  <Notice tone="danger" role="alert">
                    {feedback.text}
                  </Notice>
                ) : (
                  <p role="status" className="flex items-start gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                    <Check className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                    {feedback.text}
                  </p>
                )}
              </div>
            ) : null}
          </div>
        </div>

        <aside className="flex flex-col border-t bg-muted/20 p-5 sm:p-6 lg:border-t-0">
          <p className="text-xs font-bold tracking-[0.13em] text-primary uppercase">{t.sideEyebrow}</p>
          <h3 className="mt-2.5 text-base font-bold tracking-tight">{t.sideTitle}</h3>
          <ol className="mt-4 space-y-4">
            {t.steps.map(([title, body], index) => (
              <li key={title} className="flex gap-2.5">
                <span className="grid size-6 shrink-0 place-items-center rounded-full border border-primary/20 bg-primary/10 text-xs font-bold text-primary">{index + 1}</span>
                <div className="min-w-0">
                  <strong className="block text-xs leading-snug">{title}</strong>
                  <p className="mt-0.5 text-xs leading-normal text-muted-foreground">{body}</p>
                </div>
              </li>
            ))}
          </ol>
          <a href="#more-ways" className="mt-3 ml-8 inline-flex items-center gap-1 self-start text-xs font-semibold text-primary underline-offset-2 hover:underline">
            {t.submitLink}
            <ArrowUpRight className="size-3.5" aria-hidden="true" />
          </a>
          <div className="mt-6 border-t pt-4 lg:mt-auto">
            <p className="flex items-center gap-1.5 text-xs font-semibold">
              <Gift className="size-3.5 text-primary" aria-hidden="true" />
              {t.guideTitle}
            </p>
            <p className="mt-1.5 text-xs leading-normal text-muted-foreground">{format(t.guide, { post: `+${postCredits}`, referral: `+${referralCredits}` })}</p>
          </div>
        </aside>
      </div>
    </section>
  );
}
