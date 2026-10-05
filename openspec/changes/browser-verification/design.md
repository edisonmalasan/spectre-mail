# Design

## Context

See `proposal.md` — Why. What shapes the approach here, measured rather than recalled:

- **`jsdom` implements no IndexedDB.** `createBrowserStorage()` — the function
  `apps/web/src/main.tsx` reaches by default, through `createWebsiteStorage()` — is
  executed by **no test in the workspace**. The client suites inject a `SpectreStorage`
  instead, because substituting `fake-indexeddb` would substitute a fake rather than a
  browser.
- **`apps/web/src/App.tsx` takes `session` and `storage` as optional props**, and
  `main.tsx` renders `<App />` with neither. So the injection seam exists for tests, and
  the shipped composition is the one that builds its own provider manager and its own
  storage. A browser suite therefore has to serve the real entry point to test it; it
  cannot mount `App` with props and still be testing the shipped path.
- **Two boundary rules collide with a browser suite**, both found by reading them rather
  than by being surprised:
  - `clientStorageApiViolations()` skips `*.test.tsx?` while its documented rule is that
    *a test may reach the store in order to verify it*. A browser spec asserting on
    `indexedDB.databases()` is a test doing exactly that and would be reported as a
    client reaching a store. **This is the twenty-first instance of a check narrower than
    its rule.**
  - The collection rule watches `*.test.tsx?` under `PACKAGES_DIR` and `APPS_DIR`. It
    resolves the configured Vitest globs against the real files so an undiscovered test
    fails. A Playwright spec matches neither its filename filter nor its globs, so it
    would be **invisible** — the silent-skip failure this repository was bitten by at M5
    slice 1, when a client test was skipped and read as covered.
- **Playwright 1.63.0 is already used by the spike**, outside the workspace, via
  `playwright-core` and `chromium.launchPersistentContext`. Its exclusion is documented
  in `pnpm-workspace.yaml` with three reasons, the first being that every root
  `pnpm install` would pull Playwright's graph for contributors who will never run it.
- **`packages/providers` holds recorded fixtures** for both adapters, driven by a
  shared conformance suite. Those responses are what the browser suite serves.
- **CI runs two jobs** (`verify`, `spike self-test`), neither of which installs a browser.

## Goals / Non-Goals

**Goals:**

- Execute `createBrowserStorage()` against real IndexedDB, through the real entry point,
  and assert on device state afterwards.
- Add a verification tier that CI runs, and that the aggregate command does not.
- Correct every document that says the storage path is unverified, and keep the claims
  that genuinely remain unverified **stated as unverified**.

**Non-Goals:**

- **Fixing anything the suite finds.** `packages/storage`, `packages/mailbox`, and
  `apps/web/src` are not edited by this change. A defect is recorded and fixed by a later
  change with its own evidence; weakening an assertion to make this change green is the
  one outcome that would destroy the tier's value.
- Any live-provider check, including a smoke run.
- The extension, MV3 host permissions, or `spike:interactive` delivery evidence.
- Visual, motion, focus, or contrast work — all M7's, and none of it observable by a
  functional suite.

## Decisions

### D1 — The suite serves the built site, and the page under test is the shipped entry point

`playwright.config.ts` starts `vite preview` against `apps/web/dist` and the specs
navigate to `http://127.0.0.1:<port>/`. The page that runs is `main.tsx`'s `<App />`, with
no injected props, so it builds `createWebsiteProviderManager()` and `createBrowserStorage()`
itself.

**Alternative rejected: mounting `<App session={stub} storage={real} />` in the browser.**
It would let a spec drive a mailbox without any provider traffic at all, and it is
tempting for exactly that reason. But it tests a composition no user ever gets — the one
decision this tier exists to verify is the page's *own* wiring, and a prop-injected page
proves the wiring only for the paths a spec remembered to inject. The provider is stubbed
one layer lower, at the network, which leaves the shipped composition intact.

### D2 — Provider traffic is served by request interception, from committed fixtures

`page.route()` intercepts `https://api.guerrillamail.com/**` and answers from the recorded
conformance fixtures, and any other external origin is aborted and recorded as unexpected.
An aborted request surfaces as a visible failure with the offending URL, so a page that
reaches somewhere unrecorded **fails** rather than silently passing against nothing.

**Alternative rejected: a live smoke run against the real API.** It would observe real CORS
and the real cadence, which is genuinely tempting. Rejected on the property that every
other check in this repository runs from recorded responses: a red run must mean the
repository's behaviour changed. A live run's red cannot say that, it is unreproducible,
and it would make a routine CI check depend on a third party's uptime. Recorded as a
**live** check per the new `build-and-verification` requirement, never added to `verify`.

**The cadence claim is therefore still unproven, and stays written as unproven.** No
fixture can tell us what a provider does when polled every five seconds.

### D3 — `pnpm test:browser` is a separate root command and is not in `pnpm verify`

`verify` must keep working on a machine with no Chromium, or it becomes a gate that fails
for an environmental reason and gets ignored — the failure mode of every gate that
requires something nobody has. The browser tier gets its own script and its own CI job.

The trade-off is accepted deliberately: a second tier is a thing that can rot. It is
mitigated by CI running it on every PR, which is the only mitigation that works — a
documented-but-unrun command is the deferred-verification pattern this repository already
records and is trying to stop.

### D4 — Playwright becomes a dev dependency of `apps/web`, not the root

Root-level would put Playwright's graph in every contributor's install, which is reason 1
in `pnpm-workspace.yaml` for keeping the spike out. `apps/web` is the only package whose
tests need it, and it is already the package carrying `jsdom` and `@testing-library/react`
for exactly this reason — a DOM had to be brought in because a requirement about what is
rendered could not otherwise be verified.

`pnpm-workspace.yaml` is **not edited**: it excludes `tests/provider-spike`, and the spike
stays outside. This change reverses nothing there.

### D5 — The two boundary rules are widened, and both widenings are corrections

- **`clientStorageApiViolations()`** stops filtering on `*.test.tsx?` and instead exempts
  **any test file, by kind**, so `*.spec.ts` under `apps/` is treated as the test its rule
  says it is. The rule's own comment says "install `fake-indexeddb` on the global or stub
  a clipboard" — it means *tests*, and it spelled that as a filename.
- **The collection rule** gains a second subject: every browser spec under `apps/` and
  `packages/` must be matched by the browser suite's configured patterns. A spec placed
  anywhere else is reported by name.

**Both follow the shape M6 slice 1 drove these rules to**, for the same reason: the scan
takes **no argument** about which directories to look at, and the roots are checked against
**the directory contents on disk**, so a new client or a new spec location is covered by
being created rather than by being listed. Each rule asserts its positive and negative
halves **in one test through one call site**, and each carries a mutation to prove the
control is not the rule.

**The falsification pass is not optional here.** This repository has shipped twenty checks
narrower than their rule, and the two rules being widened are among the most-asserted in
it. A control that calls the scan function is not a control on the rule; that mistake was
made three times at slice 1.

### D6 — The suite asserts on device state, not on return values

The central assertions read `indexedDB.databases()` **after** the fact and ask whether
the database is still there. "A call that resolved and left its data behind" is precisely
what a return-value assertion cannot see, and it is the failure mode a privacy control
must not have.

### D7 — Claims that remain unverified are corrected in place, not softened

`use it externally` stays UNVERIFIED. So does the live-cadence question. `AGENTS.md`,
`README.md`, and `docs/ROADMAP.md` currently carry five documents' worth of "this has never
run in a browser" language; after this change most of it is false and the remainder must
still be true. **Deleting a sentence that became false, rather than rewording it**, is the
treatment three of those claims already received — and the reason is that a stale claim
reading like a security guarantee is the most damaging kind of wrong on a page.

### D8 — An unrecognised record kind is planted in the browser, because that is the whole point of deleting the database

The "clear everything, not just what we recognise" clause has only ever been asserted
against the substitute. The browser suite plants a store this build does not recognise and
requires it to be gone — which is the assertion that distinguishes `deleteDatabase` from
`CURRENT_MAILBOX_KEY`, and it is the one that could actually fail.

## Risks / Trade-offs

- **Chromium download size and CI time.** → A separate job with its own timeout, so it
  cannot slow the `verify` job, and `verify` cannot fail because of it.
- **The suite's fixtures drift from `packages/providers`.** → It reads the committed
  fixtures rather than restating them, and a missing one fails loudly with the URL.
- **Playwright's version is a floating download.** → Pinned exactly, like every other
  dependency here, and the version recorded in `AGENTS.md` when verified.
- **A green browser suite could be read as "verified the product".** → D7 and a new
  `build-and-verification` requirement state the limits explicitly, and the run's record
  names both the platform it ran against and the substrate it does not speak for.
- **Two tiers can disagree, and the disagreement is the valuable case.** Recorded, not
  suppressed: if only the browser tier fails, the substitute is what diverged, and the
  new `spectre-storage` scenario says the platform wins.
- **A second tier is a thing that rots** if CI ever stops running it. → CI is the only
  mitigation; recorded rather than assumed away.
