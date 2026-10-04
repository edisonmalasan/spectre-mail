# Design

## Context

Three facts from the repository, all measured, shape every decision below.

**`packages/storage` exists and nothing calls it.** M6 slice 1 delivered a
`SpectreStorage` contract with `loadMailbox` and `saveMailbox`, and an IndexedDB
adapter behind it, with 27 tests. `SpectreStorage` is an interface: no method names
a platform API, no client names one, and `tests/architecture/boundaries.test.ts`
enforces both directions — no shared package but the storage layer may name a
storage API, and no shared package may import the storage layer at all.

**A dead Guerrilla Mail session answers `HTTP 200` with an empty inbox and no
error** (`docs/PROVIDERS.md` §3). The adapter already tells that apart from an
empty mailbox: `sessionIsLive` checks the session the response carries against the
mailbox's own credentials, and a dead one raises `MAILBOX_EXPIRED`. That check
exists, is tested, and is the mechanism this change must use rather than duplicate.

**The website boots by creating a mailbox.** `useMailboxSession` calls
`session.open()` from a mount effect guarded by a ref for StrictMode, and
`SessionState` starts at `{ kind: "creating" }`. There is no state for "has not
looked yet", because there was nothing to look for.

The archived `spectre-storage` change recorded the parts of this that were decided
before there was code to apply them to, and they are adopted here rather than
re-derived: its D10 (the session layer stays storage-free and receives the mailbox
as a value), D11 (a restored mailbox is reconciled through its owning provider
before it is presented), and D12 (this layer stores a mailbox and not a session).

## Goals / Non-Goals

**Goals:**

- One code path from "a stored mailbox exists" to "the user is looking at it",
  with no step that can present an address the provider has not confirmed.
- Keep `packages/mailbox` free of storage, so the architecture rule slice 1 proved
  falsifiable is still true after this change rather than merely still written.
- Make every state the page can reach say something true, including the three
  recovery adds.

**Non-Goals:**

- Deleting stored data. M5's `clear local SpectreMail data` acceptance line belongs
  to M6's privacy-controls slice, and writing a delete operation here would put
  that responsibility in two places.
- The extension's storage adapter, which is M8's client and needs
  `chrome.storage` — a platform with no transactions, so the durability guarantee
  would have to be restated per platform rather than implemented once.
- Copying a one-time code, opening a verification link, or any other M10 action.
- Deciding which *other* record kinds the contract grows. It has room for one and
  this change uses that one.

## Decisions

### D1 - The session gains `restore(stored: Mailbox | null)`, not `adopt(mailbox)`

The session starts at a new `idle` variant and gains one operation that takes
either a stored mailbox or `null`.

```ts
restore(stored: Mailbox | null): Promise<SessionState>;
```

`null` means "nothing is stored", and it is an explicit argument rather than an
implicit behaviour so the decision to create a mailbox is one the caller makes
visibly. `open()` keeps its current meaning — create a new one, user-initiated —
and stays the operation behind *Replace address* and the retry on a failed
creation.

**Why not `adopt(mailbox)`, with `open()` still doing the boot?** Because then two
things create a mailbox, and a caller that failed to read storage would reach for
`open()` — which is precisely the silent replacement the requirements forbid. With
`restore`, the session is the only place that decides between recovering and
creating, and that decision is one call.

**Why not put the boot decision in the client?** It was the alternative, and it is
the rejected one: a client that owns boot holds a second state machine and renders
the session's states only after it has decided what they mean. `App.tsx` would
need its own `looking` / `haveMailbox` / `haveNothing` union, and the two would
disagree the first time a state was added. One owner of "what is the page doing" is
the property the whole `SessionState` union exists to provide.

**The cost, stated:** `restore` takes `null`, which reads oddly for a method named
after restoration. It is the honest signature, because `null` is the answer to the
question the method is named for, and the alternative — a `restore()` and an
`adopt()` — puts the same decision behind two doors.

### D2 - Seven session states, and no state is folded into another

`SessionState` gains `idle`, `adopting`, `expired`, and `restoreFailed`; `creating`,
`ready`, and `failed` are unchanged. A successful adoption reports **`ready`**,
the variant it already has.

**Why `ready` and not a new `restored`.** They are the same claim — here is a live
mailbox you may use — and the page already renders it. A separate variant would
double every render branch in `App.tsx` and buy one sentence: that this address is
the one you came back for. That sentence is the *client's* to write, and the client
knows it, because the client is what called `restore`.

