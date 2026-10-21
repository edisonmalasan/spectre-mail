import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

/**
 * A fingerprint of a tree: every file's relative path and its content's hash.
 *
 * **The fingerprint is taken programmatically and compared programmatically.** A digest a reader
 * typed by hand once reported a file as differing that `git status` never listed as modified, and
 * **that is the reason the repository compares against Git rather than against a remembered
 * value** -- a remembered value is a value nothing has checked.
 */

/** The directories that are not the tree: dependencies, build output, and the corpus's own copy. */
export const EXCLUDED_DIRECTORIES = new Set([
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".vite",
  "test-results",
  ".git",
]);

/** Every file under `root`, as `relative path -> content hash`, skipping the excluded directories. */
export function fingerprintTree(root: string): Map<string, string> {
  const found = new Map<string, string>();
  const walk = (directory: string): void => {
    for (const entry of readdirSync(directory)) {
      if (EXCLUDED_DIRECTORIES.has(entry)) continue;
      const absolute = join(directory, entry);
      const stat = statSync(absolute);
      if (stat.isDirectory()) {
        walk(absolute);
      } else if (stat.isFile()) {
        found.set(relative(root, absolute).split(sep).join("/"), hashFile(absolute));
      }
    }
  };
  walk(root);
  return found;
}

/** A file's content hash. */
export function hashFile(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

/** The paths that differ between two fingerprints, by kind, and named. */
export interface TreeDifference {
  readonly added: readonly string[];
  readonly removed: readonly string[];
  readonly changed: readonly string[];
}

/**
 * What changed between two fingerprints.
 *
 * **The paths are named, and not counted.** A count is satisfied by one file changing twice, and
 * the repository's own rule is that a finding is a thing named.
 */
export function differenceBetween(
  before: Map<string, string>,
  after: Map<string, string>,
): TreeDifference {
  const added: string[] = [];
  const removed: string[] = [];
  const changed: string[] = [];
  for (const [path, hash] of after) {
    const was = before.get(path);
    if (was === undefined) added.push(path);
    else if (was !== hash) changed.push(path);
  }
  for (const path of before.keys()) {
    if (!after.has(path)) removed.push(path);
  }
  return { added: added.sort(), removed: removed.sort(), changed: changed.sort() };
}
