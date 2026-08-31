import { eq } from "drizzle-orm";
import Link from "next/link";

import { MobileNav } from "@/components/mobile-nav";
import { OrgSwitcher } from "@/components/org-switcher";
import { SidebarNav } from "@/components/sidebar-nav";
import { UserMenu } from "@/components/user-menu";
import { isAdmin } from "@/lib/admin/guard";
import { requireSession } from "@/lib/auth-guard";
import { db } from "@/lib/db";
import { organization } from "@/lib/db/schema";
import { requireOrg } from "@/lib/tenant";

/**
 * Every authenticated route is per-request by definition: it reads the
 * caller's session and their organization's data. Without this Next tries to
 * prerender them at build time, which needs the auth secrets and fails a
 * deploy on any host where they are set as runtime-only variables.
 */
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const session = await requireSession();
  const { orgId, role } = await requireOrg();
  // Only admins see the link; the area itself 404s for everyone else.
  const admin = await isAdmin();

  const org = await db.query.organization.findFirst({
    where: eq(organization.id, orgId),
  });

  return (
    <div className="flex min-h-svh flex-col bg-muted/30">
      <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <MobileNav />
        <Link
          href="/dashboard"
          className="flex items-center gap-2 font-semibold tracking-tight"
        >
          <span className="flex size-6 items-center justify-center rounded-md bg-primary text-[11px] font-bold text-primary-foreground">
            AI
          </span>
          <span className="hidden sm:inline">SEO Platform</span>
        </Link>

        <div className="hidden sm:block">
          <OrgSwitcher
            currentOrgId={orgId}
            currentOrgName={org?.name ?? "Workspace"}
            role={role}
          />
        </div>

        <div className="ml-auto flex items-center gap-1">
          {admin ? (
            <Link
              href="/admin"
              className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              Admin
            </Link>
          ) : null}
          <UserMenu
            name={session.user.name}
            email={session.user.email}
            image={session.user.image}
          />
        </div>
      </header>

      <div className="flex flex-1">
        <aside className="hidden w-60 shrink-0 border-r bg-background md:block">
          <div className="sticky top-14 py-4">
            <SidebarNav />
          </div>
        </aside>
        {/*
          The page content sits on a slightly tinted ground while cards are
          plain background, so cards read as raised surfaces without needing
          heavy shadows.
        */}
        <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
