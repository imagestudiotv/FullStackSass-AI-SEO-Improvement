"use client";

import {
  BarChart3,
  ChevronRight,
  ExternalLink,
  Eye,
  FileText,
  Loader2,
  Pencil,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useDeferredValue, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { PARTNER_LINK_SCOPE, PartnerLinkStyles } from "@/components/partner-link-styles";
import { useRefreshWhile } from "@/components/refresh-while";
import { RichTextEditor } from "@/components/rich-text-editor";
import { Button } from "@/components/ui/button";
import { EmptyState, Stat } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/status-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Notice } from "@/components/workspace/notice";
import { SaveBar, SaveBarSpacer, type SaveBarState } from "@/components/workspace/save-bar";
import { WorkspaceSection } from "@/components/workspace/section";
import { useUnsavedChanges } from "@/components/workspace/use-unsaved-changes";
import { regenerateArticle, updateArticle, type ArticleDetail } from "@/lib/articles/actions";
import { listReusableImages, uploadInlineImage } from "@/lib/articles/image-actions";
import { articleStats } from "@/lib/articles/stats";
import type { Locale } from "@/lib/i18n/config";
import { format, formatNumber, intlTag, plural } from "@/lib/i18n/format";
import type { Messages } from "@/lib/i18n/messages";
import { publishArticle } from "@/lib/publishing/actions";

import type { HistoryRow } from "./article-data";
import { ArticleFields } from "./article-fields";
import { ArticlePreview, PartnerLegend } from "./article-preview";
import { ArticlePublishing } from "./article-publishing";
import { ConfirmDialog } from "./confirm-dialog";
import { savedForm, type FieldKey } from "./draft-state";
import {
  actionErrorText,
  generationFailureText,
  imageSizeErrorText,
  type GenerationFailureKind,
} from "./failure-copy";
import { ACCEPTED_IMAGE_TYPES, FeaturedImage } from "./featured-image";
import { PublishHistory } from "./publish-history";
import { SearchAppearance } from "./search-appearance";
import {
  awaitingResult,
  planPublishing,
  PRESS_WATCH_MS,
  refreshNeed,
  type PendingPress,
  type PublishFacts,
} from "./publish-state";
import { UncertainPublication } from "./uncertain-publication";
import { useArticleDraft } from "./use-article-draft";
import { useSlowRefresh } from "./use-slow-refresh";

/** The generation step, in the reader's language. */
function stepLabel(step: string | null, t: Messages["app"]["editor"]): string {
  if (step === "outline") return t.planningOutline;
  if (step === "body") return t.writingBody;
  return t.starting;
}

/** Only an absolute address is a link to the customer's site (a provider can report a bare path). */
function siteUrl(url: string | null): string | null {
  return url && /^https?:\/\//i.test(url) ? url : null;
}

export type ArticleEditorProps = {
  websiteId: string;
  /** The article, with its stored error removed (failureKind says what it means). */
  article: ArticleDetail;
  /** Owner or editor. A viewer reads the article, its status and history, and changes nothing. */
  canEdit: boolean;
  locale: Locale;
  /** Decides which links count as internal. */
  websiteDomain: string | null;
  /** The customer's site (https://example.com): Preview sends links written as a path ("/services") there. */
  siteOrigin: string | null;
  /** Partner Network links in this article (their addresses), highlighted in Preview and Edit. */
  partnerLinks: string[];
  facts: PublishFacts;
  history: HistoryRow[];
  historyLimit: number;
  /** Why writing failed, when the article's status is failed. */
  failureKind: GenerationFailureKind | null;
  /** The latest direct send got no answer: the notice with its confirmation. */
  uncertain: boolean;
  /** article.updatedAt, formatted on the server. */
  lastSaved: string;
  rewriteLimit: number;
  imageMaxAttempts: number;
  imageMaxBytes: number;
  plannedArticlesLabel: string;
  uncertainText: { title: string; help: string; confirm: string; confirmed: string };
  t: Messages["app"]["editor"];
  tImage: Messages["app"]["image"];
  tCommon: Messages["app"]["common"];
  tStatus: Messages["app"]["status"];
  tEditorUi: Messages["app"]["editorUi"];
  tWorkspace: Messages["app"]["workspace"];
};

