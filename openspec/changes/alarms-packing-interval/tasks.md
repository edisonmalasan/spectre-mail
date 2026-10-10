# Tasks

## 1. Give the probe a record that survives the thing it is measuring

- [ ] 1.1 Add `storage` to `apps/extension/e2e/fixtures/alarm-probe/manifest.json` beside `alarms`, and
      extend the manifest's `description` to name **both** permissions and to state that this is a
      throwaway fixture existing only so a measurement can be taken. Verify: `apps/extension/static/manifest.json`
      still declares `permissions: ["storage"]` and no `alarms`, and `git diff` touches no product manifest.
- [ ] 1.2 Give the probe worker a module-scope UUID (`crypto.randomUUID()`) so every fresh worker load is
      identifiable, and write it onto each recorded firing (design.md D3). Verify: the UUID is generated at
      module scope and not inside a listener, so a restarted worker stamps a different value.
- [ ] 1.3 Add a `chrome.alarms.onAlarm` listener to the probe that appends
      `{ at, name, workerId }` to `chrome.storage.local`, and **keep the file's stated contract true** —
      `probe.js` says it is "a scope, not a program", so if it gains behaviour, that sentence is corrected
      in the same edit rather than left describing a file that no longer matches it. Verify: the header and
      the body agree, read together.
- [ ] 1.4 Re-run the existing `alarm-floor.spec.ts` case against the modified fixture. Verify: it still
      passes, and `pnpm test:browser` reports the extension tier still at **63** cases — the floor
      measurement must be unaffected by the fixture gaining a second permission.

## 2. Write the instrument

- [ ] 2.1 Create `apps/extension/e2e/alarms-packing.mjs`, modelled on `alarm-floor.spec.ts`'s `launchProbe()`
      and using the exported `extensionFlags()` rather than spelling the two flags and the absolute path again.
      Verify: it launches the fixture unpacked and fails **loudly** if no service worker registers, naming
      both requirements rather than returning nothing.
- [ ] 2.2 Create both alarms in one run — `INBOX_POLL_PROMPT_MS` and `INBOX_POLL_CEILING_MS` **imported from
      `packages/mailbox/src/cadence`** rather than restated as literals (design.md D4). Verify: the script
      names the import, and no `5_000` or `30_000` appears as a literal period.
- [ ] 2.3 Compute the run window **from the two candidate firing intervals** rather than hard-coding 120 s,
      and print the derived window and the two predicted counts beside it (design.md D5). Verify: the printed
      arithmetic shows that the window separates the hypotheses by a stated margin, and a window under ~90 s
      would be reported as unable to.
- [ ] 2.4 Put a **ceiling** on the run and report a harness error rather than hanging when it is reached
      (design.md D6 risks). Verify: with the ceiling lowered to a second, the run exits non-zero with a
      harness error and **no measurement**.
- [ ] 2.5 Distinguish the three outcomes in the report: both alarms fired, **only one** fired, and **neither**
      fired — where neither is a harness error and is explicitly not recorded as a measurement of zero.
      Verify: all three are reachable by inspection and the third cannot be printed as a result.

## 3. Measure the worker's idle lifetime separately

- [ ] 3.1 Add a second phase to the script that runs with **no alarm at all**, polling
      `context.serviceWorkers()` and recording the last observation at which the worker was present and the
      first at which it was not (design.md D6). Verify: the phase creates no alarm, which is checked by the
      absence of any `chrome.alarms` call in that phase.
- [ ] 3.2 Word the phase's own output as a **figure** if the worker went away and a **wider bound** if it did
      not — two different wordings, chosen by the outcome, not one wording used for both. Verify: the run
      this repository already has says *"a bound, not a figure"* because it stopped watching at 30 000 ms,
      and the new output does not repeat that phrasing for a longer window that saw nothing.

## 4. Falsify the instrument before trusting its output

- [ ] 4.1 **Positive control on the reader:** plant a known firing into `chrome.storage.local` from outside the
      worker and require the reporting path to return it. Verify: a run whose listener never fires still
      reports the planted record — without this, *"no firings observed"* is indistinguishable from a reader
      that reads nothing.
- [ ] 4.2 **Negative control on the harness-error path:** remove the `onAlarm` listener and confirm the run
      reports a harness error rather than a measured interval of "never". Verify: the output contains no
      interval figure at all.
- [ ] 4.3 **Prove the record is persisted, not held in the live worker:** read the stored record back through a
      fresh `worker.evaluate` after the run, and require it to contain what the worker wrote (design.md D2).
      Verify: the values returned come from `chrome.storage.local`, and the reading call is made after the
      worker has had an opportunity to restart.

## 5. Record what was measured

- [ ] 5.1 Run the instrument and record the observed firing interval for each alarm, **including the inter-firing
      spread** — a mean alone would hide the jitter the answer actually turns on. Verify: the record states the
      number of firings observed, not just the spacing.
- [ ] 5.2 Record the idle-lifetime result with the substrate in the same sentence: Chromium version, Playwright
      version, headless, unpacked. Verify: no sentence states a period without also naming what it was measured on.
- [ ] 5.3 Update `docs/PROVIDERS.md` §4.1's table with the new row, keeping its existing **"What it does not
      establish"** column and filling it honestly. Verify: the column is non-empty for every row.
- [ ] 5.4 Close §5.2's open row or restate it — **not by deleting it**, and not by replacing it with a claim the
      run did not support. Verify: §5.2 either loses that row or says precisely what remains open.
- [ ] 5.5 If the observed interval differs from Chrome's **documented** 30 s packing, record that as a finding
      in its own right and **do not reconcile it silently** in either direction. Verify: the discrepancy is
      visible in the documentation as a discrepancy.
- [ ] 5.6 Record that this is **one run on one substrate**, and that the documented packing rule is stated for
      unpacked extensions while a packed extension is out of scope. Verify: no sentence claims what "Chromium"
      does in general.
- [ ] 5.7 Check §6's roadmap consequences and update only if the answer moves one. Verify: `docs/PROVIDERS.md`
      is otherwise unchanged apart from the sections this change names.

## 6. Quarantine the instrument and prove the repository is unmoved

- [ ] 6.1 Extend the boundary assertion that quarantines `apps/extension/e2e/live-host-permission.mjs` to cover
      the new script, so no suite collects it. Verify: `pnpm test tests/architecture` fails if the script is
      added to a suite's `testMatch`, and passes with it excluded.
- [ ] 6.2 Confirm **no test count moved**: `pnpm test` reports the same totals as before this change, and
      `pnpm verify` exits 0 with `PLAYWRIGHT_BROWSERS_PATH` pointed at an empty directory. Verify: totals counted
      from the reporter grouped by project, not read off a summary line.
- [ ] 6.3 Confirm `apps/extension/static/manifest.json` is byte-identical to its pre-change content, and that
      `git diff` shows no product source under `apps/extension/src`. Verify: `git diff --stat` names only the
      fixture, the script, the boundary test, `docs/PROVIDERS.md` and the change's own artifacts.
- [ ] 6.4 Run `prettier --check .` and `openspec validate alarms-packing-interval --strict`. Verify: both clean.
- [ ] 6.5 Confirm the script's header states that it writes a profile under `apps/extension/test-results/`, so
      any later source fingerprint excludes that directory by name (design.md D7). Verify: the statement is
      present, recorded because a fingerprint sweeping that directory once reported 2930 changed files.
