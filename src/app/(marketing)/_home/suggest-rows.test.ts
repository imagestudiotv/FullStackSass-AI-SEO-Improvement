import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/app/(marketing)/growth-plan/actions", () => ({ suggestSite: vi.fn() }));

import type { SiteCard } from "@/lib/websites/site-card";
import { suggestRows } from "./hero-form";

/**
 * The rows under the homepage field (Daniel, 2026-11-19, after explee.com):
 * the typed site as our server read it, then the companies of its name.
 */

const card: SiteCard = {
  domain: "imagestudio.com",
  name: "Image Studio",
  description: "Cinematic wedding films",
  faviconUrl: "data:image/png;base64,AAAA",
  faviconTone: null,
  platform: null,
  language: "en",
};
const brand = (domain: string, name = "Imagestudio") => ({ name, domain, icon: `https://cdn.brandfetch.io/${domain}/icon.webp` });

describe("suggestRows", () => {
  it("puts the typed site first with its description, then the other domains of the name", () => {
    const rows = suggestRows({ target: "imagestudio.com", card }, [brand("imagestudio.com"), brand("imagestudio.com.br"), brand("www.imagestudio.com")]);
    expect(rows.map((row) => [row.domain, row.brand, row.description])).toEqual([
      ["imagestudio.com", false, "Cinematic wedding films"],
      ["imagestudio.com.br", true, null],
    ]);
    expect(rows[1]).toMatchObject({ target: "imagestudio.com.br", icon: { faviconUrl: "https://cdn.brandfetch.io/imagestudio.com.br/icon.webp" } });
  });

  it("lists the companies alone while a name is being typed, at most five rows", () => {
    const rows = suggestRows(null, ["a.com", "b.com", "c.com", "d.com", "e.com", "f.com"].map((d) => brand(d)));
    expect(rows.map((row) => row.domain)).toEqual(["a.com", "b.com", "c.com", "d.com", "e.com"]);
    expect(suggestRows(null, [])).toEqual([]);
  });
});
