import io
import re

p = "src/lib/images/generate.ts"
s = io.open(p, encoding="utf-8").read()

old = """function buildPrompt(title: string, industry: string | null): string {
  const context = industry ? ` for a ${industry} business` : "";
  return [
    `A clean, professional photograph illustrating "${title}"${context}.`,
    "Natural lighting, realistic, editorial style, suitable as a blog header.",
    "No text, no words, no letters, no logos, no watermarks in the image.",
  ].join(" ");
}"""

new = """function buildPrompt(
  title: string,
  industry: string | null,
  /**
   * The customer's chosen style, from the Article Settings screen.
   *
   * THIS WAS NOT READ AT ALL until now: the column existed, the picker wrote
   * to it, and this function asked for "natural lighting, realistic,
   * editorial style" whatever anybody chose. Someone who picked Watercolour
   * got photographs and had no way to tell the setting did nothing.
   */
  style?: string | null,
  /** "How your brand should look in images", in the customer's own words. */
  brief?: string | null,
  /** Standing exclusions - "never show faces" and the like. */
  instructions?: string | null,
): string {
  const context = industry ? ` for a ${industry} business` : "";
  return [
    `An image illustrating "${title}"${context}.`,
    imageStylePrompt(style),
    brief ? `Brand look: ${brief}` : null,
    instructions,
    "Suitable as a blog header.",
    "No text, no words, no letters, no logos, no watermarks in the image.",
  ]
    .filter(Boolean)
    .join(" ");
}"""

assert s.count(old) == 1, "buildPrompt not found"
s = s.replace(old, new)

# Insert the import after the last top-level import line.
lines = s.split("\n")
import_idx = [i for i, l in enumerate(lines) if re.match(r"^import .*from .*;$", l)]
assert import_idx, "no import lines found"
lines.insert(import_idx[-1] + 1,
             'import { imageStylePrompt } from "@/lib/websites/article-options";')
s = "\n".join(lines)

io.open(p, "w", encoding="utf-8", newline="").write(s)
print("buildPrompt now takes style, brief and instructions")
