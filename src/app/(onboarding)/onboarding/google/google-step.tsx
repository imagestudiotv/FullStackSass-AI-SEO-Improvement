"use client";

import { ArrowRight, BarChart3, Check, Loader2, Search } from "lucide-react";
import { getMessages, type Messages } from "@/lib/i18n/messages";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { OnboardingAside } from "@/components/onboarding/onboarding-aside";
import { Button } from "@/components/ui/button";
import { WIZARD_STEPS, wizardStepIndex } from "@/lib/onboarding/wizard";
import {
  startGoogleConnect,
  type AnalyticsConnection,
} from "@/lib/analytics/actions";

/**
 * Connect Google, as onboarding step three.
 *
 * The same two data sources the dashboard shows — Analytics 4 and Search
 * Console — asked for once, here, where they are worth explaining. The
 * dashboard panel states them as a fact; this screen has to say why somebody
 * should hand over access at all, which is the difference between a settings
 * row and a step.
 *
 * ONE ACTION, NOT TWO. Google's consent screen covers both scopes in a single
 * pass, so two buttons would be two round trips for one grant.
 */
export function GoogleStep({
  websiteId,
  connection,
  t = getMessages("en").app.onboarding,
}: {
  websiteId: string;
  connection: AnalyticsConnection;
  /** This step's copy, defaulting to English. */
  t?: Messages["app"]["onboarding"];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [leaving, setLeaving] = useState(false);

  function handleConnect() {
    startTransition(async () => {
      const result = await startGoogleConnect(websiteId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      // Google's own consent screen; it returns to the callback route.
      window.location.href = result.data.url;
    });
  }

  function handleNext() {
    setLeaving(true);
    router.push(`/onboarding/visibility?site=${websiteId}`);
  }

  const connected = connection.connected;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
      <div className="grid items-stretch gap-10 lg:grid-cols-2 lg:gap-12">
        <div>
          {/*
            Derived, never written out. The plan screen carried a hardcoded
            "Step 03 / 03" while the bar above it showed 2 of 5, and adding
            this step would have broken it a second time.
          */}
          <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">
            Step {String(wizardStepIndex("google") + 1).padStart(2, "0")}{" "}
            <span className="text-muted-foreground">
              / {String(WIZARD_STEPS.length).padStart(2, "0")}
            </span>
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            {t.connectGoogle}
          </h1>
          <p className="mt-3 text-muted-foreground">
            Analytics and Search Console tell us which articles are working, so
            we can write more of what already earns you traffic.
          </p>

          <div className="mt-6 space-y-3">
            <SourceRow
              t={t}
              icon={BarChart3}
              name="Google Analytics 4"
              detail="Track AI-driven traffic and measure content performance."
              connected={connected}
            />
            <SourceRow
              t={t}
              icon={Search}
              name="Google Search Console"
              detail="Monitor organic search clicks and impressions."
              connected={connected}
            />
          </div>

          {connected ? (
            <p className="mt-6 flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
              <Check className="size-4" aria-hidden="true" />
              Connected. You can change this later in Integrations.
            </p>
          ) : (
            <Button
              onClick={handleConnect}
              disabled={pending}
              className="mt-6 h-14 w-full rounded-full text-base font-semibold"
            >
              {pending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {t.openingGoogle}
                </>
              ) : (
                "Connect Google"
              )}
            </Button>
          )}

          {/*
            SKIP IS ALWAYS OFFERED, and deliberately not styled as a
            secondary mistake. OAuth fails for reasons nothing here controls —
            the wrong Google account, an admin who has not granted access, a
            blocked popup — and a customer who has just paid must never be
            stuck behind a third party's consent screen. Everything after this
            works without it; the numbers simply arrive later.
          */}
          <Button
            variant={connected ? "default" : "ghost"}
            onClick={handleNext}
            disabled={leaving}
            className={
              connected
                ? "mt-4 h-14 w-full rounded-full text-base font-semibold"
                : "mt-3 w-full"
            }
          >
            {leaving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : connected ? (
              <>
                {t.continueLabel}
                <ArrowRight className="size-4" />
              </>
            ) : (
              "Skip for now"
            )}
          </Button>
        </div>

        <OnboardingAside
          title={t.whyWeAsk}
          note="We read performance only — clicks, impressions and sessions for your own site. We never post, change or delete anything in your Google account, and you can disconnect at any time."
        />
      </div>
    </div>
  );
}

/** One data source, with its connection state. */
function SourceRow({
  icon: Icon,
  name,
  detail,
  connected,
  t,
}: {
  t: Messages["app"]["onboarding"];
  icon: typeof BarChart3;
  name: string;
  detail: string;
  connected: boolean;
}) {
  return (
    <div
      className={`flex items-start gap-3 rounded-xl border p-4 ${
        connected ? "border-emerald-500/40 bg-emerald-500/5" : ""
      }`}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-background">
        <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{name}</p>
        <p className="text-sm text-muted-foreground">{detail}</p>
      </div>
      {connected ? (
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
          <Check className="size-3" aria-hidden="true" />
          {t.connected}
        </span>
      ) : null}
    </div>
  );
}
