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

## Open Questions

- Whether the polling cadence should be one shared value or per-client. Deferred
  to the polling slice, which is where a cadence is actually chosen; it does not
  change this slice's specs, approach, or tasks.
- Whether mailbox history belongs in the session or the client. Deferred, for the
  same reason: with no storage, history's only honest implementation this milestone
  is in-memory, and deciding its shape before the inbox exists would be guessing.
