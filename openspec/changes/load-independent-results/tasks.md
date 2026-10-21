# Load-independent results — tasks

## 1. The repair

- [x] 1.1 `apps/extension/src/Panel.test.tsx` — the case *"names the mailbox this page resolves
      to and the provider that served it"* SHALL **wait on the panel's own `panel-address` handle**
      and then **assert the accessible name once, synchronously**.
- [x] 1.2 `apps/extension/src/Popup.test.tsx` — the case *"names the provider that served the
      mailbox, not the one it will reach first"* SHALL **wait on the popup's own address text** and
      then **assert the accessible name once, synchronously**.
- [x] 1.3 **No shipped file changes.** `apps/extension/src/Panel.tsx` and `Popup.tsx` SHALL be
      byte-identical to `main`, because **both surfaces already carry a cheap handle** and the
      product does not grow a hook for a test.
- [x] 1.4 **No budget is raised.** The wait's budget SHALL be Testing Library's default, and the
      expensive query SHALL run outside any budget — because **a hand-picked ceiling is the recorded
      defect with a larger number**, and there is no ceiling that is right on a machine whose cost
      moves.

## 2. The requirement

- [x] 2.1 A `MODIFIED` on `build-and-verification`'s **"A passing test run asserts something"**,
      and **not an `ADDED` sibling** — because the requirement already carries the property, and
      **two requirements about one subject is the shape this repository has recorded as a second
      spelling of a set.**
- [x] 2.2 It SHALL carry **all four** of the requirement's existing scenarios forward, byte for
      byte, **because a `MODIFIED` requirement replaces the whole block.**
- [x] 2.3 The amendment SHALL say that **a result that depends on the machine rather than on the
      tree is not a result** — **for a pass as well as for a failure**, because the requirement
      already forbids reporting a busy-machine red as a result and **a busy-machine green is a claim
      about nothing.**
- [x] 2.4 The amendment SHALL carry a **scenario** for it, because a requirement whose clause has
      no scenario is a clause nothing checks.

**Recorded at proposal (2026-10-21).** The delta was authored at the proposal stage and is the
change's own record of what it asks of the specification. The carry-forward was **mechanical
rather than by reading**: the requirement block was extracted from the promoted file and the new
material spliced into it, and the builder's own self-test reports **five scenario headings in the
delta, of which four are byte-identical to the promoted ones and one is new**.

**Recorded at sync (2026-10-21).** The block is **promoted** into
`openspec/specs/build-and-verification/spec.md`, and the promotion was **rehearsed in full on a
throwaway copy of `openspec/` before it touched the real tree** — **and the real promotion
produced the rehearsal's exact SHA-256**, so the rehearsal was faithful rather than approximately
so. **The promoted block is byte-identical to the delta's**, verified by a reader that **shares no
reader with the promoter** and whose own self-test is **5 of 5 in both argument orders**.

## 3. The falsification

- [x] 3.1 **Five deliberate violations**, each caught **by the assertion it was aimed at**, with
      `wrongcatch`, `green`, `noop` and `harness-error` **all zero**.
- [x] 3.2 The five arms: the panel's address section **keeps its testid and loses its heading**;
      the panel's address section **loses its testid**; the panel's heading **names the preferred
      provider**; the popup's heading **names the preferred provider**; the popup's address text
      **is gone**.
- [x] 3.3 **Every mutated file restored byte-identical**, verified against a SHA-256 taken
      **before** the mutation — and the restoration unconditional, because **an instrument that
      leaves the tree it measured is worse than no instrument.**
- [x] 3.4 **The instrument lives outside the repository** and is deleted afterwards, because **a
      measuring instrument is not a shipped file.**

## 4. The measurement

- [x] 4.1 **The baseline, on `main` at `74c99a8`, before the repair**: the full unit suite
      **red in 3 of 5** runs, always the same named case, and **green in 6 of 6** for that file
      alone.
- [x] 4.2 **The cause, measured rather than argued**: the section arrives in **42–108 ms**; the
      accessible-name query costs **170–430 ms** and succeeds; the case's old form took
      **366 ms to 1413 ms** against a **1000 ms** default.
- [x] 4.3 **The table after the repair**: the full unit suite **green in N of N** runs, with N
      stated, and every red named.
