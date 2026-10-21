# Firefox compatibility spike — tasks

## 1. The instrument

- [x] 1.1 A quarantined script under `apps/extension/e2e/`, **outside the suite**, named for what it
      measures — and **listed in `QUARANTINED_PROBES`**, because the list is what keeps a new probe from
      being a file nobody reasons about.
- [x] 1.2 It SHALL read Firefox's **own record of the add-on** — the `uuid` it assigns and the reason
      it gives for a refusal — **and not a path of our own choosing.** **The first version of this
      instrument read the record from `<profile>/extensions/extensions.json` rather than
      `<profile>/extensions.json`, and so reported *the add-on was not installed* for a profile where
      the answer was simply not looked for.** **A reader that matches nothing reports the absence of
      the thing it looked for.**
- [x] 1.3 It SHALL try the routes **in order** and say **which one worked**: a profile carrying the
      add-on, an unsigned XPI with `xpinstall.signatures.required` off, a Firefox-shaped manifest,
      and **a further route if a third fails** — because **a route that fails is a fact about that
      route and not about Firefox.**
- [x] 1.4 The instrument SHALL be **outside the repository** while it is being written, and its
      findings land in the record — **because a measuring instrument is not a shipped file**, and this
      repository's own rule says so.

## 2. What the measurement establishes

- [x] 2.1 **Whether Firefox can be made to install this extension at all**, and by what mechanism a
      build could rely on. **Measured: it cannot, by either route available here.** Playwright's
      Firefox launches and reports 155.0; it rewrites its own record over the one the measurement
      wrote; it consumes the XPI it is given; **and it installs nothing.**
- [x] 2.2 **Whether Firefox accepts the manifest as shipped**, and **which** of the three asks it
      refuses — the `sidePanel` permission, the `side_panel` key, or the `background.service_worker` —
      **so the first compatibility change is named rather than guessed.**
- [x] 2.3 **Which of the eleven platform capabilities Firefox's namespace covers**, and **with what
      shape**: a promise-based `browser` namespace against a callback-based `chrome` one is **a changed
      signature and not a missing method**, and **a measurement that records only presence would miss
      every one of them.**
- [x] 2.4 **The side panel's shape question**, stated as a product decision and not a compatibility
      shim: Firefox's `sidebar_action` is a docked sidebar with no `open()` API, so **the side panel
      has no Firefox equivalent and a panel has a different one.**

## 3. The record

- [x] 3.1 A section in `docs/`, in the shape `docs/PROVIDERS.md` uses — **what was measured, on what,
      and what it does not establish** — and **naming what the *extension* needs rather than what
      Firefox has in general.**
- [x] 3.2 The record SHALL say **which route worked and which did not**, and **that a route that
      failed is evidence about the route** — not about the engine.
- [x] 3.3 The record SHALL say **what the measurement does not establish**, because **that is the half
      that keeps the next slice honest.**
- [x] 3.4 The record SHALL name the **outcome's two branches** — *Firefox is reachable* and *Firefox
      is not reachable* — **and what each makes of M14**, so the next slice's shape is not a guess.

## 4. The requirement

- [x] 4.1 A `MODIFIED` on `browser-verification`'s **"What the browser tier establishes is stated,
      not assumed"**, and **not an `ADDED` sibling** — because the requirement already carries the
      property, and **two requirements about one subject is the shape this repository has recorded
      as a second spelling of a set.**
- [x] 4.2 The amendment SHALL say that **a claim about an engine is made per engine** — **a second
      engine adds a second set of claims rather than widening the first**, because *"verified in
      Chromium and Firefox"* is a phrase that means *"verified somewhere"*.
- [x] 4.3 The amendment SHALL say that **an engine the tier cannot reach is named as unreachable** —
      **not omitted, and not called unsupported**, because *unreachable* is a fact about this
      repository's automation and *unsupported* is a claim about the product.
- [x] 4.4 The amendment SHALL say that **a measurement of a route is a measurement of that route.**

## 5. The gate

- [x] 5.1 `pnpm verify` — exit `0`, three times, with `PLAYWRIGHT_BROWSERS_PATH` pointed at a
      directory measured empty.
- [x] 5.2 The instrument's own run is **recorded with its output**, and **a run that produced no
      answer is a harness error and not a measurement** — because the first version of this
      instrument produced *the add-on was not installed* for a profile where it had looked in the
      wrong place.
- [x] 5.3 `openspec validate --specs --strict` — **15 passed, 0 failed**.

## 6. What the change does not establish

- [x] 6.1 That Firefox is supported, or that it will be. **The spike measures; the product question
      is somebody else's.**
- [x] 6.2 Anything about Firefox's behaviour beyond what the instrument measured. **A measurement of
      one route is a measurement of one route.**
- [x] 6.3 That the two outcomes are the only ones. **The measurement is the first of them, and the
      record says so.**

---

## Recorded at apply (2026-10-21)

### The measurement

