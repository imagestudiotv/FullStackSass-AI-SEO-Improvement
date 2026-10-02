import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { BrandLogo } from "@/components/brand-logo";
import { SwitchAccount } from "@/components/switch-account";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/auth-guard";
import { lookupInvitation } from "@/lib/websites/accept-invitation";
import { AcceptInvitation } from "./accept-invitation-form";

/**
 * The page an invitation link opens.
 *
 * Deliberately OUTSIDE (app): the reader is usually not signed in, and often
 * has no account at all, so the dashboard shell and its session guard would
 * bounce them to /sign-in and lose the token on the way.
 *
 * Handled in order below:
 *
 *  1. Not valid or expired             -> said so, with a way on: the
 *                                         dashboard if signed in, sign-in if
 *                                         not.
 *  2. Not signed in                    -> sent to sign-up with the address
 *                                         prefilled and ?next= pointing back
 *                                         here, so they return to this page
 *                                         after creating the account.
 *  3. Signed in as somebody ELSE       -> told whose invitation it is, with a
 *                                         button that signs out and comes
 *                                         back here through sign-in.
 *  4. Signed in as the invited address -> one button, accept and go.
 *
 * Returning here is not accepting. Whatever route brings them back, the
 * Accept button still has to be pressed (see AcceptInvitation). Someone who
 * never presses it, with a proven address (Google or a one-time code), finds
 * the same invitation as a card on their dashboard.
 */

export const dynamic = "force-dynamic";

export const metadata = { title: "Invitation" };

export default async function InvitePage({
  params,
}: PageProps<"/invite/[token]">) {
  const { token } = await params;
  const invitation = await lookupInvitation(token);
  const session = await getSession();

  /*
    Both dead ends offer a way on rather than the marketing homepage, which
    is where "Go to RepGet" used to lead - a signed-in invitee clicking an old
    link ended up on a page with a "Sign up" button. The dashboard lists any
    invitation still waiting for them; signed out, sign-in is the only door.
  */
  const wayOn = session ? (
    <Button asChild size="sm">
      <Link href="/dashboard">
        Open RepGet
        <ArrowRight className="size-4" aria-hidden="true" />
      </Link>
    </Button>
  ) : (
    <Button asChild size="sm">
      <Link href="/sign-in">
        Sign in
        <ArrowRight className="size-4" aria-hidden="true" />
      </Link>
    </Button>
  );

  /*
    ONE ANSWER for unknown, accepted and revoked tokens, and one way on for
    all three. lookupInvitation already folds them together so a guessed
    token cannot learn whether it ever existed; a different button for an
    accepted link would undo that.
  */
  if (invitation.state === "invalid") {
    return (
      <InviteShell
        title="This invitation is not valid"
        body="The link may have been used already, cancelled, or typed incorrectly. Ask whoever invited you to send a new one."
        action={wayOn}
      />
    );
  }

  if (invitation.state === "expired") {
    return (
      <InviteShell
        title="This invitation has expired"
        body={`Invitations to ${invitation.domain} are valid for seven days. Ask whoever invited you to send a new one - it takes them a moment.`}
        action={wayOn}
      />
    );
  }

  /*
    Not signed in. Sent to SIGN-UP rather than sign-in: the overwhelmingly
    common case for an invitation link is somebody who has no account, which
    is the entire reason the invitation exists. The address is prefilled and
    ?next= points back here, so this page is where they land once the
    account exists - to press Accept, which is never done for them.

    What keeps ?next= alive on the way (components/auth-form.tsx):
     - the "Sign in" / "Sign up" switch link carries ?next= and the address,
       for somebody who turns out to have an account already;
     - a failed or cancelled Google sign-in returns to /sign-in with ?next=;
     - every successful one - Google, password or code - goes to ?next=.
  */
  if (!session) {
    const next = `/invite/${encodeURIComponent(token)}`;
    redirect(
      `/sign-up?email=${encodeURIComponent(invitation.email)}&next=${encodeURIComponent(next)}`,
    );
  }

  const signedInAs = session.user.email.trim().toLowerCase();

  /*
    Signed in as the wrong person. Shown rather than silently redirected:
    this is the case where somebody is already using RepGet with their
    personal address and was invited on their work one, and the fix is
    theirs to make. Naming both addresses is what makes it obvious.

    The button SIGNS OUT before going to sign-in. It used to be a plain link
    to /sign-in, which sends anyone with a session straight on - to the
    dashboard - so "Sign in as someone else" never let anyone sign in as
    anyone. It comes back here afterwards, with the invited address
    prefilled.
  */
  if (signedInAs !== invitation.email) {
    return (
      <InviteShell
        title="This invitation is for a different account"
        body={`It was sent to ${invitation.email}, but you are signed in as ${session.user.email}. Sign out and sign in with ${invitation.email} to accept it.`}
        action={
          <SwitchAccount
            label="Sign in as someone else"
            next={`/invite/${encodeURIComponent(token)}`}
            email={invitation.email}
          />
        }
      />
    );
  }

  return (
    <InviteShell
      title={`Join ${invitation.domain}`}
      body={
        invitation.invitedByName
          ? `${invitation.invitedByName} invited you to work on ${invitation.domain} as ${invitation.role === "viewer" ? "a viewer" : "an editor"}.`
          : `You have been invited to work on ${invitation.domain} as ${invitation.role === "viewer" ? "a viewer" : "an editor"}.`
      }
      action={<AcceptInvitation token={token} domain={invitation.domain} />}
    />
  );
}

/**
 * The frame every state above renders into.
 *
 * Its own small shell rather than the auth layout: that one is a two-column
 * design built around a form, and there is no form here in any of the states
 * - only a single button.
 */
function InviteShell({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action: React.ReactNode;
}) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-muted/30 px-4 py-12">
      <div className="w-full max-w-md space-y-6 rounded-2xl border bg-card p-8 shadow-sm">
        <BrandLogo height={28} />

        <div className="space-y-2">
          <h1 className="text-xl font-semibold tracking-tight break-words">
            {title}
          </h1>
          <p className="text-sm leading-relaxed break-words text-muted-foreground">
            {body}
          </p>
        </div>

        {action}
      </div>
    </div>
  );
}
