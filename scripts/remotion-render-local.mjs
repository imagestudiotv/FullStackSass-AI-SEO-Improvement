// Renders a reel (MP4) or a carousel's slides (PNGs) on this machine, for
// development (lib/video/render.ts). A process of its own: Remotion's
// renderer cannot load inside Next's server, and a render should not hold
// the dev server's memory.
//
//   node scripts/remotion-render-local.mjs reel|slides <props.json> <out-dir> [slide-count]
//
// Prints the files written, one per line, as JSON at the end.
import { cpSync, existsSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";

import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";

const [kind, propsFile, outDir, countArg] = process.argv.slice(2);
const props = JSON.parse(readFileSync(propsFile, "utf8"));
const root = process.cwd();
const licenseKey = process.env.REMOTION_LICENSE_KEY?.trim() || null;
// A Chrome already on the machine (REMOTION_BROWSER_EXECUTABLE), instead of Remotion downloading its own.
const browserExecutable = process.env.REMOTION_BROWSER_EXECUTABLE?.trim() || null;
const browser = browserExecutable ? { browserExecutable, chromeMode: "chrome-for-testing" } : {};

/** The templates' public folder: their fonts only (as scripts/remotion-bundle.mjs). */
function fontsOnly() {
  const dir = path.join(root, ".remotion-public");
  rmSync(dir, { recursive: true, force: true });
  cpSync(path.join(root, "public", "video-fonts"), path.join(dir, "video-fonts"), { recursive: true });
  return dir;
}

const prebuilt = path.join(root, ".remotion-bundle");
const serveUrl = existsSync(path.join(prebuilt, "index.html"))
  ? prebuilt
  : await bundle({
      entryPoint: path.join(root, "src/remotion/index.ts"),
      publicDir: fontsOnly(),
      webpackOverride: (config) => ({
        ...config,
        resolve: { ...config.resolve, alias: { ...(config.resolve?.alias ?? {}), "@": path.join(root, "src") } },
      }),
    });

const files = [];
if (kind === "reel") {
  const composition = await selectComposition({ serveUrl, id: "Reel", inputProps: props, ...browser });
  const output = path.join(outDir, "reel.mp4");
  await renderMedia({
    serveUrl,
    composition,
    inputProps: props,
    codec: "h264",
    crf: 20,
    audioCodec: "aac",
    enforceAudioTrack: true,
    outputLocation: output,
    licenseKey,
    logLevel: "warn",
    timeoutInMilliseconds: 180_000,
    ...browser,
  });
  files.push(output);
} else {
  const count = Number(countArg);
  for (let index = 0; index < count; index += 1) {
    const inputProps = { ...props, index };
    const composition = await selectComposition({ serveUrl, id: "Slide", inputProps, ...browser });
    const output = path.join(outDir, `slide-${index + 1}.png`);
    await renderStill({ serveUrl, composition, inputProps, imageFormat: "png", output, licenseKey, timeoutInMilliseconds: 180_000, ...browser });
    files.push(output);
  }
}
console.log(JSON.stringify({ files }));
