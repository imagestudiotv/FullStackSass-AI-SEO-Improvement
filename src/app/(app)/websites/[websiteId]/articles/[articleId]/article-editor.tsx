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
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  regenerateArticle,
  updateArticle,
  type ArticleDetail,
} from "@/lib/articles/actions";
import {
  publishArticle,
  type PublishLogRow,
} from "@/lib/publishing/actions";

const STATUS: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" }
> = {
  queued: { label: "Waiting", variant: "secondary" },
  generating: { label: "Being written", variant: "secondary" },
  draft: { label: "Draft", variant: "default" },
  published: { label: "Published", variant: "default" },
  failed: { label: "Failed", variant: "destructive" },
};

const STEP_LABEL: Record<string, string> = {
  outline: "Planning what to cover",
  body: "Writing the article",
};

export function ArticleEditor({
  websiteId,
  article,
  canPublish,
  destinationName,
  publishLogs,
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
  publishLogs: PublishLogRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState(article.title);
  const [meta, setMeta] = useState(article.metaDescription ?? "");
  const [body, setBody] = useState(article.bodyHtml ?? "");

  const working = article.status === "generating" || article.status === "queued";

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
        bodyHtml: body,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Saved");
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
          : "Sending as a draft…",
      );
      router.refresh();
    });
  }

  function handleRegenerate() {
    startTransition(async () => {
      const result = await regenerateArticle(websiteId, article.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Rewriting the article…");
      router.refresh();
    });
  }

  const status = STATUS[article.status] ?? {
    label: article.status,
    variant: "secondary" as const,
  };

  return (
    <PageShell>
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
          <Link href={`/websites/${websiteId}`}>
            <ArrowLeft className="size-4" />
            Back to website
          </Link>
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            {article.title}
          </h1>
          <Badge variant={status.variant}>{status.label}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {article.targetKeyword ? `Target: ${article.targetKeyword}` : null}
          {article.wordCount ? ` · ${article.wordCount} words` : null}
        </p>
      </div>

      {working ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Loader2 className="size-4 animate-spin" />
              {article.generationStep
                ? STEP_LABEL[article.generationStep]
                : "Starting"}
            </CardTitle>
            <CardDescription>
              This usually takes about a minute. The page updates on its own.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {article.status === "failed" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">We could not write this one</CardTitle>
            <CardDescription>
              {article.error ?? "Something went wrong writing this article."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleRegenerate} disabled={pending}>
              <RefreshCw className="size-4" />
              Try again
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {publishLogs.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Publishing history</CardTitle>
            <CardDescription>
              Every attempt is recorded, so a failure is visible rather than
              silent.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {publishLogs.map((log) => (
                <li key={log.id} className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant={
                      log.status === "published" ? "default" : "destructive"
                    }
                  >
                    {log.status}
                  </Badge>
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
                      View post
                      <ExternalLink className="size-3" />
                    </a>
                  ) : null}
                  {log.error ? (
                    <span className="text-destructive">{log.error}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {article.bodyHtml ? (
        <Tabs defaultValue="preview">
          <div className="flex items-center justify-between gap-4">
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
            <div className="flex gap-2">
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
                    Send as draft
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handlePublish("publish")}
                    disabled={pending || working}
                  >
                    <Upload className="size-4" />
                    {article.status === "published" ? "Update post" : "Publish"}
                  </Button>
                </>
              ) : null}
            </div>
          </div>

          <TabsContent value="preview" className="mt-4">
            <Card>
              <CardContent className="pt-6">
                {/**
                 * The body is sanitised on generation AND on every save, so
                 * what reaches here has already had scripts, handlers and
                 * document tags stripped.
                 */}
                <div
                  className="prose prose-sm max-w-none dark:prose-invert [&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-semibold [&_li]:my-1 [&_p]:my-3 [&_ul]:list-disc [&_ul]:pl-6"
                  dangerouslySetInnerHTML={{ __html: article.bodyHtml }}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="edit" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Edit article</CardTitle>
                <CardDescription>
                  Your previous version is kept each time you save.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="meta">
                    Meta description{" "}
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
                  <Label htmlFor="body">Article content</Label>
                  <textarea
                    id="body"
                    rows={20}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-xs shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  />
                </div>
              </CardContent>
              <CardFooter>
                <Button onClick={handleSave} disabled={pending}>
                  {pending ? "Saving…" : "Save changes"}
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>
        </Tabs>
      ) : null}
    </PageShell>
  );
}
