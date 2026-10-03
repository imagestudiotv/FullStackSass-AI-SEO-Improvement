"use client";

import { Crown, Loader2, MailX, MoreVertical, Send, Trash2, UserPlus, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Field } from "@/components/workspace/field";
import { Notice } from "@/components/workspace/notice";
import { WorkspaceSection } from "@/components/workspace/section";
import type { Locale } from "@/lib/i18n/config";
import { format, formatDate } from "@/lib/i18n/format";
import type { Messages } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils";
import type { ActionResult } from "@/lib/websites/actions";
import {
  addWebsiteMember,
  listWebsiteInvitations,
  listWebsiteMembers,
  removeWebsiteMember,
  resendWebsiteInvitation,
  revokeWebsiteInvitation,
  type WebsiteInvitation,
  type WebsiteMember,
} from "@/lib/websites/members";

import { syncMembers, type MemberLists } from "./members-sync";

/**
 * Who can work on a website - "Members & roles".
 *
 * Scoped to one site on purpose: an editor invited to a client's site gains
 * nothing on the others, which workspace membership cannot express. The
 * workspace's own people are listed too, as the Admin rows; they hold access
 * through the account rather than through an invite, so they have no menu.
 *
 * Only ever rendered for websites this person OWNS (the page decides), and
 * every action re-checks ownership on the server.
 */
export type OwnedSite = { id: string; domain: string };

/** The server's shape check (lib/websites/members.ts), asked first so the error is in the reader's language. */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Both lists for one site, in parallel: they render in one table, and
 * arriving separately would show the members and then reflow as the pending
 * rows appeared underneath.
 */
async function fetchLists(websiteId: string): Promise<MemberLists> {
  const [members, invitations] = await Promise.all([
    listWebsiteMembers(websiteId),
    listWebsiteInvitations(websiteId),
  ]);
  return { members, invitations };
}

type Confirming = { kind: "remove" | "revoke"; id: string; email: string };
type InviteError = { target: "email" | "form"; message: string };

