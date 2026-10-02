# Proposal

## Why

SpectreMail's product logic has no vocabulary yet. Every planned consumer - both
clients, both provider adapters, the storage layer, the parser - needs to agree on
what a mailbox, a message, a credential, and a failure *are*. M1 deliberately
shipped containers and tooling with no behaviour, so `packages/core` is an empty
placeholder.

Defining that vocabulary now, before the provider layer exists, is the only moment
it is cheap. Once `MailTmProvider` and `GuerrillaMailProvider` are written against
an undefined model, the union of their two wire formats silently becomes the
model, and the normalization the project is named for never happens.

Three measured behaviours make this urgent rather than tidy-up:

- A real Guerrilla message arrived with an **empty subject** while its sender and
  body were present. A model that treats emptiness as a missing field would
  discard a message that genuinely arrived.
- No provider exposes a mailbox lifetime in any API response. Mail.tm publishes a
  7-day retention and says a mailbox lasts until deleted, but neither value is
  discoverable programmatically and neither was measured live. A model with an
  `expiresAt` field invites exactly the fabricated countdown
  `provider-abstraction` forbids.
- The two providers' session models differ in kind: Mail.tm issues an account plus
  a bearer token, while Guerrilla issues a session id that **must** be the one
  returned in the response body rather than the `PHPSESSID` cookie, because the
  provider sends `Access-Control-Allow-Origin: *` with no
  `Access-Control-Allow-Credentials`. Credentials are therefore not
  interchangeable, and mixing them must be impossible rather than unlikely.

## What Changes

- Introduce the `shared-domain-model` capability: SpectreMail's own normalized
  types, owned by `packages/core`.
- Define the normalized `ProviderId`, `MailboxStatus`, `Mailbox`,
  `MessageSummary`, `Message`, `VerificationCode`, and `VerificationLink` types
  as the roadmap specifies them.
- Define `ProviderCredentials` as a **discriminated** union so Mail.tm
  credentials and Guerrilla credentials can never be confused, with field names
  normalized so no provider wire name appears in the shared model.
- Close the hole in the roadmap's `Mailbox` shape, where `provider` and
  `credentials` are both present but nothing guarantees they agree.
- Define the eight normalized error codes and a typed error carrying its
  normalized code, the provider, and the underlying cause.
- Specify that an optional `expiresAt` may only ever be populated from an
  observed signal, never from elapsed time or provider documentation.
- Specify that required message fields may be empty strings, because emptiness is
  a measured real condition and not corruption.
- Keep `VerificationCode.confidence` and `VerificationLink.confidence` as plain
  numbers with a specified `0..1` range, validated where they are produced rather
  than branded in the type.

No breaking changes. `packages/core` currently exports nothing, so nothing
consumes these types yet.

**Out of scope for M2.** No provider adapter (`MailProvider` is M3). No OTP or
verification-link detection (`packages/mail-parser` owns that, and populating
these fields is a later milestone). No storage. No React. No mailbox lifecycle
logic, expiry computation, or error *mapping* from HTTP responses - M2 defines the
vocabulary and its invariants; M3 populates it from real providers.

## Capabilities

### New Capabilities
- `shared-domain-model`: SpectreMail's normalized domain types - mailbox,
  message, credential, verification code, verification link - plus the normalized
  error vocabulary, and the invariants that keep provider wire format and
  unmeasured lifetime assumptions out of them.

### Modified Capabilities

None. `provider-abstraction` already specifies the behaviours this model must
honour (untrusted content, observed-only expiry, surfaced throttling). M2
implements those requirements in types; it does not change what they require. If
implementing the types turns out to need a different requirement, the change is
amended rather than the spec quietly reinterpreted.

## Impact

- **New code**: `packages/core/src/` gains the domain type modules and their
  public exports. This is the package's first real content; the M1 placeholder
  note is replaced.
- **New spec**: `openspec/specs/shared-domain-model/spec.md` at sync.
- **Tests**: real unit tests for the type invariants that are observable at
  runtime - credential/provider agreement, empty-field preservation, error
  construction. This requires widening the Vitest `include` glob so it covers
  package tests. **The `pnpm` workspace globs must not change**: adding `tests/`
  to the workspace is forbidden, because that is what keeps the M0 spike
  structurally unimportable.
- **No dependency changes.** The model is plain TypeScript with no runtime
  dependency, which is what lets it be consumed as source by every consumer.
- **No provider calls.** Nothing in this change contacts a provider, so no gate
  here depends on provider availability.