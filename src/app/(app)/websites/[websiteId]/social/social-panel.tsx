"use client";

import { Check, Copy, ExternalLink, Lock, RefreshCw, Send, SkipForward } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Notice } from "@/components/workspace/notice";
import { copyTextNow } from "@/lib/copy-text";
import type { Locale } from "@/lib/i18n/config";
import { format, formatDate } from "@/lib/i18n/format";
import type { Messages } from "@/lib/i18n/messages";
import {
  connectSocialUsername,
  disconnectSocial,
  editScheduledPost,
  findSocialSuggestions,
  postScheduledNow,
  postSocialSuggestion,
  setPinterestBoard,
  setSocialAutoPost,
  skipSocialSuggestion,
  startSocialConnect,
  type SocialError,
  type SocialResult,
} from "@/lib/social/actions";
import { isSocialPlatform, PLATFORMS, profileUrl, SOCIAL_PLATFORMS, type SocialPlatform } from "@/lib/social/platforms";

type T = Messages["app"]["social"];

export type AccountView = {
  platform: string;
  username: string;
  /** Connected through bundle.social: RepGet can publish own posts. */
  connected: boolean;
  autoPost: boolean;
  warmupEndsAt: string;
  /** Still in the warm-up (decided on the server, as the rules are). */
  inWarmup: boolean;
  /** Why automatic posting is paused; null when it is not. */
  pausedReason: string | null;
  target: string | null;
};

export type SuggestionView = {
  id: string;
  platform: string;
  kind: string;
  status: string;
  threadUrl: string | null;
  threadTitle: string | null;
  threadSnippet: string | null;
  title: string | null;
  body: string;
  warmup: boolean;
  imageUrl: string | null;
  scheduledFor: string | null;
  postedAt: string | null;
  postedUrl: string | null;
  error: string | null;
};

const name = (platform: string) => (isSocialPlatform(platform) ? PLATFORMS[platform].name : platform);

/** The text as it is pasted: a title (Reddit, Pinterest posts) on top of the body. */
const pasteText = (title: string | null, body: string) => (title?.trim() ? `${title.trim()}\n\n${body}` : body);

