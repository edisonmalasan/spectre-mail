# Provider terms review — tasks

## 1. Records

- [x] 1.1 Record in `docs/PROVIDERS.md` §2 the **path table** for Mail.tm: every route tried at
      both the unprefixed and the locale-prefixed shape, with each result. **The table is the
      finding**, because the unprefixed shape alone produces a wrong sentence.
- [x] 1.2 Record that `https://mail.tm/en/privacy/` serves a **Privacy Policy**, with its path and
      the date, and correct the record's implication that Mail.tm publishes nothing.
- [x] 1.3 Record that the policy refers to *"terms of service"* while **no route tried for one is
      served**, and state that neither presence nor absence of an obligation may be asserted.
- [x] 1.4 Record Guerrilla Mail's `/tos` — **the path, that it is linked from the provider's own
      homepage, and the date it was read** — and quote verbatim the software-service-provider
      licence, the over-use prohibition, the reverse-engineering prohibition, the
      purposes clause, and the non-transferable/revocable clause.
- [x] 1.5 Record Guerrilla Mail's API document's two sentences **verbatim**, including
      *"we do not publish our rate limits"* and *"The client should not check email too many times
      as to not overload the server"*, with the path and the date.
- [x] 1.6 Record that **no attribution clause appears in either provider's terms as read**, and
      that silence is neither a permission nor a prohibition.
- [x] 1.7 Record **whether public extension distribution is compatible with provider policy** as
      **UNMEASURED**, with what would be needed to answer it. **It is one of the roadmap's five
      re-check items and this change does not answer it by argument.**
- [x] 1.8 Record that **no spike was run** and no provider behaviour was re-probed; this is a
      document review and every figure in it carries a date.

## 2. The cadence's basis

- [x] 2.1 `docs/PROVIDERS.md` §1 states, for the provider a browser can reach, **the published
      guidance the cadence was chosen against**, quoted and attributed, replacing the sentence that
      recorded the provider as publishing nothing.
- [x] 2.2 The record states the cadence's figure and the provider's qualitative sentence **side by
      side**, and **states plainly that no figure was published and none was invented**.
- [x] 2.3 The record states that **the cadence has never been run against a live provider**, so no
      figure here says what five seconds costs anybody.
- [x] 2.4 **The cadence is not changed.** Record it as unchanged and name the finding a maintainer
      now has to weigh.

## 3. The instrument

- [x] 3.1 `tests/architecture/provider-terms.test.ts` holds the repository's **terms claims as
      test-owned data**: the claim, the provider, the path it rests on, whether that path was
      served, and the date.
- [x] 3.2 Every claim whose path **was not served** is reported by name. `design.md`'s D5 is the
      positive half of the standing rule: a claim founded on a probed path is reported, and a claim
      founded on a served path is not.
- [x] 3.3 The instrument asserts **no architectural decision cites a terms claim in either
      direction** — that is the standing rule enforced, and it is checkable over `docs/ARCHITECTURE.md`,
      `AGENTS.md` and `docs/PROVIDERS.md`.
- [x] 3.4 The instrument checks that `docs/PRIVACY.md`'s attribution section **matches what was
      read**, so the two documents cannot drift apart silently.
- [x] 3.5 Every reader is falsified by a `--self-test` **before** its tally is trusted, and a run
      with no summary reports `harness-error` rather than a count.
- [x] 3.6 The file self-tests for pattern-freeness and for **sharing no reader** with
      `boundaries.test.ts`, `privacy-disclosure.test.ts`, `security-audit.test.ts` or
      `branding-audit.test.ts`.
- [x] 3.7 **The instrument makes no network request.** A test that fetched a provider would be a
      live call in a suite whose standing property is that it makes none, and a re-run against a
      website is a human act.

## 4. Falsification

- [x] 4.1 Take restoration digests **before** the first mutation and verify every mutated file
      against them by SHA-256.
- [x] 4.2 Every deliberate violation is caught **by the assertion it was aimed at**; `wrongcatch`,
      `green`, `noop`, `nocompile` and `harness-error` all zero.
- [x] 4.3 Include **one violation that makes a claim's path un-served**, because that is the
      assertion the whole instrument exists for and it is the one a reader returning nothing would
      pass trivially.
- [x] 4.4 Include **one violation that adds a terms claim to a decision**, because the standing
      rule is the second thing the instrument checks and a reader that never sees it is unproven.
- [x] 4.5 The instrument lives **outside the repository** and is deleted afterwards.

## 5. Predictions, so that they are falsifiable

- [x] 5.1 `packages/storage`, `packages/mailbox`, `packages/providers`, `packages/core`,
      `packages/mail-parser` and `apps/web` are **all unmoved**. This change adds a document, a
      markdown correction and one architecture suite.
