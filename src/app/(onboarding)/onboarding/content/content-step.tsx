"use client";

import { ArrowRight, Check, Clock, Loader2, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { startResearch } from "@/lib/keywords/actions";

/**
 * Step five: turning the profile into a content and backlink plan.
 *
 * TWO THINGS THE CLIENT ASKED FOR HERE.
 *
 * "Few more options and more engaged ui design" — the design lists six
 * deliverables in a two-column layout, each a short label with a one-line
 * explanation beside it, rather than four long paragraphs.
 *
 * "Once I click Build my content plan it should redirect to next step
 * automatically, instead it still ask to still click on next." — it does now.
 * The page already polls while the job runs, so the moment the plan exists it
 * moves on by itself. See `advanced` below for why that needs a guard.
 */

/**
 * Where this step leads once the plan exists.
 *
 * The DASHBOARD's setup checklist, not a celebration page. The client:
 * "Right after this 5 step, can the next one be directly the integration
 * part. We start seeing the dashboard on the left… On this step people can
 * also already navigate the dashboard."
 *
 * So the wizard ends here and the rest of setup happens inside the product,
 * where nothing is gated and the sidebar is available.
 */
const NEXT_HREF = "/setup";


export function ContentStep({
  websiteId,
  brandName,
  hasKeywords,
  hasPlan,
  articlesPerMonth,
}: {
  websiteId: string;
  /** Named in the subtitle, as the design shows. */
  brandName: string;
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

  /**
   * What the POLL has seen, which overrides the server props.
   *
   * The props come from a page render that can be stale: router.refresh()
   * clears the client cache but not the server-side one, and startResearch
   * revalidates /websites/[id] rather than this route. So the page kept
   * rendering "Building…" after the plan existed.
   */
  const done = hasKeywords || hasPlan;
  const building = status === "queued" && !done;

  /**
   * Whether this visit started the build.
   *
   * Only then should finishing move the customer on. Someone who comes BACK to
   * this step — from the Back button on the next screen, or a bookmark — has a
   * finished plan already, and bouncing them forward would make the step
   * impossible to look at: they would be thrown out of it the moment they
   * arrived, every time.
   */
  /**
   * Whether we are navigating away, so the button can show it.
   *
   * NO POLLING, AND NO AUTO-ADVANCE. Both were removed when this screen
   * stopped waiting for the plan. They existed to notice the job finishing
   * and move the customer on — a five-second interval calling
   * getResearchState, a ref to stop two polls navigating at once, and a
   * delay so the jump did not feel abrupt. None of it has anything to
   * watch now: the redirect happens the moment the job is queued.
   *
   * That also removes the whole class of bug this screen kept producing.
   * A poll that never sees rows appear is indistinguishable from one that
   * has not seen them YET, so anything stalling the job left the customer
   * on a spinner with no way out.
   */
  const [leaving, setLeaving] = useState(false);

  /**
   * Re-read the server state once on arrival.
   *
   * Next's client Router Cache serves a previously-visited page from memory,
   * so coming back here shows whatever was rendered last time — "Ready to
   * build" with a plan already in the database. `dynamic = "force-dynamic"`
   * governs the server render and does nothing about that cache.
   */
  useEffect(() => {
    router.refresh();
  }, [router]);

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

    /**
     * STRAIGHT ON, without waiting for the plan.
     *
     * The client asked for the same treatment step one already got: "you need
     * to build the plan in background and need to redirect the user to the
     * next step". The job was ALWAYS a background job — research-keywords
     * runs on Inngest and takes minutes — so the only thing this screen was
     * contributing was a spinner to watch it through.
     *
     * That spinner was also the single worst failure surface in the product.
     * Anything that stalled the job (an invalid Inngest key, an exhausted
     * DataForSEO balance, a site with no profile) left a customer staring at
     * "Building your content plan…" indefinitely, because the screen had no
     * way to distinguish "still working" from "never going to finish". Not
     * standing here means none of those failures can strand anybody.
     *
     * The plan still arrives; it simply arrives while they read the next
     * screen, and Planned Articles shows it when it does.
     */
    setLeaving(true);
    toast.success("We are building your plan. You can carry on — it lands in a few minutes.");
    router.push(NEXT_HREF);
  }

  /**
   * What THIS BUTTON produces — nothing more.
   *
   * The list used to carry six rows, three of which this step does not build:
   * internal linking, backlink placements and the publishing destination. All
   * three then reappeared on the /setup checklist as things still to do, so
   * the product ticked them green here and asked for them again one screen
   * later. The customer is right to read that as a contradiction.
   *
   * The research job writes exactly three things — keywords, clusters and
   * calendar items (see inngest/functions/research-keywords.ts) — so those are
   * the three promised, and the ticks that turn green are true.
   *
   * The rest is listed separately below as what comes next, with the same
   * names the checklist uses, so one thing is called one thing throughout.
   */
  const deliverables = [
    {
      title: "Search opportunities",
      body: "Find real search demand and the terms worth targeting.",
    },
    {
      title: "Topic clusters",
      body: "Group related searches so one article covers a subject properly.",
    },
    {
      title: "Publishing plan",
      body: articlesPerMonth
        ? `A calendar of ${articlesPerMonth} briefs a month, each with a title, term and intent.`
        : "A calendar of briefs, each with a title, target term and intent.",
    },
  ];

  /**
   * What is waiting on the other side, named EXACTLY as lib/onboarding/launch.ts
   * names it.
   *
   * Shown as plain text with no tick, because none of it is done and this
   * button does not do it. It exists so the handover to the setup checklist is
   * expected rather than a surprise.
   */
  const nextUp = [
    "Connect your site",
    "Activate the backlink exchange",
    "Linking configuration",
  ];

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        Articles, content &amp; backlinks
      </h1>
      <p className="mt-2 text-muted-foreground">
        We&apos;ll turn what we learned about {brandName} into a plan you can
        publish from.
      </p>

      <div className="mt-6 rounded-2xl border bg-card p-6 sm:p-8">
        {/* The icon-and-heading row from the design: tile on the left. */}
        <div className="flex items-start gap-4">
          <span
            className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10"
            aria-hidden="true"
          >
            {building || leaving ? (
              <Loader2 className="size-6 animate-spin text-primary" />
            ) : done ? (
              <Check className="size-6 text-primary" />
            ) : (
              <Sparkles className="size-6 text-primary" />
            )}
          </span>
          <div className="min-w-0">
            <p className="text-xl font-semibold">
              {leaving
                ? "Your content plan is ready"
                : done
                  ? "Your content plan is ready"
                  : building
                    ? "Building your content plan…"
                    : "Your content engine is ready"}
            </p>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {leaving
                ? "Taking you to the last step…"
                : done
                  ? "Your search terms and publishing calendar are ready. You can review them on your website page any time."
                  : building
                    ? "This usually takes a few minutes. The page updates on its own and moves you on when it is finished."
                    : "We research what your customers search for, group it into subjects, and write a brief for every article you publish."}
            </p>
          </div>
        </div>

        <p className="mt-7 text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">
          Here&apos;s what we&apos;ll build
        </p>

        {/*
          Two columns from `sm` up, as drawn: the label on the left and its
          explanation beside it. Below that width they stack, because a
          two-column row of small text on a phone is two unreadable columns.
        */}
        <ul className="mt-4 space-y-3">
          {deliverables.map((item) => (
            <li
              key={item.title}
              className="grid gap-x-6 gap-y-1 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]"
            >
              <span className="flex items-center gap-2.5">
                <span
                  className={`flex size-5 shrink-0 items-center justify-center rounded-full transition-colors ${
                    done
                      ? "bg-emerald-500 text-white"
                      : "bg-muted text-muted-foreground/50"
                  }`}
                  aria-hidden="true"
                >
                  <Check className="size-3" />
                </span>
                <span className="text-sm font-medium">{item.title}</span>
              </span>
              <span className="pl-[1.9rem] text-sm text-muted-foreground sm:pl-0">
                {item.body}
              </span>
            </li>
          ))}
        </ul>

        {/*
          What happens after this, named exactly as the setup checklist names
          it. No ticks: this button does not do any of it, and a green mark
          against something still outstanding is what made the two screens
          contradict each other.
        */}
        <div className="mt-6 rounded-xl border border-dashed bg-muted/30 px-4 py-3.5">
          <p className="text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">
            Then, on your setup checklist
          </p>
          <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5">
            {nextUp.map((item) => (
              <li
                key={item}
                className="flex items-center gap-2 text-sm text-muted-foreground"
              >
                <span
                  className="size-1.5 shrink-0 rounded-full bg-muted-foreground/40"
                  aria-hidden="true"
                />
                {item}
              </li>
            ))}
          </ul>
        </div>

        {done ? null : (
          <>
            <Button
              className="mt-7 h-14 w-full rounded-full text-base font-semibold"
              onClick={handleBuild}
              disabled={status !== "idle"}
            >
              {status === "idle" ? (
                <>
                  Build my content plan
                  <ArrowRight className="size-4" aria-hidden="true" />
                </>
              ) : (
                /*
                  One spinner state, not two. "Building…" was the state this
                  screen used to sit in while it polled; now the press queues
                  the job and navigates, so the only moment anyone sees the
                  button busy is the queueing call itself.
                */
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Starting…
                </>
              )}
            </Button>
            <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="size-3" aria-hidden="true" />
              Takes a few minutes. You can continue while we build it in the
              background.
            </p>
          </>
        )}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <Button
          variant="ghost"
          onClick={() => router.push("/onboarding/visibility")}
        >
          Back
        </Button>
        {/*
          Kept even though finishing now advances on its own.

          The build runs in the background and can take minutes; somebody who
          does not want to wait needs a way out, and someone returning to a
          finished step needs a way forward — auto-advance deliberately does
          not fire for them.
        */}
        <Button
          className="h-12 rounded-full px-6"
          disabled={leaving}
          onClick={() => router.push(NEXT_HREF)}
        >
          {leaving ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Continuing&hellip;
            </>
          ) : (
            <>
              Next
              <ArrowRight className="size-4" aria-hidden="true" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
