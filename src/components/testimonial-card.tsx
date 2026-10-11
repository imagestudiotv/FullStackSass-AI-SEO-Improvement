import { BadgeCheck } from "lucide-react";
import Image from "next/image";

import type { Testimonial } from "@/lib/marketing/testimonials";

/**
 * One testimonial card in the client's design (2026-10-11): a 64px round
 * picture, the name and role beside it, the quote below. The homepage's
 * section (app/(marketing)/testimonials-section.tsx) and the editor's live
 * preview (Admin -> Testimonials) both draw this, so what an administrator
 * sees while writing is what visitors get.
 *
 * Pictures are stored ready-sized (128 x 128, a few KB) and served as they
 * are: `unoptimized` keeps them off the image resizer, which hung in
 * development on a 64px version of one of them.
 */
export function TestimonialCard({
  item,
  verifiedLabel,
  as: Tag = "li",
}: {
  item: Testimonial;
  verifiedLabel: string;
  /** "li" inside the section's list; "div" on its own (the editor preview). */
  as?: "li" | "div";
}) {
  return (
    <Tag className="min-w-0">
      <figure className="flex h-full flex-col rounded-[9px] border border-[#dfe2e7] bg-card p-5 transition-colors hover:border-[#c4cad2] dark:border-border dark:hover:border-foreground/25">
        <figcaption className="flex items-center gap-4">
          {item.avatar ? (
            <Image
              src={item.avatar}
              alt=""
              width={64}
              height={64}
              unoptimized
              className="size-16 shrink-0 rounded-full bg-muted object-cover"
            />
          ) : (
            // Initials, not a stock face standing in for a real person.
            <span
              aria-hidden="true"
              className="flex size-16 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary-strong"
            >
              {initials(item.name)}
            </span>
          )}
          <span className="min-w-0">
            <span className="block font-semibold tracking-tight wrap-anywhere">{item.name}</span>
            <span className="block text-sm text-muted-foreground wrap-anywhere">{item.role}</span>
            {item.verified ? (
              <span className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-success">
                <BadgeCheck className="size-3.5" aria-hidden="true" />
                {verifiedLabel}
              </span>
            ) : null}
          </span>
        </figcaption>
        <blockquote className="mt-4 flex-1 text-sm leading-relaxed text-pretty text-foreground/75 wrap-anywhere">
          <p>{item.quote}</p>
        </blockquote>
      </figure>
    </Tag>
  );
}

/** "Ada Lovelace" -> "AL"; one name -> its first letter. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts.at(-1)![0] : "")).toUpperCase();
}