- [x] 5.2 `tests/architecture/boundaries.test.ts` stays at **53**.
- [x] 5.3 `tests/architecture` rises by exactly the new suite's case count, and
      `tests/architecture/privacy-disclosure.test.ts` **rises by whatever the amendment requires**,
      because the amended requirement's own scenarios change.

      **CORRECTED IN PLACE (2026-10-16, apply stage). The second clause was wrong, and its reason was
      wrong with it.** `privacy-disclosure.test.ts` **stays at 22**: it reads `docs/PRIVACY.md` and no
      specification file at all — `git grep openspec tests/architecture/privacy-disclosure.test.ts`
      returns nothing, so the amended requirement's scenarios cannot move a count in it however many
      they change. **The amendment lives in this change's delta and is promoted at the sync stage**, and
      a promoted scenario list is not a number any suite in `tests/architecture/` reads. **The whole
      prediction was a count that nobody had re-run, which is this repository's most-recorded defect.**

      **The first clause is confirmed and it is the check that matters**: `tests/architecture` rises
      from **107 to 118**, and `118 - 107 = 11` is exactly the new suite's case count, with
      `boundaries.test.ts` unmoved at **53**.
- [x] 5.4 `pnpm test:browser` is **unmoved at 40 website and 98 extension** — nothing under
      `apps/*/e2e/` changes, and **the extension's `manifest.json` is byte-identical by Git blob
      hash** because no permission or host permission is touched.

## 6. Deliberately not done, and why

- [x] 6.1 **The cadence is not changed.** A qualitative prohibition is not a limit and this
      repository does not invent figures it has not measured.
- [x] 6.2 **No legal position is stated**, and nothing says any use is permitted.
- [x] 6.3 **No provider behaviour is re-probed.** No spike ran; this is a document review.
- [x] 6.4 **`docs/PRIVACY.md` is not edited by the implementation stage** unless the instrument
      proves it must be — and if it must, that is a finding to report rather than a licence to
      rewrite the document whose claims the instrument resolves.
- [x] 6.5 **`docs/ARCHITECTURE.md`, `README.md`, `.github/**`, `openspec/specs/**`,
      `openspec/changes/archive/**`, `.agents/skills/**` and every `package.json` are not touched.**
      Only `docs/PROVIDERS.md` is on the do-not-touch list that this task explicitly requires.
- [x] 6.6 **`AGENTS.md` and `docs/ROADMAP.md` are not written by the implementation stage.** They
      are the root orchestrator's and the sync stage's, and the standing figure this change's gate
      results will move is theirs to correct.

## 7. Apply-stage record (2026-10-16)

### Files

| file | lines | what |
| --- | --- | --- |
| `docs/PROVIDERS.md` | +180 / -34 | §1 cross-reference corrected; §2 rate-limits gains the browser-reachable provider's quoted guidance; §2 terms section replaced with the two-shape path table; §3 terms stub filled in; §6 cross-reference corrected; preamble's non-probe-basis sentence widened to name §3 |
| `tests/architecture/provider-terms.test.ts` | new, **11 cases** | the claims map as test-owned data, the unserved-path reader, the terms-citation reader, the attribution-table reader, and three cases about this file's own shape |
| `openspec/changes/provider-terms-review/design.md` | +104 | D8, the apply-stage record |
| `openspec/changes/provider-terms-review/tasks.md` | this section | the ticks, and the correction to 5.3 |

**Nothing else changed.** No file under `apps/` or `packages/`, no `package.json`, no lockfile, no
`tsconfig*.json`, no `eslint.config.js`, no existing architecture suite, and nothing under
`openspec/specs/`, `openspec/changes/archive/`, `.github/` or `.agents/skills/`.

### Gates, each measured rather than read off a summary

| gate | result |
| --- | --- |
| `openspec validate provider-terms-review --strict` | **valid**, exit `0` |
| `prettier --check .` | **clean** across the repository, exit `0` |
| `pnpm build` (both clients), from restored source after the falsification pass | exit `0` |
| `pnpm verify` × 3, `PLAYWRIGHT_BROWSERS_PATH` at a created directory | **exit `1`, `1`, `1`** — the directory measured **0 files immediately before and after every one of the three runs** |
| `pnpm test`, `--reporter=json` grouped by project | **1319 across 67 files**, 1318 passing, **1 failing** — see the blocker below |
| `pnpm test:browser` × 6 | **4 green, 2 red, 0 `HARNESS-ERROR`** — see 7.4 |

