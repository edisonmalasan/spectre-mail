# Architecture suite isolation

## Why

**The architecture suites share the shipped tree as their corpus, and one of them writes into it while
another reads it.** `tests/architecture/boundaries.test.ts` stages a **probe file** — a deliberately
illegal module — into `apps/` or `packages/`, runs the real rule over it, and deletes it again; sixteen
assertions do this. `tests/architecture/branding-audit.test.ts` walks the same tree in a **parallel
vitest worker** to check that the public name reaches every surface it claims.

**And the vitest config sets no `fileParallelism`**, so file-level parallelism is the default, and the
two suites read and write the same directory at the same time.

### The reader-side repair exists, and it is incomplete

**`branding-audit.test.ts` knows about this and already carries a repair.** Its own comment names the
failure signature:

> *"The first run died with `ENOENT: no such file or directory, open
> `packages/mailbox/__framework-rule-probe.ts`, which is the signature of a scan that cannot tell a
> source file from an artefact another measurement just removed."*

**And the repair is to skip probe-shaped files by name, before the filesystem is touched** — which is
the right shape, because a name test needs no file access and so cannot race a deletion.

**But the pattern misses four of the shapes `boundaries.test.ts` actually plants.** It is
`/^__.*probe\.[cm]?tsx?$/`:

| planted shape | matched? | why |
| --- | --- | --- |
| `__fetch-rule-probe.ts` | yes | |
| `__framework-rule-probe.ts` | yes | |
| `__client-storage-probe.ts` | yes | |
| `__BoundaryProbe.tsx` | **no** | the pattern's `probe` is lowercase and this name's is not |
| `__exempt.spec.ts`, `__exempt.test.ts` | **no** | the name carries no `probe` at all |
| `__boundary-probe.css` | **no** | `.css` is not in `[cm]?tsx?` |

**And the pattern is spelled twice in that file** — once as a `const` and once as a string literal
elsewhere — which is the repository's own recorded shape: *"a second spelling of a set is the
defect."*

### The consequence, measured

**On a pristine `origin/main` checkout, two consecutive runs of the architecture suite failed, each
with a *different* set of failures:**

```text
run 1
  ENOENT  packages/mailbox/__framework-rule-probe.ts
  ENOENT  packages/mail-parser/__storage-rule-probe.ts
  ENOENT  packages/ui/__storage-import-probe.ts
  ENOENT  apps/extension/__client-storage-probe.ts
  "the branding audit's case timed out in 5000ms"

run 2
  "the rule should report all 5 packages: expected 4 to be 5"
  "chrome storage should be caught in apps/web: expected [] to not deeply equal []"
  "expected [ Array(1) ] to deeply equal []"   (twice)
  ENOENT  packages/mailbox/__clock-rule-probe.ts
```

**Two shapes of failure, one cause.** A reader opens a file another worker has already deleted; and a
reader counts another worker's staged file as if it were shipped source.

### And the qualifier the merged record does not carry

**The failures are a function of timing, and they do not reproduce on an idle machine.** Measured
afterwards, at the same commit:

| measurement | result |
| --- | --- |
| pristine `origin/main`, full suite, default parallelism | **3 of 3 green** |
| the current tree, full suite, default parallelism | **3 of 3 green** |
| the architecture suite alone | **3 of 3 green** |
| the full suite with `--no-file-parallelism` | **2 of 2 green** |
| the architecture suite under six spinning `node` processes | **2 of 2 green** |

**So the word *"coin flip"* in the merged record overstates what was measured, and this change
corrects it.** The red is real — named cases, real errors, a different set each time — but it is a red
that **appears and disappears without the tree changing**, which is the failure mode this repository's
own standard already forbids: *"a test that fails for no reason is worse here than a test that fails
for the right one … a timeout means only that the machine was busy."*

**And the correction is not a softening: it is the finding.** A gate whose red is a function of
timing rather than of the tree cannot be trusted to have shipped anything, and every stage in this
milestone reported its gates as green on the strength of runs that were, on this evidence, partly luck.

## Why this is a change and not a task

**Because the repository already has a requirement its own architecture suite does not satisfy.**
`build-and-verification`'s *"A passing test run asserts something"* says:

> *"a check that is narrower in scope than the rule it documents SHALL be treated as a failure of
> this capability, not as a passing check."*

**The exclusion is a check, and it is narrower in scope than the rule it documents** — the rule is
"the set of probe shapes the writing side stages", and the check matches three shapes out of seven.
**The requirement already says the present state is non-compliant, and no test says so.**

**And the repair cannot be made inside one file**, because the corpus is shared: the vocabulary of
staged file names is used by the suite that writes and by the suite that reads, and the file that
reads it is a different file in a different worker. **That is a change to how the corpus is built**,
and it touches a suite with **53** assertions and two other architecture suites that read the same
tree.

## What ships

1. **The correction to the merged record.** `docs/ROADMAP.md` and `AGENTS.md` carry *"`pnpm test` is a
   coin flip on `main` itself"* and cite the pristine-`main` measurement as if it were reproducible.
   **It is not**, and the idle-machine measurement is not in the record. **The claim is narrowed to
   what the measurement supports**: the gate's red is a function of timing rather than of the tree,
   and the failure set varies per run. **A correction is not evidence either**, so the correction
   states its own measurement.

2. **One vocabulary, spelled once, and complete.** Every probe file name the architecture suites stage
   comes from **one list**, and the list is what the reader-side exclusion consults — so a probe nobody
   remembered to exempt is exempt **by construction** rather than by remembering. **The name is
   matched exactly, not by shape**, so the case, the extension, and the "no `probe` in the name"
   gaps cannot recur.

3. **The reader-side exclusion skips by name before touching the filesystem**, so no reader opens a
   file another worker may have deleted — which is what makes the `ENOENT` unreachable rather than
   merely rare.

4. **A check that the vocabulary is complete**, so the property cannot rot the way the shape-based
   pattern did.

5. **The per-suite time budget is one shared decision.** `boundaries.test.ts` raised its own budget to
   60 s on 2026-10-03 for a measured reason — *"a rule that writes a probe file and then re-walks
   the whole of `apps/`"* — and `branding-audit.test.ts` never raised one, and **its 5000 ms timeout
   is the one failure in the list above that is about the machine rather than about a race.**

## What this does not establish

- **That the corpus is private per suite.** The repair is to make the **vocabulary** complete and
  shared, which is the smallest change that removes the observed failures. **Whether the corpus
  should be a disposable copy per suite is a larger question this change does not settle**, and the
  decision belongs to the design record.
- **That the gate is now deterministic under every load.** The measurement is a table of runs, not a
  proof.
- **Anything about the product.** No shipped code is touched.
