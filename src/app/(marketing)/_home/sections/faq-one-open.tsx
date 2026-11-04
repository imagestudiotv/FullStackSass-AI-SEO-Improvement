"use client";

import { useEffect } from "react";

/**
 * One answer open at a time (the design's <script id="repget-faq-behavior">):
 * opening a question closes the others in the same section. Renders nothing;
 * without JavaScript every question still opens and closes on its own.
 *
 * `toggle` does not bubble, so it is caught on the way down instead.
 */
export function OneOpen({ sectionId }: { sectionId: string }) {
  useEffect(() => {
    const area = document.getElementById(sectionId);
    if (!area) return;
    const onToggle = (event: Event) => {
      const item = event.target;
      if (!(item instanceof HTMLDetailsElement) || !item.open) return;
      area.querySelectorAll("details").forEach((other) => {
        if (other !== item) other.open = false;
      });
    };
    area.addEventListener("toggle", onToggle, true);
    return () => area.removeEventListener("toggle", onToggle, true);
  }, [sectionId]);

  return null;
}
