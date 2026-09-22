import { Compass } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { requireSession } from "@/lib/auth-guard";
import { getAppMessages } from "@/lib/i18n/app-locale";

/**
 * 404 inside the signed-in app.
 *
 * Reached two ways, and the wording has to serve both without saying which:
 * a genuinely mistyped address, and requireWebsite() refusing a website id
 * that belongs to another organisation. The second is why this says "not
 * available" rather than "does not exist" — confirming that an id exists but
 * is someone else's is exactly the disclosure tenant.ts avoids by raising 404
 * instead of 403.
 */

export default async function AppNotFound() {
  /*
    Rendered inside (app)/layout.tsx, which has already required a session —
    so reading the language preference here cannot add a redirect.
  */
  const session = await requireSession();
  const { t } = await getAppMessages(session.user.id);

  return (
    <PageShell>
      <EmptyState
        icon={Compass}
        title={t.app.common.notAvailable}
        description={t.app.common.notAvailableHelp}
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button asChild size="sm">
              <Link href="/dashboard">{t.app.common.backToDashboard}</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/websites">{t.app.common.viewWebsites}</Link>
            </Button>
          </div>
        }
      />
    </PageShell>
  );
}
