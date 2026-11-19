/**
 * The packaged archive, loaded as an extension in a real Chromium.
 *
 * ## Why this case exists when `packaging.test.ts` already reads the archive
 *
 * That file proves the ZIP is *well formed* and holds the bytes the build emitted. Neither of those
 * is what a store accepts: Chromium loads a directory, not a ZIP, and the question that matters is
 * whether the archive's contents **still load as an extension once extracted**. A writer and its
 * reader can agree on a perfectly structured archive with a manifest one directory too deep, and
 * only Chromium answers that.
 *
 * **A green run establishes that the extracted contents load and the popup renders the product's
 * name.** It does not establish that a store accepted an upload, that the archive is signed, or that
 * a person saw a listing — all three need an account this repository does not have.
 *
 * ## Why the extractor is written here
 *
 * The archive is read by this spec's own central-directory reader rather than by the packager's
 * own listing, for the reason `packaging.test.ts` gives: a reader that shares code with the writer
 * cannot report the writer's own defect. **The two readers are deliberately separate**, and a
 * disagreement between them would be a finding rather than an inconvenience.
 *
 * @module
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateRawSync } from "node:zlib";

import { expect, test, chromium } from "@playwright/test";

import { PRODUCT_NAME } from "@spectre-mail/ui";
import { extensionFlags } from "../playwright.config";

const here = dirname(fileURLToPath(import.meta.url));
const extensionRoot = resolve(join(here, ".."));

/** One extracted entry: a path relative to the archive root and the bytes it holds. */
interface ExtractedEntry {
  name: string;
  content: Buffer;
}

function extract(bytes: Buffer): ExtractedEntry[] {
  let end = -1;
  for (let index = bytes.length - 22; index >= 0; index--) {
    if (bytes.readUInt32LE(index) === 0x06054b50) {
      end = index;
      break;
    }
  }
  if (end < 0) throw new Error("the archive has no end-of-central-directory record");

  const count = bytes.readUInt16LE(end + 10);
  let cursor = bytes.readUInt32LE(end + 16);
  const entries: ExtractedEntry[] = [];
  for (let index = 0; index < count; index++) {
    if (bytes.readUInt32LE(cursor) !== 0x02014b50) throw new Error(`bad central entry ${index}`);
    const method = bytes.readUInt16LE(cursor + 10);
    const compressedSize = bytes.readUInt32LE(cursor + 20);
    const nameLength = bytes.readUInt16LE(cursor + 28);
    const extraLength = bytes.readUInt16LE(cursor + 30);
    const commentLength = bytes.readUInt16LE(cursor + 32);
    const localOffset = bytes.readUInt32LE(cursor + 42);
    const name = bytes.subarray(cursor + 46, cursor + 46 + nameLength).toString("utf8");
    cursor += 46 + nameLength + extraLength + commentLength;

    if (bytes.readUInt32LE(localOffset) !== 0x04034b50)
      throw new Error(`${name}: bad local header`);
    const localNameLength = bytes.readUInt16LE(localOffset + 26);
    const localExtraLength = bytes.readUInt16LE(localOffset + 28);
    const start = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = bytes.subarray(start, start + compressedSize);
    entries.push({
      name,
      content: method === 8 ? inflateRawSync(compressed) : Buffer.from(compressed),
    });
  }
  return entries;
}

test("the packaged archive loads as an extension and renders the product's name", async () => {
  const scratch = mkdtempSync(join(tmpdir(), "spectre-packaged-"));
  let context: Awaited<ReturnType<typeof chromium.launchPersistentContext>> | undefined;

  try {
    // **Run the command, not the exported function.** The requirement names a command a maintainer
    // types, and the package script is the thing that has to resolve; calling the module directly
    // would leave a broken `scripts.package` entry green here.
    const output = execFileSync(process.execPath, [join(extensionRoot, "scripts", "package.mjs")], {
      cwd: extensionRoot,
      encoding: "utf8",
    });
    const archivePath = output
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.endsWith(".zip"));
    expect(archivePath, `the packaging command named no archive: ${output}`).toBeDefined();
    expect(existsSync(archivePath ?? "")).toBe(true);

    const entries = extract(readFileSync(archivePath ?? ""));
    expect(entries[0]?.name, "manifest.json must sit at the archive's root").toBe("manifest.json");
    const manifest = JSON.parse(entries[0]?.content.toString("utf8") ?? "{}");
    expect(manifest.name).toBe(PRODUCT_NAME);

    // **Extract under the scratch directory, not over the repository's `dist/`.** A test that
    // overwrote the build would change the subject of every other spec in this tier.
    const unpacked = join(scratch, "unpacked");
    mkdirSync(unpacked, { recursive: true });
    for (const entry of entries) {
      // **Refuse a path that escapes the extraction root**, because a store would refuse one too
      // and a test that wrote outside its scratch directory would leave residue behind.
      const target = resolve(unpacked, entry.name);
      expect(
        target.startsWith(`${resolve(unpacked)}${sep}`),
        `${entry.name} escapes the archive root`,
      ).toBe(true);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, entry.content);
    }
    expect(existsSync(join(unpacked, "manifest.json"))).toBe(true);
    expect(existsSync(join(unpacked, "popup.html"))).toBe(true);

    context = await chromium.launchPersistentContext(join(scratch, "profile"), {
      channel: "chromium",
      args: extensionFlags(unpacked),
      timeout: 30_000,
    });

    // **Read the id from Chromium's own registration, as the tier's helper does.** A hard-coded id
    // would be a second spelling of a value only the platform knows.
    let extensionId: string | undefined;
    for (let attempt = 0; attempt < 60 && extensionId === undefined; attempt++) {
      const found = context
        .serviceWorkers()
        .find((candidate) => candidate.url().startsWith("chrome-extension://"));
      if (found) {
        extensionId = new URL(found.url()).host;
        break;
      }
      await new Promise((done) => setTimeout(done, 100));
    }
    expect(extensionId, "Chromium registered no worker from the packaged archive").toBeDefined();

    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await expect(page.getByRole("heading", { name: PRODUCT_NAME })).toBeVisible();
  } finally {
    await context?.close();
    rmSync(scratch, { recursive: true, force: true });
  }
});
