/**
 * Packages the plugin as a zip for customers to upload.
 *
 *   npm run plugin:build
 *
 * The zip must contain ONE top-level folder named after the plugin — WordPress
 * unpacks it straight into wp-content/plugins, so a zip of loose files
 * installs as garbage.
 *
 * Output goes to public/ so the app can serve it directly.
 */
import { createWriteStream, mkdirSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateRawSync } from "node:zlib";

const here = dirname(fileURLToPath(import.meta.url));
const source = join(here, "seovision-connector");
const outDir = join(here, "..", "public");
const outFile = join(outDir, "seovision-connector.zip");

/** Files to include, relative to the plugin folder. */
function collect(dir, prefix = "") {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const rel = prefix ? `${prefix}/${name}` : name;
    if (statSync(full).isDirectory()) out.push(...collect(full, rel));
    else out.push({ path: `seovision-connector/${rel}`, data: readFileSync(full) });
  }
  return out;
}

/**
 * Minimal zip writer. A dependency for this would be a supply-chain risk on a
 * file customers install into their own site, and the format is small enough
 * to write correctly: local headers, central directory, end record.
 */
function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = (crc ^ buf[i]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const files = collect(source);
const chunks = [];
const central = [];
let offset = 0;

for (const file of files) {
  const name = Buffer.from(file.path, "utf8");
  const deflated = deflateRawSync(file.data);
  const crc = crc32(file.data);

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0, 6);
  local.writeUInt16LE(8, 8); // deflate
  local.writeUInt16LE(0, 10);
  local.writeUInt16LE(0, 12);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(deflated.length, 18);
  local.writeUInt32LE(file.data.length, 22);
  local.writeUInt16LE(name.length, 26);
  local.writeUInt16LE(0, 28);

  chunks.push(local, name, deflated);

  const entry = Buffer.alloc(46);
  entry.writeUInt32LE(0x02014b50, 0);
  entry.writeUInt16LE(20, 4);
  entry.writeUInt16LE(20, 6);
  entry.writeUInt16LE(0, 8);
  entry.writeUInt16LE(8, 10);
  entry.writeUInt32LE(crc, 16);
  entry.writeUInt32LE(deflated.length, 20);
  entry.writeUInt32LE(file.data.length, 24);
  entry.writeUInt16LE(name.length, 28);
  entry.writeUInt32LE(offset, 42);
  central.push(entry, name);

  offset += local.length + name.length + deflated.length;
}

const centralBuf = Buffer.concat(central);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(files.length, 8);
end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(centralBuf.length, 12);
end.writeUInt32LE(offset, 16);

mkdirSync(outDir, { recursive: true });
const stream = createWriteStream(outFile);
stream.write(Buffer.concat([...chunks, centralBuf, end]));
stream.end();

console.log(`  ${files.length} file(s) -> public/seovision-connector.zip`);
for (const f of files) console.log(`    ${f.path}`);
