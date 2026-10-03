"use client";

import { ArrowRight, KeyRound, Languages, Loader2, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { Field } from "@/components/workspace/field";
import { Notice } from "@/components/workspace/notice";
import { WorkspaceSection } from "@/components/workspace/section";
import { useUnsavedChanges } from "@/components/workspace/use-unsaved-changes";
import { authClient } from "@/lib/auth-client";
import { LOCALE_NAMES, LOCALES, type Locale } from "@/lib/i18n/config";
import { format } from "@/lib/i18n/format";
import type { Messages } from "@/lib/i18n/messages";

import { setFirstPassword } from "./password-actions";
import { changePasswordError, checkNewPassword, setPasswordError, type PasswordError } from "./password-rules";

/**
 * The person's own account: name and email, how they sign in, and the
 * dashboard language - three sections of the Account page.
 *
 * EMAIL IS DELIBERATELY NOT EDITABLE. It is the login identifier and the
 * address every receipt goes to, so changing it needs the new address
 * verified before the old one stops working, and Better Auth's changeEmail
 * is disabled. Shown as text with a sentence saying so, rather than as a
 * disabled input that invites people to try.
 */

/**
 * The languages the dashboard is offered in, from the shared config so this
 * control and the marketing site's switcher cannot drift apart.
 */
const LANGUAGES = LOCALES.map((id) => ({ id, label: LOCALE_NAMES[id] }));

/**
 * Saves the person's own name or language through Better Auth.
 *
 * True only when the server confirmed it. The client returns an error for a
 * refusal but THROWS when the request never completes (offline, a dropped
 * connection); inside a transition that throw would replace the whole
 * Account page with the error screen, so it reads as a failed save instead.
 */
export async function updatedAccount(fields: Parameters<typeof authClient.updateUser>[0]): Promise<boolean> {
  try {
    const { error } = await authClient.updateUser(fields);
    return !error;
  } catch {
    return false;
  }
}

/** A native select drawn exactly like Input (h-8, rounded-lg, the same focus ring). */
const SELECT_CLASS =
  "h-8 w-full max-w-xs min-w-0 rounded-lg border border-input bg-transparent px-2.5 text-base outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none md:text-sm";

export function PersonalDetails({
  initialName,
  email,
  hasPassword,
  googleLinked,
  initialLocale,
  articleLanguageSite,
  t,
  tWorkspace,
}: {
  initialName: string;
  email: string;
  /**
   * Whether the account has a password, which decides WHICH password form
   * opens (set a first one, or change it) - never whether one is offered.
   */
  hasPassword: boolean;
  /** A Google account is linked, so "you sign in with Google" is true. */
  googleLinked: boolean;
  /** The language the dashboard is currently rendered in. */
  initialLocale: Locale;
  /**
   * The website in the settings strip, whose Business tab holds its article
   * language. Named in the link: with several websites, "the Business tab"
   * alone does not say whose.
   */
  articleLanguageSite: { href: string; domain: string } | null;
  /** This screen's copy, already in the reader's language. */
  t: Messages["app"]["settings"];
  /** Shared field and form words. */
  tWorkspace: Messages["app"]["workspace"];
}) {
  const router = useRouter();

  /* ---------------------------------------------------------------- */
  /* Name                                                               */
  /* ---------------------------------------------------------------- */
  const [name, setName] = useState(initialName);
  const [savedName, setSavedName] = useState(initialName);
  const [savingName, startNameSave] = useTransition();
  const trimmedName = name.trim();
  const nameDirty = trimmedName !== savedName.trim();
  const nameInvalid = trimmedName.length === 0;
  const nameField = useRef<HTMLInputElement>(null);
  useUnsavedChanges(nameDirty, tWorkspace.leaveConfirm);

  function saveName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!nameDirty || nameInvalid) return;
    startNameSave(async () => {
      if (!(await updatedAccount({ name: trimmedName }))) {
        // The translation, not Better Auth's English message.
        toast.error(t.nameError);
        return;
      }
      setSavedName(trimmedName);
      setName(trimmedName);
      // The Save button goes away with the change; keep focus on the field.
      nameField.current?.focus();
      toast.success(t.nameSaved);
      // The sidebar and the account menu render it too.
      router.refresh();
    });
  }

  /* ---------------------------------------------------------------- */
  /* Password                                                           */
  /* ---------------------------------------------------------------- */
  const [changing, setChanging] = useState(false);
  const passwordToggle = useRef<HTMLButtonElement>(null);

  function closePasswordForm() {
    setChanging(false);
    // Back to the button that opened it, rather than lost on the page.
    window.requestAnimationFrame(() => passwordToggle.current?.focus());
  }

  /* ---------------------------------------------------------------- */
  /* Dashboard language                                                 */
  /* ---------------------------------------------------------------- */
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const [savingLocale, startLocaleSave] = useTransition();
  const [localeSaved, setLocaleSaved] = useState(false);

  /**
   * Saved on change: one choice whose result - the whole app re-rendering in
   * the new language - is its own confirmation. Reverted on failure, so the
   * control never shows a language the account is not set to.
   */
  function changeLocale(next: Locale) {
    const previous = locale;
    setLocale(next);
    setLocaleSaved(false);
    startLocaleSave(async () => {
      if (!(await updatedAccount({ locale: next }))) {
        setLocale(previous);
        toast.error(t.languageError);
        return;
      }
      setLocaleSaved(true);
      // Every server component re-reads the preference on the next render.
      router.refresh();
    });
  }

  return (
    <>
      <WorkspaceSection id="profile" icon={UserRound} title={t.personalTitle} description={t.personalSubtitle}>
        <div className="grid gap-x-4 gap-y-5 md:grid-cols-2">
          {/* A real form, so Enter saves. */}
          <form onSubmit={saveName} className="min-w-0 space-y-3">
            <Field
              id="account-name"
              label={t.nameLabel}
              error={nameDirty && nameInvalid ? t.nameRequired : null}
              t={tWorkspace}
            >
              {(props) => (
                <Input
                  {...props}
                  ref={nameField}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder={t.namePlaceholder}
                  autoComplete="name"
                  // Read-only, not disabled, while saving: focus stays put.
                  readOnly={savingName}
                />
              )}
            </Field>
            {/*
              Save appears only once the name has changed: a button always
              sitting under a single field reads as something you must press.
            */}
            {nameDirty ? (
              <div className="flex flex-wrap gap-2">
                <Button type="submit" size="sm" disabled={savingName || nameInvalid}>
                  {savingName ? (
                    <>
                      <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                      {t.saving}
                    </>
                  ) : (
                    t.saveName
                  )}
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setName(savedName)} disabled={savingName}>
                  {t.cancel}
                </Button>
              </div>
            ) : null}
          </form>

          <dl className="min-w-0 space-y-1.5">
            <dt className="text-sm font-medium text-foreground">{t.emailLabel}</dt>
            <dd className="flex min-h-8 items-center text-sm wrap-anywhere text-foreground">{email}</dd>
            <dd className="text-xs leading-5 text-muted-foreground">{t.emailHelp}</dd>
          </dl>
        </div>
      </WorkspaceSection>

      {/*
        How this person signs in. The password row is offered whether or not
        a password exists - the client asked for Google accounts to be able
        to add one - and the FORM differs: with a password it asks for the
        current one first, without one it asks only for the new one.
      */}
      <WorkspaceSection id="security" icon={KeyRound} title={t.securityTitle} description={t.securitySubtitle}>
        <div className="space-y-4">
          <ul className="divide-y rounded-lg border">
            <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0 space-y-0.5">
                <p className="text-sm font-medium text-foreground">{t.methodPassword}</p>
                <p className="text-xs leading-5 text-muted-foreground">
                  {hasPassword ? t.passwordSetSummary : t.passwordNotSetSummary}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {hasPassword ? (
                  <StatusBadge status="active" label={t.methodSet} />
                ) : (
                  <StatusBadge status="pending" label={t.methodNotSet} />
                )}
                <Button
                  ref={passwordToggle}
                  variant="outline"
                  size="sm"
                  aria-expanded={changing}
                  aria-controls={changing ? "password-form" : undefined}
                  onClick={() => (changing ? closePasswordForm() : setChanging(true))}
                >
                  {hasPassword ? t.changePassword : t.setPassword}
                </Button>
              </div>
            </li>
            {googleLinked ? (
              <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0 space-y-0.5">
                  <p className="text-sm font-medium text-foreground">{t.methodGoogle}</p>
                  <p className="text-xs leading-5 text-muted-foreground">{t.googleLinkedSummary}</p>
                </div>
                <StatusBadge status="connected" label={t.methodLinked} />
              </li>
            ) : null}
          </ul>

          {changing ? (
            <PasswordForm
              hasPassword={hasPassword}
              googleLinked={googleLinked}
              onDone={closePasswordForm}
              t={t}
              tWorkspace={tWorkspace}
            />
          ) : null}
        </div>
      </WorkspaceSection>

      {/*
        Two languages that are easy to confuse: the dashboard's (this
        person's, saved here) and the articles' (each website's, set on its
        Business tab). Side by side, each saying what it changes.
      */}
      <WorkspaceSection id="language" icon={Languages} title={t.languageTitle} description={t.languageSubtitle}>
        <div className="grid gap-x-4 gap-y-5 md:grid-cols-2">
          <Field
            id="dashboard-language"
            label={t.languageLabel}
            hint={t.languageHelp}
            labelAction={<span className="text-xs text-muted-foreground">{tWorkspace.savesImmediately}</span>}
            t={tWorkspace}
          >
            {(props) => (
              <div className="flex flex-wrap items-center gap-2">
                <select
                  {...props}
                  value={locale}
                  onChange={(event) => changeLocale(event.target.value as Locale)}
                  disabled={savingLocale}
                  className={SELECT_CLASS}
                >
                  {LANGUAGES.map((language) => (
                    <option key={language.id} value={language.id} lang={language.id}>
                      {language.label}
                    </option>
                  ))}
                </select>
                {savingLocale ? (
                  <Loader2
                    className="size-4 animate-spin text-muted-foreground motion-reduce:animate-none"
                    aria-hidden="true"
                  />
                ) : null}
              </div>
            )}
          </Field>

          <div className="min-w-0 space-y-1.5 rounded-lg border bg-muted/20 p-4">
            <p className="text-sm font-medium text-foreground">{t.articleLanguageLabel}</p>
            <p className="text-xs leading-5 text-muted-foreground">{t.articleLanguageHelp}</p>
            {articleLanguageSite ? (
              <Link
                href={articleLanguageSite.href}
                className="inline-flex max-w-full items-center gap-1 rounded-md text-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <span className="min-w-0 wrap-anywhere">
                  {format(t.articleLanguageLink, { domain: articleLanguageSite.domain })}
                </span>
                <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
              </Link>
            ) : null}
          </div>
        </div>
        {/* Confirmation for screen readers; the re-rendered page is everyone else's. */}
        <p className="sr-only" role="status" aria-live="polite">
          {localeSaved && !savingLocale ? t.languageSaved : ""}
        </p>
      </WorkspaceSection>
    </>
  );
}

