import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth-form";
import { getSession } from "@/lib/auth-guard";

export const metadata = { title: "Sign in" };

export default async function SignInPage() {
  if (await getSession()) {
    redirect("/dashboard");
  }
  return <AuthForm mode="sign-in" />;
}
