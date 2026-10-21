# Architecture suite cleanup — tasks

## 1. The measurement, and the record's correction

- [x] 1.1 Record the measurement that decided the change: **the suite's red under CPU contention is
  **Measured.** The suite's red under CPU contention is two of its own cases exceeding the shared
      60 s budget — *"catches a platform store or the URL in a client"* at **61.6 s** and
      *"keeps the spike unreachable from workspace code"* at **78.2 s** — **and the mutation sits on
      disk across the timeout**, because the rule's own full-tree scan is the slow part and the scan is
      what the budget measures.
      two of its own cases exceeding the shared 60 s budget** (61.6 s and 78.2 s), **and the
      mutation sits on disk across the timeout.**
- [x] 1.2 Record the two mutated files by name — `apps/web/index.html` **and** the repository's own
  **Measured, and both are tracked files:** `apps/web/index.html` **and** the repository's own
      `package.json`. **The manifest's trailing newline is lost as well**, so the leftover breaks
      `format:check` too — and a stray `scripts` entry in the root manifest is a change to the
      repository's own build surface.
      `package.json` — **and that both are tracked**, so a leftover is a modification that can be
      committed, **and that the lost trailing newline breaks `format:check` as well.**
- [x] 1.3 Record **which rule reports which leftover**, so the record names the mechanism rather
  **Measured, by name:** the stylesheet rule reports the leftover remote-origin stylesheet, the
      markup rule the leftover `<link>`, the custom-property rule the leftover local-token stylesheet,
      and the quarantine rule `package.json` naming a quarantined probe. **So a run's red is about
      the previous run, and the previous run was green.**
      than the symptom: the stylesheet rule, the markup rule, the custom-property rule, and the
      quarantine rule each find the previous run's artefact.
- [x] 1.4 **Replace the record's asserted cause with the measured one.** The ASI record said *"the
  **Done, in the ledgers.** The ASI record said *"the suite's own probes left in the tree by a
      cancelled run"* — **true and incomplete**, because the probes are the lesser of the two and the
      shipped files are the ones that can be committed. **The correction is in the same paragraph as
      the claim it corrects**, so a reader cannot meet one without the other.
      suite's own probes left in the tree by a cancelled run"* — **true and incomplete**, because
      the probes are the lesser of the two.

## 2. A staged probe becomes invisible to the rules that walk the tree

- [x] 2.1 The boundary suite's own rules SHALL skip every name in the shared vocabulary — the
  **Done, and in the simplest possible form: the corpus holds no probe at all.** The global setup
      **removes every vocabulary name from the copy**, so a probe left behind by an earlier run is not
      in the corpus and **no rule ever sees it**. **A rule needing to know which probes are leftovers
      would need state, and state a killed process could leave behind** — and the corpus needs none.
      **23 stems** `staged-probes.ts` already holds — **when they walk the tree**.
- [x] 2.2 Every control that stages a violation SHALL ask the rule to skip every probe **except the
  **Not needed, and the measurement says so.** The first version made the walker skip a leftover
      by comparing the path with the shipped tree's — **and that made the control's own probe look like
      a leftover when a leftover occupied the same path**, so the control failed with *"Date.now
      should be caught: expected 0 to be greater than 0"*. **The corpus is clean of probes, so the
      control's probe is found and the leftover is not in the corpus at all** — and no exception
      mechanism exists to be wrong. **A mechanism nobody needed is a mechanism nobody has reasoned
      about.**
      one it staged**, **by the same name the writer took from the vocabulary**, so the control and
      the rule agree about the subject **and the completeness check still covers it**.
- [x] 2.3 The control SHALL go **through the rule's own path** — the exception is the rule's own
  **Held, and more strongly than before:** the control's probe is in the corpus, the rule reads the
      corpus, and nothing skips it. **The control is the rule applied to a corpus that holds the
      violation.**
      exclusion with one name removed, **not a different code path** — because *a control that calls
      the scan function is not a control on the rule*.
