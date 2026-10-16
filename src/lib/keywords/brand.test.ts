import { describe, expect, it } from "vitest";

import { brandMarks, compactName, isBrandSearch } from "@/lib/keywords/brand";

describe("searches that name a business", () => {
  const imageStudio = brandMarks({ brandName: "Image Studio", domain: "imagestudio.com" });

  it("reads the website's name from its brand name and its domain", () => {
    expect(imageStudio).toEqual(["imagestudio"]);
    expect(brandMarks({ brandName: null, domain: "www.image-studio.co.uk" })).toEqual(["imagestudio"]);
    expect(brandMarks({ brandName: "Café Délice Roma", domain: "https://cafedelice.it" })).toEqual(["cafedeliceroma", "cafedelice"]);
  });

  it("finds the name inside Image Studio's real keywords, as a namesake or plural", () => {
    for (const term of ["image studios santa monica", "ny image studio", "image studios appleton wi", "ImageStudio prices"]) {
      expect(isBrandSearch(term, imageStudio), term).toBe(true);
    }
  });

  it("leaves ordinary searches alone", () => {
    for (const term of ["wedding videographer como", "photo studio rental milan", "how to look natural in wedding photos", "image editing studio"]) {
      expect(isBrandSearch(term, imageStudio), term).toBe(false);
    }
  });

  it("never matches a short or one-word name", () => {
    expect(brandMarks({ brandName: "Studio", domain: "studio.com" })).toEqual([]);
    expect(brandMarks({ brandName: "Acme", domain: "acme.io" })).toEqual([]);
    expect(isBrandSearch("photo studio rental", brandMarks({ brandName: "Studio", domain: "studio.com" }))).toBe(false);
  });

  it("compacts names the same way whatever their spelling", () => {
    expect(compactName("Image-Studio")).toBe("imagestudio");
    expect(compactName("Ça Délice")).toBe("cadelice");
  });
});
