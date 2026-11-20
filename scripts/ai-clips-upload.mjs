#!/usr/bin/env node
/**
 * Puts checked AI hook clips (scripts/ai-clips.mjs) into the video bucket's
 * shared folder, at shared/ai-clips/<id>.mp4 (footage/ai-library.ts
 * aiClipPath), where the app finds them by id. Run once per batch, before the
 * clips are added to AI_HOOK_LIBRARY and deployed.
 *
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     node scripts/ai-clips-upload.mjs <clip-dir> <id> [<id> ...]
 *   node scripts/ai-clips-upload.mjs <clip-dir> --local <id> ...   (a developer's
 *     machine without Supabase: copies to public/dev-video-files/, like the app)
 *
 * Never overwrites a stored clip (a video may already use it): an id already
 * there is reported and left alone. Keys are read from the environment and
 * never printed.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

const BUCKET = "video-files";
const args = process.argv.slice(2);
const local = args.includes("--local");
const [dir, ...ids] = args.filter((a) => a !== "--local");
if (!dir || ids.length === 0) {
  console.error("Usage: node scripts/ai-clips-upload.mjs <clip-dir> [--local] <id> [<id> ...]");
  process.exit(1);
}
const clipPath = (id) => `shared/ai-clips/${id}.mp4`;
for (const id of ids) {
  if (!/^\d{4}-\d{2}-\d{2}-[a-z0-9-]+$/.test(id)) throw new Error(`Not a clip id: ${id}`);
  if (!existsSync(path.join(dir, `${id}.mp4`))) throw new Error(`No ${id}.mp4 in ${dir}`);
}

if (local) {
  for (const id of ids) {
    const target = path.join("public", "dev-video-files", ...clipPath(id).split("/"));
    mkdirSync(path.dirname(target), { recursive: true });
    if (existsSync(target)) {
      console.log(`${id}: already there`);
      continue;
    }
    copyFileSync(path.join(dir, `${id}.mp4`), target);
    console.log(`${id}: copied`);
  }
  process.exit(0);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
const bucket = createClient(url, key, { auth: { persistSession: false } }).storage.from(BUCKET);
for (const id of ids) {
  const { error } = await bucket.upload(clipPath(id), readFileSync(path.join(dir, `${id}.mp4`)), { contentType: "video/mp4", upsert: false });
  if (error && /exists|duplicate/i.test(error.message)) console.log(`${id}: already there`);
  else if (error) throw new Error(`${id}: ${error.message.split(key).join("[key]")}`);
  else console.log(`${id}: stored -> ${bucket.getPublicUrl(clipPath(id)).data.publicUrl}`);
}
