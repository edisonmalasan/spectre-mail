# Tasks

## 1. The contract and its transport seam

- [x] 1.1 Declare the `MailProvider` contract in `packages/providers`, with no
  subscription method, and record in a comment that the omission is measured
  rather than unimplemented. Verify: the type compiles and no member named
  `subscribe` exists.
- [x] 1.2 Define the injected transport type and verify a module-level `fetch`
  call appears nowhere in the package. Verify: a boundary assertion scans
  `packages/providers/src` for a bare `fetch(` outside the transport's default
  and fails when one is introduced.
- [x] 1.3 Add the recording transport used by the conformance suite: it serves
  queued responses, records every request, and throws when a request has no
  queued response. Verify: a test drives one queued response and asserts the
  recorded request's method and URL.
- [x] 1.4 Define how an adapter reports which optional operations it supports, so
  absence is discoverable without invoking. Verify: a test asserts a missing
  operation is detectable and that requesting one yields an
  `UNSUPPORTED_OPERATION` error naming it.

  > **THE BOX WAS TICKED BEFORE IT WAS TRUE.** The verification pass found this
  > task's second half unimplemented: `supports()` answered the question, but
  > invoking an absent optional method raised
  > `TypeError: provider.destroyMailbox is not a function`. That is not a
  > `SpectreError`, so no layer knowing only the closed vocabulary could catch,
  > present, or recover from it, and it named an implementation detail rather than
  > the requested operation.
  >
  > Repaired in `packages/providers/src/operations.ts`, which guards both optional
  > operations and converts absence into `UNSUPPORTED_OPERATION` carrying the
  > operation name. Six tests added. Proven load-bearing twice: removing the
  > `supports()` check, and replacing the operation name with a wrong one, each
  > produced a red suite naming the matching test.
  >
  > The guard consults `supports()` rather than testing for the property's
  > presence. That is a deliberate choice, not an oversight: a provider that claims
  > support while omitting the method is a defect in *that provider*, and catching
  > it here would hide it behind a guard. The conformance suite is where a lying
  > adapter is caught.
- [x] 1.5 Define the shared conformance suite as an exported function taking an
  adapter factory, asserting only on normalized results. Verify: the suite
  compiles and fails when handed a deliberately non-conforming stub.

## 2. Mail.tm adapter

- [x] 2.1 Implement domain discovery, mailbox creation with client-side
  credential generation, and the bearer-token exchange, using the injected
  transport and an injected randomness source. Verify: a test drives recorded
  responses and asserts a `Mailbox` with `provider: "mailtm"` and credentials
  carrying an account id and access token.
- [x] 2.2 Record in a comment that Mail.tm deletion must follow the hydrated
  relative `@id` from a response rather than a hand-built path, and implement it
  that way. Verify: a test deletes using the `@id` the recording returns and
  fails if the adapter builds `/accounts/{id}` itself.
- [x] 2.3 Implement message listing and message fetch, carrying any body as text
  and never emitting a markup field, and preserving an empty subject as an empty
  value. Verify: a test using the recorded message with an empty subject and an
  HTML body asserts the subject survives and the body is carried as text.
- [x] 2.4 Map Mail.tm's failures onto the closed normalized error vocabulary: `404`
  to a distinct not-found condition carrying the message id, `405`/`501` to
  unsupported-operation naming the operation, and an unclassifiable failure to the
  unclassified code preserving the provider's own description. Verify: a test per
  mapping, and a test asserting an unclassifiable failure retains the provider's
  description text.

  > **CORRECTED DURING APPLY.** This task originally read "a validation error to an
  > unsupported-operation condition naming the operation" and "a `401` to an
  > authentication failure". Both were wrong, and the correction is recorded rather
  > than applied silently.
  >
  > A `422 ConstraintViolationList` means Mail.tm **refused the address we
  > generated** - not that the provider lacks a capability. Reporting
  > `UNSUPPORTED_OPERATION` would tell the user that no provider can create a
  > mailbox and send them looking for another one, when the fault is ours. It now
  > maps to `UNKNOWN_PROVIDER_ERROR` with the hydra description preserved.
  >
  > A `401` means two different things depending on where it happened. On the token
  > exchange the credentials genuinely were refused: `AUTH_FAILED`. On a request
  > carrying an already-issued token, **measurement says a deleted mailbox and a bad
  > token both answer `401` with the same body** - deletion answers `204` and the next
  > request answers `401` - so it maps to `MAILBOX_EXPIRED`. Reporting
  > "check your credentials" to someone who never entered any would be the
  > misleading outcome. The shared conformance suite consequently accepts either code
  > and asserts only what must hold everywhere: the rejection is reported, names the
  > provider, and is not a not-found.
