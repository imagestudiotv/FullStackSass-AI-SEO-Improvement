"use client";

import { Globe, Loader2, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { addWebsite, deleteWebsite, type WebsiteSummary } from "@/lib/websites/actions";
import { UNLIMITED, type LimitCheck } from "@/lib/usage-shared";

type WebsitesClientProps = {
  websites: WebsiteSummary[];
  limit: LimitCheck;
};

/** Maps the stored status to something a customer can read. */
const STATUS_LABEL: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  pending: { label: "Waiting to analyse", variant: "secondary" },
  crawling: { label: "Analysing", variant: "secondary" },
  ready: { label: "Ready", variant: "default" },
  failed: { label: "Analysis failed", variant: "destructive" },
};

export function WebsitesClient({ websites, limit }: WebsitesClientProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [pending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
      toast.success("Website added");
      router.refresh();
    });
  }

  function handleDelete(id: string, domain: string) {
    setDeletingId(id);
    startTransition(async () => {
      const result = await deleteWebsite(id);
      setDeletingId(null);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Removed ${domain}`);
      router.refresh();
    });
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Websites</h1>
          <p className="text-sm text-muted-foreground">
            {limit.limit === UNLIMITED
              ? `${websites.length} connected`
              : `${websites.length} of ${limit.limit} used on your plan`}
          </p>
        </div>
        <Button onClick={() => setOpen(true)} disabled={atLimit}>
          <Plus className="size-4" />
          Add website
        </Button>
      </div>

      {atLimit ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Plan limit reached</CardTitle>
            <CardDescription>
              Your plan includes {limit.limit}{" "}
              {limit.limit === 1 ? "website" : "websites"}.{" "}
              <Link href="/billing" className="underline underline-offset-4">
                Upgrade
              </Link>{" "}
              to add more.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {websites.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Globe className="size-4" />
              No websites yet
            </CardTitle>
            <CardDescription>
              Add your website and we will analyse it, then build a keyword
              strategy and content plan around it.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setOpen(true)} disabled={atLimit}>
              <Plus className="size-4" />
              Add your first website
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {websites.map((site) => {
            const status = STATUS_LABEL[site.status] ?? {
              label: site.status,
              variant: "secondary" as const,
            };
            return (
              <Card key={site.id}>
                <CardHeader className="flex-row items-center justify-between gap-4 space-y-0">
                  <div className="min-w-0">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Link
                        href={`/websites/${site.id}`}
                        className="truncate hover:underline"
                      >
                        {site.brandName || site.domain}
                      </Link>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </CardTitle>
                    <CardDescription className="truncate">
                      {site.url}
                      {site.industry ? ` · ${site.industry}` : ""}
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${site.domain}`}
                    disabled={pending && deletingId === site.id}
                    onClick={() => handleDelete(site.id, site.domain)}
                  >
                    {pending && deletingId === site.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Trash2 className="size-4" />
                    )}
                  </Button>
                </CardHeader>
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
                Enter the address of the site you want to rank. We will read it
                and fill in the details for you.
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
                {pending ? "Adding…" : "Add website"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
