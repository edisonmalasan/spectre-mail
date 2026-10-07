# Tasks

## 1. Proposal stage

- [x] 1.1 Record the two user decisions verbatim in `design.md` — the background service worker
      carries **no polling** and the lifetime is measured before any decision about where the
      session lives (D1); the **content script and side panel are deferred** to M9 and M11 and
      their absence is a requirement (D2 in the proposal, `extension-client`)
- [x] 1.2 Record the deferred live host-permission check as **this milestone's deliverable**, with
      its negative half and its quarantine from `pnpm verify` (D4)
- [x] 1.3 Record that the `chrome.storage` adapter belongs in `packages/storage` and that the
      client storage rule gets **no** carve-out for it (D2)
- [x] 1.4 Validate: `openspec validate extension-foundation --type change --strict` → `Change
      'extension-foundation' is valid`

## 2. Record the baseline before any edit

- [x] 2.1 `pnpm verify` with `PLAYWRIGHT_BROWSERS_PATH` at an empty directory — record the test
      count **and the per-project split** from Vitest's JSON reporter, not a summary line
- [x] 2.2 `pnpm test:browser` once, to confirm the 34-case website suite is green before the
      change
- [x] 2.3 Record the boundary count, so the deltas to that file are attributable
- [x] 2.4 Read `apps/extension/tsconfig.json` and record `files: []` as the placeholder it is

## 3. Build the extension's foundation

- [x] 3.1 Add the MV3 manifest with host permissions in the **wildcard path form**, and no
      content script, no side panel, and no unused permission
- [x] 3.2 Add the background service worker with **no polling loop and no alarm**, and assert both
      absences
- [x] 3.3 Add the extension's build, producing a loadable unpacked directory; prefer the bundler
      already in the lockfile and record the reason if a new one is needed
- [x] 3.4 Wire the root `build` to build **both** clients, and fail when either emits nothing
- [x] 3.5 Give `apps/extension/tsconfig.json` real inputs; the placeholder's `files: []` goes, and
      its `DOM` lib stays

## 4. `chrome.storage` adapter

- [x] 4.1 Add the adapter to `packages/storage` beside the IndexedDB one, implementing the
      existing contract through the **shared** narrowing code
- [x] 4.2 `clearAll` empties the whole storage area, not the one key — with a planted key the
      build does not recognise, as the IndexedDB adapter's test already does
- [x] 4.3 Document the platform differences: per-write confirmation rather than a transaction, and
      no blocked-removal event because there is no `deleteDatabase`
- [x] 4.4 Confirm the client storage boundary rule needed **no** carve-out, and that dropping the
      adapter into `apps/extension` **fails** the rule

  > **Amended during apply (2026-10-07), because the premise was false and the measurement
  > is the finding.** Planting the real adapter under `apps/extension/src/` left the rule
  > **silent** — `0 failed, 53 passed`, twice. `chrome.storage` was in neither storage
  > pattern, so the rule D2 rested on could not see the one store a second client uses.
  > This is the **thirtieth** recorded instance of a check narrower than the rule it
  > documents; `design.md` records it as the thirty-first.
  >
  > **The rule was widened** to `chrome\s*\.\s*storage\b`, with a positive control per form
  > (tight and whitespace spellings) and a negative control that prose about the platform
  > stays unreported. **No carve-out was needed**, and that is not luck: both seams were
  > written to avoid the literal spelling, so `D2`'s prediction was right for a reason that
  > did not yet exist.
  >
  > **What is now enforced, stated as measured:** a client that *reaches* `chrome.storage`
  > in code is reported by name; the relocated adapter file is not, because it reaches no
  > store — it takes the area as a parameter and mentions the platform only in prose. The
  > widening was falsified in both directions (narrowed back → unreported; restored → SHA
  > verified). Widening it also found a **real copy defect**: user-facing text in
  > `storage.ts` named an internal API to an end user.

## 5. Provider configuration

- [x] 5.1 `EXTENSION_PROVIDER_IDS = ["mail-tm", "guerrilla"]`, with the registry typed `Record` over
      it so a declared provider with no adapter does not compile
- [x] 5.2 The factory derives from the exported list — the shape `apps/web` was repaired to have
- [x] 5.3 A test that reads the configuration rather than inferring it from output, including the
      **fallback** path, which no client has exercised before
