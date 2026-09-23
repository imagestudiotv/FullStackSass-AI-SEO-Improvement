"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { LOCALE_NAMES, LOCALES, type Locale } from "@/lib/i18n/config";
import type { Messages } from "@/lib/i18n/messages";
import { setFirstPassword } from "./password-actions";

/**
 * Personal details: name, email, password, and the dashboard language.
 *
 * The name was read-only before — shown in a definition list with no way to
 * correct it. Someone who signed up with a typo, or whose Google account
 * carries a different name than they use at work, had no way to change it.
 *
 * EMAIL IS DELIBERATELY NOT EDITABLE. It is the login identifier and the
 * address every receipt goes to, so changing it needs the new address
 * verified before the old one stops working — otherwise a typo locks someone
 * out of their own account. That is a flow with emails in it, and this
 * product has no email provider configured. Shown as text rather than a
 * disabled input, because a greyed-out field invites people to try.
 */

/**
 * The languages the dashboard is offered in.
 *
 * Read from the shared config rather than listed here, so this control and
 * the marketing site's switcher cannot drift apart — adding a locale in one
 * place used to leave the other showing a language nobody could pick.
 */
const LANGUAGES = LOCALES.map((id) => ({ id, label: LOCALE_NAMES[id] }));

export function PersonalDetails({
  initialName,
  email,
  /**
   * False when the account signs in with Google and has never set a
   * password. Both cases offer the button; this picks the form behind it.
   */
  hasPassword,
  initialLocale,
  t,
}: {
  initialName: string;
  email: string;
  hasPassword: boolean;
  /** The language the dashboard is currently rendered in. */
  initialLocale: Locale;
  /** This screen's copy, already in the reader's language. */
  t: Messages["app"]["settings"];
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [savedName, setSavedName] = useState(initialName);
  const [pending, startTransition] = useTransition();
  const [changing, setChanging] = useState(false);
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const [savingLocale, setSavingLocale] = useState(false);

  const dirty = name.trim() !== savedName.trim() && name.trim().length > 0;

  function handleSaveName() {
    startTransition(async () => {
      const trimmed = name.trim();
      const { error } = await authClient.updateUser({ name: trimmed });
      if (error) {
        toast.error(error.message ?? t.nameError);
        return;
      }
      setSavedName(trimmed);
      toast.success(t.nameSaved);
      // The sidebar and the account menu render it too.
      router.refresh();
    });
  }

  /**
   * Saves the dashboard language and re-renders the app in it.
   *
   * Saved on change rather than behind a button: it is a single choice with
   * an immediately visible result, and the whole page re-renders in the new
   * language, which is its own confirmation.
   *
   * The optimistic setLocale is reverted on failure — leaving the dropdown
   * showing a language the account is not actually set to would make the next
   * page load look like it forgot.
   */
  function handleLocaleChange(next: Locale) {
    const previous = locale;
    setLocale(next);
    setSavingLocale(true);
    startTransition(async () => {
      const { error } = await authClient.updateUser({ locale: next });
      setSavingLocale(false);
      if (error) {
        setLocale(previous);
        toast.error(error.message ?? t.languageError);
        return;
      }
      // Every server component re-reads the preference on the next render.
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t.personalTitle}</CardTitle>
        <CardDescription>{t.personalSubtitle}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="account-name">{t.nameLabel}</Label>
          <Input
            id="account-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t.namePlaceholder}
          />
          {/*
            The save appears only once the name has actually changed, rather
            than sitting under the field permanently. A button that is always
            there on a single-field form reads as something you must press.
          */}
          {dirty ? (
            <div className="flex gap-2 pt-1">
              <Button size="sm" onClick={handleSaveName} disabled={pending}>
                {pending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    {t.saving}
                  </>
                ) : (
                  t.saveName
                )}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setName(savedName)}
                disabled={pending}
              >
                {t.cancel}
              </Button>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-medium">{t.emailLabel}</p>
            <p className="truncate text-sm text-muted-foreground">{email}</p>
          </div>

          {/*
            Offered whether or not a password exists.

            It used to be hidden for Google accounts, replaced by a note
            reading "You sign in with Google" — accurate, and a dead end. The
            client asked for the opposite: "We'd like to permit change
            password also for google registered accounts. In this way it will
            ask for a new password directly. I think it will be useful, many
            are comfortable to still having login email and password."

            So the button is unconditional and the FORM differs: with a
            password it asks for the current one first, without a password it
            asks for the new one only. Adding a password does not take Google
            away — the account keeps both ways in, which is the point.
          */}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setChanging((open) => !open)}
          >
            {hasPassword ? t.changePassword : t.setPassword}
          </Button>
        </div>

        {changing ? (
          <ChangePassword
            hasPassword={hasPassword}
            onDone={() => setChanging(false)}
            t={t}
          />
        ) : null}

        <div className="space-y-1.5">
          <Label htmlFor="dashboard-language">{t.languageLabel}</Label>
          <select
            id="dashboard-language"
            value={locale}
            onChange={(event) =>
              handleLocaleChange(event.target.value as Locale)
            }
            disabled={savingLocale}
            className="flex h-9 w-full max-w-xs rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {LANGUAGES.map((language) => (
              <option key={language.id} value={language.id}>
                {language.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">{t.languageHelp}</p>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * The password form, in either of its two shapes.
 *
 * WITH an existing password it asks for the current one as well as the new
 * one — Better Auth requires it, and so it should: a session left open on a
 * shared machine should not be enough to lock the owner out of their own
 * account. revokeOtherSessions is ON for that path. Somebody changing their
 * password is usually doing it because they think someone else has it;
 * leaving other sessions signed in would defeat the point of the exercise.
 *
 * WITHOUT one — a Google account adding email-and-password sign-in — there is
 * no current password to ask for, so the form asks for the new one directly
 * and other sessions are left signed in. Nothing was compromised; an account
 * is only gaining a second way in, and signing someone out of their phone for
 * it would read as a bug.
 *
 * The two paths also differ in HOW they reach Better Auth. changePassword is
 * a normal client call. setPassword is serverOnly and has no client method,
 * for good reason — it needs no current password — so it goes through a
 * server action. See password-actions.ts.
 */
function ChangePassword({
  hasPassword,
  onDone,
  t,
}: {
  /** False for a Google account that has never set one. */
  hasPassword: boolean;
  onDone: () => void;
  t: Messages["app"]["settings"];
}) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    // Matches the sign-up rule, so the two screens cannot disagree.
    if (next.length < 8) {
      toast.error(t.passwordTooShort);
      return;
    }

    startTransition(async () => {
      if (!hasPassword) {
        const result = await setFirstPassword(next);

        if (!result.ok) {
          toast.error(
            result.error === "TOO_SHORT" ? t.passwordTooShort : t.passwordError,
          );
          /*
            ALREADY_SET means this screen was rendered from stale data — a
            password was added in another tab since. Re-reading the page
            swaps this form for the change-password one, so the retry asks
            for the current password as it should.
          */
          if (result.error === "ALREADY_SET") router.refresh();
          return;
        }

        setNext("");
        toast.success(t.passwordCreated);
        /*
          The page decides which form to show from whether a password
          exists, and one now does. Without this the panel would keep
          offering to set a first password until the next full load.
        */
        router.refresh();
        onDone();
        return;
      }

      const { error } = await authClient.changePassword({
        currentPassword: current,
        newPassword: next,
        revokeOtherSessions: true,
      });

      if (error) {
        toast.error(error.message ?? t.passwordError);
        return;
      }

      setCurrent("");
      setNext("");
      toast.success(t.passwordSaved);
      onDone();
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-xl border bg-muted/30 p-4"
    >
      {/*
        Explains why this form is here at all for a Google account, where
        "set a password" is an offer rather than the expected chore. Not
        shown on the change path, where the button already said it.
      */}
      {!hasPassword ? (
        <p className="text-xs text-muted-foreground">{t.setPasswordIntro}</p>
      ) : null}

      {/*
        Only where there is a current password to give. Rendering it disabled
        or empty for a Google account would ask for something that does not
        exist — the dead end this whole change removes.
      */}
      {hasPassword ? (
        <div className="space-y-1.5">
          <Label htmlFor="current-password">{t.currentPassword}</Label>
          <Input
            id="current-password"
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            required
          />
        </div>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="new-password">{t.newPassword}</Label>
        <Input
          id="new-password"
          type="password"
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          required
        />
        <p className="text-xs text-muted-foreground">
          {/*
            The change path warns that other devices get signed out. The set
            path must not carry that line: it does not revoke anything, and
            promising a sign-out that never happens is worse than saying
            nothing.
          */}
          {hasPassword ? t.passwordHelp : t.setPasswordHelp}
        </p>
      </div>

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              {hasPassword ? t.changing : t.settingPassword}
            </>
          ) : hasPassword ? (
            t.changePassword
          ) : (
            t.setPassword
          )}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          {t.cancel}
        </Button>
      </div>
    </form>
  );
}
