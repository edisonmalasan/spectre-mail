# Tasks — message view

Ordering follows the dependency order: the shared layer before the client, because a
component that renders an opened message cannot be written before there is an opened
message to render.

Every task's **Verify:** clause is part of the task. Ticking the box without the
verification having been observed is the failure this repository keeps meeting.

---

## 1. The opened-message state

- [x] 1.1 Define `OpenedMessageState` in `packages/mailbox/src/state.ts`: `none`,
      `opening` (carrying the message id), `opened` (carrying an `OpenedMessage`), and
      `openFailed` (carrying the id and a `SessionFailure`), plus narrowing helpers
      matching the session's and inbox's. Verify: the four states are a discriminated
      union, so a caller cannot hold an id and a result that disagree, and a test asserts
      each helper narrows only its own kind.

- [x] 1.2 Define `OpenedMessage`: the listing fields, `readable: string`, and
      `VerificationCode[]` / `VerificationLink[]` from `@spectre-mail/core`. Verify:
      `pnpm typecheck` shows the type references no `@spectre-mail/mail-parser` type, so
      the parser-direction boundary rule stays at `["mailbox"]`; a test asserts the type
      has no field holding the body as received.

- [x] 1.3 Add `opened: OpenedMessageState` to `SessionState`'s `ready` variant.
      Verify: a mutation removing it from `ready` is caught by a test asserting a
      session that has opened a message reports it on its state.

- [x] 1.4 Add `openMessage(messageId: string): Promise<OpenedMessageState>` to the
      `MailboxSession` interface. Verify: an `InMemoryOpenedMessage`-free stub that
      lacks the member fails to typecheck, so the interface is genuinely required of an
      implementation rather than optional.

## 2. Retention, and the request it saves

- [x] 2.1 Retain the analysis produced by `determine()` in a new module
      `packages/mailbox/src/opened.ts`, keyed by message id. Verify: a test opens a
      message the inbox verdict pass already read and asserts the provider's
      `getMessage` **was not called again** — over a recording transport, with a
      **positive control first** that performs the same open for a message with no
      retained reading and asserts the transport did record a request, so a zero cannot
      be an inert assertion.

- [x] 2.2 Prune retention to the ids of the current listing on each successful check.
      Verify: a test drives three listings where a message leaves the third, then opens
      that message and asserts the provider **was** contacted — i.e. pruning is
      observable. A second test asserts the inbox's **verdict** for the departed message
      survives, since the verdict map is sticky and only the expensive part is shed.

- [x] 2.3 Discard retention in `reset()`. Verify: a test opens a message, replaces the
      mailbox, opens the same id on the new mailbox, and asserts nothing from the old
      mailbox is reported. This is the slice-2 id-scoping hazard and it is the reason
      `design.md` D1 puts ownership in the session.

- [x] 2.4 Attempt a fetch for a message with no retained reading, and analyse it.
      Verify: a test asserts the read goes through the provider **that owns the mailbox**
      and not another — a second configured provider's `getMessage` is asserted never to
      be called.

- [x] 2.5 Refuse an identifier absent from the current listing with
      `MESSAGE_NOT_FOUND` and no request. Verify: over a recording transport with a
      positive control, a test asserts the transport recorded **zero** requests for the
      unknown id while the control's known id did produce one.

- [x] 2.6 On a failed read, report `openFailed` with a normalized code and never an
      `opened` state. Verify: a mutation replacing `openFailed` with an `opened` carrying
      empty codes and links is caught. This is `design.md` D7 and the requirement calls it
      the one false claim that costs a user their code.

- [x] 2.7 Retry the read on a later request rather than refusing on a cached failure.
      Verify: a provider that fails once then succeeds, tested twice, reaches `opened` —
      and a mutation consulting the cached failure first is caught.

- [x] 2.8 Clear `opened` on mailbox replacement and publish the transition through
      `onChange` before the provider answers. Verify: a test asserts `opening` is
      observable before the read settles, not only after.

## 3. Boundary and network enforcement for the new path

- [x] 3.1 Extend the global-`fetch` rule's package list if needed and add a **positive
      control per fetch form** written into `packages/mailbox`. Verify: the control runs
      first and each form is observed to be caught. **This is the slice-2 lesson stated
      as a task:** slice 2 added a polling loop to this package and the rule did not
      follow, while `inbox.ts`'s own comment claimed it had.

