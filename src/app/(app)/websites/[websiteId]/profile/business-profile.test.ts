import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { getMessages } from "@/lib/i18n/messages";
import { SUPPORTED_LANGUAGES } from "@/lib/websites/languages";
import { InvalidUrlError, normalizeWebsiteUrl } from "@/lib/websites/url";

/**
 * Business settings, by behaviour: what a Save sends (and, as important,
 * what it leaves alone), how a refresh merges with edits on screen, how a
 * competitor address is checked before the slow server check, how the
 * server's English refusals reach the reader, and what each role sees.
 * Rendered to static markup, so clicks and focus are left to the browser
 * check.
 */

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode; [key: string]: unknown }) =>
    createElement("a", { href, ...rest }, children),
}));
vi.mock("@/lib/websites/actions", () => ({
  updateWebsiteDetails: vi.fn(),
  addCompetitor: vi.fn(),
  removeCompetitor: vi.fn(),
}));

import {
  afterSave,
  buildPatch,
  changedFields,
  changesBySection,
  checkCompetitorInput,
  checklistMissing,
  englishMarketFor,
  guessDomain,
  languageChoice,
  mergeRefreshed,
  profileValues,
  saveBarState,
  serverErrorMessage,
  statusAfterEdit,
  type ProfileValues,
} from "./business-profile";
import { BusinessSettings, type BusinessWebsite } from "./business-settings";
import { dashboardLanguageName, languageOptions, marketAliases, marketSuggestions } from "./options";

const en = getMessages("en").app;
const de = getMessages("de").app;

const stored: ProfileValues = {
  brandName: "Image Studio",
  industry: "Wedding photography",
  country: "Italy",
  language: "Spanish",
  targetAudience: "Engaged couples 25-40",
  description: "Wedding photographers in Florence.",
};

describe("what a Save sends", () => {
  it("lists only the fields that would store something different, in page order", () => {
    const edited = { ...stored, description: "New text", brandName: "Image Studio Srl" };
    expect(changedFields(stored, edited)).toEqual(["brandName", "description"]);
    // The server trims, so whitespace alone is not a change worth a Save.
    expect(changedFields(stored, { ...stored, industry: "Wedding photography  " })).toEqual([]);
  });

  it("sends the changed fields and nothing else, so untouched columns are never overwritten or cleared", () => {
    const empty = profileValues({ brandName: null, industry: null, country: null, language: null, targetAudience: null, description: null });
    const edited = { ...empty, description: "We photograph weddings." };
    const patch = buildPatch(changedFields(empty, edited), edited);
    expect(patch).toEqual({ description: "We photograph weddings." });
    expect("language" in patch).toBe(false);
    expect("brandName" in patch).toBe(false);
  });

  it("sends an emptied field as an empty string, which the server stores as cleared", () => {
    const edited = { ...stored, targetAudience: "" };
    expect(buildPatch(changedFields(stored, edited), edited)).toEqual({ targetAudience: "" });
  });

  it("after a save, the saved values are the submitted ones (trimmed); edits made meanwhile stay unsaved", () => {
    const submitted = { ...stored, brandName: "  Image Studio Srl " };
    const saved = afterSave(stored, ["brandName"], submitted);
    expect(saved.brandName).toBe("Image Studio Srl");
    const typedDuringSave = { ...submitted, industry: "Photography" };
    expect(changedFields(saved, typedDuringSave)).toEqual(["industry"]);
  });

  it("counts unsaved fields per section", () => {
    expect(changesBySection(["brandName", "country", "language", "description"])).toEqual({ identity: 1, market: 2, about: 1 });
    expect(changesBySection([])).toEqual({ identity: 0, market: 0, about: 0 });
  });
});

