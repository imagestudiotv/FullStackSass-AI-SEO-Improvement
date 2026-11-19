"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition, type FormEvent, type KeyboardEvent, type ReactNode } from "react";

import { suggestSite } from "@/app/(marketing)/growth-plan/actions";
import { SiteIcon } from "@/app/(marketing)/growth-plan/site-icon";
import { CALLBACK_URL } from "@/lib/auth/next";
import type { FinalCtaCopy } from "@/lib/i18n/home/final-cta";
import type { HeroCopy } from "@/lib/i18n/home/hero";
import { brandQuery, brandSearchClientId, searchBrands, type BrandMatch } from "@/lib/websites/brand-search";
import type { SiteCard } from "@/lib/websites/site-card";
import { JoinWithGoogle } from "./join-with-google";
import styles from "./sections/hero.module.css";
import { cleanEmail, cleanWebsite, signUpWithEmail, signUpWithWebsite, websiteStep } from "./start-field";

/** Every word the field and the row under it show, handed down by the hero (a server component). */
export type HeroFormStrings = Pick<
  HeroCopy["hero"],
  | "websiteLabel"
  | "emailLabel"
  | "websitePlaceholder"
  | "emailPlaceholder"
  | "startTrial"
  | "useEmail"
  | "useWebsite"
  | "invalidWebsite"
  | "invalidEmail"
  | "moreWays"
  | "noWebsite"
  | "buildOne"
> &
  Pick<FinalCtaCopy["form"], "emptyWebsite" | "emptyEmail">;

type Mode = "website" | "email";

/** The design's timings (`rgx-balanced-interactions`): first start, after a switch, after the field is emptied. */
const START_DELAY = 450;
const SWITCH_DELAY = 170;
const CLEARED_DELAY = 580;
/** Typing pauses this long before the typed site is looked up. */
const SUGGEST_DELAY = 450;
/** ...and this long before companies of that name are (Brandfetch asks for 250-300 ms). */
const BRAND_DELAY = 280;
/** Rows under the field, at most. */
const MAX_ROWS = 5;

/** One row under the field: the typed site read by our server, or a company Brandfetch found. */
type SuggestRow = {
  /** What choosing it starts the plan for. */
  target: string;
  domain: string;
  name: string;
  description: string | null;
  icon: Pick<SiteCard, "name" | "faviconUrl" | "faviconTone">;
  brand: boolean;
};

/** The typed site first, when it was read; then the companies of its name, each domain once. */
export function suggestRows(typed: { target: string; card: SiteCard } | null, brands: BrandMatch[]): SuggestRow[] {
  const rows: SuggestRow[] = [];
  if (typed) {
    const { card } = typed;
    rows.push({ target: typed.target, domain: card.domain, name: card.name, description: card.description, icon: card, brand: false });
  }
  for (const brand of brands) {
    if (rows.length >= MAX_ROWS) break;
    if (rows.some((row) => row.domain.replace(/^www\./, "") === brand.domain.replace(/^www\./, ""))) continue;
    rows.push({
      target: brand.domain,
      domain: brand.domain,
      name: brand.name,
      description: null,
      icon: { name: brand.name, faviconUrl: brand.icon, faviconTone: null },
      brand: true,
    });
  }
  return rows;
}

