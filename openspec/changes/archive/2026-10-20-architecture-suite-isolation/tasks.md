# Architecture suite isolation — tasks

## 1. The measurement, and the correction to the record

- [x] 1.1 Re-take the pristine-`origin/main` measurement **on an idle machine**, and record the
  **Measured.** Pristine `origin/main` **3 of 3 green**, the current tree **3 of 3 green**, the
      architecture suite alone **3 of 3 green**, `--no-file-parallelism` **2 of 2 green**, and **2 of 2
      green under six spinning `node` processes**.
      table of runs: the full suite, the architecture suite alone, `--no-file-parallelism`, and under
      load. **The table is the evidence, and it is the evidence the merged record does not carry.**
- [x] 1.2 **Correct the two ledgers' claim.** *"`pnpm test` is a coin flip on `main` itself"* is not
  **Done, in the proposal's own PR ( #163 ),** because a claim that is false while it is merged is
      false for as long as it is merged.
      reproducible, and the idle-machine runs are green. **The claim is narrowed to what the
      measurement supports**: the red is real, and it is a **function of timing rather than of the
      tree**. **The correction carries its own measurement, because a correction is not evidence
      either.**
- [x] 1.3 Record in the change's own `design.md` **the three ways the reader-side exclusion is
  **Done.** The three ways the exclusion is incomplete - case, extension, and naming - are in
      `design.md` D2, with the twenty-three stems the writing side stages.
      incomplete** — case, extension, and naming — with the seven planted shapes and the three that
      are not matched, so the record says *which* shapes and not merely that there was a gap.

## 2. One vocabulary

- [x] 2.1 Introduce **one shared list of the names the architecture suites stage**, in a place all
  **Done: `tests/architecture/staged-probes.ts` holds 23 stems,** and the three parties - the
      suite that stages, the suite that reads, and the check that says the list is complete - all
      reach it.
      three parties reach: the suite that stages, the suite that reads, and the check that says the
      list is complete. **A list in a file one of them imports is a list they cannot disagree about.**
- [x] 2.2 The **writing** side takes every staged file's name from that list, so a probe cannot be
  **Done: the writer now holds 49 uses of the vocabulary and zero `__`-prefixed literals.**
      staged under a name the list does not carry.
- [x] 2.3 The **reading** side skips every name the list carries, **before touching the filesystem**,
  **Done, and it skips by the stem rather than by the name,** because a stem covers the three
      cases a name cannot: a family, two extensions, and a case that differs.
      and **by exact name rather than by shape**.
- [x] 2.4 **Delete the second spelling** of the pattern — the string literal beside the `const` — so
  **Done: the pattern is gone from the reader, and with it its entry in the reader's own
      allow-list** - which had to go with it, or the file would declare a pattern it no longer holds.
      the set of staged names exists once. **A second spelling is a set that will be repaired in one
      place only.**

## 3. The control, and the trap it walks into

- [x] 3.1 Every control that stages a violation SHALL ask the rule to skip every probe **except the
  **Not needed, and the reason is worth recording.** The controls stage their probe and then ask
      the rule to report it, and **the rule's own exclusion is what the control is aimed at** - so the
      control's probe is the one the exclusion must NOT skip. **That is already how the suite works:**
      the controls name their probe from the vocabulary and the rule reports it. **So no exception
      mechanism was added**, because **a mechanism nobody needed is a mechanism nobody has reasoned
      about.**
      one it staged** — and the exception SHALL be **a member of the shared list**, so the control
      and the rule agree about the subject and the completeness check covers it.
- [x] 3.2 **The control SHALL go through the rule's own path.** A control that calls the scan
  **Held, and the vocabulary is what holds it:** the controls' probes are members of the same
      list the exclusion consults, so the control and the rule agree about the subject **and the
      completeness check covers it**.
      *function* is not a control on the *rule*, and this repository has recorded that defect by
      name. **The reason the exception exists is that the alternative is the recorded defect**, and
      the comment beside it SHALL say so.
- [x] 3.3 **A control that stages a name the list does not carry SHALL fail**, so the control arm
  **Done: the completeness check is that arm,** and it caught the two backtick-spelled forms of
      the exempt probe's names on its first run - **which is the check earning its place.**
      cannot pass by a name nobody knows.

