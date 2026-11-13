import { getSiteTraffic, parseTrafficRange } from "@/lib/admin/site-traffic";

import { AdminPage, AdminPageHeader } from "../_ui/page";
import { OpenInGoogleAnalytics, TrafficRangePicker, TrafficView } from "./traffic-sections";

export const dynamic = "force-dynamic";
export const metadata = { title: "Site analytics" };

/**
 * Visits to repget.com from its Google Analytics 4 property: users, sessions
 * and views against the previous period, visits per day, and where they come
 * from. Read live from Google on each visit (nothing is stored); until the
 * property and its service account are configured, the page is the setup
 * guide. See lib/admin/site-traffic.ts.
 */
export default async function AdminAnalyticsPage({ searchParams }: PageProps<"/admin/analytics">) {
  const range = parseTrafficRange((await searchParams).range);
  const result = await getSiteTraffic(range);
  const propertyId =
    result.status === "ok" ? result.traffic.propertyId : result.status === "error" ? result.propertyId : null;

  return (
    <AdminPage>
      <AdminPageHeader
        title="Site analytics"
        description="Visits to repget.com's public pages, as Google Analytics 4 reports them. Only visitors who accept analytics cookies are counted; signed-in and admin pages never are."
        actions={
          result.status === "ok" || propertyId ? (
            <>
              {result.status === "ok" ? <TrafficRangePicker range={range} /> : null}
              {propertyId ? <OpenInGoogleAnalytics propertyId={propertyId} /> : null}
            </>
          ) : null
        }
      />
      <TrafficView result={result} />
    </AdminPage>
  );
}
