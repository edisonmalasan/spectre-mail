# Architecture suite cleanup — tasks

## 1. The measurement, and the record's correction

- [ ] 1.1 Record the measurement that decided the change: **the suite's red under CPU contention is
      two of its own cases exceeding the shared 60 s budget** (61.6 s and 78.2 s), **and the
      mutation sits on disk across the timeout.**
- [ ] 1.2 Record the two mutated files by name — `apps/web/index.html` **and** the repository's own
      `package.json` — **and that both are tracked**, so a leftover is a modification that can be
      committed, **and that the lost trailing newline breaks `format:check` as well.**
- [ ] 1.3 Record **which rule reports which leftover**, so the record names the mechanism rather
      than the symptom: the stylesheet rule, the markup rule, the custom-property rule, and the
      quarantine rule each find the previous run's artefact.
- [ ] 1.4 **Replace the record's asserted cause with the measured one.** The ASI record said *"the
      suite's own probes left in the tree by a cancelled run"* — **true and incomplete**, because
      the probes are the lesser of the two.

## 2. A staged probe becomes invisible to the rules that walk the tree

- [ ] 2.1 The boundary suite's own rules SHALL skip every name in the shared vocabulary — the
      **23 stems** `staged-probes.ts` already holds — **when they walk the tree**.
- [ ] 2.2 Every control that stages a violation SHALL ask the rule to skip every probe **except the
      one it staged**, **by the same name the writer took from the vocabulary**, so the control and
      the rule agree about the subject **and the completeness check still covers it**.
- [ ] 2.3 The control SHALL go **through the rule's own path** — the exception is the rule's own
      exclusion with one name removed, **not a different code path** — because *a control that calls
      the scan function is not a control on the rule*.
- [ ] 2.4 The completeness check SHALL cover the new names: a stem the vocabulary holds and no
      control stages is reported, **and a control that stages a name the vocabulary does not carry is
      reported.**

## 3. A mutated shipped file becomes impossible

- [ ] 3.1 The scan roots move into **one shared module**, and every rule reads them from there —
      **so the scan functions still take no argument**, which is the constraint the repository
      recorded, **and there is exactly one list of roots**, which is the constraint's purpose.
- [ ] 3.2 The two controls that mutate a shipped file SHALL mutate a **disposable copy** of the
      tree, so **`apps/web/index.html` and `package.json` are never written.**
- [ ] 3.3 The disposable copy SHALL be removed in a `finally`, **and the safety SHALL NOT depend on
      that** — the shipped tree is untouched whether or not the remove runs. **The remove is a
      tidiness, not the safety.**
- [ ] 3.4 The shared binding is documented as **a genuine cross-cutting concern** — every rule in
      the suite reads it — because the repository's rule on mutable module state asks for exactly
      that.

## 4. The check that the tree is unchanged

- [ ] 4.1 A check that **fingerprints the tree before the architecture suite runs and compares it
      after** — every tracked file's content hash **and** every file's presence — **and reports the
      paths, not a count.**
- [ ] 4.2 The comparison SHALL be against **Git** and not against a remembered value, because a
      hand-transcribed digest once reported a file as differing that `git status` never listed as
      modified.
- [ ] 4.3 The check SHALL run **outside the suite**, because a check that runs inside the thing it
      checks is a check that runs after the damage.
- [ ] 4.4 **The check SHALL be falsified**: a planted mutation in a tracked file SHALL make it fail,
      and a planted staged probe SHALL make it fail — **and the arms that prove it SHALL be
      recorded.**

## 5. The budget

- [ ] 5.1 The shared budget stays shared — **`tests/architecture/scan-budget.ts`**, taken by both
      suites — and **no file copies the constant back.**
- [ ] 5.2 The record SHALL say what the budget is for **after** this change: **a ceiling on a
      test's cost and on its blast radius**, because a timeout is no longer destructive.

## 6. The gate

- [ ] 6.1 `pnpm verify` — exit `0`, three times, with `PLAYWRIGHT_BROWSERS_PATH` pointed at a
      directory measured empty, **and `git status` clean before and after each run.**
- [ ] 6.2 The architecture suite, **run under six spinning `node` processes**, leaves **the tree
      unchanged** — measured by the check, not by hand.
- [ ] 6.3 `openspec validate --specs --strict` — **15 passed, 0 failed**.
- [ ] 6.4 The change's own falsification pass: every deliberate violation caught **by the assertion
      it was aimed at**, with `wrongcatch`, `green`, `noop`, `nocompile` and `harness-error` all zero,
      and every file restored byte-identical against a digest taken before the first mutation.

## 7. The record

- [ ] 7.1 Record in `AGENTS.md` and `docs/ROADMAP.md` the change's finding, the measurement each
      claim rests on, **and the correction to the ASI record's asserted cause.**
- [ ] 7.2 **Replace the manual remedy** — *check `git status` before every gate run* — **with the
      property**, and say what replaced it.
- [ ] 7.3 Record **what the change does not establish** — that the suite is deterministic under every
      load is a table of runs and not a proof, **and that a staged probe can still be left behind,
      and is now harmless rather than impossible.**