- [x] 4.4 **A run with no tier summary is a harness error** and not a pass — because the first
      version of this change's own reader recognised only the red shape and reported five green
      runs as five harness errors.

## 5. The gate

- [x] 5.1 `pnpm verify` — exit `0`, three times, with `PLAYWRIGHT_BROWSERS_PATH` pointed at a
      directory measured empty.
- [x] 5.2 `openspec validate --specs --strict` — **15 passed, 0 failed**.
- [x] 5.3 `pnpm test` — the per-project counts **re-measured** from a `--reporter=json` run and
      **not carried forward**, because **a count nobody re-ran is a count nobody checked.**

## 6. What the change does not establish

- [x] 6.1 That the suite is free of load-dependence. **This change repairs the two sites the
      measurement named, and a red that never named the others is not evidence that they are
      sound.**
- [x] 6.2 That a green run proves anything beyond what it measures. **The table is a table of
      runs, not a proof.**
- [x] 6.3 Anything about the machine's speed. **The measurement is of this machine's this load; the
      property is that the query's cost is no longer inside a budget.**

---

## Recorded at apply (2026-10-21)

**The baseline, measured on `main` at `74c99a8` before the repair.** The full unit suite, run
five times, with every red **named**:

```text
run 1: RED -- the panel renders the mailbox beside the page > names the mailbox this page resolves to and the provider that served it
run 2: RED -- (the same case)
run 3: RED -- (the same case)
run 4: green
run 5: green
=== 5 runs: 2 green, 0 harness-error
  3x  the panel renders the mailbox beside the page > names the mailbox this page resolves to and the provider that served it
```

**And the same file alone, six times: green in 6 of 6.** **⇒ Load-sensitive, and the tree did not
change between a red and a green.**

**The cause, measured rather than argued.** Three instrumented runs of the case, each reporting
where the time went:

| what was measured | what it cost |
| --- | --- |
| the address section arriving on screen | **42–108 ms** |
| the accessible-name query for the heading, run **after** the answer was already on screen | **170–430 ms**, and it **succeeds** every time |
| the case's old form, end to end | **366 ms to 1413 ms** |

**⇒ The heading was never late. The query was slow, and the wait's budget was spent on it.**
Testing Library's default budget is **1000 ms**, and the two costs together cross it about half
the time on a loaded machine.

**The table after the repair: 20 of 20 green, 0 harness-error.** And the branch's diff is
**byte-identical to the patch the table was measured on** — SHA-256
`cf36eb5e4d9cdc8aad97fd3230c88e7033d5559ef55f884df558ac9dc3e7f8d0` on both — **so the table
measured exactly this content and not a tree that changed afterwards.**

**The falsification: 5 of 5 caught, by the assertion each was aimed at.**

```text
A: the panel's address section keeps its testid and loses its heading
   CAUGHT by the heading assertion -- Unable to find an accessible element with the role "heading" and name "guerrilla"
B: the panel's address section loses its testid
   CAUGHT by the wait for the section -- Unable to find an element by: [data-testid="panel-address"]
C: the panel's heading names the preferred provider, not the one that served
   CAUGHT by the heading assertion -- Unable to find an accessible element with the role "heading" and name "guerrilla"
D: the popup's heading names the preferred provider, not the one that served
   CAUGHT by the heading assertion -- Unable to find an accessible element with the role "heading" and name "guerrilla"
E: the popup's address text is gone, so the wait cannot establish the section
   CAUGHT by the wait for the address -- Unable to find an element with the text: shadow@sharklasers.com
=== 5 arms: caught=5 wrongcatch=0 green=0 noop=0
```

**Every mutated file restored byte-identical**, against a SHA-256 taken **before** the mutation,
and the restoration was unconditional — **because an instrument that leaves the tree it measured
is worse than no instrument.** **The two product files the arms mutated are byte-identical to
`main` afterwards**, which is also the measurement behind task 1.3.

**And two defects in this change's own instruments, both of which reported a confident wrong
answer before they were repaired.**

- **The reader that counted the runs recognised only the red shape.** Its pattern required the
  word `failed`, so a green run matched nothing and **five green runs were reported as five
  harness errors** — **a reader that matches one shape of the answer reports the other shape as
  the absence of an answer.** Both shapes are read now.
