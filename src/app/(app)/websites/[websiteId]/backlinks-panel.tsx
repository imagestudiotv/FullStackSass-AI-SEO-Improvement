"use client";

import { ExternalLink, Link2, Loader2, Plus, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/states";
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
import { ExchangeTable } from "./exchange-table";
import type { SitemapPage } from "@/lib/backlinks/sitemap";
import {
  cancelRequest,
  joinNetwork,
  leaveNetwork,
  requestBacklink,
  suggestLinkTargets,
  type GivenRow,
  type NetworkStatus,
  type RequestRow,
} from "@/lib/backlinks/actions";

type Props = {
  websiteId: string;
  status: NetworkStatus;
  requests: RequestRow[];
  given: GivenRow[];
};

/**
 * Request-specific wording.
 *
 * Only the sentence: StatusBadge owns the colour and icon for every status in
 * the product, so this map cannot drift from the rest of the app. These read
 * as a narrative of an exchange rather than generic job states, which is what
 * the backlink table needs — "Finding a website" says more here than "Waiting
 * to start" would.
 */
const REQUEST_LABEL: Record<string, string> = {
  pending: "Finding a website",
  matched: "Waiting for their next article",
  live: "Live",
  cancelled: "Cancelled",
  removed: "Removed — credit returned",
};

export function BacklinksPanel({ websiteId, status, requests, given }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showRequest, setShowRequest] = useState(false);
  const [targetUrl, setTargetUrl] = useState("");
  const [suggestions, setSuggestions] = useState<SitemapPage[]>([]);
  const [suggesting, setSuggesting] = useState(false);

  async function handleSuggest() {
    setSuggesting(true);
    try {
      const result = await suggestLinkTargets(websiteId);
      if (!result.ok) {
        // A missing sitemap is a normal outcome, so this informs rather than
        // errors — the field still works by hand.
        toast.info(result.error);
        return;
      }
      setSuggestions(result.data);
    } finally {
      setSuggesting(false);
    }
  }
  const [anchor, setAnchor] = useState("");
  const [cap, setCap] = useState(String(status.monthlyCap));

  function handleJoin(accepting: boolean) {
    startTransition(async () => {
      const result = accepting
        ? await joinNetwork(websiteId, {
            acceptingLinks: true,
            monthlyCap: Number(cap) || 3,
          })
        : await leaveNetwork(websiteId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(accepting ? "You are in the network" : "Left the network");
      router.refresh();
    });
  }

  function handleRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await requestBacklink(websiteId, {
        targetUrl,
        anchorHint: anchor,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setTargetUrl("");
      setAnchor("");
      setShowRequest(false);
      toast.success(
        result.data.matched
          ? `Matched with ${result.data.hostDomain}`
          : "Request saved — waiting for a suitable site",
      );
      router.refresh();
    });
  }

  function handleCancel(id: string) {
    setBusyId(id);
    startTransition(async () => {
      const result = await cancelRequest(websiteId, id);
      setBusyId(null);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Request cancelled, credit released");
      router.refresh();
    });
  }

  if (!status.joined || !status.acceptingLinks) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Link2 className="size-4" />
            Links from other websites
          </CardTitle>
          <CardDescription>
            Google trusts a website more when other sites link to it. Mention
            another business in your articles to earn a credit, then spend it to
            get a mention on someone else’s site.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="max-w-40 space-y-1.5">
            <Label htmlFor="cap">Mentions you will include each month</Label>
            <Input
              id="cap"
              type="number"
              min={1}
              max={20}
              value={cap}
              onChange={(e) => setCap(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Keep this low. A page full of links to other businesses looks
              suspicious to Google.
            </p>
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={() => handleJoin(true)} disabled={pending}>
            Join
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Link2 className="size-4" />
              Links from other websites
              <Badge>In the network</Badge>
            </CardTitle>
            <CardDescription>
              Hosting up to {status.monthlyCap} links a month (
              {status.linksGivenThisMonth} used).{" "}
              {status.network.withCapacity} site
              {status.network.withCapacity === 1 ? "" : "s"} available to link
              to you.
            </CardDescription>
          </div>
          <div className="text-right">
            <div className="text-3xl font-semibold tabular-nums">
              {status.available}
            </div>
            <div className="text-xs text-muted-foreground">
              credits available
              {status.reserved > 0 ? ` (${status.reserved} reserved)` : ""}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {/*
          Two sections rather than two tabs.
          
          The exchange only makes sense as a pair — credits earned by giving
          links are what pay for the ones received — and a tab hides half of
          that behind a click. Each section carries the sentence describing
          its own side of the trade.
        */}
        <div className="space-y-10">
          <section className="space-y-3">
            <div className="space-y-0.5">
              <h3 className="font-semibold">Backlinks received</h3>
              <p className="text-sm text-muted-foreground">
                Mentioned in other articles &rarr; Get backlinks &rarr; Spend
                credits
              </p>
            </div>
            {showRequest ? (
              <form onSubmit={handleRequest} className="space-y-3 rounded-xl border p-4">
              <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="target">
                      Which of your pages should be linked to?
                    </Label>
                    <button
                      type="button"
                      onClick={handleSuggest}
                      disabled={suggesting}
                      className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground disabled:opacity-50"
                    >
                      {suggesting ? "Reading your sitemap…" : "Suggest my pages"}
                    </button>
                  </div>
                  <Input
                    id="target"
                    value={targetUrl}
                    onChange={(e) => setTargetUrl(e.target.value)}
                    placeholder={`https://${"example.com"}/services`}
                    required
                  />
                  {/*
                    Suggestions fill the field rather than replacing it. Someone
                    who knows exactly which page they want should not have to
                    find it in a list, and a site with no sitemap still works.
                  */}
                  {suggestions.length > 0 ? (
                    <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-2">
                      {suggestions.map((page) => (
                        <button
                          key={page.url}
                          type="button"
                          onClick={() => setTargetUrl(page.url)}
                          className={`block w-full truncate rounded px-2 py-1 text-left text-xs hover:bg-accent ${
                            targetUrl === page.url ? "bg-accent" : ""
                          }`}
                        >
                          {page.path}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="anchor">Preferred wording (optional)</Label>
                  <Input
                    id="anchor"
                    value={anchor}
                    onChange={(e) => setAnchor(e.target.value)}
                    placeholder="teeth whitening in Dublin"
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" size="sm" disabled={pending}>
                    {pending ? "Requesting…" : "Request link (1 credit)"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowRequest(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <Button
                size="sm"
                onClick={() => setShowRequest(true)}
                disabled={status.available < 1}
              >
                <Plus className="size-4" />
                Request a link
              </Button>
            )}

            {status.available < 1 && !showRequest ? (
              <p className="text-sm text-muted-foreground">
                No credits left. Include a link for someone else to earn one, or
                wait for next month&apos;s allowance.
              </p>
            ) : null}

            {requests.length === 0 ? (
              <EmptyState
                icon={Link2}
                title="No link requests yet"
                description="Request a link and we find another business in the network to publish it in their next article. Each live link costs one credit."
              />
            ) : (
              <ExchangeTable
                rows={requests}
                sortValue={(row) => new Date(row.createdAt).getTime()}
                minWidth="46rem"
                columns={[
                  {
                    key: "source",
                    header: "Source article",
                    hint: "The article on another website that links to you. Follow it to read the live link.",
                    render: (row) =>
                      row.liveUrl ? (
                        <a
                          href={row.liveUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex max-w-full items-center gap-1 truncate text-primary hover:underline"
                        >
                          <span className="truncate">
                            {row.liveUrl.replace(/^https?:\/\//, "")}
                          </span>
                          <ExternalLink
                            className="size-3 shrink-0"
                            aria-hidden="true"
                          />
                        </a>
                      ) : (
                        /*
                          No live URL yet, so the status IS the answer: there
                          is no article to name until someone publishes one.
                        */
                        <StatusBadge
                          status={row.status}
                          label={REQUEST_LABEL[row.status]}
                        />
                      ),
                  },
                  {
                    key: "website",
                    header: "Customer website",
                    hint: "The website in the network that published the link.",
                    secondary: true,
                    render: (row) => (
                      <span className="text-muted-foreground">
                        {row.hostDomain ?? "—"}
                      </span>
                    ),
                  },
                  {
                    key: "date",
                    header: "Date",
                    className: "w-32",
                    render: (row) => (
                      <span className="text-muted-foreground">
                        {new Date(row.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    ),
                  },
                  {
                    key: "credits",
                    header: "Credits used",
                    hint: "Credits spent on this link. Returned in full if the link is ever removed.",
                    className: "w-28 text-right",
                    render: (row) => (
                      <span className="tabular-nums text-primary">
                        -{row.creditsUsed}
                      </span>
                    ),
                  },
                  {
                    key: "cancel",
                    header: "",
                    className: "w-10",
                    render: (row) =>
                      row.status === "pending" || row.status === "matched" ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Cancel request"
                          disabled={pending && busyId === row.id}
                          onClick={() => handleCancel(row.id)}
                        >
                          {pending && busyId === row.id ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <X className="size-4" />
                          )}
                        </Button>
                      ) : null,
                  },
                ]}
              />
            )}
          </section>

          <section className="space-y-3">
            <div className="space-y-0.5">
              <h3 className="font-semibold">Backlinks given</h3>
              <p className="text-sm text-muted-foreground">
                Post articles &rarr; Give backlinks &rarr; Earn credits
              </p>
            </div>
            {given.length === 0 ? (
              <p className="py-2 text-sm text-muted-foreground">
                None yet. When we write your next article, a link to another
                business may be included and you will earn a credit.
              </p>
            ) : (
              <ExchangeTable
                rows={given}
                sortValue={(row) => new Date(row.createdAt).getTime()}
                minWidth="42rem"
                columns={[
                  {
                    key: "source",
                    header: "Source article",
                    hint: "Your article that carries the link.",
                    render: (row) =>
                      row.articleId ? (
                        <Link
                          href={`/websites/${websiteId}/articles/${row.articleId}`}
                          className="block max-w-full truncate text-primary hover:underline"
                        >
                          {row.articleTitle ?? "Untitled article"}
                        </Link>
                      ) : (
                        /*
                          The article can be gone — articleId is set null when
                          one is deleted — so the anchor text is the only thing
                          left describing the link.
                        */
                        <span className="text-muted-foreground">
                          {row.anchor ?? "—"}
                        </span>
                      ),
                  },
                  {
                    key: "website",
                    header: "Destination website",
                    hint: "The website your article links out to.",
                    secondary: true,
                    render: (row) => (
                      <span className="text-muted-foreground">
                        {row.destinationDomain ??
                          row.targetUrl.replace(/^https?:\/\//, "")}
                      </span>
                    ),
                  },
                  {
                    key: "date",
                    header: "Date",
                    className: "w-32",
                    render: (row) => (
                      <span className="text-muted-foreground">
                        {new Date(row.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    ),
                  },
                  {
                    key: "credits",
                    header: "Credits earned",
                    hint: "Credits this link earned you, to spend on links back to your own site.",
                    className: "w-28 text-right",
                    render: (row) => (
                      <span className="tabular-nums text-emerald-600 dark:text-emerald-400">
                        +{row.credits}
                      </span>
                    ),
                  },
                ]}
              />
            )}
          </section>
        </div>
      </CardContent>

      <CardFooter>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleJoin(false)}
          disabled={pending}
        >
          Leave
        </Button>
      </CardFooter>
    </Card>
  );
}
