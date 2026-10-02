# Tasks

## 1. Provider identity

- [x] 1.1 Create `packages/core/src/provider.ts` with `ProviderId` as the closed union `"mailtm" | "guerrilla"`, and verify a value outside it is rejected by `tsc`
- [x] 1.2 Add a guard that rejects an unrecognised provider identifier at runtime rather than coercing it to a known provider, and verify its test passes for both a valid and an invalid input
- [x] 1.3 Document in `provider.ts` that a provider identity travels with stored data and is never re-derived from current defaults, and verify the comment names both measured client/provider reach facts from `docs/PROVIDERS.md`

## 2. Provider credentials

- [x] 2.1 Create `packages/core/src/credentials.ts` with `ProviderCredentials` as a discriminated union whose fields are SpectreMail's own vocabulary (`accountId`, `accessToken`, `sessionId`) and which contains no provider wire field name, and verify by searching the file for each name in the boundary test's provider field list
- [x] 2.2 Document in the Guerrilla variant that the stored session id is the body-returned value and never the `PHPSESSID` cookie, citing the measured `Access-Control-Allow-Credentials` absence, and verify the comment is present
- [x] 2.3 Add a type-level test proving Mail.tm credentials are not assignable where Guerrilla credentials are required and vice versa, and verify it fails to compile when the mismatch is introduced
- [x] 2.4 Prove the credential mismatch rule can fail: temporarily supply one provider's credentials where the other is required and verify the type check exits non-zero naming the file

## 3. Mailbox

- [x] 3.1 Create `packages/core/src/mailbox.ts` with `MailboxStatus` as `"active" | "expired" | "unavailable"` and verify a fourth value is rejected by `tsc`
- [x] 3.2 Define `Mailbox` exactly as the roadmap specifies, including `expiresAt?: number`, and verify the shape matches the roadmap field for field
- [x] 3.3 Add the single mailbox construction entry point that derives `provider` from the credential discriminant so a caller cannot record a contradicting provider, and verify the derived value for each credential variant
- [x] 3.4 Export the mailbox/provider agreement assertion as a reusable type, and verify a hand-built mismatched literal is rejected when checked against it
- [x] 3.5 Prove the agreement rule can fail: add a temporary mismatched literal, verify `pnpm typecheck` exits non-zero naming the file, then remove it
- [x] 3.6 Add a test proving an absent `expiresAt` is distinguishable from a present one, and verify that under `exactOptionalPropertyTypes` an explicit `{ expiresAt: undefined }` is rejected
- [x] 3.7 Document on `expiresAt` that it may only be populated from an observed provider signal and never from elapsed time or documented retention, and verify no code in `packages/core` produces a value for it

## 4. Messages and verification detections

- [x] 4.1 Create `packages/core/src/message.ts` with `MessageSummary`, `Message`, `VerificationCode`, and `VerificationLink` as the roadmap specifies, and verify the shape matches field for field
- [x] 4.2 Add a test proving an empty `subject` and an empty `from` are valid values on a message that is otherwise complete, and verify the message survives without being treated as corrupt
- [x] 4.3 Add a test proving an absent optional field is distinguishable from an empty string, and verify both cases are representable and do not collide
- [x] 4.4 Verify the message body is carried as text and that no markup-carrying field exists on the message type, and prove it by confirming no field's declared type admits HTML
- [x] 4.5 Add a range check rejecting a confidence value below zero or above one where a detection enters the model, and verify values at both boundaries are accepted and values outside are rejected
- [x] 4.6 Document that detection itself is `packages/mail-parser`'s responsibility and is out of scope for this milestone, and verify the comment states the core principle that detection is deterministic

## 5. Normalized errors

- [x] 5.1 Create `packages/core/src/errors.ts` with all eight normalized codes from the roadmap as a closed union, and verify a ninth code is rejected by `tsc`
- [x] 5.2 Define a discriminated error type carrying the code, the provider, and the underlying cause, and verify narrowing on the code makes the cause available for the codes that have one
- [x] 5.3 Add a test proving an unrecognised provider failure maps to the unknown-provider-error code and retains the provider's own description rather than being coerced to a plausible code
- [x] 5.4 Add a test proving a provider response that reports a success status while its body reports an unusable session is recognised as a failure, using the measured Guerrilla dead-session shape as the fixture
- [x] 5.5 Add a test proving a throttled response is distinguishable from a generic network failure by its code, and verify the two do not collapse to the same value
- [x] 5.6 Prove the error vocabulary is closed: introduce a temporary ninth code and verify the type check exits non-zero

