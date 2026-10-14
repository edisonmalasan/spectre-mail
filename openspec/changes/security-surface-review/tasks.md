# Tasks

## 1. The audit — `docs/SECURITY.md`

- [x] 1.1 Write the document: nine rows, one per area **as the roadmap names them**,
      each carrying the requirement that governs it, the file that requirement is in,
      the instrument that enforces it, and a verdict.
- [x] 1.2 Count the roadmap's fenced block programmatically and assert the document
      says nine. **`docs/ROADMAP.md` said "eight" until today**, so the count this
      document states is measured in the same command that writes it.
- [x] 1.3 Record the two areas closed by their own archived changes
      (`extension-permissions-review`, `extension-clear-data`) as **not reopening**,
      naming the change that closed each.
- [x] 1.4 Record the two open areas as open: **provider credentials** (no
      requirement, no instrument) and **message rendering** (a rule enforces it for
      every client; the requirement names only the website).
- [x] 1.5 Link to `docs/PRIVACY.md:27` for what a credential **is**, per D8. **Do not
      restate it.** A fourth copy of that wording is a fourth thing to drift.
- [x] 1.6 State what the audit does **not** establish — no attacker model, no
      provider terms, no legal sufficiency, no live provider — per D9.

## 2. The credential instrument — `apps/extension/src/protocol.test.ts`

- [x] 2.1 Add the test-owned map of every message kind this extension sends or
      receives to whether it may carry a credential field, per D1. **Enumerate the
      kinds; do not hardcode a subset.**
- [x] 2.2 Read the credential field names from `packages/core`'s
      `ProviderCredentials` variants rather than retyping them, per D3.
- [x] 2.3 **Assert the positive control first:** hand the reader an object carrying a
      credential field and require it back, per D2. **The absence cases pass trivially
      on a reader that returns nothing**, so this must precede them.
- [x] 2.4 Forward direction: for every kind, narrow through its reader and require no
      credential field in the result.
- [x] 2.5 Reverse direction: no shipped protocol type declares a credential field, and
      the type set is **enumerable** so a type added later is inside the obligation.
- [x] 2.6 Spell the message kinds **by hand** rather than importing them, matching
      the decision already recorded at `Panel.test.tsx:862`.

## 3. The audit's own instrument — `tests/architecture/security-audit.test.ts`

- [x] 3.1 New file. Resolve every requirement `docs/SECURITY.md` cites, as capability
      plus heading, against `openspec/specs/`; report a citation that resolves to
      nothing **by name**.
- [x] 3.2 **Do not require every area to have a requirement**, per D5. An area with
      none is the finding.
- [x] 3.3 Self-test the citation reader, **with a known-resolving citation as its
      first case.** An instrument narrower than its rule returns a clean result rather
      than an error.
- [x] 3.4 Carry a **negative control**: a planted unresolvable citation must be
      reported. Without it, a reader that resolves nothing satisfies every row above it.
- [x] 3.5 Declare the file shares **no reader** with `boundaries.test.ts` or
      `privacy-disclosure.test.ts`, and assert that by pattern rather than by review.

## 4. Falsification

- [x] 4.1 Run deliberate violations for every new assertion; each SHALL be caught by
      **the assertion it is aimed at**. `wrongcatch`, `green`, `noop`, `nocompile` and
      `harness-error` all zero.
- [x] 4.2 Take restoration SHA-256 **before** mutating, and verify against that.
- [x] 4.3 Falsify the **audit's citation reader** specifically: plant a citation that
      does not resolve and require it reported. A count cannot detect this.
- [x] 4.4 Falsify the credential map in the direction it is aimed at — **a kind added
      to the protocol without a row must fail**, not be skipped.
- [x] 4.5 Rebuild `dist/` from the restored source. **Restoring a source file is not
      restoring what a build emitted.**
- [x] 4.6 Keep the instrument **outside the repository** and delete it afterwards.

### 4.7 Record — nineteen deliberate violations, 19 of 19 caught

Five files were mutable: `apps/extension/src/protocol.ts`,
`apps/extension/src/protocol.test.ts`, `docs/SECURITY.md`,
`tests/architecture/security-audit.test.ts`, `tests/architecture/boundaries.test.ts`.
Their SHA-256 digests were taken **before** any mutation and are restored and
re-verified against those digests after every arm, not against a re-read of the file.

