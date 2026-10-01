"use client";

import { ArrowLeft, ExternalLink, Eye, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { BlogArticle } from "@/components/blog-article";
import { RichTextEditor } from "@/components/rich-text-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageShell } from "@/components/ui/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  deleteBlogPost,
  saveBlogPost,
  uploadBlogImage,
  type AdminBlogPost,
  type BlogPostInput,
} from "@/lib/admin/blog";
import { previewHtml } from "@/lib/articles/use-draft";
import { blogSlug, readingMinutes, type BlogCategoryInfo, type BlogPost } from "@/lib/blog/shared";

const TEXTAREA =
  "flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

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
 * Writing one blog post: its fields, the text in the same editor articles
 * use, FAQs and sources - and a Preview tab showing the post exactly as the
 * blog renders it (the shared BlogArticle), unsaved changes included.
 *
 * Buttons follow the post's state: a draft is saved or published; a
 * published post's changes are saved straight to the live post, or it is
 * unpublished. Each save carries the version it started from, so a second
 * administrator's older copy cannot overwrite the first's work.
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

  const live = status === "published";
  const unsaved = JSON.stringify(draft) !== JSON.stringify(saved);
  const slug = blogSlug(draft.slug.trim() || draft.title);

  // Leaving with unsaved changes asks first, as a browser tab does for a form.
  useEffect(() => {
    if (!unsaved) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsaved]);

  function set<K extends keyof BlogPostInput>(key: K, value: BlogPostInput[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function save(nextStatus: "draft" | "published", done: string) {
    const sent = draft;
    start(async () => {
      const result = await saveBlogPost({ id: post?.id ?? null, expectedVersion: version, status: nextStatus, post: sent });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(done);
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
    if (!post || !window.confirm("Delete this post? This cannot be undone.")) return;
    start(async () => {
      const result = await deleteBlogPost({ id: post.id, expectedVersion: version });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Post deleted");
      router.replace("/admin/blog");
    });
  }

  async function uploadImage(file: File): Promise<string | null> {
    const form = new FormData();
    form.set("file", file);
    const result = await uploadBlogImage(form);
    if (!result.ok) {
      toast.error(result.error);
      return null;
    }
    return result.data.url;
  }

  /** The post as the blog would render it now, from the working copy. */
  const preview: BlogPost = {
    slug: slug || "untitled",
    title: draft.title.trim() || "Untitled post",
    description: draft.description,
    category: draft.category,
    categorySlug: categories.find((category) => category.name === draft.category)?.slug ?? blogSlug(draft.category),
    publishedAt: (post?.publishedAt ?? new Date()).toISOString().slice(0, 10),
    author: draft.author.trim() || "RepGet team",
    readingMinutes: 0,
    shortAnswer: draft.shortAnswer.trim() || undefined,
    faqs: draft.faqs
      .filter((faq) => faq.question.trim() && faq.answer.trim())
      .map((faq) => ({ question: faq.question.trim(), answer: previewHtml(faq.answer) })),
    sources: draft.sources.filter((source) => /^https?:\/\//i.test(source.url.trim())).map((source) => ({
      label: source.label.trim() || source.url.trim(),
      url: source.url.trim(),
    })),
    body: previewHtml(draft.bodyHtml),
  };
  preview.readingMinutes = readingMinutes(preview);

  return (
    <PageShell width="wide">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
          <Link href="/admin/blog">
            <ArrowLeft className="size-4" />
            All posts
          </Link>
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{post ? saved.title || "Untitled post" : "New post"}</h1>
          <Badge variant={live ? "default" : "secondary"}>{live ? "Published" : "Draft"}</Badge>
          {unsaved ? <span className="text-sm text-amber-600 dark:text-amber-400">Unsaved changes</span> : null}
        </div>
        <p className="text-sm text-muted-foreground">
          {live ? "Live on the blog. Saved changes go live at once." : "Not on the blog. Only administrators can see it."}
        </p>
      </div>

      <Tabs defaultValue="edit">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="edit">
              <Pencil className="size-4" />
              Edit
            </TabsTrigger>
            <TabsTrigger value="preview">
              <Eye className="size-4" />
              Preview
            </TabsTrigger>
          </TabsList>

          <div className="flex flex-wrap items-center gap-2">
            {live ? (
              <>
                <a
                  href={`/blog/${saved.slug || slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-9 items-center gap-1.5 px-2 text-sm text-muted-foreground hover:text-foreground"
                >
                  View on the blog
                  <ExternalLink className="size-3.5" aria-hidden="true" />
                </a>
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={() => {
                    if (window.confirm("Unpublish this post? It disappears from the blog until you publish it again.")) {
                      save("draft", "Unpublished - the post is a draft again");
                    }
                  }}
                >
                  Unpublish
                </Button>
                <Button type="button" disabled={pending || !unsaved} onClick={() => save("published", "Saved - the live post is updated")}>
                  {pending ? <Loader2 className="size-4 animate-spin" /> : null}
                  Save changes
                </Button>
              </>
            ) : (
              <>
                {post ? (
                  <Button type="button" variant="ghost" disabled={pending} onClick={remove}>
                    <Trash2 className="size-4" />
                    Delete
                  </Button>
                ) : null}
                <Button type="button" variant="outline" disabled={pending || (!unsaved && Boolean(post))} onClick={() => save("draft", "Draft saved")}>
                  Save draft
                </Button>
                <Button type="button" disabled={pending} onClick={() => save("published", "Published - the post is live on the blog")}>
                  {pending ? <Loader2 className="size-4 animate-spin" /> : null}
                  Publish
                </Button>
              </>
            )}
          </div>
        </div>

        <TabsContent value="edit" className="mt-4 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Post</CardTitle>
              <CardDescription>What search results, the blog&apos;s cards and the top of the post show.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="blog-title">Title</Label>
                <Input id="blog-title" value={draft.title} onChange={(e) => set("title", e.target.value)} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="blog-slug">Address</Label>
                <Input
                  id="blog-slug"
                  value={draft.slug}
                  placeholder={blogSlug(draft.title) || "made-from-the-title"}
                  onChange={(e) => set("slug", e.target.value)}
                  disabled={locked}
                />
                <p className="text-xs text-muted-foreground">
                  {locked
                    ? `/blog/${saved.slug} - fixed now that the post has been published: changing it would break every link to it.`
                    : `/blog/${slug || "…"} - leave it empty to make it from the title. It cannot change after publishing.`}
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="blog-category">Category</Label>
                  <select
                    id="blog-category"
                    className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                    value={draft.category}
                    onChange={(e) => set("category", e.target.value)}
                  >
                    {categories.map((category) => (
                      <option key={category.name} value={category.name}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="blog-author">Author</Label>
                  <Input id="blog-author" value={draft.author} onChange={(e) => set("author", e.target.value)} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="blog-description">
                  Description{" "}
                  <span className={draft.description.length > 160 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}>
                    ({draft.description.length}/160)
                  </span>
                </Label>
                <textarea
                  id="blog-description"
                  rows={2}
                  className={TEXTAREA}
                  value={draft.description}
                  onChange={(e) => set("description", e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Shown under the title in search results and on the blog&apos;s cards. Needed to publish.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="blog-short-answer">Short answer (optional)</Label>
                <textarea
                  id="blog-short-answer"
                  rows={3}
                  className={TEXTAREA}
                  value={draft.shortAnswer}
                  onChange={(e) => set("shortAnswer", e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  One plain paragraph shown above the article: the point, for readers who will not scroll.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-visible">
            <CardHeader>
              <CardTitle className="text-base">Text</CardTitle>
              <CardDescription>
                Headings (H2) become the post&apos;s contents list. Links to RepGet&apos;s own pages stay normal links;
                links to other sites open in a new tab.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RichTextEditor
                value={draft.bodyHtml}
                onChange={(bodyHtml) => setDraft((current) => ({ ...current, bodyHtml }))}
                onUploadImage={uploadImage}
                ariaLabel="Post text"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">FAQ (optional)</CardTitle>
              <CardDescription>Questions shown after the post, and given to search engines as FAQ data.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {draft.faqs.map((faq, index) => (
                <div key={index} className="space-y-2 rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <Input
                      aria-label={`Question ${index + 1}`}
                      placeholder="Question"
                      value={faq.question}
                      onChange={(e) => set("faqs", draft.faqs.map((f, i) => (i === index ? { ...f, question: e.target.value } : f)))}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={`Remove question ${index + 1}`}
                      onClick={() => set("faqs", draft.faqs.filter((_, i) => i !== index))}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                  <textarea
                    aria-label={`Answer ${index + 1}`}
                    placeholder="Answer (plain text; a link can be written as <a href=&quot;https://…&quot;>words</a>)"
                    rows={3}
                    className={TEXTAREA}
                    value={faq.answer}
                    onChange={(e) => set("faqs", draft.faqs.map((f, i) => (i === index ? { ...f, answer: e.target.value } : f)))}
                  />
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => set("faqs", [...draft.faqs, { question: "", answer: "" }])}>
                <Plus className="size-4" />
                Add question
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Sources (optional)</CardTitle>
              <CardDescription>Where the post&apos;s claims come from, listed at the end.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {draft.sources.map((source, index) => (
                <div key={index} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto]">
                  <Input
                    aria-label={`Source ${index + 1} name`}
                    placeholder="Name, e.g. Google Search Central"
                    value={source.label}
                    onChange={(e) => set("sources", draft.sources.map((s, i) => (i === index ? { ...s, label: e.target.value } : s)))}
                  />
                  <Input
                    aria-label={`Source ${index + 1} address`}
                    placeholder="https://…"
                    value={source.url}
                    onChange={(e) => set("sources", draft.sources.map((s, i) => (i === index ? { ...s, url: e.target.value } : s)))}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={`Remove source ${index + 1}`}
                    onClick={() => set("sources", draft.sources.filter((_, i) => i !== index))}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => set("sources", [...draft.sources, { label: "", url: "" }])}>
                <Plus className="size-4" />
                Add source
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preview" className="mt-4">
          <Card>
            <CardContent className="pt-2">
              {unsaved ? (
                <p role="status" className="mt-4 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
                  This preview includes changes you have not saved yet.
                </p>
              ) : null}
              {/* The post exactly as the blog renders it (components/blog-article.tsx). */}
              <div className="mx-auto max-w-3xl pb-6">
                <BlogArticle post={preview} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
