# Design — M23 Expired Mailbox Recovery

## Context

See `proposal.md` for the why and the measurements. The three facts that shape
this design are:

1. `apps/web/src/App.tsx:186–191` passes the same `startFresh` to both controls
   of `StoredAddressGone`.
2. `apps/web/src/useMailboxSession.ts:379–382` makes `startFresh` set
   `persist.current = false` and call `run(() => session.open())`; the save
   effect at `:579–605` writes only on `isReady(state)`, so the replacement is
   held for this page load and never stored. The dead record at
   `apps/web/src/useMailboxSession.ts:400–411` is read again on the next boot.
3. The session already has the right second path: `startBoot` (`:394–412`)
   reads the stored mailbox and calls `session.restore(stored)`, and `retryBoot`
   (`:414–423`) re-runs that boot.

**Revision recorded 2026-11-22, from orchestrator review of the first draft.**
That draft made removal of the dead record on `expired` an automatic recovery
action through `SpectreStorage.clearAll()`. The review rejected it and this
design is revised accordingly. The decisive measurement is
`packages/storage/src/indexeddb-mailboxes.ts:399–438`: **`saveMailbox` writes
`CURRENT_MAILBOX_KEY` and adds the mailbox to the recent-mailbox collection in
one transaction.** Persisting the replacement therefore overwrites the dead
single record by itself; clearance is unnecessary for the recurrence defect and
would delete the user's whole recent-mailbox collection. That would violate the
repository's Boundaries rule *"Never delete user data … as part of ordinary
feature work"* and the LocalData promise about what this device keeps.

Constraints already settled by promoted specs: `website-client` says the
website persists the mailbox it holds, offers no lifetime it cannot know, and
reports a check it could not complete as inconclusive; `mailbox-session` says
an adopted mailbox is reconciled by the provider that owns it and that provider
health is reported, never inferred; `spectre-storage` defines `saveMailbox` as
the durable write of both the single record and the collection. No requirement
in those last two capabilities needs to change for this work.

## Goals / Non-Goals

**Goals:**

- Make "Get a new address" create and persist the replacement, so a later visit
  returns to the replacement rather than the stale address.
- Make "Check the saved address again" a second question to the same provider
  about the same mailbox, through the restore path.
- Preserve the inconclusive (`restoreFailed`) state's meaning and its ordinary
  copy true, and preserve every other record this device holds.
- Introduce no lifetime, countdown, timer, or new polling interval.

**Non-Goals:**

- Clearing a stored record, calling `clearAll`, or adding any deletion to this
  change. A dead record that the user does not replace stays on the device.
- Changing `mailbox-session`, `spectre-storage`, any provider adapter, the
  extension, the cadence, the page composition, the design tokens, or the
  archived record.
- Determining how long a Guerrilla Mail session lasts, or copying a lifetime
  from another product.
- Verifying any of this against a live provider.

## Decisions

**D1 — Persisting the replacement is the recovery action.**
The "Get a new address" handler calls `session.open()` with persistence
enabled. `saveMailbox` then writes `CURRENT_MAILBOX_KEY` and adds the mailbox to
the collection in one transaction (`indexeddb-mailboxes.ts:399–438`), so the
dead single record is overwritten and the user's recent mailboxes survive.
Alternative considered and rejected: clearing the dead record with
`clearAll()` when the provider reports `expired`. It is unnecessary — the
overwrite already stops the recurrence — and it deletes the whole area,
including records the user never asked to remove. No clearance, no deletion,
and no new storage operation is part of this change.

**D2 — A user who takes no action sees the truthful gone state again later,
and that is correct.**
If the page is left on the gone screen and the tab is closed, the stored dead
record is still there on the next visit, so the provider is asked again and the
gone state is reported again. This is a fact the provider established, not a
stale guess: it said that address is dead. Clearing the record on a timer or on
an `expired` event would hide that fact and would delete data the user did not
ask to delete. This consequence is recorded explicitly rather than treated as a
remaining defect.

**D3 — The re-check reuses `retryBoot` unchanged.**
The stored record is not cleared, so `retryBoot`'s boot read still finds it and
`startBoot` calls `session.restore(stored)` with that same mailbox. No new
handler, no in-memory snapshot, and no `session.open()` is needed. If the
provider now confirms it, the same address becomes the user's own; if it again
reports it gone, the truthful gone state stays; if the provider cannot be
asked, the ordinary `restoreFailed` state reports that, with nothing discarded
and no copy change. Alternative considered: calling `session.open()` — that is
the current defect, a different mailbox.

**D4 — "Get a new address" sets persistence on; `startFresh` is otherwise
left alone.**
The new handler differs from `startFresh` only in leaving `persist.current =
true`, so the save effect stores the replacement. The `restoreFailed` screen's
"Use a new address for now" still needs `startFresh`'s deliberate behaviour of
creating for this visit while leaving the stored record untouched, and
requirement 5 preserves that state.

**D5 — Both screens keep their existing, true storage copy.**
No sentence in `StoredAddressGone.tsx` or `StoredAddressUnchecked.tsx` changes.
With no clearance, *"nothing on this device was deleted"* remains true on the
gone screen, and *"what is saved on this device has not been changed"* remains
true on the inconclusive screen. No prop, variant, or extra wording is added to
either component.

**D6 — No fixed lifetime, and no timing mechanism of any kind.**
Measured on temp-mail.org (2026-11-22): the FAQ says an address is valid
*"until you delete it or until the service changes the domain list"*; the live
API returns no `expires` field; the token JWT has `iat` and no `exp`. There is
nothing to copy and no duration to invent. Expiry continues to follow the
provider's signal through `session.restore`/`checkInbox`. No countdown,
`expiry` field, `setTimeout`/`setInterval`, or cadence constant is introduced.
`website-client`'s existing lifetime requirement and `mailbox-session`'s
"provider health is reported, never inferred" already carry this rule; the
delta only adds the scenario that ties it to the new persistence path.

## Risks / Trade-offs

- **[Gone state recurs if the user does nothing]** accepted and required (D2):
  it is the provider's answer, and hiding it would be a false "recovered"
  claim. Do not add a clearance or timer to make it stop.
- **[False green]** a test that waits only for the new address to appear does
  not wait for the storage write → tests must poll the stored record, following
  the repository's recorded lesson about the save round trip.
- **[Recent-mailbox collection lost]** rejected by D1 → the test for this
  change must assert the collection survives the replacement, not merely that
  the single record changed.
- **[Lifetime creep]** a future change may add an "expired" interval → the D6
  scenario forbids it, and no timing primitive is added.

## Migration Plan

No stored schema changes, no data migration, and no deletion. Existing devices
holding a dead record keep it until the user replaces it. Rollback is a revert
of the client wiring; nothing in the storage layer needs to be undone.

## Open Questions

None that change the specs, the approach, or the task breakdown. The question
of automatic clearance was resolved by the 2026-11-22 review: no clearance, no
deletion, persistence of the replacement only.
