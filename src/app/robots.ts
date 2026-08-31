import type { MetadataRoute } from "next";

/**
 * robots.txt.
 *
 * Signed-in and API routes are disallowed. They are already behind auth, so
 * this is not a security measure — it stops crawlers spending their budget on
 * pages that only ever redirect, and keeps /audit's crawl endpoint from being
 * hit with arbitrary query strings.
 */

function baseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "");
  if (configured && !configured.includes("localhost")) return configured;
  return "https://seovision.io";
}

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/dashboard",
        "/websites",
        "/billing",
        "/settings",
        "/admin",
        // The results page fetches a third-party site per request; crawling it
        // with arbitrary domains would turn our crawler into someone else's
        // traffic. The form itself stays indexable.
        "/audit?",
      ],
    },
    sitemap: `${baseUrl()}/sitemap.xml`,
  };
}
