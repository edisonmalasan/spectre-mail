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
- `website-client`: adds the property whose absence made the removal requirement false on
  the platform — see the scope amendment below.

## Scope amendment, recorded during apply (2026-10-05)

**The Impact section below originally committed that no shipped source file is edited,
and this change now edits one.** That sentence is withdrawn rather than reworded,
because it was a claim about scope and a claim found to be wrong should not survive as a
softer version of itself.

The first browser run measured
`databases=["spectre-mail"] records=1 claimsStored=0 offersRemoval=0`: the website
writes the record and does not know it has, so **the removal control `website-client`
requires is never offered in a real browser**. The cause is a guard in
`apps/web/src/useMailboxSession.ts` scoped to an effect invocation rather than to the
component, so the effect's own cleanup withdraws it when the inbox publishes a new state
object while a real write is in flight. jsdom's stub resolves before that window opens,
which is why 152 existing tests passed.

**`apps/web/src/useMailboxSession.ts` is therefore in scope**, for one repair and one
regression test. The repair is a mounted ref replacing the per-invocation flag; the
`handed` claim that prevents a duplicate write is untouched, because it is correct.

**Nothing else under `apps/` or `packages/` is edited.** The three storage specs assert
on what the page stores and on what the platform holds afterwards — they observe the
product, and a repair to the page is recorded here rather than smuggled into a test that
was supposed to be checking it.

## Impact


- **New:** `apps/web/e2e/` (Playwright specs), `playwright.config.ts`,
  `pnpm test:browser`. Playwright becomes a **dev dependency of `apps/web`** — the first
  dependency in the workspace to need a browser download.
- **Changed:** `tests/architecture/boundaries.test.ts` (two rules widened, each with a
  positive and a negative control and a mutation to prove the control is not the rule);
  `package.json` (one script); `apps/web/package.json` (one dev dependency); `.gitignore`
  (Playwright artefacts); `.github/workflows/ci.yml` (one job);
  **`apps/web/src/useMailboxSession.ts` (the repair described in the scope amendment
  above, and only that)**.
- **Unchanged by design:** every other shipped source file. `packages/storage`,
  `packages/mailbox`, and the rest of `apps/web/src` are not edited. The suite verifies
  what exists, and any further defect it finds is recorded and repaired by its own change
  with its own evidence, not by weakening an assertion here.
- **The extension is out of scope.** Playwright is a spike-only dependency for MV3 host-
  permission work, and M8 owns the extension. Nothing here touches `apps/extension`.
