# Tasks

## 1. Measurement before implementation

- [x] 1.1 **Measure whether Chromium will display a notification from this extension at all**, and
  whether it requires an `iconUrl`. The extension ships no icon — `static/` holds only
  `manifest.json` — so the answer decides between three branches (`design.md` D12): nothing ships, an
  SVG ships, or a raster image ships. **The measurement is a quarantined probe beside
  `apps/extension/e2e/alarms-packing.mjs`, added to `QUARANTINED_PROBES`, and its result is recorded
  in `docs/PROVIDERS.md`.** A branch chosen by preference here is a branch this repository does not
  make.
  > **Result, 2026-10-11 — branch 3, and branch 1 is worse than false.**
  > `apps/extension/e2e/notification-display.mjs`, three consecutive runs identical. Control arm
  > (no `notifications`): the API is `undefined`. No icon: **the `create` callback resolves and
  > `getAll()` holds nothing.** SVG: **the callback resolves `null`** — refused. PNG: resolves *and*
  > registers. **`chrome.notifications.onError` does not exist on this Chromium.** Recorded in
  > `docs/PROVIDERS.md` §4.5.
- [x] 1.2 Record whether `notifications` and `alarms` are granted at install or require a prompt, from
  the same run, and record it with its substrate. **Do not assume** — an MV3 permission's grant
  behaviour is a platform fact and this repository has never observed it for this extension.
  > **Granted at install, with no prompt** — read through `chrome.permissions.getAll()`, which
  > returned `["notifications","storage"]`. Substrate recorded: Playwright 1.63.0, `channel:
  > "chromium"`, unpacked, headless, one machine. **The limit is recorded with it:** that says
  > nothing about an *optional* permission, which prompts by design, nor about a revoked grant.
- [x] 1.3 Fix the three branches into `design.md` D12 and into the requirement text, before the
  implementation exists. **A requirement written after the failure describes the failure rather than
  the rule.**
  > **D12 amended and the requirement rewritten before any implementation exists.** The branch is
  > raster. **Two clauses were falsified by the measurement rather than confirmed**, and both are
  > deleted rather than reworded: the paragraph saying `chrome.notifications` "fires `onError`"
  > (there is no such channel here) and the requirement's reliance on the `create` callback as
  > success evidence (it resolved for an arm that registered nothing). **The icon is therefore
  > mandatory in every notification** and the built `dist/` is required to carry it, so the failing
  > arm is unreachable by construction. **One scenario became three**, so `extension-client`'s
  > predicted scenario count moved with it — recounted by heading, not adjusted by hand.

## 2. The record kind (`packages/storage`)

- [x] 2.1 Add `SpectreSeenMessages` — `loadSeenMessageIds(mailboxId)` and `saveSeenMessageIds(mailboxId, ids)` —
  beside `SpectreMailboxes` and `SpectreSiteAssociations`, following `site-associations`' shape: a
  versioned envelope, an entry per mailbox, **`null` for absence and rejection for failure**, and
  entries this build cannot narrow left verbatim by a write as well as by a read.
  > **Done, and the reader is a union rather than `| null` because the test caught the alternative.**
  > The first version returned `readonly string[] | null` and the adapter passed it through, so **a
  > record this build could not read at all was reported as "this mailbox has nothing recorded"** —
  > the exact confusion the contract forbids, reached by the shortest possible route. `readStoredSeenMessageIds`
  > now answers `record-unreadable` / `nothing-recorded` / `ids`, and **only the middle one becomes a
  > `null`**, because it is the only one that is really an absence. Caught by *"reports a read failure
  > as a rejection rather than as an absence"*; **two different `null`s in one return type is the
  > defect, and reading the file would not have shown it.**
- [x] 2.2 Add `createChromeSeenMessages({ area })` beside the two existing chrome adapters. **No
  IndexedDB adapter**, and a test asserting its absence so the omission is a decision rather than a
  gap someone fills in.
  > **Done.** The absence case asserts the **module surface** rather than the file system — that the
  > exports carry no `createIndexedDbSeenMessages` or `createBrowserSeenMessages` — because a
  > contract the website cannot use is a contract the website should not be made to hold, and a
  > missing adapter is the kind of gap that reads as an oversight rather than a decision.
- [x] 2.3 Export both from `packages/storage/src/index.ts`, and update `contract.ts`'s "three
  contracts" note — it currently says three and will say four, and a note counting the wrong number
  is the same stale claim in a different file.
  > **Done.** The note now says four and answers *why* rather than only *how many*, because a
  > reported message id is not one of `M6`'s five record kinds any more than a site association was.
- [x] 2.4 Tests for the record: round trip, absence vs failure, another mailbox's ids untouched by a
  write, an unnarrowable entry preserved, and the empty-id and empty-mailbox refusals.
  > **Done — 8 cases, `packages/storage` 78 → 86.** **The case worth reading first is**
  > *"keeps an entry it cannot read, both by a read and by a write"*: an unreadable entry for a
  > **different** mailbox is still there, byte for byte, after a write that touched another one. **A
  > `saveSeenMessageIds` rebuilding the record from the ids it could read would pass every other case
  > in the file while discarding another mailbox's whole history on the first write of the day.**

