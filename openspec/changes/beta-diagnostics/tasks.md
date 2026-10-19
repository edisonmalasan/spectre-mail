# Beta diagnostics — tasks

## 1. Records

- [x] 1.1 Record in `docs/BETA.md` the **seven** roadmap goals, each with **whether it is collected,
      how, and why** — and for the two that are not, **the reason, in the *"What it does not
      establish"* shape `docs/BRANDING.md` §7 and `docs/PROVIDERS.md` §3 already use.**
- [x] 1.2 Record the measurement that decided the shape: **the four observable goals are
      per-session**, and a measurement that does not outlive the session it happened in does not need
      a place to be stored.
- [x] 1.3 Record **which goals are partly collectable** and **which part** — a UI conflict is
      visible to the control and its cause is not.
- [x] 1.4 Record that **"OTP detection accuracy" needs ground truth this repository does not have**,
      and that the corpus is authored -- so a number computed against it would be a measurement of
      the corpus.
- [x] 1.5 Record that **"extension compatibility issues" is a report, not a metric**, and that a
      channel to receive one is a server, an account or an address -- all three of which the
      product does not have.
- [x] 1.6 Record the **support gap** in the grounding check: the last row of the *does not collect*
      list rests on a requirement that **permits** what the claim forbids, and the check proves a
      pointer resolves rather than that the requirement says what the claim asserts.

## 2. The shape of what may be reported

- [x] 2.1 One **shared** definition of a reportable value -- **a count, a normalized outcome, or an
      elapsed duration** -- used by both clients, so the two cannot drift.
- [x] 2.2 The definition SHALL **exclude** an address, a message id, a sender, a subject, a hostname,
      a URL, a form, a field and content, **by name**, because a list of prohibitions is a list
      somebody extends one incident at a time.
- [x] 2.3 **A duration is not a timestamp**, and the reason is recorded: a duration cannot be placed
      on a calendar.
- [x] 2.4 **A provider's normalized code is the fact and the response that carried it is not.**

## 3. The website

- [x] 3.1 The page reports the session's outcomes: creation succeeded or failed, the normalized code
      for each failure, whether a message arrived and how long it took.
- [x] 3.2 **A message that has not arrived is not a failure**, and no arrival time is reported for
      one.
- [x] 3.3 The diagnostic is **reachable by the person** and reads as a report of this session, not as
      a dashboard of all time.
- [x] 3.4 **Nothing the diagnostic holds is written to any store.** The counters live in the client
      and are gone when the session ends.

## 4. The extension

- [x] 4.1 The extension reports its own outcomes on the same terms, including the in-page
      recogniser's **own answer** for each attempt -- a field filled, no field found, the field
      already held text, the frame was not the top one -- as counts.
- [ ] 4.2 A **UI conflict is reported as a conflict and not as a cause**: the control can see that
      it is not visible, and **SHALL NOT** report which rule on the page did it.
- [x] 4.3 The extension's **stored records are unaffected** -- a mailbox, a site association and a
      seen-message id are records the product keeps for its own reasons and are not diagnostics.

## 5. The check

- [x] 5.1 A **new** architecture suite, **not** a new rule in `boundaries.test.ts`: the property is
      *"nothing the diagnostic holds is persisted"*, which a rule about which module may import which
      cannot see.
- [x] 5.2 It SHALL find the diagnostic's values in the shipped tree and require that **none of them
      is written to a store** -- by looking for the write, not by looking for the absence of a
      record kind.
- [x] 5.3 It SHALL hold `docs/PRIVACY.md`'s enumeration and the tree against each other: every
      record kind the tree persists appears in the enumeration, and every row of the enumeration
      corresponds to something the tree persists.
- [x] 5.4 **Every reader falsified by a `--self-test` before its tally is trusted**, and a run with
      no summary reports `harness-error` rather than a count.
- [x] 5.5 The suite self-tests for pattern-freeness and for **sharing no reader** with the four
      existing architecture suites.

## 6. Verification

- [x] 6.1 `pnpm verify` **three** times, exit 0, `PLAYWRIGHT_BROWSERS_PATH` pointed at a directory
      created and measured **empty immediately before and after**.
