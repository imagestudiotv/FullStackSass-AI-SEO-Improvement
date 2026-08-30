"use client";

import { ArrowLeft, Eye, Loader2, Pencil, RefreshCw } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  regenerateArticle,
  updateArticle,
  type ArticleDetail,
} from "@/lib/articles/actions";

const STATUS: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" }
> = {
  queued: { label: "Queued", variant: "secondary" },
  generating: { label: "Writing…", variant: "secondary" },
  draft: { label: "Draft", variant: "default" },
  published: { label: "Published", variant: "default" },
  failed: { label: "Failed", variant: "destructive" },
};

const STEP_LABEL: Record<string, string> = {
  outline: "Planning the structure",
  body: "Writing the article",
};

export function ArticleEditor({
  websiteId,
  article,
}: {
  websiteId: string;
  article: ArticleDetail;
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
    <div className="mx-auto max-w-3xl space-y-6">
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
              This takes about a minute. The page updates on its own.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {article.status === "failed" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Generation failed</CardTitle>
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
            <Button
              variant="outline"
              size="sm"
              onClick={handleRegenerate}
              disabled={pending || working}
            >
              <RefreshCw className="size-4" />
              Rewrite
            </Button>
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
                  <Label htmlFor="body">Body (HTML)</Label>
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
    </div>
  );
}
