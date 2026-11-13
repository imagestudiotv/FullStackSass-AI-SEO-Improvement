"use client";

import { AlertTriangle, ClipboardCheck, Eye, Loader2, Pencil, Save } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { PARTNER_LINK_SCOPE, PartnerLinkStyles } from "@/components/partner-link-styles";
import { RichTextEditor } from "@/components/rich-text-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  updateAnyArticle,
  type AdminArticleDetail,
} from "@/lib/admin/actions";
import { ARTICLE_TABLE_CLASSES } from "@/lib/articles/table-styles";
import { previewHtml, sameHtml, useDraftField } from "@/lib/articles/use-draft";
import { cn } from "@/lib/utils";

import { AdminSection } from "../../_ui/page";
import { AdminStatus } from "../../_ui/status";
import { useUnsavedChanges } from "../../_ui/use-unsaved-changes";

/** The server keeps the first 200 characters of a title; the field stops there instead of truncating silently. */
const TITLE_MAX = 200;

/**
 * The same descendant styles the rich text editor gives article HTML, so
 * Preview and Edit agree (@tailwindcss/typography is not installed; `prose`
 * is inert and kept only for when it is).
 */
const ARTICLE_BODY_CLASSES = `${PARTNER_LINK_SCOPE} prose prose-sm max-w-none dark:prose-invert text-[15px] leading-7 wrap-anywhere [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 ${ARTICLE_TABLE_CLASSES} [&_pre]:overflow-x-auto [&_iframe]:max-w-full [&_video]:max-w-full [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h3]:mt-6 [&_h3]:text-base [&_h3]:font-semibold [&_li]:my-1 [&_p]:my-3 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_blockquote]:my-4 [&_blockquote]:border-l-2 [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs [&_img]:my-6 [&_img]:block [&_img]:mx-auto [&_img]:max-w-[min(100%,36rem)] [&_img]:max-h-120 [&_img]:h-auto [&_img]:w-auto [&_img]:rounded-lg [&_img]:border [&_img]:object-contain`;

/** What the last save attempt came back with. "saved" is set only when the server said ok. */
type SaveOutcome = { kind: "none" } | { kind: "saved"; at: Date } | { kind: "failed"; error: string };

/** A thrown action (expired session, database error) - kept on the page instead of replacing it. */
const UNEXPECTED_ERROR =
  "The save did not go through: the server could not be reached, or your session has ended. Your changes are still here - try again, or copy them before reloading.";

const clock = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });

/**
 * Admin article review.
 *
 * The client asked to "manual reviewing all the articles in the system from
 * all websites, in this way I can make manual changes" — so this edits any
 * article regardless of who owns it.
 *
 * The working copy lives here, above the tabs, and the Edit tab stays mounted
 * while Preview is shown: switching tabs never discards a draft or the
 * editor's undo history.
 */
