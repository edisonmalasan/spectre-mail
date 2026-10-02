# Design

## Context

See `proposal.md` — Why. The constraints that shape the *approach*:

M0–M4 left three verified packages and no client. `apps/web` is a React 19 + Vite
app whose root component renders a static paragraph, and the packages are consumed
as TypeScript source with no per-package build, so a new package needs no build
step but does need to appear in the workspace.

Two constraints are load-bearing and were measured, not chosen:

- **Mail.tm is unreachable from a web page.** It sends CORS headers only to its own
  origins (`docs/PROVIDERS.md` §2). `provider-abstraction` forbids proxying it.
- **There is no push transport.** Five SSE paths and two WebSocket paths were
  probed and none connected, so `MailProvider` has no subscription method and every
  message will arrive by polling. This slice does not poll, but it means the
  session's shape cannot assume a callback will ever fire.

The spec reference points that conflict and this design resolves:
`shared-domain-model`'s Purpose excludes lifecycle behaviour from `packages/core`,
while the roadmap's shared-package list assigns "mailbox lifecycle / mailbox manager"
to it.

## Goals / Non-Goals

**Goals:**

- One framework-free session implementation that both clients can adopt.
- A website that reaches a real address a user can copy, with every state honest.
- An architecture assertion — "the session layer imports no framework" — that is
  falsifiable rather than merely documented.
- A package test suite that runs with no DOM, no network, and no provider.

**Non-Goals:**

- Polling, the inbox, message reading, unread state, or history. Those are the
  remaining M5 slices and the session shape must not preclude them.
- Any persistence. M6 owns storage; this slice is deliberately reload-lossy.
- Visual design, tokens, layout, or theming. M7 owns those.
- Changing `packages/core`, `packages/mail-parser`, either adapter, or any
  existing requirement. If one of those turns out to need a change, that is a
  finding to record, not a licence to edit.

## Decisions

### D1 — A new `packages/mailbox`, not `packages/core`

**Decision.** A new framework-free package, depending on `@spectre-mail/core` and
`@spectre-mail/providers`.

**Alternatives.** `packages/core`, which the roadmap names — rejected, because
`shared-domain-model`'s approved Purpose says it describes "the model and its
invariants only" and excludes lifecycle behaviour. Adopting the roadmap's
allocation means amending an approved spec to make a types-only package hold
orchestration. Inside `apps/web` — rejected, because M8 gives the extension the
same behaviour and duplicating it guarantees the two diverge.

**Why this is worth a decision rather than a default.** The architectural sequence
in `AGENTS.md` reads provider → model → parser → storage → client, which makes
"the next layer" feel obvious. But that sequence orders *layers*, and this change
inserts an orchestration layer that the roadmap never named. The roadmap's
milestone order is different from its layer order: M5 is a user-facing milestone
and M6 is storage, so a website demonstrably works before any storage exists.

### D2 — The session is a state value, not a state machine

**Decision.** The session exposes its current state as a plain immutable value —
one of creating, ready with a mailbox, or failed with a code — and the client
subscribes by being handed that value. It does not own a queue, a scheduler, or a
listener registry.

**Alternatives.** An event-emitting session (`onStateChange`) — rejected as
premature. Nothing in this slice emits more than one transition per user action,
and the polling slices are the ones that would justify a subscription. An async
generator of transitions — rejected, same reason, with more ceremony.

**Consequence to record now.** When polling arrives it will need a cadence and a
stop condition, and a value-shaped session will have to grow an explicit lifecycle
or a `destroy`. That is a known future cost, accepted now because the alternative
is building a scheduler with exactly one caller and no second caller to validate
it against.

### D3 — Health is a value obtained from the provider, never a derived one

**Decision.** Health is reported exactly as `ProviderHealth` states it. The
session does not compute a status, does not cache a status past a failed request,
and does not map an elapsed time onto "expired".

**Why this is a decision and not a restatement.** The temptation is real and
specific: a page showing an address naturally wants to show a countdown, and every
provider publishes *something* — Mail.tm a 7-day retention, and a mailbox that
lasts until deleted. Neither value appears in any API response and neither was
measured live. So a countdown is computable from a documented number that the
provider does not actually report, and it would be wrong in the direction that
costs a user a verification code. `website-client` states the consequence for the
screen; this states it for the code.

