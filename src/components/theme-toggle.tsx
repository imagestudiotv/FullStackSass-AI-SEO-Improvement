"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { THEME_KEY, type Theme } from "@/lib/theme";
import { cn } from "@/lib/utils";

/**
 * The night mode button (lib/theme.ts): a moon while the page is light, a sun
 * while it is dark. One label in the reader's language ("Dark mode"), with
 * aria-pressed saying whether it is on - so a screen reader hears "Dark mode,
 * toggle button, pressed" rather than an icon name.
 *
 * The state is the page itself (the `dark` class on <html>), not React state:
 * the early script sets it before React exists, every button on the page
 * reads the same thing, and another tab's choice arrives through the storage
 * event.
 */

function isDark(): boolean {
  return document.documentElement.classList.contains("dark");
}

/** Applies a theme to this page and remembers it in this browser. */
export function setTheme(theme: Theme): void {
  document.documentElement.classList.toggle("dark", theme === "dark");
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Storage refused (a private window): this page still switches.
  }
}

function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  // The choice made in another tab.
  const onStorage = (event: StorageEvent) => {
    if (event.key === THEME_KEY) document.documentElement.classList.toggle("dark", event.newValue === "dark");
  };
  window.addEventListener("storage", onStorage);
  return () => {
    observer.disconnect();
    window.removeEventListener("storage", onStorage);
  };
}

/** Whether the page is dark now; light on the server, which never knows. */
export function useDarkTheme(): boolean {
  return useSyncExternalStore(subscribe, isDark, () => false);
}

export function ThemeToggle({ label, className }: { label: string; className?: string }) {
  const dark = useDarkTheme();
  /*
    A page drawn in the browser rather than sent as HTML - the "page not
    found" answer is an empty error shell React fills in - never runs the
    early script: a browser does not run a script React adds. So the button
    applies the remembered choice when it appears. Elsewhere it is already
    on, and this changes nothing.
  */
  useEffect(() => {
    try {
      if (localStorage.getItem(THEME_KEY) === "dark") document.documentElement.classList.add("dark");
    } catch {
      // Storage refused: the page stays light.
    }
  }, []);
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={label}
      aria-pressed={dark}
      title={label}
      className={cn("shrink-0", className)}
      onClick={() => setTheme(dark ? "light" : "dark")}
    >
      {dark ? <Sun className="size-5" aria-hidden="true" /> : <Moon className="size-5" aria-hidden="true" />}
    </Button>
  );
}
