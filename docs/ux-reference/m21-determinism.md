# M21 — Extension tier determinism evidence

Date: 2026-11-21. Tree: `main` at `71b74e8` plus the two precondition repairs in
`apps/extension/e2e/in-page-create.spec.ts`.

## The two defects found

The independent M21 reviewer recorded that a different live-domain case failed on each full-tier
run and passed in isolation. Root causes, both preconditions rather than assertions:

1. **A direct recorder read before capture.** `requests once per activation` read
   `creationsRequested()` once after the waiting label appeared. The content script sets that
   label before the service worker's request reaches the recorder, so under full-tier load the
   read could see 0 for a request genuinely in flight. The read is now `expect.poll(...).toBe(1)`:
   the gate is still held, so the answer cannot create a second request while polling, and a
   genuinely duplicated press makes the count 2 and fails the exact-1 poll. Both halves of the
   original ordering are preserved.
2. **A 5-second default timeout on a live creation.** `offers to create, and inserts` used
   Playwright's default `toHaveValue` timeout for a flow that fetches Mail.tm domains, creates an
   account and exchanges a token. It now derives its timeout from the product's own
   `IN_PAGE_CREATE_CEILING_MS + 15_000` constant, the same expression the suite already uses for
   another live case — not a hand-picked number.

## Measured result

Five consecutive full extension-tier runs, each rebuilding no source and each at 109 cases:

| Run | Exit | Result            |
| --- | ---- | ----------------- |
| 1   | 0    | 109 passed (2.6m) |
| 2   | 0    | 109 passed (2.5m) |
| 3   | 0    | 109 passed (2.4m) |
| 4   | 0    | 109 passed (2.6m) |
| 5   | 0    | 109 passed (2.8m) |

Raw logs: `C:\Users\Edison\AppData\Local\Temp\opencode\flake-run{1..5}.txt`.

The earlier 108–109/109 record is superseded by this 5-run block, not rounded into it: the two
defects were fixed, and the block was run after the fix. A result that depended on machine load is
now a result that depends on tree state, which is the property this row required.
