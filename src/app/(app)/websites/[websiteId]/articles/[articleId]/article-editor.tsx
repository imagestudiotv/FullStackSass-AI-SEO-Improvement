"use client";

import {
  ArrowLeft,
  ExternalLink,
  Eye,
  Loader2,
  Pencil,
  RefreshCw,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { explainGenerationError } from "@/lib/articles/explain";
import { explainPublishError } from "@/lib/publishing/explain";
import { RichTextEditor } from "@/components/rich-text-editor";
import {
  listReusableImages,
  uploadInlineImage,
} from "@/lib/articles/image-actions";
import { FeaturedImage } from "./featured-image";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageShell } from "@/components/ui/page-header";
import { Stat } from "@/components/ui/states";
import { articleStats } from "@/lib/articles/stats";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  regenerateArticle,
  updateArticle,
  type ArticleDetail,
} from "@/lib/articles/actions";
import { publishArticle, type PublishLogRow } from "@/lib/publishing/actions";
import type { Messages } from "@/lib/i18n/messages";

/**
 * The generation step, in the reader's language.
 *
 * A function taking the dictionary rather than a module-level map: the map
 * is built once at import time, before any locale is known, so it could only
 * ever hold English.
 */
function stepLabel(step: string, t: Messages["app"]["editor"]): string {
  if (step === "outline") return t.planningOutline;
  if (step === "body") return t.writingBody;
  return "";
}

