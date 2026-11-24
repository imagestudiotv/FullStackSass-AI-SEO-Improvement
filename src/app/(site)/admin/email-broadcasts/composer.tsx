"use client";

import { CalendarClock, ImagePlus, Mail, Save, Send, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { toast } from "sonner";

import { RichTextEditor } from "@/components/rich-text-editor";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeLikeSelect } from "@/components/ui/native-like-select";
import {
  countBroadcastAudience,
  finishBroadcastImageUpload,
  previewBroadcast,
  saveBroadcastDraft,
  scheduleBroadcast,
  sendBroadcastNow,
  sendBroadcastTest,
  startBroadcastImageUpload,
} from "@/lib/admin/broadcasts";
import {
  AUDIENCE_META,
  BROADCAST_AUDIENCES,
  BROADCAST_IMAGE_TYPES,
  BROADCAST_LIMITS,
  BROADCAST_TEMPLATES,
  SEND_WORD,
  type BroadcastAudience,
  type BroadcastContent,
  type BroadcastTemplateKey,
} from "@/lib/broadcasts/shared";
import { cn } from "@/lib/utils";

import { AdminFacts, AdminSection } from "../_ui/page";
import { useUnsavedChanges } from "../_ui/use-unsaved-changes";
import { DialogError, Spinner } from "../organizations/dialog-fields";

/**
 * The broadcast composer: who, what, a live preview rendered by the code that
 * sends, then test, save, schedule or send. The server checks everything
 * again; nothing here decides who is emailed.
 */

const subscribeNothing = () => () => {};
const NOT_FINISHED = "The server did not finish this. Try again.";
const people = (count: number) => `${count.toLocaleString("en")} ${count === 1 ? "person" : "people"}`;

type Review = { mode: "send" | "schedule"; id: string; revision: number; recipients: number; at: string | null };

