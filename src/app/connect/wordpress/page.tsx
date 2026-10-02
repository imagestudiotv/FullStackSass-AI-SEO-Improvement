import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { BrandLogo } from "@/components/brand-logo";
import { SwitchAccount } from "@/components/switch-account";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/auth-guard";
import { getAppMessages } from "@/lib/i18n/app-locale";
import { format } from "@/lib/i18n/format";
import { approveHandshake, loadForViewer, type Candidate, type PresentedKey } from "@/lib/plugin/handshake";
import { legacyRedirect } from "@/lib/site-url";
import { approveConnection, cancelConnection } from "./actions";

/**
 * Where "Connect to RepGet" in WordPress (plugin 1.7.0) sends the admin's
 * browser: a signed-in RepGet editor approves the WordPress site for one of
 * their websites, and the browser goes back to WordPress with a one-time
 * code (docs/wordpress-connect.md, lib/plugin/handshake.ts).
 *
 * OUTSIDE (app), like /invite: the dashboard shell would send a signed-out
 * visitor to sign-in and lose the request on the way. The request id is the
 * only thing in the address, and it does nothing by itself.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Connect WordPress",
  // The address names a request; it is nobody else's business.
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

export default async function ConnectWordPressPage({ searchParams }: PageProps<"/connect/wordpress">) {
  const { request, error } = await searchParams;
  const id = typeof request === "string" ? request : "";
  const here = `/connect/wordpress?request=${encodeURIComponent(id)}`;

  /*
    Plugin 1.7.0 starts the connection on the old Vercel address (its built-in
    default), so the button lands here on that host - where the customer is
    not signed in. Moved to the same page on repget.com, where they are,
    BEFORE anything reads the session: the request id is all the page needs,
    and the plugin only checks the link RepGet gave it, not where the browser
    ends up.
  */
  const canonical = legacyRedirect((await headers()).get("host"), here);
  if (canonical) redirect(canonical);

  const session = await getSession();
  if (!session) redirect(`/sign-in?next=${encodeURIComponent(here)}`);
  const viewer = { sessionId: session.session.id, userId: session.user.id };
  const { t } = await getAppMessages(viewer.userId);
  const m = t.app.wpConnect;
  const signedInAs = format(m.signedInAs, { email: session.user.email });

  const view = await loadForViewer(id, viewer);
  if (view.state === "gone") return <Shell title={m.goneTitle} body={m.goneBody} footnote={signedInAs} />;
  if (view.state === "other_browser") {
    return <Shell title={m.otherBrowserTitle} body={m.otherBrowserBody} footnote={signedInAs} />;
  }

  const { request: pending, candidates, presented } = view;
  const domain = pending.siteHost;
  let problem = error === "too_many_keys" || error === "not_allowed" ? error : null;

  /*
    Started with "Connect WordPress" in this same session, for a website this
    person can edit, and not moving the site away from another website:
    nothing to ask. Straight back to WordPress.
  */
  if (view.autoApprove && pending.websiteId && !problem) {
    const approved = await approveHandshake({ id, websiteId: pending.websiteId, ...viewer });
    if (approved.ok) redirect(approved.redirectTo);
    if (approved.reason === "too_many_keys" || approved.reason === "not_allowed") problem = approved.reason;
    else redirect(here);
  }

  // Pressed on one website's card: that website, when this person can still edit it.
  const shown =
    pending.origin === "repget" && candidates.some((candidate) => candidate.websiteId === pending.websiteId)
      ? candidates.filter((candidate) => candidate.websiteId === pending.websiteId)
      : candidates;

  const cancel = (
    <form action={cancelConnection}>
      <input type="hidden" name="request" value={id} />
      <Button type="submit" variant="ghost" size="sm">
        {m.cancel}
      </Button>
    </form>
  );

  if (shown.length === 0) {
    return (
      <Shell title={format(m.noneTitle, { domain })} body={format(m.noneBody, { domain })} footnote={signedInAs}>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild size="sm">
            <Link href="/websites/new">{m.addWebsite}</Link>
          </Button>
          <SwitchAccount label={m.useOtherAccount} next={here} />
          {cancel}
        </div>
      </Shell>
    );
  }

  const moving = presented !== null && shown.some((candidate) => candidate.websiteId !== presented.websiteId);

  return (
    <Shell
      title={format(m.confirmTitle, { domain })}
      body={format(m.confirmBody, { site: pending.wordpressAt })}
      footnote={signedInAs}
    >
      {problem ? (
        <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {problem === "too_many_keys" ? m.tooManyKeys : m.notAllowed}
        </p>
      ) : null}
      {moving && presented ? (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          {presented.workspaceName
            ? format(m.movedWarningNamed, { domain: presented.domain ?? domain, workspace: presented.workspaceName })
            : m.movedWarning}
        </p>
      ) : null}
      <ul className="space-y-3">
        {shown.map((candidate) => (
          <li key={candidate.websiteId} className="rounded-lg border p-3">
            <p className="text-sm font-medium">{candidate.brandName?.trim() || candidate.domain}</p>
            <p className="mb-3 text-xs text-muted-foreground">
              {candidate.domain} · {format(m.inWorkspace, { workspace: candidate.workspaceName })}
            </p>
            <form action={approveConnection}>
              <input type="hidden" name="request" value={id} />
              <input type="hidden" name="websiteId" value={candidate.websiteId} />
              <Button type="submit" size="sm">
                {buttonLabel(m, candidate, presented, domain)}
              </Button>
            </form>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-2">
        <SwitchAccount label={m.useOtherAccount} next={here} />
        {cancel}
      </div>
    </Shell>
  );
}

type Strings = Awaited<ReturnType<typeof getAppMessages>>["t"]["app"]["wpConnect"];

function buttonLabel(m: Strings, candidate: Candidate, presented: PresentedKey | null, domain: string): string {
  if (!presented) return format(m.connect, { domain });
  if (presented.websiteId === candidate.websiteId) return format(m.connectAgain, { domain });
  return format(m.move, { domain, workspace: candidate.workspaceName });
}

/** The frame every state renders into: the same small card as /invite. */
function Shell({
  title,
  body,
  footnote,
  children,
}: {
  title: string;
  body: string;
  footnote: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-muted/30 px-4 py-12">
      <div className="w-full max-w-md space-y-6 rounded-2xl border bg-card p-8 shadow-sm">
        <BrandLogo height={28} />
        <div className="space-y-2">
          <h1 className="text-xl font-semibold tracking-tight break-words">{title}</h1>
          <p className="text-sm leading-relaxed text-muted-foreground break-words">{body}</p>
        </div>
        {children}
        <p className="text-xs text-muted-foreground">{footnote}</p>
      </div>
    </div>
  );
}
