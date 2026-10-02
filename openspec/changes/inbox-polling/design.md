# Design

## Context

Slice 1 established `packages/mailbox` as a **framework-free, DOM-free value
surface**: `current()` returns one of three immutable `SessionState` variants, and
every operation returns a new value. Its design recorded the cost of that choice
explicitly — D2 said a value-shaped session "will have to grow an explicit lifecycle
or a `destroy`" when polling arrived, and this is that moment. See
`openspec/changes/archive/2026-10-02-mailbox-session-layer/design.md`.

Three measured facts shape the approach, and one missing measurement shapes it more
than any of them.

**The contract already has what is needed.** `MailProvider` declares
`listMessages(mailbox)` and `getMessage(mailbox, messageId)`. No adapter changes and
no provider contract widening is required by this slice.

**There is no push transport.** Five SSE candidate paths and two WebSocket
candidates were probed and none connected. Polling is the only shape that works, not
a fallback chosen for convenience.

**There is no measured polling rate for the provider the website can reach.**
`docs/PROVIDERS.md` records Mail.tm `GET /messages` at `30; w=60` **measured
unauthenticated only**, and Mail.tm is unreachable from a browser page at all.
Guerrilla Mail publishes no limit and none was measured. Any interval in this change
is a product decision. The design therefore treats the interval as a **declared
value to be revised**, not a constant to be trusted, and makes the poller reactive
to a limit the moment one is observed.

**A timer compiles in this package.** Slice 1's verification pass measured that the
missing `DOM` lib rejects `window`, `document`, and `location` but *not*
`navigator`, `localStorage`, `sessionStorage` — `@types/node` declares them. It
declares `setTimeout` the same way. So the compiler cannot keep a scheduler out of
`packages/mailbox`, and an injected clock is the actual enforcement.

## Goals / Non-Goals

**Goals.** A cadence that is fast where latency is felt and quiet where it is not. A
poller that a test can drive to completion without waiting. One body fetch per new
message and never a second. A failed check that costs the user nothing they came for.

**Non-Goals.** No scheduler abstraction that could serve a second caller. No
persistence (M6). No visual design (M7). No opening a message (slice 3). No change
to any provider adapter, and no new provider operation.

## Decisions

### D1 — The poller lives in `packages/mailbox`, not in `apps/web`

**Decision.** The poller, the cadence calculation, and the per-message analysis
cache are package code, driven by an injected clock.

**Alternatives.** Polling from the React component — rejected: M8's extension would
write its own, and this is precisely the divergence `packages/mailbox` exists to
prevent. A generic `Scheduler` interface with one implementation — rejected: D2's
warning was that a scheduler with exactly one caller gets its abstraction wrong with
nothing to catch it. A concrete poller over a concrete injected clock has one caller
and no pretend generality.

**Consequence.** The session grows a lifecycle, which D2 predicted. That is paid
deliberately rather than inherited by accident, and the destructor is explicit.

### D2 — The scheduler is injected, and the seam is narrower than planned

**Decision.** The session is constructed with `schedule(afterMs, run): Cancel` and
nothing else. **Narrowed at the apply stage, 2026-10-03, from the `now(): number` +
`schedule` pair proposed here.** Nothing in this slice labels a moment in time —
`website-client` explicitly forbids showing a countdown or an interval — so a
`checkedAt` would have been carried through four layers to reach no reader, and a
`now` with no caller is a capability nobody exercises.

That is not the only reason. `provider-abstraction` forbids inferring a mailbox
lifetime from elapsed time, and a clock handed to a package that holds state is the
standing invitation to do exactly that. Handing over only what is needed removes the
invitation instead of relying on review to decline it. **If a later slice needs to
label a moment, add `now` then, with a caller that wants it.**

**Alternatives.** Reusing `Date.now` and `setTimeout` and testing with fake timers —
rejected, because a package whose only proof is that Vitest can mock a global is a
package whose behaviour is really the test runner's. Reading the global directly and
*also* accepting an injected clock — rejected: the untested path would be the one
that runs in production.

