"use client";

import { ImageIcon, ImagePlus, Loader2, Sparkles, Trash2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/workspace/field";
import { Notice } from "@/components/workspace/notice";
import { WorkspaceSection } from "@/components/workspace/section";
import {
  regenerateArticleImage,
  removeArticleImage,
  updateArticleImageAlt,
  uploadArticleImage,
} from "@/lib/articles/image-actions";
import type { Locale } from "@/lib/i18n/config";
import { format } from "@/lib/i18n/format";
import type { Messages } from "@/lib/i18n/messages";

import { actionErrorText, imageSizeErrorText } from "./failure-copy";

/**
 * The article's picture, and the three things you can do to it: describe a
 * different one, upload your own, or have none. Each change is saved at once
 * by its own action (not by the article's Save), and says so.
 *
 * Regeneration is capped and costs real money, so the remaining count is
 * shown rather than discovered by hitting a wall. The count comes from the
 * article's recorded attempts; the server's ledger is what enforces it.
 *
 * The description (alt text) follows the saved value whenever it is not
 * being edited - after a new picture is generated (which writes its own
 * description) the field shows that one, rather than keeping the old text
 * and writing it back over the new on the next blur.
 */

/** The types the upload actions accept (lib/articles/image-actions.ts). */
export const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
const ALT_MAX = 300;

type AltDraft = {
  value: string;
  /** The saved description when this edit started. */
  base: string | null;
  /** The picture it describes. */
  forUrl: string | null;
  /** Sent and confirmed: drop it once the saved value arrives. */
  saved: boolean;
};

export function FeaturedImage({
  websiteId,
  articleId,
  imageUrl,
  imageAlt,
  attempts,
  maxAttempts,
  maxBytes,
  canEdit,
  lockedReason,
  reviewApproved,
  locale,
  onAltUnsavedChange,
  t,
  tImage,
  tCommon,
  tWorkspace,
}: {
  websiteId: string;
  articleId: string;
  imageUrl: string | null;
  imageAlt: string | null;
  attempts: number;
  /** Lifetime regenerations per article (lib/articles/image-actions.ts). */
  maxAttempts: number;
  /** Largest upload, in bytes (lib/images/storage.ts). */
  maxBytes: number;
  canEdit: boolean;
  /** Why changes wait right now (being written, being delivered), or null. */
  lockedReason: string | null;
  /**
   * Approved by the RepGet team: any change to the picture or its
   * description sends it back to their review (lib/articles/image-actions.ts
   * writeImage calls syncApproval), so the panel says so before it happens.
   */
  reviewApproved: boolean;
  locale: Locale;
  /**
   * Told whether a typed description is still waiting to be saved (it saves
   * when the field is left), so the page's one leave-page guard covers it
   * too - closing the tab mid-word would otherwise lose it silently.
   */
  onAltUnsavedChange?: (unsaved: boolean) => void;
  t: Messages["app"]["editor"];
  tImage: Messages["app"]["image"];
  tCommon: Messages["app"]["common"];
  tWorkspace: Messages["app"]["workspace"];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [prompt, setPrompt] = useState("");
  const [altDraft, setAltDraft] = useState<AltDraft | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** After an upload over a described picture: the old description is still attached. */
  const [checkAlt, setCheckAlt] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Follow the saved description once an edit is confirmed, or when the picture changes.
  let draft = altDraft;
  if (draft && (draft.forUrl !== imageUrl || (draft.saved && draft.base !== imageAlt))) {
    draft = null;
    setAltDraft(null);
  }

  const alt = draft?.value ?? imageAlt ?? "";
  const altUnsaved = Boolean(draft && !draft.saved && draft.value !== (imageAlt ?? ""));
  useEffect(() => {
    onAltUnsavedChange?.(altUnsaved);
  }, [altUnsaved, onAltUnsavedChange]);
  const remaining = Math.max(maxAttempts - attempts, 0);
  const locked = !canEdit || lockedReason !== null;
  const errorText = (message: string) => actionErrorText(message, { t, tWorkspace, tImage });

  function run(action: () => Promise<{ ok: true } | { ok: false; error: string }>, done: string, after?: () => void) {
    setStatus(null);
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(errorText(result.error));
        return;
      }
      after?.();
      setStatus(done);
      router.refresh();
    });
  }

  function regenerate() {
    run(() => regenerateArticleImage(websiteId, articleId, prompt), tImage.imageReady, () => {
      setPrompt("");
      setCheckAlt(false);
    });
  }

  function upload(file: File) {
    // Checked here too, in the reader's language; the server checks again.
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setStatus(null);
      setError(t.imageTypeError);
      return;
    }
    if (file.size > maxBytes) {
      setStatus(null);
      setError(imageSizeErrorText(file.size, maxBytes, locale, t));
      return;
    }
    const body = new FormData();
    body.set("file", file);
    const described = Boolean(imageAlt);
    run(() => uploadArticleImage(websiteId, articleId, body), tImage.imageUploaded, () => setCheckAlt(described));
  }

  function remove() {
    run(() => removeArticleImage(websiteId, articleId), tImage.imageRemoved, () => setCheckAlt(false));
  }

  function saveAlt() {
    if (!draft || draft.saved || draft.value === (imageAlt ?? "")) return;
    const value = draft.value;
    run(() => updateArticleImageAlt(websiteId, articleId, value), t.imageAltSaved, () => {
      setCheckAlt(false);
      setAltDraft((current) => (current && current.value === value ? { ...current, saved: true } : current));
    });
  }

  return (
    <WorkspaceSection
      id="article-image"
      icon={ImagePlus}
      title={tCommon.featuredImage}
      description={tCommon.featuredImageHelp}
      actions={
        pending ? (
          <Loader2 className="size-4 animate-spin text-muted-foreground motion-reduce:animate-none" aria-hidden="true" />
        ) : null
      }
      bodyClassName="space-y-5"
    >
      {imageUrl ? (
        /*
          A plain <img>: once published, this file lives on the customer's own
          CMS, so next/image would need every customer domain in remotePatterns.
        */
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt={imageAlt ?? ""} className="aspect-video w-full rounded-lg border object-cover" />
      ) : (
        <div className="flex aspect-video w-full items-center justify-center rounded-lg border border-dashed bg-muted/30">
          <div className="px-4 text-center">
            <ImageIcon className="mx-auto size-6 text-muted-foreground" aria-hidden="true" />
            <p className="mt-2 text-sm text-muted-foreground">{tCommon.noImageYet}</p>
          </div>
        </div>
      )}

      {!canEdit ? (
        imageUrl ? (
          <div className="space-y-1">
            <p className="text-sm font-medium">{tImage.altLabel}</p>
            <p className="text-sm text-muted-foreground wrap-anywhere">{imageAlt || t.imageNoAlt}</p>
          </div>
        ) : null
      ) : (
        <>
          {lockedReason ? <p className="text-xs leading-5 text-muted-foreground">{lockedReason}</p> : null}
          {reviewApproved && !lockedReason ? (
            <p className="text-xs leading-5 text-muted-foreground">{t.imageReviewNote}</p>
          ) : null}

          {imageUrl ? (
            <Field
              id="image-alt"
              label={tImage.altLabel}
              hint={`${tCommon.altHelp} ${t.imageAltHint}`}
              count={{ value: alt.length, max: ALT_MAX }}
              t={tWorkspace}
            >
              {(props) => (
                <Input
                  {...props}
                  value={alt}
                  maxLength={ALT_MAX}
                  disabled={locked || pending}
                  placeholder={tImage.altPlaceholder}
                  onChange={(event) =>
                    setAltDraft({ value: event.target.value, base: imageAlt, forUrl: imageUrl, saved: false })
                  }
                  onBlur={saveAlt}
                />
              )}
            </Field>
          ) : null}

          {checkAlt && imageUrl ? <Notice tone="warning">{t.imageCheckAlt}</Notice> : null}

          <Field
            id="image-prompt"
            label={tImage.promptLabel}
            hint={remaining > 0 ? format(t.imagePromptHint, { remaining, max: maxAttempts }) : tImage.noRegensLeft}
            t={tWorkspace}
          >
            {(props) => (
              <Textarea
                {...props}
                rows={2}
                value={prompt}
                disabled={locked || remaining === 0}
                placeholder={tImage.promptPlaceholder}
                onChange={(event) => setPrompt(event.target.value)}
              />
            )}
          </Field>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={locked || pending || remaining === 0}
              onClick={regenerate}
            >
              <Sparkles aria-hidden="true" />
              {imageUrl ? t.imageReplace : t.imageGenerate}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={locked || pending}
              onClick={() => fileRef.current?.click()}
            >
              <Upload aria-hidden="true" />
              {tCommon.upload}
            </Button>
            {imageUrl ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={locked || pending}
                onClick={remove}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 aria-hidden="true" />
                {tCommon.remove}
              </Button>
            ) : null}
            {/* Hidden but real: the styled button opens it, the browser handles picking a file. */}
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPTED_IMAGE_TYPES.join(",")}
              className="hidden"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(event) => {
                const file = event.target.files?.[0];
                // Cleared, or choosing the same file twice fires no change event.
                event.target.value = "";
                if (file) upload(file);
              }}
            />
          </div>

          {/* What the last change did, once the server answered - never before. */}
          <div className="empty:hidden">
            {error ? (
              <Notice tone="danger" role="alert">
                {error}
              </Notice>
            ) : status ? (
              <p role="status" className="text-xs text-emerald-700">{status}</p>
            ) : null}
          </div>
        </>
      )}
    </WorkspaceSection>
  );
}