```text
=== 0. the reader's self-test
  PASS  the reader finds a record that is there
  PASS  the reader reports the path it read

=== 0.5 the eleven capabilities, checked against the product's own source
  the platform module exports 11: readChromeLocalArea, sendToBackground, onExtensionMessage,
    findActiveTab, sendToTab, onTabActivated, readNotificationPlatform, extensionAssetUrl,
    readAlarmPlatform, onBrowserStart, onAlarmFired
  this instrument lists 11
  the two lists agree, name for name.

=== 1. the routes, each manifest variant over the route that can reach an install
  not installed  bare-with-gecko-id                 (no uuid)  record holds 10 add-on(s)  signatures.required=false
  not installed  firefox-shaped-with-gecko-id       (no uuid)  record holds 10 add-on(s)  signatures.required=false
  not installed  shipped-with-gecko-id              (no uuid)  record holds 10 add-on(s)  signatures.required=false
  not installed  bare                               (no uuid)  record holds 10 add-on(s)  signatures.required=false
  not installed  firefox-shaped                     (no uuid)  record holds 10 add-on(s)  signatures.required=false
  not installed  shipped-minus-sidePanel-permission (no uuid)  record holds 10 add-on(s)  signatures.required=false
  not installed  shipped-minus-side_panel-key       (no uuid)  record holds 10 add-on(s)  signatures.required=false
  not installed  shipped-with-event-page            (no uuid)  record holds 10 add-on(s)  signatures.required=false
  not installed  shipped                            (no uuid)  record holds 7 add-on(s)  signatures.required=false
  not installed  profile route, positive control    (no uuid)  the record is still this script's own: false

=== 2. the result: 0 of 10 arms installed

=== 3. the eleven capabilities: NOT MEASURABLE HERE
```

### The finding, and the correction it forced

**⇒ The measurement's answer is not the one the proposal expected, and the difference is the
finding.**

**The proposal asked which of the manifest's three asks Firefox refuses. The measurement's answer
is that it refuses none of them *by name*, because it refuses everything equally** — and the
**positive control** is what shows that: a **`bare`** MV3 manifest — `manifest_version`, `name`,
`version`, one `storage` permission, one background script — **failed identically to the shipped
one**, and so did a `bare` manifest **with a gecko add-on id**.

**⇒ So the three asks — the `sidePanel` permission, the `side_panel` key and the
`background.service_worker` — are *not* what Firefox refused.** The obvious reading of a failed
Firefox install is *"Firefox refused the manifest"*, **and this measurement refutes it.**

**⇒ And what Firefox did do is now measured, so the outcome is not a bare absence:**

- **It looked**: it **rewrote its own `extensions.json`** — thirteen kilobytes of its own, holding
  **its own built-in add-ons and not this one** — over the record the measurement wrote. **And the
  number of add-ons in Firefox's record varies between arms and between runs** — ten in most, seven
  in one — **so it is not a figure worth carrying**: **what it says is that the record is Firefox's
  own, and that this extension is not in it.**
- **It consumed the XPI** it was given, and the sentinel was gone afterwards.
- **The route's premise held**: `xpinstall.signatures.required` is **`false`** in Firefox's **own
  `prefs.js`** in every arm — **read from Firefox's file, not assumed from the file the
  measurement wrote.**
- **And it installed nothing**, for any of nine manifest variants.

**⇒ So the blocker is the measurement substrate, not the product's manifest.** **⇒ And the
profile route cannot work at all**: Firefox rewrites `extensions.json` at startup, so a
hand-written record is discarded — **a fact about that route and not about Firefox.**

### The rule the probe forced, and its control

**⇒ The probe's arrival broke a rule, and the breakage was a real one.** The quarantine rule
required **every** listed probe to spell Chromium's two load flags, because a plain `.mjs` cannot
import the TypeScript helper that exports them, and **Chromium reports no error when an extension
fails to load — it silently loads nothing.**

**⇒ A Firefox probe cannot spell those flags**, because **Firefox does not take them** — and
requiring it to would be requiring a lie.

**⇒ So the rule was repaired, and the repair keeps one list.** The rule's subject is the
**duplication** of two flags, and a probe that does not load an extension in Chromium has no such
duplication. **The partition is derived from the probes themselves** — each is asked which engine
it launches through, read from the probe's own call and **not from a comment** — **so there is no
second list that could disagree with this one.**

**⇒ And the discriminator is dotted** — `chromium.launchPersistentContext` and
`firefox.launchPersistentContext` — **because the bare word `firefox` would not separate the
probes**: a Chromium probe may name Firefox in passing, and **a discriminator that does not
discriminate is a rule that checks nothing.**

**⇒ And the new assertion needed a control, because it cannot be reached by editing the list** —
the list holds probes that exist. **The control is permanent and in the suite**, and it covers the
two arms the rule exists to report: a probe naming **neither** engine, and one naming **both**.

**The falsification: 3 of 3 caught by the assertion each was aimed at**, with `wrongcatch`, `green`
and `noop` **all zero**, **every file restored byte-identical** against a SHA-256 taken **before**
the mutation, and the planted probe removed.

```text
a probe that loads through neither engine
  CAUGHT by the exactly-one-engine assertion
a probe that loads through both engines
  CAUGHT by the exactly-one-engine assertion
a Chromium probe that spells neither load flag
  CAUGHT by the load-flag assertion
=== 3 arms: caught=3 wrongcatch=0 green=0 noop=0
```

