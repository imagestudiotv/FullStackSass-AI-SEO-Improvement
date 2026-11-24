import { Award, ExternalLink, Pin, Plus } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { countStoryClaims } from "@/lib/admin/story-claims";
import { listSuccessStoriesAdmin } from "@/lib/admin/success-stories";
import { businessInitial } from "@/lib/blog/business";
import { successStoryPath } from "@/lib/success-stories/fields";

import { AdminPage, AdminPageHeader } from "../_ui/page";
import { AdminEmpty } from "../_ui/states";
import { AdminStatus } from "../_ui/status";
import { SuccessStoryRowActions } from "./story-actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Success stories" };

/**
 * Admin -> Success stories (lib/admin/success-stories.ts): the customer
 * stories after Image Studio's, in their public order. Image Studio is shown
 * pinned first and cannot be moved: its case study is built into the site
 * (client, 2026-11-19: "always first stable fixed").
 */
export default async function AdminSuccessStoriesPage() {
  const [stories, sent] = await Promise.all([listSuccessStoriesAdmin(), countStoryClaims().catch(() => 0)]);
  const published = stories.filter((story) => story.published).length;

  return (
    <AdminPage width="default">
      <AdminPageHeader
        title="Success stories"
        description={`Customer stories with their own page at /success-stories/<address>, shown after Image Studio's on the homepage, /success-stories and /discover. ${published} published. Stories written as blog posts in the Customer stories category (Admin -> Blog) are listed there too, before these.`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="lg" asChild>
              <a href="/success-stories" target="_blank" rel="noopener">
                <ExternalLink aria-hidden="true" />
                View /success-stories
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            </Button>
            <Button size="lg" asChild>
              <Link href="/admin/success-stories/new">
                <Plus aria-hidden="true" />
                New success story
              </Link>
            </Button>
          </div>
        }
      />

      {sent > 0 ? (
        <p className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
          {sent === 1 ? "1 customer story is" : `${sent} customer stories are`} waiting in{" "}
          <Link href="/admin/earn-credits" className="rounded-sm font-medium underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-ring">
            Earn Credits
          </Link>
          . Approve it there first, then publish it here.
        </p>
      ) : null}

      <ol className="space-y-3">
        <li className="flex min-w-0 flex-col gap-4 rounded-xl border border-dashed bg-muted/40 p-4 sm:flex-row sm:items-center">
          <span className="w-6 shrink-0 text-muted-foreground" aria-label="Pinned first">
            <Pin className="size-4" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Image Studio</p>
            <p className="mt-1 text-sm text-muted-foreground">Always first, on every page. Its case study is built into the site (/success-stories/image-studio).</p>
          </div>
          <AdminStatus tone="success" label="Pinned" />
        </li>
        {stories.map((story, index) => (
          <li key={story.id} className="flex min-w-0 flex-col gap-4 rounded-xl border bg-card p-4 sm:flex-row sm:items-start">
            <span className="w-6 shrink-0 pt-1 text-sm text-muted-foreground tabular-nums" aria-label={`Position ${index + 2}`}>
              {index + 2}
            </span>
            {story.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- a stored 256px picture shown as it is
              <img src={story.logoUrl} alt="" className="size-12 shrink-0 rounded-xl border bg-muted object-cover" />
            ) : (
              <span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 font-semibold text-primary-strong">
                {businessInitial(story.name)}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2">
                <Link href={`/admin/success-stories/${story.id}`} className="font-semibold underline-offset-4 wrap-anywhere hover:underline">
                  {story.title}
                </Link>
                <span className="text-sm text-muted-foreground wrap-anywhere">{story.name}</span>
              </p>
              <p className="mt-1 line-clamp-2 text-sm text-foreground/75 wrap-anywhere">{story.summary}</p>
              <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {story.published ? (
                  <AdminStatus tone="success" label="Published" title="On the homepage, /success-stories and /discover" />
                ) : (
                  <AdminStatus tone="neutral" label="Draft" title="Only administrators see it, on the preview" />
                )}
                <span className="wrap-anywhere">{successStoryPath("en", story.slug)}</span>
              </p>
            </div>
            <SuccessStoryRowActions id={story.id} title={story.title} first={index === 0} last={index === stories.length - 1} published={story.published} />
          </li>
        ))}
      </ol>

      {stories.length === 0 ? (
        <div className="rounded-xl border bg-card">
          <AdminEmpty
            filtering={false}
            icon={Award}
            noun="success stories"
            title="No success stories yet"
            description="Add a customer's story - its words, logo and real figures - to show it after Image Studio's."
          />
        </div>
      ) : null}
    </AdminPage>
  );
}
