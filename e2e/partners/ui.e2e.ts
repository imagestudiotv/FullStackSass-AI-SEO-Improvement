import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { executeSettlement } from "@/lib/partners/application/use-cases/execute-transfer";
import { prepareSettlement } from "@/lib/partners/application/use-cases/prepare-settlement";

import { Browser, DESKTOP, PHONE, type Page } from "./browser";
import { approvedPartner, ensureE2ePlan, openProgram, person, referredPayment, signedInAdmin, signIn, STATE, stripeWorld, unique } from "./driver";

/**
 * Flow 20: every partner-portal page and every admin partner page, on a
 * phone and a desktop, light and dark - rendered by the running app with
 * real data: no error status, no sideways scrolling, no console error, no
 * unfilled placeholder, readable text in the page content, keyboard focus
 * visible, and dialogs that fit a phone.
 */

const base = STATE.baseUrl;
let browser: Browser;
let admin: Awaited<ReturnType<typeof signedInAdmin>>;
let partnerPage: Page;
let partnerId: string;
let settlementId: string;

beforeAll(async () => {
  await openProgram();
  await ensureE2ePlan();
  browser = await Browser.launch();
  admin = await signedInAdmin(browser);
  const w = stripeWorld();
  const partner = await approvedPartner(w, { name: unique("Ui") });
  partnerId = partner.partnerId;
  await referredPayment(w, partner.code, 9900, 40, { domain: "harbor-legal.co.uk" });
  await referredPayment(w, partner.code, 9900, 40);
  await referredPayment(w, partner.code, 9900, 5, { domain: "casa-verde.es" });
  const prepared = await prepareSettlement(w.deps, { kind: "system", origin: "e2e" }, { partnerId, currency: "eur", runKey: unique("run") });
  if (prepared.kind !== "created") throw new Error("no settlement");
  settlementId = prepared.settlementId;
  await executeSettlement(w.deps, settlementId);
  const portal = await person(browser);
  await signIn(portal.page, partner.email);
  partnerPage = portal.page;
});

afterAll(async () => {
  await browser?.close();
});

/** Text in the page content (not the admin shell) under 4.5:1 (3:1 when large). */
function lowContrast(): { text: string; ratio: number }[] {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const rgba = (color: string) => {
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = "#000";
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    return [r, g, b, a / 255];
  };
  const lum = ([r, g, b]: number[]) => {
    const f = (c: number) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const blend = (top: number[], bottom: number[]) => [0, 1, 2].map((i) => top[i] * top[3] + bottom[i] * (1 - top[3])).concat(1);
  const background = (element: Element) => {
    const layers: number[][] = [];
    for (let node: Element | null = element; node; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.backgroundImage !== "none") return null;
      const color = rgba(style.backgroundColor);
      if (color[3] > 0) layers.push(color);
      if (color[3] >= 1) break;
    }
    let result = rgba(getComputedStyle(document.body).backgroundColor);
    for (const layer of layers.reverse()) result = blend(layer, result);
    return result;
  };
  const found: { text: string; ratio: number }[] = [];
  const root = document.querySelector("main") ?? document.body;
  for (const element of root.querySelectorAll<HTMLElement>("*")) {
    if (element.closest("svg,[aria-hidden=true],.sr-only") || (element as HTMLButtonElement).disabled) continue;
    const text = [...element.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent?.trim()).join(" ").trim();
    if (!text) continue;
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    if (rect.width === 0 || rect.height === 0 || style.visibility === "hidden") continue;
    const bg = background(element);
    if (!bg) continue;
    const fg = blend(rgba(style.color), bg);
    const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x);
    const ratio = (a + 0.05) / (b + 0.05);
    const large = parseFloat(style.fontSize) >= 18.66 || (parseFloat(style.fontSize) >= 14 && Number(style.fontWeight) >= 700);
    if (ratio < (large ? 3 : 4.5)) found.push({ text: text.slice(0, 40), ratio: Math.round(ratio * 100) / 100 });
  }
  return found;
}

async function check(page: Page, path: string) {
  const findings: string[] = [];
  for (const theme of ["light", "dark"] as const) {
    for (const [device, viewport] of [["desktop", DESKTOP], ["phone", PHONE]] as const) {
      await page.setViewport(viewport);
      await page.setTheme(theme);
      const doc = await page.goto(`${base}${path}`);
      await new Promise((resolve) => setTimeout(resolve, 300));
      const where = `${path} ${theme} ${device}`;
      if (doc.status !== 200) findings.push(`${where}: status ${doc.status}`);
      if (doc.path.split("?")[0] !== path.split("?")[0]) findings.push(`${where}: landed on ${doc.path}`);
      const overflow = await page.horizontalOverflow();
      if (overflow > 0) findings.push(`${where}: ${overflow}px sideways`);
      const dark = await page.evaluate(() => document.documentElement.classList.contains("dark"));
      if (dark !== (theme === "dark")) findings.push(`${where}: theme not applied`);
      const unfilled = await page.evaluate(() => document.body.innerText.match(/\{[a-z]+\}/gi) ?? []);
      if (unfilled.length) findings.push(`${where}: unfilled ${unfilled.join(" ")}`);
      // Vercel's analytics script exists only on Vercel; its 404 here is not the app's.
      const errors = page.errors.filter((error) => !/_vercel\/insights|status of 404/.test(error));
      if (errors.length) findings.push(`${where}: ${errors.join(" | ")}`);
      const low = await page.evaluate(lowContrast);
      if (low.length) findings.push(`${where}: low contrast ${low.map((l) => `"${l.text}" ${l.ratio}`).join(", ")}`);
    }
  }
  return findings;
}

