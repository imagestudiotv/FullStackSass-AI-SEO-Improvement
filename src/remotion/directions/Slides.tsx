import { AbsoluteFill } from "remotion";

import type { ProductionReelProps } from "../props";
import { DomainPill, LogoTile, cleanDomain } from "../components/ui";
import { BrandShapes } from "../components/Media";
import { FONT } from "../fonts";
import { productionOf, productionParts, type ProductionPart } from "../production";
import { emphasis, fitFontSize, splitWords } from "../text";
import { palette, type Palette } from "../theme";
import { ConceptFrame, SceneVisual, mediaFor } from "./common";

/**
 * Carousel slides (1080x1350) for the new productions: a meme slide (white
 * top caption over the picture, the reaction sticker), a bold typography
 * slide for Text + Music, and photo slides for footage, storytelling and
 * voiceover. The original animated carousel (Slide.tsx) is unchanged.
 */

export type ProductionSlideProps = ProductionReelProps & { index: number };

/** The slides a production carousel has: its parts, the hook always as the cover. */
export function productionSlideParts(props: ProductionReelProps): ProductionPart[] {
  const production = { ...productionOf(props), showHook: true };
  return productionParts(props.script, production, props.plan);
}

export function ProductionSlide(props: ProductionSlideProps) {
  const parts = productionSlideParts(props);
  const index = Math.max(0, Math.min(parts.length - 1, Math.round(props.index)));
  const part = parts[index];
  const pal = palette(props.brand, "story");
  const media = mediaFor(props, part);
  const header = <SlideHeader {...props} pal={pal} index={index} total={parts.length} dark={props.direction !== "meme"} />;
  let body;
  if (part.role === "cta") body = <CtaSlide {...props} part={part} pal={pal} />;
  else if (props.direction === "meme") body = <MemeSlide {...props} part={part} pal={pal} />;
  else if (props.direction === "text_music") body = <TypeSlide {...props} part={part} pal={pal} />;
  else body = <PhotoSlide {...props} part={part} pal={pal} index={index} />;
  return (
    <AbsoluteFill style={{ fontFamily: FONT, overflow: "hidden", background: "#07070b" }}>
      {part.role === "cta" || props.direction !== "meme" ? (
        <Backdrop media={media} pal={pal} concept={props.concept} query={part.scene?.visual.query} seed={index} dim={part.role === "cta" ? 0.78 : props.direction === "text_music" ? 0.62 : 0} />
      ) : null}
      {body}
      {header}
    </AbsoluteFill>
  );
}

function Backdrop({ media, pal, concept, query, seed, dim }: { media: ReturnType<typeof mediaFor>; pal: Palette; concept?: boolean; query?: string; seed: number; dim: number }) {
  return (
    <AbsoluteFill>
      {media ? <SceneVisual media={media} duration={1} motion="still" seed={seed} pal={pal} concept={concept} query={query} /> : concept ? <ConceptFrame query={query} seed={seed} pal={pal} /> : <BrandShapes seed={seed} pal={pal} />}
      {dim ? <AbsoluteFill style={{ background: `rgba(6,6,10,${dim})` }} /> : null}
    </AbsoluteFill>
  );
}

