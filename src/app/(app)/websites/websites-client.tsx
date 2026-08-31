"use client";

import { Globe, Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader, PageShell } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import {
  addWebsite,
  deleteWebsite,
  reanalyzeWebsite,
  type WebsiteSummary,
} from "@/lib/websites/actions";
import { UNLIMITED, type LimitCheck } from "@/lib/usage-shared";

type WebsitesClientProps = {
  websites: WebsiteSummary[];
  limit: LimitCheck;
};

/**
 * Status in the customer's language.
 *
 * Stored values are internal job names. A small-business owner should read
 * what is happening to their site, not what our worker is called.
 */
const STATUS: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" }
> = {
  pending: { label: "Waiting to start", variant: "secondary" },
  crawling: { label: "Reading your site", variant: "secondary" },
  researching: { label: "Finding opportunities", variant: "secondary" },
  ready: { label: "Ready", variant: "default" },
  failed: { label: "Needs attention", variant: "destructive" },
};

export function WebsitesClient({ websites, limit }: WebsitesClientProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  const atLimit = limit.limit !== UNLIMITED && websites.length >= limit.limit;

  function handleAdd(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await addWebsite(url);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setUrl("");
      setOpen(false);
      toast.success("Website added — we are reading it now");
      router.refresh();
    });
  }

  function handleDelete(id: string, domain: string) {
    setBusyId(id);
    startTransition(async () => {
      const result = await deleteWebsite(id);
      setBusyId(null);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Removed ${domain}`);
      router.refresh();
    });
  }

  function handleRetry(id: string) {
    setBusyId(id);
    startTransition(async () => {
      const result = await reanalyzeWebsite(id);
      setBusyId(null);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Trying again");
      router.refresh();
    });
  }

  return (
    <PageShell>
      <PageHeader
        title="Websites"
        description={
          limit.limit === UNLIMITED
            ? `${websites.length} connected`
            : `${websites.length} of ${limit.limit} included in your plan`
        }
        actions={
          <Button size="sm" onClick={() => setOpen(true)} disabled={atLimit}>
            <Plus className="size-4" />
            Add website
          </Button>
        }
      />

      {atLimit ? (
        <div className="rounded-lg border bg-background px-4 py-3 text-sm">
          <span className="text-muted-foreground">
            Your plan includes {limit.limit}{" "}
            {limit.limit === 1 ? "website" : "websites"}.{" "}
          </span>
          <Link href="/billing" className="font-medium underline underline-offset-4">
            Upgrade to add more
          </Link>
        </div>
      ) : null}

      {websites.length === 0 ? (
        <EmptyState
          icon={Globe}
          title="No websites yet"
          description="Add your website and we will read it, work out what your business does, and find the search terms worth going after."
          action={
            <Button onClick={() => setOpen(true)} disabled={atLimit}>
              <Plus className="size-4" />
              Add your first website
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3">
          {websites.map((site) => {
            const status = STATUS[site.status] ?? {
              label: site.status,
              variant: "secondary" as const,
            };
            const busy = pending && busyId === site.id;

            return (
              <Card
                key={site.id}
                className="transition-colors hover:border-foreground/20"
              >
                <CardContent className="flex flex-wrap items-center gap-4 py-4">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
                    <Globe
                      className="size-4 text-muted-foreground"
                      aria-hidden="true"
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/websites/${site.id}`}
                      className="block truncate font-medium hover:underline"
                    >
                      {site.brandName || site.domain}
                    </Link>
                    <p className="truncate text-sm text-muted-foreground">
                      {site.domain}
                      {site.industry ? ` · ${site.industry}` : ""}
                    </p>
                  </div>

                  <Badge variant={status.variant} className="shrink-0">
                    {status.label}
                  </Badge>

                  <div className="flex shrink-0 items-center gap-1">
                    {site.status === "failed" ? (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        onClick={() => handleRetry(site.id)}
                      >
                        {busy ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <RefreshCw className="size-4" />
                        )}
                        Try again
                      </Button>
                    ) : null}
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove ${site.domain}`}
                      disabled={busy}
                      onClick={() => handleDelete(site.id, site.domain)}
                    >
                      {busy && site.status !== "failed" ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Trash2 className="size-4" />
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={handleAdd}>
            <DialogHeader>
              <DialogTitle>Add a website</DialogTitle>
              <DialogDescription>
                Enter the address of the site you want found on Google. We will
                read it and fill in the details for you.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-1.5 py-4">
              <Label htmlFor="website-url">Website address</Label>
              <Input
                id="website-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="example.com"
                autoComplete="url"
                required
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Adding…
                  </>
                ) : (
                  "Add website"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
