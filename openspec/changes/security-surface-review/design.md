# Design

## Context

M12's security review names nine areas and has never been opened. The audit behind
this change was run against the shipped tree on 2026-10-14, and its result is
uneven in a way the roadmap could not have anticipated: most of the milestone's
security work was already done, by changes that were written to close other gaps and
happened to close these too.

**The count of nine was itself wrong in this file's own ledger until today.**
`docs/ROADMAP.md:565` read *"it reviews eight areas"* and was corrected by counting
the fenced block, which holds eleven lines of which two are the fences — **nine
areas.** That correction is recorded here rather than quietly applied, because it is
the same defect the audit's instrument is built to prevent, committed by the file
that would have carried the instrument.

The seven closed areas are closed by work that exists:

| area | required by | enforced by |
| --- | --- | --- |
| extension permissions | `extension-permissions-review` (archived) | test-owned permission map in `apps/extension/e2e/manifest.spec.ts` |
| storage boundaries | `spectre-storage` — *the platform storage API is named only inside this layer* | four boundary rules in `tests/architecture/boundaries.test.ts` |
| URL handling | `mail-parsing` — *a destination whose scheme is not `http` or `https` SHALL NOT be surfaced as a followable link* (spec.md:82-86) | `packages/mail-parser/src/detect-links.ts` `FOLLOWABLE_PROTOCOLS`, seven cases |
| content-script injection | `in-page-integration` — *the affordance is separate from the page it is injected into*; *the content script reports the host it is beside, and nothing more of the page* | shadow-root cases, `in-page.spec.ts` |
| site mapping | `spectre-storage` — *a site association is a record kind of its own, keyed by an exact host*; `privacy-disclosure` | storage cases, `privacy-disclosure.test.ts` |
| notification content | `extension-client` — *a message that arrives raises a notification naming its sender and its subject* | `notification.test.ts`, `background-check.spec.ts` |
| clear-data behaviour | `extension-clear-data` (archived) | `panel-copy.test.ts`, `side-panel.spec.ts` |

The two open areas are the two this change opens, and they are open in different
ways — which is why one delta requirement lands in `provider-abstraction` and one in
`extension-client`, and why the audit records them separately rather than as one
finding.

## Goals / Non-Goals

**Goals:**

- Turn the roadmap's nine-item list into nine **verdicts**, each naming the
  requirement and the instrument that produced it, with a citation a reader can open.
- Close the one area with neither a requirement nor an instrument.
- State the extension's half of a property the website states for itself and a rule
  already enforces for both.
- Make the audit itself checkable, so it cannot drift into a claim.

**Non-Goals:**

- **Not a threat model and not a penetration test.** Nothing here says what an
  attacker would try; it says which stated obligations this product holds and which
  instruments would notice if it stopped.
- **Not a re-review of the permissions or clear-data areas.** Both are closed by
  their own archived changes and neither reopens. The audit says so in a row rather
  than leaving a reader to assume all nine were re-litigated.
- **Not a provider terms review.** That is M12's separate provider review, still
  unstarted, and `privacy-document`'s D7 already established that it does not block.
- **No claim of legal sufficiency.** A document that enumerates obligations is not a
  compliance artefact and this change does not make it one.
- **No change to what is stored.** `packages/storage` already persists a
  credential with its mailbox, and `provider-adapters` already requires it to. This
  change constrains where a credential may *travel*, which is a different question
  and does not touch the adapter.

## Decisions

### D1 — The credential instrument is a test-owned map in `protocol.test.ts`, not a boundary rule

**The map is the shape, and two archived changes arrived at it independently.**
`extension-permissions-review` put a `permission -> the call that reaches it` map in a
browser spec; `privacy-disclosure` put a `key -> what it holds` map in an
architecture spec. **Both chose a map over a scan, and both recorded why: a scan
produces a false failure whose obvious repair is to change the code.** Here a scan of
`apps/extension/src` for `credentials` would fire on this file's own forbidden-token
list — the fourth recorded instance of that exact shape, after
`extension-permissions-review`, `privacy-disclosure`'s `reader.test.ts` and
`boundaries.test.ts`'s `MESSAGE_VIEW` fixture.

A boundary rule was rejected for a second reason: **the property is not structural.**
The credential boundary is about what a *value* may contain as it crosses a message
boundary, not about which module may import which. A rule can only see the second.

**It lives in `protocol.test.ts` and not a new file**, because that file already owns
the narrowing table for every message kind and already spells its kinds out by hand
rather than importing them — a decision recorded at `Panel.test.tsx:862` for exactly
the reason that applies here: an assertion built from the constant under test moves
with it.

### D2 — Asserted in both directions, with the positive control first

**The forward direction** enumerates every message kind, narrows each through the
reader that parses it, and requires the resulting value to carry no credential field.
**The reverse direction** requires that no shipped protocol type declare a credential
field, and that the set of types be **enumerable** so a type added later falls inside
the same obligation.

Only one direction was nearly enough, and the near-miss is worth naming. The forward
direction alone is satisfied by a credential field that no reader returns — because a
reader is a *parser*, and a field it does not read is invisible to it. **An assertion
aimed at the reader cannot see a field the reader skips**, which is the same class as
the assertion that imported the value under test.

**The positive control is asserted first and reads the control's own token.** It
requires the reader to return a credential field when handed an object that has one,
*before* any absence is claimed — because the absence cases pass trivially on a
reader that returns nothing at all, which is what a broken reader looks like.

