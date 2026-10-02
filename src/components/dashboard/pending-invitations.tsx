"use client";

import { Loader2, MailOpen } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { acceptPendingInvitationAction } from "@/app/(app)/dashboard/invitation-actions";
import { Button } from "@/components/ui/button";
import { format } from "@/lib/i18n/format";
import type { Messages } from "@/lib/i18n/messages";
import type { PendingInvitation } from "@/lib/websites/pending-invitations";

/** Only the wording this component shows, not the whole dashboard dictionary. */
type Text = Pick<
  Messages["app"]["dashboard"],
  | "invitesTitle"
  | "inviteBody"
  | "inviteBodyNoName"
  | "roleAnEditor"
  | "roleAViewer"
  | "acceptInvite"
  | "inviteAccepted"
>;

/**
 * What a card needs. Not the expiry: the server already left out anything
 * expired, and a countdown here would be stale the moment the page loaded.
 */
type Invitation = Pick<
  PendingInvitation,
  "id" | "domain" | "role" | "invitedByName"
>;

/**
 * Invitations waiting for the reader's verified address, one card each, on the
 * dashboard.
 *
 * WHY ON THE DASHBOARD. The emailed link used to be the only way in, and it
 * did not survive signing up: the invitee in production pressed "Continue with
 * Google", landed somewhere with no trace of the invitation, and never
 * accepted it. Listing it here puts it one click away however they arrived.
 *
 * A BUTTON, NEVER AN ACCEPTANCE ON LOAD. Granting access is a POST behind a
 * click (acceptPendingInvitationAction), for the same reason the /invite page
 * insists on one: a page that grants access on GET can be triggered by any
 * other site with an image tag. Whether this account may take the invitation
 * is decided on the server; the id is all this component sends.
 *
 * On success it goes to the dashboard FOR THAT SITE rather than staying put:
 * the person accepted in order to work on it, and the server action has
 * already made it the selected website.
 */
export function PendingInvitations({
  invitations,
  t,
  showHeading = true,
}: {
  invitations: Invitation[];
  t: Text;
  /**
   * False when the page header already says "You have been invited" (the
   * dashboard of someone whose only websites are these invitations), so the
   * heading is not repeated directly beneath itself.
   */
  showHeading?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  if (invitations.length === 0) return null;

  function accept(invitation: Invitation) {
    setBusyId(invitation.id);
    startTransition(async () => {
      const result = await acceptPendingInvitationAction(invitation.id);
      setBusyId(null);
      if (!result.ok) {
        /*
          Refreshed on failure too: the usual reason is that the invitation
          changed underneath the page (revoked, expired, accepted in another
          tab), and the card should disappear rather than invite a retry.
        */
        toast.error(result.error);
        router.refresh();
        return;
      }
      toast.success(format(t.inviteAccepted, { domain: invitation.domain }));
      router.push(`/dashboard?site=${result.websiteId}`);
      router.refresh();
    });
  }

  return (
    <section
      aria-labelledby={showHeading ? "pending-invitations-title" : undefined}
      aria-label={showHeading ? undefined : t.invitesTitle}
      className="space-y-3"
    >
      {showHeading ? (
        <h2
          id="pending-invitations-title"
          className="text-sm font-medium text-muted-foreground"
        >
          {t.invitesTitle}
        </h2>
      ) : null}
      <ul className="grid gap-3">
        {invitations.map((invitation) => {
          /*
            The role is a phrase written for this sentence in each language
            ("an editor", "en tant qu'éditeur"), never the bare chip label:
            articles and French elision do not survive being spliced in.
          */
          const role =
            invitation.role === "viewer" ? t.roleAViewer : t.roleAnEditor;
          const sentence = invitation.invitedByName
            ? format(t.inviteBody, {
                name: invitation.invitedByName,
                domain: invitation.domain,
                role,
              })
            : format(t.inviteBodyNoName, { domain: invitation.domain, role });
          const busy = pending && busyId === invitation.id;
          /*
            Ties each "Accept invitation" button to the sentence naming its
            site: with two invitations, a screen reader moving between the
            buttons otherwise hears the same words twice and cannot tell
            which one it would accept.
          */
          const sentenceId = `invite-${invitation.id}`;

          return (
            <li
              key={invitation.id}
              className="flex flex-wrap items-center gap-4 rounded-xl border border-primary/30 bg-primary/5 p-4"
            >
              <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-background">
                <MailOpen
                  className="size-4 text-primary"
                  aria-hidden="true"
                />
              </div>
              <p
                id={sentenceId}
                className="min-w-0 flex-1 text-sm break-words text-foreground"
              >
                {sentence}
              </p>
              <Button
                size="sm"
                className="shrink-0"
                aria-describedby={sentenceId}
                aria-busy={busy}
                // One acceptance at a time: two in flight would race for the
                // selected-website cookie and the navigation that follows.
                disabled={pending}
                onClick={() => accept(invitation)}
              >
                {busy ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : null}
                {t.acceptInvite}
              </Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
