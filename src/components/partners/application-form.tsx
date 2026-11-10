"use client";

import { ArrowRight, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type ReactNode } from "react";

import { submitPartnerApplicationAction } from "@/lib/partners/presentation/actions";
import { fill, type PartnerCopy } from "@/lib/partners/presentation/copy";
import { cn } from "@/lib/utils";

type Copy = PartnerCopy["portal"]["apply"];
type FieldName = "website" | "audience" | "promotion" | "country" | "terms";
/** The answers' lengths (domain/entities/application.ts APPLICATION_LIMITS), passed by the server page: the partner domain stays out of client code (architecture.test). */
export type ApplicationLimits = { website: number; textMin: number; audience: number; promotion: number };

/** The same address test the server makes (use-cases/submit-application.ts validateAnswers). */
const WEBSITE = /^https?:\/\/[^\s]+\.[^\s]+$/i;
const FIELDS: FieldName[] = ["website", "audience", "promotion", "country", "terms"];

const CONTROL =
  "w-full rounded-[10px] border border-input bg-background text-foreground outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/80 focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/15 aria-invalid:border-destructive dark:bg-input/30";

/**
 * The application (Daniel's centred form, 2026-11-07): the card with its
 * review chip, the fields with hints, counters and their own errors, the
 * payout country, the terms, a full-width submit and the privacy line.
 *
 * The applicant is the signed-in user - nothing here names an account - and
 * the real server action receives the answers and checks everything again;
 * a sent application appears in Admin -> Partners -> Applications, and the
 * page then shows that it is being reviewed. The checks here are the
 * server's own, from the same limits, so a message comes before the round
 * trip and the first field to fix gets the focus. The countries are the ones
 * payouts can be made to (the server's list), not every country there is.
 */
