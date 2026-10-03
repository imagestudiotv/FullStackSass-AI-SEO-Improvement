import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { SIDEBAR_COOKIE } from "./_ui/nav";
import { AdminShell } from "./_ui/shell";
import { NotAdminError, requireAdmin } from "@/lib/admin/guard";
import { getSession } from "@/lib/auth-guard";

/**
 * Administrator area.
 *
 * Guarded at the layout AND in every action beneath it. A layout guard alone
 * is not an authorization boundary — layouts do not re-run on client-side
 * navigation under partial rendering — so requireAdmin() is called again in
 * each server action that reads cross-tenant data.
 */

// Reads the caller's session, so it can never be prerendered.
export const dynamic = "force-dynamic";

export const metadata = { title: { default: "Admin", template: "%s · RepGet Admin" } };

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (error) {
    // Rendered as a 404: to anyone who is not an admin, this area does not
    // exist. A 403 would confirm there is something here worth attacking.
    if (error instanceof NotAdminError) {
      notFound();
    }
    throw error;
  }

  /*
    Identity shown in the shell comes from the authenticated session only:
    the verified address requireAdmin() just checked, and the account's name.
  */
  const session = await getSession();
  const name = session?.user?.name?.trim() || null;

  // The sidebar's width, remembered so the server renders it without a jump.
  const collapsed = (await cookies()).get(SIDEBAR_COOKIE)?.value === "collapsed";

  return (
    <AdminShell identity={{ name, email: admin.email }} initialCollapsed={collapsed}>
      {children}
    </AdminShell>
  );
}