## 6. Package public surface

- [x] 6.1 Replace the M1 placeholder note in `packages/core/src/index.ts` with real re-exports of the domain modules, and verify the placeholder's "no exports" wording is gone
- [x] 6.2 Verify every symbol the roadmap names is exported from the package entry point, by importing each one and confirming it resolves
- [x] 6.3 Confirm the package still has no runtime dependency by inspecting its manifest, and verify the dependency list is unchanged from M1
- [x] 6.4 Confirm consuming the package still requires no build step, by verifying the manifest `exports` still points at TypeScript source

## 7. Test harness reach

- [x] 7.1 Widen `vitest.config.ts` `include` so it covers package tests, scoped to workspace source and explicitly not to `tests/**`, and verify the root `pnpm test` no longer runs only the architecture file
- [x] 7.2 Verify `pnpm-workspace.yaml` globs are still exactly `apps/*` and `packages/*` and that no `tests` glob was added, because adding one would make the M0 spike a workspace member
- [x] 7.3 Verify the root test command still cannot execute the spike harness, by confirming the M1 assertion about the spike passes and by listing the files the root test command collects
- [x] 7.4 Prove the widened glob cannot reach the spike: temporarily add a test-shaped file under `tests/provider-spike/` and verify the root test command does not collect it, then remove it

## 8. Documentation

- [x] 8.1 Update `docs/ARCHITECTURE.md` with the domain model's ownership, its module split, and the measured behaviours that shaped it, and verify every referenced file exists
- [x] 8.2 Update `AGENTS.md` to record that `packages/core` now has real content, replacing the placeholder description, and verify no claim of product behaviour is added beyond what exists
- [x] 8.3 Update `docs/ROADMAP.md`'s Project Status ledger to move the cursor to M2 at apply and record the five design decisions, and verify the recorded state matches the repository
- [x] 8.4 Update `README.md` to state that the domain model exists and still that no provider adapter, mailbox feature, or provider call exists, and verify the wording does not imply a working product

## 9. Integration verification

- [x] 9.1 Run `pnpm verify` and confirm type check, lint, format check, test, and build all exit zero
- [x] 9.2 Run `openspec validate shared-domain-model --strict` and confirm the change validates
- [x] 9.3 Run the M1 boundary assertions and confirm all still pass, particularly that no provider field name or adapter identifier was introduced outside `packages/providers`
- [x] 9.4 Run the M0 spike self-test and confirm it is unaffected and still outside the workspace
- [x] 9.5 Independently re-derive whether every invariant in the spec delta is actually enforced by something, and record any requirement that no implementation or test covers
- [x] 9.6 Record in the change which measured provider facts the model depends on, and confirm each is traceable to `docs/PROVIDERS.md` rather than to recollection
---

## Verification record

Recorded after implementation, because two findings changed what this change
actually delivers.

### Every spec requirement was checked for enforcement (task 9.5)

| Requirement | Enforced by | Verdict |
| --- | --- | --- |
| No provider wire format in the model | Widened `tests/architecture/` scan, every package except `packages/providers` | **was not enforced**; now is |
| Credentials specific to one provider | Discriminated union + `assertMailTmCredentials` / `assertGuerrillaCredentials` | enforced |
| Mailbox provider and credentials agree | `createMailbox`, `AssertProviderAgreement`, `isMailbox` | enforced, after a fix |
| Expiry only from an observed signal | `createMailbox` never computes it; `withMailboxStatus` never writes it; no producer exists | **partially enforced by construction, deliberately not mechanically** |
| A present message field may be empty | `createMessageSummary`, plus tests using the measured empty-subject message | enforced |
| Bodies carried as untrusted text | `Message` has one body field; the full field set is pinned in a test | enforced |
| Failures as a closed set of codes | Discriminated `SpectreError` union + `isSpectreError` | enforced |
| Confidence bounded to 0..1 | `isValidConfidence` / `assertConfidence` | enforced |
| Provider identified, not inferred | Closed `PROVIDER_IDS`, `isProviderId`, `isMailbox` rejecting unknowns | enforced |

### Three findings, recorded rather than smoothed over

