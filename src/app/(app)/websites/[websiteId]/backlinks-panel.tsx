"use client";

import { ExternalLink, Link2, Loader2, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

const REQUEST_STATUS: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" }
> = {
  pending: { label: "Finding a website", variant: "secondary" },
  matched: { label: "Waiting for their next article", variant: "secondary" },
  live: { label: "Live", variant: "default" },
  cancelled: { label: "Cancelled", variant: "destructive" },
  removed: { label: "Removed — credit returned", variant: "destructive" },
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
        <Tabs defaultValue="received">
          <TabsList>
            <TabsTrigger value="received">
              Links to you ({requests.length})
            </TabsTrigger>
            <TabsTrigger value="given">
              Links you give ({given.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="received" className="mt-4 space-y-3">
            {showRequest ? (
              <form onSubmit={handleRequest} className="space-y-3 rounded-lg border p-4">
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
              <p className="py-2 text-sm text-muted-foreground">
                No requests yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Your page</TableHead>
                      <TableHead className="w-48">Status</TableHead>
                      <TableHead className="hidden md:table-cell">From</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requests.map((request) => {
                      const meta =
                        REQUEST_STATUS[request.status] ?? REQUEST_STATUS.pending;
                      return (
                        <TableRow key={request.id}>
                          <TableCell className="max-w-56 truncate">
                            {request.targetUrl.replace(/^https?:\/\//, "")}
                          </TableCell>
                          <TableCell>
                            <Badge variant={meta.variant}>{meta.label}</Badge>
                          </TableCell>
                          <TableCell className="hidden text-muted-foreground md:table-cell">
                            {request.liveUrl ? (
                              <a
                                href={request.liveUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 hover:underline"
                              >
                                {request.hostDomain}
                                <ExternalLink className="size-3" />
                              </a>
                            ) : (
                              (request.hostDomain ?? "—")
                            )}
                          </TableCell>
                          <TableCell>
                            {request.status === "pending" ||
                            request.status === "matched" ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Cancel request"
                                disabled={pending && busyId === request.id}
                                onClick={() => handleCancel(request.id)}
                              >
                                {pending && busyId === request.id ? (
                                  <Loader2 className="size-4 animate-spin" />
                                ) : (
                                  <X className="size-4" />
                                )}
                              </Button>
                            ) : null}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="given" className="mt-4">
            {given.length === 0 ? (
              <p className="py-2 text-sm text-muted-foreground">
                None yet. When we write your next article, a link to another
                business may be included and you will earn a credit.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Links to</TableHead>
                      <TableHead className="w-28">Status</TableHead>
                      <TableHead className="w-20">Earned</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {given.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="max-w-56 truncate">
                          {row.targetUrl.replace(/^https?:\/\//, "")}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              row.status === "live" ? "default" : "secondary"
                            }
                          >
                            {row.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="tabular-nums">
                          +{row.credits}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>
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
