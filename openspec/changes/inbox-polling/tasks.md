# Tasks

## 1. The cadence calculation

- [x] 1.1 Add `packages/mailbox/src/cadence.ts` exporting a pure `nextDelay` over a
  count of consecutive unchanged checks: 5000ms at zero, doubling per unchanged
  check, never above 30000ms. Verify: a table test asserts the full sequence from
  zero through the first capped value and that further unchanged checks hold the
  cap, plus a case asserting the returned value is always an integer no greater than
  the cap.

- [x] 1.2 State the intervals as named exported constants with a comment recording
  that **no provider limit was measured** for the provider this client reaches, that
  Mail.tm's `30; w=60` was measured unauthenticated only, and that these are the
  product's own numbers. Verify: a test reads the exported values and asserts the
  cap is at or above the prompt interval, and that neither is zero — a cadence of
  zero would be a busy loop that no assertion would catch.

## 2. The clock seam and the poller

- [x] 2.1 Add a `MailboxScheduler` seam to `packages/mailbox`: `schedule(afterMs, run):
  Cancel`, with a `Cancel` that is callable, and **no time API beyond it**.
  **Amended at the apply stage:** this task originally specified a `MailboxClock`
  carrying `now(): number` *and* `schedule`, and the implementation narrowed it to a
  scheduler only. `design.md`'s D2 records the narrowing and its reason — the session
  turned out to need no notion of the current instant, because the cadence is a
  function of how many checks have gone unchanged rather than of elapsed time. Verify:
  a test builds a session over a hand-written scheduler and asserts a scheduled
  callback does not run until the test runs it — which fails immediately if the
  implementation reaches for a real timer instead.

- [x] 2.2 Add `destroy()` to `MailboxSession`, cancelling any pending schedule and
  leaving the session readable. Verify: a test schedules a check, destroys, runs the
  scheduler anyway, and asserts the callback never ran and that `current()` still
  returns the same state. **Amended at the verification stage:** "advances the clock"
  described a capability the seam no longer has; the assertion is the same one, stated
  in terms of what the test can actually do.

- [x] 2.3 Implement polling: schedule the next check at `max(nextDelay(...), any
  declared provider delay)`, and **never schedule sooner** than a declared delay.
  Verify: a test with a provider that declares a delay asserts the next interval is
  never below it across several cadence steps, and a second asserts the cadence still
  governs when no delay is declared.

- [x] 2.4 Surface a throttled listing as a failure and do not reschedule it
  automatically. Verify: a stub provider rejecting with the throttled code is driven
  twice; the second listing does not occur until the test asks for one, and the
  failure appears in the inbox rather than replacing the session state.

- [x] 2.5 Report a declared rate limit **verbatim** and derive nothing from it.
  Verify: a test asserts a stub's `rateLimit` string reaches the inbox unchanged,
  plus a negative case asserting no substring of it is re-parsed into a number the
  session reports.

- [x] 2.6 Stop polling while the caller reports nothing is displaying the inbox, and
  check promptly when it returns. Verify: a test reporting hidden asserts **zero**
  listing requests while the scheduler is run repeatedly — nothing is pending, so no
  number of runs can reach the provider — then reports visible and asserts a listing
  occurs without any further run. **Amended at the verification stage:** the original
  wording, "while the clock advances far past the cap", described elapsed time, and the
  narrowed scheduler seam has no notion of it. The assertion is unchanged and still
  falsifiable.

## 3. The inbox state and the once-per-message analysis

- [x] 3.1 Add an `InboxState` discriminated union in `packages/mailbox/src/state.ts`
  carrying the messages, whether a check is in progress, a check failure, and the
  per-message verdict map. Extend `SessionState`'s `ready` variant to carry it, and
  add narrowing helpers. Verify: a test asserts each variant's `kind` and that **no
  variant carries a field belonging to another** — the exact check that was missing
  for `failed` in slice 1 and that its verification pass had to add.