### D4 — The website's provider list is a constant, not a setting

**Decision.** The website constructs its manager over Guerrilla Mail alone, from a
module-level constant in `apps/web`. There is no configuration surface and no
runtime provider selection in this slice.

**Alternatives.** A runtime selector listing every provider the shared package
builds — rejected, because Mail.tm would be offered on a page that provably
cannot reach it, and `provider-abstraction` forbids adding a provider to a client
whose environment cannot reach it. Reading the list from the provider package so
it stays in sync — rejected, because that list is not a client reachability
statement and coupling them makes the website's failure surface a library change.

### D5 — No framework assertion is a source rule, and it names what it does not check

**Decision.** `tests/architecture/boundaries.test.ts` gains a rule that no file in
`packages/mailbox` imports `react`, `react-dom`, or `preact`. The rule strips
comments first, and its comment states that it matches import specifiers only and
does not check for a framework reached some other way.

**Why the scope limit is written into the rule.** This is the M4 lesson applied in
advance. The `fetch` rule spent a milestone matching one form of a call out of
three because the helper it used took a literal string, and three documents then
claimed it was proven. A rule that cannot tell what it does not check gets
documented as though it does. So the limit is stated where the rule lives.

### D6 — The website's states are explicit, not a boolean

**Decision.** The page renders exactly three named states — creating, ready, and
failed — and each is distinct labelled content. There is no `isLoading` flag
alongside a nullable mailbox, because the two can disagree and the disagreement is
a rendering bug nobody tests.

**Alternatives.** A nullable mailbox plus a loading flag — rejected for the reason
above. An enum-free discriminated union is the same thing as an enum here; the
package exports a union because it is the shape the values already have.

### D7 — Copy failure is a specified outcome, not an error path

**Decision.** The copy action's failure is a first-class rendered state. The
clipboard API fails for real reasons — permission denied, insecure context, a
document not focused — and in each the address is still on screen and still
selectable, so the correct response is to tell the user and leave the text.

**Alternatives.** Treating it as an exception and rendering the generic failure
state — rejected, because the mailbox is fine. Showing the address only on copy
success — rejected, because the address must be visible before any interaction.

### D8 — The slice is verified without contacting a provider

**Decision.** `packages/mailbox`'s tests run against a **stub** provider that
implements `MailProvider`, plus a recording transport for the one path that must
prove it performs no request of its own. `apps/web` gets no unit test in this
slice, because testing React output would require a DOM and the architecture
assertion — that no provider field name and no adapter identifier appears under
`apps/` — is what actually protects the boundary.

**Why this is honest rather than convenient.** It establishes the session layer
composes the abstraction correctly. It establishes nothing about Guerrilla Mail.
The recorded responses in `packages/providers` are the only evidence about the
provider, and they are recordings. The first live address this page produces will
be the first live exercise of the website path, and it is not something this test
suite can predict.

## Risks / Trade-offs

**[The session shape grows a lifecycle when polling arrives]** → Accepted and
recorded in D2. The alternative — building a scheduler now — means writing code
whose only validator is its single caller, which is how a wrong abstraction gets
made to look right.

**[A reload silently discards a mailbox the user may still be using]** → The
website states that the lifetime is unknown and does not claim recovery. M6 adds
persistence. The gap is real and is in `website-client`'s Purpose rather than
hidden in this file.

**[No DOM test for the website]** → Mitigated by making the boundary the
assertion rather than the render. A DOM test would verify that React renders the
strings it was given, which is not where the risk in this slice is. The risk that
remains — that the states are not distinct or not labelled — is addressed by the
`website-client` scenarios being written as observable content, and it is called
out here as **not** machine-verified in this slice.

**[`packages/mailbox` is a fourth shared package the roadmap did not name]** →
Recorded in D1. The roadmap's shared-package list is a plan and this change amends
it; `docs/ROADMAP.md` is updated in the same change rather than left to disagree
with the tree.

**[The framework rule can be defeated by importing a framework under another
name]** → Stated in the rule's own comment (D5). The rule holds the cases that
occur; it is not a claim to hold every case.

