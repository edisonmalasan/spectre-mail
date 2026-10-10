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

- [ ] 3.1 `background-check.ts`: build a provider manager and a session per wake, `restore()` the
  watched mailbox, take the listing from the returned state, and `destroy()` in a `finally` — the
  shape `create-mailbox.ts` already establishes. **Never `openMessage`, never `analyseMessage`.**
- [ ] 3.2 `notification.ts`: build the notification from `MessageSummary` fields only, and report a
  creation the platform refused. **The record advances only on a notification actually created**
  (`design.md` D12).
- [ ] 3.3 The comparison: baseline when there is no record, notify for ids not held, prune to the
  current listing, write only when the set changed, and **change nothing on a failed check**.
- [ ] 3.4 `alarms.ts`: one alarm name, one period **imported from `packages/mailbox/src/cadence` and
  never restated**, armed when a mailbox is recorded, reconciled on `chrome.runtime.onStartup`, and
  cleared on `expired` only.
- [ ] 3.5 Add `chrome.runtime.onStartup` and the alarm listener to `service-worker.ts`. **Leave `install`
  and `activate` empty** (`design.md` D10) and replace their "intentionally empty" note with one that
  says they are deliberately unfilled and why, so the next reader does not read it as forgotten.

## 4. The client

- [ ] 4.1 `static/manifest.json`: add `alarms` and `notifications`. **Nothing else in that file
  changes** — a diff showing anything else is a defect, and the byte-identity check is a task below.
- [ ] 4.2 The icon, if 1.1 selected a branch that ships one. **`manifest.icons` and
  `action.default_icon` stay untouched** — how the toolbar looks is not this slice's business.
- [ ] 4.3 Wire the watched mailbox through `loadInsertableMailboxes`, so the answer stays computed in
  one place (`design.md` D6).

## 5. Documentation and specs

- [ ] 5.1 `docs/PROVIDERS.md`: record 1.1's measurement with its substrate, beside §4.1.1.
- [ ] 5.2 `docs/ROADMAP.md`: move the incoming-mail notification out of M10's not-yet-delivered list,
  and update the Project Status cursor. **The status block is the root orchestrator's alone.**
- [ ] 5.3 `AGENTS.md`: update the module note in `service-worker.ts`'s header if it still claims
  `chrome.alarms` "enforces a floor of its own" — that sentence is now false and
  `alarms-packing-interval` measured it false.

## 6. Boundaries

- [ ] 6.1 **No boundary rule is retired, exempted or widened.** The count must stay **53** unless a
  genuinely new rule is added, and if one is, its property is named beside it. `packages/ui` must stay
  **38** — no new token, no new motion.
- [ ] 6.2 Check whether `static/manifest.json`'s permissions are read by any existing rule and whether
  the two additions need a case. **The `extension-client` manifest scenario is a requirement, not a
  boundary rule**, so the enforcement is the requirement being falsifiable — see 6.3.

## 7. Verification

- [ ] 7.1 **Falsification pass.** Prove each new assertion can fail, and prove the conforming case
  still passes. Record `wrongcatch`, `green`, `noop`, `nocompile` and `harness-error` separately.
  **The harness lives outside the repository tree**, and restoration is verified by SHA-256 per
  mutated file, with `dist/` rebuilt from the restored source.
- [ ] 7.2 **A notification that could not be created advances nothing** — the mutation is a `create`
  that reports failure, and its catcher is the record.
- [ ] 7.3 **A wake makes exactly one provider request.** The instrument is a request count, which is
  what caught `in-page-fill`'s `close()` defect.
- [ ] 7.4 **`static/manifest.json` is byte-identical apart from the two permissions.**
- [ ] 7.5 `pnpm verify` three times with `PLAYWRIGHT_BROWSERS_PATH` pointed at an empty directory, and
  `pnpm test:browser` at least thirty consecutive times.
- [ ] 7.6 Counts taken from `--reporter=json` grouped by project, never transcribed. **Predicted
  movements: `packages/storage` 78 → more, `apps/extension` 262 → more, `packages/ui` 38 unmoved,
  `apps/web` 125 unmoved, `architecture` 53 unmoved.** A movement in `apps/web` means this slice
  touched the website and that has to be explained before anything else is looked at.

## 8. Deliberately left unticked

- [ ] ~~**Look at the notification on a real desktop.**~~ A system notification is rendered by the
  operating system, not by this product, and no test in this repository reads a rendered pixel. An
  agent reading a string is not the judgement the task asks for. **Recorded rather than skipped.**
- [ ] ~~**Whether 5 000 ms is tolerable to a real provider.**~~ `use it externally` remains unverified
  and this slice has no way to close it; the only budget measured is `30; w=60`, unauthenticated only.