/**
 * The article workspace: a title and status at the top; the article itself
 * (Preview and Edit) in a readable main column; beside it the publishing
 * panel, the metadata as a search result shows it, the featured image,
 * statistics, the publishing history and Rewrite. On narrower screens the
 * same parts stack - publishing first, then the article, then the rest.
 *
 * Save (the bar at the bottom), Publish/Send as draft (the publishing panel)
 * and Rewrite (its own section, behind a confirmation) are three separate
 * places, so none is mistaken for another.
 */
export function ArticleEditor({
  websiteId,
  article,
  canEdit,
  locale,
  websiteDomain,
  siteOrigin,
  partnerLinks,
  facts,
  history,
  historyLimit,
  failureKind,
  uncertain,
  lastSaved,
  rewriteLimit,
  imageMaxAttempts,
  imageMaxBytes,
  plannedArticlesLabel,
  uncertainText,
  t,
  tImage,
  tCommon,
  tStatus,
  tEditorUi,
  tWorkspace,
}: ArticleEditorProps) {
  const router = useRouter();
  const working = article.status === "generating" || article.status === "queued";
  const hasBody = Boolean(article.bodyHtml);
  const delivering = facts.delivering;
  /** Edits wait while a rewrite would replace them or a delivery holds the row. */
  const editable = canEdit && !working && !delivering;
  const errorText = (error: string) => actionErrorText(error, { t, tWorkspace, tImage });

  /* ------------------------------------------------------------ the draft */
  const draft = useArticleDraft({
    title: article.title,
    metaDescription: article.metaDescription ?? "",
    slug: article.slug ?? "",
    bodyHtml: article.bodyHtml ?? "",
  });
  const { values } = draft;
  const unsavedCount = draft.dirty.length;
  const dirty = unsavedCount > 0;
  const [saving, startSave] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSaveOk, setLastSaveOk] = useState(false);
  /** A featured-image description typed and not saved yet (it saves when its field is left). */
  const [altUnsaved, setAltUnsaved] = useState(false);
  // One guard for the page: the article's fields and that description.
  useUnsavedChanges(dirty || saving || altUnsaved, tWorkspace.leaveConfirm);

  const titleMissing = savedForm("title", values.title) === "";
  const saveHeldNote = titleMissing
    ? t.saveNoteTitle
    : working
      ? t.saveNoteWorking
      : delivering
        ? t.saveNoteDelivering
        : null;

  function handleSave() {
    if (saveHeldNote || saving) return;
    const payload = draft.startSave();
    if (!payload) return;
    setSaveError(null);
    setLastSaveOk(false);
    startSave(async () => {
      const result = await updateArticle(websiteId, article.id, payload);
      if (!result.ok) {
        draft.saveFailed();
        setSaveError(errorText(result.error));
        return;
      }
      draft.saveSucceeded();
      setLastSaveOk(true);
      router.refresh();
    });
  }

  function handleDiscard() {
    draft.discard();
    setSaveError(null);
    setLastSaveOk(false);
  }

  const saveBarState: SaveBarState = draft.saving
    ? { kind: "saving", count: Math.max(unsavedCount, 1) }
    : saveError && dirty
      ? { kind: "failed", error: saveError, count: unsavedCount }
      : dirty
        ? { kind: "dirty", count: unsavedCount }
        : lastSaveOk
          ? { kind: "saved" }
          : { kind: "clean" };
  const saveNote =
    saveHeldNote ??
    (lastSaveOk && dirty ? tWorkspace.editsKept : facts.review === "approved" && dirty ? t.saveNoteReview : undefined);

  /* ---------------------------------------------------------------- tabs */
  const [tab, setTab] = useState<"preview" | "edit">("preview");
  /** The editor mounts the first time Edit is opened and then stays, so undo history and HTML mode survive Preview. */
  const [editMounted, setEditMounted] = useState(false);
  function changeTab(next: string) {
    const value = next === "edit" ? "edit" : "preview";
    if (value === "edit") setEditMounted(true);
    setTab(value);
  }

  /* ---------------------------------------------------------- publishing */
  const [publishing, startPublish] = useTransition();
  const [pressing, setPressing] = useState<"publish" | "draft" | null>(null);
  const [press, setPress] = useState<PendingPress | null>(null);
  const [pressExpired, setPressExpired] = useState(false);
  const [pressError, setPressError] = useState<string | null>(null);
  const [pluginNotice, setPluginNotice] = useState<{ tone: "success" | "warning"; text: string; href?: string } | null>(null);
  const [checking, startCheck] = useTransition();

  const awaiting = awaitingResult(press, facts);
  if (press && !awaiting) {
    // A newer dispatch or log arrived: the panel shows the real state from here.
    setPress(null);
    setPressExpired(false);
  }

  useEffect(() => {
    if (!press) return;
    const timer = window.setTimeout(() => setPressExpired(true), Math.max(0, press.at + PRESS_WATCH_MS - Date.now()));
    return () => window.clearTimeout(timer);
  }, [press]);

  const pluginWaiting =
    facts.destination.kind === "plugin" && (article.publishRequested === "publish" || article.publishRequested === "draft");
  const need = refreshNeed({ working, delivering, watchingPress: awaiting && !pressExpired, pluginWaiting });
  useRefreshWhile(need === "fast");
  useSlowRefresh(need === "slow");

  const plan = planPublishing({
    canEdit,
    hasBody,
    working,
    /*
      A save in flight changes the saved version: publishing waits for it too.
      (A typed featured-image description needs no wait: pressing Publish
      leaves its field first, which saves it, and the client dispatches server
      actions one at a time, so that save reaches the server before the press.)
    */
    dirty: dirty || draft.saving,
    awaiting,
    // After PRESS_WATCH_MS the press no longer holds Publish and Send as draft (the job may have held it without a trace).
    pressExpired,
    publishRequested: article.publishRequested,
    publishedUrl: article.publishedUrl,
    facts,
  });

  function handlePublish(status: "publish" | "draft") {
    if (publishing) return;
    // What was newest before this press, to recognise its result when it is recorded.
    const baseline = { dispatchId: facts.latestDispatchId, logId: facts.latestLogId };
    setPressError(null);
    setPluginNotice(null);
    setPressing(status);
    startPublish(async () => {
      const result = await publishArticle(websiteId, article.id, status);
      setPressing(null);
      if (!result.ok) {
        setPressError(errorText(result.error));
        return;
      }
      const { publishedUrl, queued } = result.data;
      if (publishedUrl) {
        // The plugin created it before answering.
        setPluginNotice({
          tone: "success",
          text: status === "publish" ? t.publishedToSite : t.sentAsDraftToSite,
          href: siteUrl(publishedUrl) ?? undefined,
        });
      } else if (facts.destination.kind === "plugin" && queued) {
        setPluginNotice({ tone: "warning", text: t.publishViaPlugin });
      } else {
        // Queued for the publishing job: watch for its result, never assume it.
        setPress({ status, at: Date.now(), ...baseline });
        setPressExpired(false);
      }
      router.refresh();
    });
  }

  // Formatted only in the browser, after a press (no server render to disagree with), in UTC like every other time on this page.
  const pressTime = press
    ? `${new Intl.DateTimeFormat(intlTag(locale), { hour: "2-digit", minute: "2-digit", timeZone: "UTC" }).format(press.at)} UTC`
    : null;

  /* ------------------------------------------------------------- rewrite */
  const [rewriting, startRewrite] = useTransition();
  const [rewriteError, setRewriteError] = useState<string | null>(null);
  const [rewriteStarted, setRewriteStarted] = useState(false);
  if (rewriteStarted && working) setRewriteStarted(false);
  const rewriteReason = !article.calendarItemId
    ? t.rewriteNoPlan
    : working || delivering
      ? t.rewriteBlocked
      : null;

  function handleRewrite() {
    setRewriteError(null);
    startRewrite(async () => {
      const result = await regenerateArticle(websiteId, article.id);
      if (!result.ok) {
        setRewriteError(errorText(result.error));
        return;
      }
      // The new version replaces every field; nothing local is worth keeping.
      draft.discard();
      setSaveError(null);
      setLastSaveOk(false);
      setRewriteStarted(true);
      router.refresh();
    });
  }

  function rewriteConfirmBody() {
    return (
      <>
        <p>{t.rewriteConfirmBody}</p>
        {article.publishedUrl ? <p>{t.rewriteConfirmPublished}</p> : null}
        {facts.review !== "none" ? <p>{t.rewriteConfirmReview}</p> : null}
        {dirty ? <p>{t.rewriteConfirmUnsaved}</p> : null}
      </>
    );
  }

  /* -------------------------------------------------------------- images */
  async function handleInlineUpload(file: File): Promise<string | null> {
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      toast.error(t.imageTypeError);
      return null;
    }
    if (file.size > imageMaxBytes) {
      toast.error(imageSizeErrorText(file.size, imageMaxBytes, locale, t));
      return null;
    }
    const body = new FormData();
    body.set("file", file);
    const result = await uploadInlineImage(websiteId, article.id, body);
    if (!result.ok) {
      toast.error(errorText(result.error));
      return null;
    }
    return result.data.url;
  }

  /**
   * Pictures this website has used before, for the picker. A stable
   * function: the picker debounces its search on the term and reads this
   * through a ref (components/image-picker.tsx).
   */
  const handleListImages = useCallback(
    async (term: string) => {
      const result = await listReusableImages(websiteId, term);
      return result.ok ? result.data.images : [];
    },
    [websiteId],
  );

  /* --------------------------------------------------------------- stats */
  // Counted from the text on screen; deferred so typing never waits on the counting.
  const statsBody = useDeferredValue(values.bodyHtml);
  const bodyStats = articleStats(statsBody || null, { domain: websiteDomain, targetKeyword: article.targetKeyword });
  // The featured image is not in the body HTML; it is attached to the post on publish.
  const stats = { ...bodyStats, images: bodyStats.images + (article.imageUrl ? 1 : 0) };
  const number = (value: number) => formatNumber(value, locale);

  const partnerInText = partnerLinks.some(
    (url) => values.bodyHtml.includes(url) || values.bodyHtml.includes(url.replace(/&/g, "&amp;")),
  );
  const fieldNames: Record<FieldKey, string> = {
    title: t.title,
    metaDescription: t.metaDescription,
    slug: t.slugLabel,
    bodyHtml: t.articleContent,
  };
  const liveUrl = siteUrl(article.publishedUrl);
  const wordPressPost =
    facts.destination.kind === "direct" && facts.destination.provider === "wordpress" && Boolean(article.publishedUrl);

  /* ------------------------------------------------------------- render */
  const preview = (
    <ArticlePreview
      title={canEdit ? savedForm("title", values.title) || values.title : article.title}
      bodyHtml={values.bodyHtml}
      imageUrl={article.imageUrl}
      imageAlt={article.imageAlt}
      unsaved={canEdit && dirty}
      partnerInText={partnerInText}
      siteOrigin={siteOrigin}
      t={t}
    />
  );

  /** Try again after a failure. With text on screen it replaces that text, so it asks first (via the dialog's trigger). */
  const tryAgain = (onClick?: () => void) => (
    <Button type="button" size="sm" variant="outline" disabled={rewriteReason !== null || rewriting} onClick={onClick}>
      {rewriting ? (
        <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
      ) : (
        <RefreshCw aria-hidden="true" />
      )}
      {t.tryAgain}
    </Button>
  );

  return (
    <div className="space-y-6">
      <PartnerLinkStyles urls={partnerLinks} label={t.partnerLink} />

      {/* Where this page sits, and the way back to the articles list it is opened from. */}
      <div className="space-y-3">
        <nav aria-label={t.breadcrumbLabel}>
          <ol className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
            <li className="shrink-0">
              <Link
                href={`/websites/${websiteId}/content`}
                className="rounded-sm font-medium outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {plannedArticlesLabel}
              </Link>
            </li>
            <li aria-hidden="true" className="shrink-0">
              <ChevronRight className="size-3.5" />
            </li>
            <li aria-current="page" className="min-w-0 truncate text-foreground">
              {article.title}
            </li>
          </ol>
        </nav>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-2">
            <h1 className="text-xl font-semibold tracking-tight text-foreground wrap-anywhere sm:text-2xl">
              {article.title}
            </h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
              {/* Large and filled: the answer to "is it on my site yet?". A draft reads amber - not live. */}
              <StatusBadge
                status={article.status}
                t={tStatus}
                size="lg"
                tone={article.status === "draft" ? "warning" : undefined}
              />
              {article.targetKeyword ? (
                <span className="inline-flex min-w-0 flex-wrap items-center gap-1.5">
                  <span className="text-xs">{t.targetKeywordLabel}</span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground wrap-anywhere">
                    {article.targetKeyword}
                  </span>
                </span>
              ) : null}
              <span className="text-xs">{format(t.lastSaved, { date: lastSaved })}</span>
            </div>
          </div>
          {liveUrl ? (
            <Button variant="outline" asChild className="shrink-0 self-start">
              <a href={liveUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink aria-hidden="true" />
                {t.viewOnSite}
              </a>
            </Button>
          ) : null}
        </div>
      </div>

      {/* What needs attention, before the article. */}
      <div className="space-y-3 empty:hidden">
        {!canEdit ? <Notice tone="info">{tWorkspace.viewOnly}</Notice> : null}

        {uncertain ? (
          <UncertainPublication
            websiteId={websiteId}
            articleId={article.id}
            canEdit={canEdit}
            text={uncertainText}
            errorText={errorText}
          />
        ) : null}

        {working ? (
          <div role="status" className="flex items-start gap-3 rounded-lg border bg-muted/40 px-4 py-3 text-sm">
            <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-primary motion-reduce:animate-none" aria-hidden="true" />
            <div className="min-w-0 space-y-1">
              <p className="font-medium">{stepLabel(article.generationStep, t)}</p>
              <p className="text-foreground/80">
                {t.takesAMinute}
                {hasBody && canEdit ? ` ${t.workingPaused}` : ""}
              </p>
            </div>
          </div>
        ) : null}

        {article.status === "failed" ? (
          <Notice tone="danger" title={t.couldNotWrite}>
            <p>{generationFailureText(failureKind ?? "generic", t)}</p>
            {canEdit ? (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                {hasBody ? (
                  <ConfirmDialog
                    trigger={tryAgain()}
                    disabled={rewriteReason !== null || rewriting}
                    title={t.rewriteConfirmTitle}
                    confirmLabel={t.rewriteConfirmAction}
                    cancelLabel={tCommon.cancel}
                    onConfirm={handleRewrite}
                  >
                    {rewriteConfirmBody()}
                  </ConfirmDialog>
                ) : (
                  tryAgain(handleRewrite)
                )}
                {rewriteReason && !working ? <span className="text-xs text-muted-foreground">{rewriteReason}</span> : null}
              </div>
            ) : null}
            {rewriteError ? (
              <p role="alert" className="mt-2 text-destructive">
                {rewriteError}
              </p>
            ) : null}
          </Notice>
        ) : null}

        {draft.conflicts.length > 0 ? (
          <Notice tone="warning" role="status" title={t.conflictTitle}>
            <p>{format(t.conflictBody, { fields: draft.conflicts.map((key) => fieldNames[key]).join(", ") })}</p>
            {/* Wrapping labels: the longer translations ("Gespeicherte Version verwenden") outgrow a phone's notice. */}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-auto min-h-7 whitespace-normal text-left"
                onClick={() => draft.discard(draft.conflicts)}
              >
                {t.conflictLoad}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-auto min-h-7 whitespace-normal text-left"
                onClick={() => draft.keepMine()}
              >
                {t.conflictKeep}
              </Button>
            </div>
          </Notice>
        ) : null}
      </div>

      {!hasBody ? (
        article.status === "failed" ? null : (
          <EmptyState icon={FileText} title={t.notWrittenYet} className="bg-card" />
        )
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem] xl:grid-rows-[auto_1fr] xl:items-start">
          <ArticlePublishing
            className="xl:col-start-2 xl:row-start-1"
            websiteId={websiteId}
            plan={plan}
            facts={facts}
            working={working}
            canEdit={canEdit}
            pressing={pressing}
            awaiting={awaiting}
            pressExpired={pressExpired}
            pressTime={pressTime}
            pressError={pressError}
            pluginNotice={pluginNotice}
            checking={checking}
            onPublish={handlePublish}
            onCheckAgain={() => startCheck(() => router.refresh())}
            t={t}
            tCommon={tCommon}
          />

          <div className="min-w-0 xl:col-start-1 xl:row-span-2 xl:row-start-1">
            {canEdit ? (
              <Tabs value={tab} onValueChange={changeTab} className="gap-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <TabsList aria-label={t.viewModeLabel}>
                    <TabsTrigger value="preview" className="px-3">
                      <Eye aria-hidden="true" />
                      {tCommon.preview}
                    </TabsTrigger>
                    <TabsTrigger value="edit" className="px-3">
                      <Pencil aria-hidden="true" />
                      {tCommon.edit}
                      {dirty ? (
                        <>
                          <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
                          <span className="sr-only">({t.unsavedMark})</span>
                        </>
                      ) : null}
                    </TabsTrigger>
                  </TabsList>
                  {dirty ? (
                    <p className="text-xs font-medium text-foreground">{plural(tWorkspace.unsaved, unsavedCount)}</p>
                  ) : null}
                </div>

                <TabsContent value="preview">{preview}</TabsContent>

                <TabsContent
                  value="edit"
                  forceMount={editMounted ? true : undefined}
                  className="data-[state=inactive]:hidden"
                >
                  {/* No overflow clipping here: the editor's toolbar is sticky. */}
                  <div className="min-w-0 rounded-xl border bg-card">
                    <div className="mx-auto max-w-3xl space-y-5 px-5 py-6 sm:px-8">
                      <p className="text-xs leading-5 text-muted-foreground">{t.editSaveNote}</p>
                      {/* Why the fields are off right now (a rewrite has its own notice at the top). */}
                      {delivering && !working ? (
                        <Notice tone="info" role="status">
                          {t.imageLockedDelivering}
                        </Notice>
                      ) : null}
                      <ArticleFields
                        values={values}
                        onChange={draft.setField}
                        disabled={!editable}
                        wordPressLive={wordPressPost}
                        t={t}
                        tWorkspace={tWorkspace}
                      />
                      <div className="space-y-1.5">
                        <p className="text-sm font-medium text-foreground">{t.articleContent}</p>
                        {partnerInText ? <PartnerLegend text={t.partnerLinksNote} /> : null}
                        <div className={PARTNER_LINK_SCOPE}>
                          <RichTextEditor
                            variant="workspace"
                            value={values.bodyHtml}
                            onChange={(html) => draft.setField("bodyHtml", html)}
                            ariaLabel={t.articleContent}
                            onUploadImage={handleInlineUpload}
                            onListImages={handleListImages}
                            editable={editable}
                            t={tEditorUi}
                            tCommon={tCommon}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            ) : (
              preview
            )}
          </div>

          <div className="grid min-w-0 items-start gap-4 lg:max-xl:grid-cols-2 xl:col-start-2 xl:row-start-2">
            <SearchAppearance
              title={values.title}
              slug={values.slug}
              metaDescription={values.metaDescription}
              websiteDomain={websiteDomain}
              // Only these three fields show here; an unsaved body alone does not change it.
              unsaved={canEdit && draft.dirty.some((key) => key !== "bodyHtml")}
              t={t}
            />

            <FeaturedImage
              websiteId={websiteId}
              articleId={article.id}
              imageUrl={article.imageUrl}
              imageAlt={article.imageAlt}
              attempts={article.imageAttempts}
              maxAttempts={imageMaxAttempts}
              maxBytes={imageMaxBytes}
              canEdit={canEdit}
              lockedReason={working ? t.imageLockedWorking : delivering ? t.imageLockedDelivering : null}
              reviewApproved={facts.review === "approved"}
              locale={locale}
              onAltUnsavedChange={setAltUnsaved}
              t={t}
              tImage={tImage}
              tCommon={tCommon}
              tWorkspace={tWorkspace}
            />

            <WorkspaceSection
              id="article-stats"
              icon={BarChart3}
              title={t.statsTitle}
              description={canEdit && dirty ? t.statsUnsaved : t.statsHelp}
            >
              <div className="grid grid-cols-2 gap-x-4 gap-y-5">
                <Stat label={t.words} value={number(stats.words)} />
                <Stat label={t.headings} value={number(stats.headings)} />
                <Stat
                  label={t.keywordUses}
                  value={number(stats.keywordUses)}
                  hint={article.targetKeyword ?? undefined}
                />
                <Stat label={t.internalLinks} value={number(stats.internalLinks)} />
                <Stat label={t.externalLinks} value={number(stats.externalLinks)} />
                <Stat label={tCommon.images} value={number(stats.images)} />
                <Stat label={t.socialMentions} value={number(stats.socialMentions)} />
              </div>
            </WorkspaceSection>

            <PublishHistory rows={history} limit={historyLimit} t={t} />

            {canEdit ? (
              <WorkspaceSection
                id="article-rewrite"
                icon={RefreshCw}
                title={t.rewriteTitle}
                description={format(t.rewriteHelp, { count: rewriteLimit })}
                bodyClassName="space-y-3"
              >
                <ConfirmDialog
                  trigger={
                    <Button type="button" variant="outline" disabled={rewriteReason !== null || rewriting}>
                      {rewriting ? (
                        <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
                      ) : (
                        <RefreshCw aria-hidden="true" />
                      )}
                      {tCommon.rewrite}
                    </Button>
                  }
                  disabled={rewriteReason !== null || rewriting}
                  title={t.rewriteConfirmTitle}
                  confirmLabel={t.rewriteConfirmAction}
                  cancelLabel={tCommon.cancel}
                  onConfirm={handleRewrite}
                >
                  {rewriteConfirmBody()}
                </ConfirmDialog>
                {rewriteReason ? <p className="text-xs leading-5 text-muted-foreground">{rewriteReason}</p> : null}
                {rewriteStarted ? (
                  <p role="status" className="text-xs text-foreground">
                    {t.rewriting}
                  </p>
                ) : null}
                {rewriteError && article.status !== "failed" ? (
                  <Notice tone="danger" role="alert">
                    {rewriteError}
                  </Notice>
                ) : null}
              </WorkspaceSection>
            ) : null}
          </div>
        </div>
      )}

      {canEdit && hasBody ? (
        <>
          <SaveBarSpacer />
          <SaveBar
            state={saveBarState}
            onSave={handleSave}
            onDiscard={handleDiscard}
            saveLabel={t.saveArticle}
            note={saveNote}
            disabled={saveHeldNote !== null}
            t={tWorkspace}
          />
        </>
      ) : null}
    </div>
  );
}
