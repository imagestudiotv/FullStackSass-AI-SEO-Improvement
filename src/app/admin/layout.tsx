import { ArrowLeft, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminNav } from "./admin-nav";
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
    /*
      The same shell as the signed-in app: a tinted ground with cards on plain
      background, and a translucent sticky header. The admin area was a flat
      white page with a plain bar, so moving between the product and the
      operator tools felt like two different products.
    */
    <div className="flex min-h-svh flex-col bg-muted/30">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex h-14 items-center gap-4 px-4 md:px-6">
          <Link
            href="/admin"
            className="flex shrink-0 items-center gap-2 font-semibold"
          >
            {/*
              The badge is the point: this area moves money and deletes
              accounts, and it should never be mistaken for the customer app.
            */}
            <span className="flex size-6 items-center justify-center rounded-md bg-destructive/10">
              <ShieldAlert
                className="size-3.5 text-destructive"
                aria-hidden="true"
              />
            </span>
            Admin
          </Link>

          <div className="hidden min-w-0 flex-1 md:block">
            <AdminNav />
          </div>

          <Link
            href="/dashboard"
            className="ml-auto flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            Back to app
          </Link>
        </div>

        {/*
          On a narrow screen the sections move to their own row rather than
          being squeezed beside the title, where they scrolled off under the
          "Back to app" link.
        */}
        <div className="border-t px-2 py-1.5 md:hidden">
          <AdminNav />
        </div>
      </header>

      <main className="flex-1 p-4 md:p-6">{children}</main>
    </div>
  );
}