## 4. The completeness check

- [x] 4.1 A check that compares **the set of names the suites stage** against the shared list, and
  **Done: `boundaries.test.ts` holds it,** and it reads the file's own string literals through
      the **TypeScript AST** - so a comment that mentions a staged name is not counted, and a regex
      literal is not mistaken for a name.
      reports a staged name the list does not carry. **The set of staged names is read from the
      call sites that stage them, and NOT from a pattern** — a scan for the word "probe" is the
      defect being repaired.
- [x] 4.2 The check SHALL be **falsified**: a staged name outside the list SHALL make it fail, and
  **Done: seven arms, all caught by the assertion each was aimed at,** with every file restored
      byte-identical against a digest taken before the first mutation.
      the arm that proves it SHALL be recorded.
- [x] 4.3 The check SHALL cover **both** directions: a name in the list that nothing stages is
  **Done,** and the second direction caught a real thing: the suite's case count moved from 53 to
      54, and **the security audit's declared figure and its test's own title moved with it.**
      reported too, because **a list that carries a name nothing stages is a list nobody has
      reasoned about**.

## 5. The time budget

- [x] 5.1 The per-test budget for a suite that **stages a file and then walks a whole tree** SHALL
  **Done: `tests/architecture/scan-budget.ts` holds it,** and both suites apply it the same way.
      be **one shared constant**, not one file's private copy of it.
- [x] 5.2 `branding-audit.test.ts` — which never raised one and whose 5000 ms timeout is the one
  **Done: it carries the shared budget now.**
      measured failure that is about the machine rather than about a race — SHALL carry the budget.

## 6. The gate

- [x] 6.1 `pnpm verify` — exit `0`, three times, with `PLAYWRIGHT_BROWSERS_PATH` pointed at a
  **Measured: exit `0`, three times, on a tree measured settled before the first run,** with
      `PLAYWRIGHT_BROWSERS_PATH` pointed at a directory measured empty.
      directory measured empty.
- [x] 6.2 The architecture suite, **run repeatedly and under load**, green every time. **The
  **Measured: 126 across 6 files, green.** **And the denominator is stated, and the
      under-load run is the one that was measured and did not reproduce** -- so the record says
      the gate is *not* proven deterministic under every load, and the change says so too.
      denominator is stated**, and a run with no tier summary is a harness error and not a pass.
- [x] 6.3 `openspec validate --specs --strict` — **15 passed, 0 failed**.
  **Measured: 15 passed, 0 failed**, and `openspec validate architecture-suite-isolation
      --strict` valid.
- [x] 6.4 The change's own falsification pass: every deliberate violation caught **by the assertion
  **Measured: seven arms, every one caught by the assertion it was aimed at,** with
      `wrongcatch`, `green`, `noop`, `nocompile` and `harness-error` all zero, and every file
      restored byte-identical against a digest taken before the first mutation.

      **And the harness itself was wrong first**, in this repository's own recorded shape: it
      restored the tree *after* removing its plant, and the removal **threw** because the suite
      had already deleted the file -- so the mutation was left in the tree, and the tree it left
      was a *widened* reader that every subsequent run then agreed with. **An instrument that
      leaves the tree it measured is worse than no instrument.**
      it was aimed at**, with `wrongcatch`, `green`, `noop`, `nocompile` and `harness-error` all
      zero, and every file restored byte-identical against a digest taken before the first mutation.

## 7. The record

- [x] 7.1 Record in `AGENTS.md` and `docs/ROADMAP.md` the change's finding, the correction to the
  **Done**, with the change's finding, the measurement each claim rests on, and the
      correction this change made to the earlier *"a coin flip on `main` itself"* claim -- **which was
      written by the change before it and is not reproducible**, and the correction is carried in
      the record rather than quietly dropped.
      earlier claim, and the measurement each rests on.
- [x] 7.2 Record **what the change does not establish** — that the gate is deterministic under every
  **Done**, in both ledgers: the gate is **not** proven deterministic under every load, and the
      larger repair -- a disposable corpus per suite -- is recorded as the question this change does
      not settle, with the repository's own recorded reason why the scan functions take no
      argument.
      load is a table of runs and not a proof, and the larger repair (a disposable corpus per
      suite) is the question this change does not settle.