**Why this is load-bearing here.** The missing `DOM` lib does not stop a bare
`setTimeout` from compiling in this package, so "the compiler keeps timers out" was
never true and the boundary scan gains a timer-spelling rule rather than a comment.

### D3 — Cadence is a pure function of the run's own history

**Decision.** `nextDelay(unchangedInARow)` returns 5s at zero, doubling per
unchanged check, capped at 30s. Any change resets it to zero.

**Alternatives.** A fixed interval — rejected: it either wastes requests while idle
or adds latency when a code is arriving, and both costs are paid on the same screen.
Exponential backoff from the start — rejected: the first check of a mailbox that has
been waiting for a user to type their address is the most latency-sensitive moment
there is. Honouring only a provider header — rejected: no provider sends one for
this client, so "only" would mean never polling adaptively at all.

**Honesty requirement carried into the spec.** The interval is reported as the
product's own, never as a rate the provider permits. A cadence printed as
provider-sanctioned would be a number this repository cannot defend.

### D4 — A rate-limit statement is a floor, never a schedule

**Decision.** When the provider states a rate limit, the delay it states is a
**minimum**, applied verbatim; the cadence never schedules sooner. A refused request
is surfaced and **not** retried.

**Where the statement arrives, and why that settles the contract question.** Both
adapters attach `rateLimit` to a `SpectreError` on `429` and nowhere else, and
`listMessages` returns `MessageSummary[]` — no headers. So the statement surfaces
**with the refusal**, which is also the only moment it matters: a provider that
accepts a request has not stated a limit, and one that refuses has. The alternative
was widening `listMessages` to return response headers, and that is rejected: it
changes the provider contract this slice explicitly promised not to touch, in order
to obtain a statement that arrives anyway on the only path where it changes
behaviour.

**`Retry-After` has no reader, and that is recorded rather than anticipated.**
Neither adapter surfaces it and it was never measured from either provider, so
writing a parser for it would be code no test could exercise against anything real.
If a provider is observed sending it, that is the moment to add the reader — and
the requirement is already written in terms of "a retry delay" rather than one
header name.

**Reading a delay out of the statement, and refusing to read a scope out of it.**
`1; w=60` is a documented machine header with a small grammar, not prose, so the
window is read as a floor: wait at least one window before the next request. What is
*not* read is what the limit is counted per — `30; w=60` does not say "per IP", and
a page showing a number derived from it would be presenting an inference as a
measurement. The value reaches the client verbatim and is never re-parsed there.

**Alternatives.** Parsing `w=60` into a per-window budget and dividing the cadence by
it — rejected, twice over: `30; w=60` does not state its scope, and a rule that
recomputes a schedule from provider prose is the class of rule `packages/mailbox`'s
`normalize` explicitly refuses to write. Auto-retrying on a declared delay —
rejected: `provider-abstraction` requires throttling be surfaced, and a retry the
user cannot see is a silent retry.

### D5 — The analysis is cached by message id, inside the session

**Decision.** The session holds a map from message id to its verdict, including an
explicit "could not be determined" outcome. The inbox row is rendered from that
map, never from a fresh parse.

**Alternatives.** Parsing on render — rejected: it would re-read the body on every
render, which is a provider request per frame. Storing the verdict on the
`MessageSummary` — rejected: `core` is a type surface and M2's purpose is "the model
and its invariants only"; a transient analysis result is session state, not a
property of a message. A module-level cache — rejected for the same reason
`packages/mailbox` is a session and not a singleton: two clients, two sessions, two
caches.

**The "undetermined" outcome is not optional.** Without it, a body that failed to
read is indistinguishable from a body with no code, and the row would say a message
carries nothing — a claim about a message the product never read.

### D6 — A failed listing annotates the inbox and leaves the mailbox alone

