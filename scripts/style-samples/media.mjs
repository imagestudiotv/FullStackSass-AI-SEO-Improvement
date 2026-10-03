// Sketch and watercolour renderings of the same scene description.
//
// Both draw SHAPE BY SHAPE in the scene's back-to-front order, so a nearer
// object hides what is behind it the way it would on paper: the sketch knocks
// each shape out with paper before colouring and outlining it (no lines show
// through the rug or the leaves), and the watercolour reserves its whites
// (window bars, notebook, mug) by leaving the paper unpainted over whatever
// wash is behind them.
import { H, PALETTE, W } from "./scene.mjs";

const attrs = (a) =>
  Object.entries(a)
    .map(([k, v]) => `${k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}="${v}"`)
    .join(" ");

let clipSeq = 0;
function walk(scene, draw, defs) {
  return scene
    .map((s, i) => {
      if (s.el === "g") {
        const id = `mclip${clipSeq++}`;
        defs.push(`<clipPath id="${id}"><rect ${attrs(s.clip)}/></clipPath>`);
        return `<g clip-path="url(#${id})">${walk(s.children, draw, defs)}</g>`;
      }
      return draw(s, i);
    })
    .join("\n");
}
/** Region around a path, in user space, for filters on straight lines. */
function region(s, pad = 24) {
  const nums = (s.a.d ?? "").match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
  const xs = nums.filter((_, i) => i % 2 === 0), ys = nums.filter((_, i) => i % 2 === 1);
  if (!xs.length) return null;
  const x = Math.min(...xs) - pad, y = Math.min(...ys) - pad;
  return { x, y, w: Math.max(...xs) - x + pad, h: Math.max(...ys) - y + pad };
}
let lineSeq = 0;
/** Wraps a straight-line element in a copy of filter `id` with a user-space region. */
function lineFilter(defs, id, template, s) {
  const r = region(s);
  if (!r) return `filter="url(#${id})"`;
  const nid = `${id}L${lineSeq++}`;
  defs.push(template.replace(`id="${id}"`, `id="${nid}"`).replace(/x="[^"]*" y="[^"]*" width="[^"]*" height="[^"]*"/, `filterUnits="userSpaceOnUse" x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}"`));
  return `filter="url(#${nid})"`;
}

/** A shape's geometry with the given paint; its own fill and opacity are replaced by the paint. */
function shape(s, paint) {
  const rest = Object.fromEntries(Object.entries(s.a).filter(([key]) => key !== "fill" && key !== "opacity"));
  return `<${s.el} ${attrs(rest)} ${paint}/>`;
}

/* ---- colour helpers ---------------------------------------------------- */
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const toHex = (rgb) => `#${rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")}`;
const mix = (a, b, t) => toHex(hex(a).map((v, i) => v + (hex(b)[i] - v) * t));
/** Pushes a colour away from grey: watercolour pigment reads vivid. */
function saturate(h, amount) {
  const [r, g, b] = hex(h);
  const avg = (r + g + b) / 3;
  return toHex([r, g, b].map((v) => avg + (v - avg) * amount));
}

/** Paper tooth as an overlay: long fibres and fine grain, drawn last. */
function paperOverlay(grainOpacity, fibreOpacity, seed) {
  return {
    defs: `<filter id="grain" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="3" seed="${seed}" result="n"/>
      <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.42  0 0 0 0 0.34  0 0 0 0 0.26  ${grainOpacity} 0 0 0 0"/>
    </filter>
    <filter id="fibre" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.012 0.05" numOctaves="2" seed="${seed + 5}" result="f"/>
      <feColorMatrix in="f" type="matrix" values="0 0 0 0 0.5  0 0 0 0 0.42  0 0 0 0 0.32  ${fibreOpacity} 0 0 0 0"/>
    </filter>`,
    body: `<rect width="${W}" height="${H}" filter="url(#fibre)"/><rect width="${W}" height="${H}" filter="url(#grain)"/>`,
  };
}