export function ApplicationForm({
  copy,
  countries,
  termsHref = "/partners",
  limits,
}: {
  copy: Copy;
  countries: { code: string; name: string }[];
  /** The program page, whose questions hold the terms, in the applicant's language. */
  termsHref?: string;
  /** The server's limits, the one definition the use case checks too. */
  limits: ApplicationLimits;
}) {
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [lengths, setLengths] = useState({ audience: 0, promotion: 0 });
  const [pending, start] = useTransition();
  const min = limits.textMin;

  function message(field: FieldName): string {
    return fill(copy.errors[field], { min });
  }

  /** What is wrong with each answer, by the server's rules. */
  function check(data: FormData): Partial<Record<FieldName, string>> {
    const found: Partial<Record<FieldName, string>> = {};
    const text = (name: string) => String(data.get(name) ?? "").trim();
    const website = text("website");
    if (!WEBSITE.test(website) || website.length > limits.website) found.website = message("website");
    for (const name of ["audience", "promotion"] as const) {
      const length = text(name).length;
      if (length < min || length > limits[name]) found[name] = message(name);
    }
    if (!countries.some((country) => country.code === text("country"))) found.country = message("country");
    if (data.get("terms") !== "on") found.terms = message("terms");
    return found;
  }

  function focusFirst(found: Partial<Record<FieldName, string>>) {
    const first = FIELDS.find((name) => found[name]);
    if (first) form.current?.querySelector<HTMLElement>(`#${first}`)?.focus();
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setFailure(null);
    const found = check(data);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      focusFirst(found);
      return;
    }
    start(async () => {
      const result = await submitPartnerApplicationAction({
        website: String(data.get("website") ?? ""),
        audience: String(data.get("audience") ?? ""),
        promotion: String(data.get("promotion") ?? ""),
        country: String(data.get("country") ?? ""),
        terms: data.get("terms") === "on",
      }).catch(() => null);
      if (!result) {
        setFailure(copy.errors.generic);
        return;
      }
      if (!result.ok) {
        // A field the server refused is shown at that field; anything else above the button.
        const field = FIELDS.find((name) => name === result.detail);
        if (field) {
          const next = { [field]: message(field) };
          setErrors(next);
          focusFirst(next);
        } else {
          const key = (result.detail && result.detail in copy.errors ? result.detail : result.error) as keyof Copy["errors"];
          setFailure(copy.errors[key] ?? copy.errors.generic);
        }
        return;
      }
      // Sent: the page now shows the application under review.
      router.refresh();
    });
  }

  /** Typing in a field that was marked wrong clears its message once it is right. */
  function revise(field: FieldName) {
    if (!errors[field] || !form.current) return;
    const still = check(new FormData(form.current))[field];
    if (!still) setErrors((current) => ({ ...current, [field]: undefined }));
  }

  const describedBy = (field: FieldName) => (errors[field] ? `${field}-hint ${field}-error` : `${field}-hint`);
  const [termsBefore, termsAfter = ""] = copy.terms.split("{link}");

  return (
    <section aria-labelledby="partner-form-title" className="rounded-[20px] border bg-card p-6 shadow-[0_22px_65px_rgba(29,28,25,0.042),0_3px_12px_rgba(29,28,25,0.019)] sm:px-10 sm:pt-9 sm:pb-9">
      <div className="mb-6 flex items-start justify-between gap-4 sm:mb-7">
        <div>
          <h2 id="partner-form-title" className="text-xl font-extrabold tracking-[-0.65px]">
            {copy.cardTitle}
          </h2>
          <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">{copy.cardIntro}</p>
        </div>
        {/* On a phone only the dot shows, as designed; the words stay for screen readers. */}
        <p className="inline-flex shrink-0 items-center gap-1.5 rounded-full border p-[7px] text-[11px] font-bold whitespace-nowrap text-muted-foreground sm:px-2.5 sm:py-1.5" title={copy.chip}>
          <span className="size-[7px] rounded-full bg-primary sm:size-1.5" aria-hidden="true" />
          <span className="max-sm:sr-only">{copy.chip}</span>
        </p>
      </div>

      <form ref={form} onSubmit={submit} noValidate>
        <Field id="website" label={copy.website} required={copy.required} hint={copy.websiteHint} error={errors.website}>
          <input
            id="website"
            name="website"
            type="url"
            inputMode="url"
            autoComplete="url"
            required
            maxLength={limits.website}
            placeholder={copy.websitePlaceholder}
            aria-describedby={describedBy("website")}
            aria-invalid={errors.website ? true : undefined}
            onChange={() => revise("website")}
            className={cn(CONTROL, "h-12 px-3.5 text-[13.5px]")}
          />
        </Field>

        {(["audience", "promotion"] as const).map((name) => (
          <Field
            key={name}
            id={name}
            label={copy[name]}
            required={copy.required}
            hint={copy[`${name}Hint`]}
            error={errors[name]}
            counter={fill(copy.counter, { count: lengths[name], max: limits[name] })}
          >
            <textarea
              id={name}
              name={name}
              required
              minLength={min}
              maxLength={limits[name]}
              rows={4}
              placeholder={copy[`${name}Placeholder`]}
              aria-describedby={describedBy(name)}
              aria-invalid={errors[name] ? true : undefined}
              onChange={(event) => {
                const length = event.target.value.length;
                setLengths((current) => ({ ...current, [name]: length }));
                revise(name);
              }}
              className={cn(CONTROL, "block min-h-[98px] resize-y p-3.5 text-[13.5px] leading-normal")}
            />
          </Field>
        ))}

        <Field id="country" label={copy.country} required={copy.required} hint={copy.countryHint} error={errors.country}>
          <div className="relative after:pointer-events-none after:absolute after:top-[18px] after:right-[18px] after:size-[9px] after:rotate-45 after:border-r-[1.8px] after:border-b-[1.8px] after:border-muted-foreground">
            <select
              id="country"
              name="country"
              required
              defaultValue=""
              aria-describedby={describedBy("country")}
              aria-invalid={errors.country ? true : undefined}
              onChange={() => revise("country")}
              className={cn(CONTROL, "h-12 cursor-pointer appearance-none pr-11 pl-3.5 text-[13.5px] invalid:text-muted-foreground")}
            >
              <option value="" disabled>
                {copy.countryPlaceholder}
              </option>
              {countries.map((country) => (
                <option key={country.code} value={country.code}>
                  {country.name}
                </option>
              ))}
            </select>
          </div>
        </Field>

        <div className="mt-px mb-5">
          <div className="flex items-start gap-3">
            <input
              id="terms"
              name="terms"
              type="checkbox"
              required
              aria-describedby={errors.terms ? "terms-error" : undefined}
              aria-invalid={errors.terms ? true : undefined}
              onChange={() => revise("terms")}
              className="mt-[3px] size-4 shrink-0 cursor-pointer accent-primary"
            />
            <label htmlFor="terms" className="text-xs leading-relaxed text-muted-foreground">
              {termsBefore}
              <a
                href={termsHref}
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-foreground underline decoration-border underline-offset-[3px] hover:text-primary hover:decoration-primary"
              >
                {copy.termsLink}
              </a>
              {termsAfter}
            </label>
          </div>
          {errors.terms ? <FieldError id="terms">{errors.terms}</FieldError> : null}
        </div>

        {failure ? (
          <p className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive" role="alert">
            {failure}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="flex min-h-[50px] w-full items-center justify-center gap-2.5 rounded-[11px] border border-primary bg-primary text-[13.5px] font-extrabold text-primary-foreground transition-[transform,background,box-shadow] hover:-translate-y-px hover:shadow-[0_7px_19px_color-mix(in_srgb,var(--primary)_20%,transparent)] focus-visible:ring-3 focus-visible:ring-primary/40 focus-visible:outline-none disabled:cursor-wait disabled:opacity-75 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
        >
          {pending ? copy.submitting : copy.submit}
          <ArrowRight className="size-[17px]" aria-hidden="true" />
        </button>
        <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground">
          <Lock className="size-[13px] shrink-0" aria-hidden="true" />
          {copy.privacy}
        </p>
      </form>
    </section>
  );
}

function Field({
  id,
  label,
  required,
  hint,
  error,
  counter,
  children,
}: {
  id: FieldName;
  label: string;
  /** "required", for screen readers: the star is only seen. */
  required: string;
  hint: string;
  error?: string;
  counter?: string;
  children: ReactNode;
}) {
  return (
    <div className="mb-[23px]">
      <label htmlFor={id} className="mb-2 block text-[13px] font-bold">
        {label}
        <span className="ml-0.5 text-primary" aria-hidden="true">
          *
        </span>
        <span className="sr-only"> ({required})</span>
      </label>
      {children}
      <div className="flex items-start justify-between gap-3.5">
        <p id={`${id}-hint`} className="mx-px mt-[7px] text-[11.3px] leading-relaxed text-muted-foreground">
          {hint}
        </p>
        {counter ? (
          <span className="mt-[7px] shrink-0 text-[10.5px] text-muted-foreground tabular-nums" aria-hidden="true">
            {counter}
          </span>
        ) : null}
      </div>
      {error ? <FieldError id={id}>{error}</FieldError> : null}
    </div>
  );
}

function FieldError({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={`${id}-error`} className="mt-[7px] text-[11px] text-destructive" role="alert">
      {children}
    </p>
  );
}
