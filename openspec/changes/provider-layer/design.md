# Design

## Context

`packages/core` defines the vocabulary and is consumed as TypeScript source. It
has no behaviour, deliberately. `packages/providers` is a placeholder whose only
content is a doc comment stating that it will hold the adapters and that no file
outside it may reference one — enforced by `tests/architecture/boundaries.test.ts`.

Everything below follows from measurements recorded in `docs/PROVIDERS.md`. Where
this design repeats a number, it is citing that document, not reasoning from
intuition. `provider-abstraction` states the behaviours this layer must inherit;
it is not restated here.

The two providers are not variations on a theme. Mail.tm is an API Platform /
Hydra service with bearer JWT auth and a one-per-minute account budget.
Guerrilla Mail is a parameter-dispatched AJAX endpoint with a session token in a
query string, no usable cookie, and a captcha gate on sending.

## Goals / Non-Goals

**Goals:**

- One contract, implemented twice, with every provider-specific concern
  contained in its adapter.
- A conformance suite both adapters pass, defined once and run from recorded
  responses.
- Failure conditions translated into the closed normalized error vocabulary, with
  the provider's own description preserved when nothing fits.

**Non-Goals:**

- **Parsing.** Adapters place a raw, untrusted body into `Message.text` and stop.
  Stripping markup, extracting URLs, and detecting OTP codes are M4.
- **Persistence.** Nothing is written to storage. M5–M6 own that.
- **Polling cadence.** Adapters report the provider's rate-limit signal; the loop
  that consumes it belongs to the client, which is the only layer that knows
  whether a tab is visible.
- **Outbound mail.** Guerrilla's send path is captcha-gated and untested for
  product use, so neither adapter exposes it.
- **Any client wiring.** No `apps/` file changes.

## Decisions

### D1. The contract has no subscription method, at all

The roadmap's contract target includes `subscribe?(mailbox, listener)`. Measured
reality: five SSE paths and two WebSocket paths, none of which connected.
`GET /messages/events` answers `406` for `text/event-stream` and `404` for every
format the negotiator accepts, while Mail.tm's marketing copy claims SSE.

**Decision:** omit the method rather than declare it optional and leave it
unimplemented.

An optional method is still a method. A caller that checks for it and finds it
absent still has to handle absence, so the optional form buys a type-level
permission to write code that has never run against a real provider. Removing it
forces the polling shape, which is the only shape that works.

**Alternative considered:** keeping `subscribe?` for a future provider that does
offer push. Rejected: no such provider is known, and YAGNI on a method that would
carry a callback contract is expensive to add later.

### D2. Adapters are constructed with an injected transport

`fetch` is the only thing both a web page and an MV3 extension service worker
have, and neither environment allows a test to intercept it. So the transport is
a constructor-injected dependency: production passes `fetch`, the conformance
suite passes a recorder that replays recorded responses.

**Decision:** no module-level `fetch` call anywhere in the package. Every request
goes through the injected transport.

This is what makes the conformance suite possible at all. Without it, verifying
an adapter means calling a third party, and the suite fails whenever the provider
is down, rate-limiting, or has changed a field name — turning a third party's
availability into this repository's CI status.

**Alternative considered:** `msw` or a fetch shim library. Rejected: a dependency
buys mocking that a 30-line recorder already provides, and the recorder can assert
on what was actually requested, which mocking libraries largely do not.

### D3. Credentials are generated client-side, never requested

Mail.tm requires a local-part and password that the caller chooses, with the
domain discovered from `GET /domains`. Guerrilla returns an address outright and
allows renaming the local part.

**Decision:** address and password generation happen inside the adapter, using an
injected source of randomness, and the credentials are returned as
`ProviderCredentials`.

Generation belongs in the adapter because it is provider-specific: Mail.tm needs
a password that will later be exchanged for a token, and Guerrilla needs no
password at all. Putting it in shared code would mean a shared function with
branches on provider, which is wire format leaking upward.

**Rejected alternative:** have the caller generate credentials and pass them in.
That leaks Mail.tm's password requirement into every caller.

**Note on the domain:** Mail.tm's `GET /domains` is rate-limited `30; w=60`
unauthenticated. A domain must therefore be fetched once per mailbox creation
budget rather than once per operation, or the first two requests consume the
window and the creation that follows is throttled for a reason that has nothing to
do with the advertised `1; w=60`.

### D4. The dead-session check is provider-specific and mandatory

Guerrilla answers an unrecognised session with `HTTP 200`, no auth error, and an
empty list. A mailbox that once had mail is indistinguishable from an empty one.

**Decision:** each adapter exposes an explicit liveness assertion, and
`listMessages` SHALL NOT return an empty list without it having passed. For
Guerrilla the assertion compares the address the provider reports for the session
against the mailbox's own address; a mismatch or absence means the session is
dead.

**Alternative considered:** treat an empty list as authoritative and detect the
problem when a real message fails to arrive. Rejected: that is the data-loss
trap. The user sees "no mail" for an address that has mail, and the symptom
appears days later when they are waiting for a code that already arrived and was
dropped.

**Honest limit:** this check is only as good as what the provider still reports
about a dead session. It is a best-effort detection of a known trap, not a proof
of liveness.

### D5. Mail.tm deletion uses the hydrated `@id`, never a built path

Mail.tm's Hydra responses return resource URLs as a **relative** `@id`. Deletion
must follow that `@id`. Constructing `DELETE /accounts/{id}` by hand is the
natural move and is wrong.

