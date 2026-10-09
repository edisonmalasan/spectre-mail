# Tasks

## 1. Record kinds and their narrowing

- [ ] 1.1 Add the mailbox-collection and site-association record shapes to
  `packages/storage/src/record.ts` — `SPECTRE_COLLECTION_VERSION`, a collection whose members are
  existing `StoredMailboxRecord` values, and an association map — with one narrowing function each,
  reusing `readStoredMailboxRecord` for every member. Verify: a unit test shows a collection whose
  second member cannot be narrowed still returns its first and leaves both in storage.
- [ ] 1.2 Add `packages/storage/src/mailboxes.test.ts` and
  `packages/storage/src/site-associations.test.ts` covering newest-first order, the current entry
  being the head, an empty device reporting an empty collection rather than a failure, a read
  failure being reported as a failure, a repeated mailbox appearing once as the newest, an exact-host
  key, two hosts sharing a parent domain staying separate, and an un-narrowable entry being neither
  returned nor deleted. Verify: `pnpm test` is green and each requirement scenario in the delta has
  at least one case that names it.

## 2. Contracts and the chrome adapter

- [ ] 2.1 Add `SpectreMailboxes` and `SpectreSiteAssociations` beside `contract.ts`, exporting them
  from the package index, with no IndexedDB adapter for either. Verify: `apps/web`'s IndexedDB
  adapter has gained no member, and `pnpm typecheck` is green.
- [ ] 2.2 Add the `chrome.storage` adapter for both contracts beside `chrome.ts`, and a case proving
  a record written through one contract is gone after `clearAll` reached through `SpectreStorage` —
  the cross-contract removal scenario the single-record build could not write. Verify: that case
  fails when `clearAll` is narrowed to the one key it recognises.
- [ ] 2.3 Add the boundary assertion that no module outside `packages/storage/src/chrome-platform.ts`
  names the extension's platform global, and that the extension's create path writes no singular
  mailbox key, each with a control that fires when its own form is violated. Verify: both controls
  go red under their mutations.

## 3. The extension reads and writes the collection

- [ ] 3.1 Extend `apps/extension/src/storage.ts` with the two areas and export the two new contracts
  alongside the existing one. Verify: the module's own tests stay green and `pnpm typecheck` passes.
- [ ] 3.2 Move the extension's create path onto `addMailbox`, so a mailbox this device was handed is
  recorded by exactly one operation, and read "your address" as the collection's head. Verify: the
  existing creation tests pass with their expectations changed to the collection, and a case shows
  two creations produce two entries rather than one.
- [ ] 3.3 Prove `service-worker.test.ts` and `protocol.ts` are untouched by this slice: no new message
  type, no new worker case, both counts unchanged from the baseline. Verify: the counts are read from
  the test run rather than asserted from memory.

## 4. The in-page control prefers this site's mailbox

- [ ] 4.1 Add `affordanceInsertLabel(address)` beside `AFFORDANCE_LABEL` in
  `apps/extension/src/content-script/affordance.ts`, keeping the creation wording distinguishable
  from the insertion wording, and change no other surface in the shadow root. Verify: a case reads
  the control's accessible name and requires it to contain the address it will insert.
- [ ] 4.2 Teach `controller.ts` to read the collection and the association on focus, prefer the
  association's mailbox when this device still holds it, and fall back to the collection's head.
  Verify: controller cases cover a host with an association, a host without one, a host whose
  recorded mailbox is gone, and a record that cannot be read.
- [ ] 4.3 Write the association after a successful insertion and nowhere else, keyed on
  `location.hostname`. Verify: a case shows an insertion records the association and that merely
  offering the control records nothing, and a case shows two hostnames sharing a parent domain
  resolving separately.
- [ ] 4.4 Add cases for the two rules that stay: no affordance over a field holding text, and the
  form is never activated by an insertion. Verify: both are cases the existing tier already carries
  for the previous version of this behaviour and are re-run against the new preference.

## 5. Browser tier

- [ ] 5.1 Add `apps/extension/e2e/site-association.spec.ts` over the fixture page: insert on a host
  with no association, return to it and require the same address; insert on a second host and require
  each host to resolve to the mailbox it was used with; require the control's accessible name to
  carry the address; require the insertion to be gone from `chrome.storage.local` while both new
  records are present. Verify: the suite is collected by the extension's Playwright config and by
  nothing else — the boundary rule requires that and fails by name.
- [ ] 5.2 Add the two limit cases: a same-origin iframe's email field is **not** reached with
  `all_frames` unset, established with a control that proves the frame loaded and is inspectable
  before its absence is read; and the page world has no `chrome`, so the absence of a DOM `storage`
  event is evidence about the DOM event rather than about a missing subscription. Verify: each
  control fails when its mechanism is removed.

## 6. Falsification and full-suite record

- [ ] 6.1 Run the falsification harness **from outside the repository** against every new assertion:
  each must be shown able to fail, the conforming case must still pass, restoration must be verified
  by SHA-256 per file, and the built `dist` must be rebuilt from the restored source. Verify: the
  table lands in this change's `design.md` under `## Falsification`, with `nocompile`, `noop`,
  `wrongcatch` and `harness-error` reported as their own outcomes rather than as survivors.
- [ ] 6.2 Run `pnpm verify` with `PLAYWRIGHT_BROWSERS_PATH` pointed at an empty directory, and
  `pnpm test:browser` in **three blocks of ten consecutive runs**, recording failures rather than
  passes. Verify: every block's tally is written down.
- [ ] 6.3 Record the measured test counts grouped by project from a `--reporter=json` run, and
  confirm `packages/ui` is still 38 and the architecture boundary count moved by exactly the
  assertions added here. Verify: the baseline is measured in a `git worktree` at the merge base
  rather than transcribed from a previous stage.

## 7. Documentation

- [ ] 7.1 Bring `AGENTS.md` current: the milestone block, the framework and testing paragraphs, the
  browser-tier entry, and the new limits — including that this slice needs no worker delegation and
  why. Verify: every count in the file comes from the run recorded in 6.3.
- [ ] 7.2 Bring `README.md` and `docs/ROADMAP.md` current, including the M9 slice 3 entry and the
  totals, and record the popup's one-mailbox limit. Verify: no count is transcribed.
- [ ] 7.3 Leave a `## Deliberately unticked` section in this file naming the one task this change
  owes a human: opening a real page with the extension loaded and looking at the control. Verify: the
  section exists and the task is unticked.