describe("20: mobile and dark-mode usability", () => {
  it.each(["/partner", "/partner?range=365", "/partner/referrals", "/partner/commissions", "/partner/payouts", "/partner/resources", "/partner/settings"])(
    "partner portal %s",
    async (path) => {
      expect(await check(partnerPage, path)).toEqual([]);
    },
  );

  it.each(["/partners", "/es/partners", "/de/partners"])("public page %s", async (path) => {
    expect(await check(partnerPage, path)).toEqual([]);
  });

  it("the /partners estimate follows the customer count and the plan, at the levels the program pays", async () => {
    await partnerPage.setViewport(PHONE);
    await partnerPage.setTheme("light");
    await partnerPage.goto(`${base}/partners`);
    await partnerPage.waitForText("Estimate your earnings");
    // 10 paying customers on Grow (EUR 99): Growth Partner, 30%: EUR 297 a month, EUR 3,564 over 12 months.
    await partnerPage.waitForText("€297");
    await partnerPage.waitForText("€3,564");
    await partnerPage.fill('input[type="number"]', "25");
    await partnerPage.waitForText("Premier Partner");
    // 25 x 35% of EUR 99 = 25 x EUR 34.65.
    await partnerPage.waitForText("€866.25");
    await partnerPage.fill('input[type="number"]', "3");
    await partnerPage.waitForText("€74.25");
    // The questions are in the page, with their structured data.
    const faq = await partnerPage.evaluate(() => {
      const script = document.querySelector('script[type="application/ld+json"]');
      const schema = script ? (JSON.parse(script.textContent ?? "{}") as { "@type"?: string; mainEntity?: unknown[] }) : {};
      // The FAQ's own questions (the site menu uses <details> too).
      return { type: schema["@type"], questions: schema.mainEntity?.length ?? 0, details: document.querySelectorAll('[aria-labelledby="partners-faq"] details').length };
    });
    expect(faq).toEqual({ type: "FAQPage", questions: faq.details, details: faq.details });
    expect(faq.details).toBeGreaterThanOrEqual(6);
  });

  it.each([
    "/admin/partners",
    "/admin/partners/applications",
    "/admin/partners/partners",
    "/admin/partners/partners/{partner}",
    "/admin/partners/attribution",
    "/admin/partners/commissions",
    "/admin/partners/payouts",
    "/admin/partners/payouts/{settlement}",
    "/admin/partners/reviews",
    "/admin/partners/coupons",
  ])("admin %s", async (template) => {
    const path = template.replace("{partner}", partnerId).replace("{settlement}", settlementId);
    expect(await check(admin.page, path)).toEqual([]);
  });

  it("every control on the resources page can be reached by keyboard, with a visible focus indicator", async () => {
    await partnerPage.setViewport(DESKTOP);
    await partnerPage.setTheme("light");
    await partnerPage.goto(`${base}/partner/resources`);
    const seen: { tag: string; text: string; visible: boolean }[] = [];
    for (let i = 0; i < 20; i += 1) {
      await partnerPage.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
      await partnerPage.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
      seen.push(
        await partnerPage.evaluate(() => {
          const element = document.activeElement as HTMLElement;
          const style = getComputedStyle(element);
          return { tag: element.tagName, text: (element.textContent ?? "").trim().slice(0, 30), visible: (style.outlineStyle !== "none" && style.outlineWidth !== "0px") || style.boxShadow !== "none" };
        }),
      );
    }
    expect(seen.filter((entry) => entry.tag !== "BODY" && !entry.visible)).toEqual([]);
    expect(seen.some((entry) => /Download/.test(entry.text))).toBe(true);
  });

  it("administrator dialogs fit a phone and take the focus", async () => {
    await admin.page.setViewport(PHONE);
    for (const [path, button] of [
      [`/admin/partners/partners/${partnerId}`, "Adjust balance…"],
      [`/admin/partners/partners/${partnerId}`, "Create coupon…"],
      [`/admin/partners/partners/${partnerId}`, "Suspend…"],
      [`/admin/partners/partners/${partnerId}`, "Change link name…"],
    ] as const) {
      await admin.page.goto(`${base}${path}`);
      await admin.page.clickByText(button);
      const dialog = (await admin.page.waitFor(() => {
        const element = document.querySelector('[role="dialog"]');
        if (!element) return null;
        const rect = element.getBoundingClientRect();
        return { left: rect.left, right: rect.right, width: window.innerWidth, focused: element.contains(document.activeElement) };
      }))!;
      expect(dialog.left).toBeGreaterThanOrEqual(0);
      expect(dialog.right).toBeLessThanOrEqual(dialog.width);
      expect(dialog.focused).toBe(true);
    }
  });
});
