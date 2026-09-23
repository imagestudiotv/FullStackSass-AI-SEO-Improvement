import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth-form";
import { getSession } from "@/lib/auth-guard";
import { getPublicMessages } from "@/lib/i18n/app-locale";

export const metadata = { title: "Sign up" };

export default async function SignUpPage() {
  if (await getSession()) {
    redirect("/dashboard");
  }
  const { t } = await getPublicMessages();
  return <AuthForm mode="sign-up" t={t.app.auth} />;
}
