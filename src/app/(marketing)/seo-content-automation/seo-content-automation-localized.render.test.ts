import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PlanRow } from "@/lib/billing-shared";
import { LOCALE_ONLY_PATHS, localePath, TRANSLATED_PATHS } from "@/lib/i18n/config";
import { isPublicEnglishPage } from "@/lib/seo/public-pages";
import { SEO_CONTENT_AUTOMATION_LOCALES, SEO_CONTENT_AUTOMATION_PATH, seoContentAutomationCopy } from "@/lib/marketing/seo-content-automation";
import { signUpForPlan } from "@/lib/plans/features";
import { SUPPORTED_LANGUAGES } from "@/lib/websites/languages";
import { catalogRows } from "../../../../scripts/plan-catalog.mjs";

/**
 * /it|de|es|fr/seo-content-automation: the English page's design and facts in
 * the four other languages. Each one stands alone (its own canonical, no
 * hreflang, not indexed, not in the sitemap), is in its own html lang, sends
 * people to the same Launch trial journey and quotes the same plan row - and
 * none says more than the English page does.
 */

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode; [key: string]: unknown }) =>
    createElement("a", { href, ...rest }, children),
}));
const notFound = vi.hoisted(() => vi.fn(() => { throw new Error("NEXT_NOT_FOUND"); }));
vi.mock("next/navigation", () => ({ notFound }));
const { listPlans, offerOn } = vi.hoisted(() => ({ listPlans: vi.fn(), offerOn: vi.fn(() => true) }));
vi.mock("@/lib/billing", () => ({ listPlans }));
vi.mock("@/lib/billing/repget-offer", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/billing/repget-offer")>()),
  repgetOfferEnabled: offerOn,
}));

import Page, { dynamic, generateMetadata } from "@/app/(localized)/[locale]/(pages)/seo-content-automation/page";

const PLANS = catalogRows().map(
  (row, index) =>
    ({
      id: `${row.tier}_${row.interval}`,
      name: row.name,
      tier: row.tier,
      interval: row.interval,
      currency: "eur",
      priceCents: row.priceCents,
      articleLimit: row.articleLimit,
      socialPostLimit: row.socialPostLimit,
      keywordLimit: row.keywordLimit,
      siteLimit: row.siteLimit,
      monthlyCredits: row.monthlyCredits,
      sortOrder: index,
      isActive: true,
    }) as unknown as PlanRow,
);

const params = (locale: string) => ({ params: Promise.resolve({ locale }) }) as PageProps<"/[locale]/seo-content-automation">;
const render = async (locale: string) => renderToStaticMarkup(await Page(params(locale)));
const text = (html: string) =>
  html.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&nbsp;| | /g, " ").replace(/\s+/g, " ");

