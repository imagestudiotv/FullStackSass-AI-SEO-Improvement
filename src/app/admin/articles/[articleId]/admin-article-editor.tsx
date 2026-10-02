"use client";

import { ArrowLeft, Eye, Pencil } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { PARTNER_LINK_SCOPE, PartnerLinkStyles } from "@/components/partner-link-styles";
import { ARTICLE_TABLE_CLASSES } from "@/lib/articles/table-styles";
import { StatusBadge } from "@/components/ui/status-badge";
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
import { previewHtml, sameHtml, useDraftField } from "@/lib/articles/use-draft";

/**
 * Admin article review.
 *
 * The client asked to "manual reviewing all the articles in the system from
 * all websites, in this way I can make manual changes" — so this edits any
 * article regardless of who owns it.
 */
export function AdminArticleEditor({
  article,
  partnerLinks,
}: {
  article: AdminArticleDetail;
  /** Partner Network links in this article (their addresses), highlighted. */
  partnerLinks: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useDraftField(article.title);
  const [body, setBody] = useDraftField(article.bodyHtml ?? "", sameHtml);
  // Preview shows the working copy; this says when it is not saved yet.
  const unsaved = title.trim() !== article.title || !sameHtml(body, article.bodyHtml ?? "");
  const partnerInText = partnerLinks.some((url) => body.includes(url) || body.includes(url.replace(/&/g, "&amp;")));

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
          <StatusBadge
            status={article.status}
            label={article.status === "failed" ? "Failed" : undefined}
          />
        </div>
        <p className="text-sm text-muted-foreground">
          {article.organizationName} · {article.domain}
          {article.targetKeyword ? ` · ${article.targetKeyword}` : ""}
        </p>
      </div>

      <PartnerLinkStyles urls={partnerLinks} label="Partner link" />
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
              {unsaved ? (
                <p
                  role="status"
                  className="mb-6 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm"
                >
                  This preview includes changes you have not saved yet. Save
                  them on the Edit tab.
                </p>
              ) : null}
              {partnerInText ? (
                <p className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="inline-block size-3 shrink-0 rounded-sm bg-violet-500/25 ring-1 ring-violet-500/60" aria-hidden="true" />
                  Highlighted words are Partner Network links.
                </p>
              ) : null}
              <h2 className="mb-6 text-2xl font-semibold tracking-tight">
                {title}
              </h2>
              {body ? (
                // The working copy, sanitised as a save would (lib/articles/use-draft.ts).
                <div
                  className={`${PARTNER_LINK_SCOPE} prose prose-sm max-w-none dark:prose-invert [overflow-wrap:anywhere] [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 ${ARTICLE_TABLE_CLASSES} [&_pre]:overflow-x-auto [&_iframe]:max-w-full [&_video]:max-w-full [&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-semibold [&_li]:my-1 [&_p]:my-3 [&_ul]:list-disc [&_ul]:pl-6 [&_img]:my-6 [&_img]:block [&_img]:mx-auto [&_img]:max-w-[min(100%,36rem)] [&_img]:max-h-[30rem] [&_img]:h-auto [&_img]:w-auto [&_img]:rounded-lg [&_img]:border [&_img]:object-contain`}
                  dangerouslySetInnerHTML={{ __html: previewHtml(body) }}
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
          {article.underReview ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Edit on the review page</CardTitle>
                <CardDescription>
                  This article is in the Partner Network review. It is edited on its review page, where its network
                  links are kept and the change goes back for approval.
                </CardDescription>
              </CardHeader>
              <CardFooter>
                <Button asChild>
                  <Link href={`/admin/network/${article.id}`}>Open the review page</Link>
                </Button>
              </CardFooter>
            </Card>
          ) : (
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
                  <div className={PARTNER_LINK_SCOPE}>
                  <RichTextEditor value={body} onChange={setBody} />
                </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button onClick={handleSave} disabled={pending}>
                  {pending ? "Saving…" : "Save changes"}
                </Button>
              </CardFooter>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
