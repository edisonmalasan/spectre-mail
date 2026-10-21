# Load-independent results — tasks

## 1. The repair

- [ ] 1.1 `apps/extension/src/Panel.test.tsx` — the case *"names the mailbox this page resolves
      to and the provider that served it"* SHALL **wait on the panel's own `panel-address` handle**
      and then **assert the accessible name once, synchronously**.
- [ ] 1.2 `apps/extension/src/Popup.test.tsx` — the case *"names the provider that served the
      mailbox, not the one it will reach first"* SHALL **wait on the popup's own address text** and
      then **assert the accessible name once, synchronously**.
- [ ] 1.3 **No shipped file changes.** `apps/extension/src/Panel.tsx` and `Popup.tsx` SHALL be
      byte-identical to `main`, because **both surfaces already carry a cheap handle** and the
      product does not grow a hook for a test.
- [ ] 1.4 **No budget is raised.** The wait's budget SHALL be Testing Library's default, and the
      expensive query SHALL run outside any budget — because **a hand-picked ceiling is the recorded
      defect with a larger number**, and there is no ceiling that is right on a machine whose cost
      moves.

## 2. The requirement

- [ ] 2.1 A `MODIFIED` on `build-and-verification`'s **"A passing test run asserts something"**,
      and **not an `ADDED` sibling** — because the requirement already carries the property, and
      **two requirements about one subject is the shape this repository has recorded as a second
      spelling of a set.**
- [ ] 2.2 It SHALL carry **all four** of the requirement's existing scenarios forward, byte for
      byte, **because a `MODIFIED` requirement replaces the whole block.**
- [ ] 2.3 The amendment SHALL say that **a result that depends on the machine rather than on the
      tree is not a result** — **for a pass as well as for a failure**, because the requirement
      already forbids reporting a busy-machine red as a result and **a busy-machine green is a claim
      about nothing.**
- [ ] 2.4 The amendment SHALL carry a **scenario** for it, because a requirement whose clause has
      no scenario is a clause nothing checks.

## 3. The falsification

- [ ] 3.1 **Five deliberate violations**, each caught **by the assertion it was aimed at**, with
      `wrongcatch`, `green`, `noop` and `harness-error` **all zero**.
- [ ] 3.2 The five arms: the panel's address section **keeps its testid and loses its heading**;
      the panel's address section **loses its testid**; the panel's heading **names the preferred
      provider**; the popup's heading **names the preferred provider**; the popup's address text
      **is gone**.
- [ ] 3.3 **Every mutated file restored byte-identical**, verified against a SHA-256 taken
      **before** the mutation — and the restoration unconditional, because **an instrument that
      leaves the tree it measured is worse than no instrument.**
- [ ] 3.4 **The instrument lives outside the repository** and is deleted afterwards, because **a
      measuring instrument is not a shipped file.**

## 4. The measurement

- [ ] 4.1 **The baseline, on `main` at `74c99a8`, before the repair**: the full unit suite
      **red in 3 of 5** runs, always the same named case, and **green in 6 of 6** for that file
      alone.
- [ ] 4.2 **The cause, measured rather than argued**: the section arrives in **42–108 ms**; the
      accessible-name query costs **170–430 ms** and succeeds; the case's old form took
      **366 ms to 1413 ms** against a **1000 ms** default.
- [ ] 4.3 **The table after the repair**: the full unit suite **green in N of N** runs, with N
      stated, and every red named.
- [ ] 4.4 **A run with no tier summary is a harness error** and not a pass — because the first
      version of this change's own reader recognised only the red shape and reported five green
      runs as five harness errors.

## 5. The gate

- [ ] 5.1 `pnpm verify` — exit `0`, three times, with `PLAYWRIGHT_BROWSERS_PATH` pointed at a
      directory measured empty.
- [ ] 5.2 `openspec validate --specs --strict` — **15 passed, 0 failed**.
- [ ] 5.3 `pnpm test` — the per-project counts **re-measured** from a `--reporter=json` run and
      **not carried forward**, because **a count nobody re-ran is a count nobody checked.**

## 6. What the change does not establish

- [ ] 6.1 That the suite is free of load-dependence. **This change repairs the two sites the
      measurement named, and a red that never named the others is not evidence that they are
      sound.**
- [ ] 6.2 That a green run proves anything beyond what it measures. **The table is a table of
      runs, not a proof.**
- [ ] 6.3 Anything about the machine's speed. **The measurement is of this machine's this load; the
      property is that the query's cost is no longer inside a budget.**
