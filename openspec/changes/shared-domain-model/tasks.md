# Tasks

## 1. Provider identity

- [ ] 1.1 Create `packages/core/src/provider.ts` with `ProviderId` as the closed union `"mailtm" | "guerrilla"`, and verify a value outside it is rejected by `tsc`
- [ ] 1.2 Add a guard that rejects an unrecognised provider identifier at runtime rather than coercing it to a known provider, and verify its test passes for both a valid and an invalid input
- [ ] 1.3 Document in `provider.ts` that a provider identity travels with stored data and is never re-derived from current defaults, and verify the comment names both measured client/provider reach facts from `docs/PROVIDERS.md`

## 2. Provider credentials

- [ ] 2.1 Create `packages/core/src/credentials.ts` with `ProviderCredentials` as a discriminated union whose fields are SpectreMail's own vocabulary (`accountId`, `accessToken`, `sessionId`) and which contains no provider wire field name, and verify by searching the file for each name in the boundary test's provider field list
- [ ] 2.2 Document in the Guerrilla variant that the stored session id is the body-returned value and never the `PHPSESSID` cookie, citing the measured `Access-Control-Allow-Credentials` absence, and verify the comment is present
- [ ] 2.3 Add a type-level test proving Mail.tm credentials are not assignable where Guerrilla credentials are required and vice versa, and verify it fails to compile when the mismatch is introduced
- [ ] 2.4 Prove the credential mismatch rule can fail: temporarily supply one provider's credentials where the other is required and verify the type check exits non-zero naming the file

## 3. Mailbox

- [ ] 3.1 Create `packages/core/src/mailbox.ts` with `MailboxStatus` as `"active" | "expired" | "unavailable"` and verify a fourth value is rejected by `tsc`
- [ ] 3.2 Define `Mailbox` exactly as the roadmap specifies, including `expiresAt?: number`, and verify the shape matches the roadmap field for field
- [ ] 3.3 Add the single mailbox construction entry point that derives `provider` from the credential discriminant so a caller cannot record a contradicting provider, and verify the derived value for each credential variant
- [ ] 3.4 Export the mailbox/provider agreement assertion as a reusable type, and verify a hand-built mismatched literal is rejected when checked against it
- [ ] 3.5 Prove the agreement rule can fail: add a temporary mismatched literal, verify `pnpm typecheck` exits non-zero naming the file, then remove it
- [ ] 3.6 Add a test proving an absent `expiresAt` is distinguishable from a present one, and verify that under `exactOptionalPropertyTypes` an explicit `{ expiresAt: undefined }` is rejected
- [ ] 3.7 Document on `expiresAt` that it may only be populated from an observed provider signal and never from elapsed time or documented retention, and verify no code in `packages/core` produces a value for it

## 4. Messages and verification detections

- [ ] 4.1 Create `packages/core/src/message.ts` with `MessageSummary`, `Message`, `VerificationCode`, and `VerificationLink` as the roadmap specifies, and verify the shape matches field for field
- [ ] 4.2 Add a test proving an empty `subject` and an empty `from` are valid values on a message that is otherwise complete, and verify the message survives without being treated as corrupt
- [ ] 4.3 Add a test proving an absent optional field is distinguishable from an empty string, and verify both cases are representable and do not collide
- [ ] 4.4 Verify the message body is carried as text and that no markup-carrying field exists on the message type, and prove it by confirming no field's declared type admits HTML
- [ ] 4.5 Add a range check rejecting a confidence value below zero or above one where a detection enters the model, and verify values at both boundaries are accepted and values outside are rejected
- [ ] 4.6 Document that detection itself is `packages/mail-parser`'s responsibility and is out of scope for this milestone, and verify the comment states the core principle that detection is deterministic

## 5. Normalized errors

- [ ] 5.1 Create `packages/core/src/errors.ts` with all eight normalized codes from the roadmap as a closed union, and verify a ninth code is rejected by `tsc`
- [ ] 5.2 Define a discriminated error type carrying the code, the provider, and the underlying cause, and verify narrowing on the code makes the cause available for the codes that have one
- [ ] 5.3 Add a test proving an unrecognised provider failure maps to the unknown-provider-error code and retains the provider's own description rather than being coerced to a plausible code
- [ ] 5.4 Add a test proving a provider response that reports a success status while its body reports an unusable session is recognised as a failure, using the measured Guerrilla dead-session shape as the fixture
- [ ] 5.5 Add a test proving a throttled response is distinguishable from a generic network failure by its code, and verify the two do not collapse to the same value
- [ ] 5.6 Prove the error vocabulary is closed: introduce a temporary ninth code and verify the type check exits non-zero

## 6. Package public surface

- [ ] 6.1 Replace the M1 placeholder note in `packages/core/src/index.ts` with real re-exports of the domain modules, and verify the placeholder's "no exports" wording is gone
- [ ] 6.2 Verify every symbol the roadmap names is exported from the package entry point, by importing each one and confirming it resolves
- [ ] 6.3 Confirm the package still has no runtime dependency by inspecting its manifest, and verify the dependency list is unchanged from M1
- [ ] 6.4 Confirm consuming the package still requires no build step, by verifying the manifest `exports` still points at TypeScript source

## 7. Test harness reach

- [ ] 7.1 Widen `vitest.config.ts` `include` so it covers package tests, scoped to workspace source and explicitly not to `tests/**`, and verify the root `pnpm test` no longer runs only the architecture file
- [ ] 7.2 Verify `pnpm-workspace.yaml` globs are still exactly `apps/*` and `packages/*` and that no `tests` glob was added, because adding one would make the M0 spike a workspace member
- [ ] 7.3 Verify the root test command still cannot execute the spike harness, by confirming the M1 assertion about the spike passes and by listing the files the root test command collects
- [ ] 7.4 Prove the widened glob cannot reach the spike: temporarily add a test-shaped file under `tests/provider-spike/` and verify the root test command does not collect it, then remove it

## 8. Documentation

- [ ] 8.1 Update `docs/ARCHITECTURE.md` with the domain model's ownership, its module split, and the measured behaviours that shaped it, and verify every referenced file exists
- [ ] 8.2 Update `AGENTS.md` to record that `packages/core` now has real content, replacing the placeholder description, and verify no claim of product behaviour is added beyond what exists
- [ ] 8.3 Update `docs/ROADMAP.md`'s Project Status ledger to move the cursor to M2 at apply and record the five design decisions, and verify the recorded state matches the repository
- [ ] 8.4 Update `README.md` to state that the domain model exists and still that no provider adapter, mailbox feature, or provider call exists, and verify the wording does not imply a working product

## 9. Integration verification

- [ ] 9.1 Run `pnpm verify` and confirm type check, lint, format check, test, and build all exit zero
- [ ] 9.2 Run `openspec validate shared-domain-model --strict` and confirm the change validates
- [ ] 9.3 Run the M1 boundary assertions and confirm all still pass, particularly that no provider field name or adapter identifier was introduced outside `packages/providers`
- [ ] 9.4 Run the M0 spike self-test and confirm it is unaffected and still outside the workspace
- [ ] 9.5 Independently re-derive whether every invariant in the spec delta is actually enforced by something, and record any requirement that no implementation or test covers
- [ ] 9.6 Record in the change which measured provider facts the model depends on, and confirm each is traceable to `docs/PROVIDERS.md` rather than to recollection