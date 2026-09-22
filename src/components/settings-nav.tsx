"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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
  label: string;
  /** Built per website, or a fixed account-level path. */
  href: (websiteId: string) => string;
  /** Marks this tab active for any path beginning with these. */
  match: (pathname: string, websiteId: string) => boolean;
};

const SECTIONS: Section[] = [
  {
    label: "Business",
    href: (id) => `/websites/${id}/profile`,
    match: (p, id) => p === `/websites/${id}/profile`,
  },
  {
    label: "Article Settings",
    href: (id) => `/websites/${id}/publishing`,
    match: (p, id) => p.startsWith(`/websites/${id}/publishing`),
  },
  {
    label: "Integrations",
    href: (id) => `/websites/${id}/google`,
    match: (p, id) => p.startsWith(`/websites/${id}/google`),
  },
  {
    label: "Account",
    href: () => "/settings",
    match: (p) => p.startsWith("/settings"),
  },
  {
    label: "Billing",
    href: () => "/billing",
    match: (p) => p.startsWith("/billing"),
  },
];

export function SettingsNav({ websiteId }: { websiteId: string }) {
  const pathname = usePathname() ?? "";

  return (
    /*
      Scrolls sideways rather than wrapping. Five labels do not fit a phone,
      and a second row of tabs reads as a second navigation; a strip that
      slides keeps it one thing. The bottom border runs the full width so the
      active underline has something to sit against.
    */
    <nav
      aria-label="Settings sections"
      className="-mx-1 overflow-x-auto border-b"
    >
      <ul className="flex min-w-max gap-1 px-1">
        {SECTIONS.map((section) => {
          const active = section.match(pathname, websiteId);
          return (
            <li key={section.label}>
              <Link
                href={section.href(websiteId)}
                aria-current={active ? "page" : undefined}
                className={`inline-block border-b-2 px-4 py-3 text-sm whitespace-nowrap transition-colors ${
                  active
                    ? "border-primary font-semibold text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {section.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
