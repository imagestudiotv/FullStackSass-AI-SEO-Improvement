import { Download, Film, ImageIcon, Palette } from "lucide-react";

import { BRAND_KIT, brandKitFileName, type BrandKitItem } from "@/lib/earn/brand-kit";
import type { EarnBrandKitCopy } from "@/lib/i18n/earn-brand-kit";
import { format } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";

/**
 * The brand kit (client, 2026-11-26: "graphics ready to post as logo, official
 * repget video you have for promotion"): RepGet's logo files, ready-to-post
 * pictures and the promo video, each a plain download. Posting one can earn
 * credits only through the "Post about RepGet" claim the team reviews; nothing
 * here talks to the server.
 */
export function BrandKit({ postCredits, t }: { postCredits: number; t: EarnBrandKitCopy }) {
  return (
    <section id="brand-kit" aria-labelledby="brand-kit-title" className="scroll-mt-20 overflow-hidden rounded-2xl border bg-card">
      <div className="flex flex-col gap-3 border-b bg-gradient-to-r from-card via-card to-primary/5 p-5 sm:flex-row sm:items-end sm:justify-between sm:p-6">
        <div className="min-w-0">
          <p className="text-xs font-bold tracking-[0.13em] text-primary uppercase">{t.eyebrow}</p>
          <h2 id="brand-kit-title" className="mt-1.5 text-xl font-bold tracking-tight sm:text-2xl">
            {t.title}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{t.body}</p>
        </div>
        <p className="shrink-0 text-sm sm:max-w-64 sm:text-right">
          {format(t.claim, { credits: postCredits })}{" "}
          <a href="#more-ways" className="font-semibold text-primary underline-offset-4 hover:underline">
            {t.claimLink}
          </a>
        </p>
      </div>
      <ul className="grid gap-4 p-4 sm:grid-cols-2 sm:p-6 lg:grid-cols-4">
        {BRAND_KIT.map((item) => (
          <li key={item.id}>
            <KitCard item={item} t={t} />
          </li>
        ))}
      </ul>
      <p className="border-t px-5 py-3 text-xs text-muted-foreground sm:px-6">{t.rules}</p>
    </section>
  );
}

const KIND_ICON = { logo: Palette, post: ImageIcon, story: ImageIcon, video: Film } as const;

function KitCard({ item, t }: { item: BrandKitItem; t: EarnBrandKitCopy }) {
  const words = t.items[item.id];
  const Icon = KIND_ICON[item.kind];
  return (
    <figure className="flex h-full flex-col overflow-hidden rounded-xl border bg-background">
      <div className={cn("relative grid place-items-center overflow-hidden", item.dark ? "bg-neutral-900" : "bg-muted/40", "aspect-[4/5]", item.kind === "logo" && "p-6")}>
        {item.kind === "video" ? (
          <video src={item.file} poster={item.preview} controls playsInline preload="none" aria-label={t.videoLabel} className="size-full bg-black object-contain" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- a static file shown as it is downloaded
          <img src={item.preview} alt={words.title} loading="lazy" decoding="async" className={cn("max-h-full max-w-full", item.kind === "logo" ? "object-contain" : "size-full object-cover")} />
        )}
        <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-background/90 px-2 py-0.5 text-[11px] font-semibold shadow-sm">
          <Icon className="size-3" aria-hidden="true" />
          {t.kinds[item.kind]}
        </span>
      </div>
      <figcaption className="flex flex-1 flex-col gap-1 p-3">
        <strong className="text-sm leading-snug">{words.title}</strong>
        <span className="text-xs text-muted-foreground">{words.body}</span>
        <span className="mb-2 text-xs text-muted-foreground tabular-nums">{format(t.size, { width: item.width, height: item.height })}</span>
        <a
          href={item.file}
          download={brandKitFileName(item)}
          className="mt-auto inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border px-3 text-sm font-semibold transition-colors hover:border-primary hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <Download className="size-4" aria-hidden="true" />
          {t.download}
          <span className="sr-only">: {words.title}</span>
        </a>
      </figcaption>
    </figure>
  );
}
