"use client";

import { ExternalLink, Eye, ImageMinus, Loader2, Plus, Trash2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { RichTextEditor } from "@/components/rich-text-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { saveSuccessStory, uploadSuccessStoryLogo, type AdminSuccessStory } from "@/lib/admin/success-stories";
import { businessInitial } from "@/lib/blog/business";
import { STORY_LIMITS, storySlug, successStoryPath, type StoryMetric, type SuccessStoryInput } from "@/lib/success-stories/fields";
import { cn } from "@/lib/utils";

import { AdminPage, AdminPageHeader, AdminSection } from "../_ui/page";
import { AdminStatus } from "../_ui/status";
import { useUnsavedChanges } from "../_ui/use-unsaved-changes";

const TEXTAREA =
  "flex w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-2 text-base outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30";

/** A server action's request body is limited to 1 MB; a bigger picture would fail with no useful message. */
const UPLOAD_MAX_BYTES = 950 * 1024;

function fromStory(story: AdminSuccessStory | null): SuccessStoryInput {
  return {
    name: story?.name ?? "",
    websiteUrl: story?.websiteUrl ?? "",
    logoUrl: story?.logoUrl ?? "",
    title: story?.title ?? "",
    summary: story?.summary ?? "",
    categoryLabel: story?.categoryLabel ?? "",
    slug: story?.slug ?? "",
    bodyHtml: story?.bodyHtml ?? "",
    metrics: story?.metrics ?? [],
    discoverSlug: story?.discoverSlug ?? "",
    seoTitle: story?.seoTitle ?? "",
    seoDescription: story?.seoDescription ?? "",
    published: story?.published ?? false,
  };
}

function Counter({ value, max }: { value: string; max: number }) {
  return <span className={cn("text-xs tabular-nums", value.length > max ? "text-danger" : "text-muted-foreground")}>{value.length} / {max}</span>;
}

/**
 * Writing one success story (lib/admin/success-stories.ts): the card's
 * words, logo and label; the page's address, key figures and sections; its
 * search title and description; and the switch that publishes it - after
 * Image Studio's, on the homepage, /success-stories and /discover. The
 * words are shown as typed, in one language; the pages around them are
 * translated.
 */
export function SuccessStoryEditor({ story }: { story: AdminSuccessStory | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [uploading, startUpload] = useTransition();
  const initial = fromStory(story);
  const [saved, setSaved] = useState<SuccessStoryInput>(initial);
  const [draft, setDraft] = useState<SuccessStoryInput>(initial);
  const file = useRef<HTMLInputElement>(null);

  const unsaved = JSON.stringify(draft) !== JSON.stringify(saved);
  useUnsavedChanges(unsaved);
  const slug = storySlug(draft.slug || draft.name);

  function set<K extends keyof SuccessStoryInput>(key: K, value: SuccessStoryInput[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }
  function setMetric(index: number, patch: Partial<StoryMetric>) {
    set(
      "metrics",
      draft.metrics.map((metric, i) => (i === index ? { ...metric, ...patch } : metric)),
    );
  }

  function upload(picture: File) {
    if (picture.size > UPLOAD_MAX_BYTES) {
      toast.error("Use a picture under 1 MB - it is cropped to a small square anyway");
      return;
    }
    startUpload(async () => {
      const form = new FormData();
      form.set("file", picture);
      form.set("name", draft.name);
      const result = await uploadSuccessStoryLogo(form).catch(() => null);
      if (!result) {
        toast.error("The picture could not be uploaded. Try again.");
        return;
      }
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      set("logoUrl", result.data.url);
      toast.success("Picture uploaded - save to keep it");
    });
  }

  function save() {
    const sent = draft;
    start(async () => {
      const result = await saveSuccessStory({ id: story?.id ?? null, story: sent }).catch(() => null);
      if (!result) {
        toast.error("The server did not finish this - your changes are still here. Try again.");
        return;
      }
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.data.published ? "Saved - it is live" : "Saved as a draft");
      if (!story) {
        router.replace(`/admin/success-stories/${result.data.id}`);
        return;
      }
      const kept = { ...sent, slug: result.data.slug };
      setSaved(kept);
      setDraft(kept);
      router.refresh();
    });
  }

  return (
    <AdminPage width="wide">
      <AdminPageHeader
        back={{ href: "/admin/success-stories", label: "All success stories" }}
        title={story ? saved.title || saved.name || "Success story" : "New success story"}
        description={
          saved.published && story
            ? "Live after Image Studio's story on the homepage, /success-stories and /discover. Saved changes are live at once."
            : "A draft: only administrators see it, on the preview."
        }
        meta={saved.published && story ? <AdminStatus tone="success" label="Published" /> : <AdminStatus tone="neutral" label="Draft" />}
        actions={
          <div className="flex flex-wrap gap-2">
            {story ? (
              <Button variant="outline" size="lg" asChild>
                <a href={saved.published ? successStoryPath("en", story.slug) : `/admin/success-stories/${story.id}/preview`} target="_blank" rel="noopener">
                  {saved.published ? <ExternalLink aria-hidden="true" /> : <Eye aria-hidden="true" />}
                  {saved.published ? "View the page" : "Preview"}
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              </Button>
            ) : null}
            <Button size="lg" onClick={save} disabled={pending || uploading || (!unsaved && Boolean(story))}>
              {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
              Save
            </Button>
          </div>
        }
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
        <div className="min-w-0 space-y-6">
          <AdminSection id="story-card" title="The card">
            <div className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="story-name">Business or person</Label>
                <Input id="story-name" value={draft.name} maxLength={STORY_LIMITS.name} onChange={(e) => set("name", e.target.value)} placeholder="Dumitru Culiuc" />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-baseline justify-between gap-3">
                  <Label htmlFor="story-title">Story title</Label>
                  <Counter value={draft.title} max={STORY_LIMITS.title} />
                </div>
                <Input id="story-title" value={draft.title} maxLength={STORY_LIMITS.title} onChange={(e) => set("title", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-baseline justify-between gap-3">
                  <Label htmlFor="story-summary">Short summary</Label>
                  <Counter value={draft.summary} max={STORY_LIMITS.summary} />
                </div>
                <textarea
                  id="story-summary"
                  rows={3}
                  maxLength={STORY_LIMITS.summary}
                  className={TEXTAREA}
                  value={draft.summary}
                  onChange={(e) => set("summary", e.target.value)}
                />
                <p className="text-xs text-muted-foreground">{"The card's text, and the line under the page's title."}</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="story-label">Category label</Label>
                <Input
                  id="story-label"
                  value={draft.categoryLabel}
                  maxLength={STORY_LIMITS.categoryLabel}
                  onChange={(e) => set("categoryLabel", e.target.value)}
                  placeholder="Customer story"
                />
                <p className="text-xs text-muted-foreground">{"After the name on the card. Empty: “Customer story” in the reader's language."}</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="story-website">Website</Label>
                <Input id="story-website" value={draft.websiteUrl} onChange={(e) => set("websiteUrl", e.target.value)} placeholder="https://dumitruculiuc.com" inputMode="url" />
              </div>
              <div className="space-y-2">
                <Label>Logo or portrait</Label>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-card">
                    {draft.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- a stored 256px picture shown as it is
                      <img src={draft.logoUrl} alt="" className="size-full object-cover" />
                    ) : (
                      <span aria-hidden="true" className="text-lg font-semibold text-primary">
                        {businessInitial(draft.name || "?")}
                      </span>
                    )}
                  </span>
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
                    {draft.logoUrl ? "Replace picture" : "Upload picture"}
                  </Button>
                  {draft.logoUrl ? (
                    <Button type="button" variant="ghost" onClick={() => set("logoUrl", "")}>
                      <ImageMinus aria-hidden="true" />
                      Use the initial instead
                    </Button>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground">PNG, JPEG or WebP under 1 MB, cropped to a centred square. Without one, the card shows the name&apos;s first letter.</p>
              </div>
            </div>
          </AdminSection>

          <AdminSection id="story-page" title="The page">
            <div className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="story-slug">Address</Label>
                <Input id="story-slug" value={draft.slug} maxLength={STORY_LIMITS.slug} onChange={(e) => set("slug", e.target.value)} placeholder={storySlug(draft.name) || "dumitru-culiuc"} />
                <p className="text-xs text-muted-foreground wrap-anywhere">
                  {slug ? `repget.com${successStoryPath("en", slug)}` : "From the name when left empty."} Changing it on a live story breaks links to the old address.
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Key figures (optional)</p>
                {draft.metrics.map((metric, index) => (
                  <div key={index} className="flex flex-wrap items-center gap-2">
                    <Input
                      aria-label={`Figure ${index + 1}: value`}
                      className="w-28"
                      value={metric.value}
                      maxLength={STORY_LIMITS.metricValue}
                      onChange={(e) => setMetric(index, { value: e.target.value })}
                      placeholder="291"
                    />
                    <Input
                      aria-label={`Figure ${index + 1}: label`}
                      className="min-w-0 flex-1"
                      value={metric.label}
                      maxLength={STORY_LIMITS.metricLabel}
                      onChange={(e) => setMetric(index, { label: e.target.value })}
                      placeholder="researched keywords"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => set("metrics", draft.metrics.filter((_, i) => i !== index))}
                      aria-label={`Remove figure ${index + 1}`}
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={draft.metrics.length >= STORY_LIMITS.metrics}
                  onClick={() => set("metrics", [...draft.metrics, { value: "", label: "" }])}
                >
                  <Plus aria-hidden="true" />
                  Add a figure
                </Button>
                <p className="text-xs text-muted-foreground">Real numbers only, in a row under the title: up to {STORY_LIMITS.metrics}.</p>
              </div>
              <div className="space-y-1.5">
                <Label>The story</Label>
                <RichTextEditor value={draft.bodyHtml} onChange={(bodyHtml) => setDraft((current) => ({ ...current, bodyHtml }))} ariaLabel="The story" />
                <p className="text-xs text-muted-foreground">Sections with headings (H2, H3) and paragraphs. The page adds the title, summary, figures and the invitation to try RepGet.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="story-discover">Discover profile (optional)</Label>
                <Input id="story-discover" value={draft.discoverSlug} onChange={(e) => set("discoverSlug", e.target.value)} placeholder="dumitru-culiuc" />
                <p className="text-xs text-muted-foreground">Its address after /discover/: the page links to it.</p>
              </div>
            </div>
          </AdminSection>
        </div>

        <div className="min-w-0 space-y-6">
          <AdminSection id="story-publish" title="Publishing">
            <label className="flex items-start justify-between gap-4">
              <span>
                <span className="block text-sm font-medium">Published</span>
                <span className="block text-xs text-muted-foreground">After Image Studio, on the homepage, /success-stories and /discover, and at its own address.</span>
              </span>
              <Switch checked={draft.published} onCheckedChange={(value) => set("published", value)} aria-label="Published" />
            </label>
          </AdminSection>

          <AdminSection id="story-seo" title="Search">
            <div className="space-y-5">
              <div className="space-y-1.5">
                <div className="flex items-baseline justify-between gap-3">
                  <Label htmlFor="story-seo-title">SEO title</Label>
                  <Counter value={draft.seoTitle} max={STORY_LIMITS.seoTitle} />
                </div>
                <Input id="story-seo-title" value={draft.seoTitle} maxLength={STORY_LIMITS.seoTitle} onChange={(e) => set("seoTitle", e.target.value)} placeholder={draft.title} />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-baseline justify-between gap-3">
                  <Label htmlFor="story-seo-description">SEO description</Label>
                  <Counter value={draft.seoDescription} max={STORY_LIMITS.seoDescription} />
                </div>
                <textarea
                  id="story-seo-description"
                  rows={3}
                  maxLength={STORY_LIMITS.seoDescription}
                  className={TEXTAREA}
                  value={draft.seoDescription}
                  onChange={(e) => set("seoDescription", e.target.value)}
                  placeholder={draft.summary}
                />
                <p className="text-xs text-muted-foreground">Empty: the title and the summary.</p>
              </div>
            </div>
          </AdminSection>
        </div>
      </div>
    </AdminPage>
  );
}
