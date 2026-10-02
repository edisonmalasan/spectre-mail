# Design

## Context

`packages/core` exists as a documented placeholder created by M1. It exports
nothing, deliberately: M1 shipped containers and tooling only, and a stub that
throws would have been dead code the owning milestone had to delete.

Three live constraints shape this design, and all three come from measurement
rather than from the roadmap text:

1. **The roadmap's `Mailbox` shape has a hole.** As written it carries both
   `provider: ProviderId` and `credentials: ProviderCredentials`, with nothing
   correlating them. M3's `MailProvider` contract is already fixed in the roadmap
   and reads credentials off the mailbox (`listMessages(mailbox)`), so a mismatch
   is not hypothetical - it is a silent wrong-provider authentication attempt.
2. **`exactOptionalPropertyTypes` is on** in `tsconfig.base.json`. Under it,
   `expiresAt?: number` cannot be satisfied by writing `{ expiresAt: undefined }`.
   That is a gift for the expiry rule and should be leaned into rather than
   worked around.
3. **No provider reports a mailbox lifetime.** So `expiresAt` is a field that, in
   practice, is almost always absent. A field that is nearly always absent needs a
   stronger justification than a field that is usually populated.

The M1 verification pass also established the standard this milestone inherits: a
check narrower than the rule it documents is a failure, not a passing check. Every
invariant below is therefore paired with a task that proves it can fail.

## Goals / Non-Goals

**Goals:**

- Define the normalized vocabulary in `packages/core` with no provider wire format
  in it.
- Make the provider/credentials mismatch **unrepresentable** through the normal
  construction path, without changing M3's already-fixed `MailProvider` contract.
- Make `expiresAt` structurally hard to fabricate.
- Give every failure a normalized code that carries provider and cause.
- Verify the invariants that are observable at runtime, not just at type-check
  time.

**Non-Goals:**

- No `MailProvider` contract, no adapter, no HTTP. That is M3.
- No OTP or verification-link detection. `packages/mail-parser` owns detection;
  M2 defines the shape it will populate.
- No mailbox lifecycle, expiry computation, or error mapping from HTTP responses.
  M2 defines the vocabulary; M3 populates it from real providers.
- No storage, no React, no visual design.
- No AI or heuristic detection. Core principle 5 requires detection to be
  deterministic, so nothing in the model may imply otherwise.

## Decisions

### D1. `Mailbox` stays monomorphic; agreement is enforced at construction

**Decision.** Keep `Mailbox` exactly as the roadmap specifies - non-generic, with
a `provider: ProviderId` field. Close the mismatch hole with a single construction
entry point that derives `provider` from the credential discriminant, plus a
compile-time assertion type proving the two agree.

**Alternatives considered.**

- *Make `Mailbox` generic over its credential type* (`Mailbox<C extends
  ProviderCredentials>`). This is the strongest possible correlation and I
  rejected it because it infects every downstream signature. M3's `MailProvider`
  is already written in the roadmap as `listMessages(mailbox: Mailbox)`; a generic
  forces a type parameter through the provider contract, through storage, and
  through every React prop. It buys correlation we can get once, cheaply, at
  construction, at the cost of making the whole product generic for it.
- *Delete `provider` and derive it from credentials*. Cleaner single source of
  truth, and I rejected it because the roadmap specifies the field, and a stored
  mailbox record that does not name its own provider is harder to debug and
  harder to route correctly when a client may only reach some providers.

The residual risk of this choice is that a caller can still hand-construct a
literal `{ provider: "guerrilla", credentials: mailTmCreds }` and bypass the
constructor. TypeScript cannot prevent object literals. That is acceptable and is
why the agreement assertion is exported as a reusable type rather than a private
detail: any code that builds a mailbox by hand can be checked against it.

**Revised during implementation.** The assertion was first written as a
non-generic alias, `MailboxProviderAgreement`, applied to `Mailbox` itself. It
rejected a mismatched literal as intended - and also rejected every well-formed
mailbox, resolving to `never`. That is structural, not a typo: a non-generic
`Mailbox` stores its credentials as the whole `ProviderCredentials` union, and a
union never `extends` a single provider literal. The first falsification run
looked green because the mismatched literal *was* rejected, for the wrong reason.

The shipped form is `AssertProviderAgreement<T>`, generic over the candidate and
using tuple-wrapped conditionals so distribution is suppressed. It narrows a literal
to itself and resolves `Mailbox` to `Mailbox`. The negative proof was re-run
with a positive control added, because four negative cases cannot tell a strict
assertion from a useless one. The decision to keep `Mailbox` monomorphic stands;
only the enforcement mechanism changed.