const UNPAINTED = new Set(["white", "paper", "cloud", "frame", "skyLight"]);
const SHADE = new Set(["woodDark", "curtainShade", "leafDark", "navy", "potDark", "orangeDark", "frameShade", "treeDark"]);

const SK_PENCIL = `<filter id="pencil" x="-8%" y="-8%" width="116%" height="116%">
      <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="2" seed="4" result="w"/>
      <feDisplacementMap in="SourceGraphic" in2="w" scale="9" xChannelSelector="R" yChannelSelector="G" result="d"/>
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="9" result="t"/>
      <feColorMatrix in="t" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  2.2 0 0 0 -0.35" result="m"/>
      <feComposite in="d" in2="m" operator="in"/>
    </filter>`;
const SK_HAND_A = `<filter id="handA" x="-8%" y="-8%" width="116%" height="116%">
      <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="2" result="w"/>
      <feDisplacementMap in="SourceGraphic" in2="w" scale="4.5" xChannelSelector="R" yChannelSelector="G"/>
    </filter>`;
const SK_HAND_B = `<filter id="handB" x="-8%" y="-8%" width="116%" height="116%">
      <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" seed="17" result="w"/>
      <feDisplacementMap in="SourceGraphic" in2="w" scale="6" xChannelSelector="G" yChannelSelector="R"/>
    </filter>`;

/**
 * Coloured sketch: loose sepia linework over soft warm colour on textured
 * paper. The colour sits slightly off the lines, the way a quick sketch is
 * coloured in after it is drawn; the lines are drawn twice by a hand that
 * wobbles; shadows are hatched.
 */
