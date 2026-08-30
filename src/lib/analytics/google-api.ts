/**
 * Google Search Console and Analytics Data API clients.
 *
 * Both are read-only and both take a date range. Everything here works in
 * whole days: Google reports by day, and the storage schema keys on date, so
 * anything finer would have nowhere to live.
 */

const SEARCH_CONSOLE = "https://searchconsole.googleapis.com/webmasters/v3";
const ANALYTICS_DATA = "https://analyticsdata.googleapis.com/v1beta";
const ANALYTICS_ADMIN = "https://analyticsadmin.googleapis.com/v1beta";

const TIMEOUT_MS = 30_000;

export class GoogleApiError extends Error {
  constructor(
    message: string,
    readonly kind: "auth" | "forbidden" | "not_found" | "rate_limit" | "unknown",
    readonly status?: number,
  ) {
    super(message);
    this.name = "GoogleApiError";
  }
}

async function call<T>(
  url: string,
  accessToken: string,
  init: RequestInit = {},
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        ...init.headers,
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new GoogleApiError("Google took too long to respond", "unknown");
    }
    throw new GoogleApiError(
      error instanceof Error ? error.message : "Request failed",
      "unknown",
    );
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 401) {
    // The caller refreshes and retries; this is expected, not exceptional.
    throw new GoogleApiError("Access token expired", "auth", 401);
  }
  if (response.status === 403) {
    throw new GoogleApiError(
      "Google denied access. The connected account may not have permission for this property.",
      "forbidden",
      403,
    );
  }
  if (response.status === 404) {
    throw new GoogleApiError("Property not found", "not_found", 404);
  }
  if (response.status === 429) {
    throw new GoogleApiError("Google rate limit reached", "rate_limit", 429);
  }

  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const body = (await response.json()) as { error?: { message?: string } };
      if (body.error?.message) detail = body.error.message;
    } catch {
      // Not JSON; the status is the best available message.
    }
    throw new GoogleApiError(detail, "unknown", response.status);
  }

  return (await response.json()) as T;
}

/* ------------------------------------------------------------------ */
/* Search Console                                                      */
/* ------------------------------------------------------------------ */

export type SearchConsoleSite = {
  siteUrl: string;
  permissionLevel: string;
};

export async function listSearchConsoleSites(
  accessToken: string,
): Promise<SearchConsoleSite[]> {
  const data = await call<{ siteEntry?: SearchConsoleSite[] }>(
    `${SEARCH_CONSOLE}/sites`,
    accessToken,
  );
  return (data.siteEntry ?? []).filter(
    // Unverified properties return no data, so offering them would only
    // produce an empty import the user cannot explain.
    (site) => site.permissionLevel !== "siteUnverifiedUser",
  );
}

export type SearchRow = {
  date: string;
  pageUrl: string | null;
  query: string | null;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

/**
 * Fetches performance rows grouped by date, page and query.
 *
 * Search Console caps a response at 25,000 rows and offers no cursor, only an
 * offset, so this pages until a short response arrives.
 */
export async function fetchSearchAnalytics(
  accessToken: string,
  siteUrl: string,
  startDate: string,
  endDate: string,
  maxRows = 5000,
): Promise<SearchRow[]> {
  const rows: SearchRow[] = [];
  const PAGE = 1000;

  for (let start = 0; start < maxRows; start += PAGE) {
    const data = await call<{
      rows?: {
        keys?: string[];
        clicks?: number;
        impressions?: number;
        ctr?: number;
        position?: number;
      }[];
    }>(
      `${SEARCH_CONSOLE}/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
      accessToken,
      {
        method: "POST",
        body: JSON.stringify({
          startDate,
          endDate,
          dimensions: ["date", "page", "query"],
          rowLimit: PAGE,
          startRow: start,
        }),
      },
    );

    const batch = data.rows ?? [];
    for (const row of batch) {
      const [date, page, query] = row.keys ?? [];
      if (!date) continue;
      rows.push({
        date,
        pageUrl: page ?? null,
        query: query ?? null,
        clicks: row.clicks ?? 0,
        impressions: row.impressions ?? 0,
        ctr: row.ctr ?? 0,
        position: row.position ?? 0,
      });
    }

    if (batch.length < PAGE) break;
  }

  return rows;
}

/* ------------------------------------------------------------------ */
/* Google Analytics 4                                                  */
/* ------------------------------------------------------------------ */

export type AnalyticsProperty = {
  /** "properties/123456789" */
  name: string;
  displayName: string;
};

export async function listAnalyticsProperties(
  accessToken: string,
): Promise<AnalyticsProperty[]> {
  /**
   * Properties are reached through the accounts that own them; there is no
   * "list all properties" call. accountSummaries returns both in one request.
   */
  const data = await call<{
    accountSummaries?: {
      propertySummaries?: { property?: string; displayName?: string }[];
    }[];
  }>(`${ANALYTICS_ADMIN}/accountSummaries?pageSize=200`, accessToken);

  const properties: AnalyticsProperty[] = [];
  for (const account of data.accountSummaries ?? []) {
    for (const property of account.propertySummaries ?? []) {
      if (property.property) {
        properties.push({
          name: property.property,
          displayName: property.displayName ?? property.property,
        });
      }
    }
  }
  return properties;
}

export type AnalyticsRow = {
  date: string;
  pageUrl: string | null;
  sessions: number;
  users: number;
  engagementRate: number;
  conversions: number;
};

export async function fetchAnalyticsReport(
  accessToken: string,
  property: string,
  startDate: string,
  endDate: string,
): Promise<AnalyticsRow[]> {
  const data = await call<{
    rows?: {
      dimensionValues?: { value?: string }[];
      metricValues?: { value?: string }[];
    }[];
  }>(`${ANALYTICS_DATA}/${property}:runReport`, accessToken, {
    method: "POST",
    body: JSON.stringify({
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: "date" }, { name: "pagePath" }],
      metrics: [
        { name: "sessions" },
        { name: "totalUsers" },
        { name: "engagementRate" },
        { name: "conversions" },
      ],
      limit: 5000,
    }),
  });

  return (data.rows ?? []).map((row) => {
    const dims = row.dimensionValues ?? [];
    const metrics = row.metricValues ?? [];
    // GA returns dates as YYYYMMDD; the column is a real date.
    const raw = dims[0]?.value ?? "";
    const date =
      raw.length === 8
        ? `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`
        : raw;

    return {
      date,
      pageUrl: dims[1]?.value ?? null,
      sessions: Number(metrics[0]?.value ?? 0),
      users: Number(metrics[1]?.value ?? 0),
      engagementRate: Number(metrics[2]?.value ?? 0),
      conversions: Number(metrics[3]?.value ?? 0),
    };
  });
}