## 3. The check (`apps/extension/src`)

- [x] 3.1 `background-check.ts`: build a provider manager and a session per wake, `restore()` the
  watched mailbox, take the listing from the returned state, and `destroy()` in a `finally` — the
  shape `create-mailbox.ts` already establishes. **Never `openMessage`, never `analyseMessage`.**
  > **Done, and "reads no body" is a type property rather than a reviewer's promise.** The session the
  > wake holds is typed `Pick<MailboxSession, "restoreSummaries" | "destroy">`, so a call to
  > `openMessage` does not fail a test — it fails to compile. **A requirement that can only be checked
  > by reading is a requirement that will eventually be read wrongly.**
  > **Amended during apply (2026-10-11):** the member was `restore` when this was first ticked, and the
  > type carried only the *first two thirds* of the claim. A browser request count found the third —
  > a wake reads a body per message through the listing's verdict pass — so the type now names the
  > listing that reads none, and `packages/mailbox` grew one. **A type can carry a claim its text never
  > made**, and only this was true: the wake's unit cases never contacted a provider, so nothing above a
  > browser could have said. See `design.md` D15 and task 9.3.
- [x] 3.2 `notification.ts`: build the notification from `MessageSummary` fields only, and report a
  creation the platform refused. **The record advances only on a notification actually created**
  (`design.md` D12).
  > **Done, 10 cases.** A refusal is `null` **or a throw** — §4.5 measured no `onError` channel, so a
  > thrown `create` is the same answer and is collapsed the same way rather than being given a second
  > spelling.
- [x] 3.3 The comparison: baseline when there is no record, notify for ids not held, prune to the
  current listing, write only when the set changed, and **change nothing on a failed check**.
  > **Done, 17 cases, and the new cases found a product defect rather than only a test error.** The
  > outcome union's `quiet` arm was reached whenever the id set was unchanged, so **a wake the
  > platform had just refused a notification for reported `quiet`** — "nothing happened" — while
  > having happened. `quiet` is therefore split into `unchanged` and `pruned`, and an arm claims a
  > notification was raised **when something was attempted**, not when something succeeded. **An arm
  > claiming a notification was raised when none was is the same defect as a record that advanced on a
  > refused one**, and only the first of the two was visible when the task was written.
  > **Two findings worth carrying.** The compose function takes an **optional injected listing
  > reader**, mirroring `createExtensionStorage`'s precedent, because a case about *which mailbox was
  > chosen* otherwise needs a provider — and the first version of that case passed a real session
  > over a stub transport and asserted the wrong thing, because `restore` correctly answers
  > `restoreFailed` there. And **`empty-mailbox` is its own outcome**, answered before the record is
  > read at all, because `saveSeenMessageIds` **refuses an empty list** — which is a **divergence
  > from the delta's prune clause, amended there during apply** with the reason.
- [x] 3.4 `alarms.ts`: one alarm name, one period **imported from `packages/mailbox/src/cadence` and
  never restated**, armed when a mailbox is recorded, reconciled on `chrome.runtime.onStartup`, and
  cleared on `expired` only.
  > **Done, 7 cases, and the period's single spelling is asserted twice.** Once for the file
  > (`alarms.test.ts`: one `periodInMinutes`, one `INBOX_POLL_PROMPT_MS`, no literal) and once across
  > the directory (`service-worker.test.ts`: **no shipped module but `alarms.ts` may name
  > `INBOX_POLL_PROMPT_MS`**). The file-local rule cannot be broken by a *second* file, which is the
  > shape the defect would actually take, so the directory rule exists beside it rather than in place
  > of it.
- [x] 3.5 Add `chrome.runtime.onStartup` and the alarm listener to `service-worker.ts`. **Leave `install`
  and `activate` empty** (`design.md` D10) and replace their "intentionally empty" note with one that
  says they are deliberately unfilled and why, so the next reader does not read it as forgotten.
  > **Done — `service-worker.test.ts` was rewritten rather than extended, and the rewrite is the
  > finding.** Its first rule read *"arms no alarm"*, which this change made false; the rule behind it
  > did not, because the worker reaches the platform through `extension-platform.ts` and the decision
  > through `alarms.ts`. **Retained with a corrected claim** — deleting a rule whose property still
  > holds is the retired-rule defect this repository records twice — and given the positive half it
  > lacked: the worker's only `self` listeners must be `install` and `activate`, because a worker
  > that registered its own `fetch` listener would hold nothing, arm no timer, and satisfy every rule
  > the file had while doing ambient work on somebody else's page. **Retention now covers three
  > files**, the third being `background-check.ts`: a rule not extended to the newest way this worker
  > can hold a session is a rule that stopped covering it. 5 → **8** cases.

## 4. The client

