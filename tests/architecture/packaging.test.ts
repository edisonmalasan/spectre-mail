/**
 * The release archive, read back by a second instrument.
 *
 * ## Why the reader here is written from scratch
 *
 * `apps/extension/scripts/package.mjs` writes a ZIP, and a test that called that module's own
 * listing function would be a writer checking its own work. **A reader that shares a parser with
 * the writer can report a field the writer put there and call it a finding**, which is the defect
 * this repository records as "a tool that also checks its own work cannot report its own defect".
 * So this file walks the ZIP's central directory from the end, checks every local header's
 * signature, inflates each entry, recomputes its CRC-32 with a second table, and compares the bytes
 * with the file on disk.
 *
 * ## What is read, and what is a fixture
 *
 * The subject is the **packager's output over a built manifest**, not the repository's `dist/`.
 * `pnpm test` runs without a build, and a test that depended on one would pass or fail according to
 * what the last command left in the directory. Every case therefore builds a small extension tree in
 * a temporary directory - a manifest, the files it names, and one nested asset - and packages *that*.
 * **The one command that packages the real build is exercised in the browser tier**, against the
 * artefact a maintainer would actually hand to a store.
 *
 * ## The negative control
 *
 * A reader that found no entries and reported success would satisfy the "every declared file is
 * inside" assertion for ever, because an empty list has no missing members. So one case plants an
 * archive with no end-of-central-directory record and requires the reader to **report that it could
 * not read one**, naming the problem instead of returning an empty list.
 *
 * @module
 */

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";

import {
  PackagingRefusal,
  crc32,
  packageExtension,
} from "../../apps/extension/scripts/package.mjs";
import { DEFAULT_OUTPUT_DIRECTORY, cleanOutput } from "../../apps/extension/scripts/clean.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(join(here, "..", ".."));

/** One fixture tree, built fresh so no case reads another case's residue. */
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "spectre-package-"));
  const dist = join(root, "dist");
  const release = join(root, "release");
  mkdirSync(join(dist, "icons"), { recursive: true });

  const manifest = {
    manifest_version: 3,
    name: "SpectreMail",
    version: "1.2.3",
    background: { service_worker: "service-worker.js", type: "module" },
    action: { default_popup: "popup.html", default_icon: "icons/icon-32.png" },
    side_panel: { default_path: "sidepanel.html" },
    content_scripts: [{ matches: ["https://*/*"], js: ["content-script.js"] }],
    icons: {
      16: "icons/icon-16.png",
      32: "icons/icon-32.png",
      48: "icons/icon-48.png",
      128: "icons/icon-128.png",
    },
  };
  const files = {
    "manifest.json": JSON.stringify(manifest, null, 2),
    "service-worker.js": "// worker\n",
    "popup.html": "<html></html>\n",
    "sidepanel.html": "<html></html>\n",
    "content-script.js": "// content\n",
    "chunks/shared.js": "// a nested asset\n",
    "icons/icon-16.png": "\u0089PNG-16",
    "icons/icon-32.png": "\u0089PNG-32",
    "icons/icon-48.png": "\u0089PNG-48",
    "icons/icon-128.png": "\u0089PNG-128",
  };
  for (const [name, content] of Object.entries(files)) {
    const path = join(dist, name);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content, "utf8");
  }

  return {
    root,
    dist,
    release,
    manifest,
    files,
    package: () => packageExtension({ distDirectory: dist, releaseDirectory: release }),
  };
}

