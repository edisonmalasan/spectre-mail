# Tasks

> All three `design.md` Open Questions were checked before writing this list, as the
> artifact instructions require. None of them changes what gets built: one needs
> messages this repository does not have, one would change a score rather than a rule,
> and one belongs to M10 where a user is present. Each would have changed the specs, the
> approach, or the grouping here, and none does.

## 1. Package setup

- [x] 1.1 Add `@spectre-mail/core` to `packages/mail-parser/package.json` as a
  `workspace:*` dependency and install at the root. Verify: the workspace link
  resolves, `pnpm-lock.yaml` records it, and `pnpm typecheck` runs `tsc --noEmit` for
  the package.
- [x] 1.2 Replace the package's placeholder `index.ts` documentation with an accurate
  module comment, and correct the stale claim that "OTP and verification-link
  detection are M10" — the roadmap schedules detection in **M4**. Verify: the comment
  names M4 for detection and M10 for the workflow that consumes it, and no file in the
  package still says otherwise.

> This group carries neither tests nor docs of its own, because it is a manifest entry
> and a comment. Every group below lands the tests its own work calls for.

## 2. Safe text extraction

- [x] 2.1 Implement the extractor: strip tags, drop script and style **content**,
  decode HTML entities, and recover each link's destination paired with its visible
  text. Document in the module that it is deliberately **not** a conforming HTML
  parser and must not be reused where full parsing is needed. Verify: a test asserts a
  tag cannot survive into the readable text, that script content is absent rather than
  flattened to text, and that an entity-encoded value is decoded and detectable.
- [x] 2.2 Handle a link whose destination is split across markup or entity-encoded,
  and a link with no visible text. Verify: a test asserts the destination and its text
  are recovered in both shapes, and that a link with no text yields a destination with
  an empty text rather than being dropped.
- [x] 2.3 Assert the failure direction on malformed markup. Verify: a test feeds
  unclosed and nested tags and asserts that **no tag survives** into the readable
  text and that the visible text is still recovered.
- [x] 2.4 Prove the extraction assertions are load-bearing. Verify: deliberately
  reintroduce each defect the tests forbid — a tag surviving, script content leaking
  as text, an undecoded entity — and observe a non-zero exit naming the matching test,
  then restore each file byte-identical.

## 3. One-time code detection

- [x] 3.1 Implement candidate extraction: runs of 4–8 digits that are not part of a
  longer digit run. Verify: a test asserts a 3-digit and a 9-digit run are not
  candidates, and that a digit inside a longer run is not extracted from its middle.
- [x] 3.2 Implement the confidence **boost** from same-block verification wording,
  with "same block" defined as separated by blank lines per design.md D3, **including the
  borrowing amendment recorded in D3 during apply**: a candidate that is the only content
  of its own block also draws on the block above it. Verify: the same value scores
  strictly higher beside verification wording than without; a keyword in a *different*
  block does not boost a candidate that sits in a sentence of its own; and a bare
  candidate does borrow the wording of the block above it.
- [x] 3.3 Implement the confidence **reduction** for the eight numeric shapes in
  design.md D4 — and implement it as a penalty, not an exclusion. Verify: a test
  asserts a penalised value is still returned, and that it ranks strictly below an
  unpenalised value of the same shape in the same message.
- [x] 3.4 Implement deduplication by value keeping the highest observed confidence, and
  return the candidates ranked descending. Verify: a value appearing three times is
  reported once, a second occurrence beside stronger wording raises the single report,
  and a two-candidate message returns both in order.
- [x] 3.5 Cap every reported confidence below certainty per design.md D7. Verify: a
  test asserts the strongest possible match still reports below `1`, and that every
  reported score passes `assertConfidence` from the shared model.
- [x] 3.6 Prove the detection assertions are load-bearing, in the direction that
  matters. Verify: (a) reintroduce each defect and observe a non-zero exit naming the
  matching test — including turning a penalty into an exclusion, which is the defect
  most likely to be introduced by a well-meaning later change; and (b) run a
  **positive control** in the opposite direction, showing a conforming input still
  yields its expected candidate, because a suite that only ever goes red cannot
  distinguish a strict detector from a broken one.

## 4. Verification-link detection

- [x] 4.1 Implement detection from anchor text and same-block surrounding wording only,
  with **no** contribution from the URL's host, path, or query, per design.md D8 —
  **including the borrowing amendment recorded in D8 and in the spec delta during
  apply**: a link that is the only content of its own block also draws on the block above
  it. Verify: a test asserts a link whose wording asks to verify is reported; a test
  asserts a link whose **address alone** contains a verification word with no such
  wording is **not** boosted; and a test asserts a link that is **not** the only content
  of its block is not reported on the strength of the paragraph above alone.