### D9 — The manager's single-provider fix, found while implementing

**Recorded during apply.** D5 assumed the manager hands a caller a usable failure
for `mailbox-session`'s "a failure is reported as a normalized code". It does not.
With exactly one configured provider it throws a composed `Error` whose message
embeds each failure as prose, and the `code` survives **nowhere**:

```text
PROBE_RESULT {"constructorName":"Error","hasCode":false,
              "message":"No configured provider could create a mailbox.\n  - guerrilla: ..."}
```

Three separate places encoded the assumption that the manager always throws an
`Error`, and each had to be corrected:

1. **`manager.ts` wrapped unconditionally.** Its own comment said "the throw below
   is the original error, unaltered", which was false.
2. **A test named "preserves a single provider's failure as the cause it was"**
   asserted only that a description *substring* survived, so it stayed green while
   the `code` was destroyed. A substring check on prose cannot distinguish "the
   failure survived" from "some of its text survived".
3. **The test file's `capture` helper was typed `Promise<Error>`** and rethrew
   anything that was not an `Error` — so it could not return a `SpectreError` at
   all, because a `SpectreError` is deliberately a plain discriminated object
   rather than an `Error` subclass. `conformance.ts` already had a correctly-typed
   equivalent using `isSpectreError`; this file's copy was the outlier.

**Decision.** Rethrow the original failure object when exactly one provider is
configured; keep the composed wrapper when there are several, because there the
composed report genuinely is the answer — it names each provider that failed,
which no single provider's failure can. Correct `capture` to return `unknown` with
a `messageOf` helper, and assert the `code` plus **object identity** rather than
fields, because a manager-built copy could drop `rateLimit` with nothing in a
field-level assertion noticing.

**Why this is the eleventh instance and not a new class.** Same shape as the other
ten: the check was narrower than the rule it claimed to enforce, and it was green
the whole time. The new element is that it took three edits to make one assertion
true, which is what a wrong *type* in a helper does — it stops every test in the
file from being able to observe the thing they were written to observe.

**No approved requirement changes.** `provider-adapters`' single-provider scenario
requires that no failover be attempted and that the limitation stay recorded, and
rethrowing the provider's own failure satisfies both.

### D10 — The adapter-confinement rule was re-scoped to its stated intent

**Recorded during apply, after the user's decision.** M3's rule is named *confines
provider adapters to `packages/providers`*. It also forbade `createProviderManager`
and `createFetchTransport` outside the package, and the first website implementation
turned seven of those into violations. That made the assertion **broader than the
requirement it claimed to enforce** — the first recorded instance of *too broad*
rather than too narrow, and the first where the excess made the approved
architecture unusable rather than merely unenforced:

- A client cannot compose a provider manager without `createProviderManager`, so
  forbidding it left `MailProvider` and `ProviderManager` with no way to be
  instantiated outside the package declaring them.
- A browser cannot turn `fetch` into a `Transport` without `createFetchTransport`.
- A client's provider configuration cannot name the provider it reaches without
  naming that provider's adapter.

Both are **references to a package's public API**, which is what a public API is
for. Confinement means an adapter may not be *implemented* or *re-exported* outside
the package, and may not be *named* outside the files entitled to choose providers.

**Decision.** Three lists replacing one: `PROVIDER_ADAPTER_IDENTIFIERS` (today's
adapter factories and the conformance harness), `PROVIDER_COMPOSITION_SEAMS`, and
two path-scoped allowances — one for naming an adapter (a client's
`provider-config.ts`, plus test files), one for the seam (`provider-config.ts`,
`transport.ts`, `packages/mailbox`). Test files are exempt from the adapter half for
the reason this file is exempt from its own rule: a check asserting a name's
absence has to be able to name it, and a positive control has to drive a real
adapter or it is not a control.

**The allowance's stated limit, recorded in the rule itself.** It is by path and
cannot tell a definition from a call, so in an allowed file *minting* an adapter
goes unchecked as well as *calling* one; and it does not verify *why* a file holds
an adapter. A client that reached for Mail.tm anyway would pass this rule and be
caught by `website-client`'s one-provider requirement instead.