**The single failing case is named, not counted**, and it is not a defect in the tree this change
ships — it is the finding this change produced about a document this stage is forbidden to edit.

### 7.1 BLOCKER — `docs/PRIVACY.md` §6 has drifted from what was read

`provider-terms.test.ts`'s attribution case reports four items, and **the instrument is the
instrument**: it is not a judgment, it is `docs/PRIVACY.md:140-141` disagreeing with
`docs/PROVIDERS.md` by date and by what was read.

- `docs/PRIVACY.md:140` — **"No terms page exists."** `https://mail.tm/terms` returns `404`, and the FAQ
  carries no proxy, resale, attribution or quota terms. **Checked 2026-10-02.** That is the exact
  sentence the new `provider-abstraction` requirement forbids: a `404` on a guessed path presented as a
  statement about the site, **in the very file that records the served policy's own reference to
  "terms of service" without serving one.**
- `docs/PRIVACY.md:141` — **"Nothing this repository found."** Its public API terms, rate limits and
  attribution requirements were not located and were not re-verified. **Measured false**: Guerrilla
  Mail publishes Terms of Service at `https://www.guerrillamail.com/tos`, linked from its own
  homepage, and `http://www.guerrillamail.com/GuerrillaMailAPI.html` — both read **2026-10-16**.

**Both rows also carry `2026-10-02` where the record carries `2026-10-16`**, so each row describes a
reading that has been superseded.

**6.4 was followed to the letter: the document was not edited and the instrument was not weakened.**
The remedy is two table cells and belongs to whoever owns `docs/PRIVACY.md` — **the root orchestrator,
or the sync stage alongside the `privacy-disclosure` amendment that makes it a requirement rather than
a courtesy.** Until it is made, `pnpm verify` is red and **that is the instrument working.**

### 7.2 Two pre-existing reds, measured on the tree WITHOUT this change

**Neither is caused by this change and neither was repaired, because neither file is in this stage's
write scope.** Both were established by **stashing the change and running the full suite on the clean
tree**, not by argument.

| red | cause | clean tree, 4 runs | with this change, 3 runs |
| --- | --- | --- | --- |
| `branding-audit.test.ts` | `ENOENT ... packages/mailbox/__framework-rule-probe.ts` | **4 of 4 red, 3 of 4 with this `ENOENT`** | **1 of 3 red** |
| `apps/extension/src/Panel.test.tsx` | *"Unable to find role=heading and name guerrilla"* | **3 of 4** | **0 of 3** |

**The `ENOENT` is a one-line ordering defect and the file's own header documents the failure it was
repaired for.** `shippedFiles()` calls `statSync(child)` on line 389 and only reaches the
`PROBE_FILE.test(entry)` guard on line 400 — **so a probe that `boundaries.test.ts` staged and then
deleted in another worker dies on the `statSync`, and the guard written for exactly that case never
runs.** The repair is to move the name check above the `statSync`. **The clean tree is red more often
than the changed tree, which is the measurement that shows it is not this change.**

### 7.3 §5, prediction by prediction

- **5.1 CONFIRMED.** `packages/core` 54, `packages/providers` 92, `packages/mail-parser` 149,
  `packages/mailbox` 166, `packages/storage` 86, `apps/web` 125 — **every one identical to the
  baseline measured before any edit.** `apps/extension` 487 and unmoved.
- **5.2 CONFIRMED.** `boundaries.test.ts` is still **53**, and it is **53** because this change adds no
  boundary rule: every property it introduces is about a document.
- **5.3 FIRST CLAUSE CONFIRMED, SECOND CLAUSE CORRECTED IN PLACE** — see the correction above. `107 → 118`,
  the difference being exactly this suite's 11 cases; `privacy-disclosure.test.ts` **stays at 22**.
- **5.4 CONFIRMED.** The browser tier is unmoved, and
  **`apps/extension/static/manifest.json` is byte-identical by Git blob hash** —
  `git rev-parse HEAD:apps/extension/static/manifest.json` and
  `git hash-object apps/extension/static/manifest.json` both return
  **`847ce07cfff39b00b4461067d12a6ffb0649a4a8`**. **Checked by blob hash and not by `git diff`**, because
  an empty diff is a claim about a path and a blob hash is a claim about the bytes.

### 7.4 The browser tier: six runs, two red, and **every red named**

| run | outcome | website | extension | failing test |
| --- | --- | --- | --- | --- |
| 1 | red | 40 | 97 + 1 failed | `e2e\in-page-associations.spec.ts:308:3` — *gives the page's own storage listener nothing, and the listener demonstrably works* (`Timeout 5000ms exceeded while waiting on the predicate`) |
| 2 | red | 40 | 96 + 2 failed | `e2e\in-page-fill.spec.ts:308:3` — *reads a message it has already opened for no second request*; and `e2e\side-panel.spec.ts:565:3` — *offers to create when this device holds nothing, and names no address as its own* |
| 3–6 | green | 40 | 98 | — |

