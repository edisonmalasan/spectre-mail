# Tasks

## 1. The audit — `docs/SECURITY.md`

- [ ] 1.1 Write the document: nine rows, one per area **as the roadmap names them**,
      each carrying the requirement that governs it, the file that requirement is in,
      the instrument that enforces it, and a verdict.
- [ ] 1.2 Count the roadmap's fenced block programmatically and assert the document
      says nine. **`docs/ROADMAP.md` said "eight" until today**, so the count this
      document states is measured in the same command that writes it.
- [ ] 1.3 Record the two areas closed by their own archived changes
      (`extension-permissions-review`, `extension-clear-data`) as **not reopening**,
      naming the change that closed each.
- [ ] 1.4 Record the two open areas as open: **provider credentials** (no
      requirement, no instrument) and **message rendering** (a rule enforces it for
      every client; the requirement names only the website).
- [ ] 1.5 Link to `docs/PRIVACY.md:27` for what a credential **is**, per D8. **Do not
      restate it.** A fourth copy of that wording is a fourth thing to drift.
- [ ] 1.6 State what the audit does **not** establish — no attacker model, no
      provider terms, no legal sufficiency, no live provider — per D9.

## 2. The credential instrument — `apps/extension/src/protocol.test.ts`

- [ ] 2.1 Add the test-owned map of every message kind this extension sends or
      receives to whether it may carry a credential field, per D1. **Enumerate the
      kinds; do not hardcode a subset.**
- [ ] 2.2 Read the credential field names from `packages/core`'s
      `ProviderCredentials` variants rather than retyping them, per D3.
- [ ] 2.3 **Assert the positive control first:** hand the reader an object carrying a
      credential field and require it back, per D2. **The absence cases pass trivially
      on a reader that returns nothing**, so this must precede them.
- [ ] 2.4 Forward direction: for every kind, narrow through its reader and require no
      credential field in the result.
- [ ] 2.5 Reverse direction: no shipped protocol type declares a credential field, and
      the type set is **enumerable** so a type added later is inside the obligation.
- [ ] 2.6 Spell the message kinds **by hand** rather than importing them, matching
      the decision already recorded at `Panel.test.tsx:862`.

## 3. The audit's own instrument — `tests/architecture/security-audit.test.ts`

- [ ] 3.1 New file. Resolve every requirement `docs/SECURITY.md` cites, as capability
      plus heading, against `openspec/specs/`; report a citation that resolves to
      nothing **by name**.
- [ ] 3.2 **Do not require every area to have a requirement**, per D5. An area with
      none is the finding.
- [ ] 3.3 Self-test the citation reader, **with a known-resolving citation as its
      first case.** An instrument narrower than its rule returns a clean result rather
      than an error.
- [ ] 3.4 Carry a **negative control**: a planted unresolvable citation must be
      reported. Without it, a reader that resolves nothing satisfies every row above it.
- [ ] 3.5 Declare the file shares **no reader** with `boundaries.test.ts` or
      `privacy-disclosure.test.ts`, and assert that by pattern rather than by review.

## 4. Falsification

- [ ] 4.1 Run deliberate violations for every new assertion; each SHALL be caught by
      **the assertion it is aimed at**. `wrongcatch`, `green`, `noop`, `nocompile` and
      `harness-error` all zero.
- [ ] 4.2 Take restoration SHA-256 **before** mutating, and verify against that.
- [ ] 4.3 Falsify the **audit's citation reader** specifically: plant a citation that
      does not resolve and require it reported. A count cannot detect this.
- [ ] 4.4 Falsify the credential map in the direction it is aimed at — **a kind added
      to the protocol without a row must fail**, not be skipped.
- [ ] 4.5 Rebuild `dist/` from the restored source. **Restoring a source file is not
      restoring what a build emitted.**
- [ ] 4.6 Keep the instrument **outside the repository** and delete it afterwards.

## 5. Gates

- [ ] 5.1 `pnpm verify` **three times**, with `PLAYWRIGHT_BROWSERS_PATH` pointed at a
      **verified-empty** directory. Record every run's exit code.
- [ ] 5.2 `pnpm test:browser`, repeated, with a stated denominator. **A run carrying
      no tier summary is `HARNESS-ERROR`**, not a pass.
- [ ] 5.3 **Predictions to check, and these are the measurement:**
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

## 6. Records

- [ ] 6.1 `pnpm test` counted from a `--reporter=json` run **grouped by project**.
      **Vitest writes its summary to stderr with SGR codes around every token**, so a
      reader written against clean text matches nothing — repair the reader, never the
      tally.
- [ ] 6.2 Record every gate run in this file with its result, including any red and
      what it found.
- [ ] 6.3 **Do not write to `AGENTS.md`, `docs/ROADMAP.md`, `openspec/specs/` or the
      archive** — those are the root orchestrator's and the sync stage's.

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