describe("the Save bar", () => {
  it("says Saved only once the server confirmed it, and keeps a failure on screen while there is something to save", () => {
    expect(saveBarState({ kind: "idle" }, 0).bar).toEqual({ kind: "clean" });
    expect(saveBarState({ kind: "idle" }, 2).bar).toEqual({ kind: "dirty", count: 2 });
    expect(saveBarState({ kind: "saving", count: 2 }, 2).bar).toEqual({ kind: "saving", count: 2 });
    expect(saveBarState({ kind: "saved" }, 0).bar).toEqual({ kind: "saved" });
    expect(saveBarState({ kind: "failed", error: "Nope" }, 1).bar).toEqual({ kind: "failed", error: "Nope", count: 1 });
  });

  it("notes kept edits only right after a save that landed while typing, then goes back to the scope note", () => {
    // Typed during the save: the save lands with one field still unsaved.
    expect(saveBarState({ kind: "saved" }, 1)).toEqual({ bar: { kind: "dirty", count: 1 }, editsKept: true });
    // The next edit after a finished save is an ordinary change again.
    const next = statusAfterEdit({ kind: "saved" });
    expect(next).toEqual({ kind: "idle" });
    expect(saveBarState(next, 1).editsKept).toBe(false);
    // Typing while saving, or after a failure, leaves those states alone.
    expect(statusAfterEdit({ kind: "saving", count: 1 })).toEqual({ kind: "saving", count: 1 });
    expect(statusAfterEdit({ kind: "failed", error: "Nope" })).toEqual({ kind: "failed", error: "Nope" });
  });
});

describe("the market field", () => {
  const aliases = marketAliases();

  it("knows the other-language names of the listed markets, mapped to the English name keyword research reads", () => {
    expect(aliases["españa"]).toBe("Spain");
    expect(aliases["deutschland"]).toBe("Germany");
    expect(aliases["italia"]).toBe("Italy");
    expect(aliases["regno unito"]).toBe("United Kingdom");
    // English names (any case) are not aliases: they already work.
    expect(Object.values(aliases).every((english) => !Object.hasOwn(aliases, english.toLowerCase()))).toBe(true);
  });

  it("offers the English name for a translated one, and stays quiet for English, unknown or empty values", () => {
    expect(englishMarketFor("  España ", aliases)).toBe("Spain");
    expect(englishMarketFor("Spain", aliases)).toBeNull();
    expect(englishMarketFor("spain", aliases)).toBeNull();
    expect(englishMarketFor("Atlantis", aliases)).toBeNull();
    expect(englishMarketFor("", aliases)).toBeNull();
    // An inherited property name is not a country.
    expect(englishMarketFor("constructor", aliases)).toBeNull();
  });
});

describe("a refresh while editing", () => {
  it("updates untouched fields from the server and keeps the person's edits", () => {
    const current = { ...stored, description: "My own words" };
    const fresh = { ...stored, brandName: "Image Studio Firenze", description: "Analysis text" };
    const merged = mergeRefreshed(current, stored, fresh);
    expect(merged.brandName).toBe("Image Studio Firenze");
    expect(merged.description).toBe("My own words");
  });
});

describe("the launch checklist", () => {
  it("needs a stored description and language, as lib/onboarding/launch.ts reads them", () => {
    expect(checklistMissing(stored)).toEqual({ description: false, language: false });
    expect(checklistMissing({ ...stored, description: "  ", language: "" })).toEqual({ description: true, language: true });
  });
});

describe("the competitor address check", () => {
  const inputs = [
    "rival.com",
    "https://www.Rival.com/about?x=1#y",
    "http://shop.rival.co.uk/",
    "RIVAL.COM.",
    "café.com",
    "www.rival.com",
    "rival",
    "not a domain",
    "ftp://rival.com",
    ".com",
    "https://",
  ];

  it("predicts the domain the server stores, and refuses what the server refuses as malformed", () => {
    for (const input of inputs) {
      let server: string | null;
      try {
        server = normalizeWebsiteUrl(input).domain;
      } catch (error) {
        expect(error).toBeInstanceOf(InvalidUrlError);
        server = null;
      }
      expect(guessDomain(input), input).toBe(server);
    }
  });

  it("answers empty, malformed, own-site and duplicate entries without asking the server", () => {
    const existing = [{ domain: "rival.com", source: "ai_suggested" }];
    expect(checkCompetitorInput("  ", { ownDomain: "imagestudio.com", existing })).toEqual({ ok: false, reason: "required" });
    expect(checkCompetitorInput("rival", { ownDomain: "imagestudio.com", existing })).toEqual({ ok: false, reason: "invalid" });
    expect(checkCompetitorInput("https://www.imagestudio.com/", { ownDomain: "imagestudio.com", existing })).toMatchObject({ reason: "ownSite" });
    // A legacy own domain stored with www. is still recognised.
    expect(checkCompetitorInput("imagestudio.com", { ownDomain: "www.imagestudio.com", existing })).toMatchObject({ reason: "ownSite" });
    // Already suggested: adding it again would be a silent no-op on the server.
    expect(checkCompetitorInput("WWW.Rival.com", { ownDomain: "imagestudio.com", existing })).toEqual({
      ok: false,
      reason: "duplicate",
      domain: "rival.com",
    });
    expect(checkCompetitorInput("other.com", { ownDomain: "imagestudio.com", existing })).toEqual({ ok: true, domain: "other.com" });
  });
});