- [x] 4.1 `static/manifest.json`: add `alarms` and `notifications`. **Nothing else in that file
  changes** — a diff showing anything else is a defect, and the byte-identity check is a task below.
  > **Done, and the diff is the two strings.** Verified with `git diff --stat` rather than by reading
  > the file: one line changed, `permissions`. **`manifest.icons`, `action.default_icon` and every
  > `content_scripts` entry are byte-identical**, which is 7.4's instrument rather than this
  > task's assertion.
- [x] 4.2 The icon, if 1.1 selected a branch that ships one. **`manifest.icons` and
  `action.default_icon` stay untouched** — how the toolbar looks is not this slice's business.
  > **Done — 1.1 selected raster, so `static/icon.png` ships: 307 bytes,
  > SHA-256 `4e1ed280…a6`,** referenced from the notification and from nowhere else. **It is carried
  > into `dist/`**, checked by the browser tier rather than by a build-log reading, because §4.5's
  > finding is that a notification whose icon cannot be addressed **resolves its callback and
  > registers nothing** — so "the build succeeded" says nothing about the asset arriving. The PNG was
  > produced by a throwaway script outside the repository, so the asset ships without a generator in
  > the tree that nothing would keep honest.
- [x] 4.3 Wire the watched mailbox through `loadInsertableMailboxes`, so the answer stays computed in
  one place (`design.md` D6).
  > **Done, and two cases hold it: the head of the collection, and a device whose only mailbox
  > predates it.** The second is the one that would have been easy to miss: asking the collection
  > alone would tell this extension it holds nothing to watch — **silently, at the one moment the
  > answer decides whether anybody is told about new mail at all.**

## 5. Documentation and specs

- [x] 5.1 `docs/PROVIDERS.md`: record 1.1's measurement with its substrate, beside §4.1.1.
  > **Done as §4.5, with the substrate in the heading rather than a footnote** — Playwright 1.63.0,
  > unpacked, headless, one machine — and a third column on every row reading what the answer does
  > **not** establish. **That column is the reason the section is trustworthy:** an icon that
  > "works" and an icon that *registered* are different facts, and only the second one was measured.
- [x] 5.2 `docs/ROADMAP.md`: move the incoming-mail notification out of M10's not-yet-delivered list,
  and update the Project Status cursor. **The status block is the root orchestrator's alone.**
  > **Done — and the roadmap's own depiction of this feature was wrong, which is the part worth
  > recording.** Its depicted notification body carried a one-time code (`583291`), and the shipped
  > requirement forbids it. **The depiction is corrected in the roadmap rather than quietly left**, and
  > the reason is structural: a code is a detection inside a message body, `packages/core` says
  > outright that a summary carries none *"on purpose: listing a mailbox must not require fetching
  > bodies"*, and **so the depicted feature could only have been built by opening every message in
  > the mailbox.** A roadmap a change contradicts is a document this repository has to reconcile
  > rather than leave for the next reader to discover.
  >
  > The cursor records that slice 4 is **at apply**, not complete, and names the PR that put it there.
- [x] 5.3 `AGENTS.md`: update the module note in `service-worker.ts`'s header if it still claims
  `chrome.alarms` "enforces a floor of its own" — that sentence is now false and
  `alarms-packing-interval` measured it false.
  > **Done in two places, because the sentence existed in two places** — the `service-worker.ts`
  > module note, **deleted rather than reworded** (what it called a fact was never evidence in either
  > direction), and `AGENTS.md`'s browser-tier limit list, where the `chrome.alarms` entry was
  > already closed by the spike and this change **adds a fourth bullet** rather than extending it:
  > nothing observed a notification being **seen**, which is narrower than "it appeared" in three
  > named ways (headless has no notification centre; `getAll()` holding an id is *registration*;
  > nothing covers a platform that accepts a request and shows nothing). **The quarantined-probe
  > count moved from two to three** and the sentence about what adding a name means with it.

## 6. Boundaries

- [x] 6.1 **No boundary rule is retired, exempted or widened.** The count must stay **53** unless a
  genuinely new rule is added, and if one is, its property is named beside it. `packages/ui` must stay
  **38** — no new token, no new motion.
  > **Done: `architecture` is 53 and `packages/ui` is 38, both measured rather than asserted here.**
  > **No new rule was added, and the reason is worth stating because it is the rule this repository
  > has learned the hard way.** Every property this slice needed was *a rule a reviewer would
  > otherwise write*: "the worker names no `chrome`", "no module but `alarms.ts` names the period",
  > "the worker attaches no listener of its own". Each already has an instrument beside it —
  > the platform-global confinement is a boundary rule, the other two are `service-worker.test.ts` —
  > **and a second instrument for a property that has one is a duplicate, not a defence.** The M7
  > slice 4 record names the case exactly: a mutation appeared to show a gap, the "gap" was a
  > duplicate assertion, and the file was deleted rather than kept.
  >
  > **One comment was corrected and one sentence deleted, and neither is a rule change.** The
  > quarantine list's note on `notification-display.mjs` said the shipped manifest *"deliberately
  > did not* carry `notifications`* — **half of which became false the moment this change shipped
  > it**, while the other half was never the reason the probe is quarantined. Deleted rather than
  > reworded, with the real reason written in its place: **the script is quarantined because it is an
  > instrument, and its fixture is free to vary a right the product already holds.**
