"use client";

import { Globe, Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

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
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/states";
import type { Messages } from "@/lib/i18n/messages";
import {
  addWebsite,
  deleteWebsite,
  reanalyzeWebsite,
  type WebsiteSummary,
} from "@/lib/websites/actions";
import { UNLIMITED, type LimitCheck } from "@/lib/usage-shared";

type WebsitesClientProps = {
  websites: WebsiteSummary[];
  /** This screen's copy, already in the reader's language. */
  t: Messages["app"]["websites"];
  /** The status vocabulary, for the badges. */
  tStatus: Messages["app"]["status"];
};

export function WebsitesClient({
  websites,
  t,
  tStatus,
}: WebsitesClientProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);


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
      /**
       * Into setup, not back to the list.
       *
       * A new website has no plan and cannot generate anything until it has
       * one, so refreshing the list left the customer looking at a site that
       * silently does nothing. Every website goes through the same steps,
       * whether it is the first or the fifth.
       */
      router.push(`/billing?site=${result.data.id}`);
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
      toast.success(t.removed(domain));
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
      toast.success(t.retrying);
      router.refresh();
    });
  }

  return (
    <PageShell>
      <PageHeader
        title={t.title}
        description={t.connected(websites.length)}
        actions={
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="size-4" />
            {t.addWebsite}
          </Button>
        }
      />

      {websites.length === 0 ? (
        <EmptyState
          icon={Globe}
          title={t.emptyTitle}
          description={t.emptyBody}
          action={
            <Button onClick={() => setOpen(true)}>
              <Plus className="size-4" />
              {t.addFirst}
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3">
          {websites.map((site) => {
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

                  <StatusBadge status={site.status} t={tStatus} className="shrink-0" />

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
                        {t.tryAgain}
                      </Button>
                    ) : null}
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={t.removeLabel(site.domain)}
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
        <DialogContent closeLabel={t.cancel}>
          <form onSubmit={handleAdd}>
            <DialogHeader>
              <DialogTitle>{t.dialogTitle}</DialogTitle>
              <DialogDescription>{t.dialogBody}</DialogDescription>
            </DialogHeader>

            <div className="space-y-1.5 py-4">
              <Label htmlFor="website-url">{t.urlLabel}</Label>
              <Input
                id="website-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={t.urlPlaceholder}
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
                {t.cancel}
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    {t.adding}
                  </>
                ) : (
                  t.addWebsite
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
