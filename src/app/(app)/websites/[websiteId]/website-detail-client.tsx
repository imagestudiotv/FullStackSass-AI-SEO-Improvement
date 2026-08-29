"use client";

import { ArrowLeft, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
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
  { key: "language", label: "Main language", placeholder: "English" },
  { key: "targetAudience", label: "Target audience", placeholder: "Homeowners aged 30-55" },
] as const;

export function WebsiteDetailClient({ website }: { website: WebsiteDetail }) {
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
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
          <Link href="/websites">
            <ArrowLeft className="size-4" />
            All websites
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            {website.brandName || website.domain}
          </h1>
          {!analysed ? <Badge variant="secondary">Not analysed yet</Badge> : null}
        </div>
        <a
          href={website.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
        >
          {website.url}
          <ExternalLink className="size-3" />
        </a>
      </div>

      <Card>
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle className="text-base">Website profile</CardTitle>
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
      </Card>
    </div>
  );
}