function SlideHeader({ brand, pal, index, total, dark }: ProductionSlideProps & { pal: Palette; index: number; total: number; dark: boolean }) {
  const ink = dark ? "#ffffff" : "#111114";
  return (
    <div style={{ position: "absolute", left: 64, right: 64, bottom: 48, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
        <LogoTile brand={brand} size={52} pal={pal} />
        <span style={{ fontSize: 28, fontWeight: 800, color: ink, textShadow: dark ? "0 2px 10px rgba(0,0,0,0.6)" : undefined }}>{cleanDomain(brand.domain)}</span>
      </div>
      <span style={{ padding: "8px 20px", borderRadius: 999, background: dark ? "rgba(0,0,0,0.5)" : "#111114", color: "#fff", fontSize: 26, fontWeight: 800 }}>
        {index + 1}/{total}
      </span>
    </div>
  );
}

function MemeSlide({ part, pal, ...props }: ProductionSlideProps & { part: ProductionPart; pal: Palette }) {
  const bar = part.scene?.overlay?.trim() || part.title;
  const size = fitFontSize(bar, 940, 3, 70, 46, 0.56);
  const barHeight = Math.min(420, Math.round(Math.ceil((bar.length * size * 0.5) / (940 * 0.92)) * size * 1.2 + 90));
  const media = mediaFor(props as ProductionReelProps, part);
  const reaction = part.scene?.reaction?.trim();
  return (
    <AbsoluteFill style={{ background: "#fff" }}>
      <div style={{ height: barHeight, padding: "50px 70px 0", fontSize: size, fontWeight: 800, lineHeight: 1.18, color: "#111114" }}>{bar}</div>
      <div style={{ position: "absolute", top: barHeight, left: 0, right: 0, bottom: 130, overflow: "hidden" }}>
        <Backdrop media={media} pal={pal} concept={props.concept} query={part.scene?.visual.query} seed={part.part} dim={0} />
        {part.title !== bar ? (
          <div style={{ position: "absolute", left: 60, right: 60, bottom: 40, fontSize: 52, fontWeight: 900, color: "#fff", textShadow: "0 3px 0 #000, 0 0 18px rgba(0,0,0,0.8)" }}>{part.title}</div>
        ) : null}
        {reaction ? (
          <div style={{ position: "absolute", right: 50, top: 40, padding: "14px 26px", borderRadius: 24, background: pal.accent, color: pal.onAccent, fontSize: reaction.length <= 3 ? 110 : 60, fontWeight: 900, transform: "rotate(-8deg)" }}>{reaction}</div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
}

function TypeSlide({ part, pal }: ProductionSlideProps & { part: ProductionPart; pal: Palette }) {
  const words = splitWords(part.title);
  const strong = emphasis(words);
  const size = fitFontSize(part.title, 920, 5, 132, 60);
  return (
    <AbsoluteFill style={{ padding: "120px 80px 160px", justifyContent: "center" }}>
      <div style={{ fontSize: size, fontWeight: 900, lineHeight: 1.02, letterSpacing: "-0.04em", color: "#fff" }}>
        {words.map((word, i) => (
          <span key={i} style={{ color: strong.has(i) ? pal.accent : "#fff" }}>
            {word}{" "}
          </span>
        ))}
      </div>
      {part.detail ? <div style={{ marginTop: 40, fontSize: fitFontSize(part.detail, 920, 4, 52, 40, 0.55), fontWeight: 600, lineHeight: 1.25, color: "rgba(255,255,255,0.88)" }}>{part.detail}</div> : null}
    </AbsoluteFill>
  );
}

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"];

function PhotoSlide({ part, pal, index, direction }: ProductionSlideProps & { part: ProductionPart; pal: Palette; index: number }) {
  const size = fitFontSize(part.title, 920, 4, part.role === "hook" ? 96 : 78, 52);
  const editorial = direction === "storytelling";
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0) 30%, rgba(0,0,0,0.55) 62%, rgba(0,0,0,0.88) 100%)" }} />
      <div style={{ position: "absolute", left: 80, right: 80, bottom: 170, color: "#fff" }}>
        {editorial ? <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: "0.12em", color: pal.accent, marginBottom: 18 }}>{ROMAN[index] ?? index + 1}</div> : null}
        <div
          style={{
            fontSize: size,
            fontWeight: editorial ? 700 : 900,
            lineHeight: 1.08,
            letterSpacing: "-0.03em",
            textShadow: "0 4px 24px rgba(0,0,0,0.55)",
            ...(editorial ? {} : { borderLeft: `12px solid ${pal.accent}`, paddingLeft: 28 }),
          }}
        >
          {part.title}
        </div>
        {part.detail ? <div style={{ marginTop: 26, fontSize: 44, fontWeight: 600, lineHeight: 1.25, color: "rgba(255,255,255,0.9)" }}>{part.detail}</div> : null}
      </div>
    </AbsoluteFill>
  );
}

function CtaSlide({ part, pal, brand }: ProductionSlideProps & { part: ProductionPart; pal: Palette }) {
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: "0 80px 120px", textAlign: "center", color: "#fff" }}>
      <LogoTile brand={brand} size={170} pal={pal} />
      <div style={{ marginTop: 30, fontSize: 46, fontWeight: 800 }}>{brand.name}</div>
      <div style={{ marginTop: 34, fontSize: fitFontSize(part.title, 920, 4, 96, 54), fontWeight: 900, lineHeight: 1.05, letterSpacing: "-0.035em" }}>{part.title}</div>
      <div style={{ marginTop: 50 }}>
        <DomainPill domain={brand.domain} pal={pal} />
      </div>
    </AbsoluteFill>
  );
}
