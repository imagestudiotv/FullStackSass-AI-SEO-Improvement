import { ExternalLink, Megaphone, Newspaper, Plus } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listBlogCategoriesAdmin, listBlogPostsAdmin } from "@/lib/admin/blog";
import { placementsToReview } from "@/lib/admin/blog-sponsorships";
import { formatDate, formatNumber } from "@/lib/i18n/format";

import { ExpandableText } from "../_ui/expandable-text";
import { AdminPage, AdminPageHeader } from "../_ui/page";
import { AdminEmpty } from "../_ui/states";
import { AdminStatus } from "../_ui/status";
import { AdminTableCard } from "../_ui/table";
import { BlogCategories } from "./blog-categories";
import { postStatus } from "./post-status";

export const dynamic = "force-dynamic";
export const metadata = { title: "Blog" };

const n = (value: number) => formatNumber(value, "en");
const day = (date: Date) => formatDate(date, "en", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
/** Day and time in UTC, the way the rest of the admin panel shows times. */
const when = (date: Date) =>
  `${formatDate(date, "en", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" })} UTC`;

/**
 * RepGet's own blog: every post (drafts included) and the blog's categories.
 * A published post is public at once; drafts are visible only here.
 */
export default async function AdminBlogPage() {
  const [posts, categories, toReview] = await Promise.all([listBlogPostsAdmin(), listBlogCategoriesAdmin(), placementsToReview()]);
  const live = posts.filter((post) => post.status === "published").length;

  return (
    <AdminPage>
      <AdminPageHeader
        title="Blog"
        description="RepGet's own blog at /blog. Write posts here; a published post is live at once."
        actions={
          <>
            {/* Paid "Get Featured" requests (lib/blog/sponsorship.ts), with how many wait for a decision. */}
            <Button asChild size="lg" variant="outline">
              <Link href="/admin/blog/sponsorships">
                <Megaphone aria-hidden="true" />
                Featured placements
                {toReview > 0 ? (
                  <span className="rounded-full bg-warning-soft px-1.5 text-xs font-semibold text-warning tabular-nums">
                    {n(toReview)}
                    <span className="sr-only"> to review</span>
                  </span>
                ) : null}
              </Link>
            </Button>
            <Button asChild size="lg">
              <Link href="/admin/blog/new">
                <Plus aria-hidden="true" />
                New post
              </Link>
            </Button>
          </>
        }
      />
      <section aria-labelledby="posts-title" className="space-y-3">
        <ListHeading
          id="posts-title"
          title="Posts"
          description="Most recently edited first. Drafts are visible only here."
          count={`${n(posts.length)} ${posts.length === 1 ? "post" : "posts"} · ${n(live)} published`}
        />
        <AdminTableCard>
          {posts.length === 0 ? (
            <AdminEmpty
              filtering={false}
              icon={Newspaper}
              noun="posts"
              title="No posts yet"
              description="Press New post to write the first one."
              action={
                <Button asChild variant="outline">
                  <Link href="/admin/blog/new">
                    <Plus aria-hidden="true" />
                    New post
                  </Link>
                </Button>
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead className="hidden md:table-cell">Category</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden xl:table-cell">First published</TableHead>
                  <TableHead className="hidden sm:table-cell">Last edited</TableHead>
                  <TableHead className="hidden w-20 sm:table-cell">
                    <span className="sr-only">View</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {posts.map((post) => {
                  const status = postStatus(post.status, Boolean(post.publishedAt));
                  return (
                    <TableRow key={post.id}>
                      <TableCell className="min-w-40 whitespace-normal sm:min-w-52">
                        <Link
                          href={`/admin/blog/${post.id}`}
                          className="rounded-sm font-medium underline-offset-4 outline-none wrap-anywhere hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {post.title}
                        </Link>
                        <p className="mt-0.5 font-mono text-xs text-muted-foreground wrap-anywhere">/blog/{post.slug}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground md:hidden">{post.category}</p>
                        {post.status === "published" ? (
                          <a
                            href={`/blog/${post.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1 inline-flex items-center gap-1 rounded-sm text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring sm:hidden"
                          >
                            View on the blog
                            <ExternalLink className="size-3" aria-hidden="true" />
                            <span className="sr-only">(opens in a new tab)</span>
                          </a>
                        ) : null}
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground md:table-cell">{post.category}</TableCell>
                      <TableCell>
                        <AdminStatus tone={status.tone} label={status.label} icon={status.icon} title={status.title} />
                      </TableCell>
                      <TableCell className="hidden tabular-nums xl:table-cell">
                        {post.publishedAt ? (
                          <time dateTime={post.publishedAt.toISOString()}>{day(post.publishedAt)}</time>
                        ) : (
                          <span className="text-muted-foreground">Never</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <div className="max-w-64">
                          <time dateTime={post.updatedAt.toISOString()} className="block tabular-nums">
                            {when(post.updatedAt)}
                          </time>
                          {post.updatedBy ? (
                            <ExpandableText text={post.updatedBy} threshold={28} className="text-xs text-muted-foreground" />
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="hidden text-right sm:table-cell">
                        {post.status === "published" ? (
                          <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-foreground">
                            <a
                              href={`/blog/${post.slug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label={`View “${post.title}” on the blog (opens in a new tab)`}
                            >
                              View
                              <ExternalLink aria-hidden="true" />
                            </a>
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </AdminTableCard>
      </section>

      <section id="categories" aria-labelledby="categories-title" className="scroll-mt-20 space-y-3">
        <ListHeading
          id="categories-title"
          title="Categories"
          description="Sections of the blog, each with its own page. A category shows on the blog's index once it has a published post. Post counts include drafts; only a category no post uses can be deleted."
          count={`${n(categories.length)} ${categories.length === 1 ? "category" : "categories"}`}
        />
        <BlogCategories categories={categories} />
      </section>
    </AdminPage>
  );
}

/** A list's heading row: what it is, how it is ordered, and how many there are. */
function ListHeading({ id, title, description, count }: { id: string; title: string; description: ReactNode; count: string }) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
      <div className="min-w-0 space-y-0.5">
        <h2 id={id} className="text-base font-semibold">
          {title}
        </h2>
        <p className="max-w-3xl text-sm text-muted-foreground">{description}</p>
      </div>
      <p className="shrink-0 text-sm tabular-nums text-muted-foreground">{count}</p>
    </div>
  );
}
