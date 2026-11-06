"use client";

import { useSelectedLayoutSegment } from "next/navigation";
import type { ReactNode } from "react";

/**
 * The panel beside the form: sign-up has its own (client's design, 2026-11-05:
 * "replace only the right side"), sign-in keeps the one it had.
 *
 * Asked here rather than in the layout because the layout does not re-render
 * when moving between the two pages, and a server component cannot see which
 * one is open. Both panels arrive already rendered, so switching draws nothing
 * late and the form beside it does not move.
 */
export function AuthAside({ signIn, signUp }: { signIn: ReactNode; signUp: ReactNode }) {
  return useSelectedLayoutSegment() === "sign-up" ? signUp : signIn;
}
