"use client";

import { Clock, Copy, ExternalLink, MoreHorizontal, RefreshCw, Search, Send, SkipForward } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { NativeLikeSelect } from "@/components/ui/native-like-select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Notice } from "@/components/workspace/notice";
import { copyTextNow } from "@/lib/copy-text";
import type { Locale } from "@/lib/i18n/config";
import { format, plural } from "@/lib/i18n/format";
import { SOCIAL_CONNECTIONS_COPY } from "@/lib/i18n/social-connections";
import { findSocialSuggestions, postScheduledNow, setSocialAutoPost, skipSocialSuggestion } from "@/lib/social/actions";
import { CONNECTIONS_ANCHOR, type ConnectNotice } from "@/lib/social/connect-return";
import { PLATFORMS, SOCIAL_PLATFORMS } from "@/lib/social/platforms";
import { cn } from "@/lib/utils";

import { AccountsDialog } from "./accounts-dialog";
import { ConnectionsPanel } from "./connections-panel";
import {
  latest,
  nextScheduled,
  pasteText,
  platformName,
  SORTS,
  stageOf,
  tabCounts,
  TABS,
  visibleRows,
  whereOf,
  type AccountView,
  type Sort,
  type Stage,
  type SuggestionView,
  type Tab,
} from "./opportunities";
import { headline, ReviewSheet } from "./review-sheet";
import { Ago, atTime, CopyTextButton, PlatformTile, StageChip, useSocialAction, type T } from "./social-shared";


/**
 * The Opportunities page (client, 2026-10-27; redesigned from the client's
 * design, 2026-11-03). The six platforms as cards, each connected or
 * disconnected in one click (connections-panel.tsx, client's design
 * 2026-11-11), the connected ones' settings behind the panel's "Account
 * settings"; then every conversation in one panel, from the first
 * suggestion to the published post, in tabs by stage, with the next post
 * RepGet publishes on top. A row opens the review drawer, where a reply is
 * edited and posted with one click.
 *
 * RepGet publishes only the customer's OWN posts (scheduled); replies in
 * other people's discussions are always the customer's click (review-sheet.tsx).
 */