**`{ red: 2, passed: 4 }` over 6 runs, with `HARNESS-ERROR` at zero** — every run produced two tier
summary lines, so every run reached Playwright. **The website tier is 40 on all six runs** and the
extension tier is **98 on every green run**, which is prediction 5.4's figure and the measurement that
this change touched nothing under `apps/*/e2e/`. **All three failures are in
`apps/extension/e2e/`, which this change does not touch**, and all three are precondition timeouts of
the shape this repository has recorded repeatedly.

**Playwright's summary parentheses hold a duration and the count is never read from them**: `97 passed
(3.4m)` is 97 cases. A run with fewer than two tier summary lines never reached Playwright and is
classified `HARNESS-ERROR` whatever its exit code said.

**The block runner's own name reader was wrong twice before it named a single failure, and both are
this repository's most-recorded shape.** It first matched `/^\s*✘\s+(.*)$/` — **Playwright prints no
`✘` here** — and reported *"red runs with no failing test named: 1, 2"* for two runs whose failures
were named in their own output. **A reader that matches nothing reports an absence.** The repair used
`\d+\) \[chromium\] > …`, written from a PowerShell transcript, and matched nothing either: the
separator is **`›` (U+203A)**, and the PowerShell console renders it as `>`. **The tally was right
throughout and only the name reader was wrong**, so the six saved outputs were re-read rather than the
six suites re-run — **and re-running an hour of browser work to re-measure a figure that was never in
doubt would be the wrong repair for a reader defect.**

### 7.5 The falsification pass

**9 of 9 caught by the assertion each was aimed at, with `wrongcatch`, `green`, `noop`, `nocompile` and
`harness-error` all zero.** `dist/` was rebuilt from the restored source afterwards (exit `0`). The full
table is in `design.md`'s D8; the two arms worth naming here:

- **4.3 is V01** — a claim's path flipped from served to un-served in the map, caught by
  *"every claim whose path was not served is reported by name."* **V02 is the same assertion reached
  from the other side**, by disabling the reader's own filter rather than the fixture, because a pass in
  which only the fixture moves is not evidence that the instrument reads.
- **4.4 is V03** — a terms citation planted in `docs/PROVIDERS.md` inside the decision the rule governs,
  caught by *"no decision in the three decision documents cites a terms claim it has not read."**

**The harness's self-test is 5/5 and was run in BOTH argument orders**, because reading `argv[2]`
resolves `--self-test` as a directory. **Its fifth case caught a dead anchor on the first run** — a
violation whose text Prettier had reflowed — which is the difference between a harness that reports
`noop` and one that reports a mutation as uncaught.

### 7.6 Out of scope, found and reported

**`docs/ROADMAP.md:3187` states the withdrawn claim as current rationale:** *"its terms forbid proxying,
so no compliant design lets a SpectreMail web page read it."* **This is the exact sentence this change
exists to end, live in the roadmap**, and it is outside both `tasks.md` 3.3's declared document set and
this stage's write scope.

**Six further places record a provider as publishing nothing, which is now measured false:**

| place | the claim |
| --- | --- |
| `AGENTS.md:1330` | *"while Guerrilla publishes nothing. So a limit a provider does declare is honoured as a floor"* |
| `AGENTS.md:2027` | *"Mail.tm publishes **no terms page** (verified 2026-10-02)"* — still true, but now a **path table** rather than a sentence, and the re-measurement date is 2026-10-16 |
| `docs/ARCHITECTURE.md:164` | *"while Guerrilla publishes nothing and none was measured"* |
| `packages/mailbox/src/cadence.ts:9` | *"publishes no limit and none was measured"* — **the cadence's own basis, and the one §2 now corrects** |
| `apps/web/src/useInboxVisibility.ts:11` | *"against a provider that publishes no rate limit"* |
| `docs/ROADMAP.md:3110`, `:3135`, `:3259` | the same no-terms-page claim in prose |

**`AGENTS.md:2035`, `docs/ROADMAP.md:3170` and `apps/web/src/MailboxLifetime.tsx:8` also say "Guerrilla
publishes nothing equivalent"**, but they mean *nothing equivalent to a published lifetime*, and
`/tos` states no lifetime either — **so those three survive this change and are listed only so nobody
re-checks them twice.**

**None of the above was edited.** They are reported because a finding reported is worth more than a
scope violation.
