"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { Messages } from "@/lib/i18n/messages";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateWebsiteDetails } from "@/lib/websites/actions";
import {
  isSupportedLanguage,
  SUPPORTED_LANGUAGES,
} from "@/lib/websites/languages";

type WebsiteDetail = {
  id: string;
  url: string;
  domain: string;
  brandName: string | null;
  industry: string | null;
  country: string | null;
  language: string | null;
  description: string | null;
  targetAudience: string | null;
  status: string;
};

/**
 * Every field here is editable.
 *
 * These are filled automatically once the site has been analysed, but
 * extraction is a guess: a business whose brand or industry is wrong in the
 * profile gets wrong keywords and wrong articles all the way down the
 * pipeline. Correcting it must not require support.
 */
/*
  Dictionary KEYS for the label and placeholder, not the text. A module-level
  array is built before any locale exists, so holding the English here is how
  a German form ends up labelled "Brand name".
*/
const FIELDS = [
  { key: "brandName", label: "brandName", placeholder: "brandNamePlaceholder" },
  { key: "industry", label: "industry", placeholder: "industryPlaceholder" },
  { key: "country", label: "country", placeholder: "countryPlaceholder" },
  {
    key: "targetAudience",
    label: "audience",
    placeholder: "audiencePlaceholder",
  },
] as const;

export function WebsiteDetailClient({
  website,
  t,
  tCommon,
}: {
  website: WebsiteDetail;
  /** This screen's copy, already in the reader's language. */
  t: Messages["app"]["profile"];
  /** Shared words used on several screens. */
  tCommon: Messages["app"]["common"];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    brandName: website.brandName ?? "",
    industry: website.industry ?? "",
    country: website.country ?? "",
    language: website.language ?? "",
    description: website.description ?? "",
    targetAudience: website.targetAudience ?? "",
  });

  const analysed = website.status === "ready";

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await updateWebsiteDetails(website.id, form);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(t.detailsSaved);
      router.refresh();
    });
  }

  return (
    <>
      {/*
      */}
      {/*
        NO TAB STRIP. Business details is the whole card now.

        The client asked for it directly — "To delete also how we write from
        this part" — and the horizontal settings nav above replaces what the
        two tabs were doing. A strip of two tabs sitting inside a page that
        already has a strip of five is two navigations for one job.

        "How we write" is NOT deleted. It edits real stored data — tone,
        vocabulary, things to avoid, a standing instruction applied to every
        article — and it now lives under Article Settings, which is where the
        rest of the writing configuration is. Dropping the form would have
        orphaned the brand_voice table and silently stopped anyone changing
        how their articles read.
      */}
      <Card>
        {/* See the note in brand-voice-form.tsx on this gap. */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-(--card-spacing)">
          <CardHeader>
            {/*
              "Business details" rather than "Website profile": the tab above
              already says Business details, and two different names for the
              same panel reads as two different things.
            */}
            <CardTitle className="text-base">{t.businessDetails}</CardTitle>
            <CardDescription>
              {t.detailsHelp}
              {analysed ? t.correctAnything : t.fillsIn}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {FIELDS.map((field) => (
                <div key={field.key} className="space-y-1.5">
                  <Label htmlFor={field.key}>{t[field.label]}</Label>
                  <Input
                    id={field.key}
                    value={form[field.key]}
                    placeholder={t[field.placeholder]}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        [field.key]: e.target.value,
                      }))
                    }
                  />
                </div>
              ))}

              {/*
                A picker, not free text. The stored value goes straight into
                the article prompt, so a typo like "Spansh" quietly produced an
                English article with no way for the customer to tell why.
              */}
              <div className="space-y-1.5">
                <Label htmlFor="language">{t.mainLanguage}</Label>
                <select
                  id="language"
                  value={form.language}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, language: e.target.value }))
                  }
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  {/*
                    An unrecognised stored value is kept as its own option
                    rather than silently switching the customer to English.
                  */}
                  {form.language && !isSupportedLanguage(form.language) ? (
                    <option value={form.language}>{form.language}</option>
                  ) : null}
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <option key={lang.value} value={lang.value}>
                      {lang.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  {tCommon.articleLanguageHelp}
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description">{t.description}</Label>
              <textarea
                id="description"
                rows={4}
                value={form.description}
                placeholder={t.descriptionPlaceholder}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, description: e.target.value }))
                }
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
          </CardContent>

          <CardFooter>
            <Button type="submit" disabled={pending}>
              {pending ? t.saving : t.saveDetails}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </>
  );
}