/**
 * The hero's field (client's design, 2026-11-03): a website by default, an
 * email on request ("Use your email instead"), and under it the way to ask
 * for a website when there is none.
 *
 * It only navigates. A website goes to the growth plan (/growth-plan?domain=,
 * client 2026-11-18 after explee.com), which researches it and then sends the
 * visitor through sign-up to the website step with the address pre-filled;
 * an email goes to sign-up with the address pre-filled (`?email=`, read by
 * the sign-up page). Nothing is created from here.
 *
 * While a website is typed, the site itself is suggested under the field -
 * its icon, name, a line about it and its address, read from its homepage
 * (growth-plan/actions.ts suggestSite, guarded like the free tools) - as on
 * explee.com. Pressing it, or Enter, starts the plan. No suggestion (a slow
 * or unreadable site, a limit reached) changes nothing. As on explee.com too
 * (Daniel, 2026-11-19), companies of the typed name are listed under it from
 * the first letters - "imagestu" offers imagestudio.com and imagestudio.com.br
 * with their logos - asked by the browser from Brandfetch
 * (lib/websites/brand-search.ts) while its client ID is set; the arrows move
 * through the rows, and Enter on a name that is not an address takes the
 * first company. "Join with Google" lives here
 * too because it carries whatever has been typed so far: a valid website to
 * the website step, a valid email as the account Google offers first.
 *
 * The benefits and "See how it works" sit between and beside those controls in
 * the design, so the hero hands them in rather than wrapping them in here.
 *
 * The placeholder types itself out, as drawn. It is only ever the
 * placeholder - never the field's value, so nothing a visitor did not type
 * can be submitted - and it stops while the field holds text, while the tab
 * is hidden, and entirely under reduced motion (the whole example shows).
 */