- [x] 3.2 Assert the opened path adds no request of its own to what the provider makes.
      Verify: a recording transport, a positive control that performs the same operations
      directly through the real adapter, and then the session's own open — identical
      request counts and URLs. A control that did not itself issue requests proves
      nothing.

- [x] 3.3 Assert `apps/web` still imports no parser type, and that no client file
      reaches a markup escape hatch. Verify: a test reading an opened message whose body
      was markup confirms the rendered document contains that markup **as text** and that
      no element in the rendered output was created from it — a text assertion, not only a
      pattern scan, because a scan proves the absence of a spelling rather than the
      presence of a rendering.

- [x] 3.4 Assert every test file shipped is still collected. Verify: the existing
      collection assertion passes with the new files present; a deliberate glob narrowing
      reports the uncovered file rather than passing.

## 4. The client

- [x] 4.1 Make an inbox row openable by wrapping its content in a real `button`, so the
      control is reachable and operable by keyboard. Verify: a jsdom test asserts the
      control is a `button` with an accessible name, and that activating it opens the
      message.

- [x] 4.2 Add `MessageView` rendering sender, subject, arrival time, readable text,
      codes, and links. Verify: a test asserts each of the six is present.

- [x] 4.3 An empty sender or subject reads as said-to-be-empty, never blank. Verify: a
      message with both empty still renders both statements — this is the measured
      Guerrilla message from run `2026-10-01T18-08-41-251Z`.

- [x] 4.4 Render the readable text as text. Verify: a body containing markup and a
      `<script>` yields those characters in the document's text and **no** element
      carrying them.

- [x] 4.5 Show codes in the parser's rank order with one sentence saying they may be
      wrong, and **no** confidence number. Verify: two codes render in rank order; a
      mutation rendering `confidence` as a number is caught by a test asserting no
      decimal matching any candidate's confidence appears.

- [x] 4.6 Show links as text with the destination host visible, and not as anchors. Verify:
      the host appears; no `href` to the detected URL appears anywhere in the document.

- [x] 4.7 A message that could not be read says so, offers a retry, and never says it
      holds no code. Verify: three assertions — the wording is present, a retry control
      exists, and the page contains no "no code" claim.

- [x] 4.8 `opening` says it is being read and shows no empty message. Verify: a test
      holding the read open asserts the reading sentence is present and no opened-message
      region is rendered.

- [x] 4.9 A return control goes back to the list, and the inbox remains reachable while a
      message is open. Verify: activating it removes the message view and restores the
      rows.

- [x] 4.10 Update `App.tsx`'s limits list, which currently says the page **cannot** open a
      message — a statement this slice makes false. Verify: a test asserting the list
      contains no claim that the page cannot open a message, so the line cannot be left
      stale by a future change.

## 5. Falsification, and what this slice has not established

- [x] 5.1 Run a falsification pass with the harness **outside the repository**, one
      mutation per positive-control form, aimed at every assertion this change adds.
      Verify: each mutation fails **with the intended test named**, not merely turning the
      suite red, and every mutated file is restored byte-identical — compared by hash
      before and after, reported separately.

- [x] 5.2 Specifically try to defeat the zero-request assertion: a retained-message open
      that fetches anyway, and a control that issues no request. Verify: both mutations
      are caught, or the assertion is rewritten.

- [x] 5.3 Specifically try to defeat the pruning assertion: retention that never sheds,
      and pruning that sheds the verdict too. Verify: both caught.

- [x] 5.4 Specifically try to defeat the `openFailed` distinction: an unreadable message
      rendered as opened-and-empty. Verify: caught.

- [x] 5.5 Perform an independent verification pass against this change's two deltas
      rather than against these boxes. Verify: every scenario is covered by a test that
      genuinely exercises it, or is **explicitly recorded as uncovered with its reason**.
      A scenario whose coverage would pass with the behaviour removed is vacuous and must
      be fixed or reported, not counted.

- [x] 5.6 Record what is still not established, in every document touched, in each
      document's own words: the cadence has never run against a live provider; **no live
      browser run of the website has ever been made**, so a component added here has
      never been seen by anything but jsdom; every provider test replays a recording; and
      `pnpm test` is not a claim about types.

## 6. Gates and lifecycle

- [x] 6.1 Run every workspace gate and read the counts from output. Verify: `pnpm
      typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm build`, and
      `pnpm verify` all exit 0, with per-file counts from `--reporter=basic` rather than
      summed by hand.

