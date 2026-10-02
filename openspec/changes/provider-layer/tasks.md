# Tasks

## 1. The contract and its transport seam

- [ ] 1.1 Declare the `MailProvider` contract in `packages/providers`, with no
  subscription method, and record in a comment that the omission is measured
  rather than unimplemented. Verify: the type compiles and no member named
  `subscribe` exists.
- [ ] 1.2 Define the injected transport type and verify a module-level `fetch`
  call appears nowhere in the package. Verify: a boundary assertion scans
  `packages/providers/src` for a bare `fetch(` outside the transport's default
  and fails when one is introduced.
- [ ] 1.3 Add the recording transport used by the conformance suite: it serves
  queued responses, records every request, and throws when a request has no
  queued response. Verify: a test drives one queued response and asserts the
  recorded request's method and URL.
- [ ] 1.4 Define how an adapter reports which optional operations it supports, so
  absence is discoverable without invoking. Verify: a test asserts a missing
  operation is detectable and that requesting one yields an
  `UNSUPPORTED_OPERATION` error naming it.
- [ ] 1.5 Define the shared conformance suite as an exported function taking an
  adapter factory, asserting only on normalized results. Verify: the suite
  compiles and fails when handed a deliberately non-conforming stub.

## 2. Mail.tm adapter

- [ ] 2.1 Implement domain discovery, mailbox creation with client-side
  credential generation, and the bearer-token exchange, using the injected
  transport and an injected randomness source. Verify: a test drives recorded
  responses and asserts a `Mailbox` with `provider: "mailtm"` and credentials
  carrying an account id and access token.
- [ ] 2.2 Record in a comment that Mail.tm deletion must follow the hydrated
  relative `@id` from a response rather than a hand-built path, and implement it
  that way. Verify: a test deletes using the `@id` the recording returns and
  fails if the adapter builds `/accounts/{id}` itself.
- [ ] 2.3 Implement message listing and message fetch, carrying any body as text
  and never emitting a markup field, and preserving an empty subject as an empty
  value. Verify: a test using the recorded message with an empty subject and an
  HTML body asserts the subject survives and the body is carried as text.
- [ ] 2.4 Map Mail.tm's failures onto the closed normalized error vocabulary:
  `401` to an authentication failure, `404` to a distinct not-found condition,
  a validation error to an unsupported-operation condition naming the operation,
  and an unclassifiable failure to the unclassified code preserving the
  provider's own description. Verify: a test per mapping, and a test asserting an
  unclassifiable failure retains the provider's description text.
- [ ] 2.5 Capture a `429`'s `ratelimit-policy` header verbatim onto the throttled
  error without parsing it or retrying. Verify: a test drives a `429` and asserts
  the header string is preserved exactly and that exactly one request was made.
- [ ] 2.6 Run the shared conformance suite against the Mail.tm adapter and
  verify it passes with no per-adapter exemption. Verify: the suite runs green
  for this adapter and the suite file contains no provider-conditional branch.
- [ ] 2.7 Prove the Mail.tm assertions can fail by deliberately breaking the
  credential derivation, the `@id` deletion, and the throttle capture in turn and
  observing a non-zero exit naming the offending file each time, then restoring
  each. Verify: all three failures are observed and no file is left modified.

## 3. Guerrilla Mail adapter

- [ ] 3.1 Implement session establishment, capturing the body-returned session
  token and never depending on the session cookie. Verify: a test asserts the
  recorded request carries the session in the query string and that the adapter
  never reads a cookie.
- [ ] 3.2 Implement address acquisition and message listing and fetch, carrying
  the body as text. Verify: a test using the recorded message whose declared
  content type is plain text but whose body is HTML asserts the body is carried
  as text and no markup field appears.
- [ ] 3.3 Implement the mandatory dead-session detection: verify the provider
  still reports the mailbox's own address, and report an expired mailbox rather
  than an empty list when it does not. Verify: a test driving a `200` with an
  empty list and a mismatched address asserts an expired-mailbox error and
  **not** an empty list, and a second test with a matching address asserts a
  genuinely empty list.
- [ ] 3.4 Map Guerrilla's failures onto the normalized vocabulary, and confirm
  that the observed surface offers no mailbox-deletion operation, so the adapter
  declares it unsupported rather than implementing a guess. Verify: a test
  asserts the adapter reports mailbox deletion unsupported, and a comment records
  that this is unverified rather than established.
- [ ] 3.5 Run the shared conformance suite against the Guerrilla adapter and
  verify it passes with no per-adapter exemption. Verify: the suite runs green
  for this adapter and the suite file still contains no provider-conditional
  branch.
- [ ] 3.6 Prove the dead-session assertion can fail by removing the liveness
  check and observing the suite go red, then restoring it. Verify: a non-zero
  exit naming the file, and a byte-identical restore.

## 4. Provider manager and client reachability

- [ ] 4.1 Implement the provider manager taking an ordered list and being
  consulted only when creating a mailbox, so an existing mailbox always uses the
  provider that created it. Verify: a test creates a mailbox through the primary
  and asserts later reads go to the primary and never to the fallback.
- [ ] 4.2 Implement creation-time fallback, and verify the returned mailbox
  identifies the fallback it actually used. Verify: a test with a failing primary
  asserts the mailbox's `provider` is the fallback's, not the primary's.
- [ ] 4.3 Make the website's single-provider configuration explicit and assert it
  attempts no fallback, recording the limitation rather than presenting it as
  redundancy. Verify: a test with one provider asserts exactly one attempt and
  that the original failure is reported unaltered.
- [ ] 4.4 Prove the manager's assertions can fail by making the fallback silently
  masquerade as the primary and observing the suite go red, then restoring it.
  Verify: a non-zero exit naming the file.

## 5. Boundary enforcement, documentation, and integrated verification

- [ ] 5.1 Widen `tests/architecture/boundaries.test.ts` so no provider wire field
  name may appear in `packages/providers`' exported normalized surface, while
  still allowing one inside adapter internals. Verify: an injected wire field
  name is caught and named.
- [ ] 5.2 Prove every assertion added in this change can fail, by introducing
  each violation the specs forbid and observing a non-zero exit that names the
  offending file, including a positive control proving a conforming adapter still
  passes. Verify: all cases observed, zero leftover files, working tree restored
  byte-identical.
- [ ] 5.3 Update `docs/ARCHITECTURE.md` with the provider layer, `AGENTS.md` with
  the new verified commands and test counts, and `docs/ROADMAP.md` with the M3
  row, decisions, and cursor. Verify: every count and command quoted is one that
  was actually run in this change.
- [ ] 5.4 Run the full gate — `pnpm verify`, `pnpm --dir tests/provider-spike
  spike:selftest`, and `openspec validate provider-layer --strict` — and record
  the results honestly, including what each command does **not** prove. Verify:
  all exit `0` and the record names the fact that no test here contacts a live
  provider.
