import { Editor, getSchema, type JSONContent } from "@tiptap/core";
import { describe, expect, it } from "vitest";

import { COMPACT_EXTENSIONS, linkHref } from "@/components/rich-text-editor";

/**
 * The compact editor (FAQ answers) can hold only what its toolbar makes. The
 * schema is what ProseMirror parses a paste against, so a node type missing
 * here is one a paste cannot bring in: a heading or table keeps its words as
 * paragraphs, a picture is left out. (The paste itself needs a browser DOM,
 * which these Node tests do not have; the schema is the part this code
 * decides.)
 */
describe("the compact editor's schema", () => {
  const schema = getSchema(COMPACT_EXTENSIONS);

  it("has paragraphs, lists and line breaks; bold, italic and links - and nothing else", () => {
    expect(Object.keys(schema.nodes).sort()).toEqual(
      ["bulletList", "doc", "hardBreak", "listItem", "orderedList", "paragraph", "text"].sort(),
    );
    expect(Object.keys(schema.marks).sort()).toEqual(["bold", "italic", "link"]);
  });

  it("cannot hold a heading, quote, code, rule, picture or table, even from saved content", () => {
    for (const type of ["heading", "blockquote", "codeBlock", "horizontalRule", "image", "table"]) {
      expect(() => schema.nodeFromJSON({ type: "doc", content: [{ type, content: [{ type: "text", text: "x" }] }] }), type).toThrow(
        /Unknown node type/,
      );
    }
    for (const mark of ["strike", "underline", "code"]) {
      expect(() => schema.nodeFromJSON({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "x", marks: [{ type: mark }] }] }] }), mark).toThrow(
        /no mark type/i,
      );
    }
  });

  it("one link extension, configured as the full editor's", () => {
    const links = COMPACT_EXTENSIONS.filter((extension) => extension.name === "link");
    expect(links).toHaveLength(1);
    expect(links[0].options).toMatchObject({ openOnClick: false, autolink: true, HTMLAttributes: { rel: "noopener nofollow", target: "_blank" } });
  });
});

/**
 * The compact editor as a saved answer loads into it. A Node editor runs the
 * same plugins and transactions as the page's, with no view to draw them.
 *
 * Saved answers never end in an empty paragraph: the sanitiser strips it on
 * save. One ending in a list got it back on the first transaction after
 * loading - the one clicking or tabbing into the answer makes - and that
 * counted as an edit: "Unsaved changes", and a question before leaving, on a
 * post nobody had touched.
 */
describe("the compact editor, loaded with a saved answer", () => {
  const paragraph = (text: string): JSONContent => ({ type: "paragraph", content: [{ type: "text", text }] });
  const list = (type: "bulletList" | "orderedList", ...items: string[]): JSONContent => ({
    type,
    content: items.map((text) => ({ type: "listItem", content: [paragraph(text)] })),
  });

  for (const [name, content] of [
    ["a paragraph and a numbered list", [paragraph("Steps:"), list("orderedList", "Book", "Shoot")]],
    ["only a bulleted list", [list("bulletList", "length", "locations")]],
    ["a paragraph", [paragraph("Days to weeks.")]],
  ] as const) {
    it(`ending in ${name}: clicking into it is not an edit`, () => {
      const updates: string[] = [];
      const editor = new Editor({
        extensions: COMPACT_EXTENSIONS,
        content: { type: "doc", content: [...content] },
        onUpdate: ({ editor: current }) => updates.push(JSON.stringify(current.getJSON())),
      });
      // A Node editor is never mounted, and mounting is what adds the extensions' plugins: added here as mount() does.
      editor.view.updateState(editor.state.reconfigure({ plugins: editor.extensionManager.plugins }));
      const loaded = editor.state.doc;
      // What a click or Tab into the editor dispatches (FocusEvents): a transaction carrying only the focus.
      editor.view.dispatch(editor.state.tr.setMeta("focus", { event: new Event("focus") }));
      expect(updates).toEqual([]);
      expect(editor.state.doc.eq(loaded)).toBe(true);
      editor.destroy();
    });
  }

  it("has no trailing-node extension to add one", () => {
    const starterKit = COMPACT_EXTENSIONS.find((extension) => extension.name === "starterKit");
    expect(starterKit?.options).toMatchObject({ trailingNode: false });
  });
});

/**
 * The link dialog of the editor's workspace variant: an address that the
 * sanitiser would drop on save is refused there, with a reason, instead of
 * vanishing later.
 */
describe("linkHref", () => {
  it("keeps web, mail and phone addresses and relative ones", () => {
    expect(linkHref(" https://example.com/page ")).toBe("https://example.com/page");
    expect(linkHref("http://example.com")).toBe("http://example.com");
    expect(linkHref("mailto:hello@example.com")).toBe("mailto:hello@example.com");
    expect(linkHref("tel:+3912345")).toBe("tel:+3912345");
    expect(linkHref("/pricing")).toBe("/pricing");
    expect(linkHref("#section-two")).toBe("#section-two");
  });

  it("completes a bare domain with https://", () => {
    expect(linkHref("example.com/page")).toBe("https://example.com/page");
    expect(linkHref("www.example.co.uk")).toBe("https://www.example.co.uk");
  });

  it("an empty address means remove the link", () => {
    expect(linkHref("   ")).toBe("");
  });

  it("refuses what would not survive the sanitiser or is not an address", () => {
    expect(linkHref("javascript:alert(1)")).toBeNull();
    expect(linkHref("data:text/html,hi")).toBeNull();
    expect(linkHref("https://")).toBeNull();
    expect(linkHref("not a link")).toBeNull();
    expect(linkHref("words")).toBeNull();
  });
});
