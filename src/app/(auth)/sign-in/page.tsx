import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth-form";
import { safeNext } from "@/lib/auth/next";
import { getSession } from "@/lib/auth-guard";
import { getPublicMessages } from "@/lib/i18n/app-locale";

export const metadata = { title: "Sign in" };

/**
 * Someone already signed in has no business on this page - but WHERE they are
 * sent matters. It used to be the dashboard unconditionally, which quietly
 * broke invitation links: the invited person, already signed in, clicked the
 * link, was bounced here, and then bounced on to the dashboard with the
 * invitation forgotten. ?next= is honoured so they land where they were going.
 *
 * Validated by the same function the form uses - a path on this origin only,
 * never an absolute URL. See safeNext in lib/auth/next.ts. This used to be a
 * copy of those checks written out here, and the copy fell behind: it let
 * "/<TAB>/evil.com" through, which a browser turns into "//evil.com" once it
 * strips the tab - an open redirect from our own sign-in page. One function
 * is one rule.
 */
export default async function SignInPage({
  searchParams,
}: PageProps<"/sign-in">) {
  const { next, email } = await searchParams;
  const safe = safeNext(typeof next === "string" ? next : null);

  if (await getSession()) {
    redirect(safe);
  }
  const { t } = await getPublicMessages();
  return (
    <AuthForm
      mode="sign-in"
      /* An invitation link carries the invited address. See AuthForm. */
      initialEmail={typeof email === "string" ? email : ""}
      t={t.app.auth}
    />
  );
}
