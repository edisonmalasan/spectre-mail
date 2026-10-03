# Tasks — message view

Ordering follows the dependency order: the shared layer before the client, because a
component that renders an opened message cannot be written before there is an opened
message to render.

Every task's **Verify:** clause is part of the task. Ticking the box without the
verification having been observed is the failure this repository keeps meeting.

---

## 1. The opened-message state

- [ ] 1.1 Define `OpenedMessageState` in `packages/mailbox/src/state.ts`: `none`,
      `opening` (carrying the message id), `opened` (carrying an `OpenedMessage`), and
      `openFailed` (carrying the id and a `SessionFailure`), plus narrowing helpers
      matching the session's and inbox's. Verify: the four states are a discriminated
      union, so a caller cannot hold an id and a result that disagree, and a test asserts
      each helper narrows only its own kind.

- [ ] 1.2 Define `OpenedMessage`: the listing fields, `readable: string`, and
      `VerificationCode[]` / `VerificationLink[]` from `@spectre-mail/core`. Verify:
      `pnpm typecheck` shows the type references no `@spectre-mail/mail-parser` type, so
      the parser-direction boundary rule stays at `["mailbox"]`; a test asserts the type
      has no field holding the body as received.

- [ ] 1.3 Add `opened: OpenedMessageState` to `SessionState`'s `ready` variant.
      Verify: a mutation removing it from `ready` is caught by a test asserting a
      session that has opened a message reports it on its state.

- [ ] 1.4 Add `openMessage(messageId: string): Promise<OpenedMessageState>` to the
      `MailboxSession` interface. Verify: an `InMemoryOpenedMessage`-free stub that
      lacks the member fails to typecheck, so the interface is genuinely required of an
      implementation rather than optional.

## 2. Retention, and the request it saves

- [ ] 2.1 Retain the analysis produced by `determine()` in a new module
      `packages/mailbox/src/opened.ts`, keyed by message id. Verify: a test opens a
      message the inbox verdict pass already read and asserts the provider's
      `getMessage` **was not called again** — over a recording transport, with a
      **positive control first** that performs the same open for a message with no
      retained reading and asserts the transport did record a request, so a zero cannot
      be an inert assertion.

- [ ] 2.2 Prune retention to the ids of the current listing on each successful check.
      Verify: a test drives three listings where a message leaves the third, then opens
      that message and asserts the provider **was** contacted — i.e. pruning is
      observable. A second test asserts the inbox's **verdict** for the departed message
      survives, since the verdict map is sticky and only the expensive part is shed.

- [ ] 2.3 Discard retention in `reset()`. Verify: a test opens a message, replaces the
      mailbox, opens the same id on the new mailbox, and asserts nothing from the old
      mailbox is reported. This is the slice-2 id-scoping hazard and it is the reason
      `design.md` D1 puts ownership in the session.

- [ ] 2.4 Attempt a fetch for a message with no retained reading, and analyse it.
      Verify: a test asserts the read goes through the provider **that owns the mailbox**
      and not another — a second configured provider's `getMessage` is asserted never to
      be called.

- [ ] 2.5 Refuse an identifier absent from the current listing with
      `MESSAGE_NOT_FOUND` and no request. Verify: over a recording transport with a
      positive control, a test asserts the transport recorded **zero** requests for the
      unknown id while the control's known id did produce one.

- [ ] 2.6 On a failed read, report `openFailed` with a normalized code and never an
      `opened` state. Verify: a mutation replacing `openFailed` with an `opened` carrying
      empty codes and links is caught. This is `design.md` D7 and the requirement calls it
      the one false claim that costs a user their code.

- [ ] 2.7 Retry the read on a later request rather than refusing on a cached failure.
      Verify: a provider that fails once then succeeds, tested twice, reaches `opened` —
      and a mutation consulting the cached failure first is caught.

- [ ] 2.8 Clear `opened` on mailbox replacement and publish the transition through
      `onChange` before the provider answers. Verify: a test asserts `opening` is
      observable before the read settles, not only after.

## 3. Boundary and network enforcement for the new path

- [ ] 3.1 Extend the global-`fetch` rule's package list if needed and add a **positive
      control per fetch form** written into `packages/mailbox`. Verify: the control runs
      first and each form is observed to be caught. **This is the slice-2 lesson stated
      as a task:** slice 2 added a polling loop to this package and the rule did not
      follow, while `inbox.ts`'s own comment claimed it had.

- [ ] 3.2 Assert the opened path adds no request of its own to what the provider makes.
      Verify: a recording transport, a positive control that performs the same operations
      directly through the real adapter, and then the session's own open — identical
      request counts and URLs. A control that did not itself issue requests proves
      nothing.

