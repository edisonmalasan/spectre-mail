# Proposal

## Why

`packages/storage`'s 44 tests and `apps/web`'s 112 tests have **never executed the
function a user's browser actually calls**. `jsdom` implements no IndexedDB, so
`createBrowserStorage()` — the entry point `main.tsx` reaches by default — is executed by
**no test in this workspace**, and the adapter's blocked-`deleteDatabase` semantics were
**measured against `fake-indexeddb`, which is not a browser**. A privacy control verified
only against a fake is the claim in this repository least entitled to confidence, and it
has now shipped through two slices with the gap intact.

The same gap hides two more unproven claims: `use it externally` has never been observed,
and **nothing is known about what a provider does when a real page polls it every five
seconds**. `build-and-verification` already requires that a verification which cannot be
performed be *recorded as deferred* rather than reported as passing, and this repository
has been recording it instead of closing it. Time to close it.

## What Changes

- **A browser suite that runs the real website in real Chromium.** It builds `apps/web`,
  serves it, and drives it with Playwright — so the page under test is the built
  artefact, not a jsdom approximation of it.
- **The real storage path is executed for the first time.** `createBrowserStorage()`
  reaches real IndexedDB through the real `deleteDatabase`, covering boot, read, create,
  write, and **the whole-database removal that slice 3 shipped unverified**. The suite's
  central assertion is about **observable platform state after the fact** — does the
  database still exist — rather than about what the adapter returned.
- **Recorded provider responses, no network.** Provider traffic is intercepted and served
  from the fixtures already committed in `packages/providers`, so the suite is
  deterministic and contacts nothing.
- **Two boundary rules widen, and both are corrections rather than exceptions.**
  `clientStorageApiViolations()` exempts `*.test.tsx?` while its stated rule is that *a
  test may reach the store in order to verify it* — narrower than its rule, the defect
  class this repository has recorded twenty times. The collection rule watches
  `*.test.tsx?` under `packages/` and `apps/`; a browser spec placed anywhere else would
  be **invisible to it**, which is the silent-skip failure M5 slice 1 was bitten by.
- **`pnpm test:browser` is a separate root command, and it is NOT in `pnpm verify`.**
  `verify` must keep running on a machine with no Chromium, and a gate that cannot run is
  a gate nobody trusts.
- **A CI job runs it**, installing Chromium itself.
- **Claims that stay unproven are corrected in place, not softened.** `use it externally`
  and the live polling cadence do **not** become verified — both need a real third-party
  signup a test must not perform unattended — and the documents that carry them say so.

## Capabilities

### New Capabilities

- `browser-verification`: driving the built website in a real browser against real
  platform storage, offline, as a check the repository can require to keep passing.

### Modified Capabilities

- `build-and-verification`: adds a second, separately-invoked verification tier that runs
  a real browser, and states what that tier does and does not establish — including that a
  browser suite issuing network requests would violate the repository's offline-by-
  construction property rather than extend it.
- `spectre-storage`: its removal requirement is currently satisfied only against
  `fake-indexeddb`. This change adds the browser-observed behaviour of `clearAll` to what
  that requirement is known to hold, and records `fake-indexeddb` as a substrate whose
  agreement with a browser is now measured rather than assumed.

## Impact

- **New:** `apps/web/e2e/` (Playwright specs), `playwright.config.ts`,
  `pnpm test:browser`. Playwright becomes a **dev dependency of `apps/web`** — the first
  dependency in the workspace to need a browser download.
- **Changed:** `tests/architecture/boundaries.test.ts` (two rules widened, each with a
  positive and a negative control and a mutation to prove the control is not the rule);
  `package.json` (one script); `apps/web/package.json` (one dev dependency); `.gitignore`
  (Playwright artefacts); `.github/workflows/ci.yml` (one job).
- **Unchanged by design:** every shipped source file. `packages/storage`,
  `packages/mailbox`, and `apps/web/src` are **not edited** — the suite verifies what
  exists, and a defect it finds is fixed by a later change with its own evidence, not by
  weakening an assertion here.
- **The extension is out of scope.** Playwright is a spike-only dependency for MV3 host-
  permission work, and M8 owns the extension. Nothing here touches `apps/extension`.
