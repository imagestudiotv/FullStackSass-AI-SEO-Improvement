/**
 * The live chat's (Crisp) per-person record, ticket 2026-11-19 item 6:
 * "RepGet - Proactive Human Support During Onboarding". Re-exported by ./schema.
 *
 * One row per person, created the first time anything here happens to them.
 * Kept here rather than in Crisp because the spec asks for the welcome to be
 * remembered "so that the message cannot repeat across sessions, devices or
 * browsers": Crisp's own session is a cookie in one browser.
 *
 * Times are the application's UTC wall clock (new Date()), like the rest of
 * the schema; nothing compares them to the database's now().
 */

import { check, index, integer, text, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import { organization, user } from "./auth-tables";
import { timestamps } from "./columns";
import { pgTable } from "./table";

export const supportChatState = pgTable(
  "support_chat_state",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    /** The workspace they were in when the row was last written; SET NULL so a deleted workspace keeps the history. */
    organizationId: text("organization_id").references(() => organization.id, { onDelete: "set null" }),
    /**
     * When the onboarding welcome was claimed - the custom event
     * repget_onboarding_help_eligible is pushed to Crisp only by the browser
     * whose claim set this (lib/support/onboarding-welcome.ts). Never reset.
     */
    welcomedAt: timestamp("welcomed_at"),
    /** First time the chat was opened after the welcome (Crisp chat:opened). */
    welcomeOpenedAt: timestamp("welcome_opened_at"),
    /** First time it was closed again with nothing sent (chat:closed) - the closest signal Crisp gives to "dismissed". */
    welcomeDismissedAt: timestamp("welcome_dismissed_at"),
    /** First message they sent after the welcome (message:sent). */
    welcomeAnsweredAt: timestamp("welcome_answered_at"),
    /** When the app first saw their required setup steps all done, once they had been welcomed. */
    onboardingCompletedAt: timestamp("onboarding_completed_at"),
    /** First message sent or received in the chat inside the app: a conversation exists, so no welcome. */
    firstMessageAt: timestamp("first_message_at"),
    lastMessageAt: timestamp("last_message_at"),
    /** Support requests: bursts of messages they sent, a new one after SUPPORT_REQUEST_GAP_HOURS of quiet. */
    supportRequests: integer("support_requests").default(0).notNull(),
    lastRequestAt: timestamp("last_request_at"),
    ...timestamps,
  },
  (table) => [
    index("support_chat_state_welcomed_idx").on(table.welcomedAt),
    check("support_chat_state_requests_check", sql`${table.supportRequests} >= 0`),
  ],
);
