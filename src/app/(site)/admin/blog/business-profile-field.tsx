"use client";

import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { discoverPath } from "@/lib/discover/paths";
import { discoverSlug, PROFILE_LIMITS, profileLines, type BusinessProfile } from "@/lib/discover/profile-fields";
import type { Locale } from "@/lib/i18n/config";

/**
 * The business's showcase profile, under the Business section's fields
 * (client, 2026-11-11 round 2: the RepGet Customer Showcase). A published
 * Customer stories post with a profile address is listed at /discover and
 * shown at /discover/<address>, with the name, logo, category, website and
 * tagline above, and these: the chips, where it is based and available,
 * About, Who it's for, Main services and Industry. All optional except the
 * address, which is what puts the business in the directory.
 */
export function BusinessProfileField({
  value,
  name,
  locale,
  onChange,
}: {
  value: BusinessProfile;
  /** The business name typed above: the address can be made from it. */
  name: string;
  /** The post's language: its profile's page is in that language. */
  locale: Locale;
  onChange: (profile: BusinessProfile) => void;
}) {
  const set = <K extends keyof BusinessProfile>(key: K, next: BusinessProfile[K]) => onChange({ ...value, [key]: next });
  const slug = discoverSlug(value.slug);
  const tags = profileLines(value.tags);
  const services = profileLines(value.services);

  return (
    <div className="mt-6 space-y-4 border-t pt-5">
      <div>
        <h3 className="text-sm font-semibold">Showcase profile</h3>
        <p className="text-xs text-muted-foreground">
          With an address, the published story&apos;s business is listed in the customer directory (/discover) and gets its own page there. Its upvotes and
          comments are this post&apos;s.
        </p>
      </div>

      <Field
        id="blog-business-slug"
        label="Profile address"
        hint={
          slug ? (
            <>
              Shown at {discoverPath(locale, slug)}. Unique in each language; a translation keeps it. Empty: not in the directory.
            </>
          ) : (
            "Lower-case letters, numbers and hyphens, e.g. image-studio. Empty: not in the directory."
          )
        }
      >
        <div className="flex flex-wrap gap-2">
          <Input
            id="blog-business-slug"
            className="min-w-0 flex-1"
            value={value.slug}
            maxLength={PROFILE_LIMITS.slug}
            placeholder="image-studio"
            onChange={(e) => set("slug", e.target.value)}
            onBlur={() => set("slug", discoverSlug(value.slug))}
            aria-describedby="blog-business-slug-hint"
          />
          {!value.slug.trim() && name.trim() ? (
            <Button type="button" variant="outline" onClick={() => set("slug", discoverSlug(name))}>
              Use the business name
            </Button>
          ) : null}
        </div>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id="blog-business-tags"
          label="Profile chips"
          hint={`One per line, up to ${PROFILE_LIMITS.tags} (e.g. Photography). Shown above the name. ${tags.length}/${PROFILE_LIMITS.tags}`}
        >
          <Textarea id="blog-business-tags" rows={3} value={value.tags} onChange={(e) => set("tags", e.target.value)} aria-describedby="blog-business-tags-hint" />
        </Field>
        <Field id="blog-business-industry" label="Industry" hint="Business details → Industry. Empty: the business category.">
          <Input
            id="blog-business-industry"
            value={value.industry}
            maxLength={PROFILE_LIMITS.industry}
            onChange={(e) => set("industry", e.target.value)}
            aria-describedby="blog-business-industry-hint"
          />
        </Field>
        <Field id="blog-business-location" label="Based in" hint="e.g. Rome and Milan, Italy. Shown under the tagline and in Business details.">
          <Input
            id="blog-business-location"
            value={value.location}
            maxLength={PROFILE_LIMITS.location}
            onChange={(e) => set("location", e.target.value)}
            aria-describedby="blog-business-location-hint"
          />
        </Field>
        <Field id="blog-business-availability" label="Available in" hint="e.g. Italy / Worldwide.">
          <Input
            id="blog-business-availability"
            value={value.availability}
            maxLength={PROFILE_LIMITS.availability}
            onChange={(e) => set("availability", e.target.value)}
            aria-describedby="blog-business-availability-hint"
          />
        </Field>
      </div>

      <Field
        id="blog-business-about"
        label="About"
        hint={`Plain text; a blank line starts a new paragraph. Empty: the post's description. ${value.about.length}/${PROFILE_LIMITS.about}`}
      >
        <Textarea
          id="blog-business-about"
          rows={5}
          value={value.about}
          maxLength={PROFILE_LIMITS.about}
          onChange={(e) => set("about", e.target.value)}
          aria-describedby="blog-business-about-hint"
        />
      </Field>
      <Field id="blog-business-audience" label="Who it's for" hint={`Plain text. Empty: the section is not shown. ${value.audience.length}/${PROFILE_LIMITS.audience}`}>
        <Textarea
          id="blog-business-audience"
          rows={3}
          value={value.audience}
          maxLength={PROFILE_LIMITS.audience}
          onChange={(e) => set("audience", e.target.value)}
          aria-describedby="blog-business-audience-hint"
        />
      </Field>
      <Field
        id="blog-business-services"
        label="Main services"
        hint={`One per line, up to ${PROFILE_LIMITS.services}. Empty: the section is not shown. ${services.length}/${PROFILE_LIMITS.services}`}
      >
        <Textarea
          id="blog-business-services"
          rows={4}
          value={value.services}
          onChange={(e) => set("services", e.target.value)}
          aria-describedby="blog-business-services-hint"
        />
      </Field>
    </div>
  );
}

function Field({ id, label, hint, children }: { id: string; label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
