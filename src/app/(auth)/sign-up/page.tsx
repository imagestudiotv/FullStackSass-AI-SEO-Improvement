import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth-form";
import { getSession } from "@/lib/auth-guard";

export const metadata = { title: "Sign up" };

export default async function SignUpPage() {
  if (await getSession()) {
    redirect("/dashboard");
  }
  return <AuthForm mode="sign-up" />;
}
