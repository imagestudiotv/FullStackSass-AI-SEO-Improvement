import { ArrowRight, Check } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { WizardProgress } from "@/components/wizard-progress";
import { requireSession } from "@/lib/auth-guard";
import { getOnboardingState } from "@/lib/onboarding/steps";
import { requireOrg } from "@/lib/tenant";

export const metadata = { title: "Ready to grow" };

export const dynamic = "force-dynamic";

/**
 * The last step.
 *
 * Deliberately short. Everything real happens elsewhere from here, and a
 * celebration screen that keeps someone from their dashboard is a page nobody
 * wants twice.
 */
export default async function OnboardingDonePage() {
  await requireSession();
  const { orgId } = await requireOrg();

  const state = await getOnboardingState(orgId);
  if (!state.websiteId) redirect("/onboarding/website");

  /**
   * What is genuinely finished, read from the same derived state the
   * checklist uses. A step still running says so rather than being ticked
   * optimistically.
   */
  const rows = state.steps
    .filter((step) => step.id !== "plan")
    .map((step) => ({ title: step.title, done: step.done }));

  return (
    <div>
      <WizardProgress current="done" />
      <div className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">
          You are set up
        </h1>
        <p className="mt-2 text-muted-foreground">
          Everything from here happens on its own. We will let you know when
          your first article and visibility check are ready.
        </p>

        <ul className="mt-8 space-y-2">
          {rows.map((row) => (
            <li
              key={row.title}
              className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3"
            >
              <span
                className={`flex size-6 shrink-0 items-center justify-center rounded-full ${
                  row.done
                    ? "bg-emerald-500 text-white"
                    : "border border-dashed border-muted-foreground/40"
                }`}
              >
                {row.done ? (
                  <Check className="size-3.5" aria-hidden="true" />
                ) : null}
              </span>
              <span
                className={`text-sm ${row.done ? "" : "text-muted-foreground"}`}
              >
                {row.title}
                {row.done ? null : (
                  <span className="ml-1.5 text-xs">— still running</span>
                )}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild className="h-11 rounded-full px-6">
            <Link href="/dashboard">
              Go to your dashboard
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-11 rounded-full px-6">
            <Link href={`/websites/${state.websiteId}`}>View my website</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