**Why `idle` is needed.** `createMailboxSession` starts at `creating`, which today
is honest because the session's first act is to create a mailbox. After this
change its first act is to look, and a session that has been built and asked to do
nothing is not creating a mailbox. Without it, a page that renders before it has
asked says "Asking Guerrilla Mail for a new address" while it is in fact asking
IndexedDB a question.

**Why `adopting` is separate from `creating`.** Because reusing `creating` means
the page's existing copy — *Asking Guerrilla Mail for a new address* — becomes
false in exactly the situation where it is most visible. Adopting asks about an
address that exists; creating asks for one that does not.

**Why `expired` and `restoreFailed` are two variants rather than one plus an error
code.** They offer the user different things. A mailbox the provider has dropped
cannot be retried into existence, so it offers a new address. One that could not be
checked may work on the next attempt, so it offers a retry. Collapsing them means
every client compares `failure.code === MAILBOX_EXPIRED` to recover the difference,
which puts the comparison in each client instead of once — and this repository has
already recorded, in the message-view slice, that a state which reports "nothing
found" when it never looked is the one false claim that costs a user their code.

**Why `restoreFailed` keeps the stored mailbox.** A dropped request is not evidence
about the provider. Discarding the record would mean one network failure costs the
user the address they came back for, which is a worse outcome than showing them
the address and saying it could not be checked.

### D3 - Reconciliation is one real provider request, and it reuses `sessionIsLive`

Adoption performs a listing through the mailbox's owning provider and lets the
adapter's dead-session detection decide. On success the session reports `ready`
with the listing it obtained. On `MAILBOX_EXPIRED` it reports `expired`. On any
other failure it reports `restoreFailed` with the failure.

**Why a listing and not a health check.** Because a listing is the request whose
success already proves the provider recognises the session — the Guerrilla adapter
raises `MAILBOX_EXPIRED` from the listing path when the session is dead, and the
listing is what the inbox needs anyway. A health check would be a second request
answering a weaker question, and against a provider that publishes no limit for
this path, a request that answers nothing is cost against an unknown budget.

**Why this does not double the work.** A successful adoption's listing is the
inbox's first listing. The session sets the inbox to `checked` with that listing
rather than `notStarted`, so a restored mailbox does not immediately re-ask.

**Why not infer validity from the stored record.** Because the stored record proves
only that this device once held a mailbox. That is a different claim from the one
the page is about to make, and the difference is the whole reason this change
exists.

### D4 - A restored mailbox is presented, and the stored record is not rewritten by it

`restore` does not save. The mailbox being adopted is already stored, and writing it
back would be a no-op that could fail for no benefit.

The client saves in exactly one place: **when a session reports a mailbox in
`ready` that is not the one it was handed.** That single rule covers creation after
a first visit, the replacement after *Replace address*, and a retry after a failed
creation, without the session or the page tracking provenance.

**Why not "save on every `ready`".** It would write on adoption, which is the
no-op above, and it would write a mailbox the provider has just confirmed without
needing to.

### D5 - The client composes storage; the session never sees it

`apps/web` builds a `SpectreStorage` and calls `loadMailbox()`, then hands the
result to `restore`. The session's signature is a `Mailbox | null`, so there is no
path by which a storage handle could reach it — the type makes the dependency
impossible rather than the boundary rule forbidding it.

`useMailboxSession` gains the boot step: on mount, read storage, then call
`restore` with what came back. Its existing StrictMode ref guard extends to the
whole boot sequence, so a double mount performs **one** storage read and one
`restore`, for the same reason it performs one `open` today — a second one against a
provider that rate-limits creation is not a harmless duplicate.

### D6 - `packages/storage` gains a browser factory, and the injected rule stands

A new module exports a function that reads the platform's `indexedDB` and passes it
to `createIndexedDbStorage`. Where the platform provides none, it throws with a
message that says so.

**Why this and not a client-side `window.indexedDB`.** Because `spectre-storage`'s
promoted requirement says no client may name a platform storage API. Passing
`window.indexedDB` from `apps/web` would make that requirement false, and the
alternative — weakening it to "no *shared* package" — would leave a client free to
reach for a different store the first time one was inconvenient. Adding the entry
point inside the layer leaves both the requirement and slice 1's no-global-default
rule exactly as they were.

**Why it throws rather than falling back.** A fallback that stores nothing would
let the page report "nothing is stored" on a device where persistence is merely
unavailable, which is the failure `spectre-storage`'s `null`-means-one-thing
requirement exists to prevent — one layer up.