- [x] 6.2 Amend this change's artifacts if verification finds the implementation and the
      deltas disagree — in the delta, with the reason recorded. Verify: an amendment
      states what changed and why, and no clause is reinterpreted silently.

- [x] 6.3 Sync the delta into `openspec/specs/` and check the merge **mechanically**,
      with a script kept outside the repository. Verify: every requirement and scenario
      title in the delta is present in the promoted spec.

- [x] 6.4 Archive with `--skip-specs` when the sync already promoted, and check the
      command's effect rather than assuming it. Verify: both promoted specs are
      hash-identical before and after, `openspec validate --specs --strict` holds, and
      the archived files are renames with zero content change.

---

# Verification ledger

What each box above rests on, and where the observation came from. Every entry names a
mutation that was **observed to fail with this test named**, or a gate output that was
read. A box with no entry here is a box that was ticked on trust, which is the thing
these tasks exist to prevent.

Three harnesses, all outside the repository, all run against the code as it stands now:

| round | what it covers | mutations | matched |
|-------|----------------|-----------|---------|
| 1 | the slice's own behaviour, one per positive-control form | 22 | 22 |
| 2 | the task `Verify:` clauses that name an assertion | 7 | 7 |
| 3 | **the repairs made after the independent verification pass** | 11 | 11 |

**40 mutations, 40 matched, 0 unmatched, 0 files left changed.** Both rounds that carry a
no-op control (round 2's `B9`, round 3's `B20`) reported the suite green, so a
"NOT CAUGHT" verdict from either harness means the mutation was harmless rather than
something else having broken.

Restoration is reported separately from the results and compared by SHA-256 before and
after, never asserted.

## Group 1 — the opened-message state

| task | observation |
|------|-------------|
| 1.1 | `B1` widened each narrowing helper to claim a second kind; caught by *"Each narrowing helper claims only its own kind"*. |
| 1.2 | `A7` added a field to `OpenedMessage` holding the body as received; caught by *"No field carries the body as received"*. `pnpm typecheck` is clean with the parser-direction rule at `["mailbox"]`. |
| 1.3 | `B21` rewrote `withOpened`'s ready branch to report `{ kind: "none" }`; caught by *"opens a message the inbox already read, without a second read"* (4 tests failed). |
| 1.4 | `B19` made the member optional and `pnpm typecheck` reported `src/session.test.ts(58,5): error TS2578: Unused '@ts-expect-error' directive`, observed directly, plus two further errors at the call site. |

## Group 2 — retention, and the request it saves

| task | observation |
|------|-------------|
| 2.1 | `A1` made a retained open fetch anyway; caught by *"A message already read is not read again"* (7 failed). The positive control performs the same open for a message with no retained reading and asserts the transport recorded a request, so the zero is not inert. |
| 2.2 | `A2` stopped retention shedding; caught by *"The retention is pruned to the current listing"* (3 failed). `A13` made pruning shed the verdict too; caught by *"The inbox's verdict for a departed message survives"* (6 failed). |
| 2.3 | `A11` left the opened message standing across a replacement; caught by *"The opened message is cleared when the mailbox is replaced"* (2 failed). |
| 2.4 | `A6` routed the read to the other configured provider; caught by *"Reading goes through the provider that owns the mailbox"* (17 failed). |
| 2.5 | `A3` removed the local refusal so the unknown id was sent; caught by *"An identifier the listing does not contain is refused locally"* (4 failed), against a control whose known id did produce a request. |
| 2.6 | `A4` published `openFailed` as `opened` with empty codes and links; caught by *"A message that cannot be read is not an empty message"* (3 failed). |
| 2.7 | `A5` consulted the cached failure first; caught by *"A message was unreadable and is then readable"* (1 failed). |
| 2.8 | `B15` removed the `opening` publish entirely and `A8` made an in-flight read publish after the session was discarded; both caught. `B14` restored a double notification and was caught by *"reports that a message is being opened, before the provider answers"*. `A9`/`A10` cover `reset()` publishing the change it makes, and only when the reported state changes. |

## Group 3 — boundary and network enforcement

