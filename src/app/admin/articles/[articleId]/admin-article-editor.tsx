"use client";

import { ArrowLeft, Eye, Pencil } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RichTextEditor } from "@/components/rich-text-editor";
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
import { PageShell } from "@/components/ui/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  updateAnyArticle,
  type AdminArticleDetail,
} from "@/lib/admin/actions";

/**
 * Admin article review.
 *
 * The client asked to "manual reviewing all the articles in the system from
 * all websites, in this way I can make manual changes" — so this edits any
 * article regardless of who owns it.
 */
export function AdminArticleEditor({
  article,
}: {
  article: AdminArticleDetail;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState(article.title);
  const [body, setBody] = useState(article.bodyHtml ?? "");

  function handleSave() {
    startTransition(async () => {
      const result = await updateAnyArticle(article.id, {
        title,
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

  return (
    <PageShell>
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
          <Link href="/admin/articles">
            <ArrowLeft className="size-4" />
            All articles
          </Link>
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            {article.title}
          </h1>
          <Badge variant="secondary">{article.status}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {article.organizationName} · {article.domain}
          {article.targetKeyword ? ` · ${article.targetKeyword}` : ""}
        </p>
      </div>

      <Tabs defaultValue="preview">
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

        <TabsContent value="preview" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              {article.bodyHtml ? (
                // Sanitised on generation and on every save, including here.
                <div
                  className="prose prose-sm max-w-none dark:prose-invert [&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-semibold [&_li]:my-1 [&_p]:my-3 [&_ul]:list-disc [&_ul]:pl-6 [&_img]:my-6 [&_img]:block [&_img]:w-full [&_img]:max-w-2xl [&_img]:mx-auto [&_img]:rounded-lg [&_img]:border [&_img]:aspect-video [&_img]:object-cover"
                  dangerouslySetInnerHTML={{ __html: article.bodyHtml }}
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  This article has no content yet.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="edit" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Edit as administrator</CardTitle>
              <CardDescription>
                Changes apply to the customer&apos;s article immediately.
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
                {/* See the note in the customer editor on the plain label. */}
                <p className="text-sm font-medium">Body</p>
                <RichTextEditor value={body} onChange={setBody} />
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
    </PageShell>
  );
}
