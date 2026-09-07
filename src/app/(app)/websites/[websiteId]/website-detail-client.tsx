"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { BrandVoiceView } from "@/lib/brand/shared";
import { updateWebsiteDetails } from "@/lib/websites/actions";
import { BrandVoiceForm } from "./brand-voice-form";
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
const FIELDS = [
  { key: "brandName", label: "Brand name", placeholder: "Acme Ltd" },
  { key: "industry", label: "Industry", placeholder: "Dental clinic" },
  { key: "country", label: "Primary market", placeholder: "Ireland" },
  { key: "targetAudience", label: "Target audience", placeholder: "Homeowners aged 30-55" },
] as const;

export function WebsiteDetailClient({
  website,
  voice,
}: {
  website: WebsiteDetail;
  voice: BrandVoiceView;
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
      toast.success("Details saved");
      router.refresh();
    });
  }

  return (
    <>
      {/*
        Brand voice sits beside the profile rather than in its own card: the
        page already carries five panels, and both tabs answer the same
        question — what should we know about this business.
      */}
      <Card>
        <Tabs defaultValue="profile">
          {/*
            px-(--card-spacing) rather than a hardcoded px-6: the card sets its
            own padding token, so a fixed value left the tab strip inset by a
            different amount than the fields under it — the misalignment was
            visible down the left edge of both tabs.

            -mt-(--card-spacing) pulls the strip up to the card's top edge. The
            card adds its own top padding, which put a band of empty space
            above the tabs and made them look detached from the panel.
          */}
          <div className="-mt-(--card-spacing) border-b px-(--card-spacing) pt-3">
            <TabsList>
              <TabsTrigger value="profile">Business details</TabsTrigger>
              <TabsTrigger value="voice">How we write</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="profile" className="mt-0">
        {/* See the note in brand-voice-form.tsx on this gap. */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-(--card-spacing)">
          <CardHeader>
            {/*
              "Business details" rather than "Website profile": the tab above
              already says Business details, and two different names for the
              same panel reads as two different things.
            */}
            <CardTitle className="text-base">Business details</CardTitle>
            <CardDescription>
              These details shape your keywords and every article we write.
              {analysed
                ? " Correct anything we got wrong."
                : " They fill in automatically once we have analysed the site — you can also enter them now."}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {FIELDS.map((field) => (
                <div key={field.key} className="space-y-1.5">
                  <Label htmlFor={field.key}>{field.label}</Label>
                  <Input
                    id={field.key}
                    value={form[field.key]}
                    placeholder={field.placeholder}
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
                <Label htmlFor="language">Main language</Label>
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
                  Your articles are written in this language.
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description">Description</Label>
              <textarea
                id="description"
                rows={4}
                value={form.description}
                placeholder="What the business does, in a sentence or two."
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, description: e.target.value }))
                }
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
          </CardContent>

          <CardFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save details"}
            </Button>
          </CardFooter>
        </form>
          </TabsContent>

          <TabsContent value="voice" className="mt-0">
            <BrandVoiceForm websiteId={website.id} voice={voice} />
          </TabsContent>
        </Tabs>
      </Card>
    </>
  );
}
