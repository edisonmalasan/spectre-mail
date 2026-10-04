# Design

## Context

Three facts shape this layer, and all three are measurements or approved rules
rather than preferences.

**The layer does not exist.** `packages/storage/src/index.ts` is an M1
placeholder with no exports. Its docblock already names the trap that constrains
the contract: "an expired Guerrilla session is reported as an empty inbox with no
auth error, so 'no messages' and 'session gone' are indistinguishable at the
storage layer. A contract that stores only a message list cannot represent that."
That is not hypothetical — `packages/providers/src/guerrilla.ts:220` implements
`sessionIsLive`, and `listMessages` throws `MAILBOX_EXPIRED` rather than return an
empty list, precisely because an unrecognised session answers `HTTP 200` with an
empty one (`docs/PROVIDERS.md` §3, "Expired sessions fail silently — a real
data-loss trap").

**Storage is the one place a value arrives from outside the process.**
`packages/core/src/invariants.ts:79` exports `isMailbox` for exactly this, and its
documentation already names the case: "It cannot stop a literal assembled from
`unknown` data, such as a record parsed out of storage. Narrowing that with
`isMailbox` remains necessary, and the two are complementary rather than
alternatives."

**The compiler withholds the DOM from every package but one.** `packages/mailbox`
sets `lib: ["ES2023"]`, so `window`, `document`, and `location` fail to compile —
but `navigator`, `localStorage`, and `sessionStorage` **do** compile, because
`@types/node` declares all three and `"types": []` does not exclude them
(measured by M5 slice 1's verification pass and recorded in that capability's
`Purpose`). `packages/storage/tsconfig.json` is the opposite: it declares
`["ES2023", "DOM", "DOM.Iterable"]`, because this is the one package whose job is
to speak to a platform API.

See `proposal.md` for why this change exists and `specs/spectre-storage/spec.md`
for what it requires.

## Goals / Non-Goals

**Goals:**

- One contract every client persists through, and one implementation of it over
  IndexedDB, both verifiable without a browser or a network.
- A stored record handed back as a `Mailbox` only after it has been narrowed.
- Failures that are distinguishable from emptiness, at every layer of this one.

**Non-Goals:**

- **No client consumes it.** No wiring, no adoption, no restore path. M4 shipped
  `packages/mail-parser` fully verified with "No client consumes it yet", and this
  slice repeats that precedent rather than shipping an untested seam.
- **No `mailbox-session` amendment.** See D9.
- **No privacy controls.** `Forget mailbox`, `Clear mailbox history`, and
  `Clear all local SpectreMail data` are M6's Privacy controls block and a later
  slice. Nothing here deletes a stored record — including a record this slice
  cannot read, for the reason D3 gives.
- **No `preferences`, message-metadata cache, or provider-health records.** The
  roadmap lists all three. None has a consumer, and a record with no consumer is
  a schema to migrate rather than a feature.
- **No extension storage adapter.** `apps/extension` is M8 and is still an empty
  placeholder.
- No styling (M7), no OTP copy or fill (M10).

## Decisions

### D1 — The contract is mailbox-shaped, not a generic key–value bag

`SpectreStorage` exposes `loadMailbox()` and `saveMailbox(mailbox)` and nothing
else. The roadmap's other record kinds are added as methods when they have
consumers.

*Alternative considered — `get(key)` / `set(key, value)` over an open key space.*
Rejected. It moves every naming, versioning, and narrowing decision to the caller,
which means M8's extension reimplements them against `chrome.storage` — and
`chrome.storage` has no transactions, so the guarantee D5 buys would have to be
restated per platform. The contract is where "what is a usable stored record"
lives; a key–value bag has nowhere to put it.

*Cost, stated honestly.* The contract has to grow as records are added, and each
addition is a change to an interface two clients will have implemented. Accepted
because the alternative's cost is paid per client rather than once.

### D2 — `null` means "nothing stored", and a failed read throws

`loadMailbox()` returns `Mailbox | null` and rejects on failure. `null` is
reserved for the one condition it names.

This is the most consequential decision in the change. A contract whose read
returns `undefined` on both "no record" and "the database could not be opened"
makes the client unable to tell them apart, and the client cannot tell them apart
because it was never told. Given M6's job, the second reading is the dangerous
one: nothing stored looks like a first visit, so the client creates a mailbox and
the user's stored identity is overwritten — with no error anywhere.

*Alternative considered — a result object, `{ stored: true, mailbox } | { stored:
false } | { stored: false, error }`.* Rejected as strictly worse: it makes the
ambiguity representable instead of removing it, and every caller has to handle
three arms where a throw is already unwinding.

*Alternative considered — report a failed read as `null` and let the client's own
error state carry the truth.* Rejected. The client's error state would have to be
raised by something that read as success, which is the same false claim this
repository has now recorded seventeen times in a different place.

### D3 — The stored record is versioned, and an unreadable one is left alone

The adapter stores an envelope — `{ version, mailbox }` — and reads it back
through `isMailbox` from `@spectre-mail/core`. A record that does not narrow, or
that carries a version this build does not know, is **not** returned as a mailbox
and is **not deleted**.

The non-deletion is the decision. Deleting on a failed narrow looks tidy and is
irreversible data loss triggered by a code bug: `isMailbox` requires a `status`
field, so any future model change that adds or renames one would silently destroy
every user's stored mailbox the first time this code ran. Leaving the record in
place costs a database entry that the privacy-controls slice will delete on
purpose and that a future migration can still read.

*Alternative considered — delete the record and report it.* Rejected for the
reason above. The honest report is that the record was not usable, and the
consequence of that — the user is not restored — is one the page states rather
than one the storage layer hides.

*Cost, stated honestly.* An unreadable record is invisible to a caller who asks
only for a mailbox, so a client cannot yet tell a user "the address saved here
could not be read". That is a client-side message, and it belongs to the slice
that owns the restore flow.

### D4 — Narrowing is done by `core`, not restated

The adapter calls `isMailbox`. It does not write its own field checks, and it does
not coerce a record into a mailbox.

`isMailbox` already checks the one invariant the type system cannot carry across
an untyped boundary — that `provider` agrees with `credentials.provider` — which
is exactly the check a record read out of storage needs and exactly the one a
hand-written adapter would omit. `packages/core/src/invariants.ts:116` names it.

*Alternative considered — trust the type and write `record as Mailbox`.* Rejected
outright; it is the cast the module's own documentation warns against, and it
would let a record naming one provider with another's credentials reach the
provider layer as a wrong-provider authentication attempt.

### D5 — A save resolves when its transaction completes, not when its request succeeds

`saveMailbox` resolves on `transaction.oncomplete` and rejects on `onerror` and
`onabort`. Resolving on the individual request's success would report a write as
done before it is durable — and a user who reloads on that promise would come
back to a missing mailbox with no explanation.

*Alternative considered — resolve on the request and treat the transaction as an
implementation detail.* Rejected: IndexedDB's request-success event fires inside
the transaction, and the window is real.

### D6 — The IndexedDB dependency is required, not defaulted

`createIndexedDbStorage` takes its `IDBFactory` as a required option.

This follows `createMailboxSession`, whose scheduler is required for a reason
recorded in its own documentation: "a default reaching for the global timer would
compile happily here — `@types/node` declares `setTimeout` in exactly the way it
declares `navigator` — and would then be a path that only runs in production.
Requiring it means there is no such path to take." The same argument applies to
`indexedDB`, and the same measured fact applies: the global compiles in every
package in this workspace, DOM lib or not.

### D7 — `fake-indexeddb`, not a hand-rolled `IDBFactory`

The adapter is tested against `fake-indexeddb`, added as a dev-only dependency.

A hand-written fake implementing the six or seven `IDBFactory` members the adapter
calls would be narrower than the real API by construction — the most persistent
defect class in this repository's own boundary file, where seventeen checks have
been recorded as narrower than the rule they claimed. `fake-indexeddb`
reimplements the specification's own semantics, so a test that passes against it is
evidence about transactions and versioning rather than about a fake's idea of them.

*Cost, stated honestly.* It is a new dependency, and it proves nothing about a
real browser. `AGENTS.md`'s rule against adding dependencies without a concrete
reason is met: without it, either the IndexedDB code is untested or the fake is a
second implementation of IndexedDB nobody maintains.

### D8 — Two boundary rules, one of them generalised

**No shared package but `packages/storage` may name a platform storage API.** The
existing rule holds for `packages/mailbox` and says in its own comment why the
compiler cannot: `navigator`, `localStorage`, and `sessionStorage` all compile
there. That is a property of `@types/node`, not of any one package, so the rule
generalises rather than multiplying.

**`@spectre-mail/storage` is reachable by clients only.** The complementary
direction: a shared package must not depend on the storage layer, which keeps the
dependency arrow pointing from host environments inward and is what lets
`packages/storage` hold the platform API while the session layer holds none.

*Alternative considered — leave the rule as it is and rely on review.* Rejected.
A rule that exists for one package and describes all of them is the pattern this
repository has corrected seven times.

### D9 — No promoted requirement is amended here, and the conflict is named

`mailbox-session`'s scenario **A reload loses the session** states that after a
reload the session "SHALL NOT claim to have recovered that mailbox". M6 requires
exactly that claim, so the scenario is now false as a statement of intended
behaviour. It is **not** amended in this change.

Amending it here would promote a requirement describing an adopt path that does not
exist, which is the defect `provider-adapters` records at its sync stage in the
opposite direction — a spec satisfied in principle and unimplemented. The scenario
is correct about everything M5 did; it is wrong about what M6 wants. The slice
that delivers recovery amends it in the same change as the behaviour, following
this repository's own rule that a missing or incorrect requirement is corrected by
updating the change rather than by diverging from it silently.

## Deferred: the recovery contract this layer must permit

Recorded here because the user-facing decisions are made now and the repository
should not have to reconstruct them at the next slice, and because they constrain
what this contract is allowed to look like. **None of it is implemented by this
change.** Each item names the slice that owns it.

### D10 — The session layer stays storage-free, and receives the mailbox as a value

`MailboxSession` gains an adopt path that takes a `Mailbox` **as a value**. The
client reads storage; the session is handed what it read.

*Alternative considered — put storage access inside `MailboxSession`, e.g.
`restore()`.* Rejected, and this is the alternative most worth spelling out.
`mailbox-session`'s requirement *The session layer holds no framework, DOM, or
storage state* is load-bearing, and its own `Purpose` records that **half of it
is not enforced by the compiler** — the missing `DOM` lib rejects `window`,
`document`, and `location` and nothing else, so a session that quietly persisted
itself through `localStorage` "would have compiled, typechecked, linted, and
passed every other rule in this repository". Adding a storage call to that package
would spend the one guarantee the rule still holds and make the storage seam
invisible at the boundary where it is supposed to be checked. It would also make
the extension's persistence — `chrome.storage`, a different platform with no
transactions — a second implementation inside a package that is supposed to be
shared verbatim.

*Alternative considered — keep the restored mailbox entirely in `apps/web`, and
have the page render it without the session knowing.* Rejected. The session owns
the mailbox lifecycle, so a page-held mailbox would have to be pushed into the
session through `open()`/`replace()`, neither of which accepts one — the client
would create a *new* mailbox and render the restored address above it. That is
precisely the silent replacement this milestone must not produce.

### D11 — A restored mailbox is reconciled through its owning provider before it is presented

Adoption verifies the mailbox by asking the provider that owns it to list its
messages, and the listing's outcome decides what is published. The Guerrilla
adapter already throws `MAILBOX_EXPIRED` for an unrecognised session rather than
returning an empty list, so the reconciliation reuses an existing, tested
mechanism instead of inventing a liveness probe.

The client must **never** treat a successful listing with zero messages as proof
that a restored mailbox is valid. That inference is the measured trap itself: the
provider answers a dead session with `HTTP 200` and an empty list
(`docs/PROVIDERS.md` §3). The reconciliation is sound only because the adapter
refuses to produce that answer; a requirement that did not say so would be
satisfied by an adapter that did not check.

A restored mailbox whose provider no longer honours it surfaces as an explicit
gone state. A dead session is never rendered as an empty inbox, and a replacement
mailbox is never created and presented as the restored identity.

### D12 — Why this layer stores a mailbox and not a session

`packages/core`'s `Mailbox` carries its `credentials` inline, so a stored record
already holds the provider session token and no separate credential store is
needed. `provider-adapters`' scenario *Credentials are stored* already requires
that persisted credentials use the normalized credential shape and no provider
wire field name; returning `Mailbox` rather than a bespoke record makes that
automatic.

The cost is that the token lives in IndexedDB. It is scoped to this origin, it is
the same value the page already holds in memory, and M6's privacy controls exist
to delete it on request — but it is a session credential at rest, and the design
says so rather than leaving it implicit.

## Risks / Trade-offs

- **The contract is unused when this change lands** → deliberately, and recorded
  in the spec and in `docs/ROADMAP.md`. A seam built ahead of its consumer is the
  alternative to a client wired against an untested contract, and M4 already chose
  the former.
- **A narrow `isMailbox` could reject a valid future record** → D3's non-deletion,
  plus the versioned envelope, means the record survives to be read by code that
  understands it.
- **`fake-indexeddb` is not a browser** → no claim about a real browser is made
  anywhere, and `docs/ROADMAP.md`'s Project Status keeps the standing statement
  that the website has never been run in one.
- **Persisting a session token at rest** → D12 states it, the value is
  origin-scoped, and the deletion controls are M6's own later slice rather than an
  assumption that something else will remove it.
- **The generalised storage rule is broader than the one it replaces** → that is
  the point, and its control must be a probe that injects a storage global into a
  *different* package, or it would pass for the same reason the old rule did.

## Verification findings

**Recorded during apply (2026-10-05).** The falsification pass ran 27 mutations and
all 27 are now caught, with the intended test named in every case and every mutated
file restored byte-identical by SHA-256. It found **six defects in assertions this
change authored**, all of them fixed. They are recorded here rather than only in the
diff because the reasoning is what a later reader needs, and the fifth of them is a
fact about this repository's checks that belongs beside the rules.

1. **Generalising the rule to every shared package reported a real false positive.**
   `packages/providers/src/fixtures.ts` holds a recorded `set-cookie` response
   header from the M0 spike, which the pattern read as a cookie jar. The fix is in
   the pattern — a hyphen now counts as a word character — and the **cost is stated
   in the rule's own comment**: a global reached through a hyphenated name would be
   missed, and no JavaScript global is written that way. A pattern tightened by one
   change and one of this slice's own mutations.

2. **The generalised rule's control was in `packages/core` for a reason, and it had
   to be.** A probe in `packages/mailbox` would have been satisfied by the rule as
   it was written before this change. This is the control doing the job D8 says it
   must do.

3. **The generalised rule's negative control was wrong on arrival.** It asserted an
   empty result for `packages/storage` and failed on the package's own
   implementation, which legitimately names `indexedDB` in its option type. An
   allowance is what makes the *rule* pass, so the control now compares two packages
   through the rule's own scan.

4. **The two rules shared one allowance constant, and falsification showed the
   coupling is observable.** Widening the storage-API allowance also silenced the
   *import* rule, and the test that reported it was the wrong one. They are now
   separate constants: two boundaries that happen to agree today are two boundaries.

5. **Four mutations left the suite green, and all four had the same cause — a
   control that called the *function* rather than the *rule*.** A negative assertion
   (`violations == []`) is structurally unfalsifiable on its own: narrowing a rule's
   package list to `["mailbox"]`, to `[]`, or shortening its scan loop all leave it
   satisfied, because every package it stopped scanning happened to be clean. Three
   attempts to catch that with a control elsewhere in the file also stayed green.
   The resolution is not a better control but a smaller surface:

   - Each scan function now takes **no package argument at all**, so there is no
     second spelling of the list to narrow. The two ways it *could* be narrowed are
     both asserted instead.
   - `SHARED_PACKAGES` is checked against the **directory contents on disk**, so a
     package added without appearing in the list fails rather than being silently
     exempt.
   - Each rule's positive and negative halves are asserted **in one test through one
     call site**: a probe is planted in every package the rule must scan and the rule
     must report each one by name, and only then is it asserted to report nothing.
     A rule that scans nothing fails the first; a rule that cannot see a planted
     violation fails the second.

   This is the **eighteenth** recorded instance of a check narrower than the rule it
   documents, and the **second** this change authored and then found in its own
   falsification pass.

6. **A control's expectation was computed out of the thing it tested.** The
   planted-probe assertion derived its expected package list by filtering out the
   allowance constant, so widening the allowance moved both sides and the rule
   silently stopped guarding `packages/core` with the suite green. The expectation is
   now transcribed. A control must not compute its own expectation from the value
   under test — and neither must its filter: the per-form assertions had been
   filtering by probe *file name*, which also matched probes planted in the other
   packages, so a form the rule genuinely missed was satisfied by an unrelated
   package's violation.

   One further assertion, in `record.test.ts`, was caught by three other tests before
   the falsification pass showed it was caught **for an unrelated reason**: the
   "does not throw" loop contained only values that failed narrowing trivially, so
   turning the `null` branch into a `throw` was detected as collateral damage. It now
   includes a well-shaped record that fails `isMailbox`, and pairs "does not throw"
   with "returns null" so one cannot satisfy the other.

## Migration Plan

None. Nothing consumes this package, no data exists to migrate, and no user-visible
behaviour changes. The change is reversible by reverting one commit.

## Open Questions

None that change the approach. Whether the recovery flow's copy belongs in the
client or in a shared error-message table is decided by the slice that delivers
M6's Error states block, and does not constrain this contract's shape.