**Also fixed here: the rule read raw text and fired on its own code.**
`packages/mailbox`'s explanation of what it deliberately does not do names
`createProviderManager`, and the suite went red on a sentence rather than a
declaration — the third time in this repository a check has fired on its own
documentation. Fixed by stripping comments before matching, **not** by rewording the
documentation until the rule went quiet; rewording would have deleted the reason the
next reader needs. The same stripping fixes a second instance found the same day
(`Address.tsx` documents `dangerouslySetInnerHTML` by name, and the new markup rule
fired on it).

## Falsification record

Run by a harness kept **outside the repository** (it mutates tracked files, so it
must not be importable by application code). Per case it hashes the target, applies
a mutation, runs the full suite, and records three things: non-zero exit, **whether
the intended test was named among the failures**, and whether the file was restored
byte-identical. A mutation that turns the suite red on some *other* assertion is
recorded `DEFECTIVE`, not counted — "the suite went red" is not the same claim as
"this test catches this defect".

**Result: 38 mutation attempts. 31 recorded `CAUGHT`, every file restored
byte-identical. The other 7 are itemised below rather than dropped, because a
falsification pass that reports only its successes overstates itself.**

Two defects were found by this pass and are fixed in this change:

1. **A vacuous assertion in the website's state test.** It asserted the two other
   states' `testid`s were absent, which a mutation adding the word "Ready" to the
   *creating* state passed. The assertion now names the strings themselves.
2. **The strengthened fix was still wrong.** `not.toMatch(/(^|\s)Ready(\s|$)/)` has
   no whitespace to anchor on, because `textContent` concatenates adjacent elements
   with no separator — `"new address.Ready"`. The assertion is now a plain
   `not.toContain`. **This is the reason the harness records the failing test name
   rather than a boolean**: a mutation that passes is unambiguous, but a mutation
   caught by the *wrong* assertion in the same test is not, and the first version of
   this fix was caught by nothing at all.

**The other 5 were faults in the harness or in the mutation, not findings**, and are
recorded so the 31 are not read as 38: a type-only `mailbox?: never` (no runtime
effect at all); an unused import (elided by the transform); a mutation that added an
object literal instead of a markup escape hatch; an `expect` string that was not a
test name; and a `try` carrying two `catch` blocks, which is a **syntax error** — the
suite went red on transform, proving nothing about the assertion it was meant to
falsify. Each was corrected and re-run to `CAUGHT`. The remaining 2 of the 7 were the
same real gap as defect 1, attempted twice before the assertion was fixed.

**One further defect was found by inspection, not by this pass**, and is recorded
separately so the pass is not credited with it: a dead branch in `normalize`. Its
`providerFailures` fallback read `failures.length > 0 ? failures : providers.map(…)`,
which is unreachable — the `isSpectreFailure` branch above returns first, so the
array is always empty. Simplified, and the field's documentation now says plainly
that a composed failure lists the providers that were **tried**, not the one that
**failed**, because at that point the cause is not attributable to any of them. Two
tests were added for it and both were falsified (`CAUGHT`): degrading the aggregate
code to a specific one, and truncating the provider list.

### Positive controls

Every group of absence assertions has a control proving the thing can appear:

| Absent | Control |
| --- | --- |
| The session makes no request | The same two operations driven straight through the real Guerrilla adapter over the same recording transport, first |
| No address while creating | The page *can* render one; the assertion is about the creating branch specifically |
| No time value without a reported expiry | A mailbox with `expiresAt` renders one, attributed to the provider |
| The recorder can observe a request | See row one — a non-zero baseline is required before comparing to it |
| The client tests are collected | The glob is resolved against the real test files, so narrowing it reports `uncovered` rather than asserting a literal |

### What this pass does not establish

It proves each assertion can fail and that the conforming case passes. It does not
prove the assertions are the *right* ones — that is what the independent verification
pass in task 5.6 is for, and it is deliberately not ticked here.

## Open Questions

- Whether the polling cadence should be one shared value or per-client. Deferred
  to the polling slice, which is where a cadence is actually chosen; it does not
  change this slice's specs, approach, or tasks.
- Whether mailbox history belongs in the session or the client. Deferred, for the
  same reason: with no storage, history's only honest implementation this milestone
  is in-memory, and deciding its shape before the inbox exists would be guessing.
