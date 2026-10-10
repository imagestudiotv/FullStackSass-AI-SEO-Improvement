import { ImageIcon } from "lucide-react";
import Link from "next/link";

import { listBlogImages } from "@/lib/admin/blog-images";
import { formatDate, formatNumber } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";

import { AdminPage, AdminPageHeader } from "../../_ui/page";
import { AdminEmpty } from "../../_ui/states";
import { ImageCardActions, UploadBlogImage } from "./image-actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Blog images" };

const n = (value: number) => formatNumber(value, "en");

function size(bytes: number | null): string {
  if (bytes === null) return "";
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/**
 * Admin -> Blog -> Images: every picture uploaded for RepGet's blog
 * (lib/admin/blog-images.ts), newest first, with the posts that use it. A
 * picture no post uses can be deleted; one in use cannot. The post editor's
 * picker shows the same pictures, so one can be used again instead of
 * uploaded twice.
 */
export default async function BlogImagesPage({ searchParams }: { searchParams: Promise<{ q?: string; show?: string }> }) {
  const params = await searchParams;
  const term = typeof params.q === "string" ? params.q.slice(0, 100) : "";
  const unusedOnly = params.show === "unused";
  const { configured, images: all } = await listBlogImages(term);
  const images = unusedOnly ? all.filter((image) => image.usedIn.length === 0) : all;
  const unused = all.filter((image) => image.usedIn.length === 0).length;
  const query = (show: string | null) => {
    const p = new URLSearchParams();
    if (term) p.set("q", term);
    if (show) p.set("show", show);
    const s = p.toString();
    return s ? `/admin/blog/images?${s}` : "/admin/blog/images";
  };

  return (
    <AdminPage>
      <AdminPageHeader
        back={{ href: "/admin/blog", label: "Blog" }}
        title="Images"
        description="Every picture uploaded for the blog, newest first, with the posts that use it. A picture no post uses can be deleted. In the post editor, the picture button offers these same pictures."
        actions={configured ? <UploadBlogImage /> : null}
      />

      {!configured ? (
        <div className="rounded-xl border bg-card">
          <AdminEmpty filtering={false} icon={ImageIcon} noun="images" title="Image storage is not set up" description="Pictures can be listed once image storage is configured." />
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <form action="/admin/blog/images" className="flex min-w-0 flex-1 gap-2">
              {unusedOnly ? <input type="hidden" name="show" value="unused" /> : null}
              <label htmlFor="blog-image-search" className="sr-only">
                Search pictures
              </label>
              <input
                id="blog-image-search"
                name="q"
                defaultValue={term}
                placeholder="Search by description, file name or post title"
                className="h-9 w-full max-w-md min-w-0 rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <button type="submit" className="h-9 rounded-md border bg-card px-3 text-sm font-medium hover:bg-muted">
                Search
              </button>
            </form>
            <nav aria-label="Which pictures" className="flex gap-2">
              {[
                { show: null, label: "All", count: all.length },
                { show: "unused", label: "Not used", count: unused },
              ].map((option) => {
                const active = (option.show === "unused") === unusedOnly;
                return (
                  <Link
                    key={option.label}
                    href={query(option.show)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                      active ? "border-foreground bg-foreground text-background" : "bg-card hover:bg-muted",
                    )}
                  >
                    {option.label}
                    <span className={cn("tabular-nums", active ? "text-background/75" : "text-muted-foreground")}>{n(option.count)}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {images.length === 0 ? (
            <div className="rounded-xl border bg-card">
              <AdminEmpty
                filtering={Boolean(term) || unusedOnly}
                icon={ImageIcon}
                noun="images"
                title={term || unusedOnly ? "No pictures match" : "No pictures yet"}
                description={term || unusedOnly ? "Try another search, or show all pictures." : "Pictures appear here when you upload one, here or in the post editor."}
              />
            </div>
          ) : (
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {images.map((image) => (
                <li key={image.url} className="flex min-w-0 flex-col overflow-hidden rounded-xl border bg-card">
                  <a href={image.url} target="_blank" rel="noopener noreferrer" className="block bg-muted/40">
                    {/* eslint-disable-next-line @next/next/no-img-element -- a stored file shown as is */}
                    <img src={image.url} alt={image.alt ?? ""} loading="lazy" className="aspect-video w-full object-contain" />
                    <span className="sr-only">Open the picture in a new tab</span>
                  </a>
                  <div className="flex min-w-0 flex-1 flex-col gap-2 p-4 text-sm">
                    <p className={cn("line-clamp-2 wrap-anywhere", image.alt ? "" : "text-muted-foreground italic")}>
                      {image.alt ?? "No description"}
                    </p>
                    <p className="text-xs text-muted-foreground wrap-anywhere">
                      {image.name}
                      {image.size !== null ? ` · ${size(image.size)}` : ""}
                      {image.createdAt ? ` · ${formatDate(new Date(image.createdAt), "en", { day: "numeric", month: "short", year: "numeric" })}` : ""}
                    </p>
                    <div className="text-xs">
                      {image.usedIn.length === 0 ? (
                        <span className="rounded-full bg-warning-soft px-2 py-0.5 font-medium text-warning">Not used in any post</span>
                      ) : (
                        <span className="text-muted-foreground">
                          Used in{" "}
                          {image.usedIn.map((post, index) => (
                            <span key={post.id}>
                              {index > 0 ? ", " : ""}
                              <Link href={`/admin/blog/${post.id}`} className="font-medium text-foreground underline-offset-4 hover:underline">
                                {post.title}
                              </Link>
                              {post.status !== "published" ? " (draft)" : ""}
                            </span>
                          ))}
                        </span>
                      )}
                    </div>
                    <div className="mt-auto pt-2">
                      <ImageCardActions url={image.url} inUse={image.usedIn.length > 0} />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </AdminPage>
  );
}