### D2. Credentials are discriminated, and their fields are normalized

**Decision.**

```ts
type ProviderCredentials =
  | { provider: "mailtm"; accountId: string; accessToken: string }
  | { provider: "guerrilla"; sessionId: string };
```

Field names are SpectreMail's own. The discriminant is a provider identity, which
is a legitimate domain concept, not wire format.

**Alternatives considered.**

- *Wire names verbatim* (`token`, `sid_token`). This makes each adapter a
  field-copy instead of a translation, which is genuinely tempting. Rejected: it
  puts a measured provider field name inside a shared package and defeats the
  purpose of the milestone. `sid_token` would become core's vocabulary, and then
  every future provider's vocabulary too.
- *An opaque credential handle* (`credentials: string`) that core never inspects.
  Maximum isolation, and rejected because the roadmap explicitly requires a
  discriminated type, and because core will eventually need to reason about
  whether a credential is still usable.

The Guerrilla variant deliberately stores the **body-returned** session id, never
the `PHPSESSID` cookie. That is a measured constraint, not a preference: the
provider sends `Access-Control-Allow-Origin: *` with no
`Access-Control-Allow-Credentials`, so a browser cannot send the cookie
cross-origin. Naming it `sessionId` keeps the reason documented next to the field.

### D3. `expiresAt` is optional and may only be set from an observation

**Decision.** Retain `expiresAt?: number`. Its type is unchanged from the roadmap,
and the prohibition on computing it is enforced in three places: the spec
requirement, a doc comment on the field, and the absence of any code in this
milestone that produces one.

**Alternatives considered.**

- *Remove the field until a provider supplies one.* Strongest possible guarantee
  against a fabricated countdown. Rejected because it diverges from the roadmap,
  and because the field has a legitimate future use: if a provider is ever
  observed to report a real expiry signal, the model must already be able to carry
  it. Removing it would mean re-adding it later, and re-adding a field to a stored
  shape is a compatibility event rather than an additive one.

`exactOptionalPropertyTypes` makes this stronger than it looks: because it is on,
`{ expiresAt: undefined }` is not assignable, so "unset" cannot be smuggled in as
an explicit `undefined`. A field that is absent is genuinely absent. I am keeping
this behaviour deliberately and calling it out, because a later contributor
looking to "simplify" could turn it off.

**What this decision does not buy, stated plainly.** The observed-only rule cannot be
enforced mechanically. No type can distinguish an instant read from a provider
response from one computed as `createdAt + SEVEN_DAYS`. What is enforced is
structural rather than declarative: `createMailbox` never computes a value,
`withMailboxStatus` never writes one, and this milestone contains no producer at
all. The remaining protection is the `provider-abstraction` requirement and review at
M3, when a producer first appears. A source scan for `expiresAt` assignments would
create the appearance of enforcement while still passing a computed value, which is
worse than documenting the limit.

### D4. Confidence stays a plain `number`

**Decision.** `confidence: number`, with the inclusive `0..1` range specified as a
requirement and validated where a detection enters the model.

**Alternatives considered.**

- *Brand it* (`type Confidence = number & { __brand: 'Confidence' }`). This gives
  compile-time range and identity checking. Rejected for now because nothing
  produces these values until `packages/mail-parser` exists, so a brand would be
  asserted with a cast at every construction site until then - casts that would
  survive into production precisely because they compile. A validation helper
  gives the same practical guarantee at the boundary that actually needs it, and
  leaves the type honest.

### D5. Required message fields may be empty; absence stays distinguishable

**Decision.** `subject: string` and `from: string` are required, and an empty
string is a valid value for both. `fromName?` stays optional. `unread?` stays
optional.

**Alternatives considered.**

- *Make them optional.* Rejected: the roadmap specifies them as required, and
  making everything optional would make "the sender was absent" and "the sender
  sent nothing" indistinguishable, which is worse. Keeping them required while
  admitting `""` distinguishes *absent from the provider* from *blank by the
  sender*, which is the distinction that matters.

This is a direct response to measurement: a real Guerrilla message arrived with an
empty subject and a present sender and body. A model that treated empty as missing
would have dropped a message that genuinely arrived.

### D6. Failures are a closed union carrying provider and cause

**Decision.** One type per failure code, discriminated, plus a generic cause
field. An unrecognised provider failure gets `UNKNOWN_PROVIDER_ERROR` and keeps
the provider's own description.