/** Where some words are in the markup: React writes an apostrophe as &#x27;. */
const at = (html: string, words: string) => html.indexOf(words.replace(/'/g, "&#x27;"));

/** What each language must say, in its own words: the figures, the publishing default and the terms. */
const EXPECT = {
  it: {
    price: "€59 al mese, fatturati in euro, dopo una prova gratuita di 3 giorni",
    regular: "€99 al mese",
    articles: "30 articoli SEO al mese",
    trial: "fino a 3 articoli nei tre giorni",
    charged: "Alla fine della prova vengono addebitati €59",
    firstArticle: "Il primo articolo del sito viene pubblicato online non appena è scritto",
    notDefault: "La revisione non è l'impostazione predefinita",
    eligibility: "un nuovo account che non ha mai avuto un abbonamento",
    payment: "una carta oppure un'autorizzazione PayPal",
    cancel: "Può disdire in qualsiasi momento dalla pagina di fatturazione",
    refund: "entro 3 giorni dal primo pagamento",
    noSchema: "Aggiungere markup schema (dati strutturati) agli articoli.",
    noImage: "in caso contrario l'articolo viene scritto comunque",
    cta: "Inizi la prova del piano Launch",
    annual: /annual|annuo|all'anno|l'anno/i,
  },
  de: {
    price: "€59 pro Monat, abgerechnet in Euro, nach einer 3-tägigen kostenlosen Testphase",
    regular: "€99 pro Monat",
    articles: "30 SEO-Artikel pro Monat",
    trial: "bis zu 3 Artikel in den drei Tagen",
    charged: "Am Ende der Testphase werden €59 berechnet",
    firstArticle: "Der erste Artikel Ihrer Website wird live veröffentlicht, sobald er geschrieben",
    notDefault: "ist nicht die Standardeinstellung",
    eligibility: "ein neues Konto, das noch nie ein Abonnement hatte",
    payment: "eine Karte oder eine PayPal-Freigabe",
    cancel: "Sie können jederzeit über die Abrechnungsseite in Ihrem Konto kündigen",
    refund: "innerhalb von 3 Tagen nach Ihrer ersten Zahlung",
    noSchema: "Schema-Markup (strukturierte Daten) zu Ihren Artikeln hinzufügen.",
    noImage: "andernfalls wird der Artikel trotzdem geschrieben",
    cta: "Launch-Testphase starten",
    annual: /jährlich|pro Jahr|im Jahr/i,
  },
  es: {
    price: "€59 al mes, facturado en euros, después de una prueba gratuita de 3 días",
    regular: "€99 al mes",
    articles: "30 artículos SEO al mes",
    trial: "hasta 3 artículos en los tres días",
    charged: "Cuando termina la prueba se cobran €59",
    firstArticle: "El primer artículo de su web se publica en cuanto está redactado",
    notDefault: "La revisión no es la opción predeterminada",
    eligibility: "una cuenta nueva que nunca ha tenido una suscripción",
    payment: "una tarjeta o una autorización de PayPal",
    cancel: "Puede cancelar en cualquier momento desde la página de facturación",
    refund: "en los 3 días siguientes a su primer pago",
    noSchema: "Añadir marcado schema (datos estructurados) a sus artículos.",
    noImage: "si no lo está, el artículo se redacta igualmente",
    cta: "Empezar la prueba de Launch",
    annual: /anual|al año|por año/i,
  },
  fr: {
    price: "€59 par mois, facturés en euros, après un essai gratuit de 3 jours",
    regular: "€99 par mois",
    articles: "30 articles SEO par mois",
    trial: "jusqu'à 3 articles sur les trois jours",
    charged: "À la fin de l'essai, €59 sont prélevés",
    firstArticle: "Le premier article de votre site est publié en ligne dès qu'il est rédigé",
    notDefault: "La relecture n'est pas le mode par défaut",
    eligibility: "un nouveau compte qui n'a jamais eu d'abonnement",
    payment: "une carte ou une autorisation PayPal",
    cancel: "Vous pouvez résilier à tout moment depuis la page de facturation",
    refund: "dans les 3 jours suivant votre premier paiement",
    noSchema: "Ajouter un balisage schema (données structurées) à vos articles.",
    noImage: "sinon, l'article est tout de même rédigé",
    cta: "Commencer l'essai Launch",
    annual: /annuel|par an/i,
  },
} as const;

beforeEach(() => {
  listPlans.mockResolvedValue(PLANS);
  offerOn.mockReturnValue(true);
});

describe("/it|de|es|fr/seo-content-automation", () => {
  it("exists in exactly the four other languages; /en and unknown prefixes are 404s", async () => {
    expect([...SEO_CONTENT_AUTOMATION_LOCALES].sort()).toEqual(["de", "es", "fr", "it"]);
    expect(LOCALE_ONLY_PATHS[SEO_CONTENT_AUTOMATION_PATH]).toEqual(SEO_CONTENT_AUTOMATION_LOCALES);
    for (const locale of ["en", "xx", "pt"]) {
      await expect(Page(params(locale))).rejects.toThrow("NEXT_NOT_FOUND");
      expect(await generateMetadata(params(locale))).toEqual({});
    }
    expect(dynamic).toBe("force-dynamic");
  });

  it.each(SEO_CONTENT_AUTOMATION_LOCALES)("%s: its own canonical, no hreflang, not indexed and not in the sitemap", async (locale) => {
    const metadata = await generateMetadata(params(locale));
    const copy = seoContentAutomationCopy(null, locale);
    expect(metadata).toMatchObject({ title: copy.metaTitle, description: copy.metaDescription, robots: { index: false, follow: true } });
    expect(metadata.alternates).toEqual({ canonical: `/${locale}/seo-content-automation` });
    expect(metadata.openGraph?.url).toBe(`/${locale}/seo-content-automation`);
    expect(TRANSLATED_PATHS.has(SEO_CONTENT_AUTOMATION_PATH)).toBe(false);
    expect(isPublicEnglishPage(SEO_CONTENT_AUTOMATION_PATH)).toBe(false);
    // Search shows at most ~60 characters of a title and ~160 of a description.
    expect(copy.metaTitle.length).toBeLessThanOrEqual(60);
    expect(copy.metaDescription.length).toBeLessThanOrEqual(185);
  });

  it.each(SEO_CONTENT_AUTOMATION_LOCALES)("%s: one h1, the Launch trial twice, and links in its own language where they exist", async (locale) => {
    const html = await render(locale);
    expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
    const launch = signUpForPlan("launch").replace(/&/g, "&amp;");
    expect(html.split(`href="${launch}"`).length - 1).toBe(2);
    const hrefs = new Set([...html.matchAll(/href="([^"]*)"/g)].map((match) => match[1]));
    expect([...hrefs].sort()).toEqual([launch, `/${locale}/docs/integrations`, `/${locale}/pricing`, "/refunds", "/terms"].sort());
    expect(localePath(locale, "/refunds")).toBe("/refunds");
    // The English-only policy pages are marked as English, and the copy says so.
    expect(html).toContain('href="/refunds" hrefLang="en"');
    expect(html).toContain('href="/terms" hrefLang="en"');
    expect(at(html, seoContentAutomationCopy(null, locale).termsLinks.englishOnly!)).toBeGreaterThan(-1);
    expect(html).not.toMatch(/gclid|utm_|wbraid|gbraid|gtag\(|dataLayer/);
    expect(text(html)).toContain(EXPECT[locale].cta);
  });

  it.each(SEO_CONTENT_AUTOMATION_LOCALES)("%s: the Launch row's charged price and limits, and no reference price, saving or annual figure", async (locale) => {
    const page = text(await render(locale));
    const words = EXPECT[locale];
    expect(page).toContain(words.price);
    expect(page).toContain(words.articles);
    expect(page).toContain(words.trial);
    expect(page).toContain(words.charged);
    expect(page).not.toMatch(/€99|€299|€49|%|KEEPGROW|countdown/i);
    expect(page).not.toMatch(words.annual);

    offerOn.mockReturnValue(false);
    const regular = text(await render(locale));
    expect(regular).toContain(words.regular);
    expect(regular).not.toContain("€59");
  });

  it.each(SEO_CONTENT_AUTOMATION_LOCALES)("%s: publishing is automatic and the first article goes live, said next to the workflow", async (locale) => {
    const html = await render(locale);
    const copy = seoContentAutomationCopy(null, locale);
    const steps = at(html, copy.stepsTitle);
    const notice = at(html, copy.publishing.title);
    const connections = at(html, copy.connectionsTitle);
    expect(steps).toBeGreaterThan(-1);
    expect(notice).toBeGreaterThan(steps);
    expect(notice).toBeLessThan(connections);
    const page = text(html);
    expect(page).toContain(EXPECT[locale].firstArticle);
    expect(page).toContain(EXPECT[locale].notDefault);
  });

  it.each(SEO_CONTENT_AUTOMATION_LOCALES)("%s: eligibility, payment method, renewal, cancellation and the separate refund", async (locale) => {
    const page = text(await render(locale));
    const words = EXPECT[locale];
    for (const phrase of [words.eligibility, words.payment, words.cancel, words.refund]) expect(page).toContain(phrase);
  });

  it.each(SEO_CONTENT_AUTOMATION_LOCALES)("%s: the same publishers and languages as the English page, and none of the unsupported claims", async (locale) => {
    const page = text(await render(locale));
    const english = seoContentAutomationCopy(null);
    const copy = seoContentAutomationCopy(null, locale);
    // Same structure: as many steps, notices, connections, limits, terms and questions.
    expect(copy.steps).toHaveLength(english.steps.length);
    expect(copy.publishing.points).toHaveLength(english.publishing.points.length);
    expect(copy.connections).toHaveLength(english.connections.length);
    expect(copy.limits).toHaveLength(english.limits.length);
    expect(copy.terms).toHaveLength(english.terms.length);
    expect(copy.faq).toHaveLength(english.faq.length);
    for (const name of ["WordPress", "Shopify", "Ghost", "Webflow", "Wix", "Webhook"]) expect(page.toLowerCase()).toContain(name.toLowerCase());
    expect(page).not.toMatch(/Framer|Squarespace|HubSpot|Notion/);
    expect(page).not.toMatch(/ChatGPT|Gemini|Perplexity|Claude|priorit|garantiert\b|garantito\b|garantizado\b|garanti\b/i);
    // The article languages listed are the ones RepGet writes in: as many names as SUPPORTED_LANGUAGES.
    const languages = copy.planPoints.find((point) => /portug|portog/i.test(point))!;
    expect(languages.split(/,| e | und | y | et /).length).toBe(SUPPORTED_LANGUAGES.length);
    // Images are not promised; schema appears only where the page says RepGet does not add it.
    expect(page).toContain(EXPECT[locale].noImage);
    expect(page.match(/schema/gi)).toHaveLength(1);
    expect(page).toContain(EXPECT[locale].noSchema);
  });
});
