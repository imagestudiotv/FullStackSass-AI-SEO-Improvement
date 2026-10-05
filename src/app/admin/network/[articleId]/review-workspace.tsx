"use client";

import {
  CheckCircle2,
  CircleAlert,
  FileText,
  ImageOff,
  Info,
  Link2,
  Loader2,
  Pencil,
  RotateCcw,
  Save,
  SearchCheck,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";

import { PARTNER_LINK_SCOPE, PartnerLinkStyles } from "@/components/partner-link-styles";
import { RichTextEditor } from "@/components/rich-text-editor";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  approveForRelease,
  changePlacementCredits,
  checkTarget,
  placeLink,
  removePlacement,
  reopenForReview,
  saveReviewEdit,
} from "@/lib/admin/network";
import type { getReviewArticle } from "@/lib/admin/network";
import { ARTICLE_TABLE_CLASSES } from "@/lib/articles/table-styles";
import { sanitizeHtml } from "@/lib/articles/sanitize";
import { formatDate, formatNumber } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";

import { ExpandableText } from "../../_ui/expandable-text";
import { AdminFacts, AdminPage, AdminPageHeader, AdminSection } from "../../_ui/page";
import { AdminStatus, type StatusTone } from "../../_ui/status";
import { useReturnFocus } from "../../_ui/use-return-focus";
import { useUnsavedChanges } from "../../_ui/use-unsaved-changes";

type Review = NonNullable<Awaited<ReturnType<typeof getReviewArticle>>>;
type Placement = Review["placements"][number];
type Result<T> = { ok: true; data: T } | { ok: false; error: string };

/** The fields an administrator can edit in review - everything delivered except the image. */
type Draft = { title: string; slug: string; metaDescription: string; bodyHtml: string };

const RELEASE_TEXT: Record<string, string> = {
  queued: "Approved - queued for publishing now.",
  plugin: "Approved - the WordPress plugin was asked to collect it now.",
  waiting_for_day: "Approved - it will be released on its planned day.",
  customer_publishes: "Approved - the customer's mode is review, so they publish it.",
  nothing_connected: "Approved - it goes out once the website is connected.",
};

const PLACEMENT_STATUS: Record<string, { label: string; tone: StatusTone }> = {
  pending: { label: "Pending", tone: "pending" },
  drafted: { label: "Drafted", tone: "info" },
  published: { label: "Published", tone: "info" },
  live: { label: "Live", tone: "success" },
  unverified: { label: "Unverified", tone: "warning" },
  removed: { label: "Removed", tone: "neutral" },
};

const AUTHORITY_STATUS: Record<string, string> = {
  no_data: "No data for this domain",
  collecting: "Not collected yet",
  no_access: "Not available",
  error: "Could not be read",
  not_configured: "Not configured",
};

/** Search results show about this many characters of a meta description; the server keeps up to 300. */
const META_SHOWN = 158;

