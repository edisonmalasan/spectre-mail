# Proposal

## Why

M2 gave SpectreMail a vocabulary but nothing that can produce one. There is no way
to create a mailbox, read a message, or observe a failure, because the first
component that has ever seen a provider response has not been built. Everything
downstream — parsing, storage, the clients — is blocked on this and would
otherwise be written against an imagined API.

It must happen now, while the measured provider behaviour is still the input to
the design rather than a thing the code already assumes.

## What Changes

- **Declare the `MailProvider` contract** and implement it twice: a Mail.tm
  adapter and a Guerrilla Mail adapter, both in `@spectre-mail/providers`.
- **Map every provider failure onto the closed normalized error vocabulary.** A
  provider's own status codes and error bodies stop at the adapter boundary.
- **Add a shared, provider-agnostic contract test suite** that both adapters must
  pass, driven by recorded fixtures rather than live calls so it can run in CI.
- **Add a provider manager** implementing the extension's Mail.tm-primary /
  Guerrilla-fallback order, with fallback applying only to mailbox creation.

### BREAKING: the contract drops `subscribe?`

The roadmap's contract target includes `subscribe?(mailbox, listener)`. M0
measured **no push transport on either provider**: five SSE candidate paths and
two WebSocket candidates all failed, and Mail.tm's `GET /messages/events` answers
`406` for `Accept: text/event-stream` and `404` for every format it does accept —
while the provider's own marketing copy claims SSE is available.

A contract method that no adapter can honestly implement is a promise the type
system makes and the runtime breaks. The method is removed rather than shipped
optional and unimplemented.

### BREAKING: mailbox creation is not instantaneous on Mail.tm

`POST /accounts` is advertised as `ratelimit-policy: 1; w=60`. The roadmap's
target of "a usable email in a few seconds" on a second click is not achievable.
Creation either reuses the current mailbox or surfaces a throttled state carrying
the provider's verbatim header — which is what `RATE_LIMITED` exists for.

Note the header does not state its scope, so "per IP" remains an **inference** and
is not treated as established.

## Capabilities

### New Capabilities

- `provider-adapters`: the `MailProvider` contract, the two adapters, failure
  mapping, the shared contract test suite, and the provider manager's failover.

### Modified Capabilities

None. `provider-abstraction` already specifies the behaviour this change
implements — the per-client provider roles, the no-proxy rule, untrusted content
types, adaptive polling, surfaced throttling, and unassumed mailbox lifetime. M3
is measured against it, not a revision of it.

## Impact

**Code.** `packages/providers` gains the contract, two adapters, a provider
manager, and tests. `packages/core` is consumed, not modified — its model was
built to receive exactly these responses.

**Client reachability is uneven and stays that way.** Mail.tm grants no CORS
header to a third-party origin, and SpectreMail does not proxy. So the website
uses Guerrilla Mail only and has **no** fallback path until a second
web-reachable provider exists; the extension uses both. Both adapters are built
regardless, because availability is a client concern.

**One data-loss trap is in scope and must be handled.** An unrecognised Guerrilla
session is not rejected: it returns `HTTP 200` with an empty inbox and no auth
error. A stored-but-dead session is therefore indistinguishable from a genuinely
empty mailbox, and an adapter that trusts the response shows "no mail" for an
address that once had mail.

**Explicitly out of scope.** Mail parsing and OTP/link extraction (M4), storage
and persistence (M5–M6), any UI wiring (M7), and the extension manifest and
build (M8). Adapters deliver raw untrusted text into `Message.text`; extracting
safety from it is M4's job, not this change's.

**Unchanged and still unproven.** Whether a declared content type can be trusted
is settled — it cannot. Whether delivery is reliable is **not** established: real
delivery was observed from one sender only, on one run.
