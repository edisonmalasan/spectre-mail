# Proposal

## Why

SpectreMail exists to hand a user one thing inside a minute: the code or the link
they were sent to a throwaway address. Right now a message arrives as untrusted text
and nothing reads it. `Message` already carries `verificationCodes` and
`verificationLinks` and nothing produces them, so the product's central value is
modeled but unimplemented.

This is also the first milestone that can be completed **without contacting a
provider**, which matters: every M3 test replays a recording, and the recordings
cannot tell us whether a detector works on mail nobody has sent us yet.

## What Changes

- `packages/mail-parser` gains real behaviour: it becomes the boundary that turns
  untrusted message content into readable text, and detects one-time codes and
  verification links in it.
- The safe-text path strips markup, decodes HTML entities, drops script and style
  content, and recovers each link's destination together with its anchor text. It
  **never emits markup** for a client to render, so there is no field to misuse.
- Detection is **deterministic**. No AI, no network, no heuristics that depend on
  the current time or on a provider's response.
- Every candidate carries a confidence in `0..1` and candidates are returned
  **ranked**, with all of them surfaced rather than a single "best" guess. A
  detector that picks one and hides the rest forces the client to guess.
- Links whose scheme is not `http`/`https` are **rejected outright**. A
  `javascript:` or `data:` destination in a message body is an attack, and surfacing
  it next to a "open link" affordance invites it.
- A fixture suite of twelve realistic message shapes, including the misleading ones:
  an order confirmation full of numbers that are not codes, and a newsletter with
  none.
- `@spectre-mail/core` is **not modified.** `VerificationCode` and
  `VerificationLink` already exist and already carry the right fields; the parser
  consumes them rather than widening them.

### Non-goals for this milestone

- **No UI, no client, no notification.** Copy, fill, and open are M10's workflow and
  need a user present. A detector that nothing displays is still worth building, and
  claiming otherwise would ship a feature no one can reach.
- **No message classification beyond what the detections need.** The roadmap lists
  "message classification helpers" in the package description; nothing in M4's scope
  consumes one.
- **No storage.** M4 is a pure function of its input.

## Capabilities

### New Capabilities
- `mail-parsing`: turning untrusted message content into readable text, and
  detecting one-time codes and verification links in it with honest, bounded
  confidence.

### Modified Capabilities

None. `shared-domain-model` already specifies the model this change produces values
for, and `provider-abstraction` already forbids trusting a declared content type.
Both are satisfied by implementing against them, not by changing them.

## Impact

- **Code:** `packages/mail-parser/src/` goes from an empty module to the parsing
  package. Its `package.json` gains a dependency on `@spectre-mail/core` and on
  **no third-party parsing library** (see design.md D1).
- **Specs:** one new capability, `mail-parsing`.
- **Dependencies:** none added. A workspace link only.
- **Consumers:** none yet. `packages/providers` hands this package a message body in
  due course; nothing wires it up in this milestone, so no user-visible behaviour
  changes and no client is modified.
- **Tests:** `pnpm test` grows by a fixture suite and unit tests for each stage. Every
  one runs offline; **no test contacts a provider**.
- **Correction to an existing comment:** `packages/mail-parser/src/index.ts` states
  "OTP and verification-link detection are M10". That is wrong — the roadmap schedules
  detection in **M4** and M10 for the workflow that consumes it. This change corrects
  the comment rather than leaving two sources of truth disagreeing.