- [x] 3.2 Depend on `@spectre-mail/mail-parser` from `packages/mailbox` and call
  `analyseMessage` on each message's text, once, keyed by message id. Verify: `pnpm
  install` succeeds, the package appears in the workspace, and
  `pnpm --filter @spectre-mail/mailbox typecheck` exits 0. **Amended at the
  verification stage:** the original said `analyse`, which is not an export this
  repository has; the parser's entry point is `analyseMessage`.

- [x] 3.3 Report a message that could not be read as **undetermined**, never as
  carrying nothing. Verify: a stub whose `getMessage` rejects produces a row whose
  verdict is undetermined, and a test asserts no code-or-link claim is made for it.

- [x] 3.4 Never re-read a message already determined, including across a listing that
  drops and re-adds it. Verify: a counting stub is driven through three listings
  containing the same id and the read count for that id is exactly 1, and a fourth
  listing adding one new id raises it to exactly 2.

- [x] 3.5 Replace the mailbox when the session replaces it, with no request made on
  the previous mailbox's behalf and none of its verdicts carried over. Verify: a test
  records every request, replaces the mailbox, advances the clock, and asserts no URL
  carries the first mailbox's session and that the verdict map is empty.

## 4. The boundary rules this slice's architecture depends on

- [x] 4.1 Add a scan asserting no module in `packages/mailbox` reaches a clock or
  timer global, with a **positive control per spelling** (`Date.now`, `Date.parse`,
  `new Date`, `performance.now`, `setTimeout`, `setInterval`, `setImmediate`) and
  **three** negative controls — a parameter of the same name, a local binding of the
  same name, and `Date.UTC`, which reads no clock. Verify: the control drives a
  temporary module containing each spelling and asserts the rule catches it — a single
  control would prove only the form its author thought of, which is the sixteenth
  recorded instance of that failure in this repository.

- [x] 4.2 Add a rule that `packages/mail-parser` is imported only by
  `packages/mailbox`. Verify: a positive control writes a probe importing the parser
  into `apps/web` and asserts the rule catches it — the interesting violation is in a
  **client**, which every package-only scan in this file would have missed — and a
  second assertion names `packages/mailbox/src/inbox.ts` as the one permitted caller,
  so a rule that forbade the parser anywhere would fail rather than pass.
  **Amended at the verification stage:** the original first clause, "extend the
  adapter-confinement and wire-format rules' file set", required no work at all — both
  rules walk directories, so the new modules were already in scope. A ticked task
  describing a no-op reads as work done.

- [x] 4.4 Extend the global-`fetch` rule to cover `packages/mailbox`, with a positive
  control **per fetch form** written into that package. Verify: the control writes a
  probe into `packages/mailbox` for each of a bare call, a `window.fetch` call and a
  `globalThis.fetch` reference, and asserts each is caught.
  **Added at the verification stage.** The independent verification pass found that
  the scan covered only `packages/providers` and `packages/mail-parser`, so a `fetch`
  introduced into the new polling loop would have turned nothing red — while
  `packages/mailbox/src/inbox.ts`'s own module comment claimed the rule "now covers
  these modules too". It did not.

- [x] 4.3 Assert `packages/mailbox`'s `tsconfig` still omits `DOM` **and** assert at
  runtime that `window` and `document` are absent from the globals, read
  reflectively — `globalThis.document` does not compile there, which is the
  enforcement, and a runtime claim needs a runtime check. Verify: the assertion
  fails if a `window` global is installed, and reads via `Reflect.get`.

## 5. The website's inbox

- [x] 5.1 Add `WEBSITE_INBOX_VISIBLE`-style visibility reporting to `apps/web`, wired
  to the document's visibility state and **not** to any storage or URL API. Verify: a
  jsdom test fires a `visibilitychange` and asserts the session is told.

- [x] 5.2 Add an `Inbox` component rendering one row per message with sender,
  subject, time, and unread state. A message with an empty subject or sender still
  renders a row. Verify: jsdom tests render a mixed list and assert every message
  appears, that the empty-subject row is present and not blank, and that each row
  names its own sender.

- [x] 5.3 Distinguish the three inbox states as distinct labelled content: checking,
  empty, and populated. Verify: a test per state asserting the specific string, and a
  mutual-exclusion assertion **naming the strings themselves** — the vacuous form of
  that assertion was one of slice 1's two real findings.

- [x] 5.4 Render the verification marking from the session's verdict map, never from
  a fresh parse, and render undetermined as undetermined. Verify: a test asserts the
  marking is not conveyed by colour alone — it is text present in the row — and a
  mutation that marks an undetermined message as carrying nothing is caught.

- [x] 5.5 Render a failed check as an annotation with the address still present,
  selectable, and copyable. Verify: a jsdom test drives a failing listing and asserts
  the address is still in the document, still selectable, and that the explanation is
  shown — plus a test that a later success clears the annotation.

- [x] 5.6 Assert the website displays no interval, countdown, or rate SpectreMail
  chose anywhere in the inbox. Verify: a test asserts none of the interval constants'
  string forms appear, and a mutation inserting one is caught. This is the check that
  would catch the product inventing a number, which is the specific failure mode
  `provider-abstraction` warns about. **Amended at the verification stage, with the
  clause it enforces.** As originally written this forbade showing a "provider rate",
  which conflicted with `mailbox-session`'s requirement that a provider's statement be
  reported verbatim — and the implementation shows `1; w=60` on the throttling
  annotation. Both the task and the delta clause were narrowed to the numbers the
  *product* chooses, and a second test now asserts the distinction directly: the
  provider's statement appears, attributed and with its scope disclaimed, while the
  duration regexes still hold on that very page. Without that second test the first
  one would only ever have proved that a *successful* inbox shows no figures.

- [x] 5.7 Add the slice's counts and the honest limits to `docs/ARCHITECTURE.md`,
  `docs/ROADMAP.md`, `README.md`, and `AGENTS.md`, recording that the cadence has
  never been exercised against a live provider and that no live browser run exists.
  Verify: `pnpm verify` exits 0 and every stated count matches `pnpm vitest run`
  output.
  **Result:** `pnpm verify` exit 0; the four documents state 24 files / 474 tests and
  31 boundary assertions, read from `--reporter=basic` per file. Each records, in its
  own words, that the cadence has never run against a live provider and that no live
  browser run exists. `AGENTS.md`'s gates entry also gained the observation that
  **`pnpm test` and `pnpm typecheck` catch different defects and neither substitutes
  for the other**, since this slice was bitten in both directions.

## 6. Integration and independent verification

- [x] 6.1 Run the full workspace gates and record what each proves and what it does
  not. Verify: `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`,
  `pnpm build`, `pnpm verify` all exit 0, with counts read from output rather than
  estimated.

  **Result: all six exit 0. `pnpm verify` exit 0, 24 files / 474 tests.** Counts read
  from `pnpm vitest run --reporter=basic` per file, not summed by hand: 54
  `packages/core`, 89 `packages/providers`, 149 `packages/mail-parser`, 94
  `packages/mailbox`, 57 `apps/web`, 31 boundary.
  **What these do not establish:** that any provider behaves as its adapter claims
  against the live service (every provider test replays a recording); that a real
  browser reaches Guerrilla Mail (every client test renders against a stub or a
  recording transport, and **no live browser run has ever been made**); or that a real
  provider tolerates a page polling it every five seconds (**never exercised**). And
  `pnpm test` is not a claim about types — **it was green at 469/469 while
  `pnpm typecheck` was red**, which is how this stage found the defect the apply stage
  had ticked past.

- [x] 6.2 Run a falsification pass with a harness kept **outside the repository**,
  aimed at every assertion this change added, including one mutation per positive
  control form. Verify: each mutation is observed to fail **with the intended test
  named**, not merely to turn the suite red, and every mutated file is restored
  byte-identical.

  **Result: 39 mutations, 35 caught on the first pass, 4 not caught, all 4 repaired and
  re-verified caught. Every file restored byte-identical — the harness compares a
  SHA-256 before and after each case and reports `RESTORE-MISMATCH` separately.** The
  four that slipped through, and what each one was:

  | Mutation | Why nothing caught it | Repair |
  | --- | --- | --- |
  | Compare a listing's **length** rather than its **identity** | The test's four listings were lengths 2, 3, 2, 2, so a length-only comparison reached the *same verdict* on all four — and passed holding the exact defect it was written for | Rewritten with every listing the same length and a different message in it, so the two comparisons disagree about the input |
  | Capture the mailbox in the scheduled callback instead of reading it at fire time | Not a test gap: **neither guard is load-bearing alone.** `reset` both cancels the pending schedule and clears the field, so removing either one alone leaves the other | The case now removes **both**, which is the only mutation that lists a discarded mailbox. The code comment was rewritten to say so rather than to credit a single mechanism that turned out not to be one |
  | Iterate the listener `Set` by reference | `Set` iteration is *defined* to tolerate removing the current entry, so the self-unsubscribe hazard the test used cannot arise. The real hazard is the opposite one: an entry **added** mid-loop is visited by that loop | Added a test where a listener subscribes another from inside a notification, asserting the newcomer is called exactly once. The first draft of that test subscribed from `subscribe`'s own delivery — which is not inside any loop — and so exercised nothing |
  | Drop `<InboxRows>` from the failure branch of `Inbox.tsx` | The package test covers the *session* keeping its messages; nothing covered the *view* rendering them beside the annotation | Added a view-level test driving a success then a failure and asserting both the annotation and the row are on screen |

- [x] 6.3 Perform an independent verification pass comparing the implementation
  against `specs/mailbox-session/spec.md` and `specs/website-client/spec.md` rather
  than against these boxes. Verify: every scenario is either covered by a test that
  genuinely exercises it or is **explicitly recorded as uncovered with its reason**. A
  scenario whose only coverage would pass with the behaviour removed is a vacuous
  scenario and must be fixed or reported, not counted.

  **Result: two criticals and five warnings, all repaired.** Recorded here because the
  shape of each is the point, not the fix:

  - **`pnpm typecheck` was red while the suite was green.** A `SpectreError` fixture in
    `Inbox.test.tsx` omitted `cause`, which `NETWORK_ERROR` requires. Vitest does not
    typecheck, so `pnpm test` passed at 469/469 and only the separate gate caught it —
    and tasks 5.7 and 6.1 were ticked while the aggregate gate was failing. This is
    the "a green run that inspects nothing" failure in the one direction nobody watches
    for.
  - **The `fetch` rule did not cover `packages/mailbox`.** It scanned the two packages
    that *could* plausibly want a transport, and slice 2 added a polling loop to a
    third — which is exactly the code whose temptation is `fetch`. `inbox.ts`'s own
    module comment claimed the rule "now covers these modules too". It did not. Rule
    extended, a positive control written **per fetch form** into that package, and the
    behavioural half extended to drive `checkInbox()` and one turn of the loop over a
    recording transport — which needed `recordingTransport` to be able to answer with a
    real mailbox, since a session that never opened has nothing to poll and would have
    passed for the wrong reason.
  - **Two delta clauses could not be predicted from the implementation.** The
    mailbox-session clause "the caller SHALL be able to state exactly what time it is at
    every step" assumed the `now()` D2 removed, and the website-client clause "no
    … provider rate SHALL be shown" contradicted the verbatim provider statement the
    other delta requires. Both were **amended**, with the reason recorded in the delta,
    rather than reinterpreted silently.
  - `windowMsOf`'s `seconds <= 0` guard was unexercised while the comment beside it
    still described `w=0` — a guard whose test had drifted to a neighbouring case. A
    fixture for `1; w=0` now exists.
  - `toFailure` duck-typed `cause.code` rather than using `isSpectreError`, which is
    what the rest of the package does. Harmless today and **not harmless tomorrow**:
    the client's `explain()` ends in `assertNever`, which throws while rendering, so an
    off-enum code would take the page down instead of showing a readable failure.
  - `providerFloorMs` deliberately surviving `reset()` existed only in a code comment.
    The direction matters — a window a provider stated while polling mailbox A still
    floors mailbox B — and it now has a test.
  - The failure branch rendered an empty `<ul>` beneath a heading saying the check
    failed, which reads as "the inbox is empty" to anyone scanning it.
  - The `.test.ts` exemptions were inconsistent: the parser-direction rule exempted
    only the extension-less form, so a future `apps/web/src/*.test.tsx` importing the
    parser would have been reported.
  - The storage rule's positive control wrote a probe and then read that one file
    directly, proving the pattern fires and proving nothing about whether the rule's
    file discovery would find it. It now goes through the same `scanPackageWithProbe`
    path as the other two controls.

  **Also repaired, unprompted by the verifier:** a plain `render` of the empty-list
  case had left the page with an empty list element; and the recorded provider answers
  needed for the new polling test were first written in `test-support.ts`, where the
  wire-format rule correctly caught them — `test-support.ts` is shipped source, not a
  test, so provider field names belong in the `.test.ts` that uses them.