- [ ] 3.3 Assert `apps/web` still imports no parser type, and that no client file
      reaches a markup escape hatch. Verify: a test reading an opened message whose body
      was markup confirms the rendered document contains that markup **as text** and that
      no element in the rendered output was created from it — a text assertion, not only a
      pattern scan, because a scan proves the absence of a spelling rather than the
      presence of a rendering.

- [ ] 3.4 Assert every test file shipped is still collected. Verify: the existing
      collection assertion passes with the new files present; a deliberate glob narrowing
      reports the uncovered file rather than passing.

## 4. The client

- [ ] 4.1 Make an inbox row openable by wrapping its content in a real `button`, so the
      control is reachable and operable by keyboard. Verify: a jsdom test asserts the
      control is a `button` with an accessible name, and that activating it opens the
      message.

- [ ] 4.2 Add `MessageView` rendering sender, subject, arrival time, readable text,
      codes, and links. Verify: a test asserts each of the six is present.

- [ ] 4.3 An empty sender or subject reads as said-to-be-empty, never blank. Verify: a
      message with both empty still renders both statements — this is the measured
      Guerrilla message from run `2026-10-01T18-08-41-251Z`.

- [ ] 4.4 Render the readable text as text. Verify: a body containing markup and a
      `<script>` yields those characters in the document's text and **no** element
      carrying them.

- [ ] 4.5 Show codes in the parser's rank order with one sentence saying they may be
      wrong, and **no** confidence number. Verify: two codes render in rank order; a
      mutation rendering `confidence` as a number is caught by a test asserting no
      decimal matching any candidate's confidence appears.

- [ ] 4.6 Show links as text with the destination host visible, and not as anchors. Verify:
      the host appears; no `href` to the detected URL appears anywhere in the document.

- [ ] 4.7 A message that could not be read says so, offers a retry, and never says it
      holds no code. Verify: three assertions — the wording is present, a retry control
      exists, and the page contains no "no code" claim.

- [ ] 4.8 `opening` says it is being read and shows no empty message. Verify: a test
      holding the read open asserts the reading sentence is present and no opened-message
      region is rendered.

- [ ] 4.9 A return control goes back to the list, and the inbox remains reachable while a
      message is open. Verify: activating it removes the message view and restores the
      rows.

- [ ] 4.10 Update `App.tsx`'s limits list, which currently says the page **cannot** open a
      message — a statement this slice makes false. Verify: a test asserting the list
      contains no claim that the page cannot open a message, so the line cannot be left
      stale by a future change.

## 5. Falsification, and what this slice has not established

- [ ] 5.1 Run a falsification pass with the harness **outside the repository**, one
      mutation per positive-control form, aimed at every assertion this change adds.
      Verify: each mutation fails **with the intended test named**, not merely turning the
      suite red, and every mutated file is restored byte-identical — compared by hash
      before and after, reported separately.

- [ ] 5.2 Specifically try to defeat the zero-request assertion: a retained-message open
      that fetches anyway, and a control that issues no request. Verify: both mutations
      are caught, or the assertion is rewritten.

- [ ] 5.3 Specifically try to defeat the pruning assertion: retention that never sheds,
      and pruning that sheds the verdict too. Verify: both caught.

- [ ] 5.4 Specifically try to defeat the `openFailed` distinction: an unreadable message
      rendered as opened-and-empty. Verify: caught.

- [ ] 5.5 Perform an independent verification pass against this change's two deltas
      rather than against these boxes. Verify: every scenario is covered by a test that
      genuinely exercises it, or is **explicitly recorded as uncovered with its reason**.
      A scenario whose coverage would pass with the behaviour removed is vacuous and must
      be fixed or reported, not counted.

- [ ] 5.6 Record what is still not established, in every document touched, in each
      document's own words: the cadence has never run against a live provider; **no live
      browser run of the website has ever been made**, so a component added here has
      never been seen by anything but jsdom; every provider test replays a recording; and
      `pnpm test` is not a claim about types.

## 6. Gates and lifecycle

- [ ] 6.1 Run every workspace gate and read the counts from output. Verify: `pnpm
      typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm build`, and
      `pnpm verify` all exit 0, with per-file counts from `--reporter=basic` rather than
      summed by hand.

- [ ] 6.2 Amend this change's artifacts if verification finds the implementation and the
      deltas disagree — in the delta, with the reason recorded. Verify: an amendment
      states what changed and why, and no clause is reinterpreted silently.

- [ ] 6.3 Sync the delta into `openspec/specs/` and check the merge **mechanically**,
      with a script kept outside the repository. Verify: every requirement and scenario
      title in the delta is present in the promoted spec.

- [ ] 6.4 Archive with `--skip-specs` when the sync already promoted, and check the
      command's effect rather than assuming it. Verify: both promoted specs are
      hash-identical before and after, `openspec validate --specs --strict` holds, and
      the archived files are renames with zero content change.