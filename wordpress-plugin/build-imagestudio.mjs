/**
 * Packages the Image Studio plugin for upload in WordPress:
 *
 *   node wordpress-plugin/build-imagestudio.mjs
 *
 * Writes wordpress-plugin/releases/imagestudio-blog-<version>.zip, with ONE
 * top-level folder (imagestudio-blog/), as WordPress expects. Not public/:
 * this plugin is for one customer's site and is handed over, not served.
 * Text files are packaged with LF line endings, as in build.mjs.
 */
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateRawSync } from "node:zlib";

const here = dirname(fileURLToPath(import.meta.url));
const source = join(here, "imagestudio-blog");

function normalize(rel, data) {
  return /\.(php|txt|md|css|js|json)$/i.test(rel) ? Buffer.from(data.toString("utf8").replace(/\r\n/g, "\n"), "utf8") : data;
}

function collect(dir, prefix = "") {
  const out = [];
  for (const name of readdirSync(dir).sort()) {
    const full = join(dir, name);
    const rel = prefix ? `${prefix}/${name}` : name;
    if (statSync(full).isDirectory()) out.push(...collect(full, rel));
    else out.push({ path: `imagestudio-blog/${rel}`, data: normalize(rel, readFileSync(full)) });
  }
  return out;
}

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
  local.writeUInt16LE(8, 8); // deflate
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(deflated.length, 18);
  local.writeUInt32LE(file.data.length, 22);
  local.writeUInt16LE(name.length, 26);
  chunks.push(local, name, deflated);
  const entry = Buffer.alloc(46);
  entry.writeUInt32LE(0x02014b50, 0);
  entry.writeUInt16LE(20, 4);
  entry.writeUInt16LE(20, 6);
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

const plugin = normalize("x.php", readFileSync(join(source, "imagestudio-blog.php"))).toString("utf8");
const version = /^[ \t/*#@]*Version:(.*)$/mi.exec(plugin)?.[1].trim();
const constant = /define\('ISB_VERSION',\s*'([^']+)'\)/.exec(plugin)?.[1];
if (!version || version !== constant) {
  throw new Error(`Version header (${version}) and ISB_VERSION (${constant}) must match`);
}

const outDir = join(here, "releases");
mkdirSync(outDir, { recursive: true });
const outFile = join(outDir, `imagestudio-blog-${version}.zip`);
writeFileSync(outFile, Buffer.concat([...chunks, centralBuf, end]));
console.log(`${outFile}: ${files.length} files`);