const n = (value: number) => formatNumber(value, "en");
const day = (value: Date | string) =>
  formatDate(value, "en", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const dayTime = (value: Date | string) =>
  `${formatDate(value, "en", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "UTC" })} UTC`;
const plural = (count: number, word: string) => `${n(count)} ${word}${count === 1 ? "" : "s"}`;

/** A refusal that only a fresh copy of the article can get past (a version or text conflict). */
const needsReload = (error: string) => /reload/i.test(error);

const FIELD_CLASS =
  "h-9 w-full min-w-0 rounded-md border border-input bg-background px-2.5 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none";

/**
 * One article's review: its text (everything approval covers), and beside it
 * an inspector with the approval, the network links, placing a link, and the
 * website's facts. On a narrow screen the inspector follows the article.
 *
 * Every change is sent with the review version this screen was opened at.
 * If another administrator changed the article meanwhile, the server
 * refuses and asks for a reload - nothing is silently overwritten, and the
 * error offers the reload rather than leaving every later action to fail.
 *
 * While the text is being edited, links, credits and approval wait: each of
 * them changes or approves the saved article, which the open edit would
 * then no longer match.
 */
export function ReviewWorkspace({ review }: { review: Review }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  /** Which action is running, so only its own button shows the spinner. */
  const [running, setRunning] = useState<string | null>(null);
  const { article, placements, candidates, limits } = review;
  const version = article.reviewVersion;

  const saved: Draft = {
    title: article.title,
    slug: article.slug ?? "",
    metaDescription: article.metaDescription ?? "",
    bodyHtml: article.bodyHtml ?? "",
  };
  const [draft, setDraft] = useState<Draft | null>(null);
  const editing = draft !== null;
  const edited = draft !== null && (Object.keys(saved) as (keyof Draft)[]).some((key) => draft[key] !== saved[key]);
  // Every action other than the edit itself.
  const busy = pending || editing;
  /** The last save's refusal, shown in the edit bar until the draft changes. */
  const [saveError, setSaveError] = useState<string | null>(null);
  /** What the last confirmed save said - shown only after the server answered. */
  const [notice, setNotice] = useState<string | null>(null);
  useUnsavedChanges(edited);

  const [beneficiaryId, setBeneficiaryId] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [targetTitle, setTargetTitle] = useState<string | null>(null);
  const [anchor, setAnchor] = useState("");
  const [credits, setCredits] = useState(String(limits.defaultCredits));
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [approveOpen, setApproveOpen] = useState(false);
  // The approve dialog opens from state, not a Trigger: return focus to the button that opened it.
  const approveFocus = useReturnFocus();

  const beneficiary = useMemo(() => candidates.find((c) => c.websiteId === beneficiaryId) ?? null, [candidates, beneficiaryId]);
  // Every link except withdrawn ones is listed, so a removed or unverified one stays visible...
  const shown = placements.filter((p) => p.status !== "cancelled");
  // ...but the count and the maximum use the statuses the server counts (lib/backlinks/managed.ts).
  const live = placements.filter((p) => ["pending", "drafted", "published", "live"].includes(p.status));
  // Addresses of the network links in the text, highlighted there (components/partner-link-styles.tsx).
  const partnerLinks = placements.filter((p) => p.status !== "cancelled" && p.status !== "removed").map((p) => p.targetUrl);
  // Committed links a later edit took out of the text: approval is refused until they are back or withdrawn.
  const outOfText = placements.filter((p) => p.status === "drafted" && !p.inText);
  // The same reasons the list greys a website out, so Place cannot send one the server will refuse.
  const unavailable = (c: Review["candidates"][number]) =>
    c.linkedHere || !c.relevant || c.reciprocal || c.meetsMinimum === false;
  const editable = article.status === "draft" && !article.publishedUrl && article.reviewStatus !== null;
  const changedSinceApproval = article.reviewStatus === "approved" && !article.approvedCurrent;
  const mode = !article.autoPublish ? "Review (customer publishes)" : article.publishAs === "draft" ? "CMS draft on the planned day" : "Live on the planned day";
  const planned = article.plannedFor ? day(article.plannedFor) : null;
  const status: { tone: StatusTone; label: string } = article.approvedCurrent
    ? { tone: "success", label: "Approved" }
    : article.reviewStatus === "approved"
      ? { tone: "warning", label: "Changed since approval" }
      : article.reviewStatus === "pending"
        ? { tone: "pending", label: "Waiting for review" }
        : { tone: "neutral", label: "Not in review" };

  /** After a conflict: a fresh copy. With an edit open, a full reload, so the browser asks before the edit is dropped. */
  function reload() {
    if (draft !== null) window.location.reload();
    else router.refresh();
  }

  function run<T>(
    name: string,
    action: () => Promise<Result<T>>,
    done: (data: T) => void,
    options: { refresh?: boolean; failed?: (error: string) => void } = {},
  ) {
    setRunning(name);
    setNotice(null);
    start(async () => {
      const result = await action();
      if (!result.ok) {
        options.failed?.(result.error);
        toast.error(result.error, needsReload(result.error) ? { action: { label: "Reload", onClick: reload } } : undefined);
        return;
      }
      done(result.data);
      if (options.refresh !== false) router.refresh();
    });
  }
  const isRunning = (name: string) => pending && running === name;

  function updateDraft(patch: Partial<Draft>) {
    setDraft((current) => (current ? { ...current, ...patch } : current));
    setSaveError(null);
  }

  function save() {
    if (!draft) return;
    run(
      "save",
      () =>
        saveReviewEdit({
          articleId: article.id,
          expectedVersion: version,
          expectedHash: article.contentHash,
          ...draft,
        }),
      (data) => {
        const message = !data.changed ? "Nothing changed" : article.approvedCurrent ? "Saved - it needs approving again" : "Saved";
        setDraft(null);
        setSaveError(null);
        toast.success(message);
        setNotice(message);
      },
      { failed: setSaveError },
    );
  }

  // Why "Place link" is not available yet - shown under the button rather than leaving it silently grey.
  const placeBlocker = editing
    ? "Save or cancel the text edit first."
    : live.length >= limits.maxPerArticle
      ? `This article already has the maximum of ${limits.maxPerArticle} network links.`
      : !beneficiary
        ? "Choose the website that receives the link."
        : unavailable(beneficiary)
          ? "That website cannot receive a link from this article."
          : !targetUrl
            ? "Enter the page to link to."
            : !anchor.trim()
              ? "Enter the anchor words - words already in the article."
              : null;
  const creditsShort = beneficiary !== null && Number(credits) > beneficiary.available;

  return (
    <AdminPage>
      <PartnerLinkStyles urls={partnerLinks} label="Partner link" />
      <AdminPageHeader
        back={{ href: "/admin/network", label: "Review queue" }}
        title={article.title}
        description={`${article.domain} · ${article.organizationName} · ${article.language ?? "language unknown"} · planned ${planned ?? "with no date"}`}
        meta={
          <>
            <AdminStatus tone={status.tone} label={status.label} />
            <span>Publishing mode: {mode}</span>
            <span className="tabular-nums">Version {version}</span>
            {article.approvedCurrent && article.reviewApprovedBy ? (
              <span className="min-w-0 wrap-anywhere">
                Approved by {article.reviewApprovedBy}
                {article.reviewApprovedAt ? ` on ${dayTime(article.reviewApprovedAt)}` : ""}
              </span>
            ) : null}
          </>
        }
        actions={
          <Button variant="outline" asChild>
            <Link href={`/admin/articles/${article.id}`}>
              <FileText className="size-4" aria-hidden="true" />
              Open in Articles
            </Link>
          </Button>
        }
      />

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px] 2xl:grid-cols-[minmax(0,1fr)_420px]">
        {/* The article: everything approval covers - title, slug, meta description, image and text. */}
        <AdminSection
          title="Article"
          description={
            editing
              ? "Network links are the linked words: keep them in the text, or use Withdraw to remove one. A link added here by hand is not a network link - it is not tracked or credited; use Place a link for that."
              : "What will be delivered. Network links are highlighted in the text; on the website they are ordinary links."
          }
          actions={
            editable && !editing ? (
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => {
                  setDraft(saved);
                  setSaveError(null);
                  setNotice(null);
                }}
              >
                <Pencil className="size-4" aria-hidden="true" />
                Edit
              </Button>
            ) : null
          }
          bodyClassName="p-0"
        >
          {draft ? (
            <>
              <div className="space-y-5 p-5">
                {article.approvedCurrent ? (
                  <Callout tone="warning">
                    This article is approved. Saving a change sends it back to review, and it must be approved again.
                  </Callout>
                ) : null}
                <div className="space-y-1.5">
                  <Label htmlFor="review-title">Title</Label>
                  <Input id="review-title" value={draft.title} onChange={(e) => updateDraft({ title: e.target.value })} disabled={pending} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="review-meta">Meta description</Label>
                  <Input
                    id="review-meta"
                    value={draft.metaDescription}
                    onChange={(e) => updateDraft({ metaDescription: e.target.value })}
                    aria-describedby="review-meta-help"
                    disabled={pending}
                  />
                  <p id="review-meta-help" className="text-xs text-muted-foreground">
                    <span className={cn("tabular-nums", draft.metaDescription.length > META_SHOWN && "font-medium text-warning")}>
                      {n(draft.metaDescription.length)} characters
                    </span>
                    {" "}- search results show about {META_SHOWN}; up to 300 are saved.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="review-slug">URL slug</Label>
                  <Input
                    id="review-slug"
                    value={draft.slug}
                    onChange={(e) => updateDraft({ slug: e.target.value })}
                    aria-describedby="review-slug-help"
                    className="font-mono text-[13px]"
                    disabled={pending}
                  />
                  <p id="review-slug-help" className="text-xs text-muted-foreground">
                    Tidied on save (lower case, words joined by hyphens). Leave it empty and the website makes one from the title.
                  </p>
                </div>
                <div className="space-y-1.5">
                  {/* A plain label: the editor is a contenteditable div, which htmlFor cannot focus. */}
                  <p className="text-sm font-medium">Text</p>
                  {/* The editor's toolbar sticks below the app's 56px header; the admin top bar is 64px. */}
                  <div className={cn(PARTNER_LINK_SCOPE, "[&_.sticky.top-14]:top-16")}>
                    <RichTextEditor value={draft.bodyHtml} onChange={(bodyHtml) => updateDraft({ bodyHtml })} />
                  </div>
                  <p className="text-xs text-muted-foreground">The featured image is not edited here.</p>
                </div>
              </div>

              {/* The edit's own bar: stays in reach while a long text scrolls. */}
              <div className="sticky bottom-0 z-20 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-b-xl border-t bg-card px-5 py-3">
                <Button type="button" variant="outline" disabled={pending || !edited} onClick={save}>
                  {isRunning("save") ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />}
                  Save changes
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => {
                    if (edited && !window.confirm("Discard your changes to this article?")) return;
                    setDraft(null);
                    setSaveError(null);
                  }}
                >
                  Cancel
                </Button>
                <EditState saving={isRunning("save")} edited={edited} error={saveError} />
                <p className="w-full text-xs text-muted-foreground lg:ml-auto lg:w-auto">Links, credits and approval wait until you save or cancel.</p>
              </div>
            </>
          ) : (
            <div className="space-y-5 p-5">
              {notice ? (
                <p role="status" className="flex items-center gap-2 rounded-lg border border-success/20 bg-success-soft px-3 py-2 text-sm text-success">
                  <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
                  {notice}
                </p>
              ) : null}
              <AdminFacts
                items={[
                  {
                    label: "URL slug",
                    value: article.slug ? (
                      <span className="font-mono text-[13px]">{article.slug}</span>
                    ) : (
                      <span className="text-muted-foreground">None - the website makes one from the title</span>
                    ),
                  },
                  {
                    label: "Meta description",
                    value: article.metaDescription ? (
                      <>
                        {article.metaDescription}{" "}
                        <span className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">({n(article.metaDescription.length)} characters)</span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">None</span>
                    ),
                  },
                  { label: "Featured image", value: <FeaturedImage url={article.imageUrl} alt={article.imageAlt} /> },
                ]}
              />
              <div className="border-t pt-5">
                {/* Sanitised on every save (lib/articles/sanitize.ts). */}
                <div
                  className={`${PARTNER_LINK_SCOPE} ${ARTICLE_TABLE_CLASSES} prose prose-sm max-w-[72ch] dark:prose-invert wrap-anywhere [&_a]:text-primary [&_a]:underline [&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mt-4 [&_h3]:font-semibold [&_li]:my-1 [&_p]:my-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-lg`}
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(article.bodyHtml ?? "") }}
                />
              </div>
            </div>
          )}
        </AdminSection>

        <aside aria-label="Review details and actions" className="min-w-0 space-y-6">
          {/* Approval: the consequential decision, kept apart from routine edits. */}
          <AdminSection
            title="Approval"
            description="Approving releases this exact version. Any later change - text, image or links - holds it again."
          >
            <div className="space-y-4">
              {article.approvedCurrent ? (
                <>
                  <Callout tone="success" icon={CheckCircle2}>
                    Approved
                    {article.reviewApprovedBy ? ` by ${article.reviewApprovedBy}` : ""}
                    {article.reviewApprovedAt ? ` on ${dayTime(article.reviewApprovedAt)}` : ""}. Delivery follows the publishing
                    mode ({mode}).
                  </Callout>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      run(
                        "reopen",
                        () => reopenForReview({ articleId: article.id, expectedVersion: version }),
                        () => toast.success("Sent back for review"),
                      )
                    }
                  >
                    {isRunning("reopen") ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <RotateCcw className="size-4" aria-hidden="true" />}
                    Reopen for review
                  </Button>
                </>
              ) : changedSinceApproval && editable ? (
                <>
                  {/* Approve would be refused ("Already approved"): the way on is back to review first. */}
                  <Callout tone="warning">
                    This article changed after it was approved, so it is held. Send it back for review, then approve the
                    current version.
                  </Callout>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      run(
                        "reopen",
                        () => reopenForReview({ articleId: article.id, expectedVersion: version }),
                        () => toast.success("Sent back for review"),
                      )
                    }
                  >
                    {isRunning("reopen") ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <RotateCcw className="size-4" aria-hidden="true" />}
                    Reopen for review
                  </Button>
                </>
              ) : editable ? (
                <>
                  <ul className="space-y-2 text-sm">
                    <CheckItem state="ok">
                      {live.length === 0
                        ? "No network links in this article. That is fine - approving releases it as it is."
                        : `${plural(live.length, "network link")} go${live.length === 1 ? "es" : ""} out with it.`}
                    </CheckItem>
                    {outOfText.length > 0 ? (
                      <CheckItem state="blocked">
                        {plural(outOfText.length, "placed link")} no longer in the text - approval is refused until{" "}
                        {outOfText.length === 1 ? "it is" : "they are"} put back or withdrawn.
                      </CheckItem>
                    ) : null}
                    <CheckItem state="info">
                      Then: {mode}, {planned ? `planned ${planned}` : "no planned date"}.
                    </CheckItem>
                  </ul>
                  <div className="space-y-2">
                    <Button type="button" className="w-full sm:w-auto" disabled={busy} onClick={() => setApproveOpen(true)}>
                      <ShieldCheck className="size-4" aria-hidden="true" />
                      {live.length === 0 ? "Approve without network links" : "Approve and release"}
                    </Button>
                    {editing ? <p className="text-xs text-muted-foreground">Save or cancel the text edit first.</p> : null}
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">This article is not waiting for review.</p>
              )}
            </div>
          </AdminSection>

          {/* Network links in this article */}
          <AdminSection
            title={`Network links (${live.length}/${limits.maxPerArticle})`}
            description={`Credits are reserved now, charged only once the link is seen live on the published page. ${article.domain} has hosted ${plural(review.hostUsage.today, "network link")} today and ${n(review.hostUsage.thisMonth)} this month (no limit applies).`}
            bodyClassName="p-0"
          >
            {article.approvedCurrent && editable ? (
              <Callout tone="info" className="m-4 mb-0">
                Approved: placing a link, changing its credits or withdrawing one sends the article back to review.
              </Callout>
            ) : null}
            {shown.length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted-foreground">No network links in this article.</p>
            ) : (
              <ul className="divide-y">
                {shown.map((placement) => (
                  <PlacementRow
                    // Keyed by the credits too: after a change the field starts from the saved value.
                    key={`${placement.id}:${placement.credits}`}
                    placement={placement}
                    hostOrg={article.organizationName}
                    maxCredits={limits.maxCredits}
                    disabled={busy || !editable}
                    approved={article.approvedCurrent}
                    savingCredits={isRunning(`credits:${placement.id}`)}
                    withdrawing={isRunning(`withdraw:${placement.id}`)}
                    onCredits={(value, why) =>
                      run(
                        `credits:${placement.id}`,
                        () => changePlacementCredits({ articleId: article.id, placementId: placement.id, expectedVersion: version, credits: value, reason: why }),
                        () => toast.success("Credits updated"),
                      )
                    }
                    onRemove={(why, after) =>
                      run(
                        `withdraw:${placement.id}`,
                        () => removePlacement({ articleId: article.id, placementId: placement.id, expectedVersion: version, reason: why }),
                        () => {
                          toast.success("Link withdrawn and credits released");
                          after();
                        },
                        // Closed on a refusal too: a conflict needs a fresh look, not a second click.
                        { failed: after },
                      )
                    }
                  />
                ))}
              </ul>
            )}
          </AdminSection>

          {editable ? (
            <AdminSection
              title="Place a link"
              description="Choose a participating website, one of its verified pages, and words already in the article."
            >
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="beneficiary">Website that receives the link</Label>
                  <select
                    id="beneficiary"
                    className={FIELD_CLASS}
                    value={beneficiaryId}
                    onChange={(e) => {
                      setBeneficiaryId(e.target.value);
                      setTargetUrl("");
                      setTargetTitle(null);
                    }}
                  >
                    <option value="">Choose…</option>
                    {candidates.map((c) => (
                      <option key={c.websiteId} value={c.websiteId} disabled={unavailable(c)}>
                        {c.domain} · {c.available} available
                        {c.linkedHere ? " · already linked in this article" : ""}
                        {!c.relevant ? " · not related" : ""}
                        {c.reciprocal ? " · already links back" : ""}
                        {c.minSourceRank !== null ? ` · wants Domain Authority ≥ ${c.minSourceRank}${c.meetsMinimum === false ? " (not met)" : ""}` : ""}
                      </option>
                    ))}
                  </select>
                  {beneficiary ? (
                    <p className="text-xs text-muted-foreground wrap-anywhere">
                      {beneficiary.organizationName} · {beneficiary.industry ?? "no topic"} · {beneficiary.language ?? "no language"} ·{" "}
                      {beneficiary.available} credits available ({beneficiary.reserved} reserved) - shared by the whole workspace
                      {beneficiary.minSourceRank !== null
                        ? ` · accepts only sources with Domain Authority ≥ ${beneficiary.minSourceRank}; this website is at ${
                            review.hostAuthority?.status === "ok" ? review.hostAuthority.value : "an unknown rank"
                          }`
                        : ""}
                    </p>
                  ) : null}
                </div>

                {beneficiary && beneficiary.targets.length > 0 ? (
                  <div className="space-y-1.5">
                    <p className="text-sm font-medium">Their target pages, in priority order</p>
                    <ul className="space-y-1">
                      {beneficiary.targets.map((t) => {
                        const chosen = t.url === targetUrl;
                        return (
                          <li key={t.url}>
                            <button
                              type="button"
                              aria-pressed={chosen}
                              className={cn(
                                "flex w-full items-start gap-2 rounded-md border px-2.5 py-1.5 text-left text-xs outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none",
                                chosen && "border-primary/50 bg-primary/5",
                              )}
                              onClick={() => {
                                setTargetUrl(t.url);
                                setTargetTitle(null);
                              }}
                            >
                              <span className="min-w-0 flex-1">
                                <span className="block font-mono wrap-anywhere">{t.url}</span>
                                <span className="block text-muted-foreground">
                                  {t.priority}
                                  {t.note ? ` · ${t.note}` : ""}
                                </span>
                              </span>
                              {chosen ? <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-success" aria-hidden="true" /> : null}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : null}

                <div className="space-y-1.5">
                  <Label htmlFor="target">Page to link to</Label>
                  <div className="flex gap-2">
                    <Input
                      id="target"
                      value={targetUrl}
                      onChange={(e) => {
                        setTargetUrl(e.target.value);
                        setTargetTitle(null);
                      }}
                      placeholder="https://…"
                      disabled={!beneficiary}
                      className="min-w-0 font-mono text-[13px]"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!beneficiary || !targetUrl || busy}
                      onClick={() =>
                        run(
                          "check",
                          () => checkTarget(beneficiaryId, targetUrl),
                          (data) => {
                            setTargetUrl(data.url);
                            setTargetTitle(data.title ?? "");
                            toast.success("Page confirmed");
                          },
                          // Nothing on the server changed: no need to reload the review.
                          { refresh: false },
                        )
                      }
                    >
                      {isRunning("check") ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <SearchCheck className="size-4" aria-hidden="true" />}
                      Check
                    </Button>
                  </div>
                  {targetTitle !== null ? (
                    <p className="flex items-start gap-1.5 text-xs text-success">
                      <CheckCircle2 className="mt-px size-3.5 shrink-0" aria-hidden="true" />
                      <span className="min-w-0 wrap-anywhere">Confirmed: {targetTitle || "(no title)"}</span>
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Optional - the page is checked again when the link is placed.</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="anchor">Anchor words (already in the article)</Label>
                  <Input id="anchor" value={anchor} onChange={(e) => setAnchor(e.target.value)} placeholder="e.g. wedding videography" />
                </div>

                <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="credits">Credits</Label>
                    <Input
                      id="credits"
                      type="number"
                      min={1}
                      max={limits.maxCredits}
                      step={1}
                      value={credits}
                      onChange={(e) => setCredits(e.target.value)}
                      className="tabular-nums"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="reason">Why this link</Label>
                    <Input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Relevant because…" />
                  </div>
                </div>
                {beneficiary ? (
                  <p className="text-xs text-muted-foreground wrap-anywhere">
                    {beneficiary.organizationName} spends {credits || "?"}; {article.organizationName} earns {credits || "?"} -
                    only once the link is verified live.
                  </p>
                ) : null}
                {creditsShort ? (
                  <p className="flex items-start gap-1.5 text-xs text-warning">
                    <CircleAlert className="mt-px size-3.5 shrink-0" aria-hidden="true" />
                    Only {beneficiary?.available ?? 0} available in that workspace - the server refuses a link it cannot cover.
                  </p>
                ) : null}

                <div className="space-y-2 border-t pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={pending || placeBlocker !== null}
                    aria-describedby={placeBlocker ? "place-blocker" : undefined}
                    onClick={() =>
                      run(
                        "place",
                        () =>
                          placeLink({
                            articleId: article.id,
                            expectedVersion: version,
                            beneficiaryWebsiteId: beneficiaryId,
                            targetUrl,
                            anchor,
                            credits: Number(credits),
                            reason,
                          }),
                        () => {
                          toast.success("Link placed and credits reserved");
                          // That website is now linked here; the next link is for another one.
                          setBeneficiaryId("");
                          setAnchor("");
                          setReason("");
                          setTargetUrl("");
                          setTargetTitle(null);
                          setCredits(String(limits.defaultCredits));
                        },
                      )
                    }
                  >
                    {isRunning("place") ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Link2 className="size-4" aria-hidden="true" />}
                    Place link
                  </Button>
                  {placeBlocker ? (
                    <p id="place-blocker" className="text-xs text-muted-foreground">
                      {placeBlocker}
                    </p>
                  ) : null}
                </div>
              </div>
            </AdminSection>
          ) : null}

          {/* The host website's facts */}
          <AdminSection title="Website">
            <AdminFacts
              items={[
                {
                  label: "Website",
                  value: (
                    <Link
                      href={`/admin/websites?q=${encodeURIComponent(article.domain)}`}
                      className="rounded-sm font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {article.domain}
                    </Link>
                  ),
                },
                { label: "Workspace", value: article.organizationName },
                { label: "Topic", value: article.industry ?? <span className="text-muted-foreground">No topic yet</span> },
                { label: "Language", value: article.language ?? <span className="text-muted-foreground">Unknown</span> },
                {
                  label: "Domain Authority",
                  value:
                    review.hostAuthority?.status === "ok" && review.hostAuthority.value !== null ? (
                      <span className="tabular-nums">
                        {review.hostAuthority.value}
                        {review.hostAuthority.stale ? <span className="text-muted-foreground"> (not recent)</span> : null}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">
                        {review.hostAuthority ? (AUTHORITY_STATUS[review.hostAuthority.status] ?? "Unknown") : "Unknown"}
                      </span>
                    ),
                },
                { label: "Planned", value: planned ?? <span className="text-muted-foreground">No date</span> },
              ]}
            />
          </AdminSection>
        </aside>
      </div>

      {/* Approving is consequential - it releases the article - so it is confirmed, with what happens next. */}
      <Dialog
        open={approveOpen}
        onOpenChange={(next) => {
          if (!next && !pending) setApproveOpen(false);
        }}
      >
        <DialogContent className="sm:max-w-lg" {...approveFocus}>
          <DialogHeader>
            <DialogTitle>{live.length === 0 ? "Approve without network links?" : "Approve and release this version?"}</DialogTitle>
            <DialogDescription>
              Version {version} is released as it is now. Delivery then follows the website&apos;s publishing mode and planned
              day. Any later change - text, image or links - holds it again.
            </DialogDescription>
          </DialogHeader>
          <AdminFacts
            className="rounded-lg border bg-muted/30 p-3 text-[13px]"
            items={[
              { label: "Publishing mode", value: mode },
              { label: "Planned", value: planned ?? "No date" },
              { label: "Network links", value: live.length === 0 ? "None" : n(live.length) },
            ]}
          />
          {outOfText.length > 0 ? (
            <Callout tone="danger">
              A placed link is missing from the text, so approval will be refused. Put it back with Edit, or withdraw it.
            </Callout>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="approve-note">Note (optional)</Label>
            <Input id="approve-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Kept with the approval in the admin log" autoComplete="off" disabled={pending} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={pending} onClick={() => setApproveOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={busy}
              onClick={() =>
                run(
                  "approve",
                  () => approveForRelease({ articleId: article.id, expectedVersion: version, expectedHash: article.contentHash, note }),
                  (data) => {
                    toast.success(RELEASE_TEXT[data.release] ?? "Approved");
                    setApproveOpen(false);
                    setNote("");
                  },
                  // Closed on a refusal: after a conflict the article must be read again before approving.
                  { failed: () => setApproveOpen(false) },
                )
              }
            >
              {isRunning("approve") ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <ShieldCheck className="size-4" aria-hidden="true" />}
              {live.length === 0 ? "Approve without network links" : "Approve and release"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminPage>
  );
}

/** The edit bar's state: nothing changed, unsaved, saving, or the save's refusal. Never "saved" before the server says so. */
function EditState({ saving, edited, error }: { saving: boolean; edited: boolean; error: string | null }) {
  if (saving) {
    return (
      <span role="status" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
        Saving…
      </span>
    );
  }
  if (error) {
    return (
      <span role="alert" className="inline-flex min-w-0 items-start gap-1.5 text-sm text-danger">
        <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        <span className="min-w-0 wrap-anywhere">Not saved: {error}</span>
      </span>
    );
  }
  if (edited) {
    return (
      <span role="status" className="inline-flex items-center gap-1.5 text-sm text-foreground">
        <span className="size-2 rounded-full bg-warning" aria-hidden="true" />
        Unsaved changes
      </span>
    );
  }
  return (
    <span role="status" className="text-sm text-muted-foreground">
      No changes yet
    </span>
  );
}

function Callout({
  tone,
  icon,
  className,
  children,
}: {
  tone: "warning" | "info" | "success" | "danger";
  icon?: typeof Info;
  className?: string;
  children: ReactNode;
}) {
  const Icon = icon ?? (tone === "info" ? Info : tone === "success" ? CheckCircle2 : CircleAlert);
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-lg border px-3 py-2 text-sm",
        tone === "warning" && "border-warning/30 bg-warning-soft",
        tone === "info" && "border-info/25 bg-info-soft",
        tone === "success" && "border-success/20 bg-success-soft",
        tone === "danger" && "border-danger/20 bg-danger-soft text-danger",
        className,
      )}
    >
      <Icon
        className={cn(
          "mt-0.5 size-4 shrink-0",
          tone === "warning" && "text-warning",
          tone === "info" && "text-info",
          tone === "success" && "text-success",
          tone === "danger" && "text-danger",
        )}
        aria-hidden="true"
      />
      <div className="min-w-0 wrap-anywhere">{children}</div>
    </div>
  );
}

/** One line of the pre-approval summary: met, blocking, or simply what happens next. */
function CheckItem({ state, children }: { state: "ok" | "blocked" | "info"; children: ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      {state === "ok" ? (
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
      ) : state === "blocked" ? (
        <CircleAlert className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
      ) : (
        <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      )}
      <span className={cn("min-w-0", state === "blocked" && "text-danger")}>{children}</span>
    </li>
  );
}

function FeaturedImage({ url, alt }: { url: string | null; alt: string | null }) {
  if (!url) {
    return (
      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
        <ImageOff className="size-4" aria-hidden="true" />
        No image
      </span>
    );
  }
  return (
    <figure className="space-y-1.5">
      {/*
        A plain <img>: the file may live on the customer's own site, so
        next/image would need every customer domain in remotePatterns.
      */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={alt ?? ""} className="max-h-48 w-auto max-w-full rounded-md border object-cover" />
      <figcaption className="text-xs text-muted-foreground">
        {alt ? <>Alt text: {alt}</> : "No alt text"}
      </figcaption>
    </figure>
  );
}

function PlacementRow({
  placement,
  hostOrg,
  maxCredits,
  disabled,
  approved,
  savingCredits,
  withdrawing,
  onCredits,
  onRemove,
}: {
  placement: Placement;
  hostOrg: string;
  /** MAX_PLACEMENT_CREDITS, from the server - the same bound the server enforces. */
  maxCredits: number;
  disabled: boolean;
  /** The article is approved: a change here sends it back to review. */
  approved: boolean;
  savingCredits: boolean;
  withdrawing: boolean;
  onCredits: (credits: number, reason: string) => void;
  onRemove: (reason: string, after: () => void) => void;
}) {
  const [value, setValue] = useState(String(placement.credits));
  const [confirming, setConfirming] = useState(false);
  const withdrawFocus = useReturnFocus();
  const draft = placement.status === "drafted";
  const status = PLACEMENT_STATUS[placement.status] ?? { label: placement.status, tone: "neutral" as const };
  const creditWord = `credit${placement.credits === 1 ? "" : "s"}`;
  return (
    <li className="space-y-2 px-5 py-4 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium">{placement.beneficiaryDomain}</p>
          <ExpandableText text={placement.targetUrl} mono threshold={40} className="text-xs text-muted-foreground" />
        </div>
        <AdminStatus tone={status.tone} label={status.label} />
      </div>
      <p className="wrap-anywhere">
        <span className="text-muted-foreground">Anchor:</span> “{placement.anchor}”
      </p>
      {placement.reason ? <p className="text-xs text-muted-foreground wrap-anywhere">Why: {placement.reason}</p> : null}
      {draft && !placement.inText ? (
        <Callout tone="danger" className="text-xs">
          This link is no longer in the text. Put it back with Edit, or withdraw it - approval is refused until then.
        </Callout>
      ) : null}
      <p className="text-xs text-muted-foreground wrap-anywhere">
        The receiving workspace spends {placement.credits}; {hostOrg} earns {placement.credits} - once verified live.
        {placement.createdBy ? ` Placed by ${placement.createdBy}.` : ""}
      </p>
      {draft ? (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Input
            aria-label="Credits for this link"
            className="h-8 w-20 tabular-nums"
            type="number"
            min={1}
            max={maxCredits}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={disabled}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || Number(value) === placement.credits}
            onClick={() => onCredits(Number(value), "Adjusted in review")}
          >
            {savingCredits ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : null}
            Save credits
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-auto text-danger hover:bg-danger-soft hover:text-danger"
            disabled={disabled}
            onClick={() => setConfirming(true)}
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
            Withdraw…
          </Button>
        </div>
      ) : null}

      <Dialog
        open={confirming}
        onOpenChange={(next) => {
          if (!next && !withdrawing) setConfirming(false);
        }}
      >
        <DialogContent className="sm:max-w-md" {...withdrawFocus}>
          <DialogHeader>
            <DialogTitle>Withdraw the link to {placement.beneficiaryDomain}?</DialogTitle>
            <DialogDescription>
              The link is taken out of the article - its words stay as plain text - and the {placement.credits} reserved{" "}
              {creditWord} {placement.credits === 1 ? "is" : "are"} released.
              {approved ? " The article goes back to review." : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={withdrawing} onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" disabled={disabled} onClick={() => onRemove("Withdrawn in review", () => setConfirming(false))}>
              {withdrawing ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Trash2 className="size-4" aria-hidden="true" />}
              Withdraw link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </li>
  );
}
