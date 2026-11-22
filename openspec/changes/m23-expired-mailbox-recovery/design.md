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
   (`:414–423`) re-runs that boot. `StoredAddressUnchecked.tsx:63–66` makes the
   truth claim that a failed check changed nothing on the device, and
   `StoredAddressGone.tsx:54–57` currently claims the same thing on the gone
   screen — which a change that clears the record makes false.

Constraints already settled by promoted specs: `website-client` says the
website persists the mailbox it holds, offers no lifetime it cannot know, and
reports a check it could not complete as inconclusive; `mailbox-session` says
an adopted mailbox is reconciled by the provider that owns it and that provider
health is reported, never inferred; `spectre-storage` defines `clearAll` as the
whole-device removal and `saveMailbox` as the durable write. No requirement in
those last two capabilities needs to change for this work.

## Goals / Non-Goals

**Goals:**

- On a provider's confirmed `expired` answer, leave no stored record that can
  produce the gone screen on a later visit.
- Make "Get a new address" create and persist the replacement.
- Make "Check the saved address again" a second question to the same provider
  about the same mailbox, through the restore path.
- Keep the inconclusive (`restoreFailed`) state's meaning and its ordinary copy
  true.
- Introduce no lifetime, countdown, timer, or new polling interval.

**Non-Goals:**

- Changing `mailbox-session`, `spectre-storage`, any provider adapter, the
  extension, the cadence, the page composition, the design tokens, or the
  archived record.
- Adding a single-mailbox removal operation to the storage contracts, or
  changing what `clearAll` means.
- Determining how long a Guerrilla Mail session lasts, or copying a lifetime
  from another product.
- Verifying any of this against a live provider.

## Decisions

**D1 — Removal happens on the provider's report, not on a button press.**
When the session publishes `expired`, the client clears the dead record. If
removal were deferred until the user pressed "Get a new address", a reader who
saw the gone screen and closed the tab would meet the same dead record on the
return visit — the exact recurrence the user reported. Alternative considered:
an effect that waits for a user action; rejected because it makes requirement
1 conditional on something the requirement does not say.

**D2 — Removal goes through the existing `SpectreStorage.clearAll()`.**
The storage layer already offers one removal and it means everything this device
holds; adding a targeted single-record removal would widen `SpectreStorage` or
`SpectreMailboxes` and require a new IndexedDB implementation, which is a
different change. Cost, recorded rather than hidden: `clearAll` also removes
other record kinds this device holds. The website's boot and return path read
the single current mailbox and this surface offers no other kind, so no live
mailbox is lost in this build. If the website later offers its collection as a
returnable history, a targeted removal becomes necessary — that is a later
change, not a smaller version of this one.

**D3 — The re-check reuses the restore path with the mailbox held in `expired`
state, not `retryBoot` verbatim.** After D1 the stored record is gone, so
`retryBoot`'s boot read would return `null` and `session.restore(null)` would
create a different mailbox — reintroducing the defect from a different door.
The restore step of `startBoot` is therefore reached with the mailbox value the
gone screen is already rendering, captured before the removal. This is the
same `session.restore(mailbox)` call a returning visitor takes; it is not
`session.open()` and it does not guess a mailbox. Alternative considered:
keeping the dead record in storage until a control is pressed; rejected by D1.

**D4 — "Get a new address" sets persistence on and clears the handed-record
comparison.** The handler calls `session.open()` but, unlike `startFresh`,
leaves `persist.current = true` and resets the comparison that suppresses a
write of the mailbox this load was handed, so the save effect stores the
replacement. `startFresh` is not deleted: the `restoreFailed` screen's "Use a
new address for now" still needs a control that leaves the stored record alone,
and requirement 5 preserves that state.

**D5 — The two screens keep different, true accounts of storage.**
`StoredAddressGone.tsx:56` must stop saying *"nothing on this device was
deleted"* once the record is cleared; it says what happened instead.
`StoredAddressUnchecked.tsx:63–66` keeps its existing sentence for the ordinary
boot-time `restoreFailed` path, where nothing was cleared. After a re-check of
an already-cleared mailbox fails, the page reports the check as inconclusive
without claiming the record is intact — the state's meaning (unconfirmed,
nothing replaced, retry and fresh-address controls) is unchanged, and only the
storage sentence is narrowed so it stays true. This is the one design judgement
that a reviewer may want to revisit; the added scenario in the delta names it.

**D6 — No fixed lifetime, and no timing mechanism of any kind.**
Measured on temp-mail.org (2026-11-22): the FAQ says an address is valid
*"until you delete it or until the service changes the domain list"*; the live
API returns no `expires` field; the token JWT has `iat` and no `exp`. There is
nothing to copy and no duration to invent. Expiry continues to follow the
provider's signal through `session.restore`/`checkInbox`. No countdown,
`expiry` field, `setTimeout`/`setInterval`, or cadence constant is introduced.
`website-client`'s existing lifetime requirement and `mailbox-session`'s
"provider health is reported, never inferred" already carry this rule; the
delta only adds the scenario that ties it to the new clearance.

**D7 — A re-check that confirms the same mailbox live persists it again.**
The dead record was cleared in D1, so a live answer is a mailbox the device no
longer holds. Writing it back is not a replacement — it is the same mailbox the
user came back for — and without the write a later visit would treat the device
as a first visit and create a different address. The existing save effect can
deliver this once D4's handed-record comparison is reset.

## Risks / Trade-offs

- **[Whole-device clearance]** `clearAll` removes sibling record kinds →
  accepted for this build (D2); record the cost in the apply report and do not
  widen this change to add a targeted removal.
- **[Re-check after clearance]** the mailbox survives in memory only for this
  page load → a reload after the record is cleared starts a first visit, which
  is the intended consequence of removing a dead record; do not cache the dead
  mailbox for later visits.
- **[Copy drift]** two screens make opposite storage claims → hold each claim
  with a test that reads the rendered sentence, not with a comment (D5).
- **[False green]** a test that waits only for the new address to appear does
  not wait for the storage write → tests must poll the stored record, following
  the repository's recorded lesson about the save round trip.
- **[Lifetime creep]** a future change may add a "cleared because expired"
  interval → the D6 scenario forbids it, and no timing primitive is added.

## Migration Plan

No stored schema changes and no data migration. Existing devices holding a dead
record clear it on the next boot that reports `expired`. Rollback is a revert of
the client wiring; nothing in the storage layer needs to be undone.

## Open Questions

None that change the specs, the approach, or the task breakdown. D5's narrower
storage sentence on the re-check-after-clear path is a recorded decision rather
than a deferred question, because the alternative would leave a sentence the
product knows to be false.