/**
 * The password form, in either of its two shapes.
 *
 * WITH an existing password it asks for the current one as well: a session
 * left open on a shared machine should not be enough to lock the owner out.
 * revokeOtherSessions is ON for that path - someone changing a password
 * usually thinks somebody else has it.
 *
 * WITHOUT one - an account adding email-and-password sign-in - there is no
 * current password to ask for, and other sessions are left signed in: nothing
 * was compromised. That path goes through the setFirstPassword server action,
 * because Better Auth's setPassword is serverOnly.
 */
function PasswordForm({
  hasPassword,
  googleLinked,
  onDone,
  t,
  tWorkspace,
}: {
  hasPassword: boolean;
  googleLinked: boolean;
  onDone: () => void;
  t: Messages["app"]["settings"];
  tWorkspace: Messages["app"]["workspace"];
}) {
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [error, setError] = useState<PasswordError | null>(null);
  const [pending, startTransition] = useTransition();
  const currentField = useRef<HTMLInputElement>(null);
  const nextField = useRef<HTMLInputElement>(null);

  // Opened on request, so the first field takes focus.
  useEffect(() => {
    (currentField.current ?? nextField.current)?.focus();
  }, []);

  /** Shows an error and puts focus where it can be fixed, so it is heard with its field. */
  function fail(failure: PasswordError) {
    setError(failure);
    if (failure.target === "current") currentField.current?.focus();
    if (failure.target === "next") nextField.current?.focus();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const invalid = checkNewPassword(next, t);
    if (invalid) {
      fail(invalid);
      return;
    }
    setError(null);

    startTransition(async () => {
      if (!hasPassword) {
        let result: Awaited<ReturnType<typeof setFirstPassword>>;
        try {
          result = await setFirstPassword(next);
        } catch {
          fail({ target: "form", message: t.passwordError });
          return;
        }
        if (!result.ok) {
          const failure = setPasswordError(result.error, t);
          fail(failure);
          // Stale page: re-reading it swaps in the change-password form.
          if (failure.refresh) router.refresh();
          return;
        }
        setNext("");
        toast.success(t.passwordCreated);
        // The page decides which form to offer from whether a password exists.
        router.refresh();
        onDone();
        return;
      }

      let failure: Parameters<typeof changePasswordError>[0];
      try {
        const result = await authClient.changePassword({
          currentPassword: current,
          newPassword: next,
          revokeOtherSessions: true,
        });
        failure = result.error;
      } catch {
        // A dropped connection throws instead of returning an error: the generic sentence, not a crashed page.
        failure = {};
      }
      if (failure) {
        fail(changePasswordError(failure, t));
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
      id="password-form"
      onSubmit={handleSubmit}
      noValidate
      className="space-y-4 rounded-lg border bg-muted/20 p-4"
    >
      {/*
        Why the form is here at all when there is no password yet - an offer,
        not a chore. "You sign in with Google" only where that is true.
      */}
      {!hasPassword ? (
        <p className="text-sm text-muted-foreground">
          {googleLinked ? t.setPasswordIntro : t.setPasswordIntroGeneric}
        </p>
      ) : null}

      <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
        {/*
          Only where there is a current password to give: asking a Google-only
          account for one would be a dead end.
        */}
        {hasPassword ? (
          <Field
            id="current-password"
            label={t.currentPassword}
            error={error?.target === "current" ? error.message : null}
            required
            t={tWorkspace}
          >
            {(props) => (
              <Input
                {...props}
                ref={currentField}
                type="password"
                autoComplete="current-password"
                value={current}
                onChange={(event) => setCurrent(event.target.value)}
                readOnly={pending}
              />
            )}
          </Field>
        ) : null}

        <Field
          id="new-password"
          label={t.newPassword}
          // The change path warns that other devices get signed out; the set
          // path does not revoke anything, so it must not say it does.
          hint={hasPassword ? t.passwordHelp : t.setPasswordHelp}
          error={error?.target === "next" ? error.message : null}
          required
          t={tWorkspace}
        >
          {(props) => (
            <Input
              {...props}
              ref={nextField}
              type="password"
              autoComplete="new-password"
              value={next}
              onChange={(event) => setNext(event.target.value)}
              readOnly={pending}
            />
          )}
        </Field>
      </div>

      {error?.target === "form" ? (
        <Notice tone="danger" role="alert">
          {error.message}
        </Notice>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              {hasPassword ? t.changing : t.settingPassword}
            </>
          ) : hasPassword ? (
            t.changePassword
          ) : (
            t.setPassword
          )}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone} disabled={pending}>
          {t.cancel}
        </Button>
      </div>
    </form>
  );
}