- [x] 4.2 Reject every destination whose scheme is not `http` or `https`, and reject
  it outright rather than down-ranking it, per design.md D9. Verify: a test asserts a
  `javascript:` destination and a `data:` destination are absent from the link set
  entirely — not present at a low confidence — and that no residual text form of them
  appears.
- [x] 4.3 Attach each reported link's host so a caller never re-parses the address.
  Verify: a test asserts the host equals the destination's host, including for a
  destination carrying a port and a path.
- [x] 4.4 Assert ordinary transactional links are not reported. Verify: a test asserts
  an unsubscribe link and a preferences link in otherwise unremarkable wording yield
  no verification link.
- [x] 4.5 Prove the link assertions are load-bearing. Verify: reintroduce each defect
  — allowing a non-web scheme through, boosting on address shape, dropping the host —
  and observe a non-zero exit naming the matching test, with a positive control showing
  a genuine verification link still reported.

## 5. Composition, side-effect freedom, corpus, and documentation

- [x] 5.1 Compose the steps into one entry point over `Message.text`, returning
  readable text plus codes plus links, and record that it is a pure function of its
  input. Verify: a test asserts the composed result equals the two steps applied in
  sequence, and that repeated parses are byte-identical.
- [x] 5.2 Prove detection causes **no** side effect, observed rather than asserted. Run
  the corpus with an instrumented transport that records every request and assert zero
  were made, per design.md D13. Verify: the assertion is on the recorded count being
  zero, not on the absence of a `fetch` token in the source.
- [x] 5.3 Widen `tests/architecture/boundaries.test.ts` so no module in
  `packages/mail-parser` reaches the global `fetch`, and strip comments before
  matching so the rule cannot fire on its own documentation. Record the rule's stated
  scope limit inline: it matches `fetch`, not arbitrary I/O. Verify: a test asserts the
  rule fires on an introduced `fetch` call, does **not** fire on the word inside a doc
  comment, and that the scope limit is stated where a reader will see it.
- [x] 5.4 Build the fixture corpus: **the thirteen shapes the roadmap lists**, each
  labelled **synthetic** with a field saying why, and each declaring the ordered
  candidates it is expected to yield. Include a 4-digit, a 6-digit, and an 8-digit code,
  a message with several candidates, markup-heavy mail, plain mail, magic-link mail, an
  order-confirmation carrying numbers that are not codes, a newsletter, a
  password-reset message, and three differently-shaped service verifications. Verify:
  every fixture carries its label and its expectation; a test asserts no fixture is
  unlabelled; and coverage is asserted as a **set of roadmap shapes** rather than a
  count, because a count passes with the wrong thirteen.
- [x] 5.5 Assert the corpus end to end, so both detection and false positives are
  measured. Verify: a test drives every fixture through the entry point and asserts its
  declared expectation; the order-confirmation fixture asserts its misleading numbers
  rank strictly below the real code; and the newsletter fixture asserts that nothing it
  reports ranks at or above what a true code scores. **Not** that it reports no
  candidate at all — see the recorded note under the corpus requirement in
  `specs/mail-parsing/spec.md` for why that expectation was unachievable as first
  written, and what replaced it.
- [x] 5.6 Update `AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/ROADMAP.md` and `README.md`
  with only what has been verified — the real test counts, what each gate does and does
  not prove, that the corpus is authored rather than captured, that no detection is
  reported as certainty, and that **no client consumes this package yet** so nothing
  user-visible has changed. Verify: every count quoted matches an observed run.
  **Observed 2026-10-02:** 291 tests across 18 files (54 core, 88 providers, 141
  mail-parser, 8 boundary), 7 of 7 workspace projects running `tsc --noEmit`,
  23 extraction / 30 codes / 30 links / 10 composition / 48 corpus, 14 fixtures.
- [x] 5.7 Run the full gate and record it honestly: `pnpm verify`,
  `pnpm --dir tests/provider-spike spike:selftest`, and
  `openspec validate mail-parsing-engine --type change --strict`. Verify: all exit
  `0`, and the record states that the suite measures handling of stated shapes and
  **nothing about any real service's mail**.
  **Observed 2026-10-02:** all three exited `0` — `pnpm verify` reported 18 files and
  291 tests passed, `built in 737ms`; the spike self-test ran 16 `ok` lines;
  OpenSpec reported `Change 'mail-parsing-engine' is valid`.
  **What this does not prove:** no client calls `analyseMessage`, so no test can assert
  a user-visible outcome, and the corpus is authored — 14 messages this repository
  wrote — so it establishes how this parser handles the shapes it declares and
  **nothing about how any real service formats a real verification message.**
- [x] 5.8 Run the falsification pass over every assertion added in this change,
  including a positive control in the opposite direction for each group. Verify: each
  introduced violation is caught by a non-zero exit naming the **intended** test —
  re-running any case in isolation until the right test is confirmed to be the one
  that failed — every file restored byte-identical, and no control file left behind.