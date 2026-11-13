import { CheckCircle2, CircleDashed, EyeOff, type LucideIcon } from "lucide-react";

import type { StatusTone } from "../_ui/status";

/**
 * A post's status as the list and the editor show it. A post that was
 * published and then unpublished is a draft again, but it keeps its first
 * publication date and its fixed address, so it reads "Unpublished" rather
 * than "Draft" - otherwise a draft badge sits beside a publication date with
 * nothing to explain it.
 */
export function postStatus(
  status: string,
  everPublished: boolean,
): { tone: StatusTone; label: string; icon: LucideIcon; title: string } {
  if (status === "published") {
    return { tone: "success", label: "Published", icon: CheckCircle2, title: "Live on the blog" };
  }
  if (everPublished) {
    return {
      tone: "neutral",
      label: "Unpublished",
      icon: EyeOff,
      title: "A draft again after being published. Its address stays fixed.",
    };
  }
  return { tone: "neutral", label: "Draft", icon: CircleDashed, title: "Not on the blog. Only administrators can see it." };
}
