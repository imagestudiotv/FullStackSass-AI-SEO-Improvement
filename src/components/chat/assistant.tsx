import { CHAT_FREE_PER_DAY } from "@/lib/chat/config";
import { freeLeftToday } from "@/lib/chat/quota";
import { listThreads } from "@/lib/chat/store";
import { readCreditSettings } from "@/lib/credits/prices";
import { CHAT_COPY } from "@/lib/i18n/chat";
import type { Locale } from "@/lib/i18n/config";

import { ChatPanel } from "./chat-panel";

/**
 * The AI chat on the Home page (client, 2026-10-31), above the task list.
 * What the panel needs to start: today's free messages left in the paying
 * workspace, the prices its cards show, and this person's earlier chats.
 */
export async function Assistant({
  websiteId,
  ownerOrgId,
  userId,
  canUse,
  locale,
  creditsCount,
}: {
  websiteId: string;
  ownerOrgId: string;
  userId: string;
  /** Owners and editors; a viewer cannot spend the owner's credits. */
  canUse: boolean;
  locale: Locale;
  /** "{count} credit|{count} credits" */
  creditsCount: string;
}) {
  const [freeLeft, settings, threads] = await Promise.all([
    freeLeftToday(ownerOrgId),
    readCreditSettings(),
    canUse ? listThreads(websiteId, userId) : Promise.resolve([]),
  ]);
  return (
    <ChatPanel
      websiteId={websiteId}
      canUse={canUse}
      locale={locale}
      t={CHAT_COPY[locale]}
      creditsCount={creditsCount}
      freePerDay={CHAT_FREE_PER_DAY}
      initialFreeLeft={freeLeft}
      prices={{
        chat_message: settings.prices.chat_message ?? 0,
        audit_rerun: settings.prices.audit_rerun ?? 0,
        video_post: settings.prices.video_post ?? 0,
      }}
      initialThreads={threads}
    />
  );
}
