# Website selection-contract check — M22 task 5.5

**Status:** research deliverable, not an implementation, not a specification, not a test run.
**Date:** 2026-11-22.
**Base:** branch `research/website-selection-check` created from `origin/main` at
`27e4682` (merge of PR #246). Every citation is to that tree.
**Task:** verify, with file:line evidence, that the website already satisfies the
minimal Automatic/manual domain-selection requirement in
`openspec/changes/m22-provider-catalog-foundations/specs/provider-catalog/spec.md:111-160`,
and determine whether any `website-client`, `page-composition` or `visual-system`
requirement, or any product code, needs to change (tasks.md 5.5, design.md D8).

**Read-only constraint honoured:** this report is the only file created or edited.
No product code, OpenSpec artifact, roadmap, `AGENTS.md`, `docs/PROVIDERS.md`,
design record, token, stylesheet or other worker's file was touched.

---

## 0. Verdict in one paragraph

**The website already satisfies every clause of the new selection requirement;
no `website-client`, `page-composition` or `visual-system` requirement needs
modification, and no product code change is needed.** The four actions, the
Automatic-first picker with a usable-only manual list, the coalescing and
generation-token guards, the previous-mailbox-preserved / reader-cleared
semantics, the stable inbox during Refresh, the keyboard and reduced-motion
guards, the five-region composition and the unchanged token/motion set are all
present in shipped source and held by existing browser and unit assertions. The
M22 delta adds its requirement to a **new** capability (`provider-catalog`) and
contains **no delta block at all** for the three capabilities in question; the
proposal and design explicitly list them as unchanged. The only two honest
qualifications are (a) the shipped website's single provider exposes no domain
API, so the manual-row and manual-failure arms are _specified and guarded in
shared code_ but are not exercised on this client today, and (b) this is a
static reading: no test suite, browser tier or rendered pixel was observed.

---

## 1. The exact claim under test

- `openspec/changes/m22-provider-catalog-foundations/tasks.md:70-72` — task 5.5:
  "Verify the website needs no code change: its existing picker and guards
  already satisfy the selection requirement, and no `website-client`,
  `page-composition` or `visual-system` requirement is modified."
- `openspec/changes/m22-provider-catalog-foundations/design.md:119-124` — D8:
  "Website is preserved, not extended"; the picker, generation token,
  coalescing, five regions, four actions and reduced-motion behaviour already
  satisfy the new selection requirement.
- `openspec/changes/m22-provider-catalog-foundations/proposal.md:42-47` — adds
  the UX to the **extension** popup and states "The website's existing picker,
  five-region composition, four actions, tokens and Temp Mail-inspired layout
  are preserved unchanged"; `proposal.md:82-84` lists `page-composition`,
  `visual-system` and `website-client` as **Unchanged**.
- Requirement text: `.../specs/provider-catalog/spec.md:111-124` (body) and its
  five scenarios at `:126-160`.

The delta directory holds exactly four capabilities — `provider-abstraction`,
`provider-adapters`, `provider-catalog`, `shared-domain-model` (shell check:
`Get-ChildItem .../specs -Directory`) — with `## MODIFIED Requirements` in the
three pre-existing ones and `## ADDED Requirements` in `provider-catalog`.
**There is no delta file, and therefore no changed requirement, for
`website-client`, `page-composition` or `visual-system`.** At sync, those three
promoted files will be byte-identical.

---

## 2. Clause-by-clause evidence from the shipped website

| Delta clause (provider-catalog spec)                                                                | Shipped evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Verdict                                                                                              |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Four actions Copy / Refresh / Change / Delete; no change to them (`:121-124`, `:158`)               | `apps/web/src/ActionToolbar.tsx:105-149` renders exactly four `<button>`s with labels Copy, Refresh, Change, Delete and test ids at `:109,118,131,145`; module note `:3-7`. Browser guard: `apps/web/e2e/sections.spec.ts:50-56` (`TOOLBAR_ACTIONS`) and `:188-216` (count, `type=button`, exact accessible names, plus a planted fifth-button negative control). Keyboard guard: `apps/web/e2e/focus.spec.ts:756-787` requires all four names be reachable by Tab with a visible, product-drawn ring.                                                                                                                                                                                                                    | Satisfied                                                                                            |
| Automatic offered first (`:129-131`)                                                                | `apps/web/src/DomainPicker.tsx:25-27` — the Automatic button is the first element of the dialog, before the list or empty state. Page-level proof: `apps/web/src/App.test.tsx:235-241`, `apps/web/src/recovery.test.tsx:140-143` press Change then select "Automatic".                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Satisfied                                                                                            |
| Manual rows only when more than one usable choice exists (`:113-115`, `:131`)                       | `apps/web/src/DomainPicker.tsx:28-32` renders an empty-state sentence when `domains.length === 0`; `:34-46` renders manual `@domain` rows only in the `else`. The list is provider-sourced and unusable entries are removed upstream: `apps/web/src/App.tsx:84-100` flattens `createDomainCatalog(provider).listDomains()` for configured providers only, with a `cancelled` stale-response guard; `packages/providers/src/catalog.ts:56-67` drops foreign, duplicate, inactive and expired entries. The site currently has one reachable provider (`apps/web/src/App.tsx:85-88`) so the empty branch is what ships.                                                                                                      | Satisfied                                                                                            |
| Failed choice: concise error, retry, no silent substitution (`:115-117`, `:133-138`)                | `apps/web/src/MailboxFailure.tsx:63-89` renders the condition, the provider's own words, the verbatim rate limit when present, and a **Try again** button; wired at `apps/web/src/App.tsx:201-203` to `retry` (`useMailboxSession.ts:425-428`). No substitution: `packages/providers/src/manager.ts:73-83` skips any provider whose id does not own the chosen domain and `packages/mailbox/src/session.ts:562-567` turns a throw into `failure`, never a different domain. `website-client` already requires visible, retryable failure at `openspec/specs/website-client/spec.md:221-238`.                                                                                                                              | Satisfied (capability holds in shared code; the manual arm is not exercised on this client — see §4) |
| Inbox stable during Refresh (`:106` GOAL; no region/token change)                                   | `packages/mailbox/src/state.ts:107-125` — `checking` and `checkFailed` both carry `InboxListing`; `apps/web/src/Inbox.tsx:34-38, 123-147` keeps `checked` and `checking` producing the same rows and appends the "Checking again" note, preserving row identity; browser guard at `apps/web/e2e/motion.spec.ts:761-842` ("a row already on the page is not re-materialised by a later poll", element-identity marker read while `inbox-rechecking` is visible).                                                                                                                                                                                                                                                           | Satisfied                                                                                            |
| Reader cleared after a successful Change (`:119-120`, `:148-152`)                                   | `apps/web/src/useMailboxSession.ts:430-453` `replace(domain?)` calls `session.replace(domain)` with `keepCurrent = true`, so the previous `ready` state stays truthful until confirmation; `packages/mailbox/src/session.ts:505-507` `replace` delegates to `open(domain?)`, which resets inbox **and** opened tracker together at `:462-473` (`opened.reset()` at `:470`); `packages/mailbox/src/opened.test.ts:549-555` proves `reset()` forgets the reported message. `App.tsx:228-237` renders `MessageView` only from `state.opened`, so the cleared selection disappears with the new mailbox.                                                                                                                      | Satisfied                                                                                            |
| Coalesce repeated presses; discard out-of-order answers (`:117-118`, `:140-146`)                    | `apps/web/src/useMailboxSession.ts:228-236` `replacePending` guard, `:430-438` early return on a second press; `:207-226` monotonic `generation` + `inFlight` count; `:302-362` each run takes a token, outcomes from stale tokens are dropped at `:339,345`; `:534-552` suppresses `ready`/`failed`/`creating` publishes while a run is in flight so a stale `subscribe` answer cannot win. `ActionToolbar.tsx:127-128` also disables Change while changing. Falsifiable unit evidence: `apps/web/src/recovery.test.tsx:1046-1094` ("one create for two rapid replaces") and `:1101-1140` ("does not let an older create response overwrite a newer mailbox"); the page-level structural case is `App.test.tsx:243-254`. | Satisfied                                                                                            |
| Previous mailbox kept until provider confirms (`:119`, `:151`)                                      | `useMailboxSession.ts:321-324` comment and `keepCurrent` path; `:546-548` defers the `creating` transition during a replace; `App.test.tsx:243-248` asserts the old address and the hero are still on screen while the Change is in flight.                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Satisfied                                                                                            |
| Keyboard reachable, no removed control, no reduced touch target (`:123-124`, `:160`)                | `apps/web/e2e/focus.spec.ts:756-787` Tabs to every toolbar control and checks a non-`auto`, visible ring; `apps/web/e2e/responsive-a11y.spec.ts:6` names the keyboard path and `:52-58` asserts no horizontal overflow at 360–1440 px; picker options themselves carry focus-visible tokens at `apps/web/src/styles.css:259-286`. No control is removed by the new requirement, and the website adds no new control (its picker already exists), so no touch target is reduced.                                                                                                                                                                                                                                           | Satisfied                                                                                            |
| Reduced motion preserved (`:123`)                                                                   | `apps/web/e2e/responsive-a11y.spec.ts:79-90` requires `document.getAnimations()` to be empty under `prefers-reduced-motion: reduce` at mobile width; `apps/web/e2e/motion.spec.ts` (reduced-motion cases at `:892, 963`) guards the three materialisations; token/motion set is unchanged in source (`apps/web/src/styles.css`, no new rule for this change).                                                                                                                                                                                                                                                                                                                                                             | Satisfied                                                                                            |
| Five regions, four actions, no new region/token/motion/config card/counter (`:121-124`, `:154-160`) | `apps/web/src/sections.ts` `PAGE_ORDER = ["product","explainer","articles","reference","footer"]` and `REGION_HOOKS` (five entries); `apps/web/e2e/responsive-a11y.spec.ts:37-50` requires every declared region present and in order at five viewports and `:59` asserts `PAGE_ORDER` has length 5; `apps/web/e2e/sections.spec.ts:188-216` holds the four actions and `:218-249` forbids the removed marketing sections with a planted-heading positive control; `sections.spec.ts:416-450` sweeps the served stylesheet for literal colour/radius/spacing/type size. `App.tsx:259-265` renders the regions outside the toolbar; no sixth region is introduced.                                                         | Satisfied                                                                                            |
| Domain choice is not a provider selector (`:121`)                                                   | `apps/web/src/DomainPicker.tsx:34-46` labels rows as `@domain.name` only and offers no provider choice; `apps/web/src/App.tsx:85-88` sources them from provider catalogs. `website-client` at `openspec/specs/website-client/spec.md:20-25, 48-53` requires no provider selector; D7 (`design.md:109-117`) records the disambiguation.                                                                                                                                                                                                                                                                                                                                                                                    | Satisfied                                                                                            |

---

## 3. Do any of the three promoted capabilities need modification?

**No.** Three independent checks agree:

1. **No delta block exists for them.** The M22 delta directory contains only
   `provider-abstraction`, `provider-adapters`, `provider-catalog` and
   `shared-domain-model` (verified with `Get-ChildItem .../specs -Directory`).
2. **The approved documents say so.** `proposal.md:82-84` lists all three as
   Unchanged; `design.md:45-47` repeats it as a non-goal; `design.md:119-124`
   (D8) states the website stays compliant without a code change; `tasks.md:70-72`
   asks only for this verification.
3. **The new requirement is written generically** — "Where a client offers
   domain choice" (`provider-catalog/spec.md:113`) — so a client that already
   offers choice is compliant by construction, and the "five regions and four
   actions" scenario (`:154-160`) is a _no-change_ assertion satisfied by the
   existing browser guards in §2. Adding a requirement to these capabilities
   would be the "two requirements about one subject" shape this repository
   records as a second spelling of a set.

The promoted specs remain authoritative and untouched:
`openspec/specs/website-client/spec.md` (failure retry at `:221-238`, four-state
render at `:258-312`, address at `:151-192`),
`openspec/specs/page-composition/spec.md` (five ordered regions at `:21-79`,
declared values at `:170-196`), `openspec/specs/visual-system/spec.md` (tokens
at `:11-43`, no third-party asset at `:45-77`, focus at `:104-134`, contrast at
`:136-162`, motion at `:164-180`). Nothing in §2 contradicts them.

---

## 4. Product code change needed?

**None.** The smallest fix for clause X is "no edit": each clause is already
backed by named production code and an existing assertion (§2).

Two honest qualifications, neither a gap requiring work in this change:

- **Manual-row / manual-failure arms are unexercised on this client.** The
  website's only provider (Guerrilla Mail) exposes no domain API
  (`apps/web/src/App.tsx:85-88`); `domains` is therefore empty and
  `DomainPicker.tsx:28-32` always shows the empty-state sentence. The manual
  path exists in source and is filtered/guarded in shared code
  (`catalog.ts:56-67`, `manager.ts:73-83`), but no shipped website test drives a
  manual choice. This is a **coverage limit**, not a missing capability, and
  task 5.5 does not ask to add website tests. If the orchestrator wants a
  positive control, the smallest option is a `DomainPicker` unit case with a
  two-domain fixture asserting Automatic is first and both `@domain` rows
  render — a test-only addition, not a product change.
- **The five-region inventory was renamed at M17, not removed.** The promoted
  `page-composition` requirement still says "five regions"
  (`openspec/specs/page-composition/spec.md:21`), and the shipped inventory is
  the M16-derived `product / explainer / articles / reference / footer`
  (`sections.ts` `PAGE_ORDER`, `REGION_HOOKS`; guard at
  `responsive-a11y.spec.ts:37-59`). The count is five in both the spec and the
  DOM, so the delta's "five regions unchanged" scenario holds. The old M7
  explanatory headings are gone (`sections.spec.ts:6-8, 64-68`), but that is an
  M17 reconciliation already complete, not an M22 concern and not a new gap.

---

## 5. What this check does NOT establish

- **No runtime verification was performed.** This is a static file:line read.
  No `pnpm test`, `pnpm verify`, website browser tier, or falsification pass was
  run for this report (the task is read-only analysis). The browser cases cited
  are evidence that guards _exist_; their green/red status was not observed
  here.
- **No rendered-pixel judgement.** Nothing here says the picker, toolbar or
  page looks right at any viewport; that remains a human acceptance matter, as
  the repository's existing limits record.
- **No live provider or delivery claim.** The website's empty domain list is a
  provider-capability fact, not a permission or delivery finding; all provider
  and delivery status rows stay as recorded by other workers.
- **No claim about the extension.** Tasks 5.1–5.4 own the extension Change path;
  this report only verifies the website half.

---

## 6. Commands run (exact)

- `git status --short --branch` → `## research/website-selection-check`
- `git branch -vv` → branch created from `27e4682`, initially no upstream
- `git push -u origin research/website-selection-check` → new branch, upstream
  set to `origin/research/website-selection-check`
- `pnpm install --frozen-lockfile` → `Done in 19.5s using pnpm v12.6.0`
  (266 packages, `node_modules` had been absent in this fresh worktree)
- `Get-ChildItem .../specs -Directory` → the four capability delta directories
- `Select-String` over the delta specs for `## (ADDED|MODIFIED|REMOVED)
Requirements` → 3 MODIFIED, 2 ADDED headings, none in the three capabilities
- `openspec list` → one active change (`m22-provider-catalog-foundations`, 0/23
  tasks)
- Prettier on this file: recorded in the worker's final report.

Everything else was `read`/`grep`/shell `Get-ChildItem` over the files cited
above; no build, test, browser or mutation command was run.
