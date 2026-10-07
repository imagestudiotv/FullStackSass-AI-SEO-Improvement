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
 *
 * A page opened straight onto a section ("/#pricing" from a shared link)
 * needs no script: OFFSCREEN itself turns off under html:has(:target), which
 * applies from the first layout. (An inline script used to do that, placed
 * before the hero; the browser had to stop there until the CSS arrived, so
 * the first frame showed only the header and the headline came frames later.)
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
