"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { Messages } from "@/lib/i18n/messages";

/**
 * The horizontal settings navigation, as the client designed it.
 *
 * "we want to organize the settings options using a horizontal settings
 * navigation underneath the website name… So we still giving all the resp
 * options downside as now. But we create a sort of subheading up as per
 * design, if clicking they are showing that section only."
 *
 * So the five sections are the same features that exist today, reached
 * through one strip rather than scattered between a website page, a separate
 * /settings page and /billing.
 *
 * WHY LINKS AND NOT A TABS COMPONENT: each section is its own route, so it
 * loads only its own data. A client-side tab set would mount all five and
 * pull an audit, a plan, an integration list and a member list on every
 * visit — which is the problem the per-section routes were split up to solve
 * in the first place.
 *
 * ACCOUNT AND BILLING ARE ACCOUNT-LEVEL, not per-website, and their links go
 * to the shared routes rather than under /websites/[id]. They appear in this
 * strip because the client put them there — one place for everything a
 * customer configures — but the data behind them belongs to the workspace, so
 * pointing the tab at a per-website URL would imply a per-website plan that
 * does not exist.
 */

type Section = {
  label: keyof Messages["app"]["nav"];
  /** Built per website, or a fixed account-level path. */
  href: (websiteId: string) => string;
  /**
   * A key into the `nav` dictionary, not the text. This array is built at
   * import time, before any locale is known.
   */
  /** Marks this tab active for any path beginning with these. */
  match: (pathname: string, websiteId: string) => boolean;
};

const SECTIONS: Section[] = [
  {
    label: "business",
    href: (id) => `/websites/${id}/profile`,
    match: (p, id) => p === `/websites/${id}/profile`,
  },
  {
    label: "articleSettings",
    href: (id) => `/websites/${id}/publishing`,
    match: (p, id) => p.startsWith(`/websites/${id}/publishing`),
  },
  /*
    Integrations is the CMS connection, so it points at /integrations.

    It used to point at /google, back when that page carried the publishing
    panel as well as the Google one. Splitting them left this tab naming a
    page that no longer had any integration on it.
  */
  {
    label: "integrations",
    href: (id) => `/websites/${id}/integrations`,
    match: (p, id) => p.startsWith(`/websites/${id}/integrations`),
  },
  {
    label: "account",
    href: () => "/settings",
    match: (p) => p.startsWith("/settings"),
  },
  {
    label: "billing",
    href: () => "/billing",
    match: (p) => p.startsWith("/billing"),
  },
];

export function SettingsNav({
  websiteId,
  t,
}: {
  websiteId: string;
  /** The tab labels, already in the reader's language. */
  t: Messages["app"]["nav"];
}) {
  const pathname = usePathname() ?? "";

  return (
    /*
      Scrolls sideways rather than wrapping. Five labels do not fit a phone,
      and a second row of tabs reads as a second navigation; a strip that
      slides keeps it one thing. The bottom border runs the full width so the
      active underline has something to sit against.
    */
    <nav
      aria-label={t.settingsSections}
      /*
        A MUTED TRACK, not bare page.

        --card and --background are both pure white in the light theme, so a
        strip with no fill sat invisibly on the page: the only thing marking
        the current tab was a 2px underline, and the client read the whole
        row as "too white". Giving the strip its own surface makes it a
        control rather than a line of text, and the selected tab then reads
        as lifted OUT of that surface rather than as slightly darker text.
      */
      className="overflow-x-auto rounded-xl border bg-muted/60 p-1"
    >
      <ul className="flex min-w-max gap-1">
        {SECTIONS.map((section) => {
          const active = section.match(pathname, websiteId);
          return (
            <li key={section.label}>
              <Link
                href={section.href(websiteId)}
                aria-current={active ? "page" : undefined}
                /*
                  The active tab is a raised white pill with the brand
                  underline kept, rather than an underline alone. Two signals
                  rather than one: somebody scanning the row sees the filled
                  shape before they read any text.

                  The inactive label is text-foreground, not muted. Muted grey
                  on this track measures around 3.3:1 — under the 4.5:1
                  minimum — which is the same mistake the plan switcher had,
                  where the client reported the two tabs looking identical.
                */
                className={`inline-block rounded-lg border-b-2 px-4 py-2.5 text-sm whitespace-nowrap transition-colors ${
                  active
                    ? "border-primary bg-background font-semibold text-foreground shadow-sm"
                    : "border-transparent text-foreground/70 hover:bg-background/60 hover:text-foreground"
                }`}
              >
                {t[section.label]}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
