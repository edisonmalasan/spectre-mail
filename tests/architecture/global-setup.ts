import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { EXCLUDED_DIRECTORIES, differenceBetween, fingerprintTree } from "./scan-fingerprint";
import { STAGED_PROBE_STEM_LIST } from "./staged-probes";

/**
 * The vitest `globalSetup`, and the teardown that goes with it.
 *
 * ## Why this runs once, before any test file
 *
 * **The corpus is a copy of the repository, and every rule reads it.** Made here, once, so that the
 * six architecture suites share one copy — and so that the copy exists *before* any test file
 * loads, which is what makes "the shipped tree is never written" true from the first assertion
 * rather than from the first stage.
 *
 * **And the fingerprint is taken here**, before anything has run, so the comparison in the teardown
 * is about what the suite did and not about what the tree looked like when the suite started.
 *
 * ## The copy has no staged probes in it
 *
 * **A probe left behind by an earlier run is in the shipped tree, and the copy would carry it** —
 * and a probe is a violation by construction, so every rule that walks the tree would report it
 * **and the next run would be red about the previous run.**
 *
 * **So the copy starts with no staged probe in it at all**, and the copy is where the controls
 * stage theirs. That is what makes a leftover harmless: **it is not in the corpus, so no rule ever
 * sees it** — rather than every rule needing to know which probes are leftovers.
 *
 * ## Why the teardown lives here and not in its own file
 *
 * **This Vitest has no `globalTeardown` option** — it arrived in a later version — **and it takes
 * the teardown from the `globalSetup` module**, either as a named `teardown` export or as the
 * function `setup` returns. **So the option that was declared was silently ignored**, the teardown
 * never ran, and the check it carried never fired. **A declared option that the runner does not
 * have is a check that does not run**, and only the falsification arm found it.
 */
export async function setup(): Promise<void> {
  const shipped = process.cwd();

  // **The fingerprint of the shipped tree, taken before anything has run.**
  process.env.SPECTRE_SHIPPED_FINGERPRINT = JSON.stringify([...fingerprintTree(shipped)]);

  const scratch = mkdtempSync(join(tmpdir(), "spectre-mail-corpus-"));
  const corpus = join(scratch, "repo");
  cpSync(shipped, corpus, {
    recursive: true,
    // **The copy skips the dependencies, the build output, and the repository's own metadata** --
    // the first two because they are large and not source, the third because a copy of the
    // repository's history is not a corpus of its code.
    filter: (source) => {
      const name = source.split(/[\\/]/).pop() ?? "";
      return !EXCLUDED_DIRECTORIES.has(name);
    },
  });

  // **And every staged probe is removed from the copy**, so the corpus holds none of the names
  // the vocabulary carries -- whatever the shipped tree held when the copy was made.
  for (const stem of STAGED_PROBE_STEM_LIST) {
    removeStagedProbes(corpus, stem);
  }

  // **And the copy is warmed.**
  //
  // **This is not a performance detail -- it is the difference between a gate that runs and a gate
  // that times out.** The rules read the corpus, and the corpus was *just written*, so every read
  // was a disk hit; the suite's own file took **60 seconds** against the shipped tree's **16**, and
  // a vitest worker that takes 60 seconds to report on itself **times out calling the main
  // process** -- which fails the run with *`Timeout calling "onTaskUpdate"`* and **every one of
  // the 1378 tests passing**.
  //
  // **So the copy is read once, here, and the page cache holds it.** 8.5 MB, and every rule after
  // this reads from memory.
  warmCorpus(corpus);

  process.env.SPECTRE_CORPUS_ROOT = corpus;
  process.env.SPECTRE_CORPUS_SCRATCH = scratch;
}

/**
 * Read every file in the corpus, so the operating system's cache holds it.
 *
 * **The corpus is read by the rules tens of times** — thirty-five tree walks, each reading the
 * files it visits — and a file that was written a moment ago is on disk rather than in memory.
 * **The cost of reading it once here is far less than the cost of the suite paying for a cold
 * read on every walk.**
 */
function warmCorpus(root: string): void {
  const walk = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (EXCLUDED_DIRECTORIES.has(entry.name)) continue;
      const absolute = join(directory, entry.name);
      if (entry.isDirectory()) {
        walk(absolute);
      } else {
        readFileSync(absolute);
      }
    }
  };
  walk(root);
}

/**
 * Every file in the corpus whose name is the stem, or begins with the stem and a dot.
 *
 * **A stem and not a name**, because a stem covers the three cases a name cannot: a family of
 * names, two extensions under one stem, and a case that differs.
 */
function removeStagedProbes(root: string, stem: string): void {
  const walk = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (EXCLUDED_DIRECTORIES.has(entry.name)) continue;
      const absolute = join(directory, entry.name);
      if (entry.isDirectory()) {
        walk(absolute);
      } else if (entry.name === stem || entry.name.startsWith(`${stem}.`)) {
        rmSync(absolute, { force: true });
      }
    }
  };
  walk(root);
}

/**
 * The teardown: the tree the suites must not have written, and the corpus's removal.
 *
 * ## The check
 *
 * **The shipped tree is compared against the fingerprint taken before any test ran**, and a
 * difference **fails the run** and **names the paths**. A count is satisfied by one file changing
 * twice, and a finding is a thing named.
 *
 * **This is the property the change is about**, and it is mechanical: the boundary suite used to
 * prove two of its rules by mutating `apps/web/index.html` and the repository's own
 * `package.json`, and a run killed for exceeding its timeout left both modified — **tracked files, so
 * a leftover was a modification that could be committed.**
 *
 * ## Why it runs here and not inside a test
 *
 * **A check that runs inside the thing it checks runs after the damage.** The teardown runs after
 * every test file, in the main process, and its failure fails the run.
 *
 * ## The corpus's removal
 *
 * **The copy is removed here, and the removal's failure is harmless** — it is a directory in the
 * operating system's temporary directory, and the shipped tree is not touched either way. **That is
 * the point of the design: the safety does not depend on a cleanup running.**
 */
export async function teardown(): Promise<void> {
  const shipped = process.cwd();
  const scratch = process.env.SPECTRE_CORPUS_SCRATCH;

  let failure: string | undefined;

  try {
    const before = new Map<string, string>(
      JSON.parse(process.env.SPECTRE_SHIPPED_FINGERPRINT ?? "[]") as [string, string][],
    );
    const after = fingerprintTree(shipped);
    const difference = differenceBetween(before, after);
    const parts: string[] = [];
    if (difference.changed.length > 0) parts.push(`changed: ${difference.changed.join(", ")}`);
    if (difference.added.length > 0) parts.push(`added: ${difference.added.join(", ")}`);
    if (difference.removed.length > 0) parts.push(`removed: ${difference.removed.join(", ")}`);
    if (parts.length > 0) {
      failure =
        "the architecture suites changed the tree they read, and the tree they read is the " +
        "shipped tree: " +
        parts.join("; ");
    }
  } finally {
    if (scratch) rmSync(scratch, { recursive: true, force: true });
    // **The corpus's path is cleared**, so a later reader in this process cannot mistake it for
    // the shipped tree.
    delete process.env.SPECTRE_CORPUS_ROOT;
    delete process.env.SPECTRE_CORPUS_SCRATCH;
    delete process.env.SPECTRE_SHIPPED_FINGERPRINT;
  }

  if (failure !== undefined) throw new Error(failure);
}