export function AdminArticleEditor({
  article,
  partnerLinks,
}: {
  article: AdminArticleDetail;
  /** Partner Network links in this article (their addresses), highlighted. */
  partnerLinks: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useDraftField(article.title);
  const [body, setBody] = useDraftField(article.bodyHtml ?? "", sameHtml);
  const [outcome, setOutcome] = useState<SaveOutcome>({ kind: "none" });

  /**
   * What the server confirmed on the last save, until the refreshed article
   * arrives. Without it the bar would read "Unsaved changes" for the moment
   * between the save returning and the page's props catching up.
   */
  const [confirmed, setConfirmed] = useState<{ title: string; body: string; basis: AdminArticleDetail } | null>(null);
  if (confirmed && confirmed.basis !== article) {
    // Newer props are the truth from here on.
    setConfirmed(null);
  }

  const differsFrom = (savedTitle: string, savedBody: string) =>
    title.trim() !== savedTitle || !sameHtml(body, savedBody);
  // Preview shows the working copy; this says when it is not saved yet.
  const unsaved =
    differsFrom(article.title, article.bodyHtml ?? "") &&
    !(confirmed !== null && !differsFrom(confirmed.title, confirmed.body));
  const partnerInText = partnerLinks.some((url) => body.includes(url) || body.includes(url.replace(/&/g, "&amp;")));
  // A finished generation writes the article again, over anything saved meanwhile.
  const generating = article.status === "queued" || article.status === "generating";

  useUnsavedChanges(unsaved);

  function handleSave() {
    const sent = { title, body };
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof updateAnyArticle>>;
      try {
        result = await updateAnyArticle(article.id, {
          title: sent.title,
          bodyHtml: sent.body,
        });
      } catch (error) {
        console.error("[admin/articles] save failed", error);
        setOutcome({ kind: "failed", error: UNEXPECTED_ERROR });
        toast.error("Not saved - your changes are still on the page");
        return;
      }
      if (!result.ok) {
        setOutcome({ kind: "failed", error: result.error });
        toast.error(result.error);
        return;
      }
      setConfirmed({ title: sent.title.trim(), body: sent.body, basis: article });
      setOutcome({ kind: "saved", at: new Date() });
      toast.success("Saved");
      router.refresh();
    });
  }

  return (
    <div className="min-w-0 space-y-4">
      <PartnerLinkStyles urls={partnerLinks} label="Partner link" />
      <Tabs defaultValue="preview" className="gap-4">
        <TabsList>
          <TabsTrigger value="preview" className="px-3">
            <Eye className="size-4" aria-hidden="true" />
            Preview
          </TabsTrigger>
          <TabsTrigger value="edit" className="px-3">
            <Pencil className="size-4" aria-hidden="true" />
            Edit
            {unsaved ? (
              <>
                <span className="size-1.5 rounded-full bg-warning" aria-hidden="true" />
                <span className="sr-only">(unsaved changes)</span>
              </>
            ) : null}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="preview">
          <AdminSection bodyClassName="px-5 py-6 md:px-10 md:py-8">
            <div className="mx-auto max-w-3xl">
              {unsaved || partnerInText ? (
                <div className="mb-6 space-y-3">
                  {unsaved ? (
                    <p
                      role="status"
                      className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning-soft px-3 py-2 text-sm text-foreground"
                    >
                      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
                      This preview includes changes you have not saved yet.
                    </p>
                  ) : null}
                  {partnerInText ? (
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="inline-block size-3 shrink-0 rounded-sm bg-violet-500/25 ring-1 ring-violet-500/60" aria-hidden="true" />
                      Highlighted words are Partner Network links.
                    </p>
                  ) : null}
                </div>
              ) : null}
              <h2 className="text-2xl font-semibold tracking-tight wrap-anywhere md:text-[28px] md:leading-9">
                {title.trim() ? title : <span className="text-muted-foreground">No title</span>}
              </h2>
              {body ? (
                // The working copy, sanitised as a save would (lib/articles/use-draft.ts).
                <div
                  className={cn("mt-6", ARTICLE_BODY_CLASSES)}
                  dangerouslySetInnerHTML={{ __html: previewHtml(body) }}
                />
              ) : (
                <p className="mt-6 text-sm text-muted-foreground">
                  This article has no content yet.
                </p>
              )}
            </div>
          </AdminSection>
        </TabsContent>

        {/* Kept mounted while hidden, so the editor keeps its undo history and place. */}
        <TabsContent value="edit" forceMount className="data-[state=inactive]:hidden">
          {article.underReview ? (
            <AdminSection
              title="Edited on its review page"
              description="This article is in the Partner Network review. It is edited on its review page, where its network links are kept and the change goes back for approval."
            >
              <Button asChild>
                <Link href={`/admin/network/${article.id}`}>
                  <ClipboardCheck className="size-4" aria-hidden="true" />
                  Open the review page
                </Link>
              </Button>
            </AdminSection>
          ) : (
            <AdminSection
              title="Edit as administrator"
              description="A save changes the customer's article in RepGet at once. It is not sent to their website again, no earlier version is kept, and if someone else saves meanwhile the last save wins."
              bodyClassName="space-y-5 p-5"
            >
              {generating ? (
                <p className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning-soft px-3 py-2 text-sm text-foreground">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
                  This article is still being generated. When generation finishes, its text replaces what is here -
                  including anything saved now.
                </p>
              ) : null}
              <div className="space-y-1.5">
                <div className="flex items-baseline justify-between gap-3">
                  <Label htmlFor="title">Title</Label>
                  <span className="text-xs tabular-nums text-muted-foreground" aria-hidden="true">
                    {title.length}/{TITLE_MAX}
                  </span>
                </div>
                <Input
                  id="title"
                  value={title}
                  maxLength={TITLE_MAX}
                  onChange={(e) => setTitle(e.target.value)}
                  aria-describedby="title-limit"
                />
                <p id="title-limit" className="sr-only">
                  Up to {TITLE_MAX} characters.
                </p>
              </div>
              <div className="space-y-1.5">
                {/* A plain caption, not a <Label>: the editor names itself ("Article content"). See the customer editor. */}
                <p className="text-sm font-medium">Body</p>
                <p className="text-xs text-muted-foreground">
                  Image upload is not available here.
                  {partnerLinks.length > 0 ? " Partner Network links are highlighted in violet." : null}
                </p>
                {/* The editor's toolbar sticks under the admin top bar (h-16), not the app's (h-14). */}
                <div className={cn(PARTNER_LINK_SCOPE, "[&_.sticky]:top-16")}>
                  <RichTextEditor value={body} onChange={setBody} />
                </div>
              </div>
            </AdminSection>
          )}
        </TabsContent>
      </Tabs>

      {article.underReview ? null : (
        <SaveBar
          pending={pending}
          unsaved={unsaved}
          outcome={outcome}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

/**
 * Where the article stands and the one action that changes it. It floats at
 * the bottom of the screen while there is something to save, so Save is in
 * reach from anywhere in a long article, on either tab.
 */
function SaveBar({
  pending,
  unsaved,
  outcome,
  onSave,
}: {
  pending: boolean;
  unsaved: boolean;
  outcome: SaveOutcome;
  onSave: () => void;
}) {
  const failed = outcome.kind === "failed" && unsaved ? outcome.error : null;
  const floating = pending || unsaved;
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border bg-card px-4 py-3 shadow-[0_1px_2px_rgb(0_0_0/0.04)]",
        floating && "sticky bottom-4 z-20 shadow-[0_6px_20px_rgb(0_0_0/0.10)]",
      )}
    >
      <div className="min-w-0 flex-1" aria-live="polite">
        {pending ? (
          <AdminStatus tone="info" icon={Loader2} label="Saving…" />
        ) : failed ? (
          <div className="space-y-1">
            <AdminStatus tone="danger" label="Not saved" />
            <p className="text-sm text-danger wrap-anywhere">{failed}</p>
          </div>
        ) : unsaved ? (
          <AdminStatus tone="warning" label="Unsaved changes" />
        ) : outcome.kind === "saved" ? (
          <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <AdminStatus tone="success" label="Saved" />
            <span className="tabular-nums">at {clock.format(outcome.at)} UTC</span>
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">No unsaved changes</p>
        )}
      </div>
      <Button onClick={onSave} disabled={pending || !unsaved} className="h-9 px-3">
        {pending ? (
          <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
        ) : (
          <Save className="size-4" aria-hidden="true" />
        )}
        {pending ? "Saving…" : "Save changes"}
      </Button>
    </div>
  );
}
