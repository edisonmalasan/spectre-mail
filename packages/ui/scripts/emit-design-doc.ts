/**
 * Write the generated region of `docs/DESIGN_SYSTEM.md`.
 *
 * ## Why this script is almost nothing
 *
 * Because the work is `renderDesignDoc()` and `replaceGeneratedRegion()`, both of which live
 * in `packages/ui/src/design-doc.ts`, and both of which are pure. Keeping the logic there is
 * what lets `design-doc.test.ts` import it without side effects — see that file's note on a
 * suite that used to rewrite the document it was checking.
 *
 * ## Why it exists beside `emit-tokens.ts` rather than inside it
 *
 * Because they are different consumers of a different file, and merging them would put a
 * documentation step on the path that produces a stylesheet. `emit-tokens.ts` is a generator
 * whose output is asserted byte-for-byte by a test; this is a maintainer's command, run by
 * hand when a design value changes. **It is deliberately not wired into `verify`**, so a
 * documentation edit can never fail a build.
 *
 * ## What it refuses to do
 *
 * **It refuses to invent a document that does not exist.** If `docs/DESIGN_SYSTEM.md` is
 * absent, it says so and writes nothing. A generated document whose prose is a placeholder is
 * worse than no document, because it reads as a design contract.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { renderDesignDoc, replaceGeneratedRegion } from "../src/design-doc.ts";

/** The package root, resolved from this file rather than from the process's cwd. */
const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** The document, relative to the repository root. */
const DOC_PATH = join(PACKAGE_ROOT, "..", "..", "docs", "DESIGN_SYSTEM.md");

if (!existsSync(DOC_PATH)) {
  console.error(`No ${DOC_PATH}. Create the document before running the emitter.`);
  process.exit(1);
}

const current = readFileSync(DOC_PATH, "utf8");
const next = replaceGeneratedRegion(current, renderDesignDoc());

if (next === current) {
  console.log("docs/DESIGN_SYSTEM.md is already current.");
} else {
  writeFileSync(DOC_PATH, next, "utf8");
  console.log("Wrote the generated region of docs/DESIGN_SYSTEM.md.");
}