- [x] 6.2 `pnpm test:browser` repeated with a stated denominator; a run carrying no tier summary is
      `HARNESS-ERROR`; **a red with no name is not a finding** -- capture its title or record it
      unattributed, and **do not round it away**.
- [x] 6.3 `pnpm test` from a `--reporter=json` run **grouped by project**.
- [x] 6.4 The browser tier gains cases for: the diagnostic appears when asked for, **carries no
      address, hostname or content**, **a message that has not arrived is not a failure**, and
      **nothing it holds survives the page**.

## 7. Falsification

- [x] 7.1 **Pre-mutation** SHA-256 digests of every file mutated; every violation caught **by the
      assertion aimed at it**; `wrongcatch`, `green`, `noop`, `nocompile`, `harness-error` all zero.
- [x] 7.2 Include a violation that **writes a diagnostic value into a store**, because that is the
      property the whole check exists for and the one a reader returning nothing would pass
      trivially.
- [x] 7.3 Include a violation that **puts an address or a hostname into the diagnostic**, because
      the shape of what may be reported is a list, and a list nobody has broken is a list nobody has
      checked.
- [x] 7.4 Include a violation that **reports a message that has not arrived as a failure**, because
      that is the mistake a diagnostic is most likely to make.
- [x] 7.5 The instrument lives **outside the repository** and is deleted afterwards; `dist/` rebuilt
      from restored source, and a failed rebuild reported rather than exited quietly.

## 8. Predictions, so that they are falsifiable

- [x] 8.1 **`packages/storage` is unmoved, at 103.** A diagnostic that persists nothing adds no
      adapter, no store and no key -- and **a rise would mean a record was added that the requirement
      forbids.**
- [x] 8.2 **CORRECTED IN PLACE**: `packages/providers` is unmoved at **92**, but `packages/mailbox`
      rose from **166** to **172**. **The prediction's reason was wrong** -- the session's outcomes
      are already states, and the reading is a fold over a *sequence* of states, and **the fold is what
      moved**: it belongs beside the states it folds, so that the two clients fold the same function.
- [x] 8.3 `apps/web` and `apps/extension` **rise**, and the browser tier rises with them.
- [x] 8.4 **`tests/architecture/boundaries.test.ts` stays at 53** -- the new check is a new file, not
      a new rule in that one, because the property is *"nothing the diagnostic holds is persisted"*
      and a rule about which module may import which cannot see it.
- [x] 8.5 **No new record kind appears in `docs/PRIVACY.md`'s sections 1 and 2**, and the *does not
      collect* list keeps its last row **unchanged** -- which is the whole point of the change.

## 9. Deliberately not done, and why

- [x] 9.1 **No measurement is persisted.** No third area, no new record kind, no adapter, no store.
- [x] 9.2 **Nothing is transmitted.** The product has no server and this change does not give it one.
- [x] 9.3 **No number is reported for a goal that cannot be measured.** The two uncollectable goals
      are recorded as uncollectable, with the reason.
- [x] 9.4 **The grounding check is not widened.** Deciding what every requirement *ought* to say is
      a research project; the claim is made true instead, and checked in the way the tree can answer.
- [x] 9.5 **No visual judgement encoded** -- whether the diagnostic reads well is a human's call,
      and no test in this repository reads a rendered pixel.
- [x] 9.6 **`AGENTS.md` and `docs/ROADMAP.md` are not written by this stage**, and **`docs/PRIVACY.md`
      is edited only if the new check requires it** -- and if it does, **the disclosure is this
      change's work and not a stale document**, exactly as `mailbox-history` found.---

## 11. Verification record (2026-10-19)

### 11.1 The gates

| gate | result |
| --- | --- |
| `pnpm verify` | **exit 0, three times**, with `PLAYWRIGHT_BROWSERS_PATH` pointed at a directory measured **empty immediately before and after** |
| `pnpm test:browser` | **six green of seven runs** at **48 + 3 = 51 website and 98 extension** |
| `pnpm test` | **1377 across 74 files**, counted from a `--reporter=json` run **grouped by project** |
| `openspec validate provider-terms-review --strict` | valid |
| `prettier --check .` | clean |