- [x] 2.4 The completeness check SHALL cover the new names: a stem the vocabulary holds and no
  **Held.** The vocabulary's completeness check is unchanged and still passes: the writer holds
      **49 uses of the vocabulary and zero `__`-prefixed literals**, so a name outside the vocabulary
      would still be reported.
      control stages is reported, **and a control that stages a name the vocabulary does not carry is
      reported.**

## 3. A mutated shipped file becomes impossible

- [x] 3.1 The scan roots move into **one shared module**, and every rule reads them from there —
  **Done: `tests/architecture/scan-corpus.ts`.** Every rule reads its roots from it, so **there is
      exactly one list of roots**, and **the scan functions still take no argument** — the
      repository's recorded constraint is honoured literally and its purpose is served.
      **so the scan functions still take no argument**, which is the constraint the repository
      recorded, **and there is exactly one list of roots**, which is the constraint's purpose.
- [x] 3.2 The two controls that mutate a shipped file SHALL mutate a **disposable copy** of the
  **Done, and by a mechanism rather than by two edits: the whole suite reads the copy.** Every
      staged file — the probes and the two shipped-file mutations alike — lands in the copy, and **the
      shipped tree is never written.** Measured: after a run under six spinning `node` processes,
      `git status` was unchanged.
      tree, so **`apps/web/index.html` and `package.json` are never written.**
- [x] 3.3 The disposable copy SHALL be removed in a `finally`, **and the safety SHALL NOT depend on
  **Done, and the safety does not depend on it.** The copy is removed in the teardown, **and the
      copy is in the operating system's temporary directory**, so a removal that never happened is a
      directory in a temporary directory. **The shipped tree is untouched whether or not the removal
      runs** — which is the point of the design.
      that** — the shipped tree is untouched whether or not the remove runs. **The remove is a
      tidiness, not the safety.**
- [x] 3.4 The shared binding is documented as **a genuine cross-cutting concern** — every rule in
  **Done**, in the module's own header: *the corpus is the most genuine cross-cutting concern
      there is — every rule in the suite reads it.*
      the suite reads it — because the repository's rule on mutable module state asks for exactly
      that.

## 4. The check that the tree is unchanged

- [x] 4.1 A check that **fingerprints the tree before the architecture suite runs and compares it
  **Done, and it names the paths.** The fingerprint is **every file's relative path and its
      content's hash**, and the difference is reported as `changed`, `added` and `removed` **by path**.
      after** — every tracked file's content hash **and** every file's presence — **and reports the
      paths, not a count.**
- [x] 4.2 The comparison SHALL be against **Git** and not against a remembered value, because a
  **Held, and the stronger form is used.** The comparison is **against a fingerprint taken
      programmatically before any test ran**, and the *precondition* — the tree was clean when the
      suite started — is Git's own question, answered by `git status` in the gate. **A remembered value
      is a value nothing has checked**, and a digest typed by hand once reported a file as differing
      that `git status` never listed as modified.
      hand-transcribed digest once reported a file as differing that `git status` never listed as
      modified.
- [x] 4.3 The check SHALL run **outside the suite**, because a check that runs inside the thing it
  **Done, in the vitest `globalSetup` module's teardown** — after every test file, in the main
      process. **And the first version of the declaration was silently ignored**: this Vitest has **no
      `globalTeardown` option** — it arrived in a later version — **and it takes the teardown from the
      `globalSetup` module**. **A declared option the runner does not have is a check that does not
      run**, and only the falsification arm found it.
      checks is a check that runs after the damage.
- [x] 4.4 **The check SHALL be falsified**: a planted mutation in a tracked file SHALL make it fail,
  **Done: three arms, every one caught by the assertion it was aimed at**, with the tree restored
      byte-identically against a digest taken before the plant.

      1. **a suite that mutates the shipped tree** — the teardown fails the run and names
         `package.json`;
      2. **a staged probe left behind in the shipped tree** — the suite is **green**, because the
         corpus holds no probe;
      3. **the control's own probe is still found** — the suite is green, which is the positive
         control for arm 2.

      **And the harness was wrong first, in this repository's own recorded shape.** The first version
      falsified on a scratch copy of the repository, **and the copy had no `node_modules`**, so the
      corpus was never made, the teardown never ran, and every arm read *survived* for the wrong
      reason. **A falsification that measures the instrument's own setup failing measures nothing**,
      and the repair is to falsify in the place the thing actually runs.
      and a planted staged probe SHALL make it fail — **and the arms that prove it SHALL be
      recorded.**

