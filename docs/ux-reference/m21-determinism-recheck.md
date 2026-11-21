# M21 — Extension tier determinism recheck

Date: 2026-11-22. Tree: `main` at `54b175d` (branch `test/extension-browser-determinism`).

This is a recheck, not a repetition of the M21 audit. `m21-determinism.md` recorded five clean
runs after its two precondition repairs; `m21-coverage-matrix.md` section D row 3 and the ROADMAP
Project Status line 54 still described extension determinism as unverified or flaky. This file
re-measures the current tree and closes that discrepancy with a fresh five-run block.

## What was run, and only this

Each of the five runs executed this exact sequence, on the same tree, consecutively:

```bash
pnpm --filter @spectre-mail/extension build \
  && pnpm --filter @spectre-mail/extension build:fixture \
  && pnpm --filter @spectre-mail/extension test:browser
```

The **extension tier only** was run. Root `pnpm test:browser` was deliberately not used, because
it would start the website tier's `vite preview` on port 4173 and collide with other workers. The
extension tier has no `webServer`; it loads `apps/extension/dist` as an unpacked context. Each run
rebuilt both the extension bundle and the in-page fixture before testing, so no run read a stale
`dist/` left by the previous one.

Before this block, the two precondition repairs named in `m21-determinism.md` were confirmed
present in `apps/extension/e2e/in-page-create.spec.ts`: the recorder read after the waiting label
is `expect.poll(() => creationsRequested()).toBe(1)` (line 425, not a single read), and the live
creation's field assertion derives its timeout from the product's own
`IN_PAGE_CREATE_CEILING_MS + 15_000` (lines 292-294, not Playwright's 5-second default).

## Per-run results

| Run | Exact summary line  | Exit code |
| --- | ------------------- | --------- |
| 1   | `109 passed (3.0m)` | 0         |
| 2   | `109 passed (2.1m)` | 0         |
| 3   | `109 passed (2.3m)` | 0         |
| 4   | `109 passed (2.3m)` | 0         |
| 5   | `109 passed (2.3m)` | 0         |

Each run also produced 109 `ok` case lines in `[chromium]` and no `failed`, `did not run`, or
`Error:` line. Wall-clock window: 2026-11-22T00:57:09+08:00 to 2026-11-22T01:09:46+08:00.

Raw logs: `C:\Users\Edison\AppData\Local\Temp\opencode\determinism-recheck-run{1..5}.log`.
Consolidated record: `C:\Users\Edison\AppData\Local\Temp\opencode\determinism-recheck-results.txt`.

## Root-cause analysis

Not applicable. No run failed, so there was no defect to isolate. No assertion was weakened, no
timeout enlarged, no case disabled, and no file under `apps/extension/e2e/**` was edited. No
product code was edited. The two repairs this block verifies were already in the tree when it
began; this change adds evidence only.

## Fix description

None. No fix was required.

## Verdict

**DETERMINISTIC.** Five consecutive full extension-tier runs on this tree each reported
`109 passed` with exit code 0. There are no concrete remaining flake rows in this tier on this
machine at this tree. The earlier load-driven live-domain flakes recorded in `m19-journey-report.md`
and `m20-verification.md` do not reproduce here; this block supersedes that 108-109/109 record for
the current tree rather than rounding it into a green figure.

### What this does not establish

Five runs are a sample on one machine (Windows 11, this Chromium), not a proof under every load.
This block measures the extension tier only; the website tier and root `pnpm test:browser` were not
run here. As throughout this repository, no test reads a rendered pixel, so determinism of these
assertions says nothing about human acceptance of the interface. No live provider is contacted:
every provider response is a recording served by the harness.
