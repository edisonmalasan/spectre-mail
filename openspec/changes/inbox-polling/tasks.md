# Tasks

## 1. The cadence calculation

- [ ] 1.1 Add `packages/mailbox/src/cadence.ts` exporting a pure `nextDelay` over a
  count of consecutive unchanged checks: 5000ms at zero, doubling per unchanged
  check, never above 30000ms. Verify: a table test asserts the full sequence from
  zero through the first capped value and that further unchanged checks hold the
  cap, plus a case asserting the returned value is always an integer no greater than
  the cap.

- [ ] 1.2 State the intervals as named exported constants with a comment recording
  that **no provider limit was measured** for the provider this client reaches, that
  Mail.tm's `30; w=60` was measured unauthenticated only, and that these are the
  product's own numbers. Verify: a test reads the exported values and asserts the
  cap is at or above the prompt interval, and that neither is zero — a cadence of
  zero would be a busy loop that no assertion would catch.

## 2. The clock seam and the poller

- [ ] 2.1 Add a `MailboxClock` type to `packages/mailbox`: `now(): number` and
  `schedule(afterMs, run): Cancel`, with a `Cancel` that is callable. No other time
  API. Verify: a test builds a session over a hand-written clock and asserts a
  scheduled callback does not run until the test advances time — which fails
  immediately if the implementation reaches for a real timer instead.

- [ ] 2.2 Add `destroy()` to `MailboxSession`, cancelling any pending schedule and
  leaving the session readable. Verify: a test schedules a check, destroys, advances
  the clock, and asserts the callback never ran and that `current()` still returns
  the same state.

- [ ] 2.3 Implement polling: schedule the next check at `max(nextDelay(...), any
  declared provider delay)`, and **never schedule sooner** than a declared delay.
  Verify: a test with a provider that declares a delay asserts the next interval is
  never below it across several cadence steps, and a second asserts the cadence still
  governs when no delay is declared.

- [ ] 2.4 Surface a throttled listing as a failure and do not reschedule it
  automatically. Verify: a stub provider rejecting with the throttled code is driven
  twice; the second listing does not occur until the test asks for one, and the
  failure appears in the inbox rather than replacing the session state.

- [ ] 2.5 Report a declared rate limit **verbatim** and derive nothing from it.
  Verify: a test asserts a stub's `rateLimit` string reaches the inbox unchanged,
  plus a negative case asserting no substring of it is re-parsed into a number the
  session reports.

- [ ] 2.6 Stop polling while the caller reports nothing is displaying the inbox, and
  check promptly when it returns. Verify: a test reporting hidden asserts **zero**
  listing requests while the clock advances far past the cap, then reports visible
  and asserts a listing occurs without further advancing.

## 3. The inbox state and the once-per-message analysis

- [ ] 3.1 Add an `InboxState` discriminated union in `packages/mailbox/src/state.ts`
  carrying the messages, whether a check is in progress, a check failure, and the
  per-message verdict map. Extend `SessionState`'s `ready` variant to carry it, and
  add narrowing helpers. Verify: a test asserts each variant's `kind` and that **no
  variant carries a field belonging to another** — the exact check that was missing
  for `failed` in slice 1 and that its verification pass had to add.

- [ ] 3.2 Depend on `@spectre-mail/mail-parser` from `packages/mailbox` and call
  `analyse` on each message's text, once, keyed by message id. Verify: `pnpm install`
  succeeds, the package appears in the workspace, and
  `pnpm --filter @spectre-mail/mailbox typecheck` exits 0.

- [ ] 3.3 Report a message that could not be read as **undetermined**, never as
  carrying nothing. Verify: a stub whose `getMessage` rejects produces a row whose
  verdict is undetermined, and a test asserts no code-or-link claim is made for it.

- [ ] 3.4 Never re-read a message already determined, including across a listing that
  drops and re-adds it. Verify: a counting stub is driven through three listings
  containing the same id and the read count for that id is exactly 1, and a fourth
  listing adding one new id raises it to exactly 2.

- [ ] 3.5 Replace the mailbox when the session replaces it, with no request made on
  the previous mailbox's behalf and none of its verdicts carried over. Verify: a test
  records every request, replaces the mailbox, advances the clock, and asserts no URL
  carries the first mailbox's session and that the verdict map is empty.

