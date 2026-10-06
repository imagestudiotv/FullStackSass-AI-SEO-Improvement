"use client";

import { useEffect } from "react";

/**
 * Makes a jump to a home page section land exactly, in every browser.
 *
 * The home page defers rendering the sections below the first screen
 * (OFFSCREEN in app/(marketing)/home-sections.tsx): until one comes near the
 * viewport it is laid out at an estimated height. A jump straight to a
 * section - a "/#tracking" menu link, a shared link, back/forward, turning a
 * phone - positions the page with those estimates, and when the real heights
 * arrive the target moves. Chrome and Firefox correct for that; Safari does
 * not, and its headings landed up to 380px off, some under the header.
 *
 * So on any of those the deferral is switched off for the rest of the visit
 * (data-render-all on <html>) and the browser lays every section out for
 * real before it scrolls: a one-off cost for a visitor who jumps, nothing
 * for the ordinary first view that PageSpeed measures. In the shell rather
 * than on the home page, because the menu links there from every page.
 */
export function RenderAllOnJump() {
  useEffect(() => {
    const renderAll = () =>
      document.documentElement.setAttribute("data-render-all", "");
    // Arriving on a section without a click, e.g. router.push("/#pricing").
    if (window.location.hash) renderAll();

    // Capture phase: before the link's own handler starts the navigation.
    const onClick = (event: MouseEvent) => {
      if (
        event.target instanceof Element &&
        event.target.closest("a[href*='#']")
      ) {
        renderAll();
      }
    };
    // Width only: a phone's address bar showing or hiding changes the height.
    const width = window.innerWidth;
    const onResize = () => {
      if (window.innerWidth !== width) renderAll();
    };

    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", renderAll);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", renderAll);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return null;
}

/**
 * The same switch for a page opened straight onto a section (a shared
 * "/#pricing" link). It has to happen while the HTML is still arriving,
 * before the browser first lays the page out: switched on after hydration,
 * every section above the target changes height at once and Safari, which
 * does not hold the page in place, was left up to 1,266px off.
 *
 * Goes on the home page itself, ahead of its sections: the only page with
 * deferred sections, and a static one, whose security policy allows a small
 * inline script. Runs from the server's HTML only, as in Next's "preventing
 * flash before hydration" guide; on the client it is inert text.
 */
export function RenderAllIfOpenedOnSection() {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{
        __html:
          'if(location.hash)document.documentElement.setAttribute("data-render-all","")',
      }}
    />
  );
}
