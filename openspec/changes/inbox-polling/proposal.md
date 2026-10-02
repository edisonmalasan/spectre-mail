# Proposal

## Why

A temporary mailbox is only worth having if mail actually arrives in it. Slice 1 of
M5 created an address and rendered it; nothing has ever watched that address for a
message, so the product cannot yet do the one thing it exists for. This slice adds
the inbox — a polled list of the current mailbox's messages, and a per-message
indication of which ones carry a verification code.

It is also the first slice that has to make a claim about **request pacing**, and
that claim cannot be derived from anything this repository has measured. That
limitation is the reason this proposal is as long as it is.

## What Changes

- **The session gains an inbox.** `packages/mailbox` polls the owning provider's
  `listMessages` for the current mailbox and reports the result as part of the
  session state, so both clients get it without either writing its own poller.
- **The cadence is adaptive, not fixed.** Poll promptly while something is
  arriving; back off toward a 30-second ceiling while the inbox is quiet; return to
  the prompt interval immediately on any change. The cadence is **a product choice
  and is labelled as one in code**, because no provider limit was measured for the
  provider the website can actually reach (see *Impact*).
- **A rate-limit header is obeyed, never parsed.** When a provider states a limit or
  a retry delay, the poller honours it verbatim and never schedules sooner. When it
  states nothing, the product's own floor applies.
- **Polling stops when nobody is looking.** A client tells the session whether the
  page is visible; a hidden page does not poll, because requests made for a screen
  nobody can see are cost with no possible benefit.
- **Each new message is fetched and analysed exactly once.** `MessageSummary`
  deliberately omits the body — "listing a mailbox must not require fetching
  bodies" — so a verification badge costs one body fetch per *new message*. The
  verdict is remembered against the message id, so later polls fetch only genuinely
  new messages and never re-analyse a known one.
- **A failed poll is not a failed mailbox.** The address keeps working and stays on
  screen; the inbox says it could not check, and says why if the provider did.
- **The poller takes its clock from the caller.** `packages/mailbox`'s missing `DOM`
  lib does **not** stop it from reaching a global timer — `@types/node` declares
  `setTimeout`, exactly as it declares `navigator`, and the verification pass
  measured this. An injected clock is what keeps the cadence verifiable without real
  time and keeps the package's globals-free claim honest.

## Capabilities

### New Capabilities

None. This slice adds requirements to two capabilities slice 1 established, and
introduces no new domain.

### Modified Capabilities

- `mailbox-session`: adds the inbox itself — what is polled, when it stops, how a
  rate-limit statement is honoured, that an analysis happens once per message, and
  that a poll failure is reported without destroying the mailbox. The existing
  "reaches no network directly" requirement is unchanged and is now load-bearing in
  a new way: the poller schedules work but performs no request itself.
- `website-client`: adds what the inbox looks like — the row, the empty state as
  distinct from "still checking", the verification badge, and the rule that a failed
  check must not remove the address from the screen.

## Impact

**Code.** `packages/mailbox` gains an inbox module, a cadence calculation, and a
poller; `packages/mailbox/src/state.ts` gains inbox state. `apps/web` gains an
inbox component and a visibility signal, and renders the new states. No provider
adapter changes: `MailProvider` already declares `listMessages` and `getMessage`,
and this slice widens no provider contract.

**Dependencies.** `packages/mailbox` adds `@spectre-mail/mail-parser` as a
workspace dependency. This is the parser's **first consumer** — it was delivered in
M4 with no client using it, and this is where that becomes real. The dependency is
one-way and stays pure: the parser remains a function of `Message.text` with no
network, no clock, and no AI, and `tests/architecture/boundaries.test.ts` already
asserts it never reaches the global `fetch`.

**The evidence gap, stated plainly.** `docs/PROVIDERS.md` records Mail.tm's
`GET /messages` at `30; w=60` **measured unauthenticated only** — the authenticated
policy was never separately measured — and Mail.tm is unreachable from a web page
in any case, so that number does not govern this client. Guerrilla Mail publishes no
limit and none was measured. **There is therefore no measured safe polling rate for
the provider this website uses, and this change does not pretend otherwise.** The
cadence is chosen, labelled as a product decision, and designed to be revised the
moment a limit is actually observed — which is why the poller reacts to a
rate-limit statement instead of assuming one.

**Not in scope.** Opening a message and showing its safe text, codes, and links
(slice 3); mailbox history; the provider selector; theme; clear-data; any storage
(M6); any visual design (M7). Styling stays absent by decision, and this slice's
markup must not make M7's job harder than it already is.