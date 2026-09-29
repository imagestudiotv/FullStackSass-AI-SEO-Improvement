"use client";

import { CheckCircle2, Link2, Loader2, Pencil, RotateCcw, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { RichTextEditor } from "@/components/rich-text-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader, PageShell } from "@/components/ui/page-header";
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

type Review = NonNullable<Awaited<ReturnType<typeof getReviewArticle>>>;

/** The fields an administrator can edit in review - everything delivered except the image. */
type Draft = { title: string; slug: string; metaDescription: string; bodyHtml: string };

const RELEASE_TEXT: Record<string, string> = {
  queued: "Approved - queued for publishing now.",
  plugin: "Approved - the WordPress plugin was asked to collect it now.",
  waiting_for_day: "Approved - it will be released on its planned day.",
  customer_publishes: "Approved - the customer's mode is review, so they publish it.",
  nothing_connected: "Approved - it goes out once the website is connected.",
};

/**
 * One article's review: its text, its network links, and the approval.
 *
 * Every change is sent with the review version this screen was opened at.
 * If another administrator changed the article meanwhile, the server
 * refuses and asks for a reload - nothing is silently overwritten.
 *
 * While the text is being edited, links, credits and approval wait: each of
 * them changes or approves the saved article, which the open edit would
 * then no longer match.
 */
export function ReviewWorkspace({ review }: { review: Review }) {
  const router = useRouter();
  const [pending, start] = useTransition();
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

  const [beneficiaryId, setBeneficiaryId] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [targetTitle, setTargetTitle] = useState<string | null>(null);
  const [anchor, setAnchor] = useState("");
  const [credits, setCredits] = useState(String(limits.defaultCredits));
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");

  const beneficiary = useMemo(() => candidates.find((c) => c.websiteId === beneficiaryId) ?? null, [candidates, beneficiaryId]);
  // Every link except withdrawn ones is listed, so a removed or unverified one stays visible...
  const shown = placements.filter((p) => p.status !== "cancelled");
  // ...but the count and the maximum use the statuses the server counts (lib/backlinks/managed.ts).
  const live = placements.filter((p) => ["pending", "drafted", "published", "live"].includes(p.status));
  // The same reasons the list greys a website out, so Place cannot send one the server will refuse.
  const unavailable = (c: Review["candidates"][number]) =>
    c.linkedHere || !c.relevant || c.reciprocal || c.meetsMinimum === false;
  const editable = article.status === "draft" && !article.publishedUrl && article.reviewStatus !== null;
  const mode = !article.autoPublish ? "Review (customer publishes)" : article.publishAs === "draft" ? "CMS draft on the planned day" : "Live on the planned day";

  function run<T>(action: () => Promise<{ ok: true; data: T } | { ok: false; error: string }>, done: (data: T) => void) {
    start(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      done(result.data);
      router.refresh();
    });
  }

  return (
    <PageShell width="wide">
      <PageHeader
        title={article.title}
        description={`${article.domain} · ${article.organizationName} · ${article.language ?? "language unknown"} · planned ${
          article.plannedFor ? new Date(article.plannedFor).toISOString().slice(0, 10) : "with no date"
        }`}
      />
      <p className="text-sm">
        <Link href="/admin/network" className="underline-offset-4 hover:underline">
          ← Review queue
        </Link>
      </p>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge variant={article.approvedCurrent ? "default" : "secondary"}>
          {article.approvedCurrent
            ? "Approved"
            : article.reviewStatus === "approved"
              ? "Changed since approval"
              : article.reviewStatus === "pending"
                ? "Waiting for review"
                : "Not in review"}
        </Badge>
        <span className="text-muted-foreground">Publishing mode: {mode}</span>
        <span className="text-muted-foreground">Version {version}</span>
        {article.approvedCurrent && article.reviewApprovedBy ? (
          <span className="text-muted-foreground">
            Approved by {article.reviewApprovedBy}
            {article.reviewApprovedAt ? ` on ${new Date(article.reviewApprovedAt).toISOString().slice(0, 16).replace("T", " ")} UTC` : ""}
          </span>
        ) : null}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        {/* overflow-visible while editing, so the editor's toolbar can stay in view as the text scrolls. */}
        <Card className={editing ? "min-w-0 overflow-visible" : "min-w-0"}>
          <CardHeader>
            <CardTitle>Article</CardTitle>
            <CardDescription>
              {editing
                ? "Network links are the linked words: keep them in the text, or use Withdraw to remove one. A link added here by hand is not a network link - it is not tracked or credited; use Place a link for that."
                : "What will be delivered. Network links appear as ordinary links in the text."}
            </CardDescription>
            {editable && !editing ? (
              <CardAction>
                <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => setDraft(saved)}>
                  <Pencil className="size-4" />
                  Edit
                </Button>
              </CardAction>
            ) : null}
          </CardHeader>
          <CardContent>
            {draft ? (
              <div className="space-y-4">
                {article.approvedCurrent ? (
                  <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
                    This article is approved. Saving a change sends it back to review, and it must be approved again.
                  </p>
                ) : null}
                <div className="space-y-1.5">
                  <Label htmlFor="review-title">Title</Label>
                  <Input id="review-title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="review-meta">
                    Meta description <span className="text-muted-foreground">({draft.metaDescription.length}/158)</span>
                  </Label>
                  <Input
                    id="review-meta"
                    value={draft.metaDescription}
                    onChange={(e) => setDraft({ ...draft, metaDescription: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="review-slug">URL slug</Label>
                  <Input id="review-slug" value={draft.slug} onChange={(e) => setDraft({ ...draft, slug: e.target.value })} />
                  <p className="text-xs text-muted-foreground">
                    Tidied on save (lower case, words joined by hyphens). Leave it empty and the website makes one from the title.
                  </p>
                </div>
                <div className="space-y-1.5">
                  {/* A plain label: the editor is a contenteditable div, which htmlFor cannot focus. */}
                  <p className="text-sm font-medium">Text</p>
                  <RichTextEditor value={draft.bodyHtml} onChange={(bodyHtml) => setDraft((d) => (d ? { ...d, bodyHtml } : d))} />
                </div>
              </div>
            ) : (
              /* Sanitised on every save (lib/articles/sanitize.ts). */
              <div
                className="prose prose-sm max-w-none dark:prose-invert [overflow-wrap:anywhere] [&_a]:text-primary [&_a]:underline [&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mt-4 [&_h3]:font-semibold [&_li]:my-1 [&_p]:my-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-lg"
                dangerouslySetInnerHTML={{ __html: article.bodyHtml ?? "" }}
              />
            )}
          </CardContent>
          {draft ? (
            <CardFooter className="flex-wrap gap-2">
              <Button
                type="button"
                disabled={pending || !edited}
                onClick={() =>
                  run(
                    () =>
                      saveReviewEdit({
                        articleId: article.id,
                        expectedVersion: version,
                        expectedHash: article.contentHash,
                        ...draft,
                      }),
                    (data) => {
                      setDraft(null);
                      toast.success(
                        !data.changed ? "Nothing changed" : article.approvedCurrent ? "Saved - it needs approving again" : "Saved",
                      );
                    },
                  )
                }
              >
                {pending ? <Loader2 className="size-4 animate-spin" /> : null}
                Save changes
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={() => {
                  if (edited && !window.confirm("Discard your changes to this article?")) return;
                  setDraft(null);
                }}
              >
                Cancel
              </Button>
              <p className="text-xs text-muted-foreground">Links, credits and approval wait until you save or cancel.</p>
            </CardFooter>
          ) : null}
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Network links ({live.length}/{limits.maxPerArticle})</CardTitle>
              <CardDescription>
                Credits are reserved now, charged only once the link is seen live on the published page. {article.domain} has
                hosted {review.hostUsage.today} network link{review.hostUsage.today === 1 ? "" : "s"} today and{" "}
                {review.hostUsage.thisMonth} this month (no limit applies).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {shown.length === 0 ? (
                <p className="text-sm text-muted-foreground">No network links in this article.</p>
              ) : null}
              {shown.map((placement) => (
                <PlacementRow
                  key={placement.id}
                  placement={placement}
                  hostOrg={article.organizationName}
                  maxCredits={limits.maxCredits}
                  disabled={busy || !editable}
                  onCredits={(value, why) =>
                    run(
                      () => changePlacementCredits({ articleId: article.id, placementId: placement.id, expectedVersion: version, credits: value, reason: why }),
                      () => toast.success("Credits updated"),
                    )
                  }
                  onRemove={(why) =>
                    run(
                      () => removePlacement({ articleId: article.id, placementId: placement.id, expectedVersion: version, reason: why }),
                      () => toast.success("Link withdrawn and credits released"),
                    )
                  }
                />
              ))}
            </CardContent>
          </Card>

          {editable ? (
            <Card>
              <CardHeader>
                <CardTitle>Place a link</CardTitle>
                <CardDescription>
                  Choose a participating website, one of its verified pages, and words already in the article.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="beneficiary">Website that receives the link</Label>
                  <select
                    id="beneficiary"
                    className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                    value={beneficiaryId}
                    onChange={(e) => {
                      setBeneficiaryId(e.target.value);
                      setTargetUrl("");
                      setTargetTitle(null);
                    }}
                  >
                    <option value="">Choose…</option>
                    {candidates.map((c) => (
                      <option
                        key={c.websiteId}
                        value={c.websiteId}
                        disabled={unavailable(c)}
                      >
                        {c.domain} · {c.available} available
                        {c.linkedHere ? " · already linked in this article" : ""}
                        {!c.relevant ? " · not related" : ""}
                        {c.reciprocal ? " · already links back" : ""}
                        {c.minSourceRank !== null ? ` · wants Domain Authority ≥ ${c.minSourceRank}${c.meetsMinimum === false ? " (not met)" : ""}` : ""}
                      </option>
                    ))}
                  </select>
                  {beneficiary ? (
                    <p className="text-xs text-muted-foreground">
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
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Their target pages, in priority order</p>
                    <ul className="space-y-1 text-xs">
                      {beneficiary.targets.map((t) => (
                        <li key={t.url}>
                          <button
                            type="button"
                            className="break-all text-left underline-offset-4 hover:underline"
                            onClick={() => {
                              setTargetUrl(t.url);
                              setTargetTitle(null);
                            }}
                          >
                            {t.url}
                          </button>{" "}
                          <span className="text-muted-foreground">({t.priority}{t.note ? ` · ${t.note}` : ""})</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <div className="space-y-1">
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
                    />
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!beneficiary || !targetUrl || busy}
                      onClick={() =>
                        run(
                          () => checkTarget(beneficiaryId, targetUrl),
                          (data) => {
                            setTargetUrl(data.url);
                            setTargetTitle(data.title ?? "");
                            toast.success("Page confirmed");
                          },
                        )
                      }
                    >
                      Check
                    </Button>
                  </div>
                  {targetTitle !== null ? (
                    <p className="text-xs text-muted-foreground">Confirmed: {targetTitle || "(no title)"}</p>
                  ) : null}
                </div>

                <div className="space-y-1">
                  <Label htmlFor="anchor">Anchor words (already in the article)</Label>
                  <Input id="anchor" value={anchor} onChange={(e) => setAnchor(e.target.value)} placeholder="e.g. wedding videography" />
                </div>

                <div className="grid grid-cols-[100px_minmax(0,1fr)] gap-2">
                  <div className="space-y-1">
                    <Label htmlFor="credits">Credits</Label>
                    <Input
                      id="credits"
                      type="number"
                      min={1}
                      max={limits.maxCredits}
                      step={1}
                      value={credits}
                      onChange={(e) => setCredits(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="reason">Why this link</Label>
                    <Input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Relevant because…" />
                  </div>
                </div>
                {beneficiary ? (
                  <p className="text-xs text-muted-foreground">
                    {beneficiary.organizationName} spends {credits || "?"}; {article.organizationName} earns {credits || "?"} -
                    only once the link is verified live.
                  </p>
                ) : null}

                <Button
                  type="button"
                  disabled={
                    busy ||
                    !beneficiary ||
                    unavailable(beneficiary) ||
                    !targetUrl ||
                    !anchor.trim() ||
                    live.length >= limits.maxPerArticle
                  }
                  onClick={() =>
                    run(
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
                      },
                    )
                  }
                >
                  {pending ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />}
                  Place link
                </Button>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Approval</CardTitle>
              <CardDescription>
                Approving releases this exact version. Any later change - text, image or links - holds it again.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {article.approvedCurrent ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    run(
                      () => reopenForReview({ articleId: article.id, expectedVersion: version }),
                      () => toast.success("Sent back for review"),
                    )
                  }
                >
                  <RotateCcw className="size-4" />
                  Reopen for review
                </Button>
              ) : editable ? (
                <>
                  {live.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No network links in this article. That is fine - approving releases it as it is.
                    </p>
                  ) : null}
                  <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" />
                  <Button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      run(
                        () => approveForRelease({ articleId: article.id, expectedVersion: version, expectedHash: article.contentHash, note }),
                        (data) => toast.success(RELEASE_TEXT[data.release] ?? "Approved"),
                      )
                    }
                  >
                    <CheckCircle2 className="size-4" />
                    {live.length === 0 ? "Approve without network links" : "Approve and release"}
                  </Button>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">This article is not waiting for review.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}

function PlacementRow({
  placement,
  hostOrg,
  maxCredits,
  disabled,
  onCredits,
  onRemove,
}: {
  placement: Review["placements"][number];
  hostOrg: string;
  /** MAX_PLACEMENT_CREDITS, from the server - the same bound the server enforces. */
  maxCredits: number;
  disabled: boolean;
  onCredits: (credits: number, reason: string) => void;
  onRemove: (reason: string) => void;
}) {
  const [value, setValue] = useState(String(placement.credits));
  const draft = placement.status === "drafted";
  return (
    <div className="space-y-2 rounded-lg border p-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium">{placement.beneficiaryDomain}</p>
          <p className="break-all text-xs text-muted-foreground">{placement.targetUrl}</p>
          <p className="text-xs">Anchor: “{placement.anchor}”</p>
          {placement.reason ? <p className="text-xs text-muted-foreground">Why: {placement.reason}</p> : null}
        </div>
        <Badge variant="secondary">{placement.status}</Badge>
      </div>
      {draft && !placement.inText ? (
        <p className="text-xs text-destructive">
          This link is no longer in the text. Put it back with Edit, or withdraw it - approval is refused until then.
        </p>
      ) : null}
      <p className="text-xs text-muted-foreground">
        The receiving workspace spends {placement.credits}; {hostOrg} earns {placement.credits} - once verified live.
        {placement.createdBy ? ` Placed by ${placement.createdBy}.` : ""}
      </p>
      {draft ? (
        <div className="flex flex-wrap items-end gap-2">
          <Input
            aria-label="Credits for this link"
            className="w-20"
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
            Save credits
          </Button>
          <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => onRemove("Withdrawn in review")}>
            <Trash2 className="size-4" />
            Withdraw
          </Button>
        </div>
      ) : null}
    </div>
  );
}