| task | observation |
|------|-------------|
| 3.1 | `B22` dropped `"mailbox"` from `NETWORK_FORBIDDEN_PACKAGES`; caught by *"catches a bare fetch call introduced into the mailbox session layer too"* (1 failed). |
| 3.2 | `B23` made the open path issue one extra provider request; caught by *"adds no request of its own to what the provider makes while opening"* (12 failed). The control issues 7 requests — 1 create, 3 listings, 3 reads, of which 3 are `fetch_email` — so a zero here cannot be an inert assertion. |
| 3.3 | `A20a` proved the readable text reaches the document (5 failed); `A20b` proved it never reaches a markup escape hatch (2 failed), over a body that is markup and a `<script>`. |
| 3.4 | `B8` narrowed a collection glob; caught by *"A narrowed collection glob reports the uncovered file"* (1 failed). |

## Group 4 — the client

| task | observation |
|------|-------------|
| 4.1 | `A21` unwrapped the row from its button; caught by *"An inbox row is a real button with an accessible name"* (1 failed). |
| 4.2 | `B4` removed one of the six; caught by *"The view shows sender, subject, arrival, text, codes, and links"* (1 failed). |
| 4.3 | `A19` removed the said-to-be-empty wording; caught by *"An empty sender or subject reads as said-to-be-empty"* (1 failed). |
| 4.4 | `A20b`, as above. |
| 4.5 | `B5` reversed the rank order; caught by *"Codes render in the parser's rank order"*. `B17` rendered a link's own confidence; caught by *"says the readings may be wrong, and shows no confidence number"*. |
| 4.6 | `A15` rendered a detected link as an anchor; caught by *"A detected link is shown as text and not followed"* (2 failed). |
| 4.7 | `A17` asserted no "no code" claim and `A18` removed the retry control; both caught. |
| 4.8 | `A16` made `opening` render an empty message; caught by *"`opening` shows no empty message"* (1 failed). |
| 4.9 | `B6` broke the return control; caught by *"A return control goes back to the inbox"* (1 failed). |
| 4.10 | `B7` restored the stale "cannot open a message" line; caught by *"The limits list carries no claim this slice made false"* (1 failed). |

## Group 6 — gates

`pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm build`, and
`pnpm verify` all exited `0` on 2026-10-03.

**537 tests across 26 files**, measured — not summed by hand:

| scope | files | tests |
|-------|-------|-------|
| `packages/core` | 6 | 54 |
| `packages/providers` | 6 | 89 |
| `packages/mail-parser` | 5 | 149 |
| `packages/mailbox` | 4 | 134 |
| `apps/web` | 4 | 74 |
| `tests/architecture` | 1 | 37 |

Totals were read from `pnpm test --reporter=basic`; the per-file split came from
`--reporter=json`. `basic` prints no per-file counts, so this is a deviation in the
clause's letter and not in its intent — both are output, neither is a hand sum.

`pnpm build` builds the website **only**. Shared packages are consumed as TypeScript
source, so a green build is not a claim about them; `pnpm typecheck` is that gate, and it
is a different fact from the tests passing.

---

# Sync and archive

Two stages after the apply, each on its own branch with its own merge commit:
`docs/message-view-spec-sync` (#39) and `chore/archive-message-view` (#40). Every
observation below was read from command output or from a hash. None of them is an inference
from a command exiting `0`.

## The sync

Ten requirements and twenty-six scenarios promoted across two capabilities, every one
`ADDED`, so nothing was modified, removed, or renamed and no existing clause needed
preserving. Checked **mechanically** with a script kept outside the repository, because "a
manual merge is exactly where a scenario quietly disappears": **6/6 requirement titles and
16/16 scenario titles** present in `mailbox-session`, **4/4 and 10/10** in `website-client`.

**The existing provenance footers were recounted before being extended, not repeated on
trust.** This repository has published three arithmetically-wrong counts, one of them in a
promoted spec's own provenance line. Both verify exactly — slice 1 at 7 requirements / 14
scenarios and slice 2 at 7 / 18 for `mailbox-session`; 7 / 15 and 5 / 12 for
`website-client`. Slice 3 adds 6 / 16 and 4 / 10, for **20 requirements and 48 scenarios** and
**16 requirements and 37 scenarios**.

Three things the merge got wrong or could have got wrong, each caught by a guard rather than
by reading:

- The first provenance needle **did not match** — the needle carried quotes around a quoted
  phrase the file does not quote. The guard fired **before the first write**. An earlier draft
  validated inside the write loop, which would have left `mailbox-session` half-merged the
  moment `website-client`'s needle failed; the script was changed to check every needle
  against every file before writing any file.
- The tool appends, so a second run would have **silently duplicated all ten requirements**.
  It now refuses when a requirement is already promoted, and that refusal was **observed**,
  with both files byte-identical by SHA-256 afterwards. A tool that cannot tell whether its
  own work is already present reports success without evidence.
- Both promoted specs validate strict, `openspec validate --specs --strict` holds at **8
  passed, 0 failed**, and the change still validates at exit `0` — now reporting `ADDED
  failed … already exists` for two headers, which is the expected sync-then-archive window
  that `--skip-specs` exists for.

## The archive

`openspec archive message-view --skip-specs --yes`, required because the sync stage had
already promoted the delta: applying it again would double every requirement it carries.
The command's effect was checked rather than assumed, on three counts that an exit code
cannot show:

- **Both promoted specs are hash-identical before and after.** `mailbox-session/spec.md` at
  `F7843D6F…DE27E7D` and `website-client/spec.md` at `41F52950…CA629F9`, unchanged across the
  command. This is the direct evidence that `--skip-specs` applied nothing a second time.
- **The archived files are renames with zero content change.** The archived
  `specs/mailbox-session/spec.md` hashes `94683DBE…2103CC197` and
  `specs/website-client/spec.md` hashes `54EBACCF…71AB59C`, identical to the two active
  deltas hashed **before** the command ran.
- `openspec status` reports **No active changes** afterwards, which is the correct end state
  for a completed milestone.

**The first archive run reported `Task status: 35/36` and warned about one incomplete task**,
because 6.4 was still unticked at the moment it ran — so the archive froze a ledger that was
not yet true, and the command's own warning was the only thing that said so. The archive
directory was removed, 6.4 was ticked against the observations above, and the command re-run,
so the archived copy records **36/36** instead of a shortfall that no longer exists. Recorded
because the correction involves deleting a directory the tool had just written: it had never
been committed or pushed, and no promoted spec was touched at any point.

---

# What the verification pass found, and what happened to each finding

The pass read the two deltas rather than these boxes. It returned 13 numbered findings
and 4 notes. Dispositions, all of them applied before this ledger was written:

**Fixed, with the fix itself falsified.**

- **C-1** — the confidence assertion scanned only the codes region, so a link's
  `confidence` rendered as a number would have passed. Widened to the codes region, the
  links region, and the whole opened region minus the timestamp, with a `BOTH_BODY`
  fixture and a positive control per region. Falsified by `B17`.
- **C-2** — *"reports that a message is being opened, before the provider answers"* was
  verified one layer too low, on the tracker rather than on the session. A session-level
  test was added, and **it immediately found a real defect**: the opened tracker's
  `onChange` wrapped `withOpened` in a *second* `setState`, so every subscriber was told
  the same thing **twice** on every opened-state change. A React client re-rendered per
  notification. Fixed; falsified by `B14`.
- **C-3** — the listing-failure test's comments described a sequence its fixture never
  produced: `listFailsWith` takes precedence over `listings` and its queue's last entry
  repeats, so `listings: [[a], []]` meant listing one succeeded and listings two **and
  three** both failed. The second entry was never served. Worse, **nothing asserted that
  the listing failed**, so deleting `listFailsWith` outright left the test green: a second
  listing serving `[a]` prunes to `[a]` and sheds nothing either way. The test could not
  tell the rule it names from the rule that shares its fixture. Premise now asserted;
  falsified by `B16`.
- **C-4** — the "acts on a finding" boundary rule was narrower than its rule in two ways.
  `navigator.clipboard.write([new ClipboardItem(...)])` — the standard API for anything
  that is not plain text — matched neither `writeText` nor `execCommand`, so the whole
  family was invisible. And `\bcode` cannot match `otpCode`, `foundCode`, or
  `verificationCode`, because those have no word boundary before the `C`: the pattern
  answered `false` on exactly the names a developer would most plausibly use. Widened to
  three call families and a suffix-tolerant alternation, with three new controls and the
  stated limits kept: an identifier spelled `secret` or `digits` is still not caught, and
  neither is a `select()` followed by the user pressing Ctrl+C, which reaches no clipboard
  API and is indistinguishable from selecting the mailbox address. Falsified by `B18`.
- **C-6** — `MessageView` took a `messageId` prop and rendered a hidden
  `message-open-id` span, while its own comment promised a test that did not exist. Both
  deleted; the id is now read inside `App.tsx`'s `onRetry` closure, which is the only
  place it is needed.
- **C-7** — the `withOpened` comment claimed every non-failed state carries `opened`, with
  a reader entitled to take that as being about the notification too. It reaches the
  `failed` branch through `setState`, so a subscriber is notified with an identical
  value. The comment now says so, and says why that branch is kept.
- **C-8** — a duplicated 13-line doc block in `boundaries.test.ts`. Removed.
- **C-9** — the 60s boundary-scan budget papers over contention rather than fixing it.
  **Accepted, with the reason written down.** The verification pass measured the *same*
  suite at 8.6s in one run and 37s in another, minutes apart, so the variance is real and
  not a one-off. Both measurements are now in the comment.

**Surfaced rather than absorbed.**

- **C-10** — `new Date(receivedAt).toISOString()` throws a `RangeError` on a non-finite
  `receivedAt`. This is **not this slice's**: it arrived with slice 2 and the honest home
  for it is `packages/core`, which owns the field. Fixing it here would widen the change
  past its scope, and leaving it unrecorded would be worse. Recorded, not absorbed.

**Noted, deliberately not acted on.**

- **C-11** — `isMessageOpening` and `openedOf` are exported and used only by tests. Mild
  speculative surface, kept because `state.ts`'s own documentation promises narrowing
  helpers for every variant and breaking that promise would be the larger inconsistency.
- **C-13** — `withInbox`'s `creating` branch correctly drops `inbox`. No change.
- **D1, items 1–3** — the `none` branch's markup, the always-rendered close control, and
  the links caveat prose. Each is defensible on its own terms and changing them would be
  cosmetic churn inside a repair pass.

# Defects found by the harness, as distinct from check defects

Two of the four things the harness surfaced were **defects in the implementation**, not
gaps in a test, and both are fixed:

1. **The double notification** above, found because C-2's new session-level test read its
   transition log synchronously and saw `["opening", "opening"]`.
2. **`B2` originally reported NOT CAUGHT**, and that turned out to be a real gap: nothing
   asserted that an open message survives a poll tick. It is now asserted by *"keeps a
   message open across a later inbox check"*. The test's own comment was then corrected
   as well, because the first version described the wrong mechanism — see below.

# The check defects, and what they cost

This repository has now recorded **seven** instances of a check narrower or looser than
the rule it documents, plus one new category:

- **Aimed at a line rather than at a requirement** — `B2` was aimed at `withInbox`, on the
  reasoning that it is the function publishing `opened`. It is not: `open()` calls it
  twice and **the poller never calls it at all**. The path that can actually drop an open
  message is the spread inside the inbox tracker's `onChange`, which is right only because
  it spreads `state` instead of rebuilding the object. The mutation was moved there and is
  caught. The test's comment had recorded the wrong mechanism and was corrected to name
  both paths.
- **Passing for the wrong reason** — the listing-failure test above, a category this
  repository had not recorded before. Its premise was never asserted, so it could not
  distinguish the rule it names from a neighbour sharing its fixture.
- **A control that cannot report its own failure** — the per-form controls for the
  clipboard and link rules were loops of `expect(...).not.toEqual([])`, which stop at the
  first failure. A rule broken in three ways produced one name and proved nothing about
  the other two. Both now gather every missed form and assert the set empty; reverting the
  widened rule turns all three new forms red **at once**, which is the observation the
  controls now carry.
- **`B3` was an invalid check.** It deleted the interface member and ran `tsc`, looking for
  the member's name in the output. `tsc` reported **zero** errors — removing a member from
  an interface cannot break the class that still implements it — and the name was found in
  the implementation instead. Replaced by `B19`'s bidirectional `@ts-expect-error`, whose
  control makes the member optional and requires `tsc` to report the directive going
  unused. `pnpm test` cannot see that assertion at all, which is exactly why the clause
  named `tsc`.
- **`B9` was inconclusive, and the reason was a flake.** Its no-op mutation reported
  "1 failed", which sent the search after a mutation that had done nothing. The cause was
  a **pre-existing** `apps/web` timeout, reproduced in 2 of 8 full runs. Fixed with a
  scoped, documented `JSDOM_SUITE_TIMEOUT_MS` helper, proven to apply by a 1ms control;
  `vitest.config.ts` was left alone so `packages/mailbox` is still not handed a DOM.

`pnpm test` is not a claim about types, and this slice is the second time that has bitten
in both directions. A hand-written `SessionFailure` carrying a `provider` field — the real
type carries `providerFailures`, a list — left the suite green and failed `pnpm typecheck`.
