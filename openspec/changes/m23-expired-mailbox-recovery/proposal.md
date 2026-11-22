# Proposal: M23 — Expired Mailbox Recovery

## Why

Measured 2026-11-22 from a user report: the website shows **"Your saved address
is gone"** on every visit, even after the user asks for a new address. The
wiring and the save rule disagree about what a replacement means:

- `apps/web/src/App.tsx:186–191` wires **both** controls of `StoredAddressGone`
  to the same `startFresh` callback.
- `apps/web/src/useMailboxSession.ts:379–382` defines `startFresh` as
  `persist.current = false; run(() => session.open())`. It creates a **new**
  mailbox, deliberately does **not** persist it, and never removes the dead
  stored record.
- The save effect at `apps/web/src/useMailboxSession.ts:579–605` writes only
  when `isReady(state)`, and `persist.current` is false on that path, so the new
  address is never stored.
- The next visit therefore reads the same dead record and shows the same screen.

The second control is worse than ineffective: the button labelled **"Check the
saved address again"** also calls `startFresh`, so it creates a different
mailbox instead of re-asking the provider about the saved one. That contradicts
the component's own contract at `apps/web/src/StoredAddressGone.tsx:26–33`,
which describes re-asking about the *same* address because a provider that
reported a session dead once may report it live on the next request.

A separate measurement of temp-mail.org (the UI reference, 2026-11-22) found
**no fixed lifetime to copy**: its FAQ says an address is valid *"until you
delete it or until the service changes the domain list"*, its live API returns
no `expires` field, and its token JWT carries `iat` but no `exp`. This change
will not introduce a countdown, timer, interval, or invented duration. It is
about clearing a provider-confirmed-dead record and persisting its replacement.

## What Changes

- When the provider confirms a stored mailbox is gone (`expired`), remove that
  dead record from this device so a later visit does not surface the "gone"
  screen again. Removal happens on the provider's report, not on a timer and not
  only when the user presses a button.
- Make **"Get a new address"** create a new mailbox **and persist it** as the
  mailbox this device returns to on a later visit. The screen's present claim
  that *"nothing on this device was deleted"* (`StoredAddressGone.tsx:56`) must
  be replaced by an accurate account, since the stale record has been cleared.
- Make **"Check the saved address again"** re-ask the provider about the
  **same** stored mailbox through the existing boot/restore path
  (`startBoot` → `session.restore(mailbox)`), not through `session.open()`.
  The mailbox value held by the `expired` state is retained for this purpose
  when the stored record is cleared.
- Preserve the `restoreFailed` state exactly: the provider could not be asked,
  nothing is removed, nothing is replaced, and the screen's statement that what
  is saved on this device has not been changed remains true for that path.
- Keep expiry tied to the provider's own signal. No countdown, no expiry time
  derived from creation or a documented limit, no new polling interval, and no
  "lifetime" field introduced anywhere.
- Add focused tests for all three control behaviours, a falsification pass in
  which each new assertion is shown able to fail, full verification, independent
  review, spec sync and archive.

No behaviour change is claimed for the extension, the shared session, the
storage contract, the provider adapters, the cadence, the page composition, or
the design tokens.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `website-client`: two requirements carry the behaviour that is currently
  false. *"A reload returns the user to the address they came back for"* gains
  scenarios for clearing a provider-confirmed-dead record, persisting the
  replacement, and re-checking the same mailbox; its existing text and seven
  scenarios are carried forward byte-for-byte. *"The website never claims a
  mailbox lifetime it cannot know"* gains a scenario that a dead-record
  clearance follows the provider's report alone and introduces no lifetime,
  countdown or interval; its existing text and two scenarios are carried
  forward byte-for-byte.

No requirement in `mailbox-session`, `spectre-storage`, `provider-abstraction`
or any other capability changes: the session's `restore`, the storage layer's
`clearAll`/`saveMailbox`, and the provider's dead-session signal already exist
and already mean what this change needs.

## Impact

- **Code:** `apps/web/src/App.tsx`, `apps/web/src/useMailboxSession.ts`,
  `apps/web/src/StoredAddressGone.tsx`, and their unit/browser tests. No new
  package; no change to `packages/mailbox`, `packages/storage`,
  `packages/providers`, `packages/core` or `apps/extension`.
- **Specs:** one capability, two `MODIFIED` blocks; every pre-existing scenario
  in both blocks is carried forward unchanged, as this repository requires.
- **Unchanged:** `docs/PROVIDERS.md`, the archived changes, the five-region page
  composition, declared tokens, motion rules, and the `restoreFailed` control
  pair.
- **Explicit non-goals:** no fixed mailbox lifetime or expiry timing, no new
  provider, no new storage contract or operation, no SMTP/proxy, no live
  provider verification, no rewriting of earlier milestone history.
- **Evidence limits:** the measured defect is from the built source and the
  user's report; the temp-mail.org observation is a reading of its FAQ, API
  response and token, not a claim about any other provider or about how long a
  Guerrilla Mail session lasts.
