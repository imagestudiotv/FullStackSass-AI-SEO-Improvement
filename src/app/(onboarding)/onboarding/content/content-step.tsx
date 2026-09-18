"use client";

import { ArrowRight, Check, Clock, Loader2, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { startResearch } from "@/lib/keywords/actions";

/**
 * Kicking off keyword research and the content calendar.
 *
 * The list below is what the pipeline actually produces. The reference also
 * promises a cannibalisation report, an internal linking map and a default
 * author profile; internal linking exists at article generation time rather
 * than as a plan artefact, and the other two we do not build — listing them
 * here would be describing a product the customer cannot then find.
 */
export function ContentStep({
  websiteId,
  hasKeywords,
  hasPlan,
  articlesPerMonth,
}: {
  websiteId: string;
  hasKeywords: boolean;
  hasPlan: boolean;
  /** Null when the plan is unlimited. */
  articlesPerMonth: number | null;
}) {
  const router = useRouter();

  /**
   * Three states, not two.
   *
   * startResearch only QUEUES an Inngest job — the keywords appear minutes
   * later. An earlier version left a single `running` flag set after a
   * successful queue, so the button sat on "Starting…" forever: the flag was
   * never cleared, and the refresh that followed could not see rows the job had
   * not written yet. It looked like nothing had happened when in fact the plan
   * was being built.
   */
  const [status, setStatus] = useState<"idle" | "queueing" | "queued">(
    hasKeywords || hasPlan ? "queued" : "idle",
  );

  const building = status === "queued" && !hasKeywords && !hasPlan;

  /**
   * Re-read the server state once on arrival.
   *
   * Next's client Router Cache serves a previously-visited page from memory, so
   * navigating back here with router.push showed the copy rendered BEFORE the
   * plan finished — "Ready to build" with the plan already sitting in the
   * database. `dynamic = "force-dynamic"` governs the server render and does
   * nothing about that cache. A refresh on mount discards it.
   */
  useEffect(() => {
    router.refresh();
  }, [router]);

  /**
   * While the job runs, ask the server for its result.
   *
   * Without this the page only updates if the customer reloads it themselves,
   * which is exactly what someone watching a spinner will not think to do.
   * Stops as soon as rows exist, so a finished plan costs nothing.
   */
  useEffect(() => {
    if (!building) return;

    const timer = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(timer);
  }, [building, router]);

  async function handleBuild() {
    setStatus("queueing");
    const result = await startResearch(websiteId);

    if (!result.ok) {
      // Back to idle so the button is clickable again — a failed queue that
      // leaves the control disabled strands the customer with no way to retry.
      setStatus("idle");
      toast.error(result.error);
      return;
    }

    setStatus("queued");
    toast.success("We are building your plan. This takes a few minutes.");
    router.refresh();
  }

  const steps = [
    {
      title: "Search terms worth going after",
      body: "We work out what your customers actually type, then check real search volumes and how hard each term is to win.",
    },
    {
      title: "Topic clusters",
      body: "Related terms grouped together, so one article covers a subject properly instead of a dozen thin pages competing with each other.",
    },
    {
      title: "A publishing calendar",
      body: articlesPerMonth
        ? `One brief per article your plan includes — ${articlesPerMonth} a month — each with a title, target term and intent.`
        : "One brief per article, each with a title, target term and intent.",
    },
    {
      title: "Backlink placements",
      body: "Your article carries a link for another site in the network, and theirs carries one for you. Credits come with your plan.",
    },
  ];

  const done = hasKeywords || hasPlan;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-6 text-center">
        <span
          className="mx-auto flex size-10 items-center justify-center rounded-xl bg-primary/10"
          aria-hidden="true"
        >
          {building ? (
            <Loader2 className="size-5 animate-spin text-primary" />
          ) : (
            <Sparkles className="size-5 text-primary" />
          )}
        </span>

        <p className="mt-4 font-medium">
          {done
            ? "Your plan is ready"
            : building
              ? "Building your plan…"
              : "Ready to build your content plan"}
        </p>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          {done
            ? "Your search terms and publishing calendar are ready. You can review them on your website page any time."
            : building
              ? "This usually takes a few minutes. The page updates on its own — you do not have to wait here."
              : "We research what your customers search for, group it into subjects, and write a brief for every article."}
        </p>

        <ul className="mt-6 space-y-3 text-left">
          {steps.map((step) => (
            <li key={step.title} className="flex gap-2.5">
              <Check
                className={`mt-0.5 size-4 shrink-0 ${
                  done
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-muted-foreground/40"
                }`}
                aria-hidden="true"
              />
              <div>
                <p className="text-sm font-medium">{step.title}</p>
                <p className="text-sm text-muted-foreground">{step.body}</p>
              </div>
            </li>
          ))}
        </ul>

        {done ? null : (
          <>
            <Button
              className="mt-6 h-11 rounded-full px-7"
              onClick={handleBuild}
              disabled={status !== "idle"}
            >
              {status === "idle" ? (
                "Build my plan"
              ) : (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {status === "queueing" ? "Starting…" : "Building…"}
                </>
              )}
            </Button>
            <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="size-3" aria-hidden="true" />
              Takes a few minutes. You do not have to wait here.
            </p>
          </>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 pt-2">
        <Button
          variant="ghost"
          onClick={() => router.push("/onboarding/visibility")}
        >
          Back
        </Button>
        <Button
          className="h-11 rounded-full px-6"
          onClick={() => router.push("/onboarding/done")}
        >
          Next
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
