import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { addBundle, REMOTION_BUNDLE_DIR } from "./render";

/** A sandbox's file system as Vercel's behaves: a folder needs its parent, files make theirs. */
function fakeSandbox() {
  const dirs = new Set<string>(["."]);
  const files: string[] = [];
  const parent = (p: string) => (p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : ".");
  return {
    dirs,
    files,
    mkDir: vi.fn(async (dir: string) => {
      if (!dirs.has(parent(dir))) throw new Error(`cannot create directory '/vercel/sandbox/${dir}': No such file or directory`);
      dirs.add(dir);
    }),
    writeFiles: vi.fn(async (list: { path: string }[]) => {
      files.push(...list.map((file) => file.path));
    }),
  };
}

describe("copying the templates to a render machine", () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), "repget-bundle-"));
    const bundle = path.join(root, REMOTION_BUNDLE_DIR);
    mkdirSync(path.join(bundle, "public", "video-fonts"), { recursive: true });
    writeFileSync(path.join(bundle, "index.html"), "<html></html>");
    writeFileSync(path.join(bundle, "public", "video-fonts", "inter.woff2"), "font");
    vi.spyOn(process, "cwd").mockReturnValue(root);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(root, { recursive: true, force: true });
  });

  it("makes the bundle folder before its sub-folders (2026-10-31: every live render failed there)", async () => {
    const sandbox = fakeSandbox();
    await addBundle(sandbox as never);
    expect(sandbox.mkDir.mock.calls.map(([dir]) => dir)).toEqual(["remotion-bundle", "remotion-bundle/public", "remotion-bundle/public/video-fonts"]);
    expect(sandbox.files.sort()).toEqual(["remotion-bundle/index.html", "remotion-bundle/public/video-fonts/inter.woff2"]);
    // Loading @remotion/vercel the first time can take a while.
  }, 120_000);
});
