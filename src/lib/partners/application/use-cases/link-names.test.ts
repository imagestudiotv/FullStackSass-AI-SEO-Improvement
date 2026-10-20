import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { adminAuditLog, partnerClicks, partnerReferralCodes } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";
import { partnerTestDeps, seedPartner, seedUser, setControl } from "@/test/partners";

/**
 * Readable link names (repget.com/?ref=<name>): chosen or suggested at
 * approval, changeable later, old names still working for the same partner
 * and never given to anyone else. Real repositories on PGlite.
 */

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }),
  isDatabaseConfigured: () => true,
}));

import type { AdminContext } from "../contracts/commands";
import { recordReferralClick } from "./record-referral-click";
import { approveApplication, changeReferralCode, sendWelcome, suggestReferralCode } from "./review-application";
import { submitApplication } from "./submit-application";

let test: TestDb;
const admin: AdminContext = { kind: "admin", userId: "admin-user", email: "admin@repget.test" };
const answers = {
  website: "https://newsletter.example",
  audience: "Marketing agencies in Italy, about 4,000 readers",
  promotion: "A monthly newsletter and two YouTube reviews",
  country: "IT",
};

beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
  await setControl(test.db, "partner_program", true);
});

async function application(name: string) {
  const { deps } = partnerTestDeps(test.db);
  const person = await seedUser(test.db, { name });
  const result = await submitApplication(deps, { kind: "applicant", userId: person.id, email: person.email, name }, answers);
  if (!result.ok) throw new Error(result.reason);
  return result.value.applicationId;
}

async function approve(name: string, requested: string | null = null) {
  const { deps } = partnerTestDeps(test.db);
  const result = await approveApplication(deps, admin, await application(name), null, requested);
  if (!result.ok) throw new Error(`${result.reason} ${result.detail ?? ""}`);
  return result.value.partner;
}

async function click(code: string) {
  const { deps } = partnerTestDeps(test.db);
  return recordReferralClick(deps, { code, existingToken: null, landingPath: "/", referrerHost: null, visitor: `visitor-${Math.random()}` });
}

describe("link names at approval", () => {
  it("suggests the first name, then the whole name, then numbers", async () => {
    const { deps } = partnerTestDeps(test.db);
    expect(await suggestReferralCode(deps, "Dami Olu")).toBe("dami");
    const first = await approve("Dami Olu");
    expect(first.referralCode).toBe("dami");
    expect(await suggestReferralCode(deps, "Dami Olu")).toBe("dami-olu");
    expect((await approve("Dami Olu")).referralCode).toBe("dami-olu");
    expect((await approve("Dami Olu")).referralCode).toBe("dami2");
    expect((await approve("José Ñúñez")).referralCode).toBe("jose");
  });

  it("uses the administrator's choice, and records it as the partner's name", async () => {
    const partner = await approve("Someone Else", "  John-Ten ");
    expect(partner.referralCode).toBe("john-ten");
    const rows = await test.db.select().from(partnerReferralCodes).where(eq(partnerReferralCodes.partnerId, partner.id));
    expect(rows).toMatchObject([{ code: "john-ten", retiredAt: null, createdByEmail: "admin@repget.test" }]);
  });

  it("refuses a taken, reserved or malformed choice, and creates nothing", async () => {
    await approve("Taken Name", "taken-name");
    const { deps } = partnerTestDeps(test.db);
    const id = await application("Another Person");
    expect(await approveApplication(deps, admin, id, null, "Taken-Name")).toEqual({ ok: false, reason: "conflict", detail: "link_taken" });
    expect(await approveApplication(deps, admin, id, null, "producthunt")).toMatchObject({ ok: false, detail: "link_reserved" });
    expect(await approveApplication(deps, admin, id, null, "ilove-repget")).toMatchObject({ ok: false, detail: "link_reserved" });
    expect(await approveApplication(deps, admin, id, null, "ab")).toMatchObject({ ok: false, detail: "link_format" });
    expect(await approveApplication(deps, admin, id, null, "a--b")).toMatchObject({ ok: false, detail: "link_format" });
    expect(await approveApplication(deps, admin, id, null, "dami/x")).toMatchObject({ ok: false, detail: "link_format" });
    // Still waiting: the refusals changed nothing.
    const later = await approveApplication(deps, admin, id, null, "another-person");
    expect(later.ok && later.value.partner.referralCode).toBe("another-person");
  });

  it("falls back to a random code for a name without Latin letters", async () => {
    expect((await approve("李")).referralCode).toMatch(/^[abcdefghjkmnpqrstuvwxyz23456789]{10}$/);
  });

  it("the welcome email carries the readable link", async () => {
    const env = partnerTestDeps(test.db);
    const partner = await approve("Welcome Reader", "welcome-reader");
    expect(await sendWelcome(env.deps, partner.id)).toEqual({ ok: true, value: "sent" });
    expect(env.mail.find((m) => m.to === partner.contactEmail)?.link).toBe("https://repget.test/?ref=welcome-reader");
  });
});