- [x] 2.5 Capture a `429`'s `ratelimit-policy` header verbatim onto the throttled
  error without parsing it or retrying. Verify: a test drives a `429` and asserts
  the header string is preserved exactly and that exactly one request was made.
- [x] 2.6 Run the shared conformance suite against the Mail.tm adapter and
  verify it passes with no per-adapter exemption. Verify: the suite runs green
  for this adapter and the suite file contains no provider-conditional branch.
- [x] 2.7 Prove the Mail.tm assertions can fail by deliberately breaking the
  credential derivation, the `@id` deletion, and the throttle capture in turn and
  observing a non-zero exit naming the offending file each time, then restoring
  each. Verify: all three failures are observed and no file is left modified.

## 3. Guerrilla Mail adapter

- [x] 3.1 Implement session establishment, capturing the body-returned session
  token and never depending on the session cookie. Verify: a test asserts the
  recorded request carries the session in the query string and that the adapter
  never reads a cookie.
- [x] 3.2 Implement address acquisition and message listing and fetch, carrying
  the body as text. Verify: a test using the recorded message whose declared
  content type is plain text but whose body is HTML asserts the body is carried
  as text and no markup field appears.
- [x] 3.3 Implement the mandatory dead-session detection: verify the provider
  still reports the mailbox's own address, and report an expired mailbox rather
  than an empty list when it does not. Verify: a test driving a `200` with an
  empty list and a mismatched address asserts an expired-mailbox error and
  **not** an empty list, and a second test with a matching address asserts a
  genuinely empty list.
- [x] 3.4 Map Guerrilla's failures onto the normalized vocabulary, and confirm
  that the observed surface offers no mailbox-deletion operation, so the adapter
  declares it unsupported rather than implementing a guess. Verify: a test
  asserts the adapter reports mailbox deletion unsupported, and a comment records
  that this is unverified rather than established.
- [x] 3.5 Run the shared conformance suite against the Guerrilla adapter and
  verify it passes with no per-adapter exemption. Verify: the suite runs green
  for this adapter and the suite file still contains no provider-conditional
  branch.
- [x] 3.6 Prove the dead-session assertion can fail by removing the liveness
  check and observing the suite go red, then restoring it. Verify: a non-zero
  exit naming the file, and a byte-identical restore.

## 4. Provider manager and client reachability

- [x] 4.1 Implement the provider manager taking an ordered list and being
  consulted only when creating a mailbox, so an existing mailbox always uses the
  provider that created it. Verify: a test creates a mailbox through the primary
  and asserts later reads go to the primary and never to the fallback.
- [x] 4.2 Implement creation-time fallback, and verify the returned mailbox
  identifies the fallback it actually used. Verify: a test with a failing primary
  asserts the mailbox's `provider` is the fallback's, not the primary's.
- [x] 4.3 Make the website's single-provider configuration explicit and assert it
  attempts no fallback, recording the limitation rather than presenting it as
  redundancy. Verify: a test with one provider asserts exactly one attempt and
  that the original failure is reported unaltered.
- [x] 4.4 Prove the manager's assertions can fail by making the fallback silently
  masquerade as the primary and observing the suite go red, then restoring it.
  Verify: a non-zero exit naming the file.

