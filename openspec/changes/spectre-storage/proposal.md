# Proposal

## Why

M6's Storage block lists five record kinds to put behind IndexedDB, and nothing in
this repository can hold any of them: `packages/storage` is an M1 placeholder
whose `src/index.ts` exports nothing, and its own docblock records why the
contract is worth specifying carefully rather than defaulting — "an expired
Guerrilla session is reported as an empty inbox with no auth error, so 'no
messages' and 'session gone' are indistinguishable at the storage layer."

M6 also requires something the promoted specs currently forbid. Recovering a
mailbox across a reload is the point of persisting one, and
`mailbox-session`'s scenario **A reload loses the session** states that the
session "SHALL NOT claim to have recovered that mailbox" after a reload. That
scenario was correct for M5, where the session was storage-free and recovery was
therefore impossible; M6 makes it false, and it has to change through the
OpenSpec lifecycle rather than be worked around in application code.

This change builds the persistence layer as its own capability and **amends no
existing requirement**, because no behaviour change is delivered here: the layer
lands with its own tests and no client. That mirrors M4, where
`packages/mail-parser` was completed and verified with "**No client consumes it
yet**". The `mailbox-session` amendment is named, scoped, and deferred to the
slice that implements recovery, so the repository never carries a promoted
requirement describing behaviour that does not exist.

## What Changes

- **`@spectre-mail/storage` gains real behaviour.** A `SpectreStorage` contract
  with two operations — load the current mailbox, save it — and one
  implementation over IndexedDB. The contract is narrow on purpose: it names only
  what this milestone stores, and grows as later M6 slices add `preferences`, a
  message-metadata cache, and provider health.

- **Everything read back from storage is narrowed, not trusted.** A stored record
  is `unknown` the moment it leaves IndexedDB, and `packages/core` already
  exports `isMailbox` for exactly this boundary — its documentation says so, and
  cites "a record parsed out of storage" as the case the type system cannot
  cover. A record that does not narrow is **neither surfaced as a mailbox nor
  deleted**, because a validator that is stricter than intended would otherwise
  destroy a working mailbox on the strength of a code bug.

- **A read that fails is thrown, never reported as "nothing stored".** This is
  the storage-layer twin of the measured Guerrilla trap, and it is the failure
  that matters most here: a read reported as "nothing stored" makes the client
  create a new mailbox and silently discard the user's identity, which is the one
  outcome this milestone must not produce. The contract therefore makes `null`
  mean exactly one thing.

- **A save resolves only after its transaction has completed.** An IndexedDB
  write that resolves on the request's success rather than the transaction's
  completion can be reported as saved before it is durable, which is a false
  confirmation to a user who then closes the tab.

- **Two boundary rules are added.** No shared package but `packages/storage` may
  name a platform storage API, and `@spectre-mail/storage` may be reached only by
  a client. The first extends the reasoning the existing mailbox rule already
  records — that `tsconfig` withholds the DOM lib but `@types/node` lets
  `localStorage`, `sessionStorage`, and `navigator` compile, so "no storage"
  rests entirely on an explicit rule — from one package to all of them.

- **`docs/ROADMAP.md` records M6's slice breakdown** so every responsibility M5
  and M6 both mention is assigned once. The overlap is already named in the
  roadmap's M5 acceptance table; what was missing is which slice of M6 delivers
  each line, and that the privacy controls (`Forget mailbox`, `Clear mailbox
  history`, `Clear all local SpectreMail data`) are one later slice, not part of
  this one.

## Capabilities

### New Capabilities

- `spectre-storage`: the `SpectreStorage` contract every client persists through,
  the rules a stored record must satisfy before it is handed back as a mailbox,
  and the platform adapter that implements the contract over IndexedDB.

### Modified Capabilities

None, deliberately. `mailbox-session` **is** affected — its scenario *A reload
loses the session* forbids the recovery M6 requires — and the amendment belongs
to the slice that delivers recovery. Promoting a requirement change here would
leave `openspec/specs/` describing an adopt path that does not exist, which is
the same defect `provider-adapters` records at its sync stage in the opposite
direction. `design.md` records the conflict, the recommended replacement, and the
slice that owns it.

`provider-adapters` is **not** modified either. Its requirement *The provider
layer does not persist anything* and its scenario *Credentials are stored* already
cover this layer's obligations, and this change satisfies both; they are cited
rather than restated.

## Impact

**Code.** `packages/storage/src/index.ts` stops being a placeholder: a contract
module, a record-narrowing module, and an IndexedDB adapter. Its `package.json`
gains `@spectre-mail/core` as a workspace dependency. Nothing else in the
workspace changes behaviour, because nothing consumes the package yet.

**Dependencies.** One dev-only dependency, `fake-indexeddb`, so the IndexedDB
adapter is exercised against real IndexedDB semantics rather than a hand-rolled
fake. The alternative — a hand-written fake implementing the handful of
`IDBFactory` members the adapter calls — is a fake that is narrower than the API
by construction, which is this repository's most persistent defect class.

**Specs.** One new capability, `spectre-storage`. No delta against any promoted
spec.

**Docs.** `docs/ROADMAP.md` gains M6's slice breakdown and a Project Status note.
`AGENTS.md`, `README.md`, and `docs/ARCHITECTURE.md` record the package's new
behaviour and the two new boundary rules. `packages/storage/src/index.ts`'s
docblock is replaced, since its M1 note stops being true the moment the file has
exports.

**Not touched, deliberately.** No client wiring, no adoption path, no
`mailbox-session` amendment, no privacy controls, no error-state copy, no styling
(M7), no extension work (M8), and no OTP copy or fill (M10).

**What this does not establish.** No live browser run of the website has ever
been made, and none is made here. `fake-indexeddb` reproduces IndexedDB
semantics; it is not a browser, and a pass against it is not evidence that a real
browser stores or retrieves anything. No test contacts a provider. `pnpm build`
still builds the website only, and says nothing about this package.
