import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { BrandLogo } from "@/components/brand-logo";
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
 * Three audiences, handled in order below:
 *
 *  1. Signed in as the invited address    -> one button, accept and go.
 *  2. Signed in as somebody ELSE          -> told whose invitation it is.
 *  3. Not signed in                       -> sent to sign-up, with the token
 *                                            carried in ?invite= so they land
 *                                            back here afterwards.
 */

export const dynamic = "force-dynamic";

export const metadata = { title: "Invitation" };

export default async function InvitePage({
  params,
}: PageProps<"/invite/[token]">) {
  const { token } = await params;
  const invitation = await lookupInvitation(token);
  const session = await getSession();

  if (invitation.state === "invalid") {
    return (
      <InviteShell
        title="This invitation is not valid"
        body="The link may have been used already, cancelled, or typed incorrectly. Ask whoever invited you to send a new one."
      />
    );
  }

  if (invitation.state === "expired") {
    return (
      <InviteShell
        title="This invitation has expired"
        body={`Invitations to ${invitation.domain} are valid for seven days. Ask whoever invited you to send a new one - it takes them a moment.`}
      />
    );
  }

  /*
    Not signed in. Sent to SIGN-UP rather than sign-in: the overwhelmingly
    common case for an invitation link is somebody who has no account, which
    is the entire reason the invitation exists. The email is prefilled and
    the token travels along, so accepting is the next thing that happens
    after the password is set. Someone who does have an account can switch
    to sign-in from there, and the token survives that too.
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
  */
  if (signedInAs !== invitation.email) {
    return (
      <InviteShell
        title="This invitation is for a different account"
        body={`It was sent to ${invitation.email}, but you are signed in as ${session.user.email}. Sign out and sign in with ${invitation.email} to accept it.`}
        action={
          <Button asChild variant="outline" size="sm">
            <Link href="/sign-in">Sign in as someone else</Link>
          </Button>
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
 * design built around a form, and there is no form here in three of the four
 * states.
 */
function InviteShell({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-muted/30 px-4 py-12">
      <div className="w-full max-w-md space-y-6 rounded-2xl border bg-card p-8 shadow-sm">
        <BrandLogo height={28} />

        <div className="space-y-2">
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {body}
          </p>
        </div>

        {action ?? (
          <Button asChild variant="outline" size="sm">
            <Link href="/">
              Go to RepGet
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
