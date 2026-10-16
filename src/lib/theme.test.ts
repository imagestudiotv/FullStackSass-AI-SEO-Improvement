import { describe, expect, it } from "vitest";

import { THEME_KEY, THEME_SCRIPT } from "@/lib/theme";

/**
 * The night mode script that runs before the first paint (app/layout.tsx), run
 * here against a stand-in page: dark only when "dark" was chosen, and never an
 * error - a script that throws there would stop nothing else, but a page that
 * cannot read storage must still open.
 */
function run(storage: { getItem: (key: string) => string | null }) {
  const classes = new Set<string>();
  const document = { documentElement: { classList: { add: (name: string) => classes.add(name) } } };
  new Function("localStorage", "document", THEME_SCRIPT)(storage, document);
  return [...classes];
}

describe("the early night mode script", () => {
  it("turns the page dark only when dark was chosen", () => {
    expect(run({ getItem: (key) => (key === THEME_KEY ? "dark" : null) })).toEqual(["dark"]);
    expect(run({ getItem: () => "light" })).toEqual([]);
    expect(run({ getItem: () => null })).toEqual([]);
    expect(run({ getItem: () => "DARK" })).toEqual([]);
  });

  it("never throws when storage is refused", () => {
    expect(
      run({
        getItem: () => {
          throw new Error("SecurityError");
        },
      }),
    ).toEqual([]);
  });
});
