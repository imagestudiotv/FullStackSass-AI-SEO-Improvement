import { inngest } from "@/inngest/client";
import { deleteOldThreads } from "@/lib/chat/store";

/** The AI chat's conversations are kept 30 days after their last message (client, 2026-10-31). */
export const chatCleanupDaily = inngest.createFunction(
  { id: "chat-cleanup-daily", retries: 1, triggers: [{ cron: "30 3 * * *" }] },
  async ({ step, logger }) => {
    const deleted = await step.run("delete-old-threads", () => deleteOldThreads());
    logger.info({ deleted }, "Old chat conversations deleted");
    return { deleted };
  },
);