export function ArticleEditor({
  websiteId,
  article,
  canPublish,
  destinationName,
  websiteDomain,
  publishLogs,
  t,
}: {
  websiteId: string;
  article: ArticleDetail;
  canPublish: boolean;
  /**
   * Where this article publishes, e.g. "Ghost". Null when nothing is
   * connected. Named rather than assumed: the product now publishes to four
   * different systems, and telling someone their article went to WordPress
   * when it went to Shopify is worse than saying nothing.
   */
  destinationName: string | null;
  /** Decides which links count as internal. */
  websiteDomain: string | null;
  publishLogs: PublishLogRow[];
  /** This screen's copy, already in the reader's language. */
  t: Messages["app"]["editor"];
}) {
  const router = useRouter();
  const bodyStats = articleStats(article.bodyHtml, {
    domain: websiteDomain,
    targetKeyword: article.targetKeyword,
  });

  /**
   * The featured image counts too. articleStats reads the body HTML, where the
   * illustration does not appear — it is a separate column, attached to the
   * post on publish — so an article with a picture still reported "Images 0".
   */
  const stats = {
    ...bodyStats,
    images: bodyStats.images + (article.imageUrl ? 1 : 0),
  };
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState(article.title);
  const [meta, setMeta] = useState(article.metaDescription ?? "");
  const [slug, setSlug] = useState(article.slug ?? "");
  const [body, setBody] = useState(article.bodyHtml ?? "");

  const working =
    article.status === "generating" || article.status === "queued";

  /**
   * Generation takes about a minute and writes to the database from a
   * background job, so the page has no way to know it finished. Polling while
   * work is in flight is the simplest correct answer; it stops as soon as the
   * status settles.
   */
  useEffect(() => {
    if (!working) return;
    const timer = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(timer);
  }, [working, router]);

  function handleSave() {
    startTransition(async () => {
      const result = await updateArticle(websiteId, article.id, {
        title,
        metaDescription: meta,
        slug,
        bodyHtml: body,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(t.saved);
      router.refresh();
    });
  }

  function handlePublish(status: "publish" | "draft") {
    startTransition(async () => {
      const result = await publishArticle(websiteId, article.id, status);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        status === "publish"
          ? `Publishing to ${destinationName ?? "your site"}…`
          : t.sendingDraft,
      );
      router.refresh();
    });
  }

  /**
   * Stores a pasted, dropped or chosen image and hands back its URL.
   *
   * Returns null on failure so the editor inserts nothing rather than a
   * broken image, and the toast explains why.
   */
  async function handleInlineUpload(file: File): Promise<string | null> {
    const body = new FormData();
    body.set("file", file);

    const result = await uploadInlineImage(websiteId, article.id, body);
    if (!result.ok) {
      toast.error(result.error);
      return null;
    }
    return result.data.url;
  }

  /**
   * Pictures this website has used before, for the insert panel.
   *
   * useCallback because the picker debounces on this function's identity: a
   * new one each render reset the timer on every render, so the first fetch
   * never fired and the panel stayed empty.
   */
  const handleListImages = useCallback(
    async (term: string) => {
      const result = await listReusableImages(websiteId, term);
      return result.ok ? result.data.images : [];
    },
    [websiteId],
  );

  function handleRegenerate() {
    startTransition(async () => {
      const result = await regenerateArticle(websiteId, article.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(t.rewriting);
      router.refresh();
    });
  }

  return (
    <PageShell>
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
          <Link href={`/websites/${websiteId}`}>
            <ArrowLeft className="size-4" />
            {t.backToWebsite}
          </Link>
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            {article.title}
          </h1>
          <StatusBadge status={article.status} />
        </div>
        <p className="text-sm text-muted-foreground">
          {article.targetKeyword ? `Target: ${article.targetKeyword}` : null}
        </p>
      </div>

      {/*
        Article details, counted from the body rather than stored. The customer
        can edit at any time, and a stored count would immediately be wrong.
        Hidden until there is a body: zeros on an article still being written
        read as failure rather than as progress.
      */}
      {article.bodyHtml ? (
        <Card>
          <CardContent className="grid grid-cols-2 gap-4 py-5 sm:grid-cols-4 lg:grid-cols-7">
            <Stat label="Words" value={stats.words} />
            <Stat label={t.headings} value={stats.headings} />
            <Stat
              label={t.keywordUses}
              value={stats.keywordUses}
              hint={article.targetKeyword ?? undefined}
            />
            <Stat label={t.internalLinks} value={stats.internalLinks} />
            <Stat label={t.externalLinks} value={stats.externalLinks} />
            <Stat label="Images" value={stats.images} />
            <Stat label={t.socialMentions} value={stats.socialMentions} />
          </CardContent>
        </Card>
      ) : null}

      {working ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Loader2 className="size-4 animate-spin" />
              {article.generationStep
                ? stepLabel(article.generationStep, t)
                : t.starting}
            </CardTitle>
            <CardDescription>
              {t.takesAMinute}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {article.status === "failed" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t.couldNotWrite}
            </CardTitle>
            <CardDescription>
              {explainGenerationError(article.error).summary}{" "}
              {explainGenerationError(article.error).action}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleRegenerate} disabled={pending}>
              <RefreshCw className="size-4" />
              {t.tryAgain}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {publishLogs.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t.publishingHistory}</CardTitle>
            <CardDescription>{t.historyHelp}</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {publishLogs.map((log) => (
                <li key={log.id} className="flex flex-wrap items-center gap-2">
                  <StatusBadge
                    status={log.status}
                    label={log.status === "failed" ? t.failed : undefined}
                  />
                  <span className="text-muted-foreground">
                    {new Date(log.createdAt).toLocaleString()}
                  </span>
                  {log.remoteUrl ? (
                    <a
                      href={log.remoteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 hover:underline"
                    >
                      {t.viewPost}
                      <ExternalLink className="size-3" />
                    </a>
                  ) : null}
                  {log.error ? (
                    <span className="text-destructive">
                      {explainPublishError(log.error).summary}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {article.bodyHtml ? (
        <Tabs defaultValue="preview">
          {/*
            Wraps on a narrow screen. Two tabs plus Rewrite, Send as draft and
            Publish on one unwrapping row do not fit a phone — and the part
            pushed off the edge was the publish button, which is the whole
            point of the screen.
          */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <TabsList>
              <TabsTrigger value="preview">
                <Eye className="size-4" />
                Preview
              </TabsTrigger>
              <TabsTrigger value="edit">
                <Pencil className="size-4" />
                Edit
              </TabsTrigger>
            </TabsList>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRegenerate}
                disabled={pending || working}
              >
                <RefreshCw className="size-4" />
                Rewrite
              </Button>
              {canPublish ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePublish("draft")}
                    disabled={pending || working}
                  >
                    {t.sendAsDraft}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handlePublish("publish")}
                    disabled={pending || working}
                  >
                    <Upload className="size-4" />
                    {article.status === "published" ? t.updatePost : t.publish}
                  </Button>
                </>
              ) : null}
            </div>
          </div>

          <TabsContent value="preview" className="mt-4">
            <Card>
              <CardContent className="pt-6">
                {/*
                  The illustration, above the body, where it sits on the
                  published page. It was generated with the article and
                  uploaded to the customer's site on publish, but never shown
                  here — so the one part they could not check before it went
                  live was the picture.

                  A plain <img>: the file lives on the customer's own CMS, so
                  next/image would need every customer domain in
                  remotePatterns, and a domain added after deploy would break.
                */}
                {article.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={article.imageUrl}
                    alt={article.imageAlt ?? article.title}
                    className="mb-6 w-full rounded-lg border object-cover"
                  />
                ) : null}

                {/**
                 * The body is sanitised on generation AND on every save, so
                 * what reaches here has already had scripts, handlers and
                 * document tags stripped.
                 */}
                <div
                  className="prose prose-sm max-w-none dark:prose-invert [&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-semibold [&_li]:my-1 [&_p]:my-3 [&_ul]:list-disc [&_ul]:pl-6 [&_img]:my-6 [&_img]:block [&_img]:mx-auto [&_img]:max-w-xl [&_img]:max-h-[30rem] [&_img]:h-auto [&_img]:w-auto [&_img]:rounded-lg [&_img]:border [&_img]:object-contain"
                  dangerouslySetInnerHTML={{ __html: article.bodyHtml }}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="edit" className="mt-4">
            {/*
              The picture beside the words, not buried under them. It is the
              part a customer is most likely to want changed, and on a wide
              screen it costs nothing to show both at once.
            */}
            <div className="grid items-start gap-4 lg:grid-cols-[1fr_20rem]">
              {/*
              overflow-visible overrides Card's own overflow-hidden, which
              clips position:sticky — without it the editor's toolbar scrolls
              away with the text instead of staying put.
            */}
              <Card className="overflow-visible">
                <CardHeader>
                  <CardTitle className="text-base">{t.editArticle}</CardTitle>
                  <CardDescription>{t.editHelp}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="title">{t.title}</Label>
                    <Input
                      id="title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="meta">
                      {t.metaDescription}{" "}
                      <span className="text-muted-foreground">
                        ({meta.length}/158)
                      </span>
                    </Label>
                    <Input
                      id="meta"
                      value={meta}
                      onChange={(e) => setMeta(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="slug">{t.slugLabel}</Label>
                    <Input
                      id="slug"
                      value={slug}
                      onChange={(e) => setSlug(e.target.value)}
                      placeholder={t.slugPlaceholder}
                    />
                    <p className="text-xs text-muted-foreground">
                      {/*
                      Tidied on save rather than validated as you type:
                      someone typing a real title means the slug version of
                      it, and correcting them mid-keystroke is hostile.
                    */}
                      {t.slugHelp}
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    {/*
                    A plain label, not <Label htmlFor>: the editor is a
                    contenteditable div, which htmlFor cannot focus. The
                    editor carries its own aria-label instead.
                  */}
                    <p className="text-sm font-medium">{t.articleContent}</p>
                    <RichTextEditor
                      value={body}
                      onChange={setBody}
                      onUploadImage={handleInlineUpload}
                      onListImages={handleListImages}
                    />
                  </div>
                </CardContent>
                <CardFooter>
                  <Button onClick={handleSave} disabled={pending}>
                    {pending ? t.saving : t.saveChanges}
                  </Button>
                </CardFooter>
              </Card>

              <FeaturedImage
                websiteId={websiteId}
                articleId={article.id}
                imageUrl={article.imageUrl}
                imageAlt={article.imageAlt}
                attempts={article.imageAttempts}
              />
            </div>
          </TabsContent>
        </Tabs>
      ) : null}
    </PageShell>
  );
}
