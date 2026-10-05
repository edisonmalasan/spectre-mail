# Proposal

## Why

The website stores this device's mailbox address so a reload can return the user to
it, and **nothing on the page can delete it**. The page says so in its own limits
list, and it is the reason M6's acceptance line `clear local SpectreMail data` is
still undelivered. A product that keeps an address on a user's disk and cannot be
made to stop is a different product from one that says it keeps nothing, and the
gap between those two is what this change closes.

This is the roadmap's slice 3. Slice 1 built the storage seam with no consumer,
slice 2 wired the website to it, and this slice is the third and last piece of the
same responsibility: the ability to take it back.

## What Changes

- **`SpectreStorage` gains exactly one operation, `clearAll()`.** It means *remove
  everything this device holds*, and the IndexedDB adapter implements it by
  **deleting the database** rather than deleting the records this build recognises.
  This is the load-bearing choice: a control named "clear all local data" that
  removed only today's known record would silently preserve anything a later build
  stored, and the guarantee would rot without anybody noticing.
- **`clearAll()` reports a blocked delete rather than waiting for it.** A blocked
  `deleteDatabase` fires `onblocked`, and the wait ends when some *other* tab closes —
  which the page can neither cause nor predict, and which may be an hour away.
  Measured on this repository's own test substrate while writing the tests: while the
  removal is pending a fresh read is blocked too, and once the holding connection
  closes the queued removal completes on its own. Reporting is therefore the only
  available answer rather than a shortcut past a hang. This mirrors what
  `openDatabase` already does for the same event.
- **`clearAll()` is idempotent.** Measured: deleting a database that does not exist
  succeeds. Clearing twice, or clearing a device that stored nothing, is not an
  error.
- **The website gains a local-data region** that states what is kept, where, and
  that it can now be removed — replacing the current text that says no button can
  remove it. The control is offered **only when this device actually holds
  something**, because a clear control with nothing to clear is decorative and the
  disclosure beside it has to be true in both directions.
- **Clearing is confirmed before it happens.** It is irreversible, and the address
  is frequently the one a sign-up the user is in the middle of is waiting on.
- **The page keeps the mailbox on screen after a clear.** The mailbox lives at the
  provider, not on this device; discarding a live inbox mid-sign-up trades one data
  loss for another. The page says plainly that a reload will not bring the address
  back.
- **A clear is not silently undone.** No new machinery is added: the save rule
  introduced in slice 2 already refuses to write a mailbox whose id is the one the
  page was handed, so a cleared address is not rewritten by the polling that
  follows. This is **asserted by test rather than assumed** — it is the single most
  important property of this slice and it is the kind of thing that stops being true
  when someone edits a comparison.
- **Two existing claims become false and are corrected in place.** The storage
  adapter's test asserts the contract exposes *exactly the two operations*, and
  `spectre-storage`'s `Purpose` still says the capability is *"delivered but not
  consumed"* — which slice 2 made false when the website began using it, and did not
  amend. Both are corrected here rather than left to rot.
- **The roadmap's Privacy controls block is annotated with a dated mapping note.**
  It names three controls; see *Impact* for what they map to on this data model.
- **Not in scope:** no visual design work (M7), no message-history store, no
  provider-health or preferences records, no extension behaviour (M8). Those are
  named in the roadmap's Storage block and are not what a privacy control acts on.

### BREAKING

- **`SpectreStorage` gains a required member.** Every implementation of the contract
  stops compiling until it provides `clearAll`. This affects the IndexedDB adapter,
  the website's injected stubs, and any future extension adapter. It is deliberate:
  a deletion a client cannot reach is not a deletion.

## Capabilities

### New Capabilities

None. Deletion belongs to the storage contract it will be reached through, and the
page that offers it belongs to the website that already exists.

### Modified Capabilities

- `spectre-storage`: adds the requirement that a stored mailbox can be removed on
  the user's request, that removal means *everything this device holds*, that a
  blocked removal is reported rather than waited on, and that the contract stays the
  only route to it. Its `Purpose` is corrected — it still describes the capability
  as unconsumed.
- `website-client`: adds the requirement that the page offers a way to make this
  device forget the address, that it says what removal means for the address the
  user is holding, and that it does not write the address back afterwards.

## Impact

- **`packages/storage`** — `contract.ts` gains `clearAll()`; `indexeddb.ts`
  implements it as `deleteDatabase`, including the blocked path; `indexeddb.test.ts`
  gains tests and its *"exactly the two operations"* assertion becomes three;
  `browser.test.ts` covers the entry point's delegation.
- **`apps/web`** — a local-data region and a confirmation step; the binding gains a
  statement of what this device holds and a way to clear it; the limits list stops
  claiming nothing can be deleted; `storage-stub.ts` and the test doubles in
  `recovery.test.tsx` implement the new member.
- **`docs/ROADMAP.md`** — the Privacy controls block gains a dated note mapping its
  three named controls onto what this data model can act on, and the M6 slice table
  moves slice 3 to applied.
- **`AGENTS.md`** — the several places that state no button anywhere deletes stored
  data become false and are corrected.
- **Roadmap control mapping, and the reason it is a mapping and not three buttons.**
  The block names `Forget mailbox`, `Clear mailbox history`, and `Clear all local
  SpectreMail data`. Measured against the shipped storage layer, this device holds
  **one record kind under one key in one database**, and no message metadata cache
  or message history is persisted anywhere — the inbox lives in memory in
  `packages/mailbox`. So `Forget mailbox` and `Clear all local SpectreMail data`
  are the same operation on today's data, and `Clear mailbox history` has no
  referent at all. Shipping three buttons where two are identical and one does
  nothing would be a fake capability, and inventing a message-history store purely
  so a button could delete it would create data in order to destroy it. One control
  is shipped, named for what it does, and the mapping is recorded rather than
  papered over.
- **Boundary rules** — none added. `CLIENT_STORAGE_API_PATTERN` already forbids a
  client naming `deleteDatabase` or `indexedDB`, so deletion is forced behind the
  contract this slice extends. That the page cannot *bypass* the contract is
  architectural; that it does not *re-save* afterwards is behaviour, and is tested.