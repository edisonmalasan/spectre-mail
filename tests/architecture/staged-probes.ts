/**
 * The names the architecture suites stage, in one place.
 *
 * ## Why this file exists
 *
 * **The architecture suites share the shipped tree as their corpus, and one of them writes into it
 * while another reads it.** `boundaries.test.ts` stages a deliberately illegal module into `apps/` or
 * `packages/`, runs the real rule over it, and deletes it; sixteen assertions do this.
 * `branding-audit.test.ts` walks the same tree in a **parallel vitest worker** to check that the
 * public name reaches every surface it claims. The vitest config sets no `fileParallelism`, so
 * file-level parallelism is the default.
 *
 * **A reader that does not know what a staged file is called will read one** — and a file that is
 * deleted between the walk and the read makes the read throw. That is the measured failure:
 * `ENOENT: no such file or directory, open 'packages/mailbox/__framework-rule-probe.ts'`.
 *
 * ## Why this is a list and not a pattern
 *
 * **The repair that was already in place was a filename *shape*, and a shape is a guess.** The
 * pattern `/^__.*probe\.[cm]?tsx?$/` matched **three of the twenty-three** stems this repository
 * actually stages. It missed a staged name whose case differs, one whose extension it does not
 * name, one whose name carries no marker word at all, and one that is a *family* of names.
 *
 * **A list is not a guess.** Every stem below is a name the writing side really stages, and the
 * writing side takes its file's name from this file -- so the two sides cannot disagree about what
 * a staged file is called. A shape can be widened to cover a case nobody thought of; a list has to
 * be **edited**, and the completeness check below says so out loud.
 *
 * ## Why this is data and not a function
 *
 * **The architecture suites deliberately share no reader.** `branding-audit.test.ts` asserts it, by
 * comparing import specifiers and function bodies against the other suites. A shared *predicate*
 * would be a shared reader wearing a different name, and a bug in it would be invisible to both.
 *
 * **So this file exports data, and each suite applies it with its own code.** The reader's own
 * skip is one expression over the list, written in that file; the writer's own naming is one
 * expression over the list, written in that file. **What is shared is the vocabulary, and the
 * vocabulary is the thing that has to be shared.**
 *
 * ## The stems, and why each one is a *stem*
 *
 * **A stem is a staged file's name without its extension**, and the reader skips an entry when the
 * entry is the stem or begins with the stem and a dot. That covers the three cases the shapes
 * could not:
 *
 * - **a family** -- `__write-probe` is the stem of `__write-probe-<label>.ts`, and there is one per
 *   form the rule is exercised against;
 * - **two extensions** -- `__exempt` is the stem of both `__exempt.spec.ts` and `__exempt.test.ts`;
 * - **a case that differs** -- `__BoundaryProbe` is the stem of `__BoundaryProbe.tsx`.
 *
 * **The rule the reader applies is the stem followed by a dot, or the stem itself** -- so a
 * stem never skips a file that merely starts with the same letters.
 */

/**
 * Every staged file's stem, in one list.
 *
 * **Each entry names what it is and where it is staged**, because a stem nobody has reasoned
 * about is a stem nobody will notice going stale.
 */
export const STAGED_PROBES = {
  /** The rule-probe control, in `apps/extension/src`. */
  rule: "__rule-probe",
  /** The network rule's control, in one of the three network-forbidden packages. */
  fetchRule: "__fetch-rule-probe",
  /** The framework-import rule's control, in `packages/mailbox`. */
  frameworkRule: "__framework-rule-probe",
  /** The clock rule's control, in `packages/mailbox`. */
  clockRule: "__clock-rule-probe",
  /** The storage rule's control, in each shared package in turn. */
  storageRule: "__storage-rule-probe",
  /** The storage-import rule's control, in each shared package in turn. */
  storageImport: "__storage-import-probe",
  /** The client-storage rule's control, at each client's root. */
  clientStorage: "__client-storage-probe",
  /** The exemption control's two files, at each client's root. */
  exempt: "__exempt",
  /** The browser suite's own directory, holding a control the exemption must not report. */
  harness: "__harness-probe",
  /** One directory above a browser suite's own, where a control must still be reported. */
  outsideHarness: "__outside-harness-probe",
  /** A staged copy inside a generated output directory, which must go unreported. */
  artefact: "__artefact-probe",
  /** A staged copy beside that generated directory, which must still be reported. */
  neighbour: "__neighbour-probe",
  /** The platform-store rule's control, in a disposable copy of the extension's source. */
  platform: "__platform-probe",
  /** The singular-write rule's controls, one per syntactic form. */
  writeProbe: "__write-probe",
  /** Prose about the forbidden write, which must not be reported. */
  writeProse: "__write-prose",
  /** The client-storage form control, at a client's root. */
  clientStorageForm: "__client-storage-form-probe",
  /** The parser-direction rule's control. */
  parserDirection: "__parser-direction-probe",
  /** The stylesheet rule's control, in a client's `src`. */
  boundaryStylesheet: "__boundary-probe",
  /** The boundary rule's control component, in a client's `src`. */
  boundaryComponent: "__BoundaryProbe",
  /** The local-token rule's control stylesheet, in a client's `src`. */
  boundaryLocalToken: "__boundary-local-token",
  /** The ownership rule's control, in the extension's `src`. */
  owned: "__owned-probe",
  /** The collection rule's control, a spec file nothing collects. */
  uncovered: "__uncovered",
  /** The spike rule's control, in the extension's `e2e`. */
  spike: "__spike-probe",
} as const;

/** Every stem, as a plain list. */
export const STAGED_PROBE_STEM_LIST: readonly string[] = Object.values(STAGED_PROBES);

/**
 * Whether a directory entry is a staged file.
 *
 * **A stem matches the entry itself, or the entry beginning with the stem and a dot.** The dot is
 * what keeps a stem from skipping a file that merely begins with the same letters.
 *
 * **The one thing this must not become is a pattern.** A pattern is a guess about the shapes a
 * future staged file might take, and the guess this repository already made was wrong in seven
 * ways. **A list is edited; a pattern is widened.**
 */
export function isStagedProbe(entry: string): boolean {
  return STAGED_PROBE_STEM_LIST.some((stem) => entry === stem || entry.startsWith(`${stem}.`));
}
