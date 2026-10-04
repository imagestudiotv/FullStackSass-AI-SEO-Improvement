"use client";

import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  ExternalLink,
  Eye,
  Loader2,
  Lock,
  Pencil,
  Plus,
  RotateCw,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";

import { BlogArticle } from "@/components/blog-article";
import { RichTextEditor } from "@/components/rich-text-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  deleteBlogPost,
  saveBlogPost,
  uploadBlogImage,
  type AdminBlogPost,
  type BlogPostInput,
} from "@/lib/admin/blog";
import { previewHtml } from "@/lib/articles/use-draft";
import {
  blogSlug,
  FAQ_ANSWER_LIMIT,
  hasText,
  readingMinutes,
  type BlogCategoryInfo,
  type BlogPost,
} from "@/lib/blog/shared";
import { formatDate, formatNumber } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";

import { AdminFacts, AdminPage, AdminPageHeader, AdminSection } from "../_ui/page";
import { AdminStatus } from "../_ui/status";
import { useUnsavedChanges } from "../_ui/use-unsaved-changes";
import { ConfirmDialog } from "./confirm-dialog";
import { postStatus } from "./post-status";

const TEXTAREA =
  "flex w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-2 text-base outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30";

/**
 * The server's limits (lib/admin/blog.ts, clean()). Mirrored as maxLength so
 * nothing is cut off silently on save; the server still enforces them. A FAQ
 * answer's (FAQ_ANSWER_LIMIT) is HTML, which no maxLength can hold to: FaqRows
 * warns past it instead.
 */
const LIMITS = { title: 200, description: 300, author: 100, shortAnswer: 1000, question: 300, sourceLabel: 200, rows: 30 };
/** What search results show of a description; longer is saved but cut off there. */
const DESCRIPTION_TARGET = 160;

/** A version conflict (saveBlogPost / deleteBlogPost): someone else saved since this copy was opened. */
const CONFLICT = /changed after you opened it/i;
/** Shown when a server action throws instead of answering (expired session, database or network error). */
const UNEXPECTED =
  "The server did not finish this - the connection or the server failed. Your edits are still here. Try again; if it keeps failing, check the server logs.";

type Action = "draft" | "publish" | "save" | "unpublish" | "delete";
type Confirm = "publish" | "unpublish" | "delete" | "discard";
type Failure = { action: Action; message: string; conflict: boolean };

const RUNNING: Record<Action, string> = {
  draft: "Saving draft…",
  publish: "Publishing…",
  save: "Saving…",
  unpublish: "Unpublishing…",
  delete: "Deleting…",
};
const FAILED: Record<Action, string> = {
  draft: "Not saved",
  publish: "Not published",
  save: "Not saved",
  unpublish: "Not unpublished",
  delete: "Not deleted",
};
const DONE: Record<Exclude<Action, "delete">, string> = {
  draft: "Draft saved",
  publish: "Published - the post is live on the blog",
  save: "Saved - the live post is updated",
  unpublish: "Unpublished - the post is a draft again",
};

