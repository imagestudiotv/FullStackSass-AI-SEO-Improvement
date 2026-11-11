"use server";

import { headers } from "next/headers";

import { isLocale } from "@/lib/i18n/config";
import { askGuestCopilot, guestRemaining, type GuestAnswer, type GuestTurn } from "@/lib/copilot/guest";
import { visitorKey } from "@/lib/visitor-key";

/**
 * The guest copilot's two calls from the browser (components/guest-copilot).
 * Who is asking comes from the request, never from the browser's word
 * (lib/visitor-key.ts); the limits are lib/copilot/guest.ts's.
 */

export async function askGuestCopilotAction(input: {
  question: string;
  history: GuestTurn[];
  website: string | null;
  locale: string;
}): Promise<GuestAnswer> {
  const visitor = visitorKey(await headers());
  return askGuestCopilot(
    {
      question: String(input?.question ?? ""),
      history: Array.isArray(input?.history) ? input.history : [],
      website: typeof input?.website === "string" ? input.website : null,
      locale: isLocale(input?.locale) ? input.locale : "en",
    },
    visitor,
  );
}

/** Questions left today, when the chat is first used on a page. */
export async function guestCopilotRemainingAction(): Promise<number> {
  return guestRemaining(visitorKey(await headers()));
}