describe("server refusals in the reader's language", () => {
  const t = de.profile;
  const tw = de.workspace;

  it("replaces every known English refusal", () => {
    expect(serverErrorMessage("You have view-only access to this website.", t, tw)).toBe(tw.viewOnly);
    expect(serverErrorMessage("That is your own website.", t, tw)).toBe(t.competitorOwnSite);
    expect(serverErrorMessage("Enter a valid website address", t, tw)).toBe(t.competitorInvalid);
    expect(serverErrorMessage("That address is not a public website", t, tw)).toBe(t.competitorNotPublic);
    expect(serverErrorMessage("Enter your own website, not a social profile", t, tw)).toBe(t.competitorBlocked);
    expect(serverErrorMessage("We could not reach theknott.com (no DNS record). Check the spelling.", t, tw)).toBe(
      "Wir konnten theknott.com nicht erreichen. Prüfen Sie die Schreibweise und versuchen Sie es erneut.",
    );
    expect(serverErrorMessage("We could not reach rival.com (http 503). Check the spelling.", t, tw)).toContain("rival.com");
  });

  it("shows an unrecognised refusal as written rather than hiding it", () => {
    expect(serverErrorMessage("Something new", t, tw)).toBe("Something new");
  });
});

describe("the article-language picker", () => {
  const options = languageOptions("en");

  it("shows a placeholder, not English, when no language is stored", () => {
    expect(languageChoice("", "", options)).toEqual({ placeholder: true, unknown: null });
  });

  it("keeps a stored language outside the list on offer, even after another is picked", () => {
    expect(languageChoice("Catalan", "Catalan", options)).toEqual({ placeholder: false, unknown: "Catalan" });
    expect(languageChoice("Spanish", "Catalan", options)).toEqual({ placeholder: false, unknown: "Catalan" });
    expect(languageChoice("Spanish", "Spanish", options)).toEqual({ placeholder: false, unknown: null });
  });

  it("stores the same English names as before, labelled for the reader", () => {
    expect(options).toEqual(SUPPORTED_LANGUAGES);
    const german = languageOptions("de");
    expect(german.map((option) => option.value)).toEqual(SUPPORTED_LANGUAGES.map((language) => language.value));
    expect(german.find((option) => option.value === "Spanish")?.label).toBe("Español (Spanisch)");
    expect(german.find((option) => option.value === "German")?.label).toBe("Deutsch");
  });

  it("names the dashboard language in that language", () => {
    expect(dashboardLanguageName("en")).toBe("English");
    expect(dashboardLanguageName("de")).toBe("Deutsch");
  });

  it("suggests English country names for the market, never the Global sentinel", () => {
    const markets = marketSuggestions("de");
    expect(markets.map((market) => market.value)).toContain("Spain");
    expect(markets.find((market) => market.value === "Spain")?.label).toBe("Spanien");
    expect(markets.some((market) => market.value.startsWith("__"))).toBe(false);
  });
});

const website: BusinessWebsite = {
  id: "w1",
  domain: "imagestudio.com",
  status: "ready",
  brandName: "Image Studio",
  industry: "Wedding photography",
  country: "Italy",
  language: "Spanish",
  targetAudience: null,
  description: "Wedding photographers in Florence.",
};

function render(over: Partial<Parameters<typeof BusinessSettings>[0]> = {}, locale: "en" | "de" = "en") {
  const app = locale === "en" ? en : de;
  return renderToStaticMarkup(
    createElement(BusinessSettings, {
      website,
      competitors: [
        { domain: "rival-one.com", source: "ai_suggested" },
        { domain: "legacy-rival.com", source: null },
        { domain: "my-pick.com", source: "manual" },
      ],
      competitorsTruncated: false,
      competitorLimit: 200,
      canEdit: true,
      isOwner: true,
      languageOptions: languageOptions(locale),
      marketSuggestions: marketSuggestions(locale),
      dashboardLanguage: dashboardLanguageName(locale),
      t: app.profile,
      tw: app.workspace,
      ...over,
    }),
  );
}

