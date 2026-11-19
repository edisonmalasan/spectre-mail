/**
 * Write the extension's built output into one archive a store can accept.
 *
 * ## Why a hand-written ZIP writer
 *
 * A store takes a ZIP, and this repository has no archiver dependency. `node:zlib` already ships the
 * only hard part - DEFLATE - and a ZIP of this shape is three records written in order. **A
 * dependency would be a production-shaped tool in the release path that nobody here reviews, for a
 * format whose failure modes are all silent**: a top-level folder, a manifest one directory down, or
 * a named entry point the archive does not carry each look like a successful submission until a
 * store rejects them. So the writer is here, small enough to read, and `tests/architecture/
 * packaging.test.ts` reads its output back with a **second, independently written** reader.
 *
 * ## Determinism is a feature and not a nicety
 *
 * Two runs over unchanged build output produce **the same bytes**. That is what lets a maintainer
 * ask the only question an artefact answers: *did this rebuild change anything?* Everything that
 * could vary is fixed - entry order is the sorted names with `manifest.json` first, and the
 * timestamp is the earliest a ZIP can express rather than the clock. **The timestamp is not
 * "today"**: a byte that moves every run is the defect this paragraph exists to prevent.
 *
 * ## What it refuses, and why refusing is the point
 *
 * - **No build output**: it names the path it looked for, rather than writing an empty archive.
 * - **A filename the manifest declares and the build did not emit**: it names the entry. A store
 *   would reject that archive, and a reader would have to work out which file was missing.
 *
 * **It packages `dist/` itself, not a directory above it.** Every stored path is relative to the
 * output directory, so `manifest.json` sits at the archive's root - which is what a store requires
 * and what a `dist/` prefix silently breaks.
 *
 * **The version is read from the built manifest and typed nowhere else.** A version in this command
 * or in a second file would be the second spelling of a set, and the two would disagree the first
 * time a release was cut.
 *
 * @module
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateRawSync } from "node:zlib";

const here = dirname(fileURLToPath(import.meta.url));

/** Where `vite build` writes, resolved from this file rather than from the caller's cwd. */
export const DEFAULT_DIST_DIRECTORY = resolve(join(here, "..", "dist"));

/** Where the archive is written. Ignored by Git; see `.gitignore`. */
export const DEFAULT_RELEASE_DIRECTORY = resolve(join(here, "..", "release"));

/**
 * Raised for a condition the caller should report rather than repair, so a test can assert the
 * *message* names the thing at fault.
 */
export class PackagingRefusal extends Error {
  constructor(message) {
    super(message);
    this.name = "PackagingRefusal";
  }
}

