/**
 * The dotted world map behind the onboarding panel, as the reference draws it.
 *
 * WHY A COMPONENT AND NOT AN IMAGE: at this size the map is decoration, and a
 * PNG would be a network request plus a retina variant for something that is
 * ultimately a few hundred circles. Drawn as an SVG it stays sharp at any
 * width, inherits `currentColor` so it themes itself, and adds no asset to
 * ship.
 *
 * WHAT IT DELIBERATELY DOES NOT DO: the reference scatters bright markers
 * across its map, which are that company's customer locations. Ours draws the
 * landmasses only. A marker would be a claim about where our customers are,
 * and we would be inventing every one of them — the same reason
 * lib/marketing/testimonials.ts is empty.
 *
 * The grid is a coarse equirectangular projection: each string is one band of
 * latitude, `#` where there is land. Coarse on purpose — at 14px spacing the
 * continents need to be recognisable in outline, not accurate, and a real
 * geographic dataset would be kilobytes for a shape nobody will study.
 */

/**
 * Landmass mask, north to south. Each row is one dot-row; `#` draws a dot.
 *
 * Reading it as text is the point: correcting a coastline is editing a
 * character, not recalculating coordinates.
 */
const LAND = [
  "..........................................................",
  "...........####......########################.............",
  ".......###########....######################.####.........",
  "......##############...####################.#####.........",
  ".......#############....##################...###..........",
  "........###########......###############......#...........",
  ".........#########.......##############...................",
  "..........#######.........############....................",
  "...........####............#########......................",
  "............##..............#######.......................",
  ".............#...............#####.......####.............",
  "..............##..............####......######............",
  "..............###.............####.....#######............",
  "...............###............####......#####.............",
  "...............###............###........###..............",
  "................##............###.........#...............",
  "................##............##..........................",
  ".................#............##..........................",
  ".................#............#...........................",
  "..................#...........#...........................",
  "..................#.......................................",
  "..........................................................",
];

export function WorldMap({ className }: { className?: string }) {
  const rows = LAND.length;
  const cols = LAND[0].length;
  /* One unit per dot, so the viewBox maps straight onto the grid. */
  const dots: { x: number; y: number }[] = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (LAND[y][x] === "#") dots.push({ x, y });
    }
  }

  return (
    <svg
      viewBox={`0 0 ${cols} ${rows}`}
      className={className}
      /* Decorative: the panel's meaning is carried by the text beside it. */
      aria-hidden="true"
      focusable="false"
    >
      {dots.map((dot) => (
        <circle
          key={`${dot.x}-${dot.y}`}
          cx={dot.x + 0.5}
          cy={dot.y + 0.5}
          r={0.34}
          fill="currentColor"
        />
      ))}
    </svg>
  );
}