### D3 — Credential field names come from the code, not from this file

`ProviderCredentials` is a discriminated union whose variants are the only place the
field names exist. The instrument reads the variant key set **from
`packages/core`** rather than retyping `accessToken`, `sessionId` and `accountId`.

**A retyped list is a list that can drift**, and this repository has recorded that
shape three times: the adapter-identifier rule listed three exports that **did not
exist**, which is why `pnpm test` stayed green while the rule guarded nothing. The
names are read once and the result is that adding a fourth variant to the union
brings its field inside the obligation without editing this file.

### D4 — The extension-rendering requirement is `ADDED`, not `MODIFIED`, and lands in `extension-client`

`website-client`'s *"The website renders no provider data as markup and no provider
field"* is left **byte-identical**. The alternative was to widen it to "every client",
which is one requirement instead of two — and it is wrong for the reason
`panel-mailbox-choice` recorded when exploration split one item across two: **two
unrelated amendments to one heading is the shape where an amendment gets attributed
to the wrong assertion.** A requirement filed under `website-client` that governs
`apps/extension` is an assertion about the extension sitting in the wrong capability.

**Two capabilities already state the same property** — `shared-domain-model` and
`provider-adapters` both carry *"Message bodies are carried as untrusted text"* —
which is the precedent for writing it down a third time, per client.

### D5 — The audit's instrument resolves citations and does not require coverage

`tests/architecture/security-audit.test.ts` reads `docs/SECURITY.md`, extracts each
cited requirement as `capability` + heading, and resolves it against
`openspec/specs/`. It reports a citation that resolves to nothing **by name**.

**It deliberately does not require every area to have a requirement.** An area with
none is the audit's finding; a check that failed on one would make the instrument
useless precisely when the audit had something to report.

**The reader is self-tested before its tally is trusted**, and the self-test's first
case is a citation known to resolve — the defect this repository has paid for most
often is an instrument narrower than the rule it was written for, which returns a
clean result rather than an error.

### D6 — The audit is nine rows and cites what it read, with line references

Each row carries the requirement heading, the file it is in, and the instrument. **The
line numbers are cited because a heading alone is not a citation a reader can open**,
and they are measured at write time rather than recalled — the ROADMAP's *eight*
is the counterexample, sitting two hundred lines from where this decision is recorded.

**Two areas are recorded as closed by their own archived changes and do not
reopen.** The audit says which change closed each and why reopening it is not what
this item asks for.

### D7 — Zero production changes, stated as a prediction

**This change predicts that it will edit no file under `apps/*/src` or
`packages/*/src` outside the two test files it adds to.** The credential boundary
already holds; the rendering boundary is already enforced by a rule.

The prediction is **falsifiable in the useful direction**: if the apply stage finds a
credential reaching a surface, or a markup escape hatch in the extension, the
prediction is wrong and the change grows a production edit. **A prediction that
cannot be wrong is not a prediction**, and this one is recorded here so that being
wrong is visible rather than accommodated.

### D8 — The audit links to `docs/PRIVACY.md` rather than restating it

`docs/PRIVACY.md:27` already names the credential in the storage table.
**`docs/SECURITY.md` links to that line and does not restate the wording**, applying
the same rule `privacy-document`'s D12 set: three surfaces keep their own wording, and
a fourth copy is a fourth thing to drift.

The one sentence the security audit adds is the one the privacy document cannot: not
*what* is stored but *where a stored credential may travel*. **Those are different
questions and a document that answered the second with the first would be answering
the wrong one.**

### D9 — Nothing here is a claim about an attacker, a provider's terms, or the law

The audit's rows are obligations and instruments. It does not say a message body is
*safe*, only that it is carried as text and rendered as text. It does not say
anything about provider terms, which is the separate provider review. It does not say
anything about legal sufficiency, which no test in this repository could establish.

**The `MessageSummary` claim deserves the same care**: that a notification cannot
carry a code is a property of the type rather than a filter — and that is stated in
`extension-client` today. The audit cites it; it does not re-argue it.

## Risks / Trade-offs

- **The audit will go stale anyway, and the instrument catches only citation
  rot.** A row whose requirement was *weakened* rather than renamed resolves fine.
  The instrument bounds one failure mode and not the other, and this is stated rather
  than implied — the same shape as every other limit recorded in this repository.

- **The credential map is a test-owned list, so it can disagree with the protocol.**
  It is built by enumerating the shipped types at the type level and checked against
  the readers, so a type added without a row fails in the reverse direction rather
  than being skipped. **That is the direction this design had to get right**, and D5's
  self-test is what makes it demonstrable rather than asserted.

- **Three `ADDED` requirements and no `MODIFIED` or `REMOVED` means the promoted
  requirement count moves by exactly three.** That is the arithmetic working, not a
  promotion that missed — the fifth change in this repository to reach that shape
  after `incoming-mail-notification`, `panel-mailbox-choice`,
  `extension-permissions-review` and `privacy-document`. **A reader expecting the
  block count to be the requirement delta is wrong here**, and it is named in the
  change's own record rather than left as a surprise.

- **Nothing in this change has been run against a live provider, and nothing in it
  could be.** Every provider response in this repository is a recorded one. That is
  the standing limit and this change neither narrows nor widens it.