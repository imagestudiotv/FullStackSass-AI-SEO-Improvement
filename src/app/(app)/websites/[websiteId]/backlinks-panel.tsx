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
import {
  cancelRequest,
  joinNetwork,
  leaveNetwork,
  requestBacklink,
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
  pending: { label: "Looking for a match", variant: "secondary" },
  matched: { label: "Matched, awaiting article", variant: "secondary" },
  live: { label: "Live", variant: "default" },
  cancelled: { label: "Cancelled", variant: "destructive" },
  removed: { label: "Removed, credit refunded", variant: "destructive" },
};

export function BacklinksPanel({ websiteId, status, requests, given }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showRequest, setShowRequest] = useState(false);
  const [targetUrl, setTargetUrl] = useState("");
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
            Backlink network
          </CardTitle>
          <CardDescription>
            Host a link in your articles for another business, and earn a credit
            to get a link back from a different site. Nobody links to the person
            who linked to them, so the links stay natural.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="max-w-40 space-y-1.5">
            <Label htmlFor="cap">Links you will host per month</Label>
            <Input
              id="cap"
              type="number"
              min={1}
              max={20}
              value={cap}
              onChange={(e) => setCap(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Keep this low. A site full of outbound links looks manipulated.
            </p>
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={() => handleJoin(true)} disabled={pending}>
            Join the network
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
              Backlink network
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
              Links you host ({given.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="received" className="mt-4 space-y-3">
            {showRequest ? (
              <form onSubmit={handleRequest} className="space-y-3 rounded-lg border p-4">
                <div className="space-y-1.5">
                  <Label htmlFor="target">Page you want links to</Label>
                  <Input
                    id="target"
                    value={targetUrl}
                    onChange={(e) => setTargetUrl(e.target.value)}
                    placeholder={`https://${"example.com"}/services`}
                    required
                  />
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
                No credits left. Host a link for someone else to earn one, or
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
                You have not hosted any links yet. When one of your articles is
                written, a link may be included and you will earn a credit.
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
          Leave the network
        </Button>
      </CardFooter>
    </Card>
  );
}
