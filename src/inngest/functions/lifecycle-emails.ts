import { inngest } from "@/inngest/client";
import { lifecycleEmailsEnabled, rememberSignupLocale } from "@/lib/email/lifecycle";
import {
  emailSetupReminder,
  emailTrialsEnding,
  emailTrialsProgress,
  emailWeeklySummary,
  emailWelcome,
  emailWinback,
  isoWeek,
  weeklySummaryOrganizations,
} from "@/lib/email/lifecycle-triggers";
import { isLocale } from "@/lib/i18n/config";

/**
 * The lifecycle emails that run on a clock (docs/emails.md). Each email
 * still goes through sendLifecycleEmail - the kill switch, the claim, the
 * unsubscribe - so a retried step or a re-run job sends nothing twice.
 *
 *  - lifecycle-signup: the welcome at sign-up, then, SETUP_WAIT later, the
 *    reminder to add a website - checked at that moment, so a website added
 *    meanwhile cancels it. Queued by the sign-up hook in lib/auth.ts.
 *  - lifecycle-hourly: the free periods that started a day ago get their
 *    first figures ("Fingers crossed!"), and those ending within a day their
 *    reminder - both read from the stored period and checked again then.
 *  - lifecycle-weekly-summary: Monday morning, one event per workspace on a
 *    plan; lifecycle-weekly-summary-one writes and sends each.
 *  - lifecycle-winback: WINBACK_WAIT after a subscription its customer left
 *    has ended, the win-back offer - checked again then (emailWinback).
 *    Queued by emailsAfterSubscriptionSync.
 */

/** How long after sign-up the setup reminder waits ("~3 hours"). */
export const SETUP_WAIT = "3h";

export const lifecycleSignup = inngest.createFunction(
  { id: "lifecycle-signup", retries: 3, triggers: [{ event: "email/user.signed-up" }] },
  async ({ event, step, logger }) => {
    const userId = String(event.data.userId ?? "");
    if (!userId) return { skipped: "no_user" };
    const locale = typeof event.data.locale === "string" && isLocale(event.data.locale) ? event.data.locale : null;
    if (locale) await step.run("remember-locale", () => rememberSignupLocale(userId, locale));
    const welcome = await step.run("welcome", () => emailWelcome(userId));
    await step.sleep("setup-wait", SETUP_WAIT);
    const reminder = await step.run("setup-reminder", () => emailSetupReminder(userId));
    logger.info({ userId, welcome: welcome.status, reminder: reminder.status }, "Sign-up emails done");
    return { welcome, reminder };
  },
);

export const lifecycleHourly = inngest.createFunction(
  { id: "lifecycle-hourly", retries: 1, triggers: [{ cron: "15 * * * *" }] },
  async ({ step }) => {
    if (!(await step.run("enabled", () => lifecycleEmailsEnabled()))) return { skipped: "disabled" };
    const trialProgress = await step.run("trial-progress", () => emailTrialsProgress());
    const trialEnding = await step.run("trial-ending", () => emailTrialsEnding());
    return { trialProgress, trialEnding };
  },
);

export const lifecycleWeeklySummary = inngest.createFunction(
  // Monday 08:00 UTC: morning in Europe, where RepGet's customers are.
  { id: "lifecycle-weekly-summary", retries: 1, triggers: [{ cron: "0 8 * * 1" }] },
  async ({ step }) => {
    if (!(await step.run("enabled", () => lifecycleEmailsEnabled()))) return { skipped: "disabled" };
    const at = new Date().toISOString();
    const organizations = await step.run("select-workspaces", () => weeklySummaryOrganizations());
    if (organizations.length > 0) {
      const week = isoWeek(new Date(at));
      await step.sendEvent(
        "queue-summaries",
        organizations.map((organizationId) => ({
          // One event per workspace and week, whatever re-runs this.
          id: `weekly-summary:${organizationId}:${week}`,
          name: "email/weekly-summary.requested",
          data: { organizationId, at },
        })),
      );
    }
    return { queued: organizations.length };
  },
);

export const lifecycleWeeklySummaryOne = inngest.createFunction(
  {
    id: "lifecycle-weekly-summary-one",
    retries: 2,
    concurrency: { limit: 5 },
    triggers: [{ event: "email/weekly-summary.requested" }],
  },
  async ({ event, step }) => {
    const organizationId = String(event.data.organizationId ?? "");
    const at = typeof event.data.at === "string" ? new Date(event.data.at) : new Date();
    return step.run("send", () => emailWeeklySummary(organizationId, at));
  },
);

/** How long after a subscription ends the win-back waits ("about 2 days"). */
export const WINBACK_WAIT = "2d";

export const lifecycleWinback = inngest.createFunction(
  { id: "lifecycle-winback", retries: 3, triggers: [{ event: "email/subscription.ended" }] },
  async ({ event, step, logger }) => {
    const subscriptionId = String(event.data.subscriptionId ?? "");
    if (!subscriptionId) return { skipped: "no_subscription" };
    await step.sleep("winback-wait", WINBACK_WAIT);
    const winback = await step.run("winback", () => emailWinback(subscriptionId));
    logger.info({ subscriptionId, winback: winback.status }, "Win-back email done");
    return { winback };
  },
);
