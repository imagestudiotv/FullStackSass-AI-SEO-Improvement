import { describe, expect, it } from "vitest";

import { MIN_STREAM_WIDTH, STRANDS_PER_SIDE, streamLayout, type Box, type Strand } from "./signal-streams-layout";

/** A hero of this width with the real field's size in it (780 x 79), as hero.module.css draws it. */
function hero(width: number, { formTop = 330, texts = [] as Box[] } = {}) {
  const formWidth = Math.min(780, width - 40);
  const left = (width - formWidth) / 2;
  return { width, height: 677, form: { left, right: left + formWidth, top: formTop, bottom: formTop + 79 }, texts };
}

/** The numbers of a strand's path: M x y C x y, x y, x y. */
const numbers = (strand: Strand) => (strand.d.match(/-?[\d.]+/g) ?? []).map(Number);

/** Points along a strand. */
function along(strand: Strand) {
  const [ax, ay, bx, by, cx, cy, dx, dy] = numbers(strand);
  return Array.from({ length: 101 }, (_, i) => {
    const t = i / 100;
    const u = 1 - t;
    const at = (p: number, q: number, r: number, s: number) => u ** 3 * p + 3 * u * u * t * q + 3 * u * t * t * r + t ** 3 * s;
    return { x: at(ax, bx, cx, dx), y: at(ay, by, cy, dy) };
  });
}

describe("the hero's signal streams", () => {
  it("draws seven strands a side that end at the real field, wherever it is", () => {
    for (const [width, formTop] of [
      [1440, 330],
      [1440, 402],
      [2560, 330],
      [1024, 300],
    ]) {
      const input = hero(width, { formTop });
      const layout = streamLayout(input);
      expect(layout?.strands).toHaveLength(2 * STRANDS_PER_SIDE);
      const middle = formTop + 79 / 2;
      layout?.strands.forEach((strand, i) => {
        const points = numbers(strand);
        const [endX, endY] = points.slice(-2);
        expect(endX).toBeCloseTo(i < STRANDS_PER_SIDE ? input.form.left - 9 : input.form.right + 9, 0);
        expect(Math.abs(endY - middle)).toBeLessThanOrEqual(5);
        // It starts outside the hero's edge, on its own side.
        if (i < STRANDS_PER_SIDE) expect(points[0]).toBeLessThan(0);
        else expect(points[0]).toBeGreaterThan(width);
      });
    }
  });

  it("is the same on both sides, with four travelling dots each", () => {
    const { strands = [] } = streamLayout(hero(1440)) ?? {};
    const left = strands.slice(0, STRANDS_PER_SIDE);
    const right = strands.slice(STRANDS_PER_SIDE);
    expect(left.filter((s) => s.dot)).toHaveLength(4);
    expect(right.filter((s) => s.dot)).toHaveLength(4);
    left.forEach((strand, i) => {
      const a = numbers(strand);
      const b = numbers(right[i]);
      for (let n = 0; n < a.length; n += 2) {
        expect(a[n]).toBeCloseTo(1440 - b[n], 0);
        expect(a[n + 1]).toBeCloseTo(b[n + 1], 0);
      }
    });
    for (const { dot } of strands) if (dot) expect(dot.begin).toBeLessThanOrEqual(0);
  });

  it("never enters the field", () => {
    for (const width of [960, 1200, 1920]) {
      const input = hero(width);
      for (const strand of streamLayout(input)?.strands ?? []) {
        for (const { x } of along(strand)) expect(x < input.form.left || x > input.form.right).toBe(true);
      }
    }
  });

  it("has nothing on a narrow screen, or where the field leaves no room", () => {
    expect(streamLayout(hero(390))).toBeNull();
    expect(streamLayout(hero(MIN_STREAM_WIDTH - 1))).toBeNull();
    expect(streamLayout(hero(MIN_STREAM_WIDTH))).not.toBeNull();
    expect(streamLayout({ ...hero(1000), form: { left: 10, right: 990, top: 300, bottom: 379 } })).toBeNull();
    // A form that is not laid out yet.
    expect(streamLayout({ ...hero(1440), form: { left: 0, right: 0, top: 0, bottom: 0 } })).toBeNull();
  });

  it("flattens the fan rather than cross a wide title, and gives up when no fan is flat enough", () => {
    const title: Box = { left: 60, right: 1140, top: 150, bottom: 280 };
    const flat = streamLayout(hero(1200, { texts: [title] }));
    const free = streamLayout(hero(1200));
    expect(flat).not.toBeNull();
    const top = (layout: typeof flat) => numbers(layout!.strands[0])[1];
    expect(top(flat)).toBeGreaterThan(top(free));
    for (const strand of flat!.strands) {
      for (const { x, y } of along(strand)) expect(x > title.left && x < title.right && y > title.top && y < title.bottom).toBe(false);
    }
    expect(streamLayout(hero(1200, { texts: [{ left: 20, right: 1180, top: 300, bottom: 440 }] }))).toBeNull();
  });
});
