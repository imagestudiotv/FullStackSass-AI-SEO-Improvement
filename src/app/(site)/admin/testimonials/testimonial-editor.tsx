"use client";

import { AlertTriangle, ImageMinus, Loader2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { TestimonialCard } from "@/components/testimonial-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { saveTestimonial, uploadTestimonialPicture, type AdminTestimonial } from "@/lib/admin/testimonials";
import { cn } from "@/lib/utils";

import { AdminPage, AdminPageHeader, AdminSection } from "../_ui/page";
import { AdminStatus } from "../_ui/status";
import { useUnsavedChanges } from "../_ui/use-unsaved-changes";

const LIMITS = { name: 80, role: 100, quote: 600 } as const;
const TEXTAREA =
  "flex w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-2 text-base outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30";

type Draft = { name: string; role: string; quote: string; avatarUrl: string | null; published: boolean };

/**
 * Writing one testimonial card (lib/admin/testimonials.ts): name, role,
 * quote and picture, with the card beside them exactly as the homepage
 * draws it (components/testimonial-card.tsx), and the switch that puts it on
 * the homepage. Going live, or changing a live card's words, name or
 * picture, asks for the person's agreement to be confirmed; a sample card
 * from the design package cannot go live until its content is replaced.
 */
export function TestimonialEditor({ card }: { card: AdminTestimonial | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [uploading, startUpload] = useTransition();
  const initial: Draft = {
    name: card?.name ?? "",
    role: card?.role ?? "",
    quote: card?.quote ?? "",
    avatarUrl: card?.avatarUrl ?? null,
    published: card?.published ?? false,
  };
  const [saved, setSaved] = useState<Draft>(initial);
  const [draft, setDraft] = useState<Draft>(initial);
  const [confirmed, setConfirmed] = useState(false);
  const [sample, setSample] = useState(card?.sample ?? false);
  const file = useRef<HTMLInputElement>(null);

  const unsaved = JSON.stringify(draft) !== JSON.stringify(saved);
  useUnsavedChanges(unsaved);

  const contentChanged = draft.name !== saved.name || draft.quote !== saved.quote || draft.avatarUrl !== saved.avatarUrl;
  const stillSample = sample && !contentChanged;
  // The same rule as the server's: going live, or a live card's content changing.
  const needsConfirmation = draft.published && (!saved.published || contentChanged || draft.role !== saved.role || !card);
  const blocked = draft.published && (stillSample || (needsConfirmation && !confirmed));

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function upload(picture: File) {
    startUpload(async () => {
      const form = new FormData();
      form.set("file", picture);
      const result = await uploadTestimonialPicture(form).catch(() => null);
      if (!result) {
        toast.error("The picture could not be uploaded. Try again.");
        return;
      }
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      set("avatarUrl", result.data.url);
      toast.success("Picture uploaded - save to keep it");
    });
  }

  function save() {
    const sent = draft;
    start(async () => {
      const result = await saveTestimonial({ id: card?.id ?? null, card: { ...sent, permissionConfirmed: confirmed } }).catch(() => null);
      if (!result) {
        toast.error("The server did not finish this - your changes are still here. Try again.");
        return;
      }
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.data.published ? "Saved - it is on the homepage" : "Saved as a draft");
      if (!card) {
        router.replace(`/admin/testimonials/${result.data.id}`);
        return;
      }
      setSaved(sent);
      setSample(result.data.sample);
      setConfirmed(false);
      router.refresh();
    });
  }

  return (
    <AdminPage width="default">
      <AdminPageHeader
        back={{ href: "/admin/testimonials", label: "All testimonials" }}
        title={card ? saved.name || "Testimonial" : "New testimonial"}
        description={
          saved.published
            ? "On the homepage and the plan screen. Saved changes are live at once."
            : "A draft: only administrators see it, on the design preview."
        }
        meta={
          <span className="flex flex-wrap gap-2">
            {saved.published ? <AdminStatus tone="success" label="Published" /> : <AdminStatus tone="neutral" label="Draft" />}
            {stillSample ? <AdminStatus tone="warning" label="Sample" /> : null}
          </span>
        }
        actions={
          <Button size="lg" onClick={save} disabled={pending || uploading || blocked || (!unsaved && Boolean(card))}>
            {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
            Save
          </Button>
        }
      />

      {stillSample ? (
        <p className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning-soft p-4 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
          <span>
            <span className="font-medium text-warning">A sample card from the design package.</span>{" "}
            {"Its words were written for the mockup and are not a real customer’s. Replace them, with the name and picture, with a real customer’s approved ones before publishing it."}
          </span>
        </p>
      ) : null}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
        <AdminSection id="testimonial-content" title="The card">
          <div className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="testimonial-name">Name</Label>
              <Input id="testimonial-name" value={draft.name} maxLength={LIMITS.name} onChange={(e) => set("name", e.target.value)} placeholder="Image Studio" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="testimonial-role">Role and company</Label>
              <Input id="testimonial-role" value={draft.role} maxLength={LIMITS.role} onChange={(e) => set("role", e.target.value)} placeholder="Founder, Tatem Web Design" />
              <p className="text-xs text-muted-foreground">
                {"Someone connected to RepGet (owners, staff or their own businesses) must say so here, e.g. “Photo & Film Studio, run by RepGet’s founder”."}
              </p>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <Label htmlFor="testimonial-quote">Quote</Label>
                <span className={cn("text-xs tabular-nums", draft.quote.length > LIMITS.quote ? "text-danger" : "text-muted-foreground")}>
                  {draft.quote.length} / {LIMITS.quote}
                </span>
              </div>
              <textarea
                id="testimonial-quote"
                rows={5}
                maxLength={LIMITS.quote}
                className={TEXTAREA}
                value={draft.quote}
                onChange={(e) => set("quote", e.target.value)}
                placeholder="The person's own words, as they agreed to publish them."
              />
            </div>
            <div className="space-y-2">
              <Label>Picture</Label>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={file}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  tabIndex={-1}
                  aria-hidden="true"
                  onChange={(event) => {
                    const picture = event.target.files?.[0];
                    event.target.value = "";
                    if (picture) upload(picture);
                  }}
                />
                <Button type="button" variant="outline" onClick={() => file.current?.click()} disabled={uploading}>
                  {uploading ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Upload aria-hidden="true" />}
                  {draft.avatarUrl ? "Replace picture" : "Upload picture"}
                </Button>
                {draft.avatarUrl ? (
                  <Button type="button" variant="ghost" onClick={() => set("avatarUrl", null)}>
                    <ImageMinus aria-hidden="true" />
                    Use initials instead
                  </Button>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">
                A photo or logo the person agreed to show. It is cropped to a square and shown round, at 64px. Without one, the card shows their initials.
              </p>
            </div>
          </div>
        </AdminSection>

        <div className="space-y-6">
          <AdminSection id="testimonial-preview" title="On the homepage">
            <TestimonialCard as="div" item={{ name: draft.name || "Name", role: draft.role, quote: draft.quote || "The quote appears here.", avatar: draft.avatarUrl }} verifiedLabel="Verified customer" />
          </AdminSection>

          <AdminSection id="testimonial-publish" title="Publishing">
            <div className="space-y-4">
              <label className="flex items-start justify-between gap-4">
                <span>
                  <span className="block text-sm font-medium">Show on the homepage</span>
                  <span className="block text-xs text-muted-foreground">Also on the plan screen, beside the plans.</span>
                </span>
                <Switch checked={draft.published} onCheckedChange={(value) => set("published", value)} aria-label="Show on the homepage" />
              </label>
              {draft.published && stillSample ? (
                <p className="text-sm text-warning">A sample card cannot be published. Replace its words, name or picture first.</p>
              ) : null}
              {draft.published && !stillSample && needsConfirmation ? (
                <label className="flex items-start gap-2 rounded-lg border bg-muted/40 p-3 text-sm">
                  <input type="checkbox" className="mt-0.5 size-4 accent-primary" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
                  <span>The person agreed in writing to publishing these words, their name and their picture.</span>
                </label>
              ) : null}
              {card?.permissionConfirmedBy && card.permissionConfirmedAt ? (
                <p className="text-xs text-muted-foreground">
                  Agreement confirmed by {card.permissionConfirmedBy} on {card.permissionConfirmedAt.toISOString().slice(0, 10)}.
                </p>
              ) : null}
            </div>
          </AdminSection>
        </div>
      </div>
    </AdminPage>
  );
}
