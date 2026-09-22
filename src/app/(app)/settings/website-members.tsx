"use client";

import { Loader2, Trash2, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/ui/states";
import {
  addWebsiteMember,
  listWebsiteMembers,
  removeWebsiteMember,
  type WebsiteMember,
} from "@/lib/websites/members";

/**
 * Who else can work on this website.
 *
 * Scoped to one site on purpose: an editor invited to a client's site should
 * not gain anything on the others, which is the case workspace membership
 * cannot express.
 *
 * Matches an existing account by email rather than sending an invitation.
 * Email needs a provider, a token table and an expiry policy; matching an
 * account covers the case actually asked for — a colleague or freelancer who
 * already uses the product — and anyone else signs up first, which they would
 * have to do regardless.
 */
export type OwnedSite = { id: string; domain: string };

export function WebsiteMembers({
  sites,
  initialWebsiteId,
  initialMembers,
}: {
  /** Every website this person owns. Access is granted per site. */
  sites: OwnedSite[];
  initialWebsiteId: string;
  initialMembers: WebsiteMember[];
}) {
  const router = useRouter();
  const [websiteId, setWebsiteId] = useState(initialWebsiteId);
  const [members, setMembers] = useState(initialMembers);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"editor" | "viewer">("editor");
  const [pending, startTransition] = useTransition();
  const [loadingMembers, setLoadingMembers] = useState(false);
  /** The site whose reply we still want, so a slow earlier one is ignored. */
  const wantedSite = useRef(initialWebsiteId);
  const [busyId, setBusyId] = useState<string | null>(null);

  const domain =
    sites.find((site) => site.id === websiteId)?.domain ?? "this website";

  /**
   * Loads the people on a site.
   *
   * Driven by the change event rather than an effect on websiteId. An effect
   * would also have to re-sync whenever the server re-rendered this panel, and
   * a router.refresh() hands back a new initialMembers array each time — so a
   * late server prop could overwrite the list for the site actually picked.
   * Fetching where the choice is made has no such race.
   *
   * Fetched rather than navigated because the choice is local to this panel;
   * putting it in the URL would make the rest of Settings, which follows the
   * sidebar's website, disagree with it. The server action re-checks access,
   * so a forged id throws rather than returning someone else's collaborators.
   */
  async function loadMembers(id: string) {
    setLoadingMembers(true);
    try {
      const rows = await listWebsiteMembers(id);
      // Ignore a slow reply for a site that is no longer the chosen one.
      if (wantedSite.current !== id) return;
      setMembers(rows);
    } catch {
      if (wantedSite.current !== id) return;
      setMembers([]);
      toast.error("Could not load who works on this website.");
    } finally {
      if (wantedSite.current === id) setLoadingMembers(false);
    }
  }

  function pickWebsite(id: string) {
    wantedSite.current = id;
    setWebsiteId(id);
    // Clear first: showing the previous site's people under a new domain, even
    // briefly, reads as though those people have access to it.
    setMembers([]);
    void loadMembers(id);
  }

  /** Re-reads the current site's list after a change, without a navigation. */
  async function refreshMembers() {
    try {
      setMembers(await listWebsiteMembers(websiteId));
    } catch {
      router.refresh();
    }
  }

  function invite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await addWebsiteMember(websiteId, email, role);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${email} can now work on ${domain}`);
      setEmail("");
      await refreshMembers();
    });
  }

  function remove(memberId: string, memberEmail: string) {
    setBusyId(memberId);
    startTransition(async () => {
      const result = await removeWebsiteMember(websiteId, memberId);
      setBusyId(null);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${memberEmail} no longer has access`);
      await refreshMembers();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">People on your websites</CardTitle>
        <CardDescription>
          Access is given one website at a time. Someone invited here will not
          see your other sites or your billing.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <form onSubmit={invite} className="flex flex-wrap items-end gap-2">
          {/*
            Which site, first — it decides what everything below means. Only
            shown when there is a choice to make: with one website the select
            would be a control with a single option, and the heading under the
            list already names the site.
          */}
          {sites.length > 1 ? (
            <div className="min-w-48 flex-1 space-y-2">
              <Label htmlFor="member-website">Website</Label>
              <Select value={websiteId} onValueChange={pickWebsite}>
                <SelectTrigger id="member-website" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sites.map((site) => (
                    <SelectItem key={site.id} value={site.id}>
                      {site.domain}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="min-w-48 flex-1 space-y-2">
            <Label htmlFor="member-email">Email</Label>
            <Input
              id="member-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="editor@example.com"
              autoComplete="off"
            />
          </div>

          <div className="w-32 space-y-2">
            <Label htmlFor="member-role">Role</Label>
            <Select
              value={role}
              onValueChange={(next) => setRole(next as "editor" | "viewer")}
            >
              <SelectTrigger id="member-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="editor">Editor</SelectItem>
                <SelectItem value="viewer">Viewer</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button type="submit" disabled={pending || !email.trim()}>
            {pending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <UserPlus className="size-4" aria-hidden="true" />
            )}
            Invite
          </Button>
        </form>

        <p className="text-xs text-muted-foreground">
          An editor can write, edit and publish articles on {domain}. A viewer
          can read only.
        </p>

        {loadingMembers ? (
          <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed p-8 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Loading people on {domain}
          </div>
        ) : members.length === 0 ? (
          <EmptyState
            title={`Nobody else on ${domain}`}
            description="Invite a colleague or a freelance editor to work on this website."
          />
        ) : (
          <ul className="divide-y rounded-xl border">
            {members.map((member) => (
              <li
                key={member.id}
                className="flex flex-wrap items-center gap-3 p-3"
              >
                {/*
                  Initials in a coloured disc, as the design has it.

                  Derived from the name rather than stored: an avatar upload
                  is a file-handling feature, and initials identify somebody
                  in a three-row list perfectly well. The colour comes from
                  the email so a given person is the same colour every time -
                  a random one would reshuffle on every render and stop being
                  a recognition aid at all.
                */}
                <span
                  className={`flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${avatarColour(
                    member.email,
                  )}`}
                  aria-hidden="true"
                >
                  {initials(member.name || member.email)}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {member.name || member.email}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {member.email}
                  </p>
                </div>

                {/* Role, as its own column rather than trailing the email. */}
                <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-medium capitalize">
                  {member.role}
                </span>

                {/*
                  NO "Status" COLUMN, though the design shows one.

                  listWebsiteMembers returns people who have accepted - a
                  pending invitation lives in the invitation table and is not
                  in this list. Every row here is active, so a column reading
                  "Active" on every row would be decoration that looks like
                  information. It belongs here the day pending invites are
                  listed alongside accepted ones.
                */}

                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove ${member.email}`}
                  disabled={pending}
                  onClick={() => remove(member.id, member.email)}
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                >
                  {busyId === member.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Trash2 className="size-4" />
                  )}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/** Up to two initials, from a name or an email local part. */
function initials(value: string): string {
  const source = value.includes("@") ? value.split("@")[0] : value;
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((part) => part[0] ?? "");
  return letters.join("").toUpperCase() || "?";
}

/**
 * A stable colour per person, picked from the email.
 *
 * A fixed palette rather than a generated hue: these are Tailwind classes, so
 * an arbitrary colour would need inline styles, and six well-chosen ones all
 * carry white text legibly. A generated hue does not guarantee that.
 */
const AVATAR_COLOURS = [
  "bg-violet-500",
  "bg-sky-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-indigo-500",
];

function avatarColour(email: string): string {
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = (hash * 31 + email.charCodeAt(i)) | 0;
  }
  return AVATAR_COLOURS[Math.abs(hash) % AVATAR_COLOURS.length];
}