> **VERIFICATION PASS - found two requirement scenarios with no implementation.**
>
> The apply stage ticked every box, and reading the implementation against the delta
> spec found two scenarios the tests did not actually cover. Both are now repaired.
>
> **1. CRITICAL - an unsupported operation was a `TypeError`, not a normalized
> error.** Requirement *Optional capabilities are discoverable, not assumed*, second
> scenario: when a caller invokes an operation the adapter does not implement, the
> absence SHALL be reported as an unsupported operation and SHALL name the
> operation. Nothing implemented that. Repaired; see task 1.4.
>
> **2. CRITICAL - "the provider layer does not persist anything" had no behavioural
> test at all.** Its two scenarios require that an adapter retain no state between
> calls and that a mailbox restored from storage work with nothing remembered. The
> only coverage was a grep for a doc comment. Worse, the gap was *structural*: every
> test in the package builds a **fresh adapter per call**, so an adapter that cached
> the first mailbox's credentials would have passed all 80 tests, because the cache
> would never be read by a test handing over a different mailbox.
>
> Two tests added, one per adapter, driving **one adapter instance** across two
> mailboxes with different credentials and asserting each request carried its own
> mailbox's credential. Both proven load-bearing by injecting a real cache
> (`cachedSession ??= ...`) into each adapter: the new test failed in both cases.
>
> The first injection attempt was itself wrong - it assigned the token before
> returning it, so behaviour was unchanged and the new test passed while a different
> test failed. That was a defective mutation rather than a weak assertion, and it
> was redone properly. A mutation that does not introduce the defect proves nothing
> about the assertion it is meant to test.
>
> **Also found, and deliberately NOT repaired - recorded instead:**
>
> - `Mailbox.id` for Mail.tm is the absolute provider resource URL
>   (`https://api.mail.tm/accounts/{id}`), and `MessageSummary.id` is the provider's
>   message id, which a caller must supply to fetch. So a caller *can* distinguish
>   the provider by reading a value, and provider identifiers *are* required by one
>   call. This reads against the scenario "the provider's identifiers SHALL NOT be
>   required by any caller" under *A provider response is translated before anything
>   observes it*. It is not repaired here because `Mailbox.id` is M2's design and
>   the deletion requirement (`docs/PROVIDERS.md` §2) depends on the adapter holding
>   the provider's own resource URL. The real risk - a caller *parsing* that value -
>   is not realised anywhere: nothing in the workspace reads `mailbox.id` except the
>   adapter that created it. Recorded so it is a decision rather than an oversight.
> - The requirement *A provider rejects the supplied credentials SHALL be reported
>   as an authentication failure* is satisfied only where the condition is
>   decidable. Mail.tm answers `401` for both a refused credential and a deleted
>   mailbox, with the same body, so a bearer `401` reports `MAILBOX_EXPIRED` and
>   only the token exchange reports `AUTH_FAILED`. The shared conformance suite
>   accepts either code. **The delta's wording should be amended at sync** to
>   distinguish a credential rejected at authentication time from an
>   already-issued credential the provider no longer honours.

## 5. Boundary enforcement, documentation, and integrated verification

- [x] 5.1 Widen `tests/architecture/boundaries.test.ts` so no provider wire field
  name may appear in `packages/providers`' exported normalized surface, while
  still allowing one inside adapter internals. Verify: an injected wire field
  name is caught and named.