**Decision:** the adapter resolves the mailbox's `@id` from the create or `GET
/me` response and deletes against it.

Recorded because this is the kind of detail that looks correct, passes a
hand-written test, and fails against the live API only on the delete path.

### D6. Rate-limit headers are captured, never interpreted

`ratelimit-policy: 1; w=60` is captured verbatim onto a `RATE_LIMITED` error. The
adapter does not parse it into seconds, does not schedule a retry, and does not
assume the scope.

**Decision:** the header travels as a string. Anything that needs a deadline
parses it, and a client that cannot parse it still has the evidence.

The scope is genuinely unknown: the header states a limit and a window and
nothing about what it is per. "Per IP" is an inference from how such headers
usually work, and inferring it would put a fabricated fact into the product.

### D7. The conformance suite is defined once and takes an adapter factory

Every adapter must satisfy the same behavioural expectations, so the suite is a
single exported function taking an adapter factory. It runs each adapter against
recorded responses and asserts on the **normalized** result only — never on the
adapter's internals, which differ by design.

**Decision:** one suite, no per-provider exemptions. Adding an exemption is the
mechanism by which a conformance suite quietly stops meaning anything, so it is
not offered.

**Alternative considered:** the spike's harness. Rejected: it lives outside the
workspace, is hand-rolled, and probes *providers*; this suite probes *adapters*
against recordings. Different job.

### D8. The provider manager selects only at creation, and reports honestly

Failover is Mail.tm → Guerrilla, and it applies only when creating a mailbox. An
existing mailbox keeps its provider for life.

**Decision:** the manager takes an ordered list of available providers and is
consulted only by mailbox creation. It returns the created mailbox, whose
`provider` field already identifies which provider served it — because M2 derives
that field from the credential discriminant, the honest report is structurally
guaranteed rather than a flag someone must remember to set.

A caller cannot silently present a fallback as the primary: it does not know
which provider was asked except by asking the mailbox, and the mailbox knows.

**The website has one provider and therefore no redundancy.** That is a recorded
limitation, not a degraded mode, and the manager must not pretend otherwise by
retrying against a provider the website cannot reach.

### D9. `deleteMessage` and `destroyMailbox` are optional, and absence is typed

The roadmap marks both optional. Mail.tm supports mailbox deletion (observed
`204`, then `401`); Guerrilla's observed surface has no equivalent.

**Decision:** both remain optional on the contract, and the *absence* is
discoverable rather than merely absent — a caller can ask whether an adapter
supports an operation without invoking it and handling a thrown error.

**Reason:** an optional method whose absence surfaces only as `undefined` is a
runtime trap at every call site. Making support explicit turns it into a
compile-time question.

**Honest gap:** `check_email` does not expose a deletion operation, but "not
observed" is not "does not exist". Guerrilla's mailbox deletion is recorded as
**unverified** rather than unsupported.

### D10. Errors carry the provider, and unknown stays unknown

Every adapter failure becomes a `SpectreError` — the closed union from M2. M2
already repaired `isSpectreError` to reject an unknown provider, so an adapter
cannot smuggle in a provider the model does not define.

**Decision:** unclassifiable failures map to the unclassified code with the
provider's own description preserved. Dropping the description because it does
not fit the vocabulary loses the only diagnostic the provider offered.

### D11. Domain model is consumed, never widened

M2's model already has a field for everything measured. Where an adapter notices
a gap, the change is recorded rather than patched locally: no provider wire field
name enters `packages/core`, and no field is added for a value no measurement
produced.

## Risks / Trade-offs

**A provider changes a response shape and the recorded fixtures keep the tests
green** → The fixtures are committed recordings, so drift is invisible until
someone refreshes them. Mitigation: fixture refresh is a deliberate diff, and live
provider checks remain a separate, opt-in concern that never gates CI. This is a
real weakness and it is the price of deterministic CI.

**Mail.tm's `1; w=60` makes the extension's experience poor** → Unavoidable;
measured. Mitigation: the adapter surfaces the throttle immediately rather than
retrying, so the client can reuse the current mailbox. The product decision about
that UX is later than this change and is deliberately not made here.

**Mail.tm cannot be reached from a web page at all** → Already decided: the
website uses Guerrilla only and no proxy is built. The Mail.tm adapter is still
built and tested, because availability is a client concern.

**The dead-session check may not catch every form of death** → It is best-effort
against one measured trap. Mitigation: it is isolated in the adapter, so a better
signal can replace it without touching the contract.

**Conformance tests can pass while an adapter is still wrong in production** →
They assert on recorded behaviour only; nothing here proves a live call works.
Mitigation: recorded responses come from real measured runs, and the live
host-permission check stays an explicitly deferred item with no result claimed.

**Third-party terms remain unverified for both providers** → No architectural
decision here rests on any provider's terms. Where a term could not be located,
none is cited and none is assumed absent.

## Migration Plan

None. Nothing has shipped. There is no prior behaviour to preserve, no stored
data to migrate, and no deployed client. The rollback for this change is deleting
the branch.

## Open Questions

- **What is a Guerrilla mailbox's real lifetime?** Unverified, and no probe held a
  session open long enough to find out. It does not change the specs: expiry is
  driven by an observed signal, which is true whatever the lifetime turns out to
  be.
- **Does Guerrilla support mailbox deletion at all?** Not observed. Recorded as
  unverified; the contract already accommodates absence, so the answer changes an
  adapter's shape but not the approach.
- **Is `1; w=60` per IP or per account?** The header does not say. Affects only
  what a client tells the user, not the adapter.