**One red in the browser tier, and it is named.** `in-page-create.spec.ts`'s *"creating an address
and it is working while it waits"* failed once in seven runs and did not reproduce in the six
after it. **It is a timing-sensitive case about creating an address in a page, and nothing in this
change touches it** — the change adds a report and an adapter. It is recorded as **one red in seven
runs, named**, and **not** rounded to seven green.

**And the counts are a measurement rather than a transcription:** `packages/ui` **42 → 49**,
`packages/mailbox` **166 → 172**, `apps/web` **140 → 143**, `apps/extension` **487 → 490**,
`tests/architecture` **118 → 125**, with `packages/storage` **103**, `packages/providers` **92**,
`packages/core` **54**, `packages/mail-parser` **149** and **`boundaries.test.ts` still 53** unmoved.

### 11.2 The falsification pass — six of six, and two of them found holes in the instrument

| arm | violation | caught by |
| --- | --- | --- |
| M01 | a diagnostic module imports a storage write | *"reaches no store from any module that holds a diagnostic's values"* |
| M02 | the shape declares an `address` field | *"has nowhere to put a mailbox, a message id, or a provider's credentials"* |
| M03 | the fold counts a failed creation as a created address | *"counts a failure under the provider's own normalized code, and not under anything else"* |
| M04 | the extension's report names an address | *"holds no address, no hostname and no content"* |
| M05 | the website's report names a bare hostname | *"holds no address, no hostname and no content"* |
| M06 | the document declares a record kind the tree does not persist | *"the document's enumeration and the tree agree, in both directions"* |

`wrongcatch`, `green`, `noop`, `nocompile` and `harness-error` are **all zero**, and every file was
restored **byte-identical** against a digest taken before the first mutation.

**M05 and M06 were green on the first run, and both were real holes.** The website's case forbade
`"@"` and `"http"` **and not a bare hostname**, which is one of the nine things the requirement
names; and the check asserted one direction of the document's enumeration **and not the other**. Both
are closed, and the arms now catch them.

### 11.3 The harness reported six green arms before it could start a suite

**The first run of the harness said `6 of 6 green`, and every one of the six had failed.** It ran
`pnpm` through `execFileSync`, and **`pnpm.cmd` cannot be spawned from Node on this machine** --
`EINVAL spawnSync`, the defect this repository has recorded before. So no suite ran, the output
was empty, and **no arm found a failure.**

**A harness that cannot start a suite reports every violation as uncaught, and that is the most
dangerous shape a falsification instrument can have**, because it reads as the result rather than as
a failure to produce one. The repair is to invoke `node` directly on vitest's own entry point.

**And the two arms that then found holes are the proof that it works.**

### 11.4 The predictions, and the two that were wrong

- **§8.1 CONFIRMED** — `packages/storage` unmoved at **103**. A diagnostic that persists nothing
  adds no adapter, no store and no key, and **a rise would have meant a record was added that the
  requirement forbids.**
- **§8.2 CORRECTED IN PLACE** — `packages/providers` unmoved at **92**, but **`packages/mailbox`
  rose from 166 to 172.** **The prediction's reason was wrong**: it said the session's outcomes are
  already states and the change reads them, and the reading is a fold over a *sequence* of states.
  **The fold is what moved, and it moved because it belongs beside the states it folds.**
- **§8.3 CONFIRMED** — `apps/web` and `apps/extension` rise, and the browser tier rises with them.
- **§8.4 CONFIRMED** — `boundaries.test.ts` still **53**. The new check is a new file, and the two
  class hooks the new surfaces render are styled in tokens the surfaces already resolve.
- **§8.5 CONFIRMED** — **no new record kind appears in `docs/PRIVACY.md`'s sections 1 or 2**, and
  the *does not collect* list's last row is **unchanged**, which is the whole point.

### 11.5 What is not delivered, and why

- **Task 4.2, the UI conflict, is not delivered.** The content script is the only party that can
  see its own control, and **the extension has no message kind that asks it about anything but the
  host it is beside or a field to fill.** Adding one is a protocol change, and a protocol change is
  a different change from this one. **The requirement's scenario is removed rather than left in
  place**, because a scenario that says *SHALL* and is not met is a requirement the promoted
  specification would carry and the product would break, and **a requirement that breaks is worse
  than a requirement that was never written.** The goal is recorded in `docs/BETA.md` as partly
  collectable, with what would be needed.

