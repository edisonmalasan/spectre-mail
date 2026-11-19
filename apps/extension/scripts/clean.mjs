/**
 * Empty the extension's build output before a build writes into it.
 *
 * ## Why this is a script rather than a flag
 *
 * `vite.config.ts` sets `emptyOutDir: false`, and it has to: the popup build and the content-script
 * build write into the same `dist/`, so whichever ran second would delete the other's output. **The
 * cost of that setting is that no build ever removes an artefact a previous build emitted**, and the
 * measurement that made it a defect is recorded in `design.md` D7: a stale `content-script.bundle.js`
 * survived a restored source *and* a correct rebuild beside it, and was read as evidence about a
 * mutation long after it had been built. A store also rejects an archive holding a file the manifest
 * does not name, so the residue is not only a local hazard.
 *
 * **So the clean is one step, before both builds, rather than a flag either build could win.** It is
 * exported as a function with a direct-run guard for the same reason the packager is: a case can call
 * it against a temporary directory and prove it empties one, without any test pointing at `dist/`.
 *
 * **It recreates the directory.** A build that follows writes into a directory that exists, and a
 * missing output directory and an empty one are the same thing to Vite but not to a reader checking
 * whether the step ran.
 *
 * @module
 */

import { mkdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

/** Where `vite build` writes, resolved from this file rather than from the caller's cwd. */
export const DEFAULT_OUTPUT_DIRECTORY = resolve(join(here, "..", "dist"));

/**
 * Remove `directory` and recreate it, empty.
 *
 * @param {string} [directory] the directory to empty; defaults to this client's `dist`.
 * @returns {string} the absolute path that was emptied, so a caller can report it.
 */
export function cleanOutput(directory = DEFAULT_OUTPUT_DIRECTORY) {
  const target = resolve(directory);
  // **`force` because an absent directory is already clean**, and a clean step that failed on a
  // fresh checkout would fail the first build on every machine.
  rmSync(target, { recursive: true, force: true });
  mkdirSync(target, { recursive: true });
  return target;
}

const invokedDirectly =
  process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  const target = cleanOutput(process.argv[2]);
  process.stdout.write(`cleaned ${target}\n`);
}
