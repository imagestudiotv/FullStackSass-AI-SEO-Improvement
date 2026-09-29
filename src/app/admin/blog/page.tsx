import { ExternalLink, Newspaper, Plus } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, PageShell } from "@/components/ui/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listBlogPostsAdmin } from "@/lib/admin/blog";
import { EmptyRows } from "../empty-rows";

export const dynamic = "force-dynamic";

/** Day and time in UTC, the way the rest of the admin panel shows times. */
function when(date: Date): string {
  return `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

export default async function AdminBlogPage() {
  const posts = await listBlogPostsAdmin();
  const live = posts.filter((post) => post.status === "published").length;

  return (
    <PageShell width="wide">
      <PageHeader
        title="Blog"
        description="RepGet's own blog at /blog. Write posts here; a published post is live at once."
        actions={
          <Button asChild>
            <Link href="/admin/blog/new">
              <Plus className="size-4" />
              New post
            </Link>
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {posts.length} post{posts.length === 1 ? "" : "s"} · {live} published
          </CardTitle>
          <CardDescription>Most recently edited first. Drafts are visible only here.</CardDescription>
        </CardHeader>
        <CardContent>
          {posts.length === 0 ? (
            <EmptyRows
              filtering={false}
              icon={Newspaper}
              noun="posts"
              emptyTitle="No posts yet"
              emptyDescription="Press New post to write the first one."
            />
          ) : (
            <Table minWidth="40rem">
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead className="hidden md:table-cell">Category</TableHead>
                  <TableHead className="w-28">Status</TableHead>
                  <TableHead className="hidden lg:table-cell">Published</TableHead>
                  <TableHead className="hidden sm:table-cell">Last edited</TableHead>
                  <TableHead className="w-16">
                    <span className="sr-only">View</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {posts.map((post) => (
                  <TableRow key={post.id}>
                    <TableCell>
                      <Link href={`/admin/blog/${post.id}`} className="font-medium hover:underline">
                        {post.title}
                      </Link>
                      <p className="text-xs text-muted-foreground">/blog/{post.slug}</p>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">{post.category}</TableCell>
                    <TableCell>
                      <Badge variant={post.status === "published" ? "default" : "secondary"}>
                        {post.status === "published" ? "Published" : "Draft"}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground tabular-nums lg:table-cell">
                      {post.publishedAt ? post.publishedAt.toISOString().slice(0, 10) : "-"}
                    </TableCell>
                    <TableCell className="hidden text-xs text-muted-foreground sm:table-cell">
                      {when(post.updatedAt)}
                      {post.updatedBy ? <span className="block truncate">{post.updatedBy}</span> : null}
                    </TableCell>
                    <TableCell>
                      {post.status === "published" ? (
                        <a
                          href={`/blog/${post.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                        >
                          View
                          <ExternalLink className="size-3" aria-hidden="true" />
                        </a>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
}
