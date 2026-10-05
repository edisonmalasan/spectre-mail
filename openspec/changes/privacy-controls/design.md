# Design

## Context

See `proposal.md` for why. The current state that shapes the approach, all of it
measured rather than assumed:

- `SpectreStorage` has **two** operations, `loadMailbox` and `saveMailbox`. There is
  no deletion anywhere in the repository, and the adapter's own test asserts the
  contract exposes *exactly* those two.
- The adapter holds **one object store under one key** (`CURRENT_MAILBOX_KEY`),
  `SPECTRE_DATABASE_VERSION = 1`, and opens and closes the database per operation.
- **No message history is persisted anywhere.** The inbox lives in memory in
  `packages/mailbox`; the roadmap's other four record kinds have no consumer and no
  store.
- The client binding already has the property this slice depends on: the save effect
  refuses to write a `ready` mailbox whose id equals `handed.current`, the id this
  load was handed. Nothing new is needed to stop a cleared address being rewritten —
  but nothing *tests* it either, which is the gap this slice closes.
- `spectre-storage`'s `Purpose` still reads *"This capability is delivered but not
  consumed."* Slice 2 made that false when the website began reading and writing
  through this layer, and did not amend it.
- The roadmap's Privacy controls block names three controls. What they map to on this
  data model is **measured**, not interpreted — see D4.

Four platform behaviours were measured on this repository's own test substrate
before any of them was designed around. `fake-indexeddb` **is not a browser**, so
each result below is a statement about the substrate the tests run on, and is used
only to justify *which paths get exercised* — never as a claim about what a real
browser does.

| Question | Measured |
| --- | --- |
| Does `deleteDatabase` work? | Yes. |
| A second connection holds it open? | `onblocked` fires and the request **does not complete** — not even after the blocker closes. |
| Delete a database that does not exist? | Succeeds. |
| Open again after a delete? | Succeeds and recreates the store. |

The second row is the load-bearing measurement in this design.

## Goals / Non-Goals

**Goals:**

- One operation, reachable through the existing contract, that removes what this
  device holds.
- A page that tells the truth about local data in both directions — what is kept, and
  that it can be removed.
- A removal that survives the page continuing to run.

**Non-Goals:**

- Any visual design work. M7 owns it.
- Any behaviour for `apps/extension`. M8 owns it, and the directory is still empty.
- A message-history store, preferences, provider health, or provider-credentials
  records. All five appear in the roadmap's Storage block; four have no consumer, and
  the fifth is the mailbox's own. Creating a record kind purely so a control could
  delete it is the failure mode D4 rejects.
- Normalised error codes for removal failures. D9.
- Anything about message reading, polling cadence, or the provider.

## Decisions

### D1 — One new operation, and it means the whole database

`SpectreStorage` gains `clearAll(): Promise<void>`, implemented by the adapter as
`IDBFactory.deleteDatabase`.

The alternative is deleting the one key this build recognises. It is smaller, it is
what the existing read and write already do, and it passes every test anyone would
write against today's single record. It is also wrong in a way that gets worse over
time: the roadmap's Storage block names four more record kinds, and the first build
that adds one makes this control a lie while every test stays green. Removing the
database removes them too, which is what the words on the button mean.

Cost: heavier, and it can be blocked, which D2 handles. The trade is worth it because
the failure mode of the cheap version is silent and permanent, and the failure mode of
this one is a visible refusal.

### D2 — A blocked removal is reported, never waited on

The adapter rejects on `onblocked`, mirroring what `openDatabase` already does for
the same event.

Waiting was considered and rejected on the measurement: the blocked delete **does not
complete after the blocker closes**, on this substrate. An implementation that
awaited it would hang, and the user's only feedback would be a control that stopped
responding. A real browser queues the delete and finishes it when the connections
close — which is exactly the behaviour an implementation may not *rely* on, because
it cannot be observed here and a hang is not a recoverable failure.

The refusal is therefore made explicit, and its message names the cause, because
"another SpectreMail tab is open" is something the user can act on.

### D3 — Removal is idempotent

Clearing a device that stored nothing succeeds. Measured, and required by the spec.
Without it a user who cleared twice, or cleared a fresh device, meets an error for
having reached the state they asked for.

### D4 — No `forgetMailbox`, and the roadmap's three controls map onto one

Measured: this device holds **one record kind**, under one key, in one database.

| Roadmap control | What it maps to |
| --- | --- |
| `Forget mailbox` | The same operation as below — the mailbox *is* the data |
| `Clear mailbox history` | **No referent.** No message history or metadata cache is persisted |
| `Clear all local SpectreMail data` | `clearAll()`, shipped |

Three alternatives were rejected:

- **Ship three buttons.** Two would be identical and one would do nothing. A control
  that cannot act is the fake-UI pattern the project's design direction names
  explicitly, and a "Clear mailbox history" button that clears nothing is worse than
  an absent one: it tells a user their history was removed when nothing was.
- **Ship `forgetMailbox()` alongside `clearAll()`** so the two names can diverge
  later, when a second record kind appears. Rejected as a speculative abstraction: it
  would have no caller, no caller is what would make it real, and adding it now means
  shipping a method whose only exerciser is a test.
- **Build a message-history store so the control has a referent.** Rejected outright.
  That creates user data in order to destroy it, and it is Storage-block scope, not
  Privacy-block scope.

The mapping is recorded in `docs/ROADMAP.md`'s Privacy controls block with this
reason attached, so a reader of the plan finds out what its three lines became rather
than discovering that one has no implementation.

### D5 — The mailbox stays on screen

Removal deletes this device's note of the address. It does not destroy the mailbox,
which lives at the provider, and it does not stop the inbox.

