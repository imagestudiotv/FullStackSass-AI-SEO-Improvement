import { eq } from "drizzle-orm";
import Link from "next/link";

import { MobileNav } from "@/components/mobile-nav";
import { OrgSwitcher } from "@/components/org-switcher";
import { SidebarNav } from "@/components/sidebar-nav";
import { UserMenu } from "@/components/user-menu";
import { requireSession } from "@/lib/auth-guard";
import { db } from "@/lib/db";
import { organization } from "@/lib/db/schema";
import { requireOrg } from "@/lib/tenant";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const session = await requireSession();
  const { orgId, role } = await requireOrg();

  const org = await db.query.organization.findFirst({
    where: eq(organization.id, orgId),
  });

  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b bg-background px-4">
        <MobileNav />
        <Link href="/dashboard" className="font-semibold tracking-tight">
          AI SEO Platform
        </Link>
        <div className="ml-2 hidden sm:block">
          <OrgSwitcher
            currentOrgId={orgId}
            currentOrgName={org?.name ?? "Workspace"}
            role={role}
          />
        </div>
        <div className="ml-auto">
          <UserMenu
            name={session.user.name}
            email={session.user.email}
            image={session.user.image}
          />
        </div>
      </header>

      <div className="flex flex-1">
        <aside className="hidden w-60 shrink-0 border-r md:block">
          <div className="sticky top-14">
            <SidebarNav />
          </div>
        </aside>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
