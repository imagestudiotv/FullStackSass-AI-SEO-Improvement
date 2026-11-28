import { describe, expect, it } from "vitest";

import { keywordExamples } from "./placeholder";
import { inferSiteType } from "./site-type";

describe("inferSiteType", () => {
  it("reads a content site as a publisher, in its own language too", () => {
    expect(inferSiteType({ industry: "Online media", description: "A blog with recipes and birthday greetings", services: [] })).toBe("publisher");
    expect(inferSiteType({ industry: "Інформаційний портал", description: "Привітання, побажання та статті для всієї родини", services: [] })).toBe("publisher");
    expect(inferSiteType({ industry: "Rivista online", description: "Notizie e guide di viaggio", services: null })).toBe("publisher");
  });

  it("reads a seller as a business", () => {
    expect(inferSiteType({ industry: "Dental clinic", description: "Implants and whitening in Dublin", services: ["Teeth whitening"] })).toBe("business");
    expect(inferSiteType({ industry: "Wedding videography studio", description: "Films for couples in Tuscany; read our blog", services: ["Wedding films"] })).toBe("business");
    expect(inferSiteType({ industry: null, description: null, services: [] })).toBe("business");
  });
});

describe("keywordExamples", () => {
  it("uses the website's own services, as search terms", () => {
    expect(keywordExamples({ services: ["Birthday greetings", "Wedding Toasts.", "Wedding toasts"], industry: "Media" })).toBe("birthday greetings, wedding toasts");
  });

  it("falls back to the industry, and to nothing", () => {
    expect(keywordExamples({ services: [], industry: "Dental clinic" })).toBe("dental clinic");
    expect(keywordExamples({ services: ["A very long sentence describing every single thing the business does for its clients"], industry: null })).toBeNull();
    expect(keywordExamples({ services: "not a list", industry: null })).toBeNull();
  });
});
