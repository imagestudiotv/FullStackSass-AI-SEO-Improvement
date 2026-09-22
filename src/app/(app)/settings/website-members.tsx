"use client";

import {
  Crown,
  Loader2,
  MoreVertical,
  Trash2,
  UserPlus,
} from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Messages } from "@/lib/i18n/messages";
import {
  addWebsiteMember,
  listWebsiteMembers,
  removeWebsiteMember,
  type WebsiteMember,
} from "@/lib/websites/members";

/**
 * Who can work on this website — "Members & roles" in the design.
 *
 * Scoped to one site on purpose: an editor invited to a client's site should
 * not gain anything on the others, which is the case workspace membership
 * cannot express. The workspace's own people are listed too, as the Admin
 * rows; they hold access through the account rather than through an invite.
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
  t,
}: {
  /** Every website this person owns. Access is granted per site. */
  sites: OwnedSite[];
  initialWebsiteId: string;
  initialMembers: WebsiteMember[];
  /** This screen's copy, already in the reader's language. */
  t: Messages["app"]["settings"];
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
  /**
   * The invite form lives in a dialog now, as the design's "Add member"
   * button implies. It used to sit open above the list, which put three
   * fields and a button in front of someone who had come to read the list.
   */
  const [inviteOpen, setInviteOpen] = useState(false);

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
      setInviteOpen(false);
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
      {/*
        Title on the left, "Add member" on the right, as the design has it.
        The site picker sits under the title rather than in the dialog: it
        decides what the whole table means, not just what an invite applies to.
      */}
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="space-y-1.5">
          <CardTitle className="text-base">{t.membersTitle}</CardTitle>
          <CardDescription>{t.membersSubtitle}</CardDescription>
        </div>

        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <UserPlus className="size-4" aria-hidden="true" />
              {t.addMember}
            </Button>
          </DialogTrigger>

          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t.addMember}</DialogTitle>
              <DialogDescription>{t.addMemberHelp}</DialogDescription>
            </DialogHeader>

            <form onSubmit={invite} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="member-email">{t.emailLabel}</Label>
                <Input
                  id="member-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder={t.emailPlaceholder}
                  autoComplete="off"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="member-role">{t.roleColumn}</Label>
                <Select
                  value={role}
                  onValueChange={(next) => setRole(next as "editor" | "viewer")}
                >
                  <SelectTrigger id="member-role" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="editor">{t.roleEditor}</SelectItem>
                    <SelectItem value="viewer">{t.roleViewer}</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{t.roleHelp}</p>
              </div>

              <DialogFooter>
                <Button type="submit" disabled={pending || !email.trim()}>
                  {pending ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <UserPlus className="size-4" aria-hidden="true" />
                  )}
                  {t.invite}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>

      <CardContent className="space-y-4">
        {/*
          Which site, when there is a choice to make. With one website this
          would be a control with a single option, and the table's own empty
          state already names the site.
        */}
        {sites.length > 1 ? (
          <div className="max-w-xs space-y-2">
            <Label htmlFor="member-website">{t.websiteLabel}</Label>
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

        {loadingMembers ? (
          <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed p-8 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            {t.loadingPeople}
          </div>
        ) : (
          /*
            A real table with Member / Role / Status headings, as drawn. The
            list was an unlabelled stack of rows before, which left the role
            pill and the trash icon to explain themselves.
          */
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.memberColumn}</TableHead>
                <TableHead>{t.roleColumn}</TableHead>
                <TableHead>{t.statusColumn}</TableHead>
                {/* The ⋮ column. Headed for screen readers, blank on screen. */}
                <TableHead className="w-12">
                  <span className="sr-only">{t.actionsColumn}</span>
                </TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {members.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="py-10 text-center text-sm text-muted-foreground"
                  >
                    {t.nobodyElse}
                  </TableCell>
                </TableRow>
              ) : (
                members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {/*
                          Initials in a coloured disc, as the design has it.

                          Derived from the name rather than stored: an avatar
                          upload is a file-handling feature, and initials
                          identify somebody in a short list perfectly well. The
                          colour comes from the email so a given person is the
                          same colour every time — a random one would reshuffle
                          on every render and stop being a recognition aid.
                        */}
                        <span
                          className={`flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${avatarColour(
                            member.email,
                          )}`}
                          aria-hidden="true"
                        >
                          {initials(member.name || member.email)}
                        </span>

                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {member.name || member.email}
                          </p>
                          <p className="truncate text-sm text-muted-foreground">
                            {member.email}
                          </p>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <span className="flex items-center gap-1.5">
                        {/* The crown the design puts beside Admin. */}
                        {member.isWorkspace ? (
                          <Crown
                            className="size-4 shrink-0 text-amber-500"
                            aria-hidden="true"
                          />
                        ) : null}
                        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium capitalize">
                          {member.role}
                        </span>
                      </span>
                    </TableCell>

                    {/*
                      Everyone listed has working access: the workspace rows
                      hold it through the account, and a website_members row
                      exists only once someone has an account to match. So the
                      column the design draws reads Active for every row —
                      which is true, rather than a placeholder. It becomes
                      worth reading the day pending invitations are listed
                      here too.
                    */}
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600">
                        <span
                          className="size-1.5 rounded-full bg-emerald-500"
                          aria-hidden="true"
                        />
                        {t.active}
                      </span>
                    </TableCell>

                    <TableCell>
                      {/*
                        No menu for the workspace people. Their access comes
                        from the account, so there is no website_members row to
                        delete — a "Remove" that silently did nothing would be
                        worse than no control at all. Removing them is a
                        workspace change, not a per-site one.
                      */}
                      {member.isWorkspace ? (
                        <span className="sr-only">
                          {member.email} has access through the workspace
                        </span>
                      ) : (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={pending}
                              aria-label={`Manage ${member.email}`}
                              className="text-muted-foreground"
                            >
                              {busyId === member.id ? (
                                <Loader2 className="size-4 animate-spin" />
                              ) : (
                                <MoreVertical className="size-4" />
                              )}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => remove(member.id, member.email)}
                            >
                              <Trash2 className="size-4" aria-hidden="true" />
                              {t.removeAccess}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
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
