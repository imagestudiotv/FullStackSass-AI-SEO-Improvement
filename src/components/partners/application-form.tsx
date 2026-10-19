"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitPartnerApplicationAction } from "@/lib/partners/presentation/actions";
import type { PartnerCopy } from "@/lib/partners/presentation/copy";

type Copy = PartnerCopy["portal"]["apply"];

/**
 * The application. The applicant is the signed-in user - nothing here names
 * an account - and the server re-validates everything it receives.
 */
export function ApplicationForm({ copy, countries }: { copy: Copy; countries: { code: string; name: string }[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(null);
    start(async () => {
      const result = await submitPartnerApplicationAction({
        website: String(form.get("website") ?? ""),
        audience: String(form.get("audience") ?? ""),
        promotion: String(form.get("promotion") ?? ""),
        country: String(form.get("country") ?? ""),
        terms: form.get("terms") === "on",
      }).catch(() => null);
      if (!result) setError(copy.errors.generic);
      else if (!result.ok) {
        const key = (result.detail && result.detail in copy.errors ? result.detail : result.error) as keyof Copy["errors"];
        setError(copy.errors[key] ?? copy.errors.generic);
      } else router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="max-w-xl space-y-5" noValidate>
      <Field id="website" label={copy.website} hint={copy.websiteHint}>
        <Input id="website" name="website" type="url" required maxLength={300} placeholder="https://" aria-describedby="website-hint" />
      </Field>
      <Field id="audience" label={copy.audience} hint={copy.audienceHint}>
        <Textarea id="audience" name="audience" required maxLength={1000} rows={3} aria-describedby="audience-hint" />
      </Field>
      <Field id="promotion" label={copy.promotion} hint={copy.promotionHint}>
        <Textarea id="promotion" name="promotion" required maxLength={1000} rows={3} aria-describedby="promotion-hint" />
      </Field>
      <Field id="country" label={copy.country} hint={copy.countryHint}>
        <select
          id="country"
          name="country"
          required
          defaultValue=""
          aria-describedby="country-hint"
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-base focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none md:text-sm dark:bg-input/30"
        >
          <option value="" disabled>
            -
          </option>
          {countries.map((country) => (
            <option key={country.code} value={country.code}>
              {country.name}
            </option>
          ))}
        </select>
      </Field>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="terms" required className="mt-0.5 size-4 accent-primary" />
        <span>{copy.terms}</span>
      </label>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? copy.submitting : copy.submit}
      </Button>
    </form>
  );
}

function Field({ id, label, hint, children }: { id: string; label: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      <p id={`${id}-hint`} className="text-xs text-muted-foreground">
        {hint}
      </p>
    </div>
  );
}