- [x] 6.2 Check whether `static/manifest.json`'s permissions are read by any existing rule and whether
  the two additions need a case. **The `extension-client` manifest scenario is a requirement, not a
  boundary rule**, so the enforcement is the requirement being falsifiable — see 6.3.
  > **Checked, and one case had become false rather than one needing to be added.** `manifest.spec.ts`
  > reads `permissions` and asserted `["storage"]`, so the two additions would have failed it — which
  > is the rule working, and it took **two mutations** to make the assertion mean what it says
  > (§7.1). It now reads the three and says *why each is there*: `storage` by the popup and the
  > content script, `alarms` and `notifications` by the worker, and `tabs`/`scripting`/`activeTab`
  > still absent because no shipped surface needs them. **A requirement that forbids an unused
  > permission is only a rule if something reads the list**, and this was the one place that does.
  >
  > **The sentence above was false by the time it was written, and it is corrected rather than kept.**
  > It said `manifest.spec.ts` was *the* place that reads the list. There were **two**, and they read
  > **two different things on purpose**: `manifest.spec.ts` reads the **built file**, while
  > `in-page-fill.spec.ts` reads `chrome.runtime.getManifest()` from the **running extension** - and
  > that file's own header says the two are deliberately different instruments, because the source
  > file is what was written and the parsed manifest is what Chromium granted. So this was **not** a
  > duplicate; it was a second copy of one *assertion* on a second *instrument*, and only the first
  > was reached. **The second was found by the browser tier and not by reading the code** (§7.4),
  > which is the one place a latent disagreement of this kind can surface.
  >
  > **What it is repaired to matters more than the repair.** It no longer asserts an exact list - it
  > asserts `toContain("storage")` and the **three** absent permissions, because **the exact list is
  > now a property of the milestone in progress rather than of the fill path**, and
  > `manifest.spec.ts` holds it. **Narrowing an assertion is not the same as weakening it**: the case
  > before could not tell an unused permission from a milestone that had not yet added one, and the
  > case after can. **Nothing was inverted, and the supersession is recorded in the case's own
  > header** - a case that flips direction with no note attached is the defect `in-page-fill`
  > recorded once already.
  >
  > **The new case is the icon, and it exists because the failure it catches is silent by
  > measurement**: a notification naming an icon the build did not carry **resolves its callback and
  > registers nothing** (§4.5), so no callback, no build and no assertion would ever notice. It
  > reads the PNG signature *and* its `IEND` chunk — so a truncated write and an HTML error page
  > served in its place are both refused — and asserts `manifest.icons` and
  > `action.default_icon` stay `undefined`, **which is the half that could be forgotten and the half
  > that makes the other half mean anything.**

## 7. Verification

- [x] 7.1 **Falsification pass.** Prove each new assertion can fail, and prove the conforming case
  still passes. Record `wrongcatch`, `green`, `noop`, `nocompile` and `harness-error` separately.
  **The harness lives outside the repository tree**, and restoration is verified by SHA-256 per
  mutated file, with `dist/` rebuilt from the restored source.

  > **34 arms: 30 caught, 3 `nocompile`, 1 `green`, with `wrongcatch`, `noop` and `harness-error`
  > all zero.** Restoration verified by SHA-256 per mutated file and the final rebuild from restored
  > source reported `ok`. The three non-caught arms are recorded as evidence rather than counted, and
  > each is recorded with what it actually established:
  >
  > - **`U14` — `nocompile`.** `NotificationRequest` has no index signature, so a fourth key is
  >   TS2353. **A mutation that cannot compile is not evidence about an assertion**: the exact-key
  >   assertion in `notification.test.ts` is the second line behind a type, not the first.
  > - **`W05` — `nocompile`.** The shipped defect verbatim — a wake listing through `restore` — and
  >   `tsc` refuses it because `WakeSession` is `Pick<MailboxSession, "restoreSummaries" | "destroy">`.
  >   **The body-read exclusion is now checked by `pnpm typecheck` on every run**, rather than by a
  >   browser case that has to be kept in step with the code.
  > - **`P06` — `nocompile`, and its note predicted the opposite.** The arm added a field to the
  >   payload-free `RECONCILE_ALARM_REQUEST` and the note claimed `tsc` would accept it, on the
  >   reasoning that excess-property checking fires only at a direct assignment. It does fire at one,
  >   because the constant is annotated. **A prediction about what the compiler will do is recorded
  >   as a prediction and corrected when it is wrong**, not kept because it is the newer claim.
  > - **`W04b` — `green`, and green was correct.** The first spelling of `W04` chained a second
  >   listing off the returned value; the reader's `finally` calls `destroy()` *before* the promise
  >   `return` names adopts its value, so the chained call ran against a destroyed session and its
  >   listing was suppressed. A direct instrumented run showed the interceptor seeing two requests
  >   **4 989 ms apart** — one wake each, which is the repaired behaviour. **A survivor is not an
  >   assertion that is too weak until the mutant has been read**, and an arm that was *wrong* rather
  >   than one that survived is the one most likely to be mistaken for coverage, so it stays in the
  >   table with its reason attached.
  >
  > **And the harness itself was wrong three more times, all repaired rather than explained.**
  >
  > - **A `-t` filter that matched nothing was filed as a pass.** `P07` came back `green` with
  >   **0 passed**. Vitest's `-t` takes a **regex**, and the catcher had been composed from an
  >   `it.each` *template*: the second `%s` is filled with the row's **value**, not its expected
  >   boolean, so `: false` matched no rendered title. All **64** tests came back `pending`, exit 0 —
  >   and the guard tested `numTotalTests === 0`, which a *skipped* test satisfies because a skipped
  >   test is still a collected test. **That is this repository's own `passWithNoTests` lesson in the
  >   one direction that manufactures a survivor**, and the test now reads
  >   `numPassedTests + numFailedTests === 0`.
  > - **An arm that measured nothing looked exactly like an arm that measured a survivor**, which is
  >   why the two are separated above rather than merged into one "not caught" bucket.
  > - **The `P04` spelling measured the compiler.** `adopt(null, …)` leaves `stored` unread and
  >   `noUnusedParameters` refuses it, so the first run was `nocompile`. `P02` and `P04` use
  >   always-true expressions for the same reason.