describe("changing a link name", () => {
  it("the new name works, the old one still counts for the same partner, and it is audited", async () => {
    const partner = await approve("Rename Me", "rename-me");
    const { deps } = partnerTestDeps(test.db);
    expect(await changeReferralCode(deps, admin, partner.id, "Renamed", "Partner asked for a shorter name")).toEqual({
      ok: true,
      value: { code: "renamed", changed: true },
    });
    expect((await click("renamed")).recorded).toBe(true);
    expect((await click("rename-me")).recorded).toBe(true);
    const clicks = await test.db.select().from(partnerClicks).where(eq(partnerClicks.partnerId, partner.id));
    expect(clicks).toHaveLength(2);
    const names = await deps.uow.repositories.partners.referralCodes(partner.id);
    expect(names.map((name) => [name.code, name.retiredAt !== null])).toEqual([
      ["renamed", false],
      ["rename-me", true],
    ]);
    const audit = await test.db.select().from(adminAuditLog).where(eq(adminAuditLog.targetId, partner.id));
    expect(audit.find((row) => row.action === "partner.referral_code_changed")?.detail).toMatchObject({ from: "rename-me", to: "renamed" });
  });

  it("an old name is never given to another partner, at approval or by rename", async () => {
    const first = await approve("Kept Name");
    expect(first.referralCode).toBe("kept");
    const { deps } = partnerTestDeps(test.db);
    expect((await changeReferralCode(deps, admin, first.id, "kept-new", "Rebranded their newsletter")).ok).toBe(true);
    const id = await application("Kept Name");
    expect(await approveApplication(deps, admin, id, null, "kept")).toMatchObject({ ok: false, detail: "link_taken" });
    // Without a choice, the suggestion skips the retired name too.
    const suggested = await approveApplication(deps, admin, id);
    if (!suggested.ok) throw new Error(suggested.reason);
    expect(suggested.value.partner.referralCode).toBe("kept-name");
    const other = suggested.value.partner;
    expect(await changeReferralCode(deps, admin, other.id, "kept", "Wants the old name")).toMatchObject({ ok: false, detail: "link_taken" });
    expect(await changeReferralCode(deps, admin, other.id, "kept-new", "Wants the other name")).toMatchObject({ ok: false, detail: "link_taken" });
    // The old name still counts for the first partner.
    await click("kept");
    expect((await test.db.select().from(partnerClicks).where(eq(partnerClicks.partnerId, first.id))).length).toBe(1);
  });

  it("a partner can take back their own earlier name", async () => {
    const partner = await approve("Back Again", "back-again");
    const { deps } = partnerTestDeps(test.db);
    expect((await changeReferralCode(deps, admin, partner.id, "back-later", "Trying another name")).ok).toBe(true);
    expect(await changeReferralCode(deps, admin, partner.id, "back-again", "The first name was better")).toEqual({
      ok: true,
      value: { code: "back-again", changed: true },
    });
    const names = await deps.uow.repositories.partners.referralCodes(partner.id);
    expect(names.map((name) => [name.code, name.retiredAt !== null])).toEqual([
      ["back-again", false],
      ["back-later", true],
    ]);
  });

  it("needs a reason and a valid name; the same name is no change", async () => {
    const partner = await seedPartner(test.db, { code: "same-name" });
    const { deps } = partnerTestDeps(test.db);
    expect(await changeReferralCode(deps, admin, partner.partnerId, "other-name", "no")).toMatchObject({ ok: false, detail: "reason" });
    expect(await changeReferralCode(deps, admin, partner.partnerId, "x", "A good reason")).toMatchObject({ ok: false, detail: "link_format" });
    expect(await changeReferralCode(deps, admin, partner.partnerId, "SAME-NAME", "A good reason")).toEqual({
      ok: true,
      value: { code: "same-name", changed: false },
    });
  });
});