## 4. The boundary rules this slice's architecture depends on

- [ ] 4.1 Add a scan asserting no module in `packages/mailbox` reaches a clock or
  timer global, with a **positive control per spelling** (`Date.now`, `new Date`,
  `setTimeout`, `setInterval`, `performance.now`) and one negative control. Verify:
  the control drives a temporary module containing each spelling and asserts the rule
  catches it — a single control would prove only the form its author thought of,
  which is the sixteenth recorded instance of that failure in this repository.

- [ ] 4.2 Extend the adapter-confinement and wire-format rules' file set to include
  the new modules, and add a rule that `packages/mail-parser` is imported only by
  `packages/mailbox`. Verify: each rule gets a positive control, and the negative
  control for the parser direction is a client importing the parser directly, which
  the rule must catch.

- [ ] 4.3 Assert `packages/mailbox`'s `tsconfig` still omits `DOM` **and** assert at
  runtime that `window` and `document` are absent from the globals, read
  reflectively — `globalThis.document` does not compile there, which is the
  enforcement, and a runtime claim needs a runtime check. Verify: the assertion
  fails if a `window` global is installed, and reads via `Reflect.get`.

## 5. The website's inbox

- [ ] 5.1 Add `WEBSITE_INBOX_VISIBLE`-style visibility reporting to `apps/web`, wired
  to the document's visibility state and **not** to any storage or URL API. Verify: a
  jsdom test fires a `visibilitychange` and asserts the session is told.

- [ ] 5.2 Add an `Inbox` component rendering one row per message with sender,
  subject, time, and unread state. A message with an empty subject or sender still
  renders a row. Verify: jsdom tests render a mixed list and assert every message
  appears, that the empty-subject row is present and not blank, and that each row
  names its own sender.

- [ ] 5.3 Distinguish the three inbox states as distinct labelled content: checking,
  empty, and populated. Verify: a test per state asserting the specific string, and a
  mutual-exclusion assertion **naming the strings themselves** — the vacuous form of
  that assertion was one of slice 1's two real findings.

- [ ] 5.4 Render the verification marking from the session's verdict map, never from
  a fresh parse, and render undetermined as undetermined. Verify: a test asserts the
  marking is not conveyed by colour alone — it is text present in the row — and a
  mutation that marks an undetermined message as carrying nothing is caught.

- [ ] 5.5 Render a failed check as an annotation with the address still present,
  selectable, and copyable. Verify: a jsdom test drives a failing listing and asserts
  the address is still in the document, still selectable, and that the explanation is
  shown — plus a test that a later success clears the annotation.

- [ ] 5.6 Assert the website displays no interval, countdown, or provider rate
  anywhere in the inbox. Verify: a test asserts none of the interval constants'
  string forms appear, and a mutation inserting one is caught. This is the check that
  would catch the product inventing a number, which is the specific failure mode
  `provider-abstraction` warns about.

- [ ] 5.7 Add the slice's counts and the honest limits to `docs/ARCHITECTURE.md`,
  `docs/ROADMAP.md`, `README.md`, and `AGENTS.md`, recording that the cadence has
  never been exercised against a live provider and that no live browser run exists.
  Verify: `pnpm verify` exits 0 and every stated count matches `pnpm vitest run`
  output.

## 6. Integration and independent verification

- [ ] 6.1 Run the full workspace gates and record what each proves and what it does
  not. Verify: `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`,
  `pnpm build`, `pnpm verify` all exit 0, with counts read from output rather than
  estimated.

- [ ] 6.2 Run a falsification pass with a harness kept **outside the repository**,
  aimed at every assertion this change added, including one mutation per positive
  control form. Verify: each mutation is observed to fail **with the intended test
  named**, not merely to turn the suite red, and every mutated file is restored
  byte-identical.

- [ ] 6.3 Perform an independent verification pass comparing the implementation
  against `specs/mailbox-session/spec.md` and `specs/website-client/spec.md` rather
  than against these boxes. Verify: every scenario is either covered by a test that
  genuinely exercises it or is **explicitly recorded as uncovered with its reason**. A
  scenario whose only coverage would pass with the behaviour removed is a vacuous
  scenario and must be fixed or reported, not counted.