The alternative — return the page to a first-visit state and create a new mailbox —
was rejected because it would immediately **write a new address**, which is the
opposite of what the user asked for and would leave them with a different address
stored without having asked for it. It would also discard a live inbox mid-sign-up,
trading a privacy action for a data loss the user did not request.

So the page keeps the address, keeps the inbox working, and says the one true
consequence: a reload will not bring this address back.

### D6 — No new ref to prevent a re-save; the existing rule is asserted instead

The save rule from slice 2 already returns early when `mailboxId === handed.current`,
so after a removal the polling that follows does not rewrite the address. Adding a
`persist`-style ref would have been redundant — and slice 2 already recorded the
lesson about a field that a type requires but nothing enforces.

The rule is therefore **not reimplemented and is tested**: a removal followed by inbox
transitions must leave the save count unchanged. This is the slice's most important
behaviour and it is exactly the kind of thing that stops being true when someone edits
a comparison, so it gets an assertion rather than a comment.

### D7 — The control is offered only where it can act, and the page says what it holds

The binding gains a third fact beside `boot` and `saving`:

```
localData: { kind: "stored" } | { kind: "none" }
```

It is **not** derivable from `saving`, which is initialised to `saved` whether or not
anything is stored, and it is **not** the `handed` ref, which is an anti-double-write
token set *before* the write is awaited — so it claims a mailbox this device does not
have when the write fails. `localData` is set only where storage state is confirmed:
after a successful boot read, after a successful save, and after a removal.

Offering removal where nothing is stored would be decorative, and the disclosure beside
it has to be true in both directions — including the direction where this device holds
nothing.

### D8 — Removal is confirmed in two steps

It is irreversible, and the address is very often the one a sign-up in progress is
waiting on. Creating a replacement does not recover it: anything already sent to the
old address is gone and the waiting sign-up cannot complete.

The confirmation is an inline second step in the page, not a native `confirm()`,
because a native dialog cannot be styled, is suppressed in some contexts, and is not
something this repository's tests can drive.

### D9 — A refused removal is shown verbatim, and never as a failure of the page's own making

The rejection's message reaches the user unchanged, the same way `boot: blocked`
carries a storage reason. No error code is invented for it.

This follows the decision already recorded in the storage contract's documentation:
the normalized vocabulary in `packages/core` describes **provider** failures, and a
device refusing a deletion is not a provider condition. Inventing a code would widen
a vocabulary two clients switch over, and matching on a message string in
presentation is the failure this repository has repeatedly recorded.

### D10 — The stale `Purpose` is corrected in the promoted spec, not in the delta

`spectre-storage`'s `Purpose` claims the capability is unconsumed. `openspec`
ignores a `## Purpose` section in a delta for an existing capability, so the
correction is made directly in `openspec/specs/spectre-storage/spec.md` at the **sync**
stage, not here and not at archive.

Recording it as a delta section would have been the tidier-looking mistake: the change
would appear to carry the correction and the archive would ship without it.

### D11 — No new boundary rule, and why

The obvious rule — "deletion must not bypass the contract" — is already covered by
`CLIENT_STORAGE_API_PATTERN`, which forbids a client naming `indexedDB` and therefore
forbids a client obtaining a factory to call `deleteDatabase` on. A second rule would
scan for a method name that is unreachable without the API the first rule already
bans.

The rule that *cannot* be written is the behavioural half — that the page does not
write the address back afterwards — because that is a comparison inside the page
rather than a named API. It is a scenario in the spec and an assertion in the client
suite. Stating that here is the point: the difference between what is architectural and
what is merely tested is not always visible from a test.

### D12 — The adapter's "exactly the two operations" assertion becomes three

`indexeddb.test.ts` asserts the returned object's keys are exactly `loadMailbox` and
`saveMailbox`. It is a good assertion and it caught this change, which is the correct
outcome for it to produce. It is widened to three with the reason recorded.

This is recorded rather than quietly edited because it is the shape the repository has
recorded eighteen times before in the opposite direction — a check narrower than the
rule it documents. Here the check was right and the rule grew, and the record is what
distinguishes the two cases from a later reader who finds an edited count.

## Risks / Trade-offs

- **A blocked removal refuses rather than completing**, and a user with two tabs open
  will meet a failure. → The message names the cause and the confirmation step
  mentions it, so the fix is available. This is preferred to a hang (D2), and the
  measurement is what made the preference forced rather than stylistic.
- **Removing the database is heavier than removing a key** and costs an open and a
  close the per-operation design already accepts. → No measurable difference on a
  path a user takes once, deliberately.
- **The guarantee is only as good as the database's reach.** Anything SpectreMail ever
  stored outside this database — there is nothing today — is not covered, and the
  control's wording is scoped to what the layer owns. → The requirement's wording says
  *this device*, and no client is permitted a second store to write to.
- **`localData` can lag a save by the duration of the write.** → Deliberate. It is set
  only on confirmed storage state, so it is never ahead of the truth; `saving` reports
  a refused write separately and in the same breath.
- **Removal while a mailbox is being created** will let that new mailbox be stored,
  because it is a different mailbox from the one that was handed. → Left as it
  behaves and recorded: a mailbox the page creates afterwards is a new mailbox, and a
  first visit stores the mailbox it creates. Treating it otherwise would mean the page
  silently refused to persist, which is its own lie.
- **`fake-indexeddb` is not a browser**, and the blocked path is exercised only
  against it. The blocked *reporting* is therefore verified; whether a real browser's
  delete behaves the same way is not, and no test here claims it. → Stated in the spec
  delta and here. The design does not depend on the answer.