**Decision.** Inbox state is its own discriminated union carrying the mailbox's
messages, whether a check is in progress, and a check failure if there is one. A
failed check produces a new inbox value; it never produces a new session state that
drops the mailbox.

**Alternatives.** Reporting a failed check as a failed session — rejected: it would
take a working address off the screen because a list request failed, which is the
single most expensive thing this slice could do. An inbox state of
`messages | error | loading` as three loose values — rejected for slice 1's reason,
which still holds: those can disagree, and the disagreement renders as a bug nobody
writes a test for.

### D7 — Polling stops when nothing is displaying the inbox, and the caller says so

**Decision.** The client reports visibility; the session polls only while visible.

**Alternatives.** The session reading `document.visibilityState` — rejected: it
would make the package reach the DOM, which is the boundary slice 1 spent a
milestone establishing. An unconditional poller — rejected: requests made for a
screen nobody can see are cost with no possible benefit, and against a provider with
no published limit, "unnecessary" is the wrong word for them.

**Sharp edge, recorded.** A browser throttles timers in a hidden tab, so the
effective interval is far longer than the nominal one anyway. Making the poller react
to an actual return to visibility means the first check after a hidden period is
prompt rather than delayed by a backoff the user never saw start.

### D8 — The parser's first client, one-way and still pure

**Decision.** `packages/mailbox` depends on `@spectre-mail/mail-parser` and calls
`analyse` on the fetched text. Nothing in the dependency runs the other way.

**Why this is safe to state.** M4 delivered the parser with no client using it, so
this is where "no network, no clock, no AI" stops being a property of an unused
package and becomes a property of a used one. `tests/architecture/boundaries.test.ts`
already asserts no module in `packages/mail-parser` reaches the global `fetch`, and
the corpus test proves zero requests by observation; both now guard a package with a
real caller.

**What must not happen.** The parser must not gain a client-shaped parameter. If
`analyse` ever needs to know which provider a body came from, the fix is a new
parser input, not a reach into the session.

## Risks / Trade-offs

**[The chosen cadence is wrong and the provider throttles]** → The poller reacts to
a declared limit rather than assuming one, a refused request is surfaced instead of
retried, and the interval is a single declared value so a measured limit can replace
it in one edit. Recorded explicitly: **this interval has never been tested against a
live provider**, because no limit was ever measured to test it against. The first
live mailbox that receives mail is the first live exercise of this path.

**[Backoff hides a message that arrived during the quiet period]** → Backoff is
capped at 30s, and any change resets it, so the worst case is 30s of delay rather
than a growing blind spot.

**[Analysis-once caches a stale verdict]** → A message's body does not change after
it is delivered. If that ever stops being true, the cache is the thing to remove, and
D5 says where it lives.

**[One body fetch per new message costs more than one list request]** → It is paid
once per message, not once per poll, and only for messages not already determined. A
burst of ten messages costs ten reads at the moment of arrival — the same window in
which any implementation would want them.

**[The inbox is incomplete for a moment after a burst]** → The row says "could not
be determined" rather than claiming no code exists. This is deliberate: a wrong
absence claim costs a user their verification code.

**[No browser has ever run this]** → Every assertion in this slice runs against a
stub provider or the real Guerrilla adapter over a recording transport. It proves the
page composes the abstraction correctly and says nothing about whether a real browser
reaches the provider.

## Migration Plan

None. No stored state, no wire format, no persisted mailbox. `SessionState`'s
`ready` variant grows a sibling field; no consumer outside this repository reads it.

## Open Questions

**Whether the 30-second ceiling is comfortable for a user watching a slow
verification.** Answerable from use, not from evidence, and it is a single declared
value — changing it changes no requirement and no task. Deferred deliberately rather
than resolved by guessing.

**Whether a hidden page's already-scheduled request should be cancelled immediately
or simply not rescheduled.** Depends on D7's implementation shape; either satisfies
the requirement, which is written in terms of *not polling*, not *not scheduling*.