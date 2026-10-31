// Bundles the video templates (src/remotion) into .remotion-bundle before
// `next build`, so the background jobs can hand them to the render machine
// (lib/video/render.ts; next.config.ts ships the folder with the jobs'
// function). Webpack, Remotion's own bundler: the templates are plain React
// and import nothing from the app but lib/video/formats.ts.
import { cpSync, rmSync } from "node:fs";
import path from "node:path";

import { bundle } from "@remotion/bundler";

const root = process.cwd();
const outDir = path.join(root, ".remotion-bundle");
rmSync(outDir, { recursive: true, force: true });

// The templates' public files are only their fonts (src/remotion/fonts.ts): not the app's whole
// public folder, whose music and pictures would be copied to the render machine on every render.
const publicDir = path.join(root, ".remotion-public");
rmSync(publicDir, { recursive: true, force: true });
cpSync(path.join(root, "public", "video-fonts"), path.join(publicDir, "video-fonts"), { recursive: true });

const started = Date.now();
await bundle({
  entryPoint: path.join(root, "src/remotion/index.ts"),
  outDir,
  publicDir,
  // The templates' "@/..." imports, as tsconfig maps them. No source maps: the bundle is copied
  // to the render machine for every video, and the maps would be most of it.
  webpackOverride: (config) => ({
    ...config,
    devtool: false,
    resolve: { ...config.resolve, alias: { ...(config.resolve?.alias ?? {}), "@": path.join(root, "src") } },
  }),
});
console.log(`[remotion] templates bundled into .remotion-bundle in ${Math.round((Date.now() - started) / 1000)}s`);
