import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * The homepage's WebSite + Organization structured data, in the shape the
 * client's launch review asked for (2026-10-03): one WebSite with a stable @id
 * and "RepGet.com" as its alternate name, published by one Organization with a
 * logo.
 */

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

/** Fresh import, so lib/config/site reads the env stubbed for this test. */
async function build(siteUrl = "https://www.repget.com") {
  const { siteSchema } = await import("./organization-schema");
  return siteSchema(siteUrl) as { "@context": string; "@graph": Record<string, unknown>[] };
}

describe("siteSchema", () => {
  it("has exactly one WebSite, one Organization and one SoftwareApplication", async () => {
    const graph = (await build())["@graph"];
    expect(graph.map((node) => node["@type"])).toEqual([
      "WebSite",
      "Organization",
      "SoftwareApplication",
    ]);
  });

  it("matches the client's WebSite entity", async () => {
    const schema = await build();
    expect(schema["@context"]).toBe("https://schema.org");
    expect(schema["@graph"][0]).toEqual({
      "@type": "WebSite",
      "@id": "https://www.repget.com/#website",
      url: "https://www.repget.com/",
      name: "RepGet",
      // The lower-case domain last: Google's fallback site name.
      alternateName: ["RepGet.com", "repget.com"],
      publisher: { "@id": "https://www.repget.com/#organization" },
    });
  });

  it("matches the client's Organization entity, with a real logo and the support inbox", async () => {
    // No address configured: RepGet's own inbox (lib/config/site.ts), as production shows.
    expect((await build())["@graph"][1]).toEqual({
      "@type": "Organization",
      "@id": "https://www.repget.com/#organization",
      name: "RepGet",
      url: "https://www.repget.com/",
      logo: {
        "@type": "ImageObject",
        url: "https://www.repget.com/icon-512.png",
        width: 512,
        height: 512,
      },
      contactPoint: { "@type": "ContactPoint", contactType: "customer support", email: "support@repget.com" },
    });
  });

  it("links the WebSite's publisher to the Organization's own @id", async () => {
    const [website, organization] = (await build())["@graph"];
    expect((website.publisher as { "@id": string })["@id"]).toBe(organization["@id"]);
  });

  it("builds the @ids from the configured address, without doubling a slash", async () => {
    const [website] = (await build("https://www.repget.com/"))["@graph"];
    expect(website["@id"]).toBe("https://www.repget.com/#website");
  });

  it("publishes no contact while the support address is still the placeholder", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPPORT_EMAIL", "support@example.com");
    const organization = (await build())["@graph"][1];
    expect(organization).not.toHaveProperty("contactPoint");
  });

  it.each(["es", "fr", "it", "de"] as const)("is on the %s homepage too: the same entities, its pricing page, and the page in its language", async (locale) => {
    const { siteSchema } = await import("./organization-schema");
    const { HOME_META } = await import("@/lib/seo/home-metadata");
    const plans = [
      { id: "g", name: "Grow", tier: "grow", interval: "month", priceCents: 14900, currency: "eur" },
    ] as unknown as Parameters<typeof siteSchema>[1];
    const english = (await build())["@graph"];
    const graph = (siteSchema("https://www.repget.com", plans, true, locale) as { "@graph": Record<string, unknown>[] })["@graph"];
    expect(graph.map((node) => node["@type"])).toEqual(["WebSite", "Organization", "SoftwareApplication", "WebPage"]);
    // The same site and company, by the same @ids.
    expect(graph[0]).toEqual(english[0]);
    expect(graph[1]).toEqual(english[1]);
    expect(graph[2]["@id"]).toBe("https://www.repget.com/#software");
    const [offer] = graph[2].offers as { url: string; price: number }[];
    expect(offer).toMatchObject({ url: `https://www.repget.com/${locale}/pricing`, price: 89 });
    expect(graph[3]).toEqual({
      "@type": "WebPage",
      "@id": `https://www.repget.com/${locale}#webpage`,
      url: `https://www.repget.com/${locale}`,
      name: HOME_META[locale].title,
      description: HOME_META[locale].description,
      inLanguage: locale,
      isPartOf: { "@id": "https://www.repget.com/#website" },
      about: { "@id": "https://www.repget.com/#organization" },
    });
  });

  it("adds the support contact once a real address is configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPPORT_EMAIL", "support@repget.com");
    const organization = (await build())["@graph"][1];
    expect(organization.contactPoint).toEqual({
      "@type": "ContactPoint",
      contactType: "customer support",
      email: "support@repget.com",
    });
  });
});