| arm | mutated file | the deliberate violation | outcome | caught by |
| --- | --- | --- | --- | --- |
| F01 | `protocol.test.ts` | the credential detector stops walking, so a nested credential is invisible | caught | the **positive control**, `_reports a credential field when it is handed one, before any absence is claimed_` |
| F02 | `protocol.test.ts` | the shared discriminant rule is deleted, so `provider` reads as a secret | caught | `_reads the same credential field names by parse and by type, in both directions_` |
| F03 | `protocol.test.ts` | a protocol kind's value carries a credential field, through a reader that passes it on | caught | `_HostContextAnswer carries no credential field in the value this extension sends_` — the forward direction |
| F04 | `protocol.test.ts` | a row is deleted from the map, so a shipped type falls outside the obligation | caught | `_maps every protocol type this module exports, in both directions_` |
| F05 | `protocol.ts` | **a shipped protocol type declares a credential field nothing reads** | caught | `_declares no credential field in any type this module ships_` |
| F06 | `protocol.ts` | a protocol type is shipped without a row in the map | caught | `_maps every protocol type this module exports, in both directions_` |
| F07 | `protocol.ts` | a union gains a variant the map carries no value for | caught | `_carries one value per variant every union declares, in both directions_` |
| F08 | `docs/SECURITY.md` | a cited requirement is renamed, so the citation resolves to nothing | caught | `_every citation the audit makes resolves, and each is reported by name when it does not_` |
| F09 | `docs/SECURITY.md` | the audit restates a provider credential field name (D8) | caught | `_the audit names no provider credential field, and the names come from packages/core_` |
| F10 | `docs/SECURITY.md` | an instrument column names a token that is not an openable path | caught | `_every instrument the audit names is a path this repository holds_` |
| F11 | `docs/SECURITY.md` | an area is renamed, so the audit and the roadmap no longer name the same nine | caught | **2 reds** — both about the same nine areas |
| F12 | `docs/SECURITY.md` | the audit's table header is edited, so the table is no longer the one it names | caught | `_the audit's table is the one its header names, with a row per area_` |
| F13 | `docs/SECURITY.md` | a stray token lands in a requirement cell, unaccounted for by any citation | caught | `_every backticked token in a requirement cell belongs to one of that cell's citations_` |
| F14 | `security-audit.test.ts` | the citation reader answers `null` for every citation | caught | **2 reds** — the reader self-test and the negative control |
| F15 | `security-audit.test.ts` | the citation grammar stops matching a hyphenated capability | caught | **5 reds** — the reader is reached by five cases |
| F16 | `security-audit.test.ts` | a fourth regular-expression literal, undeclared | caught | `_this file contains no pattern beyond the declared three_` |
| F17 | `security-audit.test.ts` | a reader body is copied in from the boundary suite | caught | `_this file shares no reader with the other two architecture suites_` |
| F18 | `boundaries.test.ts` | **a boundary rule is added**, so §5.3's prediction that the count stays at 53 is falsified | caught | `_the boundary suite still holds 53 assertions, and this change adds none_` |
| F19 | `docs/SECURITY.md` | §6 states a count its own table contradicts | caught | `_§6 states the count the table carries, and names every area in it_` |

**`wrongcatch` 0, `green` 0, `noop` 0, `nocompile` 0, `harness-error` 0.** Every
arm's post-run digest check reported every one of the five files `unchanged` or
`restored-byte-identical`.

**Three arms produce more than one red, and all three are legitimate rather than
one failure counted repeatedly.** An area name is written in **three** places — the
roadmap fenced block the audit is measured against, the table row, and §6's bullets
— so renaming one legitimately reds every consistency check that reads it (**F11**).
The citation reader is the *instrument* rather than a single assertion, so a reader
that resolves nothing is caught by its self-test **and** by its negative control
(**F14**), and a grammar that stops matching is caught by all five cases that reach
the reader (**F15**). **A catcher naming another assertion about the same property
is an attribution to record; one naming an unrelated assertion is the real defect**,
and none of these three names an unrelated assertion.

**Two of these arms were aimed at controls this stage had written, and both were
caught — which is the point of running them.**

- **F01 caught the positive control for the right reason.** D2 requires the positive
  control to precede the absence claims, and arm F01 made it red **by name** while
  every absence case stayed green. A positive control that passes on a reader
  returning nothing is precisely what it exists to prevent.
- **F18 caught the prediction rather than the product.** Adding a boundary rule reds
  `the boundary suite still holds 53 assertions, and this change adds none`. §5.3
  predicts 53; this arm is what makes that prediction falsifiable in the useful
  direction instead of being a number nobody checked.

### 4.8 Record — F19 did not exist when the plan was written, and it exists because a figure was wrong