- **The first version of the attribution reader expected a message that is not the one Testing
  Library emits.** It looked for `Unable to find role="heading"` where the message is `Unable to
  find an accessible element with the role "heading"`, and so **four arms were reported as
  `wrongcatch` when every one of them had been caught by the assertion it was aimed at.** The
  reader now reads the message out of the output rather than matching a pattern guessed in
  advance. **A confident wrong answer from an unnamed reader is indistinguishable from a real
  defect until the reader itself is read.**

**The gate: `pnpm verify` exit `0` three times**, with `PLAYWRIGHT_BROWSERS_PATH` pointed at a
directory measured to hold **0 entries**, and **1378 tests across 74 files** on every run.
`openspec validate --specs --strict` — **15 passed, 0 failed**.

**The counts, re-measured from a `--reporter=json` run and grouped by workspace member rather
than read off a summary line:**

```text
TOTAL  1378 tests across 74 files
apps/extension 490 (22)   apps/web 143 (8)      packages/core 54 (6)
packages/mail-parser 149 (5)   packages/mailbox 172 (6)   packages/providers 92 (7)
packages/storage 103 (8)      packages/ui 49 (6)          tests/architecture 126 (6)
```

**Every figure is identical to the one the ledger carried before this change**, and **that is
the measurement rather than a coincidence**: the repair adds no test and removes none. **A change
that touched a count would have had to say so.**

**And the limits, recorded rather than smoothed over.** **The suite is not proven free of
load-dependence.** This change repairs the two sites the measurement named, and **a red that never
named the others is not evidence that they are sound** — so the requirement says a result must not
depend on the machine, and a site that does is a failure of the requirement, which is the honest
position. **The table is a table of runs, not a proof.** And the numbers above are **this**
machine's **this** load: **the property the repair establishes is that the query's cost is no
longer inside a budget**, which is a property of the test and not of the hardware.

---

## Recorded at sync (2026-10-21)

**One `MODIFIED` promoted, and the totals moved by zero requirements and one scenario.**

```text
before: 190 requirements and 625 scenarios across 15 capabilities
after:  190 requirements and 626 scenarios across 15 capabilities
```

**And the zero in the requirement column is the arithmetic working and not a promotion that
missed** — **a `MODIFIED` block replaces rather than adds**, so `build-and-verification` went
**14 requirements / 46 scenarios → 14 / 47** and **the other fourteen capabilities are identical**
— which is the measurement the count exists for.

**The promotion was rehearsed in full on a throwaway copy of `openspec/` before it touched the
real tree.** The rehearsal and the real promotion produced **the same SHA-256 of the promoted
file** (`4c2284802747036c…`), so the rehearsal was **faithful rather than approximately so** — and
**the real tree was measured to be untouched by the rehearsal**.

**The promoter and the verifier share no reader.** The promoter walks the text with `indexOf` and
a search for the next heading; **the verifier splits whole text by regex** and compares **whole
blocks** — **because a count cannot detect a wrong block**. **The verifier's own self-test is 5 of
5 in both argument orders** (the flag first and the flag last), because **a reader that only
parses one order is half a reader**, and its negative control requires the unsabotaged text to
report no difference, or **a reader that named one for everything would satisfy the case**.

**And the promoter's three guards were falsified separately, and every one refused with exit `1`
and left the file byte-identical** — because **a guard that refuses and still writes is not a
guard**, so each arm measured the file's digest and not the exit code alone:

| the arm | what it would have done | what happened |
| --- | --- | --- |
| a `MODIFIED` landing on a heading the promoted spec does not carry | **a silent substitution wearing the name of an addition** | `REFUSING`, exit `1`, the file byte-identical |
| the same heading twice in the promoted spec | **replacing one of two is a coin flip** | `REFUSING`, exit `1`, the file byte-identical |
| a block carrying no scenario | **a requirement is not a heading** | `REFUSING`, exit `1`, the file byte-identical |

**And the promoter is idempotent**: a second run reports *"already promoted; nothing written"* and
leaves the file byte-identical — **because a tool that reports a promotion it did not perform is a
tool whose report nobody can trust**.

**`openspec validate --specs --strict` — 15 passed, 0 failed.**