export function SocialPanel(props: {
  websiteId: string;
  canEdit: boolean;
  level: "paid" | "trial" | "none";
  platforms: string[];
  /** RepGet publishes nothing here (socialAccess): no automatic posting to offer. */
  manualOnly?: boolean;
  bundle: boolean;
  accounts: AccountView[];
  open: SuggestionView[];
  posted: SuggestionView[];
  todayCount: number;
  perDay: number;
  priceLabel: string;
  boards: string[];
  notice: { kind: ConnectNotice; platform: string | null } | null;
  locale: Locale;
  t: T;
}) {
  const { t, websiteId, canEdit, locale } = props;
  const copy = SOCIAL_CONNECTIONS_COPY[locale];
  const { pending, run } = useSocialAction(t, props.priceLabel);
  // Its own transition: "Looking…" is for this button, not for a skip elsewhere on the page.
  const finder = useSocialAction(t, props.priceLabel);
  const [manage, setManage] = useState(false);
  const [tab, setTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");
  const [platform, setPlatform] = useState("all");
  const [sort, setSort] = useState<Sort>("recommended");
  // Kept after closing, so the drawer still has its content while it slides out.
  const [selected, setSelected] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);

  const rows = [...props.open, ...props.posted];
  const counts = tabCounts(rows);
  const visible = visibleRows(rows, { tab, platform, query, sort });
  const next = tab === "all" || tab === "scheduled" ? nextScheduled(rows) : null;
  const current = rows.find((row) => row.id === selected) ?? null;
  const editable = (row: SuggestionView) => canEdit && props.platforms.includes(row.platform);
  const accountFor = (name: string) => props.accounts.find((account) => account.platform === name) ?? null;
  const paused = props.accounts.filter((account) => account.pausedReason !== null && props.platforms.includes(account.platform));

  function review(id: string) {
    setSelected(id);
    setReviewing(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {t.title}
            <span className="text-primary" aria-hidden="true">
              .
            </span>
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">{t.intro}</p>
        </div>
        {canEdit && props.accounts.length > 0 ? (
          <Button
            variant="outline"
            className="self-start sm:self-auto"
            disabled={finder.pending || props.todayCount >= props.perDay}
            onClick={() => finder.run(() => findSocialSuggestions(websiteId), { success: t.findQueued })}
          >
            <RefreshCw aria-hidden="true" className={cn(finder.pending && "motion-safe:animate-spin")} />
            {finder.pending ? t.finding : t.findNow}
          </Button>
        ) : null}
      </div>

      {/* The accounts' settings are in a dialog: a paused one must still be seen without opening it. */}
      {paused.map((account) => (
        <Notice
          key={account.platform}
          tone="warning"
          action={
            canEdit ? (
              <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => setSocialAutoPost(websiteId, account.platform, true))}>
                {t.resume}
              </Button>
            ) : null
          }
        >
          {format(t.paused, { platform: platformName(account.platform), reason: account.pausedReason || "-" })}
        </Notice>
      ))}

      <ConnectionsPanel
        websiteId={websiteId}
        accounts={props.accounts}
        platforms={props.platforms}
        bundle={props.bundle}
        canEdit={canEdit}
        priceLabel={props.priceLabel}
        notice={props.notice}
        onSettings={() => setManage(true)}
        locale={locale}
        t={t}
        copy={copy}
      />

      <section aria-labelledby="social-conversations" className="overflow-hidden rounded-xl border bg-card">
        <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)} className="flex-col gap-0">
          <div className="flex flex-col gap-4 border-b px-4 pt-5 sm:px-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="lg:pb-4">
              <h2 id="social-conversations" className="text-lg font-semibold tracking-tight">
                {t.panelTitle}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">{t.panelIntro}</p>
            </div>
            {/* Scrolls on its own on a phone, so the page never scrolls sideways. */}
            <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
              <TabsList variant="line" aria-label={t.tabsLabel} className="h-auto gap-5 p-0 group-data-horizontal/tabs:h-auto">
                {TABS.map((value) => (
                  <TabsTrigger
                    key={value}
                    value={value}
                    className="group/trigger h-auto flex-none px-0 pt-1 pb-3 after:bg-primary group-data-horizontal/tabs:after:bottom-0"
                  >
                    {t.tabs[value]}
                    <span className="rounded-md bg-muted px-1.5 py-0.5 text-[0.7rem] font-semibold text-muted-foreground tabular-nums group-data-[state=active]/trigger:bg-primary/10 group-data-[state=active]/trigger:text-primary-strong">
                      {counts[value]}
                    </span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
          </div>

          <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="relative w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t.searchPlaceholder}
                aria-label={t.searchLabel}
                autoComplete="off"
                className="pl-8"
              />
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <NativeLikeSelect aria-label={t.platformLabel} value={platform} onChange={(event) => setPlatform(event.target.value)} className="sm:w-40">
                <option value="all">{t.allPlatforms}</option>
                {SOCIAL_PLATFORMS.map((name) => (
                  <option key={name} value={name}>
                    {PLATFORMS[name].name}
                  </option>
                ))}
              </NativeLikeSelect>
              <NativeLikeSelect aria-label={t.sortLabel} value={sort} onChange={(event) => setSort(event.target.value as Sort)} className="sm:w-44">
                {SORTS.map((value) => (
                  <option key={value} value={value}>
                    {t.sort[value]}
                  </option>
                ))}
              </NativeLikeSelect>
            </div>
          </div>

          {next ? (
            <NextToPublish
              row={next}
              editable={editable(next)}
              pending={pending}
              onReview={() => review(next.id)}
              onPublish={() => run(() => postScheduledNow(websiteId, next.id))}
              onSkip={() => run(() => skipSocialSuggestion(websiteId, next.id), { success: t.movedToDrafts })}
              locale={locale}
              t={t}
            />
          ) : null}

          <div
            aria-hidden="true"
            className="hidden justify-between border-y bg-muted/40 px-6 py-2.5 text-[0.68rem] font-semibold tracking-wider text-muted-foreground uppercase sm:flex"
          >
            <span>{t.listHead}</span>
            <span>{t.listAction}</span>
          </div>

          {TABS.map((value) => (
            <TabsContent key={value} value={value} className="border-t sm:border-t-0">
              {visible.length === 0 ? (
                <div className="px-6 py-14 text-center">
                  <p className="font-semibold">{rows.length === 0 ? (props.accounts.length === 0 ? t.empty : t.emptyToday) : t.noMatches}</p>
                  {rows.length > 0 ? <p className="mt-1 text-sm text-muted-foreground">{t.noMatchesHelp}</p> : null}
                  {rows.length === 0 && props.accounts.length === 0 && canEdit ? (
                    <Button asChild className="mt-4">
                      <a href={`#${CONNECTIONS_ANCHOR}`}>{t.connectAccounts}</a>
                    </Button>
                  ) : null}
                </div>
              ) : (
                <ul className="divide-y">
                  {visible.map((row) => (
                    <OpportunityRow
                      key={row.id}
                      row={row}
                      editable={editable(row)}
                      pending={pending}
                      onReview={() => review(row.id)}
                      onSkip={() =>
                        run(() => skipSocialSuggestion(websiteId, row.id), row.status === "scheduled" ? { success: t.movedToDrafts } : {})
                      }
                      locale={locale}
                      t={t}
                    />
                  ))}
                </ul>
              )}
            </TabsContent>
          ))}
        </Tabs>

        <div className="flex flex-col gap-1 border-t px-4 py-3 text-xs text-muted-foreground sm:flex-row sm:justify-between sm:px-6">
          <span role="status">{plural(t.inView, visible.length)}</span>
          <span>
            {format(t.todayCount, { count: String(props.todayCount), max: String(props.perDay) })} · {format(t.price, { price: props.priceLabel })}
          </span>
        </div>
      </section>

      <AccountsDialog
        open={manage}
        onOpenChange={setManage}
        websiteId={websiteId}
        accounts={props.accounts}
        platforms={props.platforms}
        manualOnly={props.manualOnly}
        boards={props.boards}
        canEdit={canEdit}
        pending={pending}
        run={run}
        priceLabel={props.priceLabel}
        locale={locale}
        t={t}
        copy={copy}
      />
      <ReviewSheet
        suggestion={current}
        open={reviewing}
        onOpenChange={setReviewing}
        websiteId={websiteId}
        editable={current ? editable(current) : false}
        canEdit={canEdit}
        account={current ? accountFor(current.platform) : null}
        priceLabel={props.priceLabel}
        locale={locale}
        t={t}
      />
    </div>
  );
}

function NextToPublish({
  row,
  editable,
  pending,
  onReview,
  onPublish,
  onSkip,
  locale,
  t,
}: {
  row: SuggestionView;
  editable: boolean;
  pending: boolean;
  onReview: () => void;
  onPublish: () => void;
  onSkip: () => void;
  locale: Locale;
  t: T;
}) {
  const id = useId();
  const at = atTime(row.scheduledFor!, locale);
  return (
    <div
      role="group"
      aria-labelledby={`${id}-label`}
      className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3 gap-y-3 border-t bg-muted/40 px-4 py-4 sm:px-6 lg:grid-cols-[2rem_minmax(0,1fr)_auto] lg:items-center"
    >
      <span className="grid size-8 place-items-center self-start rounded-lg border bg-card text-primary" aria-hidden="true">
        <Clock className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 text-[0.7rem] font-semibold tracking-wider text-primary-strong uppercase">
          <span id={`${id}-label`}>{t.nextTitle}</span>
          <time
            dateTime={row.scheduledFor!}
            className="rounded-md border bg-card px-1.5 py-0.5 tracking-normal text-foreground normal-case"
            suppressHydrationWarning
          >
            {at}
          </time>
        </p>
        <button
          type="button"
          onClick={onReview}
          className="mt-1 block max-w-full truncate rounded-sm text-left text-sm font-semibold outline-none hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {headline(row, t)}
        </button>
        <p className="text-xs text-muted-foreground" suppressHydrationWarning>
          {format(t.scheduled, { time: at })}
        </p>
      </div>
      <div className="col-start-2 flex flex-wrap items-center gap-2 lg:col-start-auto lg:justify-end">
        {editable ? (
          <Button size="sm" disabled={pending} onClick={onPublish}>
            <Send aria-hidden="true" />
            {t.postNow}
          </Button>
        ) : null}
        <CopyTextButton text={pasteText(row.title, row.body)} t={t} />
        {editable ? (
          <Button size="sm" variant="ghost" disabled={pending} onClick={onSkip}>
            <SkipForward aria-hidden="true" />
            {t.skip}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/** "Suggested reply: ...", "Your draft: ...", by stage and kind. */
function leadOf(stage: Stage, kind: string, t: T): string | null {
  switch (stage) {
    case "suggested":
      return kind === "reply" ? t.lead.suggestedReply : t.lead.suggestedPost;
    case "draft":
      return t.lead.draft;
    case "scheduled":
    case "publishing":
      return t.lead.scheduled;
    case "published":
      return kind === "reply" ? t.lead.publishedReply : t.lead.publishedPost;
    case "failed":
      return null;
  }
}

const SKIPPABLE: Stage[] = ["suggested", "draft", "scheduled", "failed"];

function OpportunityRow({
  row,
  editable,
  pending,
  onReview,
  onSkip,
  locale,
  t,
}: {
  row: SuggestionView;
  editable: boolean;
  pending: boolean;
  onReview: () => void;
  onSkip: () => void;
  locale: Locale;
  t: T;
}) {
  const id = useId();
  const stage = stageOf(row.status);
  const lead = leadOf(stage, row.kind, t);
  const where = whereOf(row);
  const text = pasteText(row.title, row.body);
  const action =
    stage === "suggested" ? t.review : stage === "draft" ? t.continue : stage === "scheduled" ? t.edit : stage === "failed" ? t.retry : t.details;

  async function copy() {
    if (await copyTextNow(text)) toast.success(t.copyDone);
    else toast.error(t.errors.generic);
  }

  return (
    <li className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-x-3 gap-y-3 px-4 py-4 transition-colors hover:bg-muted/30 sm:grid-cols-[2.25rem_minmax(0,1fr)_auto] sm:items-center sm:gap-x-4 sm:px-6">
      <PlatformTile platform={row.platform} size="lg" className="self-start" />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground/80">{platformName(row.platform)}</span>
          <span aria-hidden="true">•</span>
          <span className="max-w-[14rem] truncate">{where ?? t.ownProfile}</span>
          <span aria-hidden="true">•</span>
          <Ago value={latest(row)} locale={locale} />
          <StageChip stage={stage} t={t} />
          {stage === "scheduled" && row.scheduledFor ? (
            <time dateTime={row.scheduledFor} className="font-medium text-sky-700 dark:text-sky-300" suppressHydrationWarning>
              {atTime(row.scheduledFor, locale)}
            </time>
          ) : null}
        </div>
        <h3 id={`${id}-title`} className="mt-1.5 line-clamp-2 text-sm leading-snug font-semibold">
          {headline(row, t)}
        </h3>
        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground sm:line-clamp-1">
          {lead ? <span className="font-medium text-foreground/70">{lead}: </span> : null}
          {row.body}
        </p>
        {stage === "failed" ? (
          <p className="mt-1 text-xs text-destructive">
            {row.error === "not_enough_credits" ? t.failedCredits : format(t.failed, { reason: row.error ?? "-" })}
          </p>
        ) : null}
      </div>
      <div className="col-start-2 flex items-center gap-1 sm:col-start-auto sm:justify-end">
        {stage === "published" && row.postedUrl ? (
          <Button asChild size="sm" variant="outline" className="min-w-20">
            <a href={row.postedUrl} target="_blank" rel="noopener noreferrer" aria-describedby={`${id}-title`}>
              {t.viewPost}
              <ExternalLink aria-hidden="true" />
            </a>
          </Button>
        ) : (
          <Button
            size="sm"
            variant={stage === "suggested" ? "default" : "outline"}
            // The design's dark "Review": the one call to action per row, without a page of orange.
            className={cn("min-w-20", stage === "suggested" && "bg-foreground text-background hover:bg-foreground/85")}
            onClick={onReview}
            aria-describedby={`${id}-title`}
          >
            {action}
          </Button>
        )}
        {/* Not modal: a modal menu handing the focus back fights the drawer it opens. */}
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button size="icon-sm" variant="ghost" aria-label={t.more} aria-describedby={`${id}-title`}>
              <MoreHorizontal aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onSelect={copy}>
              <Copy aria-hidden="true" />
              {t.copyText}
            </DropdownMenuItem>
            {row.threadUrl ? (
              <DropdownMenuItem asChild>
                <a href={row.threadUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink aria-hidden="true" />
                  {t.openThread}
                </a>
              </DropdownMenuItem>
            ) : null}
            {stage === "published" && row.postedUrl ? <DropdownMenuItem onSelect={onReview}>{t.details}</DropdownMenuItem> : null}
            {editable && SKIPPABLE.includes(stage) ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled={pending} onSelect={onSkip}>
                  <SkipForward aria-hidden="true" />
                  {t.skip}
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
}