**`docs/SECURITY.md` §6 said "four" over a table carrying five plain `closed` rows.**
It was found by **counting the table programmatically** (9 rows: `closed` 5,
`closed by its own change` 2, `open — closed by this change` 2), not by reading it,
and corrected to **"five"**.

**The more useful half is that a guard was added rather than a typo fixed.**
`security-audit.test.ts` now carries
`_§6 states the count the table carries, and names every area in it_`, which reads
the count **as a word** with a character loop rather than by reading a digit, because
a reader that regexes a number cannot tell `four` from `4` and this document writes
the first. **A declared count guards a silent edit, not a deliberate one**, so this
is non-silence rather than completeness — the same trade `privacy-document` recorded
and declined to hide.

### 4.9 Record — three instrument defects found by falsification, each producing a confident wrong answer

**Every one of these reported a clean or a green answer where the truth was
otherwise. All three are recorded because that is the direction this repository
trusts least.**

1. **`panel-rate.mjs` keyed its red off `numFailedTests > 0` only.** Measured on a
   run where one file **failed to collect**: `numFailedTests=0`, `success=false`,
   and the suite total fell 1289 → 1272. The reader reported a run with a missing
   file as **green**. Repaired to honour `success === false` and per-file status,
   and **self-tested in both directions** with a planting into
   `security-audit.test.ts`, restored byte-identical afterwards.
2. **The first repair of `arms.mjs` was over-broad, and it filed 19 correct arms as
   wrong.** Vitest also marks a suite non-`passed` when assertions merely fail, so a
   synthetic `FILE-LEVEL FAILURE` title was appended to every ordinary red and
   **all nineteen arms read `wrongcatch`**. The final fix consults the file-level
   signal **only when `failed === 0`**. *A harness that reports measured outcomes it
   did not measure is worse than one that declines to answer.*
3. **`browser-tier.mjs` v1 required both `passed` and `failed` on a summary line.**
   **Playwright omits "failed" on a fully green run**, so the reader found nothing
   in the exact case it exists to confirm and reported **three green runs as three
   `HARNESS-ERROR`s** — the same shape `AGENTS.md` records for a Vitest summary
   regexed against clean text and for Playwright's duration parentheses.

### 4.10 Record — two controls repaired, and neither repair touched the product

**Both were found by an arm pointing at the assertion each was aimed at, and both
were defects in the tests this stage wrote rather than in the product.**

- `protocol.test.ts`'s positive control read `toEqual(["HostContextAnswer.sessionId"])`,
  which binds it to the **absence of every other** credential declaration. Arm F05
  made it red naming the planted type. It now reads `.toContain(...)` **plus** an
  explicit `found.length > 0` non-vacuity check, so a reader returning nothing
  fails it rather than passing.
- `security-audit.test.ts`'s planted-citation case read `toHaveLength(1)` over the
  document's own rows **plus** the plant, so it asserted a property of the document
  and not of the reader. Arm F08 made it red beside the aimed case. It now filters
  for the planted requirement's own name.

### 4.11 Record — `dist/` and the repository

`dist/` was rebuilt from the restored source after every arm touching a
build-read file (`protocol.ts`), and `pnpm test:browser` rebuilt both clients from
restored source three more times. **Restoring a source file is not restoring what a
build emitted.**

