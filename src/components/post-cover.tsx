import type { BlogCategory } from "@/lib/blog/posts";

/**
 * The cover shown on a post card and at the top of a post.
 *
 * Drawn rather than photographed. The reference uses commissioned illustrations
 * per article, which we do not have and cannot invent — a stock photo of a
 * laptop would say nothing about the post, and generating one per article costs
 * real money for decoration. So each post gets a deterministic pattern seeded
 * by its slug: distinct enough that cards are visually separable in a grid,
 * honest in that it claims to be nothing but a graphic.
 *
 * Rendered inline as SVG, so there is no image request, nothing to 404, and no
 * layout shift while it loads.
 */

/** Hash of the slug, so a post's cover never changes between builds. */
function seedFrom(slug: string): number {
  let hash = 0;
  for (let i = 0; i < slug.length; i += 1) {
    hash = (hash * 31 + slug.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/**
 * A small deterministic generator.
 *
 * Math.random would give a different cover on every render, which on a
 * statically generated page means the cover changes each time the page is
 * rebuilt.
 */
function makeRandom(seed: number): () => number {
  let state = seed || 1;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

/**
 * Greedily wraps a title into lines for the cover.
 *
 * Character-based rather than measured: this renders on the server where no
 * text metrics exist, and the covers use one known size, so a character budget
 * is accurate enough and costs nothing.
 */
function wrapTitle(title: string, perLine = 26, maxLines = 3): string[] {
  /**
   * A word longer than the line is hard-broken first. Without this a single
   * unbroken word runs off both edges of the cover, since nothing in the
   * greedy loop below can split one.
   */
  const words = title
    .split(/\s+/)
    .filter(Boolean)
    .flatMap((word) =>
      word.length <= perLine
        ? [word]
        : (word.match(new RegExp(`.{1,${perLine}}`, "g")) ?? [word]),
    );

  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= perLine) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    current = word;
    // Out of room: fall back to an ellipsis rather than dropping the rest
    // silently, so it is clear the title continues.
    if (lines.length === maxLines) break;
  }

  if (current && lines.length < maxLines) lines.push(current);
  if (lines.length === 0) return [title.slice(0, perLine)];

  if (lines.length === maxLines) {
    const joined = lines.join(" ");
    if (joined.length < title.replace(/\s+/g, " ").length) {
      lines[maxLines - 1] = `${lines[maxLines - 1]}…`;
    }
  }
  return lines;
}

/** Each category gets its own hue, so the grid reads as grouped. */
const CATEGORY_HUE: Record<BlogCategory, number> = {
  Guides: 41.5, // the brand orange
  Comparisons: 210,
  Playbooks: 152,
};

export function PostCover({
  slug,
  title,
  category,
  className,
}: {
  slug: string;
  title: string;
  category: BlogCategory;
  className?: string;
}) {
  const random = makeRandom(seedFrom(slug));
  const hue = CATEGORY_HUE[category];
  const lines = wrapTitle(title);

  // Scattered marks over a soft ground. Fixed count so every cover has the
  // same visual weight regardless of how the seed falls.
  const shapes = Array.from({ length: 18 }, (_, index) => {
    const kind = Math.floor(random() * 3);
    return {
      key: index,
      kind,
      x: random() * 100,
      y: random() * 100,
      size: 2 + random() * 7,
      opacity: 0.16 + random() * 0.4,
      rotation: random() * 360,
    };
  });

  return (
    <div
      className={className}
      // Decorative: the title sits next to it in the card, so announcing this
      // would just repeat it.
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 100 56"
        preserveAspectRatio="xMidYMid slice"
        className="size-full"
        role="presentation"
      >
        <defs>
          <linearGradient id={`cover-${slug}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={`oklch(0.97 0.02 ${hue})`} />
            <stop offset="100%" stopColor={`oklch(0.93 0.05 ${hue})`} />
          </linearGradient>
        </defs>

        <rect width="100" height="56" fill={`url(#cover-${slug})`} />

        {shapes.map((shape) => {
          const fill = `oklch(0.62 0.16 ${hue} / ${shape.opacity})`;
          const x = (shape.x / 100) * 100;
          const y = (shape.y / 100) * 56;

          if (shape.kind === 0) {
            return (
              <circle
                key={shape.key}
                cx={x}
                cy={y}
                r={shape.size / 2}
                fill="none"
                stroke={fill}
                strokeWidth="0.6"
              />
            );
          }
          if (shape.kind === 1) {
            return (
              <rect
                key={shape.key}
                x={x}
                y={y}
                width={shape.size}
                height={shape.size}
                rx="1"
                fill="none"
                stroke={fill}
                strokeWidth="0.6"
                transform={`rotate(${shape.rotation} ${x} ${y})`}
              />
            );
          }
          return (
            <line
              key={shape.key}
              x1={x}
              y1={y}
              x2={x + shape.size}
              y2={y}
              stroke={fill}
              strokeWidth="0.6"
              strokeLinecap="round"
              transform={`rotate(${shape.rotation} ${x} ${y})`}
            />
          );
        })}

        {/*
          The title, set into the artwork the way the reference's covers carry
          their own wordmark.

          Wrapped by hand into tspans: SVG text does not wrap, and truncating
          instead cut every title mid-word ("What to fix first on a website
          t…"), which looks like a bug rather than a design.
        */}
        <text
          textAnchor="middle"
          className="fill-foreground"
          style={{ fontSize: "4.6px", fontWeight: 600 }}
        >
          {lines.map((line, index) => (
            <tspan
              key={line}
              x="50"
              // Block centred vertically, leaving room for the rule beneath.
              y={24 - (lines.length - 1) * 3 + index * 6}
            >
              {line}
            </tspan>
          ))}
        </text>
        <line
          x1="42"
          y1={30 + (lines.length - 1) * 3}
          x2="58"
          y2={30 + (lines.length - 1) * 3}
          stroke={`oklch(0.62 0.18 ${hue})`}
          strokeWidth="1"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
