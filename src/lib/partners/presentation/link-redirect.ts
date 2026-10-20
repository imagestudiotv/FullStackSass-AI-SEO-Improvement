/**
 * Partner links: repget.com/?ref=<name>, on the home page or any other public
 * page (repget.com/pricing?ref=dami). next.config.ts sends such a request
 * through /go/<name>?to=<page> (src/app/go/[code]/route.ts), which records
 * the click, sets the partner cookie and redirects back to the page, without
 * ?ref= and keeping any utm_ parameters.
 *
 * A redirect in next.config runs before any page or cache, so this works on
 * prerendered pages too (a layout cannot read the query in Next). Excluded:
 * /go itself (it would loop), /r (the legacy credit-referral links), /api and
 * /_next. A value that cannot be a link name is left alone; an unknown name
 * still ends on the page. Temporary (307): the same link keeps counting.
 *
 * Imported by next.config.ts, so: no "@/" imports here.
 */
export function partnerLinkRedirects() {
  return [
    {
      source: "/:path((?!go(?:/|$)|r(?:/|$)|api(?:/|$)|_next(?:/|$)).*)",
      has: [{ type: "query" as const, key: "ref", value: "(?<code>[A-Za-z0-9-]{3,30})" }],
      destination: "/go/:code?to=/:path",
      permanent: false,
    },
  ];
}
