import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { BrandLogo } from "@/components/brand-logo";
import { PartnerNavigation } from "@/components/partners/partner-navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";
import { isAdmin } from "@/lib/admin/guard";
import { getSession } from "@/lib/auth-guard";
import { getAppMessages } from "@/lib/i18n/app-locale";
import { partnerCopy } from "@/lib/partners/presentation/copy";
import { partnerViewer } from "@/lib/partners/presentation/guards";
import { partnerDeps } from "@/lib/partners/server";

/**
 * The partner portal: its own route group, NOT under the customer app.
 *
 * It needs a session and nothing else - no paid plan, no website and no
 * customer workspace (requireOrg is deliberately never called here, so a
 * visit cannot create one). Each page checks access again itself: a layout
 * does not re-run on client navigation and is not an authorization boundary.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Partner portal", template: "%s · RepGet partners" },
  robots: { index: false, follow: false },
};

export default async function PartnerLayout({ children }: LayoutProps<"/partner">) {
  const session = await getSession();
  if (!session) redirect("/sign-in?next=/partner");
  const [viewer, { t, locale }, admin] = await Promise.all([partnerViewer(), getAppMessages(session.user.id), isAdmin()]);
  const copy = partnerCopy(locale).portal;

  const items =
    viewer.state === "partner"
      ? [
          { href: "/partner", label: copy.nav.overview },
          { href: "/partner/settings", label: copy.nav.settings },
        ]
      : [{ href: "/partner/apply", label: copy.nav.apply }];
  const testMode = viewer.state === "partner" && partnerDeps().settings.environment() === "test";

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="border-b">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-3 px-4">
          <Link href="/partner" className="rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring" aria-label={copy.title}>
            <BrandLogo height={22} priority />
          </Link>
          <span className="hidden text-sm font-medium text-muted-foreground sm:inline">{copy.title}</span>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/dashboard" className="hidden rounded-md px-2 py-1 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring sm:inline">
              {copy.nav.backToApp}
            </Link>
            <ThemeToggle label={t.app.common.darkMode} />
            <UserMenu name={session.user.name} email={session.user.email} image={session.user.image} isAdmin={admin} adminLabel={t.app.common.admin} />
          </div>
        </div>
      </header>
      <div className="mx-auto w-full max-w-5xl flex-1 px-4 pb-16">
        {testMode ? (
          <p className="mt-4 rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground" role="note">
            {copy.testMode}
          </p>
        ) : null}
        <div className="mt-4">
          <PartnerNavigation items={items} label={copy.title} />
        </div>
        <main className="mt-8">{children}</main>
      </div>
    </div>
  );
}
