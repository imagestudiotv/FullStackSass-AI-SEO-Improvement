"use client";

import { useEffect, useRef, useState } from "react";

import { seenPathOf, type AdminBadges } from "@/lib/admin/badges-shared";

const EVERY_MS = 60_000;

/**
 * The sidebar's counts: read when the admin opens, on every navigation, after
 * something on the page changed (the layout was rendered again: `renderedAt`),
 * and once a minute while the tab is in front. A read that fails keeps the
 * last counts; the sidebar never depends on one.
 */
export function useAdminBadges(pathname: string, renderedAt: number): AdminBadges {
  const [badges, setBadges] = useState<AdminBadges>({});
  const firstRender = useRef(renderedAt);

  useEffect(() => {
    const controller = new AbortController();
    let last = 0;

    async function load(opened: boolean, fresh: boolean) {
      last = Date.now();
      try {
        const response = await fetch(`/admin/badges${fresh ? "?fresh=1" : ""}`, {
          ...(opened && seenPathOf(pathname)
            ? { method: "POST", body: JSON.stringify({ path: pathname }), headers: { "content-type": "application/json" } }
            : {}),
          signal: controller.signal,
        });
        if (!response.ok) return;
        const next = (await response.json()) as AdminBadges;
        if (!controller.signal.aborted && next && typeof next === "object") setBadges(next);
      } catch {
        // Offline, aborted or refused: the counts stay as they were.
      }
    }

    const front = () => document.visibilityState === "visible";
    void load(true, firstRender.current !== renderedAt);
    firstRender.current = renderedAt;
    const timer = window.setInterval(() => {
      if (front()) void load(false, false);
    }, EVERY_MS);
    // Back in front after a while: not up to another minute of old counts.
    const onVisible = () => {
      if (front() && Date.now() - last >= EVERY_MS) void load(false, false);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [pathname, renderedAt]);

  return badges;
}