const isoDay = (date: Date) => date.toISOString().slice(0, 10);
const day = (date: Date) => formatDate(date, "en", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const when = (date: Date) =>
  `${formatDate(date, "en", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" })} UTC`;

function fromPost(post: AdminBlogPost | null, firstCategory: string): BlogPostInput {
  return {
    title: post?.title ?? "",
    slug: post?.slug ?? "",
    description: post?.description ?? "",
    category: post?.category ?? firstCategory,
    author: post?.author ?? "RepGet team",
    shortAnswer: post?.shortAnswer ?? "",
    bodyHtml: post?.bodyHtml ?? "",
    faqs: post?.faqs ?? [],
    sources: post?.sources ?? [],
  };
}

/**
 * Writing one blog post: the content in the main column (title, short
 * answer, the text in the same editor articles use, FAQs and sources), and
 * an inspector beside it for how the post is published - status, address,
 * category, author, the search description, and unpublishing or deleting.
 * The Preview tab shows the post exactly as the blog renders it (the shared
 * BlogArticle), unsaved changes included.
 *
 * Buttons follow the post's state: a draft is saved or published; a
 * published post's changes are saved straight to the live post, or it is
 * unpublished. Each save carries the version it started from, so a second
 * administrator's older copy cannot overwrite the first's work. The bar says
 * at all times whether the copy on screen is saved, being saved, or failed.
 */
export function BlogPostEditor({
  post,
  categories,
}: {
  post: AdminBlogPost | null;
  /** The blog's categories (Admin -> Blog), in their order. */
  categories: BlogCategoryInfo[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const firstCategory = categories[0]?.name ?? "";
  const [draft, setDraft] = useState<BlogPostInput>(() => fromPost(post, firstCategory));
  const [saved, setSaved] = useState<BlogPostInput>(() => fromPost(post, firstCategory));
  const [version, setVersion] = useState(post?.version ?? 0);
  const [status, setStatus] = useState(post?.status ?? "draft");
  // The address is permanent once the post has been published, even if it is unpublished later.
  const [locked, setLocked] = useState(Boolean(post?.publishedAt));
  /** Which action is running, so its own button shows the spinner. */
  const [running, setRunning] = useState<Action | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [confirming, setConfirming] = useState<Confirm | null>(null);
  /** Set when the operator chose to throw their edits away and load the stored post. */
  const [discarding, setDiscarding] = useState(false);

  const live = status === "published";
  const unsaved = JSON.stringify(draft) !== JSON.stringify(saved);
  const slug = blogSlug(draft.slug.trim() || draft.title);
  /** A new post's first save: it moves to its own page when done, so typing meanwhile would be lost. */
  const creating = pending && !post;
  const categoryMissing = draft.category !== "" && !categories.some((category) => category.name === draft.category);

  // Leaving with unsaved changes asks first: reload, closing the tab, and in-app links.
  useUnsavedChanges(unsaved && !discarding);

  useEffect(() => {
    // Runs after the guard above has been removed, so the reload does not ask again.
    if (discarding) window.location.reload();
  }, [discarding]);

  function set<K extends keyof BlogPostInput>(key: K, value: BlogPostInput[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function fail(action: Action, message: string) {
    toast.error(message);
    setFailure({ action, message, conflict: CONFLICT.test(message) });
    setConfirming(null);
  }

  function save(action: Exclude<Action, "delete">) {
    const nextStatus = action === "publish" || action === "save" ? "published" : "draft";
    const sent = draft;
    setRunning(action);
    setFailure(null);
    start(async () => {
      let result: Awaited<ReturnType<typeof saveBlogPost>>;
      try {
        result = await saveBlogPost({ id: post?.id ?? null, expectedVersion: version, status: nextStatus, post: sent });
      } catch (error) {
        console.error("[admin/blog] saving the post failed", error);
        fail(action, UNEXPECTED);
        return;
      }
      if (!result.ok) {
        fail(action, result.error);
        return;
      }
      setConfirming(null);
      toast.success(DONE[action]);
      if (!post) {
        // The post exists now: continue on its own page.
        router.replace(`/admin/blog/${result.data.id}`);
        return;
      }
      // The address as stored (made from the title when the field was left empty).
      const stored = { ...sent, slug: result.data.slug };
      setSaved(stored);
      setDraft((current) => (current === sent ? stored : { ...current, slug: result.data.slug }));
      setVersion(result.data.version);
      setStatus(result.data.status);
      if (result.data.status === "published") setLocked(true);
      router.refresh();
    });
  }

  function remove() {
    if (!post) return;
    setRunning("delete");
    setFailure(null);
    start(async () => {
      let result: Awaited<ReturnType<typeof deleteBlogPost>>;
      try {
        result = await deleteBlogPost({ id: post.id, expectedVersion: version });
      } catch (error) {
        console.error("[admin/blog] deleting the post failed", error);
        fail("delete", UNEXPECTED);
        return;
      }
      if (!result.ok) {
        fail("delete", result.error);
        return;
      }
      setConfirming(null);
      toast.success("Post deleted");
      router.replace("/admin/blog");
    });
  }

  async function uploadImage(file: File): Promise<string | null> {
    const form = new FormData();
    form.set("file", file);
    try {
      const result = await uploadBlogImage(form);
      if (!result.ok) {
        toast.error(result.error);
        return null;
      }
      return result.data.url;
    } catch (error) {
      // A thrown upload used to surface as an unhandled rejection (paste/drop) or the error page (picker).
      console.error("[admin/blog] image upload failed", error);
      toast.error("The image could not be uploaded. Try again; if it keeps failing, check the server logs.");
      return null;
    }
  }

  /** The post as the blog would render it now, from the working copy. */
  const preview: BlogPost = {
    slug: slug || "untitled",
    title: draft.title.trim() || "Untitled post",
    description: draft.description,
    category: draft.category,
    categorySlug: categories.find((category) => category.name === draft.category)?.slug ?? blogSlug(draft.category),
    publishedAt: (post?.publishedAt ?? new Date()).toISOString().slice(0, 10),
    // As the public page shows it (lib/blog/posts.ts): only a revision on a later day reads as an update.
    updatedAt:
      post?.revisedAt && post.publishedAt && isoDay(post.revisedAt) > isoDay(post.publishedAt)
        ? isoDay(post.revisedAt)
        : undefined,
    author: draft.author.trim() || "RepGet team",
    readingMinutes: 0,
    shortAnswer: draft.shortAnswer.trim() || undefined,
    faqs: draft.faqs
      .filter((faq) => faq.question.trim() && hasText(faq.answer))
      .map((faq) => ({ question: faq.question.trim(), answer: previewHtml(faq.answer) })),
    sources: draft.sources.filter((source) => /^https?:\/\//i.test(source.url.trim())).map((source) => ({
      label: source.label.trim() || source.url.trim(),
      url: source.url.trim(),
    })),
    body: previewHtml(draft.bodyHtml),
  };
  preview.readingMinutes = readingMinutes(preview);

  const badge = postStatus(status, locked);
  const address = locked ? saved.slug : slug;

  return (
    <AdminPage width="default">
      <AdminPageHeader
        back={{ href: "/admin/blog", label: "All posts" }}
        title={post ? saved.title || "Untitled post" : "New post"}
        description={live ? "Live on the blog. Saved changes go live at once." : "Not on the blog. Only administrators can see it."}
        meta={<AdminStatus tone={badge.tone} label={badge.label} icon={badge.icon} title={badge.title} />}
      />

      <Tabs defaultValue="edit" className="flex-col gap-4">
        {/* The action bar: which view, whether the copy on screen is saved, and the publishing buttons. Sticks under the top bar. */}
        <div className="z-20 border-b bg-admin-canvas py-2 md:sticky md:top-16 md:flex md:h-14 md:items-center md:py-0">
          <div className="flex w-full flex-col gap-2 md:flex-row md:items-center md:justify-between md:gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <TabsList className="shrink-0">
                <TabsTrigger value="edit" className="px-2.5">
                  <Pencil aria-hidden="true" />
                  Edit
                </TabsTrigger>
                <TabsTrigger value="preview" className="px-2.5">
                  <Eye aria-hidden="true" />
                  Preview
                </TabsTrigger>
              </TabsList>
              <SaveState pending={pending} running={running} creating={creating} failure={failure} unsaved={unsaved} isNew={!post} />
            </div>

            <div className="flex flex-wrap items-center gap-2 md:shrink-0 md:flex-nowrap">
              {live ? (
                <>
                  <Button variant="ghost" asChild className="text-muted-foreground hover:text-foreground">
                    <a href={`/blog/${saved.slug || slug}`} target="_blank" rel="noopener noreferrer">
                      View on the blog
                      <ExternalLink aria-hidden="true" />
                      <span className="sr-only">(opens in a new tab)</span>
                    </a>
                  </Button>
                  <Button type="button" size="lg" disabled={pending || discarding || !unsaved} onClick={() => save("save")}>
                    {pending && running === "save" ? <Spinner /> : null}
                    Save changes
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    disabled={pending || discarding || (!unsaved && Boolean(post))}
                    onClick={() => save("draft")}
                  >
                    {pending && running === "draft" ? <Spinner /> : null}
                    Save draft
                  </Button>
                  <Button type="button" size="lg" disabled={pending || discarding} onClick={() => setConfirming("publish")}>
                    {pending && running === "publish" ? <Spinner /> : null}
                    Publish
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        {failure ? (
          <FailureNotice
            failure={failure}
            postId={post?.id ?? null}
            onDiscard={() => (unsaved ? setConfirming("discard") : setDiscarding(true))}
            onDismiss={() => setFailure(null)}
          />
        ) : null}

        <div
          className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]"
          inert={creating}
          aria-busy={creating || undefined}
        >
          <div className="min-w-0">
            {/* Kept mounted while previewing, so the text editor keeps its undo history and HTML view. */}
            <TabsContent value="edit" forceMount className="space-y-6 data-[state=inactive]:hidden">
              <AdminSection id="post-content" title="Content" description="The title, and the short answer shown above the text.">
                <div className="space-y-5">
                  <Field
                    id="blog-title"
                    label="Title"
                    counter={draft.title.length > LIMITS.title - 40 ? <Counter value={draft.title.length} limit={LIMITS.title} /> : null}
                  >
                    <Input
                      id="blog-title"
                      value={draft.title}
                      maxLength={LIMITS.title}
                      onChange={(e) => set("title", e.target.value)}
                      className="h-10 text-base font-medium md:text-base"
                    />
                  </Field>

                  <Field
                    id="blog-short-answer"
                    label="Short answer (optional)"
                    hint="One plain paragraph shown above the article: the point, for readers who will not scroll."
                    counter={draft.shortAnswer ? <Counter value={draft.shortAnswer.length} limit={LIMITS.shortAnswer} /> : null}
                  >
                    <textarea
                      id="blog-short-answer"
                      rows={3}
                      maxLength={LIMITS.shortAnswer}
                      className={TEXTAREA}
                      value={draft.shortAnswer}
                      onChange={(e) => set("shortAnswer", e.target.value)}
                      aria-describedby="blog-short-answer-hint"
                    />
                  </Field>
                </div>
              </AdminSection>

              <AdminSection
                id="post-text"
                title="Text"
                description="Headings (H2) become the post's contents list. Links to RepGet's own pages stay normal links; links to other sites open in a new tab. Click a picture to replace it or edit its description (alt text)."
              >
                {/* The editor's own toolbar is sticky; park it under the admin top bar (and the action bar from md up). */}
                <div className="[&_.sticky]:top-16 [&_.sticky]:z-10 md:[&_.sticky]:top-30">
                  <RichTextEditor
                    value={draft.bodyHtml}
                    onChange={(bodyHtml) => setDraft((current) => ({ ...current, bodyHtml }))}
                    onUploadImage={uploadImage}
                    ariaLabel="Post text"
                  />
                </div>
              </AdminSection>

              <AdminSection
                id="post-faq"
                title="FAQ"
                description="Optional. Questions shown after the post, and given to search engines as FAQ data."
                actions={<RowCount count={draft.faqs.length} noun="question" />}
              >
                <FaqRows faqs={draft.faqs} onChange={(faqs) => set("faqs", faqs)} />
              </AdminSection>

              <AdminSection
                id="post-sources"
                title="Sources"
                description="Optional. Where the post's claims come from, listed at the end."
                actions={<RowCount count={draft.sources.length} noun="source" />}
              >
                <SourceRows sources={draft.sources} onChange={(sources) => set("sources", sources)} />
              </AdminSection>
            </TabsContent>

            <TabsContent value="preview">
              <AdminSection id="post-preview" title="Preview" description="The post as the blog shows it, from the copy on screen.">
                {unsaved ? (
                  <p role="status" className="mb-2 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning-soft px-3 py-2 text-sm">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
                    This preview includes changes you have not saved yet.
                  </p>
                ) : null}
                {/* The post exactly as the blog renders it (components/blog-article.tsx). */}
                <div className="mx-auto max-w-3xl pb-4">
                  <BlogArticle post={preview} />
                </div>
              </AdminSection>
            </TabsContent>
          </div>

          <aside aria-label="Post settings" className="grid min-w-0 items-start gap-6 md:grid-cols-2 xl:grid-cols-1">
            <AdminSection id="post-publishing" title="Publishing">
              <AdminFacts
                className="sm:grid-cols-[minmax(96px,auto)_1fr]"
                items={[
                  { label: "Status", value: <AdminStatus tone={badge.tone} label={badge.label} icon={badge.icon} title={badge.title} /> },
                  {
                    label: "Address",
                    value: (
                      <span className="inline-flex max-w-full items-start gap-1 font-mono text-xs">
                        {locked ? (
                          <>
                            <Lock className="mt-0.5 size-3 shrink-0 text-muted-foreground" aria-hidden="true" />
                            <span className="sr-only">Fixed: </span>
                          </>
                        ) : null}
                        <span className="wrap-anywhere">/blog/{address || "…"}</span>
                      </span>
                    ),
                  },
                  {
                    label: "First published",
                    value: post?.publishedAt ? <time dateTime={post.publishedAt.toISOString()}>{day(post.publishedAt)}</time> : "Not yet",
                  },
                  ...(post?.revisedAt
                    ? [{ label: "Revised", value: <time dateTime={post.revisedAt.toISOString()}>{day(post.revisedAt)}</time> }]
                    : []),
                  {
                    label: "Last saved",
                    value: post ? (
                      <span className="block">
                        <time dateTime={post.updatedAt.toISOString()} className="tabular-nums">
                          {when(post.updatedAt)}
                        </time>
                        {post.updatedBy ? <span className="block text-xs text-muted-foreground wrap-anywhere">by {post.updatedBy}</span> : null}
                      </span>
                    ) : (
                      "Not saved yet"
                    ),
                  },
                ]}
              />
            </AdminSection>

            <AdminSection id="post-details" title="Address and category">
              <div className="space-y-5">
                <Field
                  id="blog-slug"
                  label="Address"
                  hint={
                    locked ? (
                      <span className="inline-flex items-start gap-1">
                        <Lock className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
                        <span className="wrap-anywhere">
                          /blog/{saved.slug} - fixed now that the post has been published: changing it would break every link to it.
                        </span>
                      </span>
                    ) : (
                      <span className="wrap-anywhere">
                        /blog/{slug || "…"} - leave it empty to make it from the title. It cannot change after publishing.
                      </span>
                    )
                  }
                >
                  <div className="relative">
                    <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 font-mono text-xs text-muted-foreground" aria-hidden="true">
                      /blog/
                    </span>
                    <Input
                      id="blog-slug"
                      value={draft.slug}
                      placeholder={blogSlug(draft.title) || "made-from-the-title"}
                      onChange={(e) => set("slug", e.target.value)}
                      disabled={locked}
                      aria-describedby="blog-slug-hint"
                      className="pl-14 font-mono text-xs md:text-xs"
                    />
                  </div>
                </Field>

                <Field
                  id="blog-category"
                  label="Category"
                  hint={
                    categories.length === 0 ? (
                      <span className="text-warning">
                        There are no categories yet, and a post needs one to be saved.{" "}
                        <Link href="/admin/blog#categories" className="font-medium underline underline-offset-4">
                          Add a category
                        </Link>
                      </span>
                    ) : categoryMissing ? (
                      <span className="text-warning wrap-anywhere">
                        “{draft.category}” was renamed or deleted after this post was opened. Choose a category before saving.
                      </span>
                    ) : (
                      "The section of the blog the post appears in."
                    )
                  }
                >
                  <Select value={draft.category} onValueChange={(value) => set("category", value)} disabled={categories.length === 0 && !draft.category}>
                    <SelectTrigger id="blog-category" className="w-full" aria-describedby="blog-category-hint">
                      <SelectValue placeholder={categories.length === 0 ? "No categories yet" : "Choose a category"} />
                    </SelectTrigger>
                    <SelectContent>
                      {categoryMissing ? <SelectItem value={draft.category}>{draft.category} (no longer exists)</SelectItem> : null}
                      {categories.map((category) => (
                        <SelectItem key={category.name} value={category.name}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field id="blog-author" label="Author" hint="Shown as the byline. Empty means RepGet team.">
                  <Input
                    id="blog-author"
                    value={draft.author}
                    maxLength={LIMITS.author}
                    onChange={(e) => set("author", e.target.value)}
                    aria-describedby="blog-author-hint"
                  />
                </Field>
              </div>
            </AdminSection>

            <AdminSection id="post-search" title="Search and cards">
              <Field
                id="blog-description"
                label="Description"
                counter={<Counter value={draft.description.length} limit={DESCRIPTION_TARGET} />}
                hint={
                  draft.description.length > DESCRIPTION_TARGET
                    ? `Longer than search results show (about ${DESCRIPTION_TARGET} characters); up to ${LIMITS.description} are saved. Needed to publish.`
                    : "Shown under the title in search results and on the blog's cards. Needed to publish."
                }
              >
                <textarea
                  id="blog-description"
                  rows={4}
                  maxLength={LIMITS.description}
                  className={TEXTAREA}
                  value={draft.description}
                  onChange={(e) => set("description", e.target.value)}
                  aria-describedby="blog-description-hint"
                />
              </Field>
            </AdminSection>

            {post ? (
              <AdminSection
                id="post-danger"
                tone="danger"
                title={live ? "Unpublish" : "Delete post"}
                description={
                  live
                    ? `Takes the post off the blog until you publish it again. Its address stays /blog/${saved.slug}. A published post must be unpublished before it can be deleted.`
                    : "Deletes the post for good. This cannot be undone."
                }
              >
                {live ? (
                  <Button type="button" variant="outline" disabled={pending || discarding} onClick={() => setConfirming("unpublish")}>
                    {pending && running === "unpublish" ? <Spinner /> : null}
                    Unpublish
                  </Button>
                ) : (
                  <Button type="button" variant="destructive" disabled={pending || discarding} onClick={() => setConfirming("delete")}>
                    {pending && running === "delete" ? <Spinner /> : <Trash2 aria-hidden="true" />}
                    Delete post
                  </Button>
                )}
              </AdminSection>
            ) : null}
          </aside>
        </div>
      </Tabs>

      <ConfirmDialog
        open={confirming === "publish"}
        onOpenChange={(open) => setConfirming(open ? "publish" : null)}
        title="Publish this post?"
        description={`It goes live on the blog at once, at /blog/${address || "…"}, and that address cannot change afterwards.`}
        confirmLabel="Publish"
        pending={pending && running === "publish"}
        onConfirm={() => save("publish")}
      />
      <ConfirmDialog
        open={confirming === "unpublish"}
        onOpenChange={(open) => setConfirming(open ? "unpublish" : null)}
        title="Unpublish this post?"
        description={`It disappears from the blog until you publish it again.${unsaved ? " Your unsaved changes are saved with it, as part of the draft." : ""}`}
        confirmLabel="Unpublish"
        tone="danger"
        pending={pending && running === "unpublish"}
        onConfirm={() => save("unpublish")}
      />
      <ConfirmDialog
        open={confirming === "delete"}
        onOpenChange={(open) => setConfirming(open ? "delete" : null)}
        title="Delete this post?"
        description={`This cannot be undone.${unsaved ? " Your unsaved changes are discarded too." : ""}`}
        confirmLabel="Delete post"
        tone="danger"
        pending={pending && running === "delete"}
        onConfirm={remove}
      />
      <ConfirmDialog
        open={confirming === "discard"}
        onOpenChange={(open) => setConfirming(open ? "discard" : null)}
        title="Discard your changes?"
        description="Your unsaved changes are lost, and the latest saved version of the post is loaded."
        confirmLabel="Discard and reload"
        tone="danger"
        onConfirm={() => {
          setConfirming(null);
          setDiscarding(true);
        }}
      />
    </AdminPage>
  );
}

function Spinner() {
  return <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />;
}

/** Whether the copy on screen is saved. Never "saved" before the server has said so. */
function SaveState({
  pending,
  running,
  creating,
  failure,
  unsaved,
  isNew,
}: {
  pending: boolean;
  running: Action | null;
  creating: boolean;
  failure: Failure | null;
  unsaved: boolean;
  isNew: boolean;
}) {
  let content: ReactNode;
  if (pending && running) {
    content = (
      <>
        <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground motion-reduce:animate-none" aria-hidden="true" />
        <span className="truncate">{creating ? "Creating the post…" : RUNNING[running]}</span>
      </>
    );
  } else if (failure) {
    content = (
      <>
        <XCircle className="size-4 shrink-0 text-danger" aria-hidden="true" />
        <span className="truncate font-medium text-danger">{FAILED[failure.action]}</span>
      </>
    );
  } else if (unsaved) {
    content = (
      <>
        <span className="size-2 shrink-0 rounded-full bg-warning" aria-hidden="true" />
        <span className="truncate font-medium">Unsaved changes</span>
      </>
    );
  } else if (isNew) {
    content = (
      <>
        <CircleDashed className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="truncate text-muted-foreground">Not saved yet</span>
      </>
    );
  } else {
    content = (
      <>
        <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden="true" />
        <span className="truncate text-muted-foreground">All changes saved</span>
      </>
    );
  }
  return (
    <p role="status" aria-live="polite" className="flex min-w-0 items-center gap-1.5 text-sm">
      {content}
    </p>
  );
}

/**
 * Why the last action failed, kept on screen (the toast goes away). A version
 * conflict gets a way forward: compare with the stored post in a new tab, or
 * drop these edits and load it.
 */
function FailureNotice({
  failure,
  postId,
  onDiscard,
  onDismiss,
}: {
  failure: Failure;
  postId: string | null;
  onDiscard: () => void;
  onDismiss: () => void;
}) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-xl border border-danger/25 bg-danger-soft px-4 py-3 text-sm">
      <XCircle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="font-medium text-foreground">{FAILED[failure.action]}</p>
        <p className="text-foreground/80 wrap-anywhere">{failure.message}</p>
        {failure.conflict && postId ? (
          <>
            <p className="text-foreground/80">
              Your edits are still on this screen. Open the latest version to compare, then load it and make your change again.
            </p>
            <div className="flex flex-wrap gap-2 pt-1.5">
              <Button variant="outline" size="sm" asChild>
                <a href={`/admin/blog/${postId}`} target="_blank" rel="noopener noreferrer">
                  Open the latest version
                  <ExternalLink aria-hidden="true" />
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={onDiscard}>
                <RotateCw aria-hidden="true" />
                Discard my changes and reload
              </Button>
            </div>
          </>
        ) : null}
      </div>
      <Button type="button" variant="ghost" size="icon-sm" onClick={onDismiss} aria-label="Dismiss this message" className="-mr-1 -mt-0.5 shrink-0">
        <X aria-hidden="true" />
      </Button>
    </div>
  );
}

/** A labelled field: label (and counter) above, the control, then one line of help (id `${id}-hint`). */
function Field({
  id,
  label,
  hint,
  counter,
  children,
}: {
  id: string;
  label: string;
  hint?: ReactNode;
  counter?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        {counter}
      </div>
      {children}
      {hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function Counter({ value, limit }: { value: number; limit: number }) {
  return (
    <span className={cn("text-xs tabular-nums", value > limit ? "font-medium text-warning" : "text-muted-foreground")}>
      {formatNumber(value, "en")} / {formatNumber(limit, "en")}
    </span>
  );
}

function RowCount({ count, noun }: { count: number; noun: string }) {
  return (
    <span className="text-sm tabular-nums text-muted-foreground">
      {count === 0 ? "None" : `${formatNumber(count, "en")} ${count === 1 ? noun : `${noun}s`}`}
    </span>
  );
}

/**
 * FAQ rows: a question, and an answer in the text editor's compact form.
 *
 * Each row has a key of its own, kept here beside the rows rather than in
 * them, so it never reaches the saved post. The array index was the key while
 * answers were textareas; an answer is an editor now, with its own undo
 * history, and with index keys removing question 2 handed its editor to
 * question 3's answer - Undo there brought the removed answer back, under the
 * wrong question.
 */
function FaqRows({ faqs, onChange }: { faqs: BlogPostInput["faqs"]; onChange: (faqs: BlogPostInput["faqs"]) => void }) {
  const [rows, setRows] = useState(() => ({ keys: faqs.map((_, index) => index), next: faqs.length }));
  const full = faqs.length >= LIMITS.rows;
  // Rows come and go only through the buttons below; were anything else to change their number, the index is the fallback.
  const keyOf = (index: number) => (rows.keys.length === faqs.length ? `row-${rows.keys[index]}` : `index-${index}`);

  function add() {
    onChange([...faqs, { question: "", answer: "" }]);
    setRows(({ keys, next }) => ({ keys: [...keys, next], next: next + 1 }));
  }

  function remove(index: number) {
    onChange(faqs.filter((_, i) => i !== index));
    setRows(({ keys, next }) => ({ keys: keys.filter((_, i) => i !== index), next }));
  }

  return (
    <div className="space-y-4">
      {faqs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No questions. Add one if readers keep asking the same thing.</p>
      ) : (
        <ol className="divide-y">
          {faqs.map((faq, index) => {
            // An emptied editor still holds "<p></p>": what counts is whether the answer has words.
            const half = Boolean(faq.question.trim()) !== hasText(faq.answer);
            /*
              Counted as the server counts it: the answer as it would be
              stored. The editor writes <br> where the sanitiser keeps
              <br />, so the editor's own string was short of what was stored,
              and an answer let through at the limit came back over it. Without
              the site's hosts, previewHtml marks a link to the site's own page
              as external (longer), so this can only warn early, never late.
            */
            const answerLength = previewHtml(faq.answer).length;
            const tooLong = answerLength > FAQ_ANSWER_LIMIT;
            return (
              <li key={keyOf(index)} className="space-y-2 py-4 first:pt-0">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor={`faq-question-${index}`} className="text-muted-foreground">
                    Question {index + 1}
                  </Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove question ${index + 1}`}
                    onClick={() => remove(index)}
                    className="text-muted-foreground hover:text-danger"
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                </div>
                <Input
                  id={`faq-question-${index}`}
                  placeholder="Question"
                  value={faq.question}
                  maxLength={LIMITS.question}
                  onChange={(e) => onChange(faqs.map((f, i) => (i === index ? { ...f, question: e.target.value } : f)))}
                />
                {/*
                  Seen, not read out: the editor already carries the name
                  "Answer N", and a label element cannot point at a
                  contenteditable the way it points at the question's input.
                */}
                <p className="pt-2 text-sm leading-none font-medium text-muted-foreground" aria-hidden="true">
                  Answer {index + 1}
                </p>
                <RichTextEditor
                  toolbar="compact"
                  ariaLabel={`Answer ${index + 1}`}
                  value={faq.answer}
                  onChange={(answer) => onChange(faqs.map((f, i) => (i === index ? { ...f, answer } : f)))}
                />
                {half ? <p className="text-xs text-warning">Needs both a question and an answer - or remove it.</p> : null}
                {/*
                  The answer is HTML, so there is no maxLength to stop typing
                  at the limit: this says so before the server refuses the
                  save (lib/admin/blog.ts), rather than the end being cut off.
                */}
                {tooLong ? (
                  <p className="text-xs text-warning">
                    Too long to save: {formatNumber(answerLength, "en")} of {formatNumber(FAQ_ANSWER_LIMIT, "en")} characters,
                    formatting included. Shorten it or split it into two questions.
                  </p>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" disabled={full} onClick={add}>
          <Plus aria-hidden="true" />
          Add question
        </Button>
        {full ? <p className="text-xs text-muted-foreground">A post keeps up to {LIMITS.rows} questions.</p> : null}
      </div>
    </div>
  );
}

function SourceRows({
  sources,
  onChange,
}: {
  sources: BlogPostInput["sources"];
  onChange: (sources: BlogPostInput["sources"]) => void;
}) {
  const full = sources.length >= LIMITS.rows;
  return (
    <div className="space-y-4">
      {sources.length === 0 ? (
        <p className="text-sm text-muted-foreground">No sources. Add the pages that back the post&apos;s claims.</p>
      ) : (
        <ol className="space-y-3">
          {sources.map((source, index) => {
            const filled = Boolean(source.label.trim() || source.url.trim());
            const badUrl = filled && !/^https?:\/\/\S/i.test(source.url.trim());
            return (
              <li key={index} className="space-y-1">
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto]">
                  <Input
                    aria-label={`Source ${index + 1} name`}
                    placeholder="Name, e.g. Google Search Central"
                    value={source.label}
                    maxLength={LIMITS.sourceLabel}
                    onChange={(e) => onChange(sources.map((s, i) => (i === index ? { ...s, label: e.target.value } : s)))}
                  />
                  <Input
                    aria-label={`Source ${index + 1} address`}
                    placeholder="https://…"
                    value={source.url}
                    inputMode="url"
                    aria-invalid={badUrl || undefined}
                    onChange={(e) => onChange(sources.map((s, i) => (i === index ? { ...s, url: e.target.value } : s)))}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove source ${index + 1}`}
                    onClick={() => onChange(sources.filter((_, i) => i !== index))}
                    className="justify-self-end text-muted-foreground hover:text-danger"
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                </div>
                {badUrl ? <p className="text-xs text-warning">Needs a full address starting with https://</p> : null}
              </li>
            );
          })}
        </ol>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" disabled={full} onClick={() => onChange([...sources, { label: "", url: "" }])}>
          <Plus aria-hidden="true" />
          Add source
        </Button>
        {full ? <p className="text-xs text-muted-foreground">A post keeps up to {LIMITS.rows} sources.</p> : null}
      </div>
    </div>
  );
}