describe("the Business settings page", () => {
  it("an editor gets labelled controls, the stored values, and a Save bar that says what it covers", () => {
    const html = render();
    expect(html).toContain('for="profile-brandName"');
    expect(html).toContain('id="profile-brandName"');
    expect(html).toContain('value="Image Studio"');
    expect(html).toContain('<select id="profile-language"');
    expect(html).toContain(en.profile.saveScope);
    expect(html).toContain(en.profile.saveBusinessDetails);
    expect(html).toContain(en.profile.addCompetitor);
    expect(html).not.toContain(en.workspace.viewOnly);
  });

  it("keeps article language and dashboard language apart, with a way to the dashboard setting", () => {
    const html = render();
    expect(html).toContain(en.profile.articleLanguageHint);
    expect(html).toContain("Your dashboard is shown in English");
    // Straight to the Account page's dashboard-language section.
    expect(html).toContain('href="/settings#language"');
  });

  it("warns when the market is a translated country name, with a fix that changes nothing until pressed", () => {
    const aliases = marketAliases();
    const html = render({ website: { ...website, country: "España" }, marketAliases: aliases });
    expect(html).toContain(en.profile.marketNotEnglish);
    expect(html).toContain(">Use Spain</button>");
    // The stored value is still what is in the field.
    expect(html).toContain('value="España"');

    expect(render({ marketAliases: aliases })).not.toContain(en.profile.marketNotEnglish);
    expect(render({ website: { ...website, country: "España" }, marketAliases: aliases, canEdit: false })).not.toContain(
      en.profile.marketNotEnglish,
    );
  });

  it("does not claim English when no language is stored", () => {
    const html = render({ website: { ...website, language: null } });
    expect(html).toMatch(/<option value="" disabled="" selected="">Choose a language<\/option>/);
    expect(html).not.toMatch(/<option value="English" selected/);
    expect(html).toContain(en.profile.checklistNeedsLanguage);
  });

  it("keeps a legacy language as its own option", () => {
    const html = render({ website: { ...website, language: "Catalan" } });
    expect(html).toContain('<option value="Catalan" class="text-foreground" selected="">Catalan (current value)</option>');
  });

  it("groups competitors by who chose them, counting older unlabelled rows as suggestions", () => {
    const html = render();
    const mine = html.indexOf(en.profile.manualGroup);
    const suggested = html.indexOf(en.profile.suggestedGroup);
    expect(mine).toBeGreaterThan(-1);
    expect(suggested).toBeGreaterThan(mine);
    expect(html.indexOf("my-pick.com")).toBeLessThan(suggested);
    expect(html.indexOf("legacy-rival.com")).toBeGreaterThan(suggested);
    expect(html).toContain('aria-label="Remove rival-one.com"');
    expect(html).toContain("3 competitors");
  });

  it("a viewer reads the values and gets no control the server would refuse", () => {
    const html = render({ canEdit: false, isOwner: false });
    expect(html).toContain(en.workspace.viewOnly);
    expect(html).not.toContain("<input");
    expect(html).not.toContain("<select");
    expect(html).not.toContain("<textarea");
    expect(html).not.toContain("Remove rival-one.com");
    expect(html).not.toContain(en.profile.saveBusinessDetails);
    expect(html).toContain("<dd");
    expect(html).toContain("Image Studio");
    // Target audience is not stored.
    expect(html).toContain(en.profile.notSet);
  });

  it("warns that a running analysis replaces the fields, and keeps a failed one apart", () => {
    const running = render({ website: { ...website, status: "crawling" } });
    expect(running).toContain(en.profile.analysingTitle);
    expect(running).toContain(en.profile.analysingBody);

    const failedOwner = render({ website: { ...website, status: "failed" } });
    expect(failedOwner).toContain(en.profile.analysisFailedTitle);
    expect(failedOwner).toContain('href="/websites"');

    const failedEditor = render({ website: { ...website, status: "failed" }, isOwner: false });
    expect(failedEditor).toContain(en.profile.analysisFailedTitle);
    expect(failedEditor).not.toContain('href="/websites"');
  });

  it("is fully translated: a German reader sees no English labels", () => {
    const html = render({}, "de");
    expect(html).toContain(de.profile.identityTitle);
    expect(html).toContain(de.profile.suggestedGroup);
    expect(html).toContain("Ihr Dashboard wird auf Deutsch angezeigt");
    for (const english of ["suggested", ">Add<", "Remove ", "Choose a language", en.profile.saveScope]) {
      expect(html).not.toContain(english);
    }
  });
});