/** A CRC-32 table written here, not imported from the writer. */
const READER_CRC = (() => {
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

function readerCrc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = READER_CRC[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** One entry as the independent reader reports it. */
interface ReadEntry {
  name: string;
  content: Buffer;
  flags: number;
  method: number;
  storedCrc: number;
  computedCrc: number;
  localSignature: number;
}

/** An independent reader. It throws rather than returning an empty answer when it cannot parse. */
function readArchive(bytes) {
  let end = -1;
  for (let index = bytes.length - 22; index >= 0; index--) {
    if (bytes.readUInt32LE(index) === 0x06054b50) {
      end = index;
      break;
    }
  }
  if (end < 0) throw new Error("no end-of-central-directory record");
  if (end + 22 > bytes.length) throw new Error("truncated end-of-central-directory record");

  const count = bytes.readUInt16LE(end + 10);
  const directoryOffset = bytes.readUInt32LE(end + 16);
  if (count === 0) throw new Error("the central directory holds no entries");

  const entries: ReadEntry[] = [];
  let cursor = directoryOffset;
  for (let index = 0; index < count; index++) {
    if (cursor + 46 > bytes.length) throw new Error(`central entry ${index} is truncated`);
    const signature = bytes.readUInt32LE(cursor);
    if (signature !== 0x02014b50) {
      throw new Error(`central entry ${index} has signature 0x${signature.toString(16)}`);
    }
    const flags = bytes.readUInt16LE(cursor + 8);
    const method = bytes.readUInt16LE(cursor + 10);
    const storedCrc = bytes.readUInt32LE(cursor + 16);
    const nameLength = bytes.readUInt16LE(cursor + 28);
    const extraLength = bytes.readUInt16LE(cursor + 30);
    const commentLength = bytes.readUInt16LE(cursor + 32);
    const localOffset = bytes.readUInt32LE(cursor + 42);
    const name = bytes.subarray(cursor + 46, cursor + 46 + nameLength).toString("utf8");
    cursor += 46 + nameLength + extraLength + commentLength;

    if (bytes.readUInt32LE(localOffset) !== 0x04034b50) {
      throw new Error(`${name}: local header signature is not 0x04034b50`);
    }
    const localNameLength = bytes.readUInt16LE(localOffset + 26);
    const localExtraLength = bytes.readUInt16LE(localOffset + 28);
    const compressedSize = bytes.readUInt32LE(localOffset + 18);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = bytes.subarray(dataStart, dataStart + compressedSize);
    const content = method === 8 ? inflateRawSync(compressed) : Buffer.from(compressed);

    entries.push({
      name,
      content,
      flags,
      method,
      storedCrc,
      computedCrc: readerCrc32(content),
      localSignature: bytes.readUInt32LE(localOffset),
    });
  }
  return { entries, count };
}

describe("the extension's release archive", () => {
  it("puts manifest.json at the archive's root, with no folder above any entry", () => {
    const tree = fixture();
    try {
      const { bytes } = tree.package();
      const archive = readArchive(bytes);
      expect(archive.entries[0]?.name).toBe("manifest.json");

      const prefixed = archive.entries
        .map((entry) => entry.name)
        .filter(
          (name) => name.startsWith("dist/") || name.includes("/../") || name.startsWith("/"),
        );
      expect(prefixed, `entries outside the archive root: ${prefixed.join(", ")}`).toEqual([]);
    } finally {
      rmSync(tree.root, { recursive: true, force: true });
    }
  });

  it("carries every filename the built manifest declares, with contents that agree", () => {
    const tree = fixture();
    try {
      const { bytes } = tree.package();
      const archive = readArchive(bytes);
      const byName = new Map(archive.entries.map((entry) => [entry.name, entry]));
      const declared = [
        tree.manifest.background.service_worker,
        tree.manifest.action.default_popup,
        tree.manifest.side_panel.default_path,
        ...tree.manifest.content_scripts.flatMap((script) => script.js),
        ...Object.values(tree.manifest.icons),
        tree.manifest.action.default_icon,
      ];

      const missing = declared.filter((name) => !byName.has(name));
      expect(missing, `declared filenames that are absent: ${missing.join(", ")}`).toEqual([]);

      for (const entry of archive.entries) {
        expect(entry.storedCrc, `${entry.name}: CRC-32 disagrees with its content`).toBe(
          entry.computedCrc,
        );
        expect(entry.flags, `${entry.name}: an unexpected flag is set`).toBe(0);
        expect(
          entry.content.toString("utf8"),
          `${entry.name}: the archive holds different bytes from the build output`,
        ).toBe(tree.files[entry.name]);
      }
    } finally {
      rmSync(tree.root, { recursive: true, force: true });
    }
  });

  it("reads its version from the built manifest rather than carrying one", () => {
    const tree = fixture();
    try {
      const result = tree.package();
      expect(result.version).toBe(tree.manifest.version);
      expect(result.archivePath).toBe(
        join(tree.release, `spectre-mail-${tree.manifest.version}.zip`),
      );
      expect(existsSync(result.archivePath)).toBe(true);

      const archive = readArchive(result.bytes);
      const manifest = JSON.parse(
        archive.entries.find((entry) => entry.name === "manifest.json")?.content.toString("utf8") ??
          "{}",
      );
      expect(manifest.version).toBe(tree.manifest.version);
    } finally {
      rmSync(tree.root, { recursive: true, force: true });
    }
  });

  it("writes the same bytes twice, in an order that does not depend on the filesystem", () => {
    const tree = fixture();
    try {
      const first = tree.package();
      const second = tree.package();
      expect(second.bytes.equals(first.bytes)).toBe(true);
      expect(second.entries.map((entry) => entry.name)).toEqual(first.entries.map((e) => e.name));
      expect(readArchive(second.bytes).entries[0]?.name).toBe("manifest.json");
    } finally {
      rmSync(tree.root, { recursive: true, force: true });
    }
  });

  it("refuses a build that is not there, naming the path it looked for", () => {
    const root = mkdtempSync(join(tmpdir(), "spectre-no-build-"));
    try {
      const missing = join(root, "dist", "manifest.json");
      expect(() =>
        packageExtension({
          distDirectory: join(root, "dist"),
          releaseDirectory: join(root, "release"),
        }),
      ).toThrow(missing);
      expect(existsSync(join(root, "release"))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("refuses a manifest entry point the build did not emit, naming that entry", () => {
    const tree = fixture();
    try {
      rmSync(join(tree.dist, "icons", "icon-48.png"));
      expect(() => tree.package()).toThrow(PackagingRefusal);
      expect(() => tree.package()).toThrow(/icons\/icon-48\.png/);
      expect(existsSync(join(tree.release, `spectre-mail-${tree.manifest.version}.zip`))).toBe(
        false,
      );
    } finally {
      rmSync(tree.root, { recursive: true, force: true });
    }
  });

  it("reports an unreadable central directory rather than an empty archive", () => {
    expect(() => readArchive(Buffer.from("this is not a zip file at all"))).toThrow(
      /no end-of-central-directory record/,
    );
    // **A second arm: an EOCD that claims an entry but carries none.** Without it a reader that
    // returned an empty list for every well-formed-but-empty archive would satisfy the first arm.
    const planted = Buffer.alloc(22);
    planted.writeUInt32LE(0x06054b50, 0);
    planted.writeUInt16LE(1, 8);
    planted.writeUInt16LE(1, 10);
    planted.writeUInt16LE(0, 20);
    expect(() => readArchive(planted)).toThrow(/central entry 0 is truncated/);
  });

  it("the writer's CRC-32 agrees with the independently written reader's", () => {
    const samples = [
      Buffer.from(""),
      Buffer.from("SpectreMail"),
      Buffer.from([0, 1, 2, 253, 254, 255]),
      readFileSync(join(repositoryRoot, "apps", "extension", "static", "manifest.json")),
    ];
    for (const sample of samples) {
      expect(crc32(sample), `CRC-32 disagrees for ${sample.length} bytes`).toBe(
        readerCrc32(sample),
      );
    }
  });
});

describe("the build's clean step", () => {
  it("empties a directory and leaves it ready for a build to write into", () => {
    const root = mkdtempSync(join(tmpdir(), "spectre-clean-"));
    try {
      const stale = join(root, "dist");
      mkdirSync(join(stale, "chunks"), { recursive: true });
      writeFileSync(join(stale, "chunks", "stale.bundle.js"), "// from a previous build\n");
      writeFileSync(join(stale, "content-script.bundle.js"), "// also stale\n");

      const cleaned = cleanOutput(stale);
      expect(cleaned).toBe(resolve(stale));
      expect(existsSync(stale)).toBe(true);
      expect(existsSync(join(stale, "chunks", "stale.bundle.js"))).toBe(false);
      expect(existsSync(join(stale, "content-script.bundle.js"))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("names this client's dist as the default, from this file rather than the cwd", () => {
    expect(DEFAULT_OUTPUT_DIRECTORY).toBe(
      resolve(join(repositoryRoot, "apps", "extension", "dist")),
    );
  });

  it("runs the clean before either build, from the package's own script", () => {
    // **The function working is not the step running.** A case that only called `cleanOutput`
    // would stay green if the `node scripts/clean.mjs` prefix were deleted from `build`, and the
    // stale-artefact defect this step exists to prevent would come back silently. So this case
    // reads the script the maintainer actually runs.
    const extensionPackage = JSON.parse(
      readFileSync(join(repositoryRoot, "apps", "extension", "package.json"), "utf8"),
    );
    const build = String(extensionPackage.scripts?.build ?? "");
    expect(build, "the extension's build script no longer names a clean step").toContain(
      "scripts/clean.mjs",
    );
    expect(build.indexOf("scripts/clean.mjs")).toBeLessThan(build.indexOf("vite build"));
    expect(build).not.toMatch(/vite build[\s\S]*scripts\/clean\.mjs/);
  });
});
