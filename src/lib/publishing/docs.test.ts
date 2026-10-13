import { describe, expect, it } from "vitest";

import { LOCALES } from "@/lib/i18n/config";
import { getMessages } from "@/lib/i18n/messages";

import { docsUi, getIntegrationDoc, INTEGRATION_DOCS, integrationDocs, type IntegrationDoc } from "./docs";

/**
 * The integration guides in five languages (client, 2026-10-13: pages in the
 * visitor's language). A translation must say what the English guide says,
 * and name RepGet's buttons exactly as the app shows them in that language -
 * a guide that says "press X" when the screen says "Y" is worse than none.
 */

const TRANSLATED = LOCALES.filter((locale) => locale !== "en");

describe("the guides in every language", () => {
  it("translate every guide, step for step", () => {
    for (const locale of TRANSLATED) {
      const docs = integrationDocs(locale);
      expect(docs.map((doc) => doc.slug)).toEqual(INTEGRATION_DOCS.map((doc) => doc.slug));
      for (const [index, doc] of docs.entries()) {
        const english = INTEGRATION_DOCS[index];
        expect(doc.summary, `${locale} ${doc.slug}`).not.toBe(english.summary);
        expect(doc.requirements, `${locale} ${doc.slug} requirements`).toHaveLength(english.requirements.length);
        expect(doc.steps, `${locale} ${doc.slug} steps`).toHaveLength(english.steps.length);
        expect(doc.troubleshooting, `${locale} ${doc.slug} troubleshooting`).toHaveLength(english.troubleshooting.length);
        expect(doc.officialUrl).toBe(english.officialUrl);
      }
    }
  });

  it("keep every technical value as it is: addresses, settings, scopes and versions", () => {
    const tokens = (text: string) => (text.match(/(?:https?:\/\/\w[\w.-]*\S*|\/wp-json\/\S+|wp-admin\/\S+|action=\S+|shpat_|write_content|read_content|cms:write|HMAC-SHA256|\b\d+(?:\.\d+)+\b|35 K[BoB])/g) ?? []).map((t) => t.replace(/[.,;:)]+$/, ""));
    const text = (doc: IntegrationDoc) => [doc.steps, doc.requirements, doc.troubleshooting].flat().flatMap((item) => (typeof item === "string" ? [item] : Object.values(item))).join(" ");
    for (const english of INTEGRATION_DOCS) {
      const want = tokens(text(english)).sort();
      for (const locale of TRANSLATED) {
        const doc = getIntegrationDoc(english.slug, locale)!;
        expect(tokens(text(doc)).map((t) => t.replace("35 Ko", "35 KB")).sort(), `${locale} ${english.slug}`).toEqual(want);
      }
    }
  });

  it("name RepGet's menus and buttons exactly as the app shows them in that language", () => {
    for (const locale of LOCALES) {
      const t = getMessages(locale).app;
      const settingsIntegrations = `${t.nav.settings} → ${t.nav.integrations}`;
      const wordpress = JSON.stringify(getIntegrationDoc("wordpress", locale));
      expect(wordpress).toContain(settingsIntegrations);
      expect(wordpress).toContain(t.publishing.publishTest);
      expect(docsUi(locale).publishTest).toBe(t.publishing.publishTest);

      const plugin = JSON.stringify(getIntegrationDoc("wordpress-plugin", locale));
      for (const label of [
        t.common.downloadPlugin,
        t.keys.openWordPress,
        t.keys.connectButton,
        t.keys.advancedTitle,
        t.keys.newKey,
        t.common.revoke,
        t.wpConnect.useOtherAccount,
        `${t.nav.settings} → ${t.nav.business}`,
        `${t.nav.settings} → ${t.nav.articleSettings} → ${t.common.whenFinished}`,
        t.common.finishedDraft,
        t.common.finishedLive,
      ]) {
        expect(plugin, `${locale}: ${label}`).toContain(label);
      }
    }
  });

  it("say, in a translation, that Ghost, Shopify, Webflow and Wix are named as their English admin shows them", () => {
    for (const locale of TRANSLATED) {
      for (const slug of ["ghost", "shopify", "webflow", "wix"]) expect(getIntegrationDoc(slug, locale)?.note).toBeTruthy();
      for (const slug of ["wordpress", "wordpress-plugin", "webhook"]) expect(getIntegrationDoc(slug, locale)?.note).toBeUndefined();
    }
    expect(getIntegrationDoc("ghost")?.note).toBeUndefined();
  });

  it("fill in every placeholder", () => {
    for (const locale of LOCALES) {
      const ui = docsUi(locale);
      expect(ui.connectTitle).toContain("{name}");
      expect(ui.official).toContain("{name}");
      expect(ui.readyBody).toContain("{name}");
      expect(ui.readyBody.split("{button}")).toHaveLength(2);
      expect(ui.englishUi).toContain("{name}");
    }
  });
});
