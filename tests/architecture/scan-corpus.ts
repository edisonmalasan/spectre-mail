import { join, relative } from "node:path";

/**
 * The corpus the architecture suites read, and the tree they must never write.
 *
 * ## Why the suites read a copy
 *
 * **The boundary suite proves its rules by mutating files, and the two it mutates are shipped
 * files** -- `apps/web/index.html` and the repository's own `package.json`. The mutation is undone
 * in a `finally`, **and a `finally` does not run in a process that was killed for exceeding its
 * timeout.** Measured, an interrupted run left the website's markup carrying an injected `<link>`
 * and the root manifest carrying a stray `scripts` entry, **both tracked files**, and the next run
 * was then red about them.
 *
 * **So the suite reads a copy, and the shipped tree is never written.** The copy is made once per
 * test run, by the vitest `globalSetup`, and its path is published in the environment.
 *
 * ## Why a copy rather than a set of roots
 *
 * **The rules take no argument about which apps to scan** -- the repository's own recorded reason
 * is that an argument *would be a second spelling of which apps to scan*. **One shared binding is
 * not a second spelling**, and the binding here is this module's.
 *
 * ## And the copy holds no staged probe
 *
 * **The setup removes every vocabulary name from the copy**, so a probe left behind by an earlier
 * run is not in the corpus and no rule ever sees it. **That is what makes a leftover harmless** --
 * and it needs no rule to know which probes are leftovers, and no state a killed process could leave
 * behind.
 */

/** The shipped repository: the tree the suites must not modify. */
export const SHIPPED_ROOT = process.cwd();

/** Where the global setup published the copy, or the shipped tree if there is none. */
const CORPUS_ROOT = process.env.SPECTRE_CORPUS_ROOT ?? SHIPPED_ROOT;

/** The corpus the rules read. */
export function corpusRoot(): string {
  return CORPUS_ROOT;
}

/**
 * The path in the corpus that corresponds to a path in the shipped tree.
 *
 * **A corpus makes an absolute path meaningless**, and one comparison in the boundary suite was an
 * absolute one: *"this file necessarily contains the identifiers as string literals"* was decided by
 * `file === __filename`. **In the corpus the scanned path and the running file's path have different
 * roots**, so the identity failed and the rule reported the corpus's own copy of the test file.
 *
 * **The repair is to compare in the corpus's terms**, and this is the mapping that makes it
 * possible.
 */
export function corpusPathOf(shippedPath: string): string {
  return join(CORPUS_ROOT, relative(SHIPPED_ROOT, shippedPath));
}

/**
 * The packages directory, in the corpus.
 *
 * **Every rule reads its roots from here**, so there is exactly one list of them.
 */
export const PACKAGES_DIR = join(CORPUS_ROOT, "packages");

/**
 * The apps directory, in the corpus.
 */
export const APPS_DIR = join(CORPUS_ROOT, "apps");

/**
 * The corpus root, for the rules that walk everything.
 */
export const CORPUS = CORPUS_ROOT;
