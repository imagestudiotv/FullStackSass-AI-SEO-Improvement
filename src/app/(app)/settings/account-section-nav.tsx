"use client";

import { Gift, KeyRound, Languages, UserRound, Users, type LucideIcon } from "lucide-react";

import { SectionNav } from "@/components/workspace/section-nav";

/**
 * The Account page's section links.
 *
 * A client wrapper only because the icons are components, which cannot be
 * handed from the server page to a client component; the page passes ids and
 * translated labels, and this adds the icons.
 */
const ICONS = {
  profile: UserRound,
  security: KeyRound,
  language: Languages,
  members: Users,
  referral: Gift,
} satisfies Record<string, LucideIcon>;

export type AccountSectionId = keyof typeof ICONS;

export function AccountSectionNav({
  sections,
  label,
  variant,
  className,
}: {
  sections: { id: AccountSectionId; label: string }[];
  label: string;
  variant: "rail" | "bar";
  className?: string;
}) {
  return (
    <SectionNav
      items={sections.map((section) => ({ ...section, icon: ICONS[section.id] }))}
      label={label}
      variant={variant}
      className={className}
    />
  );
}
