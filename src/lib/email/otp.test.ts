import { beforeEach, describe, expect, it, vi } from "vitest";

import { LOCALES } from "@/lib/i18n/config";

/**
 * The one-time-code emails in the reader's language (2026-11-18): the code
 * that starts the free trial is the first email a visitor from an Italian,
 * German, Spanish or French page receives. English stays word for word.
 */

const sendEmail = vi.hoisted(() => vi.fn(async (_message: { to: string; subject: string; html: string; text: string }) => ({ ok: true as const })));
vi.mock("@/lib/email/send", () => ({ sendEmail }));

import { otpWords, sendOtpEmail } from "@/lib/email/otp";

const PURPOSES = ["sign-in", "email-verification", "forget-password", "change-email"] as const;

beforeEach(() => sendEmail.mockClear());

const sent = async (locale?: (typeof LOCALES)[number] | null) => {
  await sendOtpEmail({ to: "a@example.com", code: "123456", purpose: "email-verification", expiresInSeconds: 600, locale });
  return sendEmail.mock.calls[0][0];
};

describe("one-time-code emails", () => {
  it("every language has every purpose and sentence, none empty", () => {
    for (const locale of LOCALES) {
      const words = otpWords(locale);
      expect(Object.keys(words.purposes).sort()).toEqual([...PURPOSES].sort());
      for (const purpose of PURPOSES) for (const value of Object.values(words.purposes[purpose])) expect(value.trim()).not.toBe("");
      expect(words.expires).toContain("{window}");
      expect(words.minutes(1)).not.toBe(words.minutes(10));
    }
  });

  it("English is unchanged, and is the default", async () => {
    for (const message of [await sent("en"), await (async () => (sendEmail.mockClear(), sent(undefined)))()]) {
      expect(message.subject).toBe("Confirm your email address");
      expect(message.text).toContain("Enter this code to confirm this address belongs to you.");
      expect(message.text).toContain("This code expires in 10 minutes.");
      expect(message.text).toContain("If you did not request this, you can ignore this email.");
      expect(message.html).toContain('<html lang="en">');
    }
  });

  it.each([
    ["it", "Confermi il suo indirizzo email", "Questo codice scade tra 10 minuti."],
    ["de", "Bestätigen Sie Ihre E-Mail-Adresse", "Dieser Code läuft in 10 Minuten ab."],
    ["es", "Confirme su dirección de correo", "Este código caduca en 10 minutos."],
    ["fr", "Confirmez votre adresse e-mail", "Ce code expire dans 10 minutes."],
  ] as const)("%s: subject, body and html lang in that language, and the code itself", async (locale, subject, expires) => {
    const message = await sent(locale);
    expect(message.subject).toBe(subject);
    expect(message.text).toContain(expires);
    expect(message.text).toContain("123456");
    expect(message.html).toContain(`<html lang="${locale}">`);
    expect(message.text).not.toMatch(/This code expires|If you did not request/);
  });
});
