# Proposal

## Why

The website throws away a working address on every reload. M6 slice 1 built the
storage contract and the IndexedDB adapter that can keep it, and **nothing reads
them** — so the roadmap's `return to a recent mailbox` acceptance line is still
undelivered, and `docs/ROADMAP.md` records that a reload discards the mailbox as
the product's current behaviour.

The reason slice 1 deliberately stopped at the seam is that the hard part is not
persisting a mailbox; it is deciding **when a stored mailbox may be presented as
the user's again**. A stored mailbox is untrusted input that may name a session the
provider has since dropped, and the one measured trap in this repository
(`docs/PROVIDERS.md` §3) is that a dead Guerrilla session answers `HTTP 200` with
an empty inbox and no error. So "the inbox is empty" cannot mean "this mailbox is
still good", and getting that wrong does not merely look wrong: it makes the
product create a second mailbox and silently overwrite the address the user came
back for, with no error anywhere.

## What Changes

- **`packages/mailbox` gains an explicit adoption path.** `MailboxSession` gains a
  single operation that takes a persisted `Mailbox` **value** — never a storage
  handle — reconciles it through the provider that owns it, and reports what
  happened. The session still holds no storage, and the storage boundary's
  architecture rules are unchanged.
- **`SessionState` gains the states adoption makes necessary.** Looking for a saved
  address, reconciling one, a stored mailbox the provider has dropped, and a
  reconciliation that could not be completed are four conditions the page cannot
  currently express, and each gets its own variant rather than being folded into
  `creating` or `failed` with copy that would be false.
- **An adopted mailbox is reconciled by a real provider request, before it is
  presented.** An empty inbox is never the evidence. The existing dead-session
  detection in the Guerrilla Mail adapter is reused rather than duplicated.
- **The website wires the loop.** It builds the storage adapter, asks it for a
  stored mailbox on load, adopts one if there is one, creates one if there is not,
  and persists every mailbox the session reports as ready — including one arrived
  at by replacing.
- **`packages/storage` gains a browser-facing factory** that reads the platform's
  IndexedDB *inside the storage layer*, so the client never names a platform
  storage API. This keeps `spectre-storage`'s existing boundary requirement
  satisfiable as written rather than weakening it.
- **BREAKING, in the sense that a promoted scenario becomes false:**
  `mailbox-session`'s *A reload loses the session* is modified. It stays true of a
  session that is given nothing, and stops being true of a session handed a stored
  mailbox. `website-client`'s *On load the website SHALL create a mailbox* is
  modified the same way.

## Capabilities

### New Capabilities

None. `spectre-storage` already exists and this change amends it rather than
introducing a near-duplicate name for the same responsibility.

### Modified Capabilities

- `mailbox-session`: the reload scenario is qualified — a session recovers a mailbox
  only when a client hands it one as a value. Two requirements are added: that a
  stored mailbox is **adopted and never inferred**, and that it is **reconciled
  with its owning provider before it is presented**, with a stored mailbox the
  provider has dropped distinguishable from one that merely could not be checked.
- `website-client`: *The website creates a mailbox without asking* is modified —
  on load it looks first, and creates only when nothing is stored. The
  state-coverage scenario of *This milestone builds structure, not visual design*
  is modified to name the new states. A requirement is added for returning a user
  to the address they came back for, including what the page says when that
  address is gone and when it could not be checked.
- `spectre-storage`: a requirement is added so the platform storage API is named
  only inside this layer, and the browser-facing factory's behaviour where
  IndexedDB is absent is specified rather than left to a client to discover.

## Impact

- **Code.** `packages/mailbox/src/session.ts` and `state.ts` (the operation and the
  new variants); `packages/storage/src/` (one new module, exported from `index.ts`);
  `apps/web/src/useMailboxSession.ts`, `App.tsx`, and one new module for the
  client's storage composition.
- **Dependencies.** None added. `apps/web` gains `@spectre-mail/storage`, which it
  did not depend on before.
- **Architecture rules.** None added or widened. The storage rules this slice
  leans on — no platform storage API outside the storage layer, no shared package
  importing it — are the ones slice 1 proved falsifiable, and this change is the
  first real test of them from the client side.
- **Not in this change.** The privacy controls that delete stored data, including
  M5's `clear local SpectreMail data` acceptance line, and the extension's storage
  adapter. Both are separate M6 slices. Copying a one-time code is M10 and is
  untouched.