export function BroadcastComposer({
  editing,
  initial,
  recipients,
  sendingAllowed,
  imagesEnabled,
  appUrl,
}: {
  editing: { id: string; revision: number } | null;
  initial: BroadcastContent;
  /** Who would receive it when the page was loaded, per audience. */
  recipients: Record<BroadcastAudience, number>;
  sendingAllowed: boolean;
  imagesEnabled: boolean;
  appUrl: string;
}) {
  const router = useRouter();
  const id = useId();
  const [pending, start] = useTransition();
  const inBrowser = useSyncExternalStore(subscribeNothing, () => true, () => false);

  // The draft's id is chosen here, so Save pressed twice is one draft.
  const [draft, setDraft] = useState(() => editing ?? { id: crypto.randomUUID() as string, revision: 0 });
  const [content, setContent] = useState<BroadcastContent>(initial);
  const [savedJson, setSavedJson] = useState(() => JSON.stringify(initial));
  const [template, setTemplate] = useState<BroadcastTemplateKey | null>(null);
  const [scheduleAt, setScheduleAt] = useState("");
  const [uploading, setUploading] = useState(false);
  const [review, setReview] = useState<Review | null>(null);
  const [word, setWord] = useState("");
  const [dialogError, setDialogError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const dirty = JSON.stringify(content) !== savedJson;
  useUnsavedChanges(dirty);
  const set = <K extends keyof BroadcastContent>(key: K, value: BroadcastContent[K]) => setContent((current) => ({ ...current, [key]: value }));
  const timeZone = inBrowser ? Intl.DateTimeFormat().resolvedOptions().timeZone : null;

  function applyTemplate(key: BroadcastTemplateKey) {
    const chosen = BROADCAST_TEMPLATES.find((entry) => entry.key === key);
    if (!chosen) return;
    const typed = dirty && template === null;
    if (typed && !window.confirm("Replace what you wrote with this template?")) return;
    setTemplate(key);
    setContent((current) => ({ ...current, ...chosen.content, ctaUrl: `${appUrl}${chosen.path}` }));
  }

  /** Saves when something changed; the draft as it is stored now, or null (already reported). */
  async function save(): Promise<{ id: string; revision: number } | null> {
    if (!dirty && draft.revision > 0) return draft;
    const result = await saveBroadcastDraft(draft.id, draft.revision, content).catch(() => null);
    if (!result?.ok) {
      toast.error(result?.error ?? NOT_FINISHED);
      return null;
    }
    setDraft(result.data);
    setSavedJson(JSON.stringify(content));
    return result.data;
  }

  function saveDraft() {
    start(async () => {
      const saved = await save();
      if (!saved) return;
      toast.success("Draft saved");
      router.refresh();
    });
  }

  function sendTest() {
    start(async () => {
      const result = await sendBroadcastTest(content).catch(() => null);
      if (!result?.ok) {
        toast.error(result?.error ?? NOT_FINISHED);
        return;
      }
      toast.success(`Test sent to ${result.data.to}`);
    });
  }

  function openReview(mode: Review["mode"]) {
    let at: string | null = null;
    if (mode === "schedule") {
      const chosen = new Date(scheduleAt);
      if (!scheduleAt || Number.isNaN(chosen.getTime())) {
        toast.error("Choose the schedule time first.");
        document.getElementById(`${id}-schedule`)?.focus();
        return;
      }
      at = chosen.toISOString();
    }
    start(async () => {
      const saved = await save();
      if (!saved) return;
      const counted = await countBroadcastAudience(content.audience).catch(() => null);
      if (!counted?.ok) {
        toast.error(counted?.error ?? NOT_FINISHED);
        return;
      }
      setWord("");
      setDialogError(null);
      setReview({ mode, ...saved, recipients: counted.data.recipients, at });
    });
  }

  function closeReview() {
    if (!pending) setReview(null);
  }

  function confirmReview() {
    if (!review) return;
    setDialogError(null);
    start(async () => {
      const confirmation = { recipients: review.recipients, word };
      const result = await (
        review.mode === "send"
          ? sendBroadcastNow(review.id, review.revision, confirmation)
          : scheduleBroadcast(review.id, review.revision, review.at ?? "", confirmation)
      ).catch(() => null);
      if (!result?.ok) {
        setDialogError(result?.error ?? NOT_FINISHED);
        return;
      }
      toast.success(review.mode === "send" ? `Sending to ${people(review.recipients)}` : "Broadcast scheduled");
      setReview(null);
      // A fresh start: the one sent is in the history, and can be copied from there.
      setDraft({ id: crypto.randomUUID(), revision: 0 });
      setContent(initial);
      setSavedJson(JSON.stringify(initial));
      setTemplate(null);
      setScheduleAt("");
      router.replace("/admin/email-broadcasts");
      router.refresh();
    });
  }

  async function addImages(files: File[]) {
    if (files.length === 0) return;
    setUploading(true);
    try {
      let room = BROADCAST_LIMITS.images - content.images.length;
      for (const file of files) {
        if (room <= 0) {
          toast.error(`At most ${BROADCAST_LIMITS.images} pictures.`);
          break;
        }
        const uploaded = await uploadPicture(file);
        if (!uploaded.ok) {
          toast.error(`${file.name}: ${uploaded.error}`);
          continue;
        }
        room--;
        const alt = file.name.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").slice(0, BROADCAST_LIMITS.imageAlt);
        setContent((current) => ({ ...current, images: [...current.images, { url: uploaded.url, alt }] }));
      }
    } finally {
      setUploading(false);
    }
  }

  const needsWord = (review?.recipients ?? 0) > 1;
  const nobody = review !== null && review.recipients === 0;

  return (
    <>
      <AdminSection
        id="setup"
        title="Broadcast setup"
        description="Choose who should receive the email, prepare the message, optionally add pictures, then test, save, schedule or send it."
      >
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="min-w-0 space-y-1.5">
              <Label htmlFor={`${id}-audience`}>Audience</Label>
              <NativeLikeSelect
                id={`${id}-audience`}
                value={content.audience}
                onChange={(event) => set("audience", event.target.value as BroadcastAudience)}
                aria-describedby={`${id}-audience-help`}
                className="w-full"
              >
                {BROADCAST_AUDIENCES.map((audience) => (
                  <option key={audience} value={audience}>
                    {AUDIENCE_META[audience].label}
                  </option>
                ))}
              </NativeLikeSelect>
              <p id={`${id}-audience-help`} className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{people(recipients[content.audience])} would receive it now.</span>{" "}
                {AUDIENCE_META[content.audience].definition} Unsubscribed people and unverified addresses are always left out.
              </p>
            </div>
            <div className="min-w-0 space-y-1.5">
              <Label htmlFor={`${id}-schedule`}>Schedule time</Label>
              <Input
                id={`${id}-schedule`}
                type="datetime-local"
                value={scheduleAt}
                onChange={(event) => setScheduleAt(event.target.value)}
                aria-describedby={`${id}-schedule-help`}
              />
              <p id={`${id}-schedule-help`} className="text-xs text-muted-foreground">
                Only for Schedule{timeZone ? `, in your time zone (${timeZone})` : ""}. It starts within five minutes of this time, to
                whoever is in the audience then.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="min-w-0 space-y-1.5">
              <Label htmlFor={`${id}-subject`}>Subject line</Label>
              <Input id={`${id}-subject`} value={content.subject} maxLength={BROADCAST_LIMITS.subject} onChange={(event) => set("subject", event.target.value)} />
            </div>
            <div className="min-w-0 space-y-1.5">
              <Label htmlFor={`${id}-preview-text`}>Preview text</Label>
              <Input
                id={`${id}-preview-text`}
                value={content.previewText}
                maxLength={BROADCAST_LIMITS.previewText}
                onChange={(event) => set("previewText", event.target.value)}
                aria-describedby={`${id}-preview-text-help`}
              />
              <p id={`${id}-preview-text-help`} className="text-xs text-muted-foreground">
                The line after the subject in an inbox.
              </p>
            </div>
          </div>

          <fieldset className="min-w-0 space-y-1.5">
            <legend className="text-sm font-medium">Templates</legend>
            <div className="flex flex-wrap gap-2 pt-1">
              {BROADCAST_TEMPLATES.map((entry) => (
                <Button
                  key={entry.key}
                  type="button"
                  size="sm"
                  variant="outline"
                  aria-pressed={template === entry.key}
                  className={cn(template === entry.key && "border-primary bg-primary/10")}
                  onClick={() => applyTemplate(entry.key)}
                >
                  {entry.label}
                </Button>
              ))}
            </div>
          </fieldset>

          <div className="min-w-0 space-y-1.5">
            <p className="text-sm font-medium">Message content</p>
            <RichTextEditor toolbar="compact" ariaLabel="Message content" value={content.bodyHtml} onChange={(bodyHtml) => set("bodyHtml", bodyHtml)} />
          </div>

          <div className="min-w-0 rounded-lg border p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">Pictures</p>
                <p id={`${id}-images-help`} className="mt-0.5 text-xs text-muted-foreground">
                  {imagesEnabled
                    ? `Shown under the message, in this order. PNG or JPEG, at most 5 MB each and ${BROADCAST_LIMITS.images} in all.`
                    : "Image storage is not set up on this deployment, so pictures cannot be added."}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!imagesEnabled || uploading || content.images.length >= BROADCAST_LIMITS.images}
                onClick={() => fileRef.current?.click()}
                aria-describedby={`${id}-images-help`}
              >
                {uploading ? <Spinner /> : <ImagePlus className="size-4" aria-hidden="true" />}
                Choose image
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept={BROADCAST_IMAGE_TYPES.join(",")}
                multiple
                hidden
                onChange={(event) => {
                  const files = Array.from(event.target.files ?? []);
                  event.target.value = "";
                  void addImages(files);
                }}
              />
            </div>
            {content.images.length > 0 ? (
              <ul className="mt-3 space-y-2" aria-label="Pictures in this email">
                {content.images.map((image, index) => (
                  <li key={image.url} className="flex flex-wrap items-center gap-3 sm:flex-nowrap">
                    {/* eslint-disable-next-line @next/next/no-img-element -- our own stored file, as the email shows it */}
                    <img src={image.url} alt="" className="size-12 shrink-0 rounded-md border object-cover" />
                    <Input
                      aria-label={`Description of picture ${index + 1}`}
                      placeholder="What it shows"
                      value={image.alt}
                      maxLength={BROADCAST_LIMITS.imageAlt}
                      onChange={(event) =>
                        set(
                          "images",
                          content.images.map((entry, at) => (at === index ? { ...entry, alt: event.target.value } : entry)),
                        )
                      }
                      className="min-w-0 flex-1"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove picture ${index + 1}`}
                      onClick={() =>
                        set(
                          "images",
                          content.images.filter((_, at) => at !== index),
                        )
                      }
                    >
                      <X className="size-4" aria-hidden="true" />
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="min-w-0 space-y-1.5">
              <Label htmlFor={`${id}-cta-label`}>CTA button label</Label>
              <Input id={`${id}-cta-label`} value={content.ctaLabel} maxLength={BROADCAST_LIMITS.ctaLabel} onChange={(event) => set("ctaLabel", event.target.value)} />
            </div>
            <div className="min-w-0 space-y-1.5">
              <Label htmlFor={`${id}-cta-url`}>CTA URL</Label>
              <Input
                id={`${id}-cta-url`}
                type="url"
                value={content.ctaUrl}
                maxLength={BROADCAST_LIMITS.ctaUrl}
                placeholder="https://"
                onChange={(event) => set("ctaUrl", event.target.value)}
                aria-describedby={`${id}-cta-help`}
              />
              <p id={`${id}-cta-help`} className="text-xs text-muted-foreground">
                A full https:// address. Leave both empty for no button.
              </p>
            </div>
          </div>
        </div>
      </AdminSection>

      <AdminSection id="preview" title="Live preview" description="Exactly the email that is sent, with a placeholder unsubscribe link.">
        <LivePreview content={content} />
        <div className="mt-5 flex flex-col gap-3 border-t pt-5 sm:flex-row sm:flex-wrap sm:justify-between">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={sendTest} disabled={pending || !sendingAllowed}>
              <Mail className="size-4" aria-hidden="true" />
              Send test
            </Button>
            <Button type="button" variant="outline" onClick={saveDraft} disabled={pending}>
              <Save className="size-4" aria-hidden="true" />
              Save draft
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => openReview("schedule")} disabled={pending || uploading || !sendingAllowed}>
              <CalendarClock className="size-4" aria-hidden="true" />
              Schedule
            </Button>
            <Button type="button" onClick={() => openReview("send")} disabled={pending || uploading || !sendingAllowed}>
              {pending ? <Spinner /> : <Send className="size-4" aria-hidden="true" />}
              Review and send
            </Button>
          </div>
        </div>
      </AdminSection>

      <Dialog open={review !== null} onOpenChange={(open) => (open ? null : closeReview())}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Review broadcast</DialogTitle>
            <DialogDescription>
              Check the details before this email goes to real people. It cannot be recalled once sent.
            </DialogDescription>
          </DialogHeader>
          {review ? (
            <div className="space-y-4">
              <AdminFacts
                items={[
                  { label: "Audience", value: AUDIENCE_META[content.audience].label },
                  { label: "Recipients", value: <strong>{people(review.recipients)}</strong> },
                  { label: "Subject", value: content.subject || "No subject" },
                  { label: "Delivery", value: review.at ? new Date(review.at).toLocaleString("en", { dateStyle: "medium", timeStyle: "short" }) : "Send now, about one email a second" },
                  { label: "Pictures", value: String(content.images.length) },
                ]}
              />
              {nobody ? <DialogError message="Nobody in this audience can be emailed." /> : null}
              {needsWord ? (
                <div className="space-y-1.5">
                  <Label htmlFor={`${id}-word`}>
                    Type <span className="font-mono">{SEND_WORD}</span> to confirm
                  </Label>
                  <Input
                    id={`${id}-word`}
                    value={word}
                    onChange={(event) => setWord(event.target.value)}
                    placeholder={SEND_WORD}
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    disabled={pending}
                    className="font-mono"
                  />
                </div>
              ) : null}
              <DialogError message={dialogError} />
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={closeReview} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={confirmReview} disabled={pending || nobody || (needsWord && word !== SEND_WORD)}>
              {pending ? <Spinner /> : null}
              {review?.mode === "schedule" ? "Confirm schedule" : "Confirm send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** The rendered email in a frame that can run nothing, refreshed shortly after typing stops. */
function LivePreview({ content }: { content: BroadcastContent }) {
  const [preview, setPreview] = useState<{ subject: string; html: string } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const key = JSON.stringify(content);

  useEffect(() => {
    let current = true;
    const timer = window.setTimeout(() => {
      previewBroadcast(JSON.parse(key)).then(
        (result) => {
          if (!current) return;
          if (result.ok) {
            setPreview(result.data);
            setProblem(null);
          } else setProblem(result.error);
        },
        () => {
          if (current) setProblem("The preview could not be loaded.");
        },
      );
    }, 500);
    return () => {
      current = false;
      window.clearTimeout(timer);
    };
  }, [key]);

  return (
    <div className="space-y-3">
      <p className="text-sm wrap-anywhere">
        <span className="text-muted-foreground">Subject: </span>
        <span className="font-medium">{preview?.subject ?? content.subject}</span>
        {content.previewText ? <span className="text-muted-foreground"> - {content.previewText}</span> : null}
      </p>
      <div aria-live="polite">
        {problem ? <p className="rounded-lg border border-warning/30 bg-warning-soft px-3 py-2 text-sm">{problem}</p> : null}
      </div>
      <iframe
        title="Email preview"
        sandbox=""
        srcDoc={preview?.html ?? ""}
        className="h-[640px] w-full rounded-lg border bg-white"
      />
    </div>
  );
}

/** One picture to our storage, straight from the browser, then checked by the server. Never throws. */
async function uploadPicture(file: File): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const failed = { ok: false as const, error: "The picture could not be uploaded. Check the connection and try again." };
  try {
    const started = await startBroadcastImageUpload({ type: file.type, size: file.size });
    if (!started.ok) return started;
    const sent = await fetch(started.data.signedUrl, { method: "PUT", headers: { "content-type": file.type }, body: file });
    if (!sent.ok) return failed;
    const finished = await finishBroadcastImageUpload({ upload: started.data.upload, name: file.name });
    return finished.ok ? { ok: true, url: finished.data.url } : finished;
  } catch (error) {
    console.error("[admin/broadcasts] picture upload failed", error);
    return failed;
  }
}
