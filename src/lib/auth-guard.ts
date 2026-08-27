import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";

export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

/**
 * Use in the (app) layout AND in every server action / route handler that
 * touches tenant data. A layout guard alone is not a complete authorization
 * boundary: layouts do not re-run on client-side navigation under partial
 * rendering, so checks must also live close to the data.
 */
export async function requireSession() {
  const session = await getSession();
  if (!session) {
    redirect("/sign-in");
  }
  return session;
}
