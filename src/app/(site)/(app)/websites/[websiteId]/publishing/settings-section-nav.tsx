"use client";

import { CalendarClock, ImageIcon, Link2, MessageSquareQuote, PenLine, Sparkles, UserRound } from "lucide-react";

import { SectionNav } from "@/components/workspace/section-nav";
import type { Messages } from "@/lib/i18n/messages";

import { SECTION_IDS } from "./settings-model";

/**
 * The Article Settings sections, A to G, for SectionNav. A client file only
 * because the icons are components, which a server page cannot hand to a
 * client component as props.
 */
export function ArticleSettingsSectionNav({
  variant,
  className,
  t,
  tCommon,
  tWorkspace,
}: {
  variant: "rail" | "bar";
  className?: string;
  t: Messages["app"]["article"];
  tCommon: Messages["app"]["common"];
  tWorkspace: Messages["app"]["workspace"];
}) {
  const items = [
    { id: SECTION_IDS.writing, label: t.sectionWriting, icon: PenLine },
    { id: SECTION_IDS.sources, label: t.sectionSources, icon: Link2 },
    { id: SECTION_IDS.images, label: t.sectionImages, icon: ImageIcon },
    { id: SECTION_IDS.enhancements, label: t.sectionEnhancements, icon: Sparkles },
    { id: SECTION_IDS.voice, label: t.sectionVoice, icon: MessageSquareQuote },
    { id: SECTION_IDS.author, label: t.sectionAuthor, icon: UserRound },
    { id: SECTION_IDS.publishing, label: tCommon.writingAndPublishing, icon: CalendarClock },
  ];
  return (
    <SectionNav
      items={items}
      variant={variant}
      label={variant === "rail" ? tWorkspace.onThisPage : tWorkspace.jumpTo}
      className={className}
    />
  );
}
