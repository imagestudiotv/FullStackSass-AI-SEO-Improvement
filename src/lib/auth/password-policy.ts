/**
 * Password length, in ONE place: the auth server (lib/auth.ts), the sign-up
 * form, the settings form and the set-first-password action all read it, so
 * none of them can promise or check a different rule (client's launch review,
 * 2026-10-03: "explicit minimum password length").
 *
 * Plain constants with no imports, because browser forms read them too.
 *
 * 8 and 128 are what Better Auth already enforced by default; stating them
 * changes nothing for anyone. Only NEW passwords are checked - sign-up,
 * change and set - while signing in never checks length, so a later change
 * here cannot lock out an existing account.
 */
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;
