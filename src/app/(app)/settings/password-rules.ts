import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from "@/lib/auth/password-policy";
import type { Messages } from "@/lib/i18n/messages";

/**
 * The password form's checks and its error wording, kept apart from the
 * component so they can be tested.
 *
 * The limits are the server's own (lib/auth/password-policy.ts, which
 * lib/auth.ts configures Better Auth with). Checking them here only says so
 * before a round trip; the server still decides.
 */
export { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH };

type SettingsCopy = Messages["app"]["settings"];

/** Which part of the form an error belongs beside. */
export type PasswordErrorTarget = "current" | "next" | "form";

export type PasswordError = { target: PasswordErrorTarget; message: string };

/** The new password's length, before anything is sent. */
export function checkNewPassword(value: string, t: SettingsCopy): PasswordError | null {
  if (value.length < MIN_PASSWORD_LENGTH) return { target: "next", message: t.passwordTooShort };
  if (value.length > MAX_PASSWORD_LENGTH) return { target: "next", message: t.passwordTooLong };
  return null;
}

/**
 * A changePassword failure in the reader's language.
 *
 * Better Auth's `message` is English ("Invalid password"), and it used to be
 * shown ahead of the translation. Its `code` is stable, so the known ones are
 * mapped and anything else gets the generic sentence.
 */
export function changePasswordError(
  error: { code?: string; status?: number } | null | undefined,
  t: SettingsCopy,
): PasswordError {
  if (error?.status === 429) return { target: "form", message: t.tooManyAttempts };
  switch (error?.code) {
    case "INVALID_PASSWORD":
      return { target: "current", message: t.currentPasswordWrong };
    case "PASSWORD_TOO_SHORT":
      return { target: "next", message: t.passwordTooShort };
    case "PASSWORD_TOO_LONG":
      return { target: "next", message: t.passwordTooLong };
    default:
      return { target: "form", message: t.passwordError };
  }
}

/**
 * A setFirstPassword failure. ALREADY_SET means the page was rendered from
 * stale data (a password was added in another tab), so it also asks for a
 * refresh, which swaps in the change-password form.
 */
export function setPasswordError(code: string, t: SettingsCopy): PasswordError & { refresh: boolean } {
  if (code === "TOO_SHORT") return { target: "next", message: t.passwordTooShort, refresh: false };
  if (code === "TOO_LONG") return { target: "next", message: t.passwordTooLong, refresh: false };
  if (code === "ALREADY_SET") return { target: "form", message: t.passwordAlreadySet, refresh: true };
  return { target: "form", message: t.passwordError, refresh: false };
}
