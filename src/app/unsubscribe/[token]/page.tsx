import Link from "next/link";

import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { resolveAppLocale } from "@/lib/i18n/app-locale";
import { EMAILS_COPY } from "@/lib/i18n/emails";
import { verifyUnsubscribeToken } from "@/lib/email/unsubscribe-token";
import { wantsTips } from "@/lib/email/lifecycle";

/**
 * The page an unsubscribe link in a lifecycle email opens (docs/emails.md).
 *
 * OUTSIDE (app), like the invitation page: the reader is usually not signed
 * in, and the dashboard's session guard would send them to sign-in first -
 * the one thing an unsubscribe link must never do. The signed token is the
 * whole authority (lib/email/unsubscribe-token.ts).
 *
 * Opening it changes NOTHING. Mail scanners and link previews fetch every
 * link in a message; the change is the button, a POST to
 * /api/email/unsubscribe, which comes back here with ?done= to say what
 * happened. In the person's own language - the account's - since the token
 * says who they are.
 */

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Email preferences",
  // A personal link, never a search result.
  robots: { index: false, follow: false },
};

export default async function UnsubscribePage({ params, searchParams }: PageProps<"/unsubscribe/[token]">) {
  const { token } = await params;
  const done = (await searchParams).done;
  const userId = verifyUnsubscribeToken(token);
  const locale = userId ? await resolveAppLocale(userId).catch(() => "en" as const) : "en";
  const t = EMAILS_COPY[locale].unsubscribe;

  if (!userId) {
    return <UnsubscribeShell title={t.invalidTitle} body={t.invalidBody} action={<SettingsLink label={t.settingsLink} />} />;
  }

  const action = `/api/email/unsubscribe?token=${encodeURIComponent(token)}`;
  const subscribed = await wantsTips(userId).catch(() => true);

  if (!subscribed) {
    return (
      <UnsubscribeShell
        title={t.doneTitle}
        body={t.doneBody}
        action={
          <div className="flex flex-wrap items-center gap-3">
            <form method="post" action={action}>
              <input type="hidden" name="action" value="resubscribe" />
              <Button type="submit" variant="outline" size="sm">
                {t.resubscribeButton}
              </Button>
            </form>
            <SettingsLink label={t.settingsLink} />
          </div>
        }
      />
    );
  }

  if (done === "on") {
    return <UnsubscribeShell title={t.resubscribedTitle} body={t.resubscribedBody} action={<SettingsLink label={t.settingsLink} />} />;
  }

  return (
    <UnsubscribeShell
      title={t.confirmTitle}
      body={t.confirmBody}
      action={
        <div className="flex flex-wrap items-center gap-3">
          <form method="post" action={action}>
            <Button type="submit" size="sm">
              {t.confirmButton}
            </Button>
          </form>
          <SettingsLink label={t.settingsLink} />
        </div>
      }
    />
  );
}

function SettingsLink({ label }: { label: string }) {
  return (
    <Link href="/settings#emails" className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground">
      {label}
    </Link>
  );
}

/** The invitation page's frame: one card, the logo, a title, a line and the action. */
function UnsubscribeShell({ title, body, action }: { title: string; body: string; action: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-muted/30 px-4 py-12">
      <div className="w-full max-w-md space-y-6 rounded-2xl border bg-card p-8 shadow-sm">
        <BrandLogo height={28} />
        <div className="space-y-2">
          <h1 className="text-xl font-semibold tracking-tight break-words">{title}</h1>
          <p className="text-sm leading-relaxed break-words text-muted-foreground">{body}</p>
        </div>
        {action}
      </div>
    </div>
  );
}
