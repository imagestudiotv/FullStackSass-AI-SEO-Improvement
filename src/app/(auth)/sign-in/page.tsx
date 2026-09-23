import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth-form";
import { getSession } from "@/lib/auth-guard";
import { getPublicMessages } from "@/lib/i18n/app-locale";

export const metadata = { title: "Sign in" };

export default async function SignInPage() {
  if (await getSession()) {
    redirect("/dashboard");
  }
  const { t } = await getPublicMessages();
  return <AuthForm mode="sign-in" t={t.app.auth} />;
}