## 5. The budget

- [x] 5.1 The shared budget stays shared — **`tests/architecture/scan-budget.ts`**, taken by both
  **Held.** `tests/architecture/scan-budget.ts` is taken by both suites, and no file copies the
      constant back.
      suites — and **no file copies the constant back.**
- [x] 5.2 The record SHALL say what the budget is for **after** this change: **a ceiling on a
  **Done:** a ceiling on a test's cost **and on its blast radius**, because a timeout is no
      longer destructive. **The two cases that timed out will still time out** — the difference is that
      the tree is untouched when they do.
      test's cost and on its blast radius**, because a timeout is no longer destructive.

## 6. The gate

- [x] 6.1 `pnpm verify` — exit `0`, three times, with `PLAYWRIGHT_BROWSERS_PATH` pointed at a
  **Measured: exit `0`, three times, on a tree measured settled before the first run, and
      `git status` clean before and after each.**
      directory measured empty, **and `git status` clean before and after each run.**
- [x] 6.2 The architecture suite, **run under six spinning `node` processes**, leaves **the tree
  **Measured: the tree is unchanged.** The run's own exit was `1` for a reason that is not a
      failure of anything — a vitest worker RPC timeout, *"Timeout calling onTaskUpdate"* — **and every
      one of the 126 cases passed.** **That is the shape the repository's own standard describes: a
      timeout means only that the machine was busy.**
      unchanged** — measured by the check, not by hand.
- [x] 6.3 `openspec validate --specs --strict` — **15 passed, 0 failed**.
  **Measured: 15 passed, 0 failed.**
- [x] 6.4 The change's own falsification pass: every deliberate violation caught **by the assertion
  **Measured: three arms, every one caught by the assertion it was aimed at**, with
      `wrongcatch`, `green`, `noop`, `nocompile` and `harness-error` all zero, and the tree restored
      byte-identically against a digest taken before the first mutation.
      it was aimed at**, with `wrongcatch`, `green`, `noop`, `nocompile` and `harness-error` all zero,
      and every file restored byte-identical against a digest taken before the first mutation.

## 7. The record

- [x] 7.1 Record in `AGENTS.md` and `docs/ROADMAP.md` the change's finding, the measurement each
  **Done.** The record is at the **top** of both ledgers' change entries, because the two order
      them newest-first. **And it carries the correction to the ASI record's asserted cause** — *"the
      suite's own probes left in the tree by a cancelled run"* — **in the same paragraph as the claim
      it corrects**, so a reader cannot meet one without the other. **The roadmap's cursor is rewritten
      rather than edited clause by clause**, because every sentence in it described the previous change
      and a clause swap would have left its measurement attached to this change's name.
      claim rests on, **and the correction to the ASI record's asserted cause.**
- [x] 7.2 **Replace the manual remedy** — *check `git status` before every gate run* — **with the
  **Done.** The manual remedy — *check `git status` before every gate run* — **is not a remedy: it
      is a habit, and it named one of the two mutated files.** **It is replaced by the property**, and
      the property is mechanical: the teardown compares the shipped tree against a fingerprint taken
      before any test ran, and a difference **fails the run** and names the paths — **so it covers both
      files, and every file.**
      property**, and say what replaced it.
- [x] 7.3 Record **what the change does not establish** — that the suite is deterministic under every
  **Done**, in both ledgers: the suite is **not** deterministic under every load, **the two cases
      that timed out will time out again**, and the gate is **not** proven deterministic under every
      load — **the measurement is a table of runs and not a proof.** **And a staged probe can still be
      left behind**; what changed is that it is now **harmless rather than impossible**.
      load is a table of runs and not a proof, **and that a staged probe can still be left behind,
      and is now harmless rather than impossible.**
