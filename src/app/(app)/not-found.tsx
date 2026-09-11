import { Compass } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";

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

export default function AppNotFound() {
  return (
    <PageShell>
      <EmptyState
        icon={Compass}
        title="This page is not available"
        description="The page may have moved, or it belongs to a workspace you are not a member of."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button asChild size="sm">
              <Link href="/dashboard">Back to dashboard</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/websites">View your websites</Link>
            </Button>
          </div>
        }
      />
    </PageShell>
  );
}