**1. A boundary rule was green while under-enforcing.** The provider-wire-format
scan was scoped to `apps/`, so `packages/core` - the package whose entire purpose
is to be free of wire format - was not covered by it at all. Scope widened to every
workspace package except `packages/providers` and `*.test.ts`. The widened scan
immediately caught one real violation: a comment in `packages/mail-parser` quoting
a provider's content-type field name. The comment was reworded rather than the rule
narrowed. `tests/architecture/boundaries.test.ts` now covers 8 assertions.

**2. The mailbox-agreement assertion rejected everything, including correct
mailboxes.** `MailboxProviderAgreement` was written as a non-generic alias applied
to `Mailbox` itself. It rejected a mismatched literal - and it rejected every
well-formed mailbox too, resolving to `never`. The cause is structural: a
non-generic `Mailbox` stores credentials as the whole `ProviderCredentials` union,
and a union never `extends` a single provider literal. The first falsification run
appeared to pass because a mismatched literal *was* rejected; it was rejected for
the wrong reason, and the negative case alone could never have revealed that.

Replaced by `AssertProviderAgreement<T>`, generic over the candidate and using
tuple-wrapped conditionals to suppress distribution. It now narrows a literal to
itself and resolves `Mailbox` to `Mailbox`. The negative proof was re-run with a
**positive control** added, precisely because four negative cases cannot
distinguish a strict assertion from a useless one. This is the third time this
repository has produced a check narrower than - or broader than - the rule it
documented.

**3. "Expiry is observed-only" is not mechanically enforceable, and is not claimed
to be.** Nothing can decide at the type level whether a supplied instant came from
a provider response or from `createdAt + SEVEN_DAYS`. What is enforced is
structural: `createMailbox` never computes a value, `withMailboxStatus` never
writes one, and no producer exists in this milestone. The remaining protection is
the requirement in `provider-abstraction` (*Mailbox lifetime is not assumed*) and
review at M3, when a producer is introduced for the first time. A source scan for
`expiresAt` assignments would add the appearance of enforcement while still missing
a computed value, which is worse than stating the limit.

### Measured facts the model depends on (task 9.6)

Every claim traces to `docs/PROVIDERS.md` or to run artifact
`2026-10-01T18-08-41-251Z`. Nothing here is from recollection or from provider
documentation.

| Fact | Used for |
| --- | --- |
| A real Guerrilla message arrived with an empty subject, sender and body present | `subject` / `from` required but possibly `""` |
| Guerrilla declared a plain-text content type and delivered an HTML body | `Message` carries one text field and no markup field |
| Guerrilla sends `Access-Control-Allow-Origin: *` with no `Access-Control-Allow-Credentials` | `sessionId` is the body-returned value, never the `PHPSESSID` cookie |
| Mail.tm publishes a 7-day retention and "valid until deleted"; neither appears in any API response, neither measured live | `expiresAt` is observed-only, absence is normal |
| Dead Guerrilla session: HTTP 200, an `error` key, no message list, `auth.success` still `true` | `UNKNOWN_PROVIDER_ERROR` exists and must retain the provider's description |
| Mail.tm after deletion: `deleteStatus: 204`, every follow-up 401 | `MAILBOX_EXPIRED` and `AUTH_FAILED` are distinct codes |
| Mail.tm advertises `1; w=60` on account creation | `RATE_LIMITED` retains the header verbatim |
| Mail.tm advertises an SSE transport and serves none | `UNSUPPORTED_OPERATION` carries the operation name |
| Mail.tm ACAO covers only `https://mail.tm` and `https://api.mail.tm` | provider identity travels with stored data, so a client can report what it cannot reach |

### Falsification results

Five cases, each introducing the violation, observing a non-zero exit that names
the violating file, then removing it. Temporary files are untracked and removed in a
`finally` block; the run ended with zero leftovers.

- PASS - control: a well-formed mailbox satisfies the agreement assertion
- PASS - one provider's credentials where the other's are required
- PASS - a mailbox whose provider contradicts its credentials
- PASS - a ninth normalized error code
- PASS - a provider wire field name in the shared model
- PASS - the root test command cannot collect a test file placed inside the spike

### Gates actually run

`pnpm verify` (typecheck, lint, format check, test, build) exited 0;
7 test files, 55 tests; all 7 workspace projects type check.