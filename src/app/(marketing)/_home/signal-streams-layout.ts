/**
 * Where the hero's signal streams run (client, 2026-11-24,
 * repget_homepage_animated_signals.html): seven fine strands on each side of
 * the hero that converge on the website field, some with a travelling dot.
 *
 * Pure, so the shape can be tested without a browser. Measured in the hero's
 * own pixels: signal-streams.tsx measures the real form and redraws when it
 * moves, so the ends always meet the field.
 */

export type Box = { left: number; top: number; right: number; bottom: number };
type Point = { x: number; y: number };
type Curve = readonly [Point, Point, Point, Point];

export type Strand = {
  /** The path's `d`. */
  d: string;
  /** In the accent colour rather than the neutral one. */
  warm: boolean;
  /** The small still squares on the strand. */
  marks: { x: number; y: number; size: number; warm: boolean }[];
  /** The travelling dot, on every other strand: its journey, and where it stands when nothing may move. */
  dot: { r: number; soft: boolean; seconds: number; begin: number; still: Point } | null;
};

export type StreamLayout = { width: number; height: number; strands: Strand[] };

/** Narrower than this, the field is nearly edge to edge: no streams. */
export const MIN_STREAM_WIDTH = 960;
/** Strands on each side. */
export const STRANDS_PER_SIDE = 7;

/** Between the strands' ends and the field. */
const FIELD_GAP = 9;
/** How far past the hero's edges the strands start. */
const OVERSHOOT = 12;
/** Kept free around every line of text. */
const TEXT_GAP = 10;
/** Less of a spread than this is no longer a fan. */
const MIN_SPREAD = 40;
/** Less room than this beside the field, and there is no strand to speak of. */
const MIN_ROOM = 40;
/** How finely a strand is checked against the text. */
const CHECKS = 48;

const SIDES = ["left", "right"] as const;
const INDEXES = Array.from({ length: STRANDS_PER_SIDE }, (_, i) => i);

const round = (n: number) => Math.round(n * 10) / 10;

/** The point of a curve at `t` (0 to 1). */
function pointOn([a, b, c, d]: Curve, t: number): Point {
  const u = 1 - t;
  const at = (p: number, q: number, r: number, s: number) => u * u * u * p + 3 * u * u * t * q + 3 * u * t * t * r + t * t * t * s;
  return { x: at(a.x, b.x, c.x, d.x), y: at(a.y, b.y, c.y, d.y) };
}

/** Strand `index` (0 at the top) of one side, spread out by `spread` at the hero's edge. */
function curve(side: (typeof SIDES)[number], index: number, spread: number, width: number, form: Box): Curve {
  const direction = side === "left" ? 1 : -1;
  const start = side === "left" ? -OVERSHOOT : width + OVERSHOOT;
  const end = side === "left" ? form.left - FIELD_GAP : form.right + FIELD_GAP;
  const room = Math.abs(end - start);
  const middle = (form.top + form.bottom) / 2;
  const half = (STRANDS_PER_SIDE - 1) / 2;
  const offset = (index - half) / half;
  const startY = middle + offset * spread;
  const endY = middle + offset * 4.5;
  return [
    { x: start, y: startY },
    { x: start + direction * room * 0.27, y: startY + offset * 17 },
    { x: end - direction * room * 0.32, y: endY + (startY - endY) * 0.13 },
    { x: end, y: endY },
  ];
}

function touches(strand: Curve, texts: Box[]) {
  for (let i = 0; i <= CHECKS; i++) {
    const { x, y } = pointOn(strand, i / CHECKS);
    if (texts.some((t) => x > t.left - TEXT_GAP && x < t.right + TEXT_GAP && y > t.top - TEXT_GAP && y < t.bottom + TEXT_GAP)) return true;
  }
  return false;
}

/**
 * The streams for a hero of this size, with the form and the lines of text
 * where they are in it. Null when there is no room: a narrow screen, a field
 * that reaches the edges, or text in the way however flat the fan is. A long
 * title (some languages' is) makes the fan flatter rather than cross it.
 */
export function streamLayout({ width, height, form, texts }: { width: number; height: number; form: Box; texts: Box[] }): StreamLayout | null {
  if (width < MIN_STREAM_WIDTH || form.right <= form.left) return null;
  if (Math.min(form.left, width - form.right) < MIN_ROOM) return null;

  let spread = Math.min(155, Math.max(104, height * 0.3));
  const blocked = () => SIDES.some((side) => INDEXES.some((i) => touches(curve(side, i, spread, width, form), texts)));
  while (blocked()) {
    spread *= 0.85;
    if (spread < MIN_SPREAD) return null;
  }

  const strands = SIDES.flatMap((side) =>
    INDEXES.map((i): Strand => {
      const points = curve(side, i, spread, width, form);
      const [a, b, c, d] = points.map((p) => `${round(p.x)} ${round(p.y)}`);
      const still = pointOn(points, 0.38 + (i % 3) * 0.13);
      return {
        d: `M ${a} C ${b}, ${c}, ${d}`,
        warm: i === 2 || i === 4,
        marks: (i % 2 === 0 ? [0.22, 0.64] : [0.41, 0.82]).map((t, j) => {
          const { x, y } = pointOn(points, t);
          const size = j === 0 ? 3.5 : 2.5;
          return { x: round(x - size / 2), y: round(y - size / 2), size, warm: (i + j) % 4 === 0 };
        }),
        dot:
          i % 2 === 0
            ? {
                r: i === 2 ? 2.8 : 2.1,
                soft: i === 0 || i === 6,
                seconds: round(11.5 + (i % 3) * 2.3 + (side === "right" ? 0.8 : 0)),
                begin: -round(i * 0.91 + (side === "right" ? 3.1 : 0)),
                still: { x: round(still.x), y: round(still.y) },
              }
            : null,
      };
    }),
  );
  return { width, height, strands };
}
