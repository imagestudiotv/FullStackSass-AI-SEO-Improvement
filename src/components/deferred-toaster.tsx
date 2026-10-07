"use client";

import { useEffect, useState, type ComponentType } from "react";

/**
 * The app's one toaster, mounted once the page has loaded.
 *
 * In the root layout so a toast survives moving between parts of the site
 * (an accepted invitation announces itself on the dashboard), as before. But
 * imported directly it made every public page download sonner before its
 * first paint (about 10 KB) for notifications public pages never show, and
 * PageSpeed counts those bytes against the mobile LCP.
 *
 * Nothing is lost by waiting: a toast fired before the toaster exists is
 * kept by sonner and shown as soon as it mounts.
 */
export function DeferredToaster() {
  const [Toaster, setToaster] = useState<ComponentType | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      import("@/components/ui/sonner")
        .then((m) => {
          if (!cancelled) setToaster(() => m.Toaster);
        })
        .catch(() => {
          // A toast is a courtesy; without its code the page still works.
        });
    };
    const whenIdle = () => {
      // Older Safari has no requestIdleCallback.
      if (typeof window.requestIdleCallback === "function") {
        window.requestIdleCallback(load, { timeout: 2000 });
      } else {
        setTimeout(load, 1);
      }
    };

    if (document.readyState === "complete") whenIdle();
    else window.addEventListener("load", whenIdle, { once: true });
    return () => {
      cancelled = true;
      window.removeEventListener("load", whenIdle);
    };
  }, []);

  return Toaster ? <Toaster /> : null;
}
