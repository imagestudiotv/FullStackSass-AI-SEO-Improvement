"use client";

import { useSyncExternalStore, type ReactNode } from "react";

/**
 * Tailwind's `xl` breakpoint, the width the hero's floating cards appear at.
 * In rem as Tailwind writes it, so the two agree when someone has changed
 * their browser's default font size.
 */
const WIDE = "(min-width: 80rem)";

function subscribe(onChange: () => void) {
  const query = window.matchMedia(WIDE);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/**
 * Renders its children only on a wide screen.
 *
 * For decoration that CSS already hides below `xl` (hidden xl:block): hidden
 * elements still cost a phone the HTML, the DOM and React's start-up work for
 * every one of them. On PageSpeed's slow phone that start-up is what kept the
 * home page's mobile score below green, so a phone now skips all three. (The
 * children are still part of the page's React data, which the server sends
 * whatever the width.)
 *
 * The server always renders nothing (it cannot know the width), and so does
 * the first browser render, so hydration matches; a wide screen then adds the
 * children straight away. Without JavaScript they never appear. Only for
 * aria-hidden, absolutely positioned decoration - anything a reader or search
 * engine needs must not go in here.
 */
export function WideScreenOnly({ children }: { children: ReactNode }) {
  const wide = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(WIDE).matches,
    () => false,
  );
  return wide ? children : null;
}