export function sketch(scene) {
  const PAPER = "#FBF5EA";
  const INK = "#4A382C";
  const defs = [];
  const p = paperOverlay(0.16, 0.07, 11);
  const body = walk(
    scene,
    (s) => {
      const parts = [];
      if (s.role === "light") return shape(s, `fill="#FFF6DA" opacity="${s.a.opacity ?? 0.5}"`);
      if (s.line) {
        const colourLine = s.width >= 6;
        if (colourLine)
          parts.push(`<g ${lineFilter(defs, "pencil", SK_PENCIL, s)} transform="translate(3 2)">${shape(s, `fill="none" stroke="${mix(PALETTE[s.role] ?? INK, PAPER, 0.15)}" stroke-width="${s.width}" stroke-linecap="round"`)}</g>`);
        const ink = colourLine || s.role === "ink" || s.role === "woodDark" ? INK : mix(PALETTE[s.role] ?? INK, INK, 0.35);
        parts.push(`<g ${lineFilter(defs, "handA", SK_HAND_A, s)}>${shape(s, `fill="none" stroke="${ink}" stroke-width="${Math.max(1.6, Math.min(2.6, s.width * 0.75))}" stroke-linecap="round"`)}</g>`);
        return parts.join("");
      }
      if (s.a.fill === "none") return `<g filter="url(#handA)">${shape(s, `fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"`)}</g>`;
      const base = PALETTE[s.role] ?? s.role;
      const op = s.a.opacity ?? 1;
      // Paper first: whatever is behind this shape stops showing through it.
      if (op >= 0.99) parts.push(shape(s, `fill="${PAPER}"`));
      if (s.role !== "wall" && s.role !== "wallShade") {
        const colour = UNPAINTED.has(s.role) ? "#FFFDF7" : mix(saturate(base, 1.08), "#FBF0DE", 0.18);
        parts.push(`<g filter="url(#pencil)" transform="translate(4 3)" opacity="${0.92 * op}">${shape(s, `fill="${colour}"`)}</g>`);
      } else if (s.role === "wallShade") {
        parts.push(`<g opacity="0.45">${shape(s, `fill="url(#hatch)"`)}</g>`);
      }
      if (SHADE.has(s.role)) parts.push(`<g filter="url(#handB)" opacity="0.5">${shape(s, `fill="url(#hatch)"`)}</g>`);
      if (s.role !== "wall") {
        parts.push(`<g filter="url(#handA)">${shape(s, `fill="none" stroke="${INK}" stroke-width="2.3" stroke-linejoin="round" stroke-linecap="round"`)}</g>`);
        parts.push(`<g filter="url(#handB)" opacity="0.4" transform="translate(1.4 -1)">${shape(s, `fill="none" stroke="${INK}" stroke-width="1.3" stroke-linejoin="round"`)}</g>`);
      }
      return parts.join("");
    },
    defs,
  );
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>${p.defs}${defs.join("")}
    ${SK_PENCIL}${SK_HAND_A}${SK_HAND_B}
    <pattern id="hatch" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(38)">
      <line x1="0" y1="0" x2="0" y2="9" stroke="${INK}" stroke-width="1.5" opacity="0.6"/>
    </pattern>
  </defs>
  <rect width="${W}" height="${H}" fill="${PAPER}"/>
  ${body}
  ${p.body}
</svg>`;
}

/**
 * A wash: the shape's edge pushed about by low-frequency noise (the water
 * spreading), pigment unevenly distributed across it in soft blotches (where
 * it pooled and where it thinned), a little granulation in the paper's tooth,
 * and a darker rim where the edge dried.
 */
const washFilter = (i, seed, scale) => `<filter id="wash${i}" x="-10%" y="-10%" width="120%" height="120%">
      <feTurbulence type="fractalNoise" baseFrequency="0.014" numOctaves="3" seed="${seed}" result="w"/>
      <feDisplacementMap in="SourceGraphic" in2="w" scale="${scale}" xChannelSelector="R" yChannelSelector="G" result="d"/>
      <feComponentTransfer in="d" result="thin"><feFuncA type="linear" slope="0.5"/></feComponentTransfer>
      <feTurbulence type="fractalNoise" baseFrequency="0.009 0.022" numOctaves="2" seed="${seed + 20}" result="pool"/>
      <feColorMatrix in="pool" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  2.1 0 0 0 -0.55" result="poolA"/>
      <feComposite in="d" in2="poolA" operator="in" result="pooled"/>
      <feTurbulence type="fractalNoise" baseFrequency="0.004 0.09" numOctaves="2" seed="${seed + 30}" result="streak"/>
      <feColorMatrix in="streak" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1.8 0 0 0 -0.6" result="streakA"/>
      <feComposite in="d" in2="streakA" operator="in" result="strokes"/>
      <feTurbulence type="fractalNoise" baseFrequency="0.55" numOctaves="2" seed="${seed + 40}" result="g"/>
      <feColorMatrix in="g" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.5 0 0 0 0.65" result="gm"/>
      <feMorphology in="d" operator="erode" radius="2" result="core"/>
      <feComposite in="d" in2="core" operator="out" result="rim"/>
      <feComponentTransfer in="rim" result="rimDark"><feFuncR type="linear" slope="0.68"/><feFuncG type="linear" slope="0.68"/><feFuncB type="linear" slope="0.68"/><feFuncA type="linear" slope="0.65"/></feComponentTransfer>
      <feMerge result="paint"><feMergeNode in="thin"/><feMergeNode in="pooled"/><feMergeNode in="strokes"/><feMergeNode in="rimDark"/></feMerge>
      <feComposite in="paint" in2="gm" operator="in"/>
    </filter>`;
const WASHES = [washFilter(0, 3, 16), washFilter(1, 8, 13), washFilter(2, 13, 18), washFilter(3, 19, 14)];

/**
 * Watercolour: vivid transparent washes with bled edges and darker drying
 * rims, pigment pooling unevenly and granulating in the paper, the whites
 * reserved as bare paper, brushed lines, and a faint pencil underdrawing.
 */
export function watercolour(scene) {
  const defs = [];
  const p = paperOverlay(0.09, 0.05, 21);
  let n = 0;
  const body = walk(
    scene,
    (s) => {
      const k = n++ % 4;
      const f = `wash${k}`;
      if (s.role === "light") return `<g filter="url(#${f})" opacity="${(s.a.opacity ?? 0.5) * 0.7}">${shape(s, `fill="#FFE9A8"`)}</g>`;
      if (s.line || s.a.fill === "none") {
        const colour = saturate(PALETTE[s.role] ?? "#555555", 1.2);
        const width = s.line ? s.width : 5;
        const filter = s.line ? lineFilter(defs, f, WASHES[k], s) : `filter="url(#${f})"`;
        return `<g ${filter} opacity="0.85">${shape(s, `fill="none" stroke="${colour}" stroke-width="${width}" stroke-linecap="round"`)}</g>`;
      }
      if (s.role === "wall") return `<rect x="26" y="20" width="${W - 52}" height="${H - 34}" rx="40" fill="#F5DCC0" opacity="0.62" filter="url(#bloom)"/>`;
      // The bright upper sky: a pale, thin wash rather than bare paper.
      if (s.role === "skyLight") return `<g filter="url(#${f})" opacity="0.55">${shape(s, `fill="#BFE3F6"`)}</g>`;
      // Reserved whites: bare paper over anything behind, with a soft edge.
      if (UNPAINTED.has(s.role)) return `<g filter="url(#reserve)">${shape(s, `fill="#FFFFFF"`)}</g>`;
      const colour = saturate(PALETTE[s.role] ?? s.role, 1.45);
      // The wash's own alpha already varies; this is the overall transparency.
      const op = (s.a.opacity ?? 1) * 0.92;
      return `<g filter="url(#${f})" opacity="${op}">${shape(s, `fill="${colour}"`)}</g>`;
    },
    defs,
  );
  const underdrawing = walk(
    scene,
    (s) => (s.role === "light" || s.role === "wall" || s.line ? "" : shape(s, `fill="none" stroke="#7A6E66" stroke-width="1.1" stroke-linejoin="round"`)),
    defs,
  );
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>${p.defs}${defs.join("")}
    ${WASHES.join("")}
    <filter id="reserve" x="-6%" y="-6%" width="112%" height="112%">
      <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="2" seed="27" result="w"/>
      <feDisplacementMap in="SourceGraphic" in2="w" scale="6" xChannelSelector="R" yChannelSelector="G"/>
    </filter>
    <filter id="bloom" x="-5%" y="-5%" width="110%" height="110%">
      <feTurbulence type="fractalNoise" baseFrequency="0.008" numOctaves="3" seed="31" result="w"/>
      <feDisplacementMap in="SourceGraphic" in2="w" scale="60" xChannelSelector="R" yChannelSelector="G" result="d"/>
      <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="2" seed="33" result="v"/>
      <feColorMatrix in="v" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1.3 0 0 0 0.1" result="vm"/>
      <feComposite in="d" in2="vm" operator="in"/>
    </filter>
    <filter id="pencilLine" x="-5%" y="-5%" width="110%" height="110%">
      <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" seed="5" result="w"/>
      <feDisplacementMap in="SourceGraphic" in2="w" scale="3" xChannelSelector="R" yChannelSelector="G"/>
    </filter>
  </defs>
  <rect width="${W}" height="${H}" fill="#FFFFFF"/>
  ${body}
  <g filter="url(#pencilLine)" opacity="0.3">${underdrawing}</g>
  ${p.body}
</svg>`;
}

/** Flat vector illustration: the palette as flat fills, no gradients, no texture. */
export function illustration(scene) {
  const defs = [];
  const body = walk(
    scene,
    (s) => {
      const colour = PALETTE[s.role] ?? s.role;
      const op = s.a.opacity !== undefined ? ` opacity="${s.a.opacity}"` : "";
      if (s.line) return shape(s, `fill="none" stroke="${colour}" stroke-width="${s.width}" stroke-linecap="round" stroke-linejoin="round"${op}`);
      if (s.a.fill === "none") return shape(s, `fill="none" stroke="${colour}" stroke-width="5" stroke-linecap="round"${op}`);
      return shape(s, `fill="${colour}"${op}`);
    },
    defs,
  );
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>${defs.join("")}</defs>${body}</svg>`;
}
