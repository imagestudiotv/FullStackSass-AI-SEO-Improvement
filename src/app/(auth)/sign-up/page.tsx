import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth-form";
import { getSession } from "@/lib/auth-guard";
import { getPublicMessages } from "@/lib/i18n/app-locale";

export const metadata = { title: "Sign up" };

/**
 * Someone already signed in has no business on this page - but WHERE they are
 * sent matters. It used to be the dashboard unconditionally, which quietly
 * broke invitation links: the invited person, already signed in, clicked the
 * link, was bounced here, and then bounced on to the dashboard with the
 * invitation forgotten. ?next= is honoured so they land where they were going.
 *
 * Validated the same way the form validates it - a path on this origin only,
 * never an absolute URL. See safeNext in components/auth-form.tsx.
 */
export default async function SignUpPage({
  searchParams,
}: PageProps<"/sign-up">) {
  const { next } = await searchParams;
  const target = typeof next === "string" ? next : null;
  const safe =
    target &&
    target.startsWith("/") &&
    !target.startsWith("//") &&
    !target.startsWith("/\\")
      ? target
      : "/dashboard";

  if (await getSession()) {
    redirect(safe);
  }
  const { t } = await getPublicMessages();
  return <AuthForm mode="sign-up" t={t.app.auth} />;
}
