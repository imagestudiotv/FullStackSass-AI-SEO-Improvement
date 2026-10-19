import type { FeedbackKind, FeedbackStatus } from "@/lib/feedback/shared";

import type { StatusTone } from "../_ui/status";

/** How Admin -> Feedback names a message's status and kind. */
export const STATUS_LABEL: Record<FeedbackStatus, { label: string; tone: StatusTone }> = {
  new: { label: "New", tone: "info" },
  planned: { label: "Planned", tone: "pending" },
  done: { label: "Done", tone: "success" },
  wont_do: { label: "Won't do", tone: "neutral" },
};

export const KIND_LABEL: Record<FeedbackKind, string> = { idea: "Idea", problem: "Problem", other: "Other" };

export const SOURCE_LABEL: Record<string, string> = { dashboard: "Customer", website: "Visitor" };
