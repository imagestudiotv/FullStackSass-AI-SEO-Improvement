#!/usr/bin/env node
/**
 * Candidates for the hook library (src/lib/video/footage/hook-library.ts),
 * for a person to pick from. Nothing here runs in the app.
 *
 *   PIXABAY_API_KEY=... node scripts/hook-library.mjs <out-dir> [per=6] [queries=file.json]
 *
 * queries=: other search words, as {"danger": ["rock climbing", ...], ...}.
 *
 * For each hook type it searches Pixabay's API (film footage, safe search)
 * with that type's search words, downloads each clip's smallest rendition to
 * <out-dir>/clips, saves an 8-frame strip of it (<out-dir>/strips/<type>/<id>.png)
 * and suggests where its climax starts: the biggest change between frames
 * after the first second (ffmpeg's scene score). It writes
 * <out-dir>/candidates.json - id, type, tags, length, page, suggested climax -
 * and <out-dir>/index.html to look through. A kept clip goes into
 * HOOK_LIBRARY with its climax checked by eye.
 *
 * Needs ffmpeg and ffprobe on PATH. The key is read from the environment and
 * never printed. Pixabay: 100 requests a minute; Content License.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const DEFAULT_QUERIES = {
  anticipation: ["domino chain falling", "glass filling with water slow motion", "basketball shot slow motion", "tree felling forest", "paint pouring slow motion", "balloon popping slow motion", "bowling strike", "golf ball putt"],
  impossible: ["balanced stones stacking", "water drop slow motion", "liquid nitrogen vapor", "ferrofluid magnet", "optical illusion", "ink in water slow motion", "soap bubble colors macro", "spinning top balance"],
  danger: ["jenga tower falling", "house of cards", "tightrope walker", "rock climber cliff", "slackline walking high", "glass falling slow motion", "stacking cups tower", "balancing on rope"],
};

const out = path.resolve(process.argv[2] ?? "hook-candidates");
const per = Number(process.argv.find((a) => a.startsWith("per="))?.slice(4) ?? 6);
const queriesFile = process.argv.find((a) => a.startsWith("queries="))?.slice(8);
const QUERIES = queriesFile ? JSON.parse(readFileSync(queriesFile, "utf8")) : DEFAULT_QUERIES;
const key = process.env.PIXABAY_API_KEY?.trim();
if (!key) {
  console.error("Set PIXABAY_API_KEY (a free key from https://pixabay.com/api/docs/).");
  process.exit(1);
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const ff = (args) => execFileSync("ffmpeg", ["-nostdin", "-v", "error", "-y", ...args], { stdio: ["ignore", "pipe", "pipe"] }).toString();

async function search(query) {
  const params = new URLSearchParams({ key, q: query, video_type: "film", safesearch: "true", per_page: String(Math.max(3, per)), lang: "en" });
  const response = await fetch(`https://pixabay.com/api/videos/?${params}`);
  if (!response.ok) throw new Error(`Pixabay search failed (${response.status}) for "${query}"`);
  return (await response.json()).hits ?? [];
}

/** The second with the biggest change between frames after the first second: a guess at the climax. */
function suggestedClimaxMs(file) {
  const log = execFileSync("ffmpeg", ["-nostdin", "-v", "error", "-i", file, "-vf", "select='gte(scene,0)',metadata=print:file=-", "-an", "-f", "null", "-"], { stdio: ["ignore", "pipe", "pipe"] }).toString();
  let best = { t: null, score: -1 };
  let t = null;
  for (const line of log.split(/\r?\n/)) {
    const time = line.match(/pts_time:([\d.]+)/);
    if (time) t = Number(time[1]);
    const score = line.match(/lavfi\.scene_score=([\d.]+)/);
    if (score && t !== null && t > 1 && Number(score[1]) > best.score) best = { t, score: Number(score[1]) };
  }
  return best.t === null ? null : Math.round(best.t * 1000);
}

mkdirSync(path.join(out, "clips"), { recursive: true });
const seen = new Set();
const candidates = [];
for (const [type, queries] of Object.entries(QUERIES)) {
  mkdirSync(path.join(out, "strips", type), { recursive: true });
  for (const query of queries) {
    let hits;
    try {
      hits = await search(query);
    } catch (error) {
      console.error(error.message);
      continue;
    }
    await sleep(700);
    for (const hit of hits) {
      if (seen.has(hit.id)) continue;
      seen.add(hit.id);
      const rendition = hit.videos?.tiny?.url ? hit.videos.tiny : hit.videos?.small;
      if (!rendition?.url || !hit.duration || hit.duration < 4 || hit.duration > 40) continue;
      const file = path.join(out, "clips", `${hit.id}.mp4`);
      if (!existsSync(file)) {
        const response = await fetch(rendition.url);
        if (!response.ok) continue;
        writeFileSync(file, Buffer.from(await response.arrayBuffer()));
      }
      const strip = path.join(out, "strips", type, `${hit.id}.png`);
      const fps = 8 / hit.duration;
      ff(["-i", file, "-vf", `fps=${fps},scale=240:-2,tile=8x1:padding=4:color=white`, "-frames:v", "1", strip]);
      const candidate = {
        id: String(hit.id),
        type,
        query,
        tags: (hit.tags ?? "").split(",").map((tag) => tag.trim()).filter(Boolean),
        durationMs: hit.duration * 1000,
        width: hit.videos?.large?.width ?? rendition.width,
        height: hit.videos?.large?.height ?? rendition.height,
        page: hit.pageURL,
        suggestedClimaxMs: suggestedClimaxMs(file),
        strip: path.relative(out, strip).replace(/\\/g, "/"),
      };
      candidates.push(candidate);
      console.log(type, candidate.id, query, `${hit.duration}s`, `climax~${candidate.suggestedClimaxMs}ms`);
    }
  }
}
writeFileSync(path.join(out, "candidates.json"), JSON.stringify(candidates, null, 2));
const rows = candidates
  .map((c) => `<tr><td>${c.type}<br><b>${c.id}</b><br>${(c.durationMs / 1000).toFixed(0)} s · climax ~${c.suggestedClimaxMs ?? "?"} ms<br><a href="${c.page}">page</a><br><small>${c.tags.join(", ")}</small></td><td><img src="${c.strip}" width="1000"></td></tr>`)
  .join("\n");
writeFileSync(path.join(out, "index.html"), `<!doctype html><meta charset="utf-8"><title>Hook clip candidates</title><table border="1" cellpadding="6">${rows}</table>`);
console.log(`${candidates.length} candidates -> ${path.join(out, "index.html")}`);