/** Copies a suggestion's text without posting it, or a posted one's again (client, 2026-10-29: "a copy button"). */
function CopyTextButton({ text, variant = "outline", t }: { text: string; variant?: "outline" | "ghost"; t: T }) {
  const [done, setDone] = useState(false);
  async function copy() {
    if (!(await copyTextNow(text))) return void toast.error(t.errors.generic);
    setDone(true);
    window.setTimeout(() => setDone(false), 2000);
  }
  return (
    <Button type="button" size="sm" variant={variant} onClick={copy}>
      {done ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
      {done ? t.copyDone : t.copy}
    </Button>
  );
}

function errorText(t: T, result: Extract<SocialResult<unknown>, { ok: false }>, price: string): string {
  const key: SocialError = result.error;
  if (key === "not_enough_credits") {
    return format(t.errors.not_enough_credits, { price, available: String(result.available ?? 0) });
  }
  return t.errors[key] ?? t.errors.generic;
}

/**
 * The Social page (client, 2026-10-27). Accounts on top - six platforms, a
 * trial's locked ones shown but disabled - then the suggestions waiting, then
 * what was posted.
 *
 * THE ONE-CLICK POST copies the text and opens a window in the same click
 * (browsers allow neither later), then asks the server to charge the credit
 * and sends the window to the platform. Refused - not enough credits - the
 * window closes again and nothing was charged.
 */
export function SocialPanel(props: {
  websiteId: string;
  canEdit: boolean;
  level: "paid" | "trial" | "none";
  platforms: string[];
  bundle: boolean;
  accounts: AccountView[];
  open: SuggestionView[];
  posted: SuggestionView[];
  todayCount: number;
  perDay: number;
  priceLabel: string;
  boards: string[];
  notice: { kind: "connected" | "not_connected" | "connect_failed"; platform: string | null } | null;
  locale: Locale;
  t: T;
}) {
  const { t, websiteId, canEdit } = props;
  const router = useRouter();
  const [pending, start] = useTransition();

  function run(action: () => Promise<SocialResult<unknown>>, success?: string) {
    start(async () => {
      const result = await action().catch(() => null);
      if (!result) return void toast.error(t.errors.generic);
      if (!result.ok) return void toast.error(errorText(t, result, props.priceLabel));
      if (success) toast.success(success);
      router.refresh();
    });
  }

  const noticePlatform = props.notice?.platform ? name(props.notice.platform) : "";

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.title}
        description={t.intro}
        actions={
          canEdit && props.accounts.length > 0 ? (
            <Button
              variant="outline"
              disabled={pending || props.todayCount >= props.perDay}
              onClick={() => run(() => findSocialSuggestions(websiteId), t.findQueued)}
            >
              <RefreshCw aria-hidden="true" />
              {pending ? t.finding : t.findNow}
            </Button>
          ) : null
        }
      />

      {props.notice ? (
        <Notice tone={props.notice.kind === "connected" ? "success" : "warning"} role="status">
          {format(props.notice.kind === "connected" ? t.connectedNotice : t.notConnectedNotice, { platform: noticePlatform })}
        </Notice>
      ) : null}

      <section aria-labelledby="social-accounts" className="space-y-3">
        <h2 id="social-accounts" className="font-semibold">
          {t.accountsTitle}
        </h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {SOCIAL_PLATFORMS.map((platform) => (
            <AccountCard
              key={platform}
              platform={platform}
              account={props.accounts.find((account) => account.platform === platform) ?? null}
              locked={!props.platforms.includes(platform)}
              bundle={props.bundle}
              boards={props.boards}
              canEdit={canEdit}
              pending={pending}
              run={run}
              websiteId={websiteId}
              locale={props.locale}
              t={t}
            />
          ))}
        </div>
      </section>

      <section aria-labelledby="social-open" className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="social-open" className="font-semibold">
            {t.todayTitle}
          </h2>
          <p className="text-sm text-muted-foreground">
            {format(t.todayCount, { count: String(props.todayCount), max: String(props.perDay) })} ·{" "}
            {format(t.price, { price: props.priceLabel })}
          </p>
        </div>
        {props.open.length === 0 ? (
          <Notice>{props.accounts.length === 0 ? t.empty : t.emptyToday}</Notice>
        ) : (
          <ul className="space-y-3">
            {props.open.map((suggestion) => (
              <SuggestionCard
                key={suggestion.id}
                suggestion={suggestion}
                websiteId={websiteId}
                canEdit={canEdit && props.platforms.includes(suggestion.platform)}
                priceLabel={props.priceLabel}
                locale={props.locale}
                t={t}
              />
            ))}
          </ul>
        )}
      </section>

      {props.posted.length > 0 ? (
        <section aria-labelledby="social-posted" className="space-y-3">
          <h2 id="social-posted" className="font-semibold">
            {t.historyTitle}
          </h2>
          <ul className="divide-y rounded-xl border bg-card">
            {props.posted.map((row) => (
              <li
                key={row.id}
                className="grid gap-1.5 px-4 py-3 text-sm sm:grid-cols-[auto_minmax(0,1fr)_auto_auto_auto] sm:items-start sm:gap-3"
              >
                <Badge variant="secondary" className="justify-self-start">
                  {name(row.platform)}
                </Badge>
                <p className="line-clamp-2 text-muted-foreground">{row.title ?? row.body}</p>
                <span className="text-xs text-muted-foreground">
                  {row.postedAt ? format(t.posted, { date: formatDate(row.postedAt, props.locale, { day: "numeric", month: "short" }) }) : null}
                </span>
                {row.postedUrl || row.threadUrl ? (
                  <a
                    href={row.postedUrl ?? row.threadUrl ?? "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium underline-offset-4 hover:underline"
                  >
                    {row.postedUrl ? t.viewPost : t.openThread}
                    <ExternalLink className="size-3" aria-hidden="true" />
                  </a>
                ) : null}
                <div className="justify-self-start sm:-my-1">
                  <CopyTextButton text={pasteText(row.title, row.body)} variant="ghost" t={t} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function AccountCard({
  platform,
  account,
  locked,
  bundle,
  boards,
  canEdit,
  pending,
  run,
  websiteId,
  locale,
  t,
}: {
  platform: SocialPlatform;
  account: AccountView | null;
  locked: boolean;
  bundle: boolean;
  boards: string[];
  canEdit: boolean;
  pending: boolean;
  run: (action: () => Promise<SocialResult<unknown>>, success?: string) => void;
  websiteId: string;
  locale: Locale;
  t: T;
}) {
  const id = useId();
  const spec = PLATFORMS[platform];
  const [username, setUsername] = useState("");
  const [board, setBoard] = useState(account?.target ?? boards[0] ?? "");
  const [opening, setOpening] = useState(false);
  // Through bundle.social when it is set up; Quora (and everything without it) by username.
  const viaBundle = Boolean(spec.bundleType) && bundle;
  const warmup = account?.inWarmup ?? false;

  async function connect() {
    setOpening(true);
    const result = await startSocialConnect(websiteId, platform, locale).catch(() => null);
    if (result?.ok) {
      window.location.href = result.data.url;
      return;
    }
    setOpening(false);
    toast.error(result && !result.ok ? (t.errors[result.error] ?? t.errors.generic) : t.errors.generic);
  }

  return (
    <div className={`flex flex-col gap-3 rounded-xl border bg-card p-4 ${locked ? "opacity-60" : ""}`}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-medium">{spec.name}</h3>
        {locked ? (
          <Lock className="size-4 text-muted-foreground" aria-hidden="true" />
        ) : warmup ? (
          <Badge variant="secondary">{t.warmupBadge}</Badge>
        ) : null}
      </div>

      {locked ? (
        <p className="text-sm text-muted-foreground">{t.lockedTrial}</p>
      ) : account ? (
        <div className="space-y-2 text-sm">
          <p>
            <a href={profileUrl(platform, account.username)} target="_blank" rel="noopener noreferrer" className="font-medium underline-offset-4 hover:underline">
              {format(t.connectedAs, { name: account.username })}
            </a>
          </p>
          {warmup ? (
            <p className="text-muted-foreground">
              {format(t.warmup, { date: formatDate(account.warmupEndsAt, locale, { day: "numeric", month: "long" }) })}
            </p>
          ) : null}
          {account.connected && spec.ownPosts ? (
            <div className="flex items-start justify-between gap-3">
              <div>
                <p id={`${id}-auto`} className="font-medium">
                  {t.autoPost}
                </p>
                <p className="text-xs text-muted-foreground">{t.autoPostHelp}</p>
              </div>
              <Switch
                aria-labelledby={`${id}-auto`}
                checked={account.autoPost && account.pausedReason === null}
                disabled={!canEdit || pending}
                onCheckedChange={(on) => run(() => setSocialAutoPost(websiteId, platform, on))}
              />
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">{t.oneClick}</p>
          )}
          {account.pausedReason !== null ? (
            <Notice
              tone="warning"
              action={
                canEdit ? (
                  <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => setSocialAutoPost(websiteId, platform, true))}>
                    {t.resume}
                  </Button>
                ) : null
              }
            >
              {format(t.paused, { platform: spec.name, reason: account.pausedReason || "-" })}
            </Notice>
          ) : null}
          {platform === "pinterest" && account.connected ? (
            <div className="flex flex-wrap items-end gap-2">
              <label className="grid gap-1 text-xs font-medium">
                {t.boardLabel}
                {boards.length > 0 ? (
                  <select
                    value={board}
                    onChange={(event) => setBoard(event.target.value)}
                    className="h-8 rounded-lg border bg-background px-2 text-sm"
                    disabled={!canEdit}
                  >
                    {boards.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Input value={board} onChange={(event) => setBoard(event.target.value)} className="h-8" disabled={!canEdit} />
                )}
              </label>
              {canEdit && board !== (account.target ?? "") ? (
                <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => setPinterestBoard(websiteId, board), t.saved)}>
                  {t.boardSave}
                </Button>
              ) : null}
            </div>
          ) : null}
          {platform === "quora" ? <p className="text-xs text-muted-foreground">{t.quoraNote}</p> : null}
          {platform === "pinterest" ? <p className="text-xs text-muted-foreground">{t.pinterestNote}</p> : null}
          {canEdit ? (
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => disconnectSocial(websiteId, platform))}>
              {t.disconnect}
            </Button>
          ) : null}
        </div>
      ) : !canEdit ? null : viaBundle ? (
        <>
          <Button size="sm" onClick={connect} disabled={opening || pending} className="self-start">
            {opening ? t.connecting : t.connect}
          </Button>
          {platform === "bluesky" ? <p className="text-xs text-muted-foreground">{t.blueskyNote}</p> : null}
        </>
      ) : (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            run(() => connectSocialUsername(websiteId, platform, username));
          }}
        >
          <label className="grid min-w-0 flex-1 gap-1 text-xs font-medium">
            {format(t.usernameLabel, { platform: spec.name })}
            <Input value={username} onChange={(event) => setUsername(event.target.value)} placeholder={t.usernamePlaceholder} className="h-8" />
          </label>
          <Button size="sm" type="submit" disabled={pending || !username.trim()}>
            {t.save}
          </Button>
          {platform === "quora" ? <p className="w-full text-xs text-muted-foreground">{t.quoraNote}</p> : null}
        </form>
      )}
    </div>
  );
}