**Why the no-global-default rule is not relaxed.** `createIndexedDbStorage` stays
injected, because its default would be a path that compiles in every environment
and only runs in a browser. The browser factory is a separate, separately named
export, so the injected one remains testable in `fake-indexeddb` with no platform
present at all.

### D7 - The client's own boundary rules are not widened

`apps/web` gains `@spectre-mail/storage` as a dependency, which the
storage-import rule **already permits** — it scans `packages/*`, and a client
importing the storage layer is its intended use. No rule is added or widened.

`packages/storage`'s dependency rule is also untouched: it still declares exactly
`@spectre-mail/core`, and the new module adds nothing, because it reads a platform
global rather than importing anything.

### D8 - Why the reload requirement had to change, and why it is not simply deleted

`mailbox-session`'s *A reload loses the session* becomes false the moment a client
adopts a stored mailbox. Two responses were available.

**Deleting it** would have left the promoted spec silent on a question it used to
answer, and silence about recovery is how `return to a recent mailbox` gets
re-litigated every time someone reads the spec.

**Qualifying it** — which is what the delta does — keeps the claim and makes it
precise. The title is unchanged, because it is still true; the *GIVEN* now says the
session is handed nothing. The cause of losing a session was never the reload. It
was that nobody offered a stored mailbox, and that is the condition the requirement
should have been about.

The amendment is written **into the delta** during propose, not added at sync, so
the archived record and the promoted spec agree. This is the rule M4's numbers
argue for and M5's slices 3 and 4 followed: a gap between a delta and its promoted
spec means an amendment was recorded in the wrong artifact.

### D9 - Rejected alternatives

**Storage inside `MailboxSession`.** Rejected, and it was the shape slice 1's
contract decision pointed away from. It would make the session reach a platform
store, breaking the requirement this repository enforces in both directions, and it
would give the extension at M8 a second way to persist — one that assumes IndexedDB
is available. The value-plus-reconciliation split gets the same recovery with the
boundary intact.

**Restored state living only in `apps/web`.** Rejected. It would make the client
the only place that knows a mailbox can be restored, so the extension at M8 would
reimplement adoption — including the part that is hard, which is knowing when *not*
to present an address. It would also put the failure modes in the client, where the
provider's dead-session behaviour has to be interpreted again, per client, in
words.

**Presenting the stored mailbox immediately and reconciling afterwards.** Rejected
outright: it puts an unconfirmed address on screen at the moment the user is about
to copy it into a third-party sign-up form, and the later correction would be the
product admitting it had shown them something unusable. It is also the one option
that makes the empty-inbox trap reachable, because a mailbox that looks fine until
its first listing is exactly the case where the trap fires.

**Storing the session rather than the mailbox.** Already settled by slice 1's D12
and not revisited: a session carries scheduler and retention decisions that are not
worth persisting, and a mailbox with its credentials is what the recovery path
actually needs.

## Risks / Trade-offs

- **Seven session states is a lot of variants** → each is a distinct claim the page
  must make in distinct words, which `website-client` already requires rather than
  merely permits. The alternative is fewer variants and a code comparison in every
  client; see D2.
- **Adoption costs one provider request per page load for returning visitors** →
  that is the price of not showing an unconfirmed address, and it is a request the
  page would have made anyway for the inbox, so D3's reuse means it is not
  additional. It has still never been made against a live provider.
- **A restored mailbox whose provider has no dead-session signal cannot be
  distinguished from an empty one** → only Guerrilla Mail is reachable from the
  website and it has the signal. Mail.tm at M8 must be checked for this before its
  adapter is trusted with recovery; recorded as a task, not assumed.
- **The privacy controls do not exist yet**, so a device that stores a mailbox has
  no way to remove it from this product → that is M6's next slice and the reason it
  is scheduled immediately after this one rather than later.
- **The client now saves on any `ready` it did not adopt**, which is a rule a later
  reader could implement too broadly → the rule is stated once, in one place in the
  binding, and its test drives the replacement path specifically.

## Migration Plan

None, and the shape of the change makes that unusual statement true rather than
convenient. There is no stored data to migrate — slice 1 shipped a contract that
nothing wrote to, so every device reaching this version has nothing stored and will
take the first-visit path. Rollback is reverting the merge; nothing a user relied
on disappears with it.

## Open Questions

None that change the approach. Whether Mail.tm's adapter can distinguish a dead
session from an empty mailbox is a real unknown, but it is answerable only against
the live provider at M8 and changes nothing about this design, which requires the
signal rather than assuming one.