"use client";

import { useEffect } from "react";

import { selectWebsite } from "@/lib/websites/actions";

/**
 * Makes the website the dashboard is showing the selected one, so the shell
 * around it (switcher, sidebar, Add-ons, credits, setup panel) describes the
 * same site.
 *
 * WHY THE DASHBOARD NEEDS THIS. The shell is rendered by the layout from the
 * remembered-site cookie; a layout cannot read ?site=. Site pages fix a stale
 * cookie through the sidebar's own effect, which reads the id out of the
 * path - but /dashboard carries the site in a query parameter, so nothing
 * did it here. The case that matters: someone with a website of their own
 * opens a SHARED site whose owner's plan has lapsed. The site's pages send
 * them to /dashboard?site=<shared> on the server, before any effect runs,
 * and the dashboard said "this website is paused" inside a shell still set
 * to their own site - its switcher label, its credits and its Add-ons.
 *
 * Also the reverse: someone who owns a site and was invited to another is
 * left with the shell on the SHARED site after accepting or visiting it, and
 * a bare /dashboard shows their own. Without this the shell said "Editor"
 * and hid their credits, Add-ons and setup panel over their own dashboard.
 *
 * Only rendered when the page and the shell disagree and one of the two is a
 * shared site (see the dashboard page), so an owner moving between their own
 * sites keeps the selection they made and an up-to-date cookie costs nothing.
 * selectWebsite checks access again before writing, and re-renders the
 * layout when it does; once the two agree, the page stops rendering this, so
 * it runs once.
 *
 * Done from the client because Next only lets a server action or a route
 * handler write cookies - a page cannot.
 */
export function RememberWebsite({ websiteId }: { websiteId: string }) {
  useEffect(() => {
    void selectWebsite(websiteId);
  }, [websiteId]);

  return null;
}
