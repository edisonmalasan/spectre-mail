# Tasks

## 1. Proposal stage

- [ ] 1.1 Record the two user decisions verbatim in `design.md` — the background service worker
      carries **no polling** and the lifetime is measured before any decision about where the
      session lives (D1); the **content script and side panel are deferred** to M9 and M11 and
      their absence is a requirement (D2 in the proposal, `extension-client`)
- [ ] 1.2 Record the deferred live host-permission check as **this milestone's deliverable**, with
      its negative half and its quarantine from `pnpm verify` (D4)
- [ ] 1.3 Record that the `chrome.storage` adapter belongs in `packages/storage` and that the
      client storage rule gets **no** carve-out for it (D2)
- [ ] 1.4 Validate: `openspec validate extension-foundation --type change --strict` → `Change
      'extension-foundation' is valid`

## 2. Record the baseline before any edit

- [ ] 2.1 `pnpm verify` with `PLAYWRIGHT_BROWSERS_PATH` at an empty directory — record the test
      count **and the per-project split** from Vitest's JSON reporter, not a summary line
- [ ] 2.2 `pnpm test:browser` once, to confirm the 34-case website suite is green before the
      change
- [ ] 2.3 Record the boundary count, so the deltas to that file are attributable
- [ ] 2.4 Read `apps/extension/tsconfig.json` and record `files: []` as the placeholder it is

## 3. Build the extension's foundation

- [ ] 3.1 Add the MV3 manifest with host permissions in the **wildcard path form**, and no
      content script, no side panel, and no unused permission
- [ ] 3.2 Add the background service worker with **no polling loop and no alarm**, and assert both
      absences
- [ ] 3.3 Add the extension's build, producing a loadable unpacked directory; prefer the bundler
      already in the lockfile and record the reason if a new one is needed
- [ ] 3.4 Wire the root `build` to build **both** clients, and fail when either emits nothing
- [ ] 3.5 Give `apps/extension/tsconfig.json` real inputs; the placeholder's `files: []` goes, and
      its `DOM` lib stays

## 4. `chrome.storage` adapter

- [ ] 4.1 Add the adapter to `packages/storage` beside the IndexedDB one, implementing the
      existing contract through the **shared** narrowing code
- [ ] 4.2 `clearAll` empties the whole storage area, not the one key — with a planted key the
      build does not recognise, as the IndexedDB adapter's test already does
- [ ] 4.3 Document the platform differences: per-write confirmation rather than a transaction, and
      no blocked-removal event because there is no `deleteDatabase`
- [ ] 4.4 Confirm the client storage boundary rule needed **no** carve-out, and that dropping the
      adapter into `apps/extension` **fails** the rule

## 5. Provider configuration

- [ ] 5.1 `EXTENSION_PROVIDER_IDS = ["mail-tm", "guerrilla"]`, with the registry typed `Record` over
      it so a declared provider with no adapter does not compile
- [ ] 5.2 The factory derives from the exported list — the shape `apps/web` was repaired to have
- [ ] 5.3 A test that reads the configuration rather than inferring it from output, including the
      **fallback** path, which no client has exercised before
- [ ] 5.4 A test that the built manifest's provider host permissions all match the wildcard form,
      **with no network**

## 6. The popup

- [ ] 6.1 Create a mailbox, copy the address, name the provider, report status, show an inbox
      count — each through the shared session, none through popup logic
- [ ] 6.2 The inbox count comes from an explicit user-triggered check; no ambient polling
- [ ] 6.3 No provider selector, and the popup says which provider it will reach rather than
      offering a control that cannot act
- [ ] 6.4 Consume `packages/ui` tokens; no literal colour, radius, spacing step, type size, or
      duration

## 7. Boundary rules

- [ ] 7.1 Extend the shipped-browser-spec collection rule to read **both** runner configurations,
      and to report an extension spec collected by the website's suite
- [ ] 7.2 Verify each new rule with a control per form and a negative control — an assertion
      narrower than the rule it documents is the defect this repository has recorded most often
- [ ] 7.3 A rule for "the extension duplicates nothing a package owns", reported by file and
      behaviour

## 8. The extension's browser suite

- [ ] 8.1 Its own directory and runner configuration, loading the built extension into a real
      extension context
- [ ] 8.2 Chromium only, for the reason the website's suite is Chromium only
- [ ] 8.3 A CI job as a sibling of `verify`, running with a per-step ceiling — the previous job hung
      five times and the cause was a job-level ceiling naming no step

## 9. The measurement, and the one live check

- [ ] 9.1 **Measure** the service worker's idle lifetime in real Chromium and record it in
      `docs/PROVIDERS.md`
- [ ] 9.2 **Measure** what period `chrome.alarms` accepts in this Chromium and record it
- [ ] 9.3 Run the live host-permission check **both ways** — wildcard must succeed, slash-less
      must fail, same run, same origin — and record the real result either way
- [ ] 9.4 Keep the live check out of `pnpm verify`, `pnpm test`, and the browser suite; confirm by
      running all three with the network route aborted

## 10. Verification

- [ ] 10.1 Falsification: every new assertion observed to fail with the **intended** test named;
      `nocompile`, `green`, `wrongcatch`, `noop`, and `harness-error` are distinct outcomes and
      never passes
- [ ] 10.2 Restoration verified by SHA-256 for every mutated file, and the build output rebuilt
      from restored source
- [ ] 10.3 `pnpm verify` green with the baseline counts recorded in 2.1 plus only the tests this
      change adds
- [ ] 10.4 `pnpm test:browser` green, and the extension's suite green, with both counts recorded
- [ ] 10.5 `openspec validate --specs --strict` and `openspec validate extension-foundation
      --type change --strict`

## 11. Record what this does not establish

- [ ] 11.1 `use it externally`, the live polling cadence, and a stored mailbox reconciled against a
      live session remain **unverified**; the host-permission check closes one item and no more
- [ ] 11.2 No test reads a rendered pixel, so nothing here says how the popup looks
- [ ] 11.3 Firefox and WebKit remain uncovered, and adding a project per engine would turn
      "verified" into "verified somewhere"

## 12. Human judgement

- [ ] 12.1 Load the extension in a real browser and **look at it** — deliberately **left
      unticked**. An agent opening the popup is not the judgement this task asks for.