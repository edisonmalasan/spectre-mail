# Provider terms review — tasks

## 1. Records

- [ ] 1.1 Record in `docs/PROVIDERS.md` §2 the **path table** for Mail.tm: every route tried at
      both the unprefixed and the locale-prefixed shape, with each result. **The table is the
      finding**, because the unprefixed shape alone produces a wrong sentence.
- [ ] 1.2 Record that `https://mail.tm/en/privacy/` serves a **Privacy Policy**, with its path and
      the date, and correct the record's implication that Mail.tm publishes nothing.
- [ ] 1.3 Record that the policy refers to *"terms of service"* while **no route tried for one is
      served**, and state that neither presence nor absence of an obligation may be asserted.
- [ ] 1.4 Record Guerrilla Mail's `/tos` — **the path, that it is linked from the provider's own
      homepage, and the date it was read** — and quote verbatim the software-service-provider
      licence, the over-use prohibition, the reverse-engineering prohibition, the
      purposes clause, and the non-transferable/revocable clause.
- [ ] 1.5 Record Guerrilla Mail's API document's two sentences **verbatim**, including
      *"we do not publish our rate limits"* and *"The client should not check email too many times
      as to not overload the server"*, with the path and the date.
- [ ] 1.6 Record that **no attribution clause appears in either provider's terms as read**, and
      that silence is neither a permission nor a prohibition.
- [ ] 1.7 Record **whether public extension distribution is compatible with provider policy** as
      **UNMEASURED**, with what would be needed to answer it. **It is one of the roadmap's five
      re-check items and this change does not answer it by argument.**
- [ ] 1.8 Record that **no spike was run** and no provider behaviour was re-probed; this is a
      document review and every figure in it carries a date.

## 2. The cadence's basis

- [ ] 2.1 `docs/PROVIDERS.md` §1 states, for the provider a browser can reach, **the published
      guidance the cadence was chosen against**, quoted and attributed, replacing the sentence that
      recorded the provider as publishing nothing.
- [ ] 2.2 The record states the cadence's figure and the provider's qualitative sentence **side by
      side**, and **states plainly that no figure was published and none was invented**.
- [ ] 2.3 The record states that **the cadence has never been run against a live provider**, so no
      figure here says what five seconds costs anybody.
- [ ] 2.4 **The cadence is not changed.** Record it as unchanged and name the finding a maintainer
      now has to weigh.

## 3. The instrument

- [ ] 3.1 `tests/architecture/provider-terms.test.ts` holds the repository's **terms claims as
      test-owned data**: the claim, the provider, the path it rests on, whether that path was
      served, and the date.
- [ ] 3.2 Every claim whose path **was not served** is reported by name. `design.md`'s D5 is the
      positive half of the standing rule: a claim founded on a probed path is reported, and a claim
      founded on a served path is not.
- [ ] 3.3 The instrument asserts **no architectural decision cites a terms claim in either
      direction** — that is the standing rule enforced, and it is checkable over `docs/ARCHITECTURE.md`,
      `AGENTS.md` and `docs/PROVIDERS.md`.
- [ ] 3.4 The instrument checks that `docs/PRIVACY.md`'s attribution section **matches what was
      read**, so the two documents cannot drift apart silently.
- [ ] 3.5 Every reader is falsified by a `--self-test` **before** its tally is trusted, and a run
      with no summary reports `harness-error` rather than a count.
- [ ] 3.6 The file self-tests for pattern-freeness and for **sharing no reader** with
      `boundaries.test.ts`, `privacy-disclosure.test.ts`, `security-audit.test.ts` or
      `branding-audit.test.ts`.
- [ ] 3.7 **The instrument makes no network request.** A test that fetched a provider would be a
      live call in a suite whose standing property is that it makes none, and a re-run against a
      website is a human act.

## 4. Falsification

- [ ] 4.1 Take restoration digests **before** the first mutation and verify every mutated file
      against them by SHA-256.
- [ ] 4.2 Every deliberate violation is caught **by the assertion it was aimed at**; `wrongcatch`,
      `green`, `noop`, `nocompile` and `harness-error` all zero.
- [ ] 4.3 Include **one violation that makes a claim's path un-served**, because that is the
      assertion the whole instrument exists for and it is the one a reader returning nothing would
      pass trivially.
- [ ] 4.4 Include **one violation that adds a terms claim to a decision**, because the standing
      rule is the second thing the instrument checks and a reader that never sees it is unproven.
- [ ] 4.5 The instrument lives **outside the repository** and is deleted afterwards.

## 5. Predictions, so that they are falsifiable

- [ ] 5.1 `packages/storage`, `packages/mailbox`, `packages/providers`, `packages/core`,
      `packages/mail-parser` and `apps/web` are **all unmoved**. This change adds a document, a
      markdown correction and one architecture suite.
- [ ] 5.2 `tests/architecture/boundaries.test.ts` stays at **53**.
- [ ] 5.3 `tests/architecture` rises by exactly the new suite's case count, and
      `tests/architecture/privacy-disclosure.test.ts` **rises by whatever the amendment requires**,
      because the amended requirement's own scenarios change.
- [ ] 5.4 `pnpm test:browser` is **unmoved at 40 website and 98 extension** — nothing under
      `apps/*/e2e/` changes, and **the extension's `manifest.json` is byte-identical by Git blob
      hash** because no permission or host permission is touched.

## 6. Deliberately not done, and why

- [ ] 6.1 **The cadence is not changed.** A qualitative prohibition is not a limit and this
      repository does not invent figures it has not measured.
- [ ] 6.2 **No legal position is stated**, and nothing says any use is permitted.
- [ ] 6.3 **No provider behaviour is re-probed.** No spike ran; this is a document review.
- [ ] 6.4 **`docs/PRIVACY.md` is not edited by the implementation stage** unless the instrument
      proves it must be — and if it must, that is a finding to report rather than a licence to
      rewrite the document whose claims the instrument resolves.
- [ ] 6.5 **`docs/ARCHITECTURE.md`, `README.md`, `.github/**`, `openspec/specs/**`,
      `openspec/changes/archive/**`, `.agents/skills/**` and every `package.json` are not touched.**
      Only `docs/PROVIDERS.md` is on the do-not-touch list that this task explicitly requires.
- [ ] 6.6 **`AGENTS.md` and `docs/ROADMAP.md` are not written by the implementation stage.** They
      are the root orchestrator's and the sync stage's, and the standing figure this change's gate
      results will move is theirs to correct.