- [x] 7.2 **A notification that could not be created advances nothing** — the mutation is a `create`
  that reports failure, and its catcher is the record.

  > `U01` (a `create` answering `false`) and `U02` (a `create` that **throws**) both caught by
  > *"does not record a message whose notification the platform refused"*, and `U03` caught by
  > *"establishes a baseline on the first check and announces nothing"*. **Both refusals are arms
  > because `docs/PROVIDERS.md` §4.5 measured that `chrome.notifications.onError` does not exist on
  > the Chromium measured** — so a throw and a `null` answer are the only two refusals a caller can
  > observe, and treating one differently would give the record two rules where the platform offers
  > one.

- [x] 7.3 **A wake makes exactly one provider request.** The instrument is a request count, which is
  what caught `in-page-fill`'s `close()` defect.

  > **The browser count could not measure this at all when it was first written, and the arm table
  > is why.** `W04` — a wake listing twice — came back `green`, because **two wakes listing once and
  > one wake listing twice produce the same log of URLs**: a case written to measure a *per-wake* cost
  > was measuring a *total*, and it had a name and a comment saying otherwise. `recorded-provider.ts`
  > now records `requestedAt` beside `requested`, and the case asserts the two requests are
  > `INBOX_POLL_PROMPT_MS / 5` apart — a **derived** threshold, because a number picked there would
  > be a number picked to be large enough. `W06` deletes the timestamp push and is caught, so the gap
  > is measured rather than defaulted into passing. `P01`/`P05` are the same property one layer down,
  > counting `restoreSummaries` against `restore` and against a listing that renders.

- [x] 7.4 **`static/manifest.json` is byte-identical apart from the two permissions.**

  > Checked by inspection and by arm: `permissions` went from `["storage"]` to
  > `["storage", "alarms", "notifications"]` and nothing else in the file moved. `W01` makes the
  > manifest request a permission no shipped surface uses; `W02` makes it declare the shipped icon
  > anywhere at all; `W03` deletes `icon.png` — which is `nocompile`-free only because the harness
  > removes `dist/` before building, since `vite.config.ts` sets `emptyOutDir: false` and the
  > **previous build's `dist/icon.png` survived the deletion** and was read as evidence about a
  > mutation long after it was built.
  >
  > **A second copy of the same assertion existed and was not reached by task 6.2.**
  > `in-page-fill.spec.ts` held `expect(manifest.permissions).toEqual(["storage"])` against the
  > **parsed** manifest, and `manifest.spec.ts` holds the list against the **built file** — two
  > deliberately different instruments, and only the first was updated. It is repaired to assert
  > `toContain("storage")` plus the three absent permissions, with the supersession recorded in the
  > case's own header: **a case that flips direction with no note attached is the defect
  > `in-page-fill` already recorded once.**

- [x] 7.5 `pnpm verify` three times with `PLAYWRIGHT_BROWSERS_PATH` pointed at an empty directory, and
  `pnpm test:browser` at least thirty consecutive times.

  > **`pnpm verify` exited `0` three times, with no browser installed** — `PLAYWRIGHT_BROWSERS_PATH`
  > pointed at an empty directory — and **58 test files** each run. **The first of the three was
  > red, on two gates, and neither was a flake**: `lint` reported three
  > `@typescript-eslint/no-unused-vars` errors in `notification.test.ts`, and `format:check` rejected
  > ten files. The lint errors are the recorded shape — **the count of files Prettier rejects is a
  > count of edits made since Prettier last ran**, not a fixed property of the change.
  >
  > **The lint errors are worth their own sentence, because the fix was not suppression.** The
  > repository's ESLint config sets no `argsIgnorePattern`, so a `_`-prefix silences nothing; the
  > `_id`/`_options` on the fake's `create` and the `_reported` in a rest destructure were three real
  > bindings nothing read. The parameters are now simply not written — **`vi.fn` records every call's
  > arguments whatever the body names**, and `toHaveBeenCalledWith` is the case that reads them — and
  > the omitted `fromName` is now **asserted** rather than discarded, because a case resting on a
  > fixture it never checked passes just as happily when the fixture stops meaning what it did.
  >
  > **And my own reading of that red was wrong first, which is the part worth recording.** The
  > harness line was `$LASTEXITCODE` **after a pipeline**, which reports the last command in the pipe
  > rather than `pnpm` — so the three "red" runs and the three green ones came off the same
  > instrument. **A number produced by a pipeline's last stage is not the number the command exited
  > with**, and the repaired form captures the output first and reads the exit code from the command.

