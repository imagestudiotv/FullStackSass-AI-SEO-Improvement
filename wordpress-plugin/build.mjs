/**
 * Packages the plugin as a zip for customers to upload.
 *
 *   npm run plugin:build
 *
 * The zip must contain ONE top-level folder named after the plugin — WordPress
 * unpacks it straight into wp-content/plugins, so a zip of loose files
 * installs as garbage.
 *
 * Output goes to public/ so the app can serve it directly - and, next to the
 * zip, public/repget-connector.json: the manifest plugin 1.7.0+ reads to offer
 * updates inside WordPress (see "Updates" at the end of repget-connector.php
 * and in docs/wordpress-connect.md). The manifest carries the zip's SHA-256,
 * and the plugin refuses a download that does not match it, so the two files
 * must always be written together - which is why one script writes both.
 */
import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateRawSync } from "node:zlib";

const here = dirname(fileURLToPath(import.meta.url));
const source = join(here, "repget-connector");
const outDir = join(here, "..", "public");
const outFile = join(outDir, "repget-connector.zip");
const manifestFile = join(outDir, "repget-connector.json");

/**
 * Text files are packaged with LF line endings, exactly as git stores them.
 * A Windows checkout (core.autocrlf) has CRLF in the working tree, so a zip
 * built there used to differ from the source CI tests on Linux.
 */
function normalize(rel, data) {
  return /\.(php|txt|md|css|js|json)$/i.test(rel) ? Buffer.from(data.toString("utf8").replace(/\r\n/g, "\n"), "utf8") : data;
}

/** Files to include, relative to the plugin folder. */
function collect(dir, prefix = "") {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const rel = prefix ? `${prefix}/${name}` : name;
    if (statSync(full).isDirectory()) out.push(...collect(full, rel));
    else out.push({ path: `repget-connector/${rel}`, data: normalize(rel, readFileSync(full)) });
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

/* ------------------------------------------------------------ manifest --- */

/** A plugin-header field ("Version: 1.7.0"), read the way WordPress reads it: the first match. */
function headerField(text, name) {
  const match = new RegExp(`^[ \\t/*#@]*${name}:(.*)$`, "mi").exec(text);
  return match ? match[1].trim() : "";
}

/** The changelog entry for `version` in readme.txt: the lines under "= <version> =". */
function changelogFor(readme, version) {
  const lines = readme.split("\n");
  const start = lines.findIndex((line) => line.trim() === `= ${version} =`);
  if (start < 0) return "";
  const out = [];
  for (const line of lines.slice(start + 1)) {
    if (/^\s*=+ .* =+\s*$/.test(line)) break;
    out.push(line);
  }
  return out.join("\n").trim();
}

const pluginText = normalize("x.php", readFileSync(join(source, "repget-connector.php"))).toString("utf8");
const readmeText = normalize("x.txt", readFileSync(join(source, "readme.txt"))).toString("utf8");

const version = headerField(pluginText, "Version");
const defined = /define\('REPGET_VERSION',\s*'([^']+)'\)/.exec(pluginText)?.[1] ?? "";
const stable = headerField(readmeText, "Stable tag");
const changelog = changelogFor(readmeText, version);

/*
  Refuse to package a plugin that disagrees with itself. The manifest's
  version is what WordPress compares against the INSTALLED plugin's header:
  a header bumped without REPGET_VERSION (or the other way round) would
  either never be offered or be offered again after every update.
*/
const problems = [];
if (!/^\d+(\.\d+){0,3}$/.test(version)) problems.push(`plugin header Version "${version}" is not a plain version number`);
if (defined !== version) problems.push(`REPGET_VERSION "${defined}" does not match the header Version "${version}"`);
if (stable !== version) problems.push(`readme Stable tag "${stable}" does not match the header Version "${version}"`);
if (!changelog) problems.push(`readme.txt has no changelog entry "= ${version} ="`);
if (problems.length > 0) {
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}

const zip = Buffer.concat([...chunks, centralBuf, end]);
const manifest = {
  version,
  // Relative: the plugin resolves it against its own endpoint, so staging
  // and production each serve their own zip.
  package: "/repget-connector.zip",
  sha256: createHash("sha256").update(zip).digest("hex"),
  requires: headerField(pluginText, "Requires at least"),
  requires_php: headerField(pluginText, "Requires PHP"),
  tested: headerField(readmeText, "Tested up to"),
  changelog,
};

mkdirSync(outDir, { recursive: true });
writeFileSync(outFile, zip);
writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`  ${files.length} file(s) -> public/repget-connector.zip`);
for (const f of files) console.log(`    ${f.path}`);
console.log(`  version ${manifest.version}, sha256 ${manifest.sha256} -> public/repget-connector.json`);