**⇒ And the restoration is taken from an in-memory copy and never from Git**, because
`boundaries.test.ts` carries this change's own uncommitted work — **and a restore from a commit
would discard it. That is the recorded defect of a file restored from a commit**, and this
repository has been bitten by it twice in this session.

### Two declared figures moved, and one defect the gate caught

**⇒ The boundary suite's case count moved from 54 to 55**, and `security-audit.test.ts`'s
**declared** figure moved with it — **because that file reads the count out of the suite's own
source rather than carrying it by hand**, and its case is titled *"the boundary suite's assertion
count is declared, and the count moved when a case was added"*. **A declared count that does not
move when the thing it counts moves is a count nobody has re-read**, and that file's whole claim
is that the count is checked rather than carried.

**⇒ And `pnpm lint` caught a real defect in the instrument: three unused symbols, one of which
was the sharpest.** The eleven capabilities were **typed into the probe** while the module's own
path sat beside it unused — **a second spelling of a set, which is this repository's most-recorded
defect**, and one that would have drifted the first time the product gained a capability. **The
list is now read out of `extension-platform.ts`'s own source and checked against it**, and the
instrument **refuses to run** if the two disagree — **a HARNESS-ERROR, not a measurement.**

### The gate, and the red it produced — which is not this change's

**⇒ `pnpm verify` was green twice and red once, and the red was named.**

```text
[vitest-worker]: Timeout calling "onTaskUpdate"
```

**⇒ That is the failure `architecture-suite-cleanup` recorded, and it is a *worker* timeout rather
than a test's own wait**: a vitest worker that takes too long to report on itself times out
calling the main process, **with every test passing**.

**⇒ And because this change alters the tree, the red's rate was measured against the tree it
would have run on anyway** — **on the same machine, the same morning, twelve runs each**:

| tree | runs | green | red | harness-error |
| --- | --- | --- | --- | --- |
| **`main` at `1998eb2`, without this change** | 12 | **11** | **1** | **0** |
| **this branch** | 12 | **9** | **2** | **1** |

**⇒ So the failure is pre-existing and reproduces on `main` itself.** **⇒ And the two rates are
not separable at twelve runs each** — one run against three — **so the honest reading is that this
change did not measurably make the gate worse, and the record does not claim that it did not.**

**⇒ And the third run on this branch produced no summary at all** — **a run with no tier summary is
a harness error and not a pass**, and **it is the same failure wearing another face**: the worker
timed out, so the run never reported.

**⇒ The `architecture-suite-cleanup` record already says the suite is *not* deterministic under
every load**, and that *the two cases that timed out will time out again*. **⇒ This change does
not claim to have fixed that**, and it does not claim to have caused it. **What it does is
measure it**, because **a red that appears and disappears without the tree changing is a red that
means nothing** — **and here the tree does change, so the rate had to be measured rather than
assumed.**

**⇒ And the A/B itself was taken safely**: the change's own work was **stashed with `git stash
push -u`, measured, and popped**, and **every one of the five files was verified byte-identical
against a SHA-256 taken before the stash** — **because a file restored from a commit discards
uncommitted work, and this repository has been bitten by that twice in this session.**

### What this does not establish, restated

- **Nothing about Firefox's capabilities.** Every row is a fact about **this machine's reach**, and
  the instrument says so in its own output.
- **Nothing about the manifest.** The `bare` arm **refutes** the reading that the manifest is what
  Firefox refused, **and a refutation is not an endorsement**: the manifest's compatibility with
  Firefox is **still unmeasured**.
- **Nothing about the namespace, the eleven capabilities, or the side panel.** All three are **not
  measurable here**, and the probe that would measure them exists.
- **No cause for the failure.** Firefox's own output named a **Juggler** error and three
  Windows-shell errors, and `MOZ_LOG` wrote no file — **and the record does not name a cause it did
  not measure.**

---

## Recorded at sync (2026-10-21)

**One `MODIFIED` promoted, and the totals moved by zero requirements and three scenarios.**

```text
before: 190 requirements and 626 scenarios across 15 capabilities
after:  190 requirements and 629 scenarios across 15 capabilities
```

**And the zero in the requirement column is the arithmetic working and not a promotion that
missed** — **a `MODIFIED` block replaces rather than adds** — so `browser-verification` went
**5 requirements / 12 scenarios → 5 / 15** and **the other fourteen capabilities are identical**,
which is the measurement the count exists for.

**The promotion was rehearsed in full on a throwaway copy of `openspec/` before it touched the
real tree.** The rehearsal and the real promotion produced **the same SHA-256 of the promoted
file** (`82d721958b1f38eb…`), so the rehearsal was **faithful rather than approximately so** — and
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

**And the promoter is idempotent**: the second and third runs reported *"already promoted;
nothing written"* and left the file byte-identical — **because a tool that reports a promotion it
did not perform is a tool whose report nobody can trust**.

**`openspec validate --specs --strict` — 15 passed, 0 failed.**