The harness lived in `%TEMP%\opencode\ssr-falsify\`, **outside the repository**,
and was deleted at the end of the stage. One defect is recorded because it nearly
repeated the recorded mistake: an unexpanded PowerShell argument created a `%TEMP%`
directory **inside the repository root**, which is the "instrument left in the root"
shape that failed `extension-preview`'s pass. It was found and removed by `git
status`, not by `pnpm lint`.

## 5. Gates

- [x] 5.1 `pnpm verify` **three times**, with `PLAYWRIGHT_BROWSERS_PATH` pointed at a
      **verified-empty** directory. Record every run's exit code.
- [x] 5.2 `pnpm test:browser`, repeated, with a stated denominator. **A run carrying
      no tier summary is `HARNESS-ERROR`**, not a pass.
- [x] 5.3 **Predictions to check, and these are the measurement:**
      - **`packages/storage` still 86**, with an **empty** `git diff --stat` over it —
        D's non-goal: this change does not touch what is stored.
      - **`packages/ui` still 38** — no new token and no new motion.
      - **`website-client` still 125** — the website is not touched.
      - **`apps/extension` rises by exactly the credential cases** and moves nowhere
        else. Reconcile the arithmetic per file.
      - **`boundaries.test.ts` still 53**, per D1: **no boundary rule is added**,
        because every property here already has an instrument. **53 staying at 53 is
        the prediction, and a rise means a rule was added where one already existed.**
      - **`manifest.json` byte-identical.**
      - **Zero production edits outside the two test files**, per D7.

### 5.4 Record — `pnpm verify`, three runs, exit `0` `0` `0`

Run on the final tree with `PLAYWRIGHT_BROWSERS_PATH` pointed at a directory whose
entry count was **measured at 0 immediately before the runs and again immediately
after**, because "an empty directory" is a claim and a directory that gained a
browser mid-run is a different measurement.

| run | exit | wall clock | `Test Files` |
| --- | --- | --- | --- |
| 1 | `0` | 62s | 64 passed (64) |
| 2 | `0` | 38s | 64 passed (64) |
| 3 | `0` | 41s | 64 passed (64) |

An earlier three runs on the same tree **before** the §6 count was fixed also
exited `0`, `0`, `0`. **Both sets are recorded rather than the better one**, because
a gate run three times and reported once is a count nobody can re-derive.

`pnpm test` inside `verify` does **not** run the browser tier, which is why the
empty-browsers-directory condition is a real constraint on this gate and not a
formality.

### 5.5 Record — `pnpm test:browser`, 3 of 3 green

**Denominator: 3 runs.** Tally printed by the same variables the exit code is
taken from, because an instrument that prints its tally and then falls off the end
reports a *completed* block as `exit 1` and an *aborted* one as the same.

**The reader's self-test printed `ALL PASS` (5 of 5) before any tally was trusted** —
a green run read as green, both tier counts read from Playwright's own
`Running N tests using M workers` banners (40 and 98), a run with a failed count
read red with the count reported, and **a run that never reached Playwright read
`HARNESS-ERROR`**. A reader that has only ever seen one of those shapes has not been
shown to read the other.

| run | outcome | exit | website tier | extension tier |
| --- | --- | --- | --- | --- |
| 1 | passed | 0 | `40 passed (11.7s)` | `98 passed (1.3m)` |
| 2 | passed | 0 | `40 passed (11.7s)` | `98 passed (1.3m)` |
| 3 | passed | 0 | `40 passed (11.1s)` | `98 passed (1.2m)` |

**`TALLY runs=3 passed=3 red=0 harness-error=0`.**

**The extension tier is unmoved at 98 and that is required, not incidental.** This
change adds its cases to a Vitest suite and to the architecture tier; `protocol.test.ts`
is not collected by any Playwright glob, so a rise here would have meant something
this change did not plan touched the browser.

### 5.6 Record — §5.3's predictions, measured

Every figure below was **counted from a `--reporter=json` run grouped by project**,
not read from a summary line and not carried forward.

| prediction | measured | verdict |
| --- | --- | --- |
| `packages/storage` still 86 | **86**, `git diff --stat` over `packages/storage` **empty** | confirmed |
| `packages/ui` still 38 | **38** | confirmed |
| `apps/web` still 125 | **125** | confirmed |
| `apps/extension` rises by exactly the credential cases | **487**; `protocol.test.ts` **101 → 123** (**+22**), every other extension file unmoved | confirmed |
| `boundaries.test.ts` still 53 | **53**, and `privacy-disclosure.test.ts` **22** | confirmed |
| `manifest.json` byte-identical | `git hash-object` `847ce07cfff39b00b4461067d12a6ffb0649a4a8` = `HEAD:apps/extension/static/manifest.json` | confirmed |
| zero production edits outside the two test files (D7) | `git status` carries **only** the three intended paths | confirmed |

**The arithmetic accounts for the whole movement: baseline 1250 + 22
(`protocol.test.ts`) + 18 (`security-audit.test.ts`) = 1290**, so the file count
rises by exactly **one** — the new architecture suite — and not by two.

Full per-project counts on the final tree — **1290 passed / 0 failed across 64
files**: `packages/core` 54, `packages/providers` 92, `packages/mail-parser` 149,
`packages/mailbox` 166, `apps/web` 125, `packages/storage` 86, `packages/ui` 38,
`apps/extension` 487, and `tests/architecture` **93** (53 + 22 + **18**).

**Baseline, measured by temporarily reverting `protocol.test.ts` and parking
`security-audit.test.ts` aside** — restored from TEMP copies verified against their
pre-change SHA-256 — is **1250 passed / 0 failed across 63 files**. **1250 + 22 +
18 = 1290**, so the movement is accounted for exactly.

**The extension's 22 cases are `protocol.test.ts`'s 101 → 123**, reconciled per file
rather than as a total: `Panel.test.tsx` is unmoved at **53**,
`privacy-disclosure.test.ts` at 22, and the extension's baseline of **465 across 21
files** rises to **487 across 21 files** — so no file was added and none was
removed.

**`boundaries.test.ts` staying at 53 while a boundary rule would have been the
obvious place for two of these properties is the measurement D1 turns on.** A rule
added where an instrument already exists is not coverage — and **arm F18 exists
precisely so the count is falsifiable rather than merely stated.**

## 6. Records

- [x] 6.1 `pnpm test` counted from a `--reporter=json` run **grouped by project**.
      **Vitest writes its summary to stderr with SGR codes around every token**, so a
      reader written against clean text matches nothing — repair the reader, never the
      tally.
- [x] 6.2 Record every gate run in this file with its result, including any red and
      what it found.
- [x] 6.3 **Do not write to `AGENTS.md`, `docs/ROADMAP.md`, `openspec/specs/` or the
      archive** — those are the root orchestrator's and the sync stage's.

### 6.4 Record — a red that was found, and what it found

**`Panel.test.tsx` failed on this change's tree three times in six full-suite runs,
and the baseline produced the same red once. It is pre-existing and it is not
attributable to this change.**

The failing case is named in the record because a red with no name is not a finding:

> `the panel renders the mailbox beside the page names the mailbox this page
> resolves to and the provider that served it`
> `Unable to find role="heading" and name "guerrilla"`

**The measurement that settles it:**

| tree | runs | green | red |
| --- | --- | --- | --- |
| baseline (`protocol.test.ts` at HEAD, `security-audit.test.ts` parked) | **3** full-suite + **1** | 3 full-suite green; **1 red** | **1** |
| this change's tree | **6** full-suite | 3 | **3** |
| `Panel.test.tsx` alone, this change's tree | **6** | **6** | 0 |

**The first baseline run recorded `1249 passed, 1 failed`, and it is that run which
recorded the red.** The three baseline full-suite runs that followed it were all
green at 1250. `Panel.test.tsx` **alone** is green **6 of 6 on this change's tree**,
so the red is a whole-suite scheduling or load effect rather than a property of the
tree — and **`protocol.ts`, `Panel.tsx` and `Panel.test.tsx` are all byte-identical
to `HEAD`**, the only coupling being when the file is scheduled.

**This is recorded rather than smoothed over, because "no gate was red" would have
been false.** It is a real flake in an existing case, it is **not filed as this
change's defect**, and it is **not filed as fixed** — nothing here repairs it, and
a flake that is repaired by a change that did not cause it is a repair nobody can
attribute.

### 6.5 Record — a stale standing figure, and what this change does about it

`AGENTS.md`'s Project Status block carries **`1228 across 62 files`**. The measured
figures are **1250 across 63** at the baseline and **1290 across 64** on this
change's tree. **The standing figure is two milestones stale, and task 6.3 forbids
this change from writing `AGENTS.md`**, so the correction is reported here for the
root orchestrator rather than applied. **This is the same defect
`panel-verification-state`'s own archive found** — *the figure a reader copies is the
headline, and the headline is the one number in the block no change has to touch to
record itself.*

### 6.6 Record — a limit, stated rather than smoothed over

**`tests/architecture/` has no `tsconfig.json` and is not a workspace member**, so
`pnpm typecheck` **does not check the types of any architecture test file** —
`security-audit.test.ts` included. This is the same limit `privacy-document`
recorded and deliberately did not repair, because adding a `tsconfig` there would
move every future gate's typecheck scope. **It is recorded here because a green
`pnpm verify` says nothing about the types of the file this change's audit rests
on.**

### 6.7 Record — nothing this change says is established by reading

No test here reads a rendered pixel, and this change adds **no visual surface at
all** — `manifest.json` is byte-identical and no client file changed, so there is
nothing to look at. The two deliberately unticked items in §7 are left unticked for
the reasons recorded there.

## 7. Deliberately unticked

- [ ] 7.1 ~~Load the extension in a real browser and look at it.~~ **Left unticked.**
      An agent opening a panel is not the judgement the task asks for, and this change
      adds no visual surface for the judgement to be about.
- [ ] 7.2 ~~Attempt the credential boundary against a hostile page.~~ **Left unticked
      and out of scope.** The obligation is about which values cross this extension's
      own message boundary, and a hostile-page probe measures the platform's isolation
      rather than this product's. **The platform side is already recorded as measured**
      in `docs/PROVIDERS.md` §4.4 and the quarantine list, and this change neither
      repeats nor extends it.