- [x] 7.6 Counts taken from `--reporter=json` grouped by project, never transcribed. **Predicted
  movements: `packages/storage` 78 → more, `apps/extension` 262 → more, `packages/ui` 38 unmoved,
  `apps/web` 125 unmoved, `architecture` 53 unmoved.** A movement in `apps/web` means this slice
  touched the website and that has to be explained before anything else is looked at.

  > **Measured: `1093` tests across `58` files, `0` failed**, grouped by project from the JSON
  > reporter rather than read off a summary line.
  >
  > | Project | Was | Now |
  > |---|---|---|
  > | `apps/extension` | 262 | **330** |
  > | `packages/mailbox` | 158 | **166** |
  > | `packages/storage` | 78 | **86** |
  > | `apps/web` | 125 | **125** |
  > | `packages/providers` | 92 | **92** |
  > | `packages/ui` | 38 | **38** |
  > | architecture (boundary assertions) | 53 | **53** |
  > | `packages/mail-parser` | 149 | 149 |
  > | `packages/core` | 54 | 54 |
  > | **Total** | **1009 / 54 files** | **1093 / 58 files** |
  >
  > **All three unmoved numbers moved for the reason they were checked.** `apps/web` is the evidence
  > this slice touched no website, `packages/ui` the evidence it added no token and no motion, and the
  > boundary count the evidence task 6.1's decision to add **no** rule was right — every property
  > already had an instrument.
  >
  > **`apps/extension`'s +68 is fully accounted, and the arithmetic is the check that the movement
  > was accounted for**: three new files (`alarms.test.ts` 7, `notification.test.ts` 11,
  > `background-check.test.ts` 17 = 35), `extension-platform.test.ts` 47 → 64 (+17),
  > `service-worker.test.ts` 5 → 8 (+3), `Popup.test.tsx` 24 → 25 (+1), `protocol.test.ts` 52 → 64
  > (+12). 35 + 17 + 3 + 1 + 12 = **68**.
  >
  > **And one movement in that arithmetic was the count reporting a gap.** `protocol.test.ts` held
  > **52 before and after** a change that added a third message kind to the module — and the
  > unmoved number was what gave it away: `RECONCILE_ALARM_REQUEST`, `RECONCILE_ALARM_REQUEST_KIND`
  > and `isReconcileAlarmRequest` were read by **no case**, while every other kind in the file has
  > its own narrowing table. **A count says how many and not which**, so a moved count would not have
  > reported it either; it took the arithmetic across two changes to see a number that should have
  > moved and did not. Twelve cases now cover it, and `P06`/`P07`/`P08` are the arms.

## 8. Deliberately left unticked

- [ ] ~~**Look at the notification on a real desktop.**~~ A system notification is rendered by the
  operating system, not by this product, and no test in this repository reads a rendered pixel. An
  agent reading a string is not the judgement the task asks for. **Recorded rather than skipped.**
- [ ] ~~**Whether 5 000 ms is tolerable to a real provider.**~~ `use it externally` remains unverified
  and this slice has no way to close it; the only budget measured is `30; w=60`, unauthenticated only.
---

## 9. Repairs found while running task 7

> **Found by the verification pass, and recorded here rather than folded into the tasks above.**
> Task 7.3's own instrument — a request count taken in a real Chromium — is what found both of these,
> and both were shipped defects rather than gaps in the tests. They are numbered after the sections
> above because that is the order they were found in, not because they belong last.

- [x] 9.1 **The alarm was armed on one of the two paths that write a mailbox.** The popup creates a
  mailbox in its own context and writes the collection itself, so the worker's arming — which hung off
  the answer to a *delegated* creation — never ran for the path a person takes. Measured: the mailbox
  present in the collection, `chrome.alarms.getAll()` answering `[]` across eight polls over two
  seconds. **The platform accepts the period** — a direct `create` with `periodInMinutes: 1/12` was
  accepted and appeared in `getAll()` — so this is the product never calling `create`, and the
  measurement is what distinguishes those two. Fixed per `design.md` D14.
- [x] 9.2 **`service-worker.ts`'s module note made a false claim**, and its *reason* for a narrower
  design was refuted by the same measurement: it said watching the storage area was unnecessary *"for
  a case this repository cannot name"*, and the popup is the case a person uses. The note is rewritten,
  not reworded.
- [x] 9.3 **The delta's cost paragraph was false, and so was the "never opens a message" sentence.**
  A wake costs one listing **plus one body read per message in the listing**, and it re-reads them on
  *every* wake, because the wake builds a fresh session and the verdict tracker remembers what it has
  read only for that session's life. Measured, not read: two requests for wake one, two for wake two,
  on a mailbox holding one message. Both paragraphs are amended **in the delta**, with the measurement
  attached, because `openspec/specs/` is the source of truth and a gap between the archived delta and
  the promoted spec means an amendment was recorded in the wrong artifact.
- [x] 9.4 **A `mailbox-session` delta is added**, so the repair has somewhere to live. `MailboxTracker`
  gains a second named listing, `MailboxSession` gains the session-level entry point that shares
  `restore`'s reconciliation, and `background-check.ts`'s `WakeSession` narrows from `restore` to it —
  which keeps *"never `openMessage`, never `analyseMessage`, and reads no body"* a property of the type
  rather than a promise. **The shared body is `adopt()`, not a second adoption**, for the reason
  `restore` already gives about the first visit: two implementations of one adoption drift into the two
  paths behaving differently, and the drift shows up exactly where nobody can tell them apart.
- [x] 9.5 **The extension has no consumer for a verdict.** `apps/web/src/Inbox.tsx` is the only caller
  in this repository that reads a verdict map, which is the fact that makes the repair a repair rather
  than a trade.
- [x] 9.6 **`packages/mailbox` implements it**, as a second named entry point rather than an option on
  the one that renders. `takeListing(mailbox, readVerdicts)` holds the shared skeleton — the `checking`
  publish, the throttle, the refusal mapping, the `MAILBOX_EXPIRED` answer — and the two entry points
  are one line each. **A boolean every future call site has to know the meaning of was the alternative,
  and two names say which is wanted at the point of use.** `listSummaries` neither reschedules nor lifts
  a halt, because a caller that displays nothing has no loop to resume.
- [x] 9.7 **The browser case is corrected to measure a constant rather than a first wake**, which is
  what turned *"reads a body"* into *"re-reads it every wake"*. It now waits for a **second** wake
  before counting, so the claim is `2` over two wakes rather than `1` over one. **The count polls for
  `toBeGreaterThan(1)` and asserts the exact number on the next line**, because a wake costing two
  requests each would carry the count past `2` and a poll waiting for `toBe(2)` would fail naming a
  *timeout* rather than the count it wanted. **What the count cannot tell is written into the case**: two
  listings from one wake satisfy it as well, the log carries no timestamps, and what closes that is the
  unit tier counting one call per wake plus `packages/mailbox` counting one request per adoption.
- [x] 9.8 **Seven arms were added for the repair, and one of them failed as a broken mutation first.**
  `P04` was written `adopt(null, inbox.listSummaries)` and came back `nocompile` — `noUnusedParameters`
  refused it, so the arm measured the compiler rather than the case. It is now an always-null ternary
  and is caught. `W05` is **expected to be `nocompile`**, and that is its finding: the shipped defect —
  the wake listing through `restore` — is now a line `tsc` refuses, because `WakeSession` has no such
  member. **The body-read exclusion moved from a browser case that has to be kept in step with the code
  to `pnpm typecheck`, which runs on every gate.**
- [ ] 9.10 **This change's own alarm broke a browser-tier assertion, and the repair is an isolation
  rather than a threshold.** Recorded at `design.md` D16.
  > **Found by the block of thirty, once, and the tally is reported with the red rather than rounded
  > away**: blocks 1 and 2 were 10/10, block 3 was **9 passed and 1 failed**, and the failure is
  > `in-page-fill.spec.ts` *"reads a message it has already opened for no second request"* on
  > **`Expected: 1, Received: 3`** - one staging listing and **two** background wakes.
  >
  > **Two explanations were tried and the first was false.** The obvious one is a wake leaking in from a
  > neighbouring spec, since Playwright runs spec files in parallel within one process and
  > `background-check.spec.ts` is *designed* to leave a periodic alarm armed. **It does not**:
  > `launch-extension.ts` gives every launch its own profile directory - which that file's own comment
  > records as the fix for an earlier shared-profile defect - so each spec has its own storage and its
  > own alarms. **Twenty runs of the failing spec alone were all green**, which is what refuted it.
  >
  > **What settled it was the failing case's own reported duration: 12.5 s against a 5 000 ms period.**
  > It was never a race; it is **deterministic once the case outruns one period**, and a loaded machine
  > is what makes it. **46 attempts in all - 31 full-suite and 15 extension-tier - produced exactly one
  > red**, and it needed the load.
  >
  > **The threshold repair was rejected before it was written, and the rejection is the finding.**
  > Raising the window, or relaxing `toBe(1)`, is **the recorded defect with a larger constant**: a wake
  > polluting the count reads green under it. **What ships is `clearArmedAlarms` in the three specs
  > that create a mailbox** - `in-page-fill.spec.ts`'s `stage()` (because that press is what arms the
  > alarm), `popup.spec.ts`'s negative-window case, and `in-page-create.spec.ts`'s `afterEach`
  > (delegated creation arms too, at `service-worker.ts`). D16 has the per-spec reasoning.
  >
  > **And the precondition is falsifiable, which a disarm alone would not be.** A disarm that is only
  > ever *cleared* can be deleted and nothing fails - the count stays right on every run short enough
  > for the alarm not to fire. So `in-page-fill.spec.ts` gains a first case that **requires no alarm to
  > be armed**, then **arms one deliberately, reads it back**, and **requires a listing nobody asked
  > for**. The first assertion is the load-bearing one: it fails **in under a second, every run, on any
  > machine**, which an arm pointed at the count could never do because it would inherit the same
  > dependence on case duration. **Measured**: removing the disarm reported
  > `Received: ["spectre-background-check"]` against an assertion requiring none, naming the line.
  >
  > ### Amendment, 2026-10-11 — the disarm shipped as a race, and the control caught it on its first block
  >
  > **The block of thirty meant to confirm this decision came back `passed=18 failed=12`,
  > `harness-error=0`, and every one of the twelve reds was that same new control failing on its own
  > `toEqual([])` with an alarm armed.** The direction is the finding, not the count: the pre-repair
  > baseline was **one red in forty-six attempts**, so the repair made the suite substantially worse
  > rather than merely failing to hold.
  >
  > **The mechanism is this repository's recorded lesson one door over.** `Popup.tsx` renders the
  > address when `session.open()` publishes `ready`, which is **before** the press reaches
  > `await requestBackgroundAlarm()`. So waiting for the address releases the spec **while the arming
  > is still travelling to the worker**; the clear then clears nothing and the worker arms afterwards.
  > The recorded lesson was *"waiting for the address to appear on the popup does not wait for the
  > `saveMailbox` write"* — **here it is worse, because what goes unwaited is the arming that *follows*
  > the write, and the popup never states on screen whether it has happened**, so no screen assertion
  > can stand in for it.
  >
  > **A race is decided by which side is slower, so a race is decided by machine load.** That is why it
  > presented as a *rate* rather than as a failure, and why **counting runs found it when no single run
  > would have.**
  >
  > **The repair is the order, not a threshold and not an abandonment:
  > `waitForTheArmingThenDisarm`** reads the alarm back until it is armed and *then* clears — and
  > reading the arming **is** observing that the popup's request has been answered, because the arming
  > is the last thing that request does. Applied in `in-page-fill.spec.ts`'s `stage()` and in
  > `popup.spec.ts`'s negative-window case, which had the identical race; `in-page-create.spec.ts` needs
  > only `clearArmedAlarms`, because delegated creation arms **before** it answers.
  >
  > **Measured after the repair: eight consecutive extension-tier runs, then thirty consecutive
  > full-suite runs in three blocks of ten - `passed=30 failed=0 harness-error=0`, at `website=40` and
  > `extension=67` on every run**, and **zero source files changed while the block ran** (the latest
  > write anywhere in the scanned tree was sixteen seconds before it opened), so the thirty are on the
  > tree this change ships. **38 consecutive green measurements in all.** The tally is reported as
  > measured rather than rounded, because **the block that failed is the reason this amendment
  > exists**.
- [x] 9.9 **The counter-shape of every cost claim in this change was checked before it was written.**
  `packages/ui` 38, `apps/web` 125 and the boundary count 53 must be unmoved, `packages/storage` and
  `apps/extension` must have moved, and a movement in `apps/web` would mean this slice touched the
  website and would have to be explained before anything else was looked at.

  > **All three unmoved numbers are unmoved, measured from `--reporter=json` grouped by project:**
  > `packages/ui` **38**, `apps/web` **125**, `architecture` **53** — and the two that had to move did,
  > `packages/storage` **78 → 86** and `apps/extension` **262 → 330**, with `packages/mailbox`
  > **158 → 166**. Total **1009 across 54 files → 1093 across 58**, 0 failed. Full table under 7.6.
  >
  > **The boundary count is the number that says task 6.1 was right.** It is unmoved *because* no
  > rule was added: every property this change introduced already had an instrument — the alarm
  > period is asserted against `packages/mailbox`'s exported constant, the platform seam is inside the
  > module the M9 rule already confines, and `spectre-storage`'s new record kind is exercised through
  > its own adapter. **A rule added where an instrument already exists is not coverage, it is a
  > second opinion nobody asked for** — and 53 staying at 53 is the measurement that says none was.
  >
  > **And one movement in the arithmetic was itself a finding**, recorded under 7.6: `protocol.test.ts`
  > held 52 before *and* after a change that added a third message kind to the module, and it took the
  > arithmetic across two changes to notice a count that should have moved and did not. **A count says
  > how many and not which**, so the prediction above — "must have moved" — is one this change did not
  > make about `protocol.test.ts` and would not have caught on its own.