/** The CRC-32 table, built once. Polynomial 0xEDB88320, as the ZIP format specifies. */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index++) {
    let value = index;
    for (let bit = 0; bit < 8; bit++) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

/** The CRC-32 of `bytes`, matching the value a ZIP entry's headers carry. */
export function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Every filename the manifest names literally.
 *
 * **A manifest can name a file in six places, and all six matter.** A background worker, a popup, a
 * side panel, a content script, an icon and a toolbar icon are each loaded by literal filename at
 * runtime, so an archive missing one is an extension that loads and then fails in a way the archive
 * cannot report. The list is derived from the manifest rather than written here, so a key added to
 * the manifest is covered by existing rather than by remembering.
 *
 * **A value that is not a string is skipped rather than reported here.** `action.default_icon` may
 * legally be an object keyed by size; `icons` is already read value by value, so an object there
 * would be a shape this build does not ship. The browser tier asserts the shape; this function's
 * subject is only *the literal files a store would look for*.
 */
export function manifestEntryPoints(manifest) {
  const names = new Set();
  const add = (value) => {
    if (typeof value === "string" && value.length > 0) names.add(value);
  };

  add(manifest.background?.service_worker);
  add(manifest.action?.default_popup);
  add(manifest.side_panel?.default_path);

  for (const script of manifest.content_scripts ?? []) {
    for (const file of script.js ?? []) add(file);
    for (const file of script.css ?? []) add(file);
  }

  for (const value of Object.values(manifest.icons ?? {})) add(value);

  const defaultIcon = manifest.action?.default_icon;
  if (typeof defaultIcon === "string") {
    add(defaultIcon);
  } else if (defaultIcon && typeof defaultIcon === "object") {
    for (const value of Object.values(defaultIcon)) add(value);
  }

  return [...names].sort();
}

/** Every regular file under `root`, as paths relative to it with forward slashes, sorted. */
function walk(root, current = root, found = []) {
  for (const name of readdirSync(current).sort()) {
    const path = join(current, name);
    const stats = statSync(path);
    if (stats.isDirectory()) {
      walk(root, path, found);
    } else if (stats.isFile()) {
      found.push(relative(root, path).split(sep).join("/"));
    }
  }
  return found;
}

const DOS_DATE_1980_01_01 = 0x0021;
const DOS_TIME_MIDNIGHT = 0x0000;

/**
 * Build the archive's bytes from a directory of files.
 *
 * **`manifest.json` is forced to the front** rather than sorting first. It happens to sort after
 * `icons/…` and before `popup.html`, so a sorted order would put a store's most important file
 * second. The format does not require it; a reader looking at an archive listing does.
 */
export function buildArchive(distDirectory) {
  const names = walk(distDirectory);
  const ordered = [
    ...names.filter((name) => name === "manifest.json"),
    ...names.filter((name) => name !== "manifest.json"),
  ];

  if (ordered.length === 0 || ordered[0] !== "manifest.json") {
    throw new PackagingRefusal(`${join(distDirectory, "manifest.json")} is not there`);
  }

  const localChunks = [];
  const centralChunks = [];
  let offset = 0;

  for (const name of ordered) {
    const bytes = readFileSync(join(distDirectory, name));
    const deflated = deflateRawSync(bytes, { level: 9 });
    // **Stored when DEFLATE would grow the file**, which is the normal outcome for a PNG that is
    // already compressed. The rule is a comparison rather than a list of extensions, so a new
    // already-compressed asset is stored without anyone deciding it should be.
    const method = deflated.length < bytes.length ? 8 : 0;
    const payload = method === 8 ? deflated : bytes;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(DOS_TIME_MIDNIGHT, 10);
    local.writeUInt16LE(DOS_DATE_1980_01_01, 12);
    local.writeUInt32LE(crc32(bytes), 14);
    local.writeUInt32LE(payload.length, 18);
    local.writeUInt32LE(bytes.length, 22);
    local.writeUInt16LE(Buffer.byteLength(name, "utf8"), 26);
    local.writeUInt16LE(0, 28);

    localChunks.push(local, Buffer.from(name, "utf8"), payload);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt16LE(DOS_TIME_MIDNIGHT, 12);
    central.writeUInt16LE(DOS_DATE_1980_01_01, 14);
    central.writeUInt32LE(crc32(bytes), 16);
    central.writeUInt32LE(payload.length, 20);
    central.writeUInt32LE(bytes.length, 24);
    central.writeUInt16LE(Buffer.byteLength(name, "utf8"), 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);

    centralChunks.push(central, Buffer.from(name, "utf8"));

    offset += local.length + Buffer.byteLength(name, "utf8") + payload.length;
  }

  const local = Buffer.concat(localChunks);
  const central = Buffer.concat(centralChunks);

  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(ordered.length, 8);
  end.writeUInt16LE(ordered.length, 10);
  end.writeUInt32LE(central.length, 12);
  end.writeUInt32LE(local.length, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([local, central, end]);
}

/**
 * Package the built extension.
 *
 * @param {{distDirectory?: string, releaseDirectory?: string}} [options]
 * @returns {{archivePath: string, version: string, entries: string[], bytes: Buffer}}
 */
export function packageExtension(options = {}) {
  const distDirectory = resolve(options.distDirectory ?? DEFAULT_DIST_DIRECTORY);
  const releaseDirectory = resolve(options.releaseDirectory ?? DEFAULT_RELEASE_DIRECTORY);

  const manifestPath = join(distDirectory, "manifest.json");
  if (!existsSync(manifestPath)) {
    throw new PackagingRefusal(
      `${manifestPath} is not there; build the extension before packaging it`,
    );
  }

  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const version = manifest.version;
  if (typeof version !== "string" || !/^[0-9A-Za-z.+-]+$/.test(version)) {
    throw new PackagingRefusal(
      `${manifestPath} declares version ${JSON.stringify(version)}, which cannot name an archive`,
    );
  }

  // **Every named entry point collected before anything is reported**, so an archive missing two
  // files says so once. The two lists are separate because the repair differs: a missing build
  // output is `pnpm build`, and a missing named file is a manifest that disagrees with the build.
  const absent = manifestEntryPoints(manifest).filter(
    (name) => !existsSync(join(distDirectory, name)),
  );
  if (absent.length > 0) {
    throw new PackagingRefusal(
      `the manifest names files the build did not emit: ${absent.map((name) => `${name} (${join(distDirectory, name)})`).join(", ")}`,
    );
  }

  const bytes = buildArchive(distDirectory);
  mkdirSync(releaseDirectory, { recursive: true });
  const archivePath = join(releaseDirectory, `spectre-mail-${version}.zip`);
  writeFileSync(archivePath, bytes);

  return {
    archivePath,
    version,
    entries: listArchiveEntryNames(bytes),
    bytes,
  };
}

/**
 * The entry names in an archive this module wrote.
 *
 * **This is a listing, not a verifier, and the distinction is load-bearing**: it reads the central
 * directory so the command can print what it packaged, and it shares no code with
 * `tests/architecture/packaging.test.ts`'s reader. A verifier that lived here would be the writer
 * checking its own work, which is the defect the test's independence exists to avoid.
 */
function listArchiveEntryNames(bytes) {
  const end = findEndOfCentralDirectory(bytes);
  const count = bytes.readUInt16LE(end + 10);
  const directoryOffset = bytes.readUInt32LE(end + 16);
  const names = [];
  let cursor = directoryOffset;
  for (let index = 0; index < count; index++) {
    if (bytes.readUInt32LE(cursor) !== 0x02014b50) break;
    const nameLength = bytes.readUInt16LE(cursor + 28);
    const extraLength = bytes.readUInt16LE(cursor + 30);
    const commentLength = bytes.readUInt16LE(cursor + 32);
    names.push(bytes.subarray(cursor + 46, cursor + 46 + nameLength).toString("utf8"));
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return names;
}

function findEndOfCentralDirectory(bytes) {
  for (let index = bytes.length - 22; index >= 0; index--) {
    if (bytes.readUInt32LE(index) === 0x06054b50) return index;
  }
  throw new PackagingRefusal("the archive carries no end-of-central-directory record");
}

/** `sha256:<hex>`, so a printed digest is comparable with another run's. */
export function digestOf(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

const invokedDirectly =
  process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  try {
    const { archivePath, version, entries, bytes } = packageExtension();
    process.stdout.write(
      `packaged ${entries.length} files as version ${version}\n${archivePath}\n${digestOf(bytes)}\n`,
    );
  } catch (error) {
    if (error instanceof PackagingRefusal) {
      process.stderr.write(`refusing to package: ${error.message}\n`);
      process.exitCode = 1;
    } else {
      throw error;
    }
  }
}