function SuggestionCard({
  suggestion,
  websiteId,
  canEdit,
  priceLabel,
  locale,
  t,
}: {
  suggestion: SuggestionView;
  websiteId: string;
  canEdit: boolean;
  priceLabel: string;
  locale: Locale;
  t: T;
}) {
  const id = useId();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [body, setBody] = useState(suggestion.body);
  const [title, setTitle] = useState(suggestion.title ?? "");
  const platform = isSocialPlatform(suggestion.platform) ? suggestion.platform : null;
  const spec = platform ? PLATFORMS[platform] : null;
  const hasTitle = Boolean(spec?.titleMax) && suggestion.kind === "post";
  const scheduled = suggestion.status === "scheduled";
  const edited = body !== suggestion.body || (hasTitle && title !== (suggestion.title ?? ""));
  const platformName = name(suggestion.platform);

  function refuse(result: Extract<SocialResult<unknown>, { ok: false }> | null) {
    toast.error(result ? errorText(t, result, priceLabel) : t.errors.generic);
  }

  const text = pasteText(hasTitle ? title : null, body);

  function postNow() {
    // Both in the click itself: browsers allow neither once the click has passed. The copy goes
    // first, while this page still has the focus the new tab is about to take (lib/copy-text.ts).
    const copying = copyTextNow(text);
    const win = window.open("about:blank", "_blank");
    if (win) win.opener = null;
    start(async () => {
      const copied = await copying;
      const result = await postSocialSuggestion(websiteId, suggestion.id, { body, title: hasTitle ? title : undefined }).catch(() => null);
      if (!result?.ok) {
        win?.close();
        refuse(result && !result.ok ? result : null);
        return;
      }
      if (win) win.location.href = result.data.url;
      // Quora and replies on Reddit and Bluesky only have the clipboard: never say "copied" when it is not.
      if (!copied && (!win || !result.data.filled)) toast.error(format(t.copyFailed, { platform: platformName }));
      else if (!win) toast.message(format(t.popupBlocked, { platform: platformName }));
      else if (copied) toast.success(format(t.copied, { platform: platformName }));
      router.refresh();
    });
  }

  function act(action: () => Promise<SocialResult<unknown>>, success?: string) {
    start(async () => {
      const result = await action().catch(() => null);
      if (!result?.ok) return refuse(result && !result.ok ? result : null);
      if (success) toast.success(success);
      router.refresh();
    });
  }

  const max = spec?.maxLength ?? 4000;
  return (
    <li className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge variant="secondary">{platformName}</Badge>
        <span className="font-medium">
          {format(suggestion.kind === "reply" ? t.replyOn : t.postOn, { platform: platformName })}
        </span>
        {suggestion.warmup ? <Badge variant="outline">{t.warmupBadge}</Badge> : null}
      </div>

      {suggestion.threadUrl ? (
        <div className="rounded-lg bg-muted/40 p-3 text-sm">
          <a
            href={suggestion.threadUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-medium underline-offset-4 hover:underline"
          >
            {suggestion.threadTitle || t.openThread}
            <ExternalLink className="size-3" aria-hidden="true" />
          </a>
          {suggestion.threadSnippet ? <p className="mt-1 line-clamp-3 text-muted-foreground">{suggestion.threadSnippet}</p> : null}
        </div>
      ) : null}

      {suggestion.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- the article's own picture, on its own host
        <img src={suggestion.imageUrl} alt="" className="h-32 w-auto rounded-lg border object-cover" />
      ) : null}

      {hasTitle ? (
        <label className="grid gap-1 text-xs font-medium">
          {t.titleLabel}
          <Input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={spec?.titleMax} disabled={!canEdit} />
        </label>
      ) : null}
      <div className="grid gap-1">
        <label htmlFor={`${id}-body`} className="text-xs font-medium">
          {t.textLabel}
        </label>
        <Textarea
          id={`${id}-body`}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={Math.min(10, Math.max(3, Math.ceil(body.length / 90)))}
          disabled={!canEdit || suggestion.status === "posting"}
          aria-describedby={`${id}-count`}
        />
        <p id={`${id}-count`} className={`text-right text-xs ${body.length > max ? "text-destructive" : "text-muted-foreground"}`}>
          {format(t.characters, { count: String(body.length), max: String(max) })}
        </p>
      </div>

      {scheduled && suggestion.scheduledFor ? (
        <p className="text-sm text-muted-foreground">
          {format(t.scheduled, {
            time: formatDate(suggestion.scheduledFor, locale, { weekday: "short", hour: "2-digit", minute: "2-digit" }),
          })}
        </p>
      ) : null}
      {suggestion.status === "posting" ? <p className="text-sm text-muted-foreground">{t.publishing}</p> : null}
      {suggestion.status === "failed" ? (
        <Notice tone="warning">
          {suggestion.error === "not_enough_credits" ? t.failedCredits : format(t.failed, { reason: suggestion.error ?? "-" })}
        </Notice>
      ) : null}

      {canEdit && suggestion.status !== "posting" ? (
        <div className="flex flex-wrap gap-2">
          {scheduled ? (
            <>
              {edited ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => act(() => editScheduledPost(websiteId, suggestion.id, { body, title: hasTitle ? title : undefined }), t.saved)}
                >
                  {t.saveEdit}
                </Button>
              ) : null}
              <Button size="sm" disabled={pending || edited} onClick={() => act(() => postScheduledNow(websiteId, suggestion.id))}>
                <Send aria-hidden="true" />
                {t.postNow}
              </Button>
            </>
          ) : (
            <Button size="sm" disabled={pending || body.trim().length === 0 || body.length > max} onClick={postNow}>
              <Send aria-hidden="true" />
              {pending ? t.posting : format(t.post, { price: priceLabel })}
            </Button>
          )}
          <CopyTextButton text={text} t={t} />
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => act(() => skipSocialSuggestion(websiteId, suggestion.id))}>
            <SkipForward aria-hidden="true" />
            {t.skip}
          </Button>
        </div>
      ) : null}
    </li>
  );
}