- [x] 5.2 Prove every assertion added in this change can fail, by introducing
  each violation the specs forbid and observing a non-zero exit that names the
  offending file, including a positive control proving a conforming adapter still
  passes. Verify: all cases observed, zero leftover files, working tree restored
  byte-identical.

  > **Performed. 16 deliberate violations, all caught, every file restored
  > byte-identical** (verified by string comparison, not by `git status` alone).
  >
  > Nine targeted the boundary and contract rules: a `subscribe` member; a push
  > transport named differently (`startStream(): EventSource`); `globalThis.fetch` in
  > an adapter; a bare `fetch(` call; an adapter exported from `packages/core`; an
  > adapter-shaped identifier (`createSpectreAdapter`) outside its package; a wire
  > field name in `packages/core`; one in `apps/web`; and an adapter alias in the
  > shared index. Nine of nine non-zero exits, eight naming the expected assertion.
  >
  > Seven reverted a behaviour the specs **require** - the Guerrilla dead-session
  > check, the verbatim rate-limit header, the throttle path, empty-subject
  > preservation, the absence of a markup field, fallback honesty, and expiry
  > invention - and each produced a red suite naming the matching test.
  >
  > **One case was not verified on its first run.** The rate-limit case went red,
  > but the harness's ambiguous anchor had matched several sites, so it was unclear
  > *which* test caught it. Re-run in isolation with the anchor confirmed to occur
  > exactly once: `reports throttling with the provider's own header, unparsed`
  > failed. "The suite went red" is not the claim; "this test catches this defect"
  > is.
  >
  > **Positive control, in the opposite direction.** Every case above shows a
  > violation turning the suite red, which alone cannot distinguish a strict suite
  > from a merely noisy one. A deliberately non-conforming stub - emitting an `html`
  > field the model does not define and inventing an `expiresAt` - was run through
  > the shared conformance suite: **6 of 12 tests failed**, naming both defects.
  > The control file was deleted afterwards.
  >
  > **The first run of this task found nothing, because the assertion did not
  > exist.** Adding a `subscribe` member to the contract left the suite green. The
  > absence of a member is unobservable at runtime, so the check is now a source
  > scan *and* a compile-time assertion.
- [x] 5.3 Update `docs/ARCHITECTURE.md` with the provider layer, `AGENTS.md` with
  the new verified commands and test counts, and `docs/ROADMAP.md` with the M3
  row, decisions, and cursor. Verify: every count and command quoted is one that
  was actually run in this change.
- [x] 5.4 Run the full gate — `pnpm verify`, `pnpm --dir tests/provider-spike
  spike:selftest`, and `openspec validate provider-layer --strict` — and record
  the results honestly, including what each command does **not** prove. Verify:
  all exit `0` and the record names the fact that no test here contacts a live
  provider.

  > **Run 2026-10-02. All four commands exited `0`:**
  >
  > ```text
  > pnpm verify        7 of 7 projects run tsc --noEmit; lint clean;
  >                    "All matched files use Prettier code style!";
  >                    12 test files, 142 tests passed; vite build succeeded
  > spike:selftest     16/16, "self-test passed"
  > openspec validate provider-layer --type change --strict
  >                    Change 'provider-layer' is valid
  > openspec validate --specs --strict
  >                    4 passed, 0 failed (4 items)
  > ```
  >
  > `--type change` is required rather than the bare name while the change is
  > active; the bare name is only ambiguous after sync.
  >
  > **What this does not prove:**
  >
  > - **No provider was contacted.** Every adapter test replays recorded responses,
  >   so this establishes this repository's mapping of a measured wire format and
  >   **nothing** about either provider's current behaviour. A provider renaming a
  >   field would leave this gate green. Refreshing fixtures against
  >   `docs/PROVIDERS.md` is a deliberate diff, not something CI performs.
  > - **No product behaviour.** No client consumes `packages/providers` yet, so no
  >   test can assert a user-visible outcome. M3 adds a capability, not a feature.
  > - **`pnpm build` builds the website only.** Packages are consumed as TypeScript
  >   source; package correctness is `pnpm typecheck`, a separate gate inside
  >   `verify`.
  > - **The CI workflow has still never been made to fail.** It is green, which
  >   proves the commands resolve on a clean Linux runner — not that it would catch a
  >   regression.
  > - **The live MV3 host-permission check remains deferred**, with no result
  >   claimed in either direction.
  > - **`spike:selftest` verifies the harness, not the providers.** It proves the
  >   M0 harness distinguishes its four outcome classes and writes both artifacts.
  >   A bare `spike` run still records both delivery checks as `unverified`.
