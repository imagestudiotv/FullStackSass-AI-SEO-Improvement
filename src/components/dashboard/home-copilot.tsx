import type { ComponentProps } from "react";

import { Assistant } from "@/components/chat/assistant";

/**
 * Growth Copilot at the top of Home (Daniel, 2026-11-24): the same chat as on
 * its own page (/websites/<id>/copilot), with the same history and the same
 * free messages - the one component, not a copy.
 *
 * Its reads must not take Home down with them: without the chat, the rest of
 * the page still answers "how is my website doing".
 */
export async function HomeCopilot({ unavailable, ...props }: Omit<ComponentProps<typeof Assistant>, "standalone"> & { unavailable: string }) {
  try {
    return await Assistant(props);
  } catch (error) {
    console.error("[dashboard] growth copilot failed", error);
    return <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">{unavailable}</p>;
  }
}
