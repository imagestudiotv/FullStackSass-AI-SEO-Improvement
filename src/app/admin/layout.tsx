import { BarChart3, Building2, FileText, ShieldAlert, Users } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { NotAdminError, requireAdmin } from "@/lib/admin/guard";

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

export const metadata = { title: "Admin" };

const NAV = [
  { href: "/admin", label: "Overview", icon: BarChart3 },
  { href: "/admin/organizations", label: "Organizations", icon: Building2 },
  { href: "/admin/articles", label: "Articles", icon: FileText },
  { href: "/admin/users", label: "Users", icon: Users },
];

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  try {
    await requireAdmin();
  } catch (error) {
    // Rendered as a 404: to anyone who is not an admin, this area does not
    // exist. A 403 would confirm there is something here worth attacking.
    if (error instanceof NotAdminError) {
      notFound();
    }
    throw error;
  }

  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b bg-background px-4">
        <Link href="/admin" className="flex items-center gap-2 font-semibold">
          <ShieldAlert className="size-4" />
          Admin
        </Link>
        <nav className="flex items-center gap-1 overflow-x-auto">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm text-foreground/80 hover:bg-accent hover:text-accent-foreground"
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          ))}
        </nav>
        <Link
          href="/dashboard"
          className="ml-auto text-sm text-muted-foreground hover:underline"
        >
          Back to app
        </Link>
      </header>
      <main className="flex-1 p-4 md:p-6">{children}</main>
    </div>
  );
}