- [x] 5.4 A test that the built manifest's provider host permissions all match the wildcard form,
      **with no network**

## 6. The popup

- [x] 6.1 Create a mailbox, copy the address, name the provider, report status, show an inbox
      count — each through the shared session, none through popup logic
- [x] 6.2 The inbox count comes from an explicit user-triggered check; no ambient polling
- [x] 6.3 No provider selector, and the popup says which provider it will reach rather than
      offering a control that cannot act
- [x] 6.4 Consume `packages/ui` tokens; no literal colour, radius, spacing step, type size, or
      duration

## 7. Boundary rules

- [x] 7.1 Extend the shipped-browser-spec collection rule to read **both** runner configurations,
      and to report an extension spec collected by the website's suite
- [x] 7.2 Verify each new rule with a control per form and a negative control — an assertion
      narrower than the rule it documents is the defect this repository has recorded most often
- [x] 7.3 A rule for "the extension duplicates nothing a package owns", reported by file and
      behaviour

## 8. The extension's browser suite

- [x] 8.1 Its own directory and runner configuration, loading the built extension into a real
      extension context
- [x] 8.2 Chromium only, for the reason the website's suite is Chromium only
- [x] 8.3 A CI job as a sibling of `verify`, running with a per-step ceiling — the previous job hung
      five times and the cause was a job-level ceiling naming no step

  > **Amended during apply (2026-10-07): no new job, and the reason is that the existing
  > one is already the right job.** `browser` is already a sibling of `verify` with its own
  > timeout, and it already runs the documented maintainer command `pnpm test:browser` with
  > no divergent flags. **Adding a second job would have created a third spelling of one
  > command** — the exact drift this workflow's design avoids.
  >
  > What changed instead: the `browser` job now runs **both** tiers under that one command,
  > it gained a **second explicit Chromium install** (`Install Chromium (extension)`), and
  > the test step's ceiling was **raised rather than recalculated**, because both halves are
  > still far inside it and a tighter number would be a guess about a runner this has never
  > been measured on.
  >
  > **The per-step ceiling the task names is the load-bearing part and it is unchanged** —
  > it is what turns a hang into evidence, which is why the previous job hung five times.
  > **The cost of the decision is stated:** one job now carries two suites, so a failure in
  > either is reported under a name that does not say which. A separate job would have named
  > it; the single spelling of the command was judged worth more.

## 9. The measurement, and the one live check

- [x] 9.1 **Measure** the service worker's idle lifetime in real Chromium and record it in
      `docs/PROVIDERS.md`
- [x] 9.2 **Measure** what period `chrome.alarms` accepts in this Chromium and record it
- [x] 9.3 Run the live host-permission check **both ways** — wildcard must succeed, slash-less
      must fail, same run, same origin — and record the real result either way
- [x] 9.4 Keep the live check out of `pnpm verify`, `pnpm test`, and the browser suite; confirm by
      running all three with the network route aborted

## 10. Verification

- [x] 10.1 Falsification: every new assertion observed to fail with the **intended** test named;
      `nocompile`, `green`, `wrongcatch`, `noop`, and `harness-error` are distinct outcomes and
      never passes
- [x] 10.2 Restoration verified by SHA-256 for every mutated file, and the build output rebuilt
      from restored source
- [x] 10.3 `pnpm verify` green with the baseline counts recorded in 2.1 plus only the tests this
      change adds
- [x] 10.4 `pnpm test:browser` green, and the extension's suite green, with both counts recorded
- [x] 10.5 `openspec validate --specs --strict` and `openspec validate extension-foundation
      --type change --strict`

## 11. Record what this does not establish

- [x] 11.1 `use it externally`, the live polling cadence, and a stored mailbox reconciled against a
      live session remain **unverified**; the host-permission check closes one item and no more
- [x] 11.2 No test reads a rendered pixel, so nothing here says how the popup looks
- [x] 11.3 Firefox and WebKit remain uncovered, and adding a project per engine would turn
      "verified" into "verified somewhere"

## 12. Human judgement

- [ ] 12.1 Load the extension in a real browser and **look at it** — deliberately **left
      unticked**. An agent opening the popup is not the judgement this task asks for.