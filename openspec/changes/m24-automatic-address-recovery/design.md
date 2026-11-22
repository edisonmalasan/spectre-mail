# Design — M24 Automatic Address Recovery

## Context

See `proposal.md` for the why. The source facts that shape this design, measured
2026-11-22 on the tree this proposal branches from:

1. `apps/web/src/StoredAddressGone.tsx:40–49` declares `StoredAddressGoneProps`
   with `mailbox`, `onRetry` and `onReplace`; `:63–68` renders two `<button>`
   elements ("Get a new address", "Check the saved address again"). The two test
   hooks this change must keep are `expired-address` (`:59`) and
   `expired-explanation` (`:54`).
2. `apps/web/src/App.tsx:187–193` renders that component for `state.kind ===
   "expired"`, passing `onRetry={retryBoot}` and `onReplace={getNewAddress}`.
3. `apps/web/src/useMailboxSession.ts:408–411` defines `getNewAddress` as
   `persist.current = true; run(() => session.open())`. Its doc at `:392–407`
   records that it is deliberately distinct from `startFresh` (`:387–390`,
   which sets `persist.current = false`) and from the toolbar's `replace`
   (`:459–482`, which keeps the current state on screen and carries its own
   coalescing guard). The save effect writes only on `isReady(state)`.
4. `packages/storage/src/indexeddb-mailboxes.ts:399–438` writes
   `CURRENT_MAILBOX_KEY` and the recent-mailbox collection in **one transaction**.
   Persisting the replacement therefore overwrites the dead single record and
   preserves the collection without any clearance step.
5. The `restoreFailed` branch at `App.tsx:194–201` renders
   `StoredAddressUnchecked` with `onRetry={retry}` and
   `onStartFresh={startFresh}`; its two controls and its copy are unchanged by
   this work.

Constraints already settled by promoted specs: `website-client` requires the
website to persist the mailbox it holds, to offer no lifetime it cannot know, and
to report a check it could not complete as inconclusive; `mailbox-session` says
provider health is reported, never inferred; `spectre-storage` defines
`saveMailbox` as the durable write of both the single record and the collection.
No requirement in those last two capabilities changes here.

## Goals / Non-Goals

**Goals:**

- When the provider definitively reports the stored mailbox gone, create and
  persist a replacement automatically, without any user activation.
- Leave the gone screen with no buttons and no choice, keeping its two testids and
  its truthful copy.
- Keep the `restoreFailed` path, its component and its two controls exactly as
  they are.
- Preserve every stored record: overwrite the single current record, leave the
  collection — including the dead address — intact.
- Introduce no timing primitive and no invented mailbox lifetime.

**Non-Goals:**

- Clearing a stored record, calling `clearAll`, or any deletion of user data.
- Changing `mailbox-session`, `spectre-storage`, any provider adapter, any
  package, the extension, the cadence, the page composition, the design tokens,
  the workflow, `AGENTS.md`, `docs/PROVIDERS.md` or the archived record.
- Touching the `restoreFailed` screen or its spec scenario.
- Determining how long a Guerrilla Mail session lasts, or copying a lifetime
  from another product.
- Verifying any of this against a live provider.

## Decisions

**D1 — One automatic effect, once per page load (brief item (a)).**
`useMailboxSession.ts` gains one effect that watches the session state and calls
`getNewAddress()` exactly when the state becomes `expired`. A module-local ref in
the hook instance records that recovery has fired; the effect returns early if it
is set. This is required because React StrictMode mounts effects twice in
development, and a provider that definitively answered once should be asked for
one new address, not two — the repository already records that unchecked double
activation issues duplicate creates against a rate-limited provider. The guard is
per hook instance and per page load: a deliberate later `startFresh` or `retry`
is not suppressed, because those are different callbacks and do not consult this
ref. The effect must read the transition rather than the mere presence of
`expired` so a state that stays expired cannot re-trigger it.

**D2 — Reuse `getNewAddress` unchanged (brief item (b)).**
The effect calls the existing `getNewAddress` handler rather than duplicating its
body or calling `session.open()` directly. Its sole distinguishing property —
`persist.current = true` before `run(() => session.open())` — is what makes the
save effect persist the result. Consequently the persistence semantics are
exactly those M23 measured: `saveMailbox` overwrites `CURRENT_MAILBOX_KEY` and
adds the replacement to the recent-mailbox collection in one transaction
(`indexeddb-mailboxes.ts:399–438`). No storage adapter, contract or migration
changes. **Tests must wait on the stored record, not only on the address appearing
on screen**, because `ready` is published before the save promise settles.

**D3 — The gone screen is a notice, not a control surface (brief item (c)).**
`StoredAddressGone.tsx` loses `onRetry` and `onReplace` from `StoredAddressGoneProps`
and renders no `<button>`, no `role`, no click handler and no disabled stand-in.
It keeps the `expired-address` and `expired-explanation` testids and every sentence
of its copy, including "nothing on this device was deleted", which stays true.
`App.tsx`'s `expired` branch renders `<StoredAddressGone mailbox={state.mailbox} />`
with no callbacks. A static notice cannot offer a second interpretation of a
definitive answer.

**D4 — `restoreFailed` is explicitly out of scope (brief item (d)).**
`StoredAddressUnchecked.tsx`, its `onRetry`/`onStartFresh` props, its two buttons
and the `App.tsx:194–201` branch are byte-identical after this change. The spec
scenario *The stored address could not be checked* and both `2026-10-05`
amendment notes are carried forward byte-for-byte. A provider that could not be
asked has not said the address is gone; overwriting the stored address there
would discard a possibly-live mailbox. No automatic effect consults or fires on
`restoreFailed`.

**D5 — No deletion, no countdown, no expiry guess (brief item (e)).**
No `clearAll`, no removal of any mailbox from the collection, and no new stored
field. The dead address remains in the recent-mailbox collection; only the single
current record is overwritten by D2. No `setTimeout`, `setInterval`, countdown
component, expiry timestamp derivation, cadence constant or "lifetime" copy is
introduced. Expiry continues to follow the provider's own signal through
`session.restore` / `checkInbox`. The existing `website-client` lifetime
requirement already carries this rule; this delta adds no new one.

**D6 — The delta keeps nine scenarios under two retained headings.** OpenSpec
1.13.2 compares `MODIFIED` blocks against the promoted spec by **exact scenario
title** (`validator.js:635–653`, `requirement-blocks.js:396–423`), and archive
applies the same guard. Dropping or renaming the two scenarios M23 added would
therefore fail both `--strict` validation and archive. Their headings are kept
verbatim and only their bodies are inverted to state the automatic, no-choice
behaviour; the m24 amendment note records this plainly. No scenario is added or
removed, so the promoted tree stays at **209 requirements / 697 scenarios / 17
capabilities**.

**D7 — Falsification plan (brief item (f)).** Each new assertion is proved able to
fail before the change is called done. The named arms:

1. **Remove the auto-effect** — the page stays on the gone screen and no create
   occurs; caught by the automatic-replacement test.
2. **Remove the once-ref** — render under `StrictMode` and assert exactly one
   create; a second create is caught by the StrictMode single-create case.
3. **Drop persistence** — have `getNewAddress` leave `persist.current = false`;
   the store is never updated and the later-visit assertion fails.
4. **Re-add either button** — restore `onReplace` or `onRetry` in the component;
   the no-buttons case fails.
5. **Clear the collection** — call `clearAll` or remove an entry during recovery;
   the collection-survival assertion fails.
6. **Timing-text arm** — inject a countdown / "expires in 5 minutes" string; the
   no-timing-text coverage fails.

Every arm records the catching assertion, a SHA-256 byte-identical restoration of
every mutated file, and the conforming case passing. A survivor is reported as
"not caught" until the mutant itself is read and shown to be a broken mutant, and
no assertion is weakened to make a mutation pass.

## Risks / Trade-offs

- **[Double create under StrictMode]** mitigated by D1's once-ref and the
  StrictMode arm of D7. This is a correctness requirement, not a performance
  optimisation: the provider is rate-limited.
- **[False green from waiting on the screen]** mitigated by D2's wait on the
  stored record and the drop-persistence arm of D7.
- **[Silent loss of the collection]** rejected by D5 → the test asserts the
  collection survives, not merely that the single record changed.
- **[A "recovered" claim that hides the provider's answer]** not introduced: the
  notice still says the address was definitively gone; only the recovery action
  changed.

## Migration Plan

No stored schema change, no data migration, no deletion. Existing devices holding
a dead record recover on the next visit: the effect fires once, persists a
replacement, and the single record is overwritten while the collection survives.
Rollback is a revert of the three client source files; nothing in the storage
layer needs to be undone.

## Open Questions

None that change the specs, the approach or the task breakdown.
