"use client";

import { Clock, RefreshCw, Search, Send, SkipForward } from "lucide-react";
import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeLikeSelect } from "@/components/ui/native-like-select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Notice } from "@/components/workspace/notice";
import type { Locale } from "@/lib/i18n/config";
import { format } from "@/lib/i18n/format";
import { OPPORTUNITIES_COPY } from "@/lib/i18n/opportunities";
import { SOCIAL_CONNECTIONS_COPY } from "@/lib/i18n/social-connections";
import { findSocialSuggestions, postScheduledNow, skipSocialSuggestion } from "@/lib/social/actions";
import { CONNECTIONS_ANCHOR, type ConnectNotice } from "@/lib/social/connect-return";
import { availablePlatforms, PLATFORMS } from "@/lib/social/platforms";
import { cn } from "@/lib/utils";

import { AccountsDialog } from "./accounts-dialog";
import { ConnectionsPanel } from "./connections-panel";
import {
  groupRows,
  nextScheduled,
  pasteText,
  SORTS,
  tabCounts,
  TABS,
  visibleRows,
  type AccountView,
  type Sort,
  type SuggestionView,
  type Tab,
} from "./opportunities";
import { PlatformGroups } from "./platform-groups";
import { headline, ReviewSheet } from "./review-sheet";
import { atTime, CopyTextButton, priceText, useSocialAction, type T } from "./social-shared";

/**
 * The Opportunities page (client, 2026-10-27; redesigned from the client's
 * design, 2026-11-03). The six platforms as cards, each connected or
 * disconnected in one click (connections-panel.tsx, client's design
 * 2026-11-11), the connected ones' settings behind the panel's "Account
 * settings"; then every opportunity in one panel, from the first suggestion
 * to the published post, in tabs by stage, with the next post RepGet
 * publishes on top and one row per platform that opens to its own
 * (platform-groups.tsx; Daniel, 2026-11-24). A row's Review opens the drawer,
 * where a reply is edited and posted with one click.
 *
 * No account has to be connected: suggestions come from the website itself
 * and are posted by hand. Nothing here says why an automatic post did not go
 * out - it is simply ready to post.
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
  /** The website's analysis has finished: until then nothing can be suggested. */
  analysed: boolean;
  todayCount: number;
  perDay: number;
  /**
   * Free plan only (null otherwise): its posts this UTC month against its
   * hard monthly allowance, and the AI drafts left of the month's. Shown
   * before the day's count, which is kept only while drafts are left.
   */
  freeMonth?: { posts: number; postsMax: number; draftsLeft: number } | null;
  priceLabel: string;
  boards: string[];
  notice: { kind: ConnectNotice; platform: string | null } | null;
  locale: Locale;
  t: T;
}) {
  const { t, websiteId, canEdit, locale } = props;
  const copy = SOCIAL_CONNECTIONS_COPY[locale];
  const words = OPPORTUNITIES_COPY[locale];
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
  const filtered = query.trim() !== "" || platform !== "all";
  const groups = groupRows(visible, { keepEmpty: tab === "all" && !filtered, platforms: availablePlatforms(props.bundle) });
  const find = () => finder.run(() => findSocialSuggestions(websiteId), { success: t.findQueued });
  const findDisabled = finder.pending || !props.analysed || props.todayCount >= props.perDay || props.freeMonth?.draftsLeft === 0;
  const isConnected = (name: string) => props.platforms.includes(name) && accountFor(name) !== null;

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
          <p className="max-w-2xl text-sm text-muted-foreground">{words.intro}</p>
        </div>
        {canEdit ? (
          <Button
            variant="outline"
            className="self-start sm:self-auto"
            disabled={findDisabled}
            onClick={find}
          >
            <RefreshCw aria-hidden="true" className={cn(finder.pending && "motion-safe:animate-spin")} />
            {finder.pending ? t.finding : t.findNow}
          </Button>
        ) : null}
      </div>

      {props.analysed ? null : (
        <Notice role="status" title={words.analysingTitle}>
          {words.analysingHelp}
        </Notice>
      )}

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
                {availablePlatforms(props.bundle).map((name) => (
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

          {rows.length > 0 ? (
            <p role="status" className="px-4 pt-4 pb-3 text-sm text-muted-foreground sm:px-6">
              {format(words.showing, { shown: String(visible.length), total: String(rows.length), platforms: String(groups.length) })}
            </p>
          ) : null}

          {TABS.map((value) => (
            <TabsContent key={value} value={value}>
              {rows.length === 0 ? (
                <div className="border-t px-6 py-12 text-center">
                  <p className="font-semibold">
                    {!props.analysed ? words.analysingTitle : props.accounts.length > 0 ? t.emptyToday : words.emptyTitle}
                  </p>
                  {props.analysed && props.accounts.length === 0 ? (
                    <p className="mx-auto mt-1 max-w-xl text-sm text-muted-foreground">{words.emptyHelp}</p>
                  ) : null}
                  {canEdit && props.analysed && props.accounts.length === 0 ? (
                    <div className="mt-4 flex flex-wrap justify-center gap-2">
                      <Button disabled={findDisabled} onClick={find}>
                        {finder.pending ? t.finding : t.findNow}
                      </Button>
                      <Button asChild variant="outline">
                        <a href={`#${CONNECTIONS_ANCHOR}`}>{words.connectOptional}</a>
                      </Button>
                    </div>
                  ) : null}
                </div>
              ) : visible.length === 0 ? (
                <div className="border-t px-6 py-12 text-center">
                  <p className="font-semibold">{t.noMatches}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{t.noMatchesHelp}</p>
                </div>
              ) : (
                <PlatformGroups
                  groups={groups}
                  connected={isConnected}
                  filtered={filtered}
                  websiteId={websiteId}
                  editable={editable}
                  pending={pending}
                  onReview={review}
                  onSkip={(row) =>
                    run(() => skipSocialSuggestion(websiteId, row.id), row.status === "scheduled" ? { success: t.movedToDrafts } : {})
                  }
                  priceLabel={props.priceLabel}
                  locale={locale}
                  t={t}
                />
              )}
            </TabsContent>
          ))}
        </Tabs>

        <p className="border-t px-4 py-3 text-xs text-muted-foreground sm:px-6">{usageLine(props, t)}</p>
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

/**
 * The list's footer: "3 of 10 today · Price: 2 credits" on a paid plan. On
 * Free, "1 of 8 posts this month" first - its hard monthly allowance, which
 * is what runs out - then the day's drafts only while the month still has
 * drafts left (after that none come today anyway), then the price (free).
 */
function usageLine(
  props: { todayCount: number; perDay: number; freeMonth?: { posts: number; postsMax: number; draftsLeft: number } | null; priceLabel: string },
  t: Pick<T, "todayCount" | "freeMonthPosts" | "price" | "priceFree" | "free">,
): string {
  const today = format(t.todayCount, { count: String(props.todayCount), max: String(props.perDay) });
  const price = priceText(t, props.priceLabel);
  if (!props.freeMonth) return `${today} · ${price}`;
  const month = format(t.freeMonthPosts, { count: String(Math.min(props.freeMonth.posts, props.freeMonth.postsMax)), max: String(props.freeMonth.postsMax) });
  return props.freeMonth.draftsLeft > 0 ? `${month} · ${today} · ${price}` : `${month} · ${price}`;
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
