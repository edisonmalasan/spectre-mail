# Architecture suite isolation — tasks

## 1. The measurement, and the correction to the record

- [ ] 1.1 Re-take the pristine-`origin/main` measurement **on an idle machine**, and record the
      table of runs: the full suite, the architecture suite alone, `--no-file-parallelism`, and under
      load. **The table is the evidence, and it is the evidence the merged record does not carry.**
- [ ] 1.2 **Correct the two ledgers' claim.** *"`pnpm test` is a coin flip on `main` itself"* is not
      reproducible, and the idle-machine runs are green. **The claim is narrowed to what the
      measurement supports**: the red is real, and it is a **function of timing rather than of the
      tree**. **The correction carries its own measurement, because a correction is not evidence
      either.**
- [ ] 1.3 Record in the change's own `design.md` **the three ways the reader-side exclusion is
      incomplete** — case, extension, and naming — with the seven planted shapes and the three that
      are not matched, so the record says *which* shapes and not merely that there was a gap.

## 2. One vocabulary

- [ ] 2.1 Introduce **one shared list of the names the architecture suites stage**, in a place all
      three parties reach: the suite that stages, the suite that reads, and the check that says the
      list is complete. **A list in a file one of them imports is a list they cannot disagree about.**
- [ ] 2.2 The **writing** side takes every staged file's name from that list, so a probe cannot be
      staged under a name the list does not carry.
- [ ] 2.3 The **reading** side skips every name the list carries, **before touching the filesystem**,
      and **by exact name rather than by shape**.
- [ ] 2.4 **Delete the second spelling** of the pattern — the string literal beside the `const` — so
      the set of staged names exists once. **A second spelling is a set that will be repaired in one
      place only.**

## 3. The control, and the trap it walks into

- [ ] 3.1 Every control that stages a violation SHALL ask the rule to skip every probe **except the
      one it staged** — and the exception SHALL be **a member of the shared list**, so the control
      and the rule agree about the subject and the completeness check covers it.
- [ ] 3.2 **The control SHALL go through the rule's own path.** A control that calls the scan
      *function* is not a control on the *rule*, and this repository has recorded that defect by
      name. **The reason the exception exists is that the alternative is the recorded defect**, and
      the comment beside it SHALL say so.
- [ ] 3.3 **A control that stages a name the list does not carry SHALL fail**, so the control arm
      cannot pass by a name nobody knows.

## 4. The completeness check

- [ ] 4.1 A check that compares **the set of names the suites stage** against the shared list, and
      reports a staged name the list does not carry. **The set of staged names is read from the
      call sites that stage them, and NOT from a pattern** — a scan for the word "probe" is the
      defect being repaired.
- [ ] 4.2 The check SHALL be **falsified**: a staged name outside the list SHALL make it fail, and
      the arm that proves it SHALL be recorded.
- [ ] 4.3 The check SHALL cover **both** directions: a name in the list that nothing stages is
      reported too, because **a list that carries a name nothing stages is a list nobody has
      reasoned about**.

## 5. The time budget

- [ ] 5.1 The per-test budget for a suite that **stages a file and then walks a whole tree** SHALL
      be **one shared constant**, not one file's private copy of it.
- [ ] 5.2 `branding-audit.test.ts` — which never raised one and whose 5000 ms timeout is the one
      measured failure that is about the machine rather than about a race — SHALL carry the budget.

## 6. The gate

- [ ] 6.1 `pnpm verify` — exit `0`, three times, with `PLAYWRIGHT_BROWSERS_PATH` pointed at a
      directory measured empty.
- [ ] 6.2 The architecture suite, **run repeatedly and under load**, green every time. **The
      denominator is stated**, and a run with no tier summary is a harness error and not a pass.
- [ ] 6.3 `openspec validate --specs --strict` — **15 passed, 0 failed**.
- [ ] 6.4 The change's own falsification pass: every deliberate violation caught **by the assertion
      it was aimed at**, with `wrongcatch`, `green`, `noop`, `nocompile` and `harness-error` all
      zero, and every file restored byte-identical against a digest taken before the first mutation.

## 7. The record

- [ ] 7.1 Record in `AGENTS.md` and `docs/ROADMAP.md` the change's finding, the correction to the
      earlier claim, and the measurement each rests on.
- [ ] 7.2 Record **what the change does not establish** — that the gate is deterministic under every
      load is a table of runs and not a proof, and the larger repair (a disposable corpus per
      suite) is the question this change does not settle.