export function WebsiteMembers({
  sites,
  initialWebsiteId,
  initialMembers,
  initialInvitations,
  initialError = false,
  ownEmail = "",
  viewingSharedDomain = null,
  locale,
  t,
  tWorkspace,
}: {
  /** Every website this person owns. Access is granted per site. */
  sites: OwnedSite[];
  initialWebsiteId: string;
  initialMembers: WebsiteMember[];
  /** Invitations sent but not yet accepted. */
  initialInvitations: WebsiteInvitation[];
  /** The server could not read the lists for the first render. */
  initialError?: boolean;
  /** The signed-in person's address: inviting yourself is refused before a round trip. */
  ownEmail?: string;
  /**
   * The website the rest of Settings is on, when it is one SHARED with this
   * person. This panel manages their OWN sites, so it says so rather than
   * leave them to think they are managing the site on screen.
   */
  viewingSharedDomain?: string | null;
  /** For dates in the reader's convention. */
  locale: Locale;
  /** This screen's copy, already in the reader's language. */
  t: Messages["app"]["settings"];
  /** Shared field and dialog words. */
  tWorkspace: Messages["app"]["workspace"];
}) {
  const router = useRouter();
  const [websiteId, setWebsiteId] = useState(initialWebsiteId);
  /*
    Copied from props ONCE. A router.refresh() or revalidatePath hands back
    new initial* props, and syncing from them would let a late server render
    overwrite the list for the site actually picked; every later read goes
    through syncMembers instead.
  */
  const [members, setMembers] = useState(initialMembers);
  const [invitations, setInvitations] = useState(initialInvitations);
  const [loadState, setLoadState] = useState<"idle" | "loading" | "error">(initialError ? "error" : "idle");
  /** The site whose replies we still want; anything else is dropped. */
  const wantedSite = useRef(initialWebsiteId);
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"editor" | "viewer">("editor");
  const [inviteError, setInviteError] = useState<InviteError | null>(null);
  const emailField = useRef<HTMLInputElement>(null);

  const [confirming, setConfirming] = useState<Confirming | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  /** The row whose menu opened the confirmation, to return focus to it. */
  const confirmRow = useRef<string | null>(null);
  /**
   * Set while a menu item hands over to the confirmation dialog, so the
   * closing menu does not pull focus back to its button as the dialog opens.
   */
  const handingToDialog = useRef(false);
  const menuCloseFocus = (event: Event) => {
    if (!handingToDialog.current) return;
    handingToDialog.current = false;
    event.preventDefault();
  };
  const addButton = useRef<HTMLButtonElement>(null);

  const domain = sites.find((site) => site.id === websiteId)?.domain ?? t.thisWebsite;

  const isCurrent = (id: string) => wantedSite.current === id;
  const applyLists = (lists: MemberLists) => {
    setMembers(lists.members);
    setInvitations(lists.invitations);
    setLoadState("idle");
  };

  /**
   * Loads the people on a site, driven by the choice itself rather than an
   * effect on websiteId (an effect would also re-run on every server
   * re-render). The server action re-checks access, so a forged id throws
   * rather than returning someone else's collaborators.
   */
  async function loadMembers(id: string) {
    setLoadState("loading");
    const outcome = await syncMembers(id, isCurrent, fetchLists, applyLists);
    if (outcome === "failed") {
      setMembers([]);
      setInvitations([]);
      setLoadState("error");
    }
  }

  function pickWebsite(id: string) {
    wantedSite.current = id;
    setWebsiteId(id);
    // Clear first: the previous site's people under a new domain, even
    // briefly, would read as though they have access to it.
    setMembers([]);
    setInvitations([]);
    void loadMembers(id);
  }

  /*
    Keeps the list current without a reload: quietly (no spinner, no error)
    when the tab comes back into view, and every 20 seconds while an
    invitation is still waiting - exactly when someone may be accepting it.
  */
  const waiting = invitations.some((invitation) => !invitation.expired);
  useEffect(() => {
    function quietly() {
      if (document.visibilityState === "hidden") return;
      // A background check that fails changes nothing on screen.
      void syncMembers(
        wantedSite.current,
        (id) => wantedSite.current === id,
        fetchLists,
        (lists) => {
          setMembers(lists.members);
          setInvitations(lists.invitations);
          setLoadState("idle");
        },
      );
    }
    window.addEventListener("focus", quietly);
    document.addEventListener("visibilitychange", quietly);
    const timer = waiting ? window.setInterval(quietly, 20_000) : null;
    return () => {
      window.removeEventListener("focus", quietly);
      document.removeEventListener("visibilitychange", quietly);
      if (timer !== null) window.clearInterval(timer);
    };
  }, [waiting, websiteId]);

  /**
   * Re-reads the site an action was taken on, after it, and applies the
   * answer only if that site is still the one on screen.
   */
  async function refreshAfterAction(id: string) {
    const outcome = await syncMembers(id, isCurrent, fetchLists, applyLists);
    if (outcome === "failed") router.refresh();
  }

  function openInvite(open: boolean) {
    setInviteOpen(open);
    if (!open) setInviteError(null);
  }

  function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleaned = email.trim().toLowerCase();
    if (!EMAIL_SHAPE.test(cleaned)) {
      setInviteError({ target: "email", message: t.invalidEmail });
      emailField.current?.focus();
      return;
    }
    if (ownEmail && cleaned === ownEmail.trim().toLowerCase()) {
      setInviteError({ target: "email", message: t.inviteSelf });
      emailField.current?.focus();
      return;
    }
    setInviteError(null);
    const id = websiteId;
    const siteDomain = domain;

    startTransition(async () => {
      let result: Awaited<ReturnType<typeof addWebsiteMember>>;
      try {
        result = await addWebsiteMember(id, email, role);
      } catch {
        setInviteError({ target: "form", message: t.inviteFailed });
        return;
      }
      if (!result.ok) {
        setInviteError({ target: "form", message: result.error });
        return;
      }

      /*
        The two paths produce different truths, so they say different things:
        someone only emailed a link cannot do anything until they accept it.
      */
      if (result.data.invited) {
        toast.success(`${t.inviteSent} - ${cleaned}`);
      } else if (result.data.emailSent) {
        toast.success(format(t.accessGranted, { email: cleaned, domain: siteDomain }));
      } else {
        // Granted, but the notification did not send: the owner must tell them.
        toast.success(format(t.accessGrantedNoEmail, { email: cleaned, domain: siteDomain }));
      }
      setEmail("");
      setRole("editor");
      setInviteOpen(false);
      await refreshAfterAction(id);
    });
  }

  /** Sends a fresh link; the old one stops working. Not destructive, so no confirmation. */
  function resend(invitationId: string, inviteEmail: string) {
    const id = websiteId;
    setBusyId(invitationId);
    startTransition(async () => {
      let result: ActionResult<null>;
      try {
        result = await resendWebsiteInvitation(id, invitationId);
      } catch {
        setBusyId(null);
        toast.error(t.actionFailed);
        return;
      }
      setBusyId(null);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${t.inviteResent} - ${inviteEmail}`);
      await refreshAfterAction(id);
    });
  }

  function askToConfirm(next: Confirming) {
    confirmRow.current = next.id;
    handingToDialog.current = true;
    setConfirmError(null);
    setConfirming(next);
  }

  /** Removing access or withdrawing an invitation, once confirmed in the dialog. */
  function runConfirmed() {
    if (!confirming) return;
    const { kind, id: rowId, email: rowEmail } = confirming;
    const id = websiteId;
    setConfirmError(null);
    setBusyId(rowId);
    startTransition(async () => {
      let result: ActionResult<null>;
      try {
        result = kind === "remove" ? await removeWebsiteMember(id, rowId) : await revokeWebsiteInvitation(id, rowId);
      } catch {
        setBusyId(null);
        setConfirmError(t.actionFailed);
        return;
      }
      setBusyId(null);
      if (!result.ok) {
        setConfirmError(result.error);
        return;
      }
      setConfirming(null);
      toast.success(
        kind === "remove" ? format(t.accessRemoved, { email: rowEmail }) : `${t.inviteCancelled} - ${rowEmail}`,
      );
      await refreshAfterAction(id);
    });
  }

  const roleLabel = (value: string) =>
    value === "admin" ? t.roleAdmin : value === "viewer" ? t.roleViewer : value === "editor" ? t.roleEditor : value;
  const expiry = (value: Date) =>
    formatDate(value, locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

  const guests = members.filter((person) => !person.isWorkspace);
  const onlyWorkspace = loadState === "idle" && guests.length === 0 && invitations.length === 0;

  return (
    <WorkspaceSection
      id="members"
      icon={Users}
      title={t.membersTitle}
      description={t.membersSubtitle}
      actions={
        <Dialog open={inviteOpen} onOpenChange={openInvite}>
          <DialogTrigger asChild>
            <Button ref={addButton} size="sm">
              <UserPlus className="size-4" aria-hidden="true" />
              {t.addMember}
            </Button>
          </DialogTrigger>
          {/* No zoom for people who asked for reduced motion (the shared dialog's own animation has no such variant). */}
          <DialogContent closeLabel={tWorkspace.close} className="sm:max-w-md motion-reduce:animate-none!">
            <DialogHeader>
              <DialogTitle>{t.addMember}</DialogTitle>
              <DialogDescription>
                {t.addMemberHelp} {format(t.inviteTo, { domain })}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={invite} noValidate className="space-y-5">
              <Field
                id="member-email"
                label={t.emailLabel}
                error={inviteError?.target === "email" ? inviteError.message : null}
                required
                t={tWorkspace}
              >
                {(props) => (
                  <Input
                    {...props}
                    ref={emailField}
                    type="email"
                    inputMode="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder={t.emailPlaceholder}
                    autoComplete="off"
                    readOnly={pending}
                  />
                )}
              </Field>

              {/* Two roles as a real radio group, each saying what it allows. */}
              <fieldset className="min-w-0 space-y-2">
                <legend className="text-sm font-medium text-foreground">{t.roleColumn}</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {(["editor", "viewer"] as const).map((option) => (
                    <label
                      key={option}
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors motion-reduce:transition-none",
                        "has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                        role === option ? "border-primary/40 bg-primary/5" : "hover:bg-muted/40",
                      )}
                    >
                      <input
                        type="radio"
                        name="member-role"
                        value={option}
                        checked={role === option}
                        onChange={() => setRole(option)}
                        disabled={pending}
                        className="mt-0.5 size-4 shrink-0 accent-primary outline-none"
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-foreground">
                          {option === "editor" ? t.roleEditor : t.roleViewer}
                        </span>
                        <span className="block text-xs leading-5 text-muted-foreground">
                          {option === "editor" ? t.roleEditorHelp : t.roleViewerHelp}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
                <p className="text-xs leading-5 text-muted-foreground">{t.reinviteHelp}</p>
              </fieldset>

              {inviteError?.target === "form" ? (
                <Notice tone="danger" role="alert">
                  {inviteError.message}
                </Notice>
              ) : null}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => openInvite(false)} disabled={pending}>
                  {t.cancel}
                </Button>
                <Button type="submit" disabled={pending}>
                  {pending ? (
                    <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                  ) : (
                    <UserPlus className="size-4" aria-hidden="true" />
                  )}
                  {pending ? t.inviting : t.invite}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      }
    >
      <div className="space-y-4">
        {viewingSharedDomain ? (
          <Notice tone="info">{format(t.viewingSharedNote, { domain: viewingSharedDomain })}</Notice>
        ) : null}

        {/*
          Which website this list is about, always. With several, a picker
          (held still while an action is in flight); with one, its name -
          the table used to give no hint which site it described.
        */}
        {sites.length > 1 ? (
          <Field id="member-website" label={t.websiteLabel} t={tWorkspace} className="max-w-xs">
            {(props) => (
              <Select value={websiteId} onValueChange={pickWebsite} disabled={pending}>
                <SelectTrigger id={props.id} aria-describedby={props["aria-describedby"]} className="w-full">
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
            )}
          </Field>
        ) : (
          <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="text-xs text-muted-foreground">{t.websiteLabel}</span>
            <span className="text-sm font-medium wrap-anywhere text-foreground">{domain}</span>
          </p>
        )}

        {loadState === "loading" ? (
          <div
            role="status"
            className="flex items-center justify-center gap-2 rounded-lg border border-dashed p-8 text-sm text-muted-foreground"
          >
            <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            {t.loadingPeople}
          </div>
        ) : loadState === "error" ? (
          <Notice
            tone="danger"
            role="alert"
            action={
              <Button size="sm" variant="outline" onClick={() => void loadMembers(websiteId)}>
                {t.retry}
              </Button>
            }
          >
            {t.loadPeopleFailed}
          </Notice>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <Table minWidth="34rem">
              <caption className="sr-only">{format(t.membersCaption, { domain })}</caption>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="px-4 text-xs text-muted-foreground">{t.memberColumn}</TableHead>
                  <TableHead className="text-xs text-muted-foreground">{t.roleColumn}</TableHead>
                  <TableHead className="text-xs text-muted-foreground">{t.statusColumn}</TableHead>
                  {/* The ⋮ column: headed for screen readers, blank on screen. */}
                  <TableHead className="w-12 pr-4">
                    <span className="sr-only">{t.actionsColumn}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {members.map((person) => (
                  <TableRow key={person.id}>
                    <TableCell className="px-4">
                      <div className="flex min-w-0 items-center gap-3">
                        {/*
                          Initials in a disc, coloured from the email so a
                          person keeps their colour; derived, not uploaded.
                        */}
                        <span
                          className={cn(
                            "flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white",
                            avatarColour(person.email),
                          )}
                          aria-hidden="true"
                        >
                          {initials(person.name || person.email)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{person.name || person.email}</p>
                          <p className="truncate text-sm text-muted-foreground">{person.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5">
                        {person.isWorkspace ? (
                          <Crown className="size-4 shrink-0 text-amber-500" aria-hidden="true" />
                        ) : null}
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
                          {roleLabel(person.role)}
                        </span>
                      </span>
                    </TableCell>
                    {/* Everyone listed has working access, so every member row reads Active. */}
                    <TableCell>
                      <StatusBadge status="active" label={t.active} />
                    </TableCell>
                    <TableCell className="pr-4">
                      {/*
                        No menu for the workspace's own people: their access
                        is the account, so there is no per-site row to delete.
                      */}
                      {person.isWorkspace ? (
                        <span className="sr-only">{format(t.workspaceAccess, { email: person.email })}</span>
                      ) : (
                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={pending}
                              data-row-menu={person.id}
                              aria-label={format(t.manageMember, { email: person.email })}
                              className="text-muted-foreground"
                            >
                              {busyId === person.id ? (
                                <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                              ) : (
                                <MoreVertical className="size-4" aria-hidden="true" />
                              )}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" onCloseAutoFocus={menuCloseFocus}>
                            <DropdownMenuItem
                              variant="destructive"
                              onSelect={() => askToConfirm({ kind: "remove", id: person.id, email: person.email })}
                            >
                              <Trash2 className="size-4" aria-hidden="true" />
                              {t.removeAccess}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                ))}

                {/*
                  Pending invitations under the people who have access - an
                  outbox, not members yet. Dashed disc, no initials: an invited
                  person has no account and so no name to draw from.
                */}
                {invitations.map((invitation) => (
                  <TableRow key={invitation.id} className="bg-muted/20">
                    <TableCell className="px-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <span
                          className="flex size-9 shrink-0 items-center justify-center rounded-full border border-dashed text-muted-foreground"
                          aria-hidden="true"
                        >
                          <UserPlus className="size-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{invitation.email}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {/* When the invitation EXPIRES, and saying so. */}
                            {invitation.expired
                              ? t.statusExpired
                              : `${t.statusPending} · ${format(t.invitationExpiresOn, { date: expiry(invitation.expiresAt) })}`}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        {roleLabel(invitation.role)}
                      </span>
                    </TableCell>
                    <TableCell>
                      {/* Amber for waiting, grey for expired - never the Active green. */}
                      {invitation.expired ? (
                        <StatusBadge status="expired" label={t.statusExpired} tone="neutral" />
                      ) : (
                        <StatusBadge status="pending" label={t.statusPending} tone="warning" />
                      )}
                    </TableCell>
                    <TableCell className="pr-4">
                      <DropdownMenu modal={false}>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={pending}
                            data-row-menu={invitation.id}
                            aria-label={format(t.manageInvitation, { email: invitation.email })}
                            className="text-muted-foreground"
                          >
                            {busyId === invitation.id ? (
                              <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                            ) : (
                              <MoreVertical className="size-4" aria-hidden="true" />
                            )}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onCloseAutoFocus={menuCloseFocus}>
                          <DropdownMenuItem onSelect={() => resend(invitation.id, invitation.email)}>
                            <Send className="size-4" aria-hidden="true" />
                            {t.resendInvite}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            variant="destructive"
                            onSelect={() => askToConfirm({ kind: "revoke", id: invitation.id, email: invitation.email })}
                          >
                            <MailX className="size-4" aria-hidden="true" />
                            {t.cancelInvite}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {onlyWorkspace ? <p className="text-sm text-muted-foreground">{t.nobodyElse}</p> : null}
      </div>

      {/*
        The confirmation for the two destructive actions. Focus returns to the
        row's menu button afterwards, or to "Add member" when the row is gone.
      */}
      <Dialog
        open={confirming !== null}
        onOpenChange={(open) => {
          if (!open && !pending) setConfirming(null);
        }}
      >
        <DialogContent
          closeLabel={tWorkspace.close}
          className="motion-reduce:animate-none!"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            const row = confirmRow.current;
            const trigger = row
              ? document.querySelector<HTMLButtonElement>(`[data-row-menu="${CSS.escape(row)}"]`)
              : null;
            (trigger && !trigger.disabled ? trigger : addButton.current)?.focus();
          }}
        >
          {confirming ? (
            <>
              <DialogHeader>
                <DialogTitle>
                  {format(confirming.kind === "remove" ? t.removeConfirmTitle : t.cancelInviteConfirmTitle, {
                    email: confirming.email,
                  })}
                </DialogTitle>
                <DialogDescription>
                  {confirming.kind === "remove"
                    ? format(t.removeConfirmBody, { domain })
                    : t.cancelInviteConfirmBody}
                </DialogDescription>
              </DialogHeader>
              {confirmError ? (
                <Notice tone="danger" role="alert">
                  {confirmError}
                </Notice>
              ) : null}
              <DialogFooter>
                <Button variant="outline" onClick={() => setConfirming(null)} disabled={pending}>
                  {confirming.kind === "remove" ? t.keepAccess : t.keepInvitation}
                </Button>
                <Button variant="destructive" onClick={runConfirmed} disabled={pending}>
                  {pending ? (
                    <>
                      <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                      {confirming.kind === "remove" ? t.removing : t.cancellingInvite}
                    </>
                  ) : confirming.kind === "remove" ? (
                    t.removeAccess
                  ) : (
                    t.cancelInvite
                  )}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </WorkspaceSection>
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
 * A stable colour per person, picked from the email: a fixed palette that
 * all carries white text legibly, so a given person is the same colour every
 * time.
 */
const AVATAR_COLOURS = ["bg-violet-500", "bg-sky-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-indigo-500"];

function avatarColour(email: string): string {
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = (hash * 31 + email.charCodeAt(i)) | 0;
  }
  return AVATAR_COLOURS[Math.abs(hash) % AVATAR_COLOURS.length];
}
