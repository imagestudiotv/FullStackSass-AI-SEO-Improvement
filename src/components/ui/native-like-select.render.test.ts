import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { NativeLikeSelect, type NativeLikeSelectProps } from "./native-like-select";

const option = (value: string, label: string, disabled = false) => h("option", { key: value, value, disabled }, label);
const render = (props: Omit<NativeLikeSelectProps, "children">, options: ReturnType<typeof option>[]) =>
  renderToStaticMarkup(h("form", null, h(NativeLikeSelect, { ...props, children: options })));
const shown = (html: string) => /<span data-slot="select-value"[^>]*>([^<]*)<\/span>/.exec(html)?.[1];

describe("NativeLikeSelect", () => {
  it("shows the chosen option's label on first paint, as the native select did", () => {
    const html = render({ id: "size", value: 50, onChange: () => {} }, ["10", "25", "50"].map((n) => option(n, `${n} rows`)));
    expect(html).toMatch(/<button[^>]*role="combobox"[^>]*id="size"/);
    expect(shown(html)).toBe("50 rows");
  });

  it("chooses the first option when no value is given, like a native select", () => {
    expect(shown(render({}, [option("a", "First"), option("b", "Second")]))).toBe("First");
  });

  it("turns a disabled empty option into the placeholder", () => {
    const html = render({ value: "", onChange: () => {} }, [option("", "Choose a language", true), option("en", "English")]);
    expect(html).toContain('data-placeholder=""');
    expect(shown(html)).toBe("Choose a language");
  });

  it("keeps an empty option that is a real choice (e.g. None)", () => {
    const html = render({ value: "", onChange: () => {} }, [option("", "None"), option("x", "Something")]);
    expect(html).not.toContain('data-placeholder=""');
    expect(shown(html)).toBe("None");
  });

  it("submits its value with the form under its name, and nothing without a name", () => {
    expect(render({ name: "country", defaultValue: "IE" }, [option("", "-", true), option("IE", "Ireland")])).toContain(
      '<input type="hidden" name="country" value="IE"/>',
    );
    expect(render({ value: "IE", onChange: () => {} }, [option("IE", "Ireland")])).not.toContain('type="hidden"');
  });

  it("passes its label wiring through to the button", () => {
    const html = render({ id: "c", "aria-describedby": "c-hint", "aria-invalid": true, disabled: true }, [option("a", "A")]);
    expect(html).toMatch(/<button[^>]*aria-describedby="c-hint"/);
    expect(html).toMatch(/<button[^>]*aria-invalid="true"/);
    expect(html).toMatch(/<button[^>]*disabled=""/);
  });
});