**Alternatives considered.**

- *A flat `code` string plus optional metadata.* Simpler to read, but a bare
  string cannot be narrowed safely: a consumer switching on it cannot prove the
  cause is present, and TypeScript will not stop a `cause` access that only holds
  for some codes. Given `noUncheckedIndexedAccess` and the project's strictness,
  the discriminated union is the shape that actually delivers the narrowing.

The `UNKNOWN_PROVIDER_ERROR` case is load-bearing rather than defensive
boilerplate: mapping an unrecognised failure onto a plausible-looking code would
tell the user something false, and the Guerrilla dead-session behaviour (HTTP 200
with an `error` key while `auth.success` stays `true`) shows concretely how easily
a "success" status can conceal a failure.

### D7. Small modules with a single public entry point

**Decision.** One module per concept under `packages/core/src/` -
`provider.ts`, `credentials.ts`, `mailbox.ts`, `message.ts`, `errors.ts`,
`invariants.ts` - re-exported from `src/index.ts`.

Per the repository's code style, small domain modules are preferred over one
dispatcher file, and the boundary between credentials, mailbox, and errors is a
real dependency boundary, not a filing preference. A single `types.ts` would grow
into a file every future milestone edits, which is how god files start.

### D8. Tests widen the Vitest glob, never the workspace globs

**Decision.** Tests for the model live under `packages/core/src/` (or a
`packages/core/test/`), and `vitest.config.ts`'s `include` is widened from
`tests/architecture/**/*.test.ts` to also cover package tests.

**This is the one place M2 can permanently damage the M1 boundary work.** The
workspace globs in `pnpm-workspace.yaml` must stay `apps/*` and `packages/*`.
Adding `tests/` there would pull the M0 spike's dependency graph into every root
install and, worse, make the spike a workspace member - which is the only reason
"product code must never import the spike" is *structurally impossible* rather
than merely documented. The Vitest `include` and the pnpm `packages` globs are
different mechanisms and must move independently.

Widening `include` also risks silently picking up the spike. The replacement glob
is scoped to `packages/` and `apps/` source, never `tests/**`, and a boundary
assertion already asserts the spike is not reachable.

## Risks / Trade-offs

- **[A hand-built object literal can still bypass the mailbox constructor]** →
  The agreement assertion is exported as a reusable type, and a boundary test
  asserts that a mismatched literal fails to type-check. Construction is the
  supported path; the type makes the illegal shape obvious to anyone who bypasses
  it. Closing this fully would require a class with private fields, which would
  make the model unserialisable for storage - a worse trade.

- **[`expiresAt` is a field that is almost always absent, which invites someone
  to populate it]** → Three independent guards: a spec requirement naming the
  measured basis, a field doc comment, and the absence of any producer in this
  milestone. `provider-abstraction` already forbids deriving a countdown, so a
  later attempt would contradict a live requirement rather than merely look
  untidy.

- **[Discriminated unions are more verbose to construct and to pattern-match]** →
  Accepted. The verbosity appears at construction sites, where correctness matters,
  and it disappears at consumption sites, where narrowing is what the strictness
  settings are for.

- **[Not branding `Confidence` means an out-of-range value is a runtime, not
  compile-time, failure]** → Accepted until something produces these values. A
  brand asserted by casts today would be a lie the type system could not detect.
  The range is specified, so introducing the brand later is an additive, reviewed
  change rather than a redesign.

- **[Widening the Vitest `include` changes which files the root `pnpm test`
  executes]** → The new glob is scoped to workspace source and never to `tests/**`,
  so the M1 guarantee that the root test command cannot execute the spike harness
  is preserved and re-asserted.

## Migration Plan

None. `packages/core` currently exports nothing and no consumer imports it, so
this is purely additive. There is no stored data, no manifest, and no API surface
in use. Rollback is reverting the merge.

The one ordering constraint is internal to the change: the tests must be able to
see the model, so the Vitest `include` widening lands in the same change rather
than after it, and the pre-existing boundary assertions must still pass afterwards.

## Open Questions

- Where exactly `packages/mail-parser` will host verification detection, and
  whether it will publish confidence or only a boolean. M2 specifies the shape and
  its range; the producer is a later milestone and its answer does not change this
  spec, the approach, or the task breakdown.
- Whether `unread` is ever actually populated. No measured provider response
  established a reliable unread signal, so the field is kept optional and this
  milestone makes no claim about it.