export function HeroForm({
  strings,
  signUpPath,
  onboardingPath,
  planPath,
  buildPath,
  googleLabel,
  googleIcon,
  benefits,
  watch,
}: {
  strings: HeroFormStrings;
  /** Locale-aware /sign-up. */
  signUpPath: string;
  /** Locale-aware /onboarding/website, where a typed website is carried to. */
  onboardingPath: string;
  /** Locale-aware /growth-plan, where a submitted website goes first. */
  planPath: string;
  /** Locale-aware page to ask for a website to be built (the contact page). */
  buildPath: string;
  googleLabel: string;
  googleIcon: ReactNode;
  /** The row of benefits under the field. */
  benefits: ReactNode;
  /** The link beside "Join with Google". */
  watch: ReactNode;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("website");
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [typed, setTyped] = useState<{ mode: Mode; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const nextDelay = useRef(START_DELAY);
  const inputId = useId();
  const errorId = useId();
  const listId = useId();
  const optionId = useId();
  /** The last suggestion that came back, and the address it was for. */
  const [found, setFound] = useState<{ address: string; card: SiteCard | null } | null>(null);
  /** The last companies Brandfetch named, and the name they were for. */
  const [brands, setBrands] = useState<{ query: string; matches: BrandMatch[] } | null>(null);
  const [suggestOpen, setSuggestOpen] = useState(true);
  /** The row the arrows are on, or -1. */
  const [highlighted, setHighlighted] = useState(-1);
  const asked = useRef(0);

  const isWebsite = mode === "website";
  const example = isWebsite ? strings.websitePlaceholder : strings.emailPlaceholder;
  const hasValue = value !== "";

  useEffect(() => {
    if (hasValue || !example) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // Type, hold, erase, a breath, again - the design's rhythm.
    let timer: ReturnType<typeof setTimeout>;
    let letters = 0;
    let erasing = false;
    const step = () => {
      if (document.hidden) {
        timer = setTimeout(step, 600);
        return;
      }
      setTyped({ mode, text: example.slice(0, letters) });
      if (!erasing && letters < example.length) {
        letters++;
        timer = setTimeout(step, 86);
      } else if (!erasing) {
        erasing = true;
        timer = setTimeout(step, 2200);
      } else if (letters > 0) {
        letters--;
        timer = setTimeout(step, 47);
      } else {
        erasing = false;
        timer = setTimeout(step, 560);
      }
    };
    const delay = nextDelay.current;
    // The design empties the placeholder first, then starts typing.
    timer = setTimeout(() => {
      setTyped({ mode, text: "" });
      timer = setTimeout(step, delay);
    }, 0);
    return () => clearTimeout(timer);
  }, [example, mode, hasValue]);

  // The typed site, looked up once typing pauses; an answer for an older value is dropped.
  const lookup = mode === "website" ? cleanWebsite(value) : null;
  useEffect(() => {
    const ticket = ++asked.current;
    if (!lookup) return;
    const timer = setTimeout(() => {
      suggestSite(lookup)
        .then((card) => {
          if (ticket === asked.current) setFound({ address: lookup, card });
        })
        .catch(() => {});
    }, SUGGEST_DELAY);
    return () => clearTimeout(timer);
  }, [lookup]);
  // Companies of the typed name, from the browser (Brandfetch's terms); the previous question is cancelled.
  const clientId = brandSearchClientId();
  const query = mode === "website" && clientId ? brandQuery(value) : null;
  useEffect(() => {
    if (!query || !clientId) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      searchBrands(query, clientId, controller.signal).then((matches) => {
        if (!controller.signal.aborted) setBrands({ query, matches });
      });
    }, BRAND_DELAY);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, clientId]);
  // Only ever the suggestions for what is in the field now.
  const suggestion = found && found.address === lookup ? found.card : null;
  const rows = suggestRows(
    suggestion && lookup ? { target: lookup, card: suggestion } : null,
    brands && brands.query === query ? brands.matches : [],
  );
  const showSuggestion = isWebsite && suggestOpen && rows.length > 0;
  const active = showSuggestion && highlighted >= 0 && highlighted < rows.length ? highlighted : -1;

  // The full example until the typing starts: what the server renders, and
  // what reduced motion keeps.
  const placeholder = typed && typed.mode === mode ? typed.text : example;

  function switchMode() {
    nextDelay.current = SWITCH_DELAY;
    setMode((current) => (current === "website" ? "email" : "website"));
    setValue("");
    setError(null);
    setTyped(null);
    // Straight back into the field: the switch was a request to type something else.
    input.current?.focus();
  }

  function startPlan(domain: string) {
    setSuggestOpen(false);
    startTransition(() => router.push(`${planPath}?domain=${encodeURIComponent(domain)}`));
  }

  function onFieldKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!showSuggestion) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setHighlighted(active < 0 ? (step > 0 ? 0 : rows.length - 1) : (active + step + rows.length) % rows.length);
    } else if (event.key === "Enter" && active >= 0) {
      event.preventDefault();
      setError(null);
      startPlan(rows[active].target);
    } else if (event.key === "Escape") {
      setSuggestOpen(false);
      setHighlighted(-1);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!value.trim()) {
      setError(isWebsite ? strings.emptyWebsite : strings.emptyEmail);
      input.current?.focus();
      return;
    }
    if (isWebsite) {
      const domain = cleanWebsite(value);
      // A name, not an address ("imagestudio"): the first company of that name, as on explee.com.
      const firstBrand = rows.find((row) => row.brand);
      if (!domain && firstBrand) {
        setError(null);
        startPlan(firstBrand.target);
        return;
      }
      if (!domain) {
        setError(strings.invalidWebsite);
        input.current?.focus();
        return;
      }
      setError(null);
      startPlan(domain);
      return;
    }
    const email = cleanEmail(value);
    if (!email) {
      setError(strings.invalidEmail);
      input.current?.focus();
      return;
    }
    setError(null);
    startTransition(() => router.push(signUpWithEmail(signUpPath, email)));
  }

  // What "Join with Google" carries. Anything not yet valid is left behind: it never blocks Google.
  const typedDomain = isWebsite ? cleanWebsite(value) : null;
  const typedEmail = isWebsite ? null : cleanEmail(value);
  const googleSignUp = typedDomain
    ? signUpWithWebsite(signUpPath, onboardingPath, typedDomain)
    : typedEmail
      ? signUpWithEmail(signUpPath, typedEmail)
      : signUpPath;

  return (
    <>
      <div className={styles["rgx-start-spotlight"]}>
        <div className={styles["rgx-form-highlight"]}>
          {/* noValidate: our own message, in the page's language, rather than the browser's. */}
          <form className={styles["rgx-form"]} onSubmit={handleSubmit} noValidate>
            <span className={styles["rgx-input-icon"]} aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                <circle cx="12" cy="12" r="9" />
                <path d="M3 12h18M12 3c2.5 2.5 4 5.5 4 9s-1.5 6.5-4 9c-2.5-2.5-4-5.5-4-9s1.5-6.5 4-9Z" />
              </svg>
            </span>
            <label htmlFor={inputId} className={styles["rgx-sr-only"]}>
              {isWebsite ? strings.websiteLabel : strings.emailLabel}
            </label>
            <input
              ref={input}
              id={inputId}
              name={isWebsite ? "website" : "email"}
              type={isWebsite ? "text" : "email"}
              inputMode={isWebsite ? "url" : "email"}
              // Off for the website: the browser's own list of past entries would cover ours.
              autoComplete={isWebsite ? "off" : "email"}
              autoCapitalize="none"
              spellCheck={false}
              required
              placeholder={placeholder}
              value={value}
              onChange={(event) => {
                const next = event.target.value;
                // Emptied by hand: the design waits a little longer before typing again.
                if (next === "") nextDelay.current = CLEARED_DELAY;
                setValue(next);
                setSuggestOpen(true);
                setHighlighted(-1);
                if (error) setError(null);
              }}
              onKeyDown={onFieldKeyDown}
              onBlur={() => setSuggestOpen(false)}
              onFocus={() => setSuggestOpen(true)}
              role={isWebsite ? "combobox" : undefined}
              aria-autocomplete={isWebsite ? "list" : undefined}
              aria-expanded={isWebsite ? showSuggestion : undefined}
              aria-controls={isWebsite ? listId : undefined}
              aria-activedescendant={active >= 0 ? `${optionId}-${active}` : undefined}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
            />
            <button type="submit" className={styles["rgx-primary"]} disabled={pending}>
              <span>{strings.startTrial}</span>
              <span className={styles["rgx-primary-arr"]} aria-hidden="true">
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M5 10h10m-4-4 4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </button>
          </form>
          {isWebsite ? (
            <div id={listId} role="listbox" aria-label={strings.websiteLabel} className={styles["rgx-suggest"]} hidden={!showSuggestion}>
              {showSuggestion
                ? rows.map((row, index) => (
                    <div
                      key={row.domain}
                      id={`${optionId}-${index}`}
                      role="option"
                      aria-selected={index === active}
                      tabIndex={-1}
                      className={styles["rgx-suggest-row"]}
                      // Keeps the field focused, so the press is not lost to its blur.
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => startPlan(row.target)}
                    >
                      <SiteIcon
                        site={row.icon}
                        host={row.domain}
                        size={26}
                        className={styles["rgx-suggest-icon"]}
                        letterClassName={styles["rgx-suggest-letter"]}
                        sendReferrer={row.brand}
                      />
                      <span className={styles["rgx-suggest-text"]}>
                        <span className={styles["rgx-suggest-name"]}>{row.name}</span>
                        {row.description ? <span className={styles["rgx-suggest-about"]}>{row.description}</span> : null}
                      </span>
                      <span className={styles["rgx-suggest-domain"]}>{row.domain}</span>
                    </div>
                  ))
                : null}
            </div>
          ) : null}
        </div>
      </div>
      {/* Always in the page, so a screen reader hears the message when it appears. */}
      <div aria-live="polite">
        {error ? (
          <p id={errorId} className={styles["rgx-form-error"]}>
            {error}
          </p>
        ) : null}
      </div>
      <div className={styles["rgx-no-website-options"]} role="group" aria-label={strings.moreWays}>
        <button type="button" className={styles["rgx-mode-switch"]} onClick={switchMode}>
          {isWebsite ? strings.useEmail : strings.useWebsite} <b aria-hidden="true">↗</b>
        </button>
        <div className={styles["rgx-build-prompt"]}>
          <span>{strings.noWebsite}</span>
          <Link prefetch={false} className={styles["rgx-website-creation-link"]} href={buildPath}>
            {strings.buildOne} <b aria-hidden="true">↗</b>
          </Link>
        </div>
      </div>
      {benefits}
      <div className={styles["rgx-hero-actions"]}>
        <JoinWithGoogle
          className={styles["rgx-google"]}
          signUpHref={googleSignUp}
          next={typedDomain ? websiteStep(onboardingPath, typedDomain) : CALLBACK_URL}
          loginHint={typedEmail ?? undefined}
        >
          {googleIcon}
          <span>{googleLabel}</span>
        </JoinWithGoogle>
        {watch}
      </div>
    </>
  );
}
