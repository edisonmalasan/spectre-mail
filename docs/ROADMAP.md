# SpectreMail Development Roadmap

> **Status:** Draft approved for implementation planning  
> **Repository:** `edisonmalasan/spectre-mail`  
> **Architecture:** Monorepo — website + extension + shared packages  
> **Initial delivery strategy:** Website first, extension immediately after the shared core is stable  
> **Initial infrastructure target:** $0 paid backend infrastructure  
> **Website provider:** Guerrilla Mail — the only provider reachable from a browser web page  
> **Extension providers:** Mail.tm (primary) + Guerrilla Mail (fallback) — roles changed by M0, see `Project Status`
> **Visual direction:** Spectral Swiss Utility  
> **Current public name status:** `SpectreMail` is a project codename until final naming/brand checks are complete

---

## Project Status

> This block is the root orchestrator's progress ledger. It is **not** the behavioral
> source of truth — `openspec/specs/` and the active OpenSpec change artifacts are.
> Reconcile this block against Git and OpenSpec before trusting it in a later session.
>
> `openspec/specs/` holds four capabilities: `provider-abstraction` (promoted from
> `provider-role-decision`), `monorepo-foundation` (M1), `shared-domain-model`
> (M2), and `provider-adapters` (M3). M0's own capability spec was archived with
> `--skip-specs` deliberately: it specifies a harness that M1/M3 must delete, so
> landing it would create permanent spec debt for disposable scaffolding.

**Roadmap cursor:** M4 - Mail Parsing Engine (**not started**). **M3 completed its
full lifecycle**: propose PR #17 (`7f20877`), apply PR #18 (`fe54b22`),
verification repairs PR #19 (`ede63bb`), sync PR #20 (`ffdaa13`), archive PR #21,
archived at `openspec/changes/archive/2026-10-02-provider-layer/` with its delta
promoted to `openspec/specs/provider-adapters/spec.md` - 12 requirements,
30 scenarios - and **three of those scenarios amended during sync** after the
implementation revealed the original wording to be unsatisfiable.

M2's lifecycle was propose PR #12, apply PR #13, verification repairs PR #14, sync
PR #15, archive PR #16 (`49b1bfa`), archived at
`openspec/changes/archive/2026-10-02-shared-domain-model/`.

M3 added a capability, not a feature. **No client consumes `packages/providers`**, so
the site and the spike were untouched by it and no test can assert a user-visible
outcome. `openspec validate --specs --strict` reports **5 passed, 0 failed**, and
**no active OpenSpec change remains**.

**The M3 verification pass found two requirement scenarios with no implementation
behind them, after apply had ticked every box.** Recorded because the pattern is
the point: ticking a task is not the same as implementing its verification clause.

1. **CRITICAL.** *Optional capabilities are discoverable, not assumed* requires an
   unsupported operation to be reported as `UNSUPPORTED_OPERATION` naming the
   operation. Nothing implemented it. Invoking `guerrilla.destroyMailbox(...)`
   raised `TypeError: provider.destroyMailbox is not a function` - not a
   `SpectreError`, so no layer knowing only the closed error vocabulary could
   catch, present, or recover from it. Repaired by
   `packages/providers/src/operations.ts`; proven load-bearing twice.
2. **CRITICAL, and structurally invisible.** *The provider layer does not persist
   anything* had **no behavioural test**. Every test in the package built a fresh
   adapter per call, so an adapter that cached the first mailbox's credentials
   would have passed all 80 tests - the cache would never be read by a test handing
   over a different mailbox. Repaired with one test per adapter driving a single
   adapter instance across two mailboxes; both proven load-bearing by injecting a
   real cache into each adapter.

   The first injection attempt was itself defective - it assigned the token before
   returning it, so behaviour was unchanged and the new test passed while a
   *different* test failed. A mutation that does not introduce the defect proves
   nothing about the assertion it is meant to test.

### M3 decisions, recorded so M4 builds against them rather than re-deciding

- **The contract has no subscription method at all** - not optional, absent.
  Measured: five SSE candidate paths and two WebSocket candidates were probed and
  none connected. `GET /messages/events` answers `406` for
  `Accept: text/event-stream` and `404` for every format its negotiator accepts,
  while Mail.tm's marketing copy claims SSE is available. An optional method is
  still a method: a caller that checks for it and finds it absent still has to
  handle absence. Messages arrive by the caller polling.
- **Transport is constructor-injected; there is no module-level `fetch` in
  `packages/providers`**, asserted by `tests/architecture/boundaries.test.ts`.
  Neither a web page nor an MV3 service worker lets a test intercept `fetch`, so
  without the seam verifying an adapter means contacting a third party and the
  suite fails whenever that provider is down or rate-limiting - turning their
  availability into this repository's CI status.
- **Credentials are generated client-side inside the adapter**, via an injected
  random source, and the domain is fetched once per creation because `GET /domains`
  is `30; w=60` while `POST /accounts` is `1; w=60`.
- **The dead-session check is provider-specific and mandatory.** Guerrilla's
  liveness test is whether the response still names the mailbox's own address,
  because a session it no longer honours answers `HTTP 200` with an empty list, no
  `error`, and `auth.success` still `true`. Best-effort detection of one known
  trap, not proof of liveness.
- **Mail.tm deletion follows the hydrated `@id`** - measured **relative**
  (`/accounts/{id}`), resolved to absolute once and stored as `Mailbox.id` - never
  a constructed path.
- **Rate-limit headers are captured verbatim onto `RATE_LIMITED` and never
  parsed.** `1; w=60` states a limit and a window and nothing about what it is per.
  Whether that limit is per-IP or per-account **remains unverified** and no product
  code asserts either.
- **The manager is consulted only at creation.** Fallback honesty is structurally
  guaranteed because M2 derives `Mailbox.provider` from the credential
  discriminant, so a Guerrilla mailbox cannot be reported as a Mail.tm one.
- **`deleteMessage` and `destroyMailbox` are optional, plus a required
  `supports(operation)`**, so absence is discoverable as a question rather than an
  exception. Neither was observed to work on Guerrilla; that is **unverified**, not
  proven unsupported.
- **An unclassifiable failure keeps the provider's own description** and becomes
  `UNKNOWN_PROVIDER_ERROR`. A `422` is deliberately *not* `UNSUPPORTED_OPERATION`:
  it means Mail.tm refused the address we generated, not that the provider lacks a
  capability, and the difference decides whether the user or we own the fault.

**Two of these replaced assumptions in the M3 task plan, and the reason is
recorded rather than quietly corrected.** The plan asserted a Mail.tm bearer `401`
means bad credentials; measurement says a deleted mailbox and a bad token **both**
answer `401` with the same body, so the adapter reports `MAILBOX_EXPIRED` and the
shared conformance suite accepts either code - demanding one specific code would
force it to tell a user to check a credential they never entered. The plan also
mapped a validation rejection to an unsupported operation, which would have been
confidently false.

**M3 findings, recorded during apply and during verification:**

- **A fourth check narrower than its documented rule.** The boundary test's
  provider-adapter list held `MailTmProvider`, `GuerrillaMailProvider`, and
  `SpectreMailProvider` - **none of which had ever existed**. M3's exports are
  `createMailTmAdapter` and `createGuerrillaAdapter`, so the rule stayed green
  while guarding nothing: a list of identifiers nothing references cannot fail.
  Widened to the real exports plus a `create*Adapter` shape match. This is the
  third milestone in a row to produce one (M1 twice, M2 twice), which is why the
  falsification pass is a task rather than a habit.
- **Two new checks initially fired on their own documentation** - the contract test
  matched the word `subscribe` in the prose explaining its absence, and the `fetch`
  rule matched `fetch(` inside a doc comment. Both fixed by stripping comments
  before matching, not by rewording prose until the rule went quiet.
- **A test written to be falsifiable stayed vacuous on the first attempt.** The
  initial proof run showed the suite green after adding a `subscribe` member,
  which proved no check existed for it. The absence of a member is not observable
  at runtime, so the check is now a source scan *and* a compile-time assertion -
  `pnpm typecheck` fails if `subscribe` becomes a key of `MailProvider`.
- **16 deliberate violations, all caught**, every file restored byte-identical:
  nine against boundary and contract rules, seven reverting a required behaviour.
  One of the nine came back **green**, because the assertion did not yet exist. A
  check that does not exist cannot be falsified, so it has to be written before the
  pass rather than after it.
- **Recorded rather than repaired, so it is a decision and not an oversight.**
  `Mailbox.id` for Mail.tm is the absolute provider resource URL, and a message id
  is the provider's own - so provider identifiers *are* required by one call, which
  reads against the delta's "provider identifiers SHALL NOT be required by any
  caller". Not repaired because `Mailbox.id` is M2's design and deletion depends on
  the adapter holding the provider's own resource URL. The realised risk is a
  caller *parsing* that value, and nothing in the workspace does.
- **Recorded rather than repaired: the delta's auth wording needs amending at
  sync.** "A provider rejects the supplied credentials SHALL be reported as an
  authentication failure" holds only where the condition is decidable. Mail.tm
  answers `401` for a refused credential *and* for a deleted mailbox, with the same
  body, so a bearer `401` reports `MAILBOX_EXPIRED` and only the token exchange
  reports `AUTH_FAILED`. The requirement must distinguish those two moments.

**Still unverified after M3, and deliberately so:** the live MV3 host-permission
check; whether Mail.tm's `1; w=60` is per-IP or per-account; whether Guerrilla
supports deletion at all; Guerrilla's real mailbox lifetime; and whether the
recorded fixtures still match the live providers. **No test contacts a live
provider**, so the suite proves this repository's mapping of a wire format and
nothing about a provider's current behaviour.

**Verification found a gate that was failing and being recorded as passing.** On
Windows - the environment `AGENTS.md` declares supported - `pnpm format:check`
failed on 34 files and `pnpm verify` exited `1`. Cause: `.prettierrc.json` pins
`endOfLine: "lf"` but the repository shipped no `.gitattributes`, so the
working-tree line ending came from `core.autocrlf`, which stock Git for Windows
sets to `true` in the system gitconfig. CI stayed green across three runs because
`autocrlf` is inert on Linux. Fixed by `.gitattributes` (`* text=auto eol=lf`).

Worth preserving as a process lesson: **every gate that executes code passed.**
The defect was only visible by reading the recorded results against the declared
environment. That is precisely what an independent verification pass is for, and
it is why task 8.11 exists rather than being a formality.

The same pass also found two boundary assertions that were **narrower than the
rule they claimed to enforce** - the import rule missed dynamic and bare
side-effect imports, and the adapter rule was scoped so root-level and `tests/`
modules could name an adapter freely. Both are widened and the previously
escaping cases are now proven to fail.

**OpenSpec change:** `monorepo-foundation`, now archived at
`openspec/changes/archive/2026-10-02-monorepo-foundation/` - proposed 2026-10-02
(PR #7); apply PR #8 (`5ad51d7`); verification repairs PR #9 (`41da7b2`); sync PR
#10 (`f69ab38`); archive PR #11. Establishes the pnpm workspace, the planned
structure, shared TypeScript configuration, linting, formatting, a test runner, CI,
and root commands, and adds the `monorepo-foundation` and `build-and-verification`
capabilities. Both are **live** in `openspec/specs/` alongside `provider-abstraction`.
All three validate strict: 5, 6, and 9 requirements respectively.

The sync also **amended the `build-and-verification` delta** with two scenarios,
because the defect it exposed was a gap in the requirement rather than only in the
implementation:

- *A maintainer verifies on the declared supported platform.* A check whose
  result depends on anything outside the command itself - the working-tree line
  ending, the shell, the filesystem - SHALL have that pinned by a committed
  config rather than inherited from each contributor's local settings. The
  original wording covered the *directory* a command runs from but not the
  platform, which is precisely how a green CI run coexisted with a permanently
  red local gate.
- *An assertion passes for the wrong reason.* Each assertion SHALL have been
  observed to fail when its prohibited condition is introduced, and a check
  narrower than the rule it documents is a failure of this capability rather
  than a passing check.

`provider-role-decision` is archived at
`openspec/changes/archive/2026-10-02-provider-role-decision/` (PRs #4, #5, #6),
and M0's `m0-provider-spike` is archived at
`openspec/changes/archive/2026-10-02-m0-provider-spike/` (PR #2).

| Milestone | State | Notes |
|---|---|---|
| M0 Provider Compatibility Spike | **archived** | Real external delivery observed on **both** providers. Provider roles decided. Long-run expiry still unverified (no provider exposes a TTL in its API). Gate satisfied. |
| Provider-role specification | **archived** | Documentation and specification only. No product code. `provider-abstraction` is a live capability spec: 9 requirements, 18 scenarios. |
| M1 Monorepo Foundation | **archived** | Change `monorepo-foundation` archived as `2026-10-02-monorepo-foundation` (PRs #7-#11). Structure and tooling only: no product behaviour, no extension build, no visual design. A verification pass found a failing format gate that was being recorded as passing; repaired and proven from a clean clone. Three live capability specs. |
| M2 Shared Domain Model | **archived** | First milestone to add product code. Adds a **Vitest** include entry for package tests, deliberately not a **workspace** glob change - that separation is what keeps the M0 spike structurally unimportable, and it was re-proven after the change. 54 unit tests in `packages/core`; 7 boundary assertions. |

**M2 design decisions, recorded so M3 builds against them rather than re-deciding:**

1. `Mailbox` stays **monomorphic**. The roadmap's shape carries both `provider`
   and `credentials` with nothing correlating them, and M3's contract reads
   credentials off the mailbox. Agreement is enforced at a single construction entry
   point that derives `provider` from the credential discriminant. Making
   `Mailbox` generic was rejected: it would force a type parameter through M3's
   provider contract, storage, and every React prop to buy a correlation available
   once at construction.
2. Credentials are **discriminated and normalised**: `accountId`/`accessToken`
   and `sessionId`, never a provider's own field name.
3. `expiresAt` is retained but **observed-only**. No provider reports a mailbox
   lifetime in any API response, so absence is the normal case and the field must
   never be computed.
4. `confidence` stays a plain `number` with a specified `0..1` range, validated
   where a detection enters the model. Branding it now would buy nothing observable
   while nothing produces these values.
5. Required message fields **may be empty strings**; absence stays distinguishable
   from emptiness.

**M2 falsification found two checks that were green while not doing their job.**

1. The provider-wire-format scan was scoped to `apps/` only, so `packages/core` - the
   package whose entire purpose is to be free of it - was uncovered. Scope widened to
   every workspace package except `packages/providers` and `*.test.ts`. The widened
   scan immediately caught one real violation, a comment in `packages/mail-parser`
   quoting a provider field name; the comment was reworded rather than the rule
   narrowed.
2. `MailboxProviderAgreement` rejected a mismatched literal as designed - and also
   rejected every well-formed mailbox, resolving to `never`. The cause is structural:
   a non-generic `Mailbox` stores credentials as the whole union, and a union never
   `extends` a single provider literal. The first falsification run looked green
   because the bad literal *was* rejected, for the wrong reason. Replaced by a generic
   `AssertProviderAgreement<T>` with distribution suppressed, and the negative proof was
   re-run with a **positive control** added - four negative cases cannot distinguish a
   strict assertion from a useless one.

That is now three times this repository has produced a check narrower or broader than
the rule it documented. The habit it produces is the point: prove each assertion can
fail, and prove the correct case still passes.

**M3 added a fourth and a fifth.** The adapter-identifier rule named three
identifiers that never existed, so it could not fail (fixed in `Project Status`
above). And the very first M3 falsification run came back **green** after adding a
`subscribe` member to the contract - proving no check existed for the requirement
M3 had just written. A check that does not exist cannot be falsified, so it has to
be written before the pass, not after.

| M3 | complete (archived) | `provider-layer` |
| M4-M15 | not started | - |

**OpenSpec lifecycle stage:** M0, the provider-role change, M1's foundation change,
M2's `shared-domain-model`, and M3's `provider-layer` are all complete (propose ->
apply -> verify -> sync -> archive). **No active change remains**, so the next
milestone begins with a fresh proposal for M4. Task 8.11 - the independent vacuity
check - was the step that surfaced the defect above, and is ticked because the check
was performed and it found something. M3's own verification pass found two more, so
the task keeps earning its place.

**Next required change:** finish `provider-layer` (apply, verify, sync, archive).

**M1 as built, for the next milestone's benefit:**

- The M0 spike is **deliberately outside the workspace** (`pnpm-workspace.yaml`
  lists `apps/*` and `packages/*` only). It keeps its own lockfile, and root
  `pnpm install` does not install it. This makes "product code must never import
  the spike" structurally impossible rather than documented. **M2 and M3 must not
  add `tests/` to the workspace globs.** The spike is not deleted; retiring it is
  M3's decision once real adapters exist.
- Shared packages are consumed **as TypeScript source** (`exports` points at
  `./src/index.ts`). There is no per-package build and no bundler, so
  `pnpm build` builds the website only and package correctness is established by
  `pnpm typecheck`. Revisit when a non-Vite consumer appears.
- `packages/providers` **is** implemented as of M3: the `MailProvider` contract,
  the Mail.tm and Guerrilla Mail adapters, the shared conformance suite, the
  provider manager, and the injected transport seam. Both adapters pass the same
  conformance suite with **no per-provider exemption** - an exemption is the
  mechanism by which a conformance suite quietly stops meaning anything.
- The remaining placeholder packages contain no behaviour and no stub exports:
  storage (M5/M6) and UI (M7+). Exactly as the roadmap schedules them.
- The architecture boundaries are enforced by `tests/architecture/boundaries.test.ts`,
  not merely documented. Each assertion was proven able to fail. **Any new code
  must keep it passing** - in particular, no provider JSON field name may appear
  outside `packages/providers`, provider adapter identifiers and
  adapter-shaped identifiers may only appear there, and no module in
  `packages/providers` may reach the global `fetch`.
- `vitest.config.ts` scopes `include` to `tests/architecture/**/*.test.ts` and
  `packages/*/src/**/*.test.ts`, and leaves `passWithNoTests` off. The package glob
  is deliberately package-shaped: a test at the repository root or under `tests/`
  outside `architecture/` is **silently skipped**, verified by observing the
  collected count unchanged with such a file present. Never widen either glob to
  `tests/**`, or the root test command could begin executing the spike harness.

**Open items carried forward:**

- **Mail.tm publishes no terms page** (verified 2026-10-02). No attribution,
  resale, or quota obligation may be asserted or denied until real terms are
  located. See `docs/PROVIDERS.md` section 2.
- **The live host-permission check is deferred, not done.** The measured fact
  stands: `https://api.mail.tm/*` is the required wildcard form and
  `https://api.mail.tm` silently grants nothing. The check needs extension and
  browser-test infrastructure that does not exist, so it is recorded against the
  milestone that owns that infrastructure. M1 claimed no result for it and built
  no throwaway production code to satisfy it. `apps/extension` has no manifest at
  all, which is why the trap cannot currently be hit.
- **CI is green but unexercised against real change.** `.github/workflows/ci.yml`
  ran green on 2026-10-02 (run `36935477321`; `verify` and `spike self-test`
  both SUCCESS), which confirms it works on a clean Linux runner with the pinned
  Node and action versions. It has never yet been made to *fail*, so its
  ability to catch a regression is unproven. Treat the first real red run as
  unverified behaviour.
- **The Guerrilla dead-session trap has no requirement.** It is deliberately
  deferred to the mailbox-lifecycle capability, not overlooked. Note that
  `packages/storage/src/index.ts` records why the `SpectreStorage` contract must
  be able to represent "session gone" distinctly from "no messages".
- **Delivery reputation is proven from one sender.** Providers that commonly
  blocklist disposable domains are untested.

**Open items carried forward into M1 and beyond:**

- **Mail.tm publishes no terms page** (verified 2026-10-02). No attribution,
  resale, or quota obligation may be asserted or denied until real terms are
  located. See `docs/PROVIDERS.md` §2.
- **The live host-permission check is deferred, not done.** The measured fact
  stands: `https://api.mail.tm/*` is the required wildcard form and
  `https://api.mail.tm` silently grants nothing. The check that exercises it
  needs extension and test infrastructure that does not exist, so it is recorded
  against the milestone that owns that infrastructure. M1 must not claim a result
  for it, and must not build throwaway production code to satisfy it.
- **The Guerrilla dead-session trap has no requirement.** It is deliberately
  deferred to the mailbox-lifecycle capability, not overlooked.
- **Delivery reputation is proven from one sender.** Providers that commonly
  blocklist disposable domains are untested.

**Last updated:** 2026-10-02

**Evidence:** `docs/PROVIDERS.md`, produced from spike run
`2026-10-01T18-08-41-251Z` — 36 probes: 26 passed, 6 failed, 3 unsupported,
1 unverified, **including a real external message observed on both providers**.
Re-run the spike before relying on any of it; provider behaviour and terms
change.

### Planning assumptions that M0 disproved

These are recorded because the roadmap below still contains them in several
places. **The observed behaviour wins.** Do not build later milestones on the
original assumption.

| Roadmap assumption | Observed reality |
|---|---|
| Mail.tm is the primary provider for the website | `api.mail.tm` sends `Access-Control-Allow-Origin` only to `https://mail.tm` and `https://api.mail.tm`. A page on our own domain **cannot read it at all**, verified in a real browser. SpectreMail does not proxy provider APIs to work around an origin restriction, so there is no workaround by policy. Mail.tm is currently **extension-only**. |
| Guerrilla Mail is the fallback, usable where technically reliable | Inverted. Guerrilla Mail works from a normal web page *and* an extension; it is the only provider the website can use today. |
| "Generate mailbox: 1 action or automatic", "Open app → usable email: a few seconds" | Mail.tm returns `ratelimit-policy: 1; w=60` on `POST /accounts` — **one mailbox per 60s window**. The header does not state its scope, so "per IP" was inferred and is not evidenced. Seconds-long generation is not achievable on Mail.tm. |
| "SSE subscription if stable" (M3) and "SSE where reliable" (M6) | Mail.tm has **no working real-time transport**. Five SSE candidate paths returned 404/406 and no WebSocket accepted a connection, despite the provider's marketing claiming SSE. **Adaptive polling is the only option.** |
| Extension requests host permissions for the provider | Silent-failure trap, measured: `https://api.mail.tm` is accepted into the manifest and grants **nothing**; `https://api.mail.tm/*` works. The extension must use the `/*` form and must test it. |
| Mailbox expiry has a knowable TTL | **Unmeasured.** Mail.tm's FAQ publishes a 7-day message retention and a no-expiry mailbox statement, but neither value appears in its API and neither was verified live; Guerrilla publishes nothing equivalent. `MailboxStatus: expired` must still follow an observed signal. |
| A harness that reports `unverified` is reporting a provider limitation | **False, and it bit us.** Run `2026-10-01T17-35-14-033Z` reported both delivery checks `unverified` because of two defects in the spike itself: the Mail.tm mailbox was deleted (token revoked → `GET /messages` returns `401`) before delivery polled it, and the Guerrilla address printed to the maintainer was stale after `set_email_user`. Neither was a provider behaviour. Fixed, with an abort-on-`401` guard. |
| A real external verification message can be observed during the spike without a maintainer-supplied credential | **Resolved by maintainer action.** Run `2026-10-01T18-08-41-251Z` observed a real message on both providers. No credential-free *sender* exists, so this always required one manual send. |

### Decision: provider roles (2026-10-02)

Recorded because M0 disproved the roadmap's provider assignment and a
maintainer decision was required to continue.

```text
website:
Guerrilla Mail only

extension:
Mail.tm (primary) + Guerrilla Mail (fallback)
```

Rationale: `api.mail.tm` grants CORS only to its own origins, and its terms
forbid proxying, so no compliant design lets a SpectreMail web page read it.
Mail.tm remains fully functional from an MV3 extension context, where host
permissions bypass CORS, so it stays in scope for the extension. The website
ships on the single provider it can actually reach rather than on a proxy.

Consequences for later milestones:

- The website's provider adapter surface is Guerrilla-only in V1. It must still
  go through the same provider abstraction, so adding a second web-capable
  provider later is additive, not a rewrite.
- The extension carries the provider-fallback logic. The website has no
  fallback path until a second web-reachable provider exists.
- Mail.tm attribution is an **extension-only** obligation **if** it exists. No
  attribution term could be verified (see `docs/PROVIDERS.md` §2), so this is
  carried as an open item, not a requirement.
- Mail.tm's `POST /accounts` limit of 1 per 60s window caps extension mailbox
  creation throughput and must be surfaced, not silently retried.

This decision is now **specified** as behaviour, not just recorded here, by the
`provider-abstraction` capability (`openspec/specs/provider-abstraction/spec.md`).
It states the roles above, plus the measured constraints M0 found — untrustworthy
content type, no working push transport, `1; w=60` account-creation throttling, the
wildcard host-permission form, and the absent mailbox TTL. M3 and the client
capabilities must be written against that spec rather than against the superseded
assumption above.

### M0 gate status

> **Do not begin full UI work until Mail.tm successfully completes the complete
> receive-mail lifecycle.**

**Gate satisfied.** Run `2026-10-01T18-08-41-251Z` observed a real external email
arrive on **both** providers: Mail.tm at `spikemupulgy6gkia@uberip.com` (subject
"TEST", body "TEST M0") and Guerrilla Mail at
`spikemupull2b4vd@guerrillamailblock.com` (body "test m0", delivered as raw
HTML). The complete receive-mail lifecycle is therefore proven with a real
message, not inferred.

This gate was previously reported as **unsatisfied** because the delivery probes
were structurally incapable of passing. Two harness defects caused that — the
Mail.tm mailbox was deleted before delivery polled it (revoking the token), and
the Guerrilla address printed to the maintainer was stale after a rename. Both
were measured against the live API, both are fixed, and both poll loops now abort
and report a harness fault when their own preconditions are unmet — using the
signal each provider actually returns: `401` for Mail.tm, and an `error` key with
no `list` for Guerrilla, whose `auth.success` is `true` even when the session is
dead. These guards are provider-specific and must not be generalised to a provider
that has not been measured the same way. See `docs/PROVIDERS.md` §5.1.

**What remains open.** Long-run expiry is unmeasured for both providers.
Mail.tm's FAQ publishes a 7-day message retention and a no-expiry mailbox statement,
but neither value is in its API and neither was measured live, so
`MailboxStatus: expired` must still follow an observed signal rather than a
horizon. And delivery is proven from a single sender; reputation with providers that
commonly blocklist disposable domains is untested. Both are now carried into the
`provider-abstraction` spec rather than treated as settled.

### Additional provider facts that change later milestones

- **Guerrilla sessions are `sid_token` based, not cookie based.** The provider
  sets `PHPSESSID` but sends `Access-Control-Allow-Origin: *` with no
  `Access-Control-Allow-Credentials`, so a browser cannot send the cookie
  cross-origin. The body-returned `sid_token` is the only workable carrier.
  Persist the token, never a cookie.
- **An unrecognised Guerrilla session is not rejected.** It returns `200` with
  an empty inbox and no auth error, so an expired stored session is
  indistinguishable from a genuinely empty mailbox. The core mailbox manager
  must detect this explicitly.
- **Guerrilla message bodies are raw HTML** while declaring `content_type:
  "text"`. Declared content type must never be trusted; raw HTML must never be
  rendered.
- **mail.tm's terms could not be located.** No terms page exists and the FAQ is
  silent on attribution, resale, proxying, and quota. Whether an attribution
  obligation exists is therefore **unknown**, not "required" and not "absent".
  Anything depending on it is blocked until the real terms are found.

---

## 1. Product Direction

SpectreMail is an accountless temporary-email product designed around one core promise:

> **Temporary email without interrupting what you're doing.**

The standalone website will prove and expose the mailbox engine. The browser extension will become the differentiated product by allowing users to generate disposable addresses, receive verification messages, detect OTPs, and continue signup flows without repeatedly switching tabs.

The project must be built so that the website and extension are **two clients of the same shared SpectreMail core**, not two separate implementations.

The long-term target interaction is:

```text
Website asks for an email
        ↓
User chooses SpectreMail
        ↓
Temporary address is inserted
        ↓
Website sends a verification email
        ↓
SpectreMail receives it
        ↓
OTP or verification link is detected
        ↓
User copies/fills the code
        ↓
Signup continues
```

---

## 2. Core Product Principles

1. **No SpectreMail account required in V1**
   - No login
   - No OAuth
   - No cloud profile
   - No personal email required

2. **Local-first SpectreMail state**
   - Mailbox metadata
   - Provider credentials/session data
   - Recent mailbox history
   - User settings
   - Future site-to-mailbox mapping in the extension

3. **Provider-independent architecture**
   - Mail.tm and Guerrilla Mail must sit behind adapters
   - UI components must never directly depend on provider-specific response formats
   - Future providers must be replaceable without rewriting the product

4. **Safe email handling**
   - Incoming email is untrusted
   - Do not render raw provider HTML directly
   - Prefer safe text extraction for V1
   - Do not load remote email images by default
   - No attachments in V1

5. **Useful without AI**
   - OTP detection must be deterministic
   - Verification-link detection must be deterministic
   - AI is not a dependency for core functionality

6. **Minimal permissions**
   - The extension should request only permissions required by active features

7. **No disposable-domain evasion**
   - If a website rejects a temporary-email domain, SpectreMail reports it
   - SpectreMail will not attempt to bypass or conceal temp-mail restrictions

8. **Website-first, not website-only**
   - The website exists to prove the mail engine and provide standalone value
   - The browser extension is the long-term differentiation

---

## 3. Repository Architecture

The project should use one monorepo:

```text
spectre-mail/
│
├── apps/
│   ├── web/
│   └── extension/
│
├── packages/
│   ├── core/
│   ├── providers/
│   ├── mail-parser/
│   ├── storage/
│   └── ui/
│
├── docs/
│   ├── PRODUCT_SPEC.md
│   ├── ROADMAP.md
│   ├── ARCHITECTURE.md
│   ├── PROVIDERS.md
│   ├── PRIVACY.md
│   └── DESIGN_SYSTEM.md
│
├── tests/
│   └── fixtures/
│
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── eslint.config.js
├── .gitignore
├── LICENSE
└── README.md
```

### Dependency rule

```text
apps/web ───────┐
                ├──→ packages/*
apps/extension ─┘
```

Shared packages must never import from `apps/web` or `apps/extension`.

### Shared packages

#### `packages/core`

Owns normalized product logic:

```text
mailbox lifecycle
provider selection
provider health
mailbox manager
message normalization
error normalization
expiration logic
shared types
```

#### `packages/providers`

Owns provider-specific code:

```text
MailTmProvider
GuerrillaMailProvider
future SpectreMailProvider
```

#### `packages/mail-parser`

Owns:

```text
safe text extraction
OTP detection
verification-link detection
message classification helpers
```

#### `packages/storage`

Owns shared storage contracts and platform adapters:

```text
SpectreStorage interface
Web IndexedDB adapter
Extension storage adapter
```

#### `packages/ui`

Owns reusable product UI:

```text
buttons
mailbox card
provider badge
status dot
message row
OTP component
verification-link component
design tokens
```

Do not move marketing-only website sections into the shared UI package.

---

## 4. Recommended Initial Tooling

### Workspace

- pnpm workspaces
- TypeScript
- ESLint
- Prettier
- Vitest
- Playwright for browser-level tests

### Website

- React
- TypeScript
- Vite

### Extension

- React
- TypeScript
- Manifest V3
- Prefer a modern extension build framework if it clearly improves Chrome/Firefox maintainability
- Do not add a heavy framework before extension work actually begins

### Root scripts target

```bash
pnpm dev
pnpm dev:web
pnpm dev:extension
pnpm build
pnpm test
pnpm typecheck
pnpm lint
```

Initially:

```bash
pnpm dev
```

should run the website.

---

# 5. Milestone Overview

| Milestone | Name | Primary Outcome |
|---|---|---|
| M0 | Provider Compatibility Spike | Prove real incoming mail works in target browser environments |
| M1 | Monorepo Foundation | Establish repository structure and tooling |
| M2 | Shared Domain Model | Define provider-independent mailbox/message types |
| M3 | Provider Layer | Implement Mail.tm + Guerrilla adapters (website: Guerrilla; extension: both) |
| M4 | Mail Parsing Engine | OTP + verification-link detection |
| M5 | Website Core MVP | Working temporary mailbox website |
| M6 | Website Hardening | Storage, errors, accessibility, security |
| M7 | Spectral Swiss Design Pass | Apply approved visual system |
| M8 | Extension Foundation | Manifest V3 shell + shared package reuse |
| M9 | In-Page Email Integration | "Use SpectreMail" inside email fields |
| M10 | Verification Workflow | Notifications + OTP copy/fill |
| M11 | Side Panel + Mailbox Context | Persistent inbox beside webpages |
| M12 | Release Hardening | Security, permissions, tests, docs |
| M13 | Public Beta | Website + Chromium extension |
| M14 | Cross-Browser Expansion | Firefox + Edge |
| M15 | Post-Beta Evaluation | Decide next provider/infrastructure direction |

---

# 6. M0 — Provider Compatibility Spike

## Goal

Before building the full application, prove that the provider workflows we are planning are reliable enough for both the website and future extension.

This milestone is deliberately ugly and temporary. It is a technical experiment, not product UI.

## Required tests

### Mail.tm

Verify:

```text
fetch available domains
create mailbox
authenticate mailbox
list messages
fetch message
receive a real external verification email
delete mailbox if supported
handle provider errors
test realtime/SSE behavior
```

### Guerrilla Mail

Verify:

```text
create or obtain session
obtain temporary address
preserve required session/cookie state
list incoming mail
fetch a message
receive a real external verification email
confirm expiration/session behavior
observe browser/CORS/cookie limitations
```

### Browser environments

Run the tests from:

```text
normal web page
Chrome extension context
```

Firefox may be tested later unless trivial to include now.

## Deliverables

```text
docs/PROVIDERS.md
tests/provider-spike/
```

The provider document should record:

```text
working endpoints
auth/session model
known limits
browser restrictions
message expiration behavior
mailbox expiration behavior
fallback considerations
provider terms that affect the product
```

## Gate

**Do not begin full UI work until Mail.tm successfully completes the complete receive-mail lifecycle.**

Guerrilla Mail may remain a fallback-only implementation if browser restrictions prevent parity.

> **M0 result (2026-10-02).** The browser-restriction outcome landed on the
> *opposite* provider from what this gate anticipated: Mail.tm works fully from a
> Chromium extension and is **unreachable from a normal web page**, while
> Guerrilla Mail works from both. The "complete receive-mail lifecycle" half of
> this gate is now **verified** — run
> `2026-10-01T18-08-41-251Z` observed a real external message on both providers.
> **The gate is satisfied.** The provider roles were re-decided as a result; see
> *Decision: provider roles* in `Project Status`.

If Guerrilla Mail proves unreliable in the website environment:

```text
website:
Mail.tm only initially

extension:
Mail.tm + Guerrilla where technically reliable
```

Do not introduce a fragile proxy merely to force equal behavior.

---

# 7. M1 — Monorepo Foundation

## Goal

Create a clean repository before feature code spreads into the wrong locations.

## Tasks

- Initialize pnpm workspace
- Create `apps/web`
- Create placeholder `apps/extension`
- Create shared package directories
- Add TypeScript base config
- Add linting
- Add formatting
- Add test runner
- Add CI workflow
- Add root scripts
- Add `.editorconfig`
- Add `.gitignore`
- Add basic README
- Add product documentation directory

## Expected structure

```text
apps/web
apps/extension
packages/core
packages/providers
packages/mail-parser
packages/storage
packages/ui
docs
tests
```

## Extension placeholder

Before extension development starts:

```text
apps/extension/README.md
```

should explain:

```text
Extension implementation starts after the website core is stable.
Reusable logic must not be placed under apps/web.
```

## Acceptance criteria

```text
pnpm install        succeeds
pnpm build          succeeds
pnpm test           succeeds
pnpm typecheck      succeeds
pnpm lint           succeeds
pnpm dev:web        starts website
```

---

# 8. M2 — Shared Domain Model

## Goal

Define SpectreMail's own normalized data model before implementing providers.

## Required types

```ts
type ProviderId =
  | "mailtm"
  | "guerrilla";

type MailboxStatus =
  | "active"
  | "expired"
  | "unavailable";

type Mailbox = {
  id: string;
  provider: ProviderId;
  address: string;
  createdAt: number;
  expiresAt?: number;
  credentials: ProviderCredentials;
  status: MailboxStatus;
};

type MessageSummary = {
  id: string;
  mailboxId: string;
  from: string;
  fromName?: string;
  subject: string;
  receivedAt: number;
  unread?: boolean;
};

type Message = MessageSummary & {
  text: string;
  verificationCodes: VerificationCode[];
  verificationLinks: VerificationLink[];
};

type VerificationCode = {
  value: string;
  confidence: number;
};

type VerificationLink = {
  url: string;
  hostname: string;
  confidence: number;
};
```

Provider credentials must be a discriminated type so Mail.tm tokens and Guerrilla sessions are never mixed.

## Required normalized errors

```text
PROVIDER_UNAVAILABLE
RATE_LIMITED
MAILBOX_EXPIRED
AUTH_FAILED
NETWORK_ERROR
MESSAGE_NOT_FOUND
UNSUPPORTED_OPERATION
UNKNOWN_PROVIDER_ERROR
```

## Gate

No React component may ever need to understand Mail.tm JSON or Guerrilla Mail JSON directly.

---

# 9. M3 — Provider Layer

## Goal

Implement each provider behind one contract.

## Contract target

> **As implemented by M3 (`openspec/changes/provider-layer`).** The `subscribe?`
> member below is **absent from the real contract, not optional**, and
> `supports(operation)` was added. Both differences are deliberate; see the
> M3 decisions in `Project Status`.

```ts
interface MailProvider {
  readonly id: ProviderId;
  readonly displayName: string;

  checkHealth(): Promise<ProviderHealth>;

  createMailbox(): Promise<Mailbox>;

  listMessages(
    mailbox: Mailbox
  ): Promise<MessageSummary[]>;

  getMessage(
    mailbox: Mailbox,
    messageId: string
  ): Promise<Message>;

  deleteMessage?(
    mailbox: Mailbox,
    messageId: string
  ): Promise<void>;

  destroyMailbox?(
    mailbox: Mailbox
  ): Promise<void>;

  // Added by M3. Both optional members above are queried through this, so
  // "can this provider delete a mailbox?" is a compile-time-checkable question
  // rather than a call that may throw.

  supports(operation: ProviderOperation): boolean;
}
```

## Mail.tm adapter

> **M0 constraints (2026-10-01).** Two items below are not implementable as
> written and must be revised in the M3 OpenSpec change:
>
> - `POST /accounts` is limited to **1 per 60s window** (scope not stated)
>   (`ratelimit-policy: 1; w=60`). Mailbox generation cannot be automatic and
>   instant; the product needs explicit rate-limit handling in the UI, not just
>   in the adapter.
> - **SSE does not exist.** No SSE or WebSocket endpoint is available, so
>   `subscribe?` cannot be implemented for Mail.tm. Polling is the only option.
>
> **M3 resolved this by deleting the member from the contract** rather than
> declaring it and leaving it unimplemented. An optional method is still a method:
> every caller has to check for it and handle its absence, which would have left a
> dead branch in every client and an implied promise that a push transport might
> appear later. The measurement is not "SSE is unstable", it is "SSE does not
> exist", and the honest encoding of that is a contract with no such method.
> A compile-time assertion and a source scan both fail if `subscribe` is ever
> reintroduced.
>
> Mail.tm is also currently **unreachable from a normal web page** — see
> `Project Status` and `docs/PROVIDERS.md`.

Implement:

```text
domain discovery
mailbox creation
authentication token handling
message listing
message fetch
mailbox deletion
health checks
rate-limit handling
SSE subscription if stable   → not available; polling only
```

**Delivered by M3**, with two additions the measured behaviour forced:

```text
credentials generated client-side     (the provider issues no address, and a
                                       password is required then exchanged)
deletion follows the hydrated @id     (measured RELATIVE — /accounts/{id} —
                                       resolved once, never a constructed path)
```

The `1; w=60` limit is captured **verbatim** and never parsed: it states a limit and
a window and nothing about what it is per, so "per IP" appears nowhere in this
product. Whether that limit is per-IP or per-account remains **unverified**.

## Guerrilla Mail adapter

> **M0 constraint (2026-10-01).** Session persistence must store the
> body-returned `sid_token`, **not** the `PHPSESSID` cookie: the provider sends
> `Access-Control-Allow-Origin: *` with no
> `Access-Control-Allow-Credentials`, so a browser cannot send the cookie
> cross-origin. Session expiration must also be detected explicitly, because an
> unrecognised session returns `200` with an empty inbox rather than an error.
> See `docs/PROVIDERS.md`.

Implement:

```text
session creation
cookie/session persistence
address lifecycle
message listing
message fetch
session expiration handling
health checks
rate-limit/error handling
```

**Delivered by M3.** The dead-session check tests whether the response still names
the mailbox's own address, since an unrecognised session answers `200` with no
`list`, no `error`, and `auth.success` still `true` - a mailbox with mail would
otherwise be reported as empty, which is silent data loss. It is best-effort
detection of one known trap, **not** proof of liveness.

Deletion operations are **not implemented**: neither was observed in the measured
surface. `supports()` therefore answers `false`, which records **unverified** - "not
observed" is not "does not exist" - rather than asserting a provider fact nobody
measured.

## Provider manager

Automatic mode:

```text
try Mail.tm
    ↓
success → create mailbox
    ↓
failure
    ↓
short retry
    ↓
failure again
    ↓
mark degraded
    ↓
try Guerrilla Mail
```

> **Revised by M3.** The `short retry` step is **absent**. The provider-adstraction
> capability requires throttling to be surfaced rather than silently retried, and a
> retry loop here would spend a quota the provider is already refusing to extend.
> The manager tries each provider exactly once and reports the failures it saw.

Important:

> Failover applies only when creating a new mailbox.

Existing mailboxes must remain attached to the provider that created them.

**Delivered by M3.** This is structural rather than a convention: M2 derives
`Mailbox.provider` from the credential discriminant, so a Guerrilla mailbox cannot
be reported as a Mail.tm one even by mistake. With a single configured provider -
the website's case - the manager attempts exactly once and **does not pretend a
fallback exists**.

## Acceptance criteria

| Criterion | State after M3 |
| --- | --- |
| Both adapters pass the same provider contract tests | **Met.** One shared conformance suite, run once per adapter, with no per-provider exemption. 24 of the 80 package tests are those two runs. |
| Provider-specific objects stay inside adapter code | **Met.** Enforced by the wire-format boundary scan, whose scope was widened at M2 and widened again at M3 to match adapter-shaped identifiers. |
| Automatic mode can choose/fallback without UI changes | **Met at the package level; no UI exists.** The manager selects and falls back, and a single-provider configuration is reported honestly. Whether any UI needs changing is not yet observable, since no client consumes this package. |
| Manual provider selection is possible | **Not met, and not in M3's scope.** Selection is a presentation concern with no client to present it in. Deferred to the milestone that wires `apps/` to this package; recording it as met would be a claim about code that does not exist. |

---

# 10. M4 — Mail Parsing Engine

## Goal

Make incoming mail useful without AI.

## Safe message processing pipeline

```text
provider message
      ↓
normalize
      ↓
extract safe text
      ↓
extract URLs
      ↓
detect OTP candidates
      ↓
detect verification links
      ↓
render SpectreMail data model
```

## OTP detection V1

Prioritize:

```text
4–8 digit codes
```

Boost confidence near words such as:

```text
verification
verify
security code
OTP
one-time
authentication
confirmation
confirm
login code
```

Reduce confidence for values resembling:

```text
prices
dates
phone numbers
order numbers
tracking numbers
postal codes
```

## Verification-link detection

Inspect link text and nearby wording for:

```text
verify
verification
confirm
activate
login
magic
authentication
validate
```

Never silently open a detected link.

Always show destination hostname.

## Fixture suite

Add realistic test messages for:

```text
4-digit OTP
6-digit OTP
8-digit OTP
multiple numeric candidates
HTML-heavy mail
plain-text mail
magic-link mail
order-confirmation mail with misleading numbers
newsletter
password reset
GitHub-style verification
Discord-style verification
generic SaaS verification
```

## Acceptance target

- High detection rate on known verification fixtures
- Low false-positive rate on ordinary transactional email
- Multiple candidates are surfaced instead of pretending certainty

---

# 11. M5 — Website Core MVP

## Goal

Create the first complete user-facing SpectreMail experience.

## First-run flow

```text
open website
    ↓
automatic provider selection
    ↓
create mailbox
    ↓
show address
    ↓
copy address
    ↓
receive mail
    ↓
see message
    ↓
open message
    ↓
copy OTP / open verification link
```

## Required UI

### Header

```text
SpectreMail
provider status
theme
settings
```

### Active mailbox

```text
temporary address
copy
new address
provider
status
expiration
```

### Inbox

```text
sender
subject
time
verification badge
unread state
```

### Message view

```text
sender
subject
safe text
verification codes
verification links
```

### Mailbox history

Allow multiple recent mailboxes where the provider session still permits access.

## V1 features

- Auto-create mailbox
- Copy address
- New mailbox
- Provider selector
- Automatic provider mode
- Inbox refresh
- Realtime update when stable
- Open message
- OTP extraction
- Verification links
- Expiration state
- Local mailbox history
- Clear local data
- Theme toggle

## Explicitly excluded

```text
attachments
outgoing mail
reply
forwarding
user accounts
cloud sync
AI
paid features
custom domains
own mail infrastructure
```

## Acceptance criteria

A user must be able to:

```text
open SpectreMail
receive a working address
use it externally
receive a real message
find the OTP
copy the OTP
return to a recent mailbox
clear local SpectreMail data
```

without registering for SpectreMail.

---

# 12. M6 — Website Hardening

## Goal

Make the website safe and reliable enough to become the reference implementation for the extension.

## Storage

Implement IndexedDB-backed storage for:

```text
mailboxes
provider credentials
preferences
message metadata cache
provider health
```

## Privacy controls

Add:

```text
Forget mailbox
Clear mailbox history
Clear all local SpectreMail data
```

## Error states

Normalize user-facing messages.

Examples:

```text
Provider is temporarily unavailable.
This mailbox has expired.
Too many requests. Retrying shortly.
Can't reach the mail provider.
This message is no longer available.
```

Do not expose raw stack traces or raw API response objects.

## Security

- No raw HTML rendering
- No email JavaScript execution
- No automatic remote image loading
- No attachment handling
- Validate all URLs before presentation
- Sanitize all visible provider-originated strings

## Accessibility

Target:

```text
keyboard navigation
visible focus states
semantic controls
screen-reader labels
sufficient contrast
reduced-motion handling
```

## Performance

Avoid polling unnecessarily.

Prefer:

```text
SSE where reliable
adaptive polling otherwise
pause inbox activity when page is hidden where appropriate
```

> **M0 result (2026-10-01).** No provider offers SSE. Mail.tm's real-time
> endpoints are absent (all candidate paths `404`/`406`; no WebSocket accepts a
> connection). **Design for adaptive polling as the only transport**, and treat
> "SSE where reliable" as dead rather than aspirational. See
> `docs/PROVIDERS.md`.

---

# 13. M7 — Spectral Swiss Design Pass

## Goal

Apply the approved visual direction after the core workflow is functional.

## Direction

**Spectral Swiss Utility**

Primary characteristics:

```text
strong Swiss-style grid
minimal interface
large clean typography
monospace technical details
thin borders
few shadows
generous whitespace
restrained spectral-violet accent
subtle geometric branding
materialize/disappear motion
```

## Suggested visual system

### Surfaces

```text
warm off-white light background
near-black dark background
neutral surfaces
high-contrast text
subtle borders
```

### Accent

Use a restrained spectral violet rather than neon hacker green.

The accent should primarily appear on:

```text
active status
verification codes
selected mailbox
primary action
focus state
brand mark
```

## Typography

Primary:

```text
Geist / Inter / similar grotesk
```

Technical:

```text
Geist Mono / JetBrains Mono / IBM Plex Mono
```

Use monospace for:

```text
email addresses
OTP values
provider diagnostics
technical metadata
```

## Motion

Use motion to support the "spectre" concept:

```text
opacity 0 → 1
blur 6px → 0
translateY 4px → 0
```

for:

```text
new mailbox
incoming message
OTP appearance
```

Avoid:

```text
heavy gradients
glitch effects
Matrix-style visuals
cartoon ghost overload
large neon hacker aesthetics
```

## Website sections

Keep marketing compact:

```text
1. Live product hero
2. Generate → Receive → Discard
3. Why SpectreMail
4. Extension preview
5. Privacy/providers/open-source footer
```

The product itself should remain the main hero.

---

# 14. M8 — Extension Foundation

## Goal

Create a Chromium Manifest V3 extension that reuses the shared SpectreMail core.

## Required surfaces

```text
background service worker
toolbar popup
content script
side panel
extension storage adapter
```

## First extension milestone

The popup should already support:

```text
create mailbox
copy address
view provider
view status
basic inbox count
```

using the same provider/core packages as the website.

## Gate

Do not duplicate provider logic inside the extension.

No files like:

```text
apps/extension/src/api/mailtm.ts
```

should exist if the logic belongs in `packages/providers`.

> **M0 requirement discovered (2026-10-01).** Host permissions **must** use the
> wildcard-path match pattern — `https://api.mail.tm/*`, never
> `https://api.mail.tm`. The slash-less form is accepted into the manifest and
> then grants nothing, so every cross-origin fetch fails with an opaque
> `TypeError: Failed to fetch` and the extension ships looking correct while
> being unable to reach the provider. This was measured, not assumed, and must
> be covered by a test. See `docs/PROVIDERS.md`.

---

# 15. M9 — In-Page Email Integration

## Goal

Create the first browser-native SpectreMail advantage.

## Behavior

When an email input receives focus:

```text
Email
┌────────────────────────────┐
│                            │
└────────────────────────────┘

👻 Use SpectreMail
```

Clicking should:

```text
create or select mailbox
insert address
fire the appropriate input/change events
preserve compatibility with React/Vue-controlled inputs
associate the mailbox with the current site
```

## UX rules

- Do not permanently overlay every email field
- Prefer appearing on focus or explicit user interaction
- Never overwrite existing text without user action
- Allow using:
  - current mailbox
  - new mailbox
  - recently used mailbox for that site

## Site mapping

Store locally:

```text
hostname → mailbox ID
```

Example:

```text
reddit.com → mailbox-123
example.com → mailbox-456
```

This becomes a core extension-specific feature.

---

# 16. M10 — Verification Workflow

## Goal

Complete the browser-native verification flow.

## Incoming mail notification

When likely verification mail arrives:

```text
SpectreMail
Verification code received from example.com

583291
```

## User actions

Support:

```text
Copy code
Open SpectreMail
Fill code
Open verification link
```

## Fill-code rules

- Never silently fill codes
- Require explicit user action
- Prefer detected OTP inputs
- If multiple possible inputs exist, ask the user
- Do not auto-submit forms

## Verification-link rules

- Show destination hostname
- Require explicit user action
- Open in a new tab unless product testing proves another behavior clearly better

---

# 17. M11 — Side Panel + Mailbox Context

## Goal

Make SpectreMail usable without switching away from the active website.

## Side panel

Display:

```text
current mailbox
site association
inbox
new messages
OTP
verification links
recent mailboxes
provider state
```

## Target experience

```text
registration page        SpectreMail side panel
────────────────────     ─────────────────────────
email field              ghost83@...
password field           Inbox

verification code        Example.com
[      ]                  Verification code
                           583291
                          [ Copy ] [ Fill ]
```

## Context behavior

The side panel should understand:

```text
current tab hostname
mailbox associated with current hostname
current mailbox provider
whether verification mail is pending
```

No cloud account is required.

---

# 18. M12 — Release Hardening

## Goal

Prepare website and extension for public beta.

## Security review

Review:

```text
provider credentials
extension permissions
storage boundaries
message rendering
URL handling
content-script injection
site mapping
notification content
clear-data behavior
```

## Permissions review

Every extension permission must answer:

> What user-facing feature requires this?

Remove anything unnecessary.

## Provider review

Before release:

- Re-check Mail.tm API terms
- Re-check Guerrilla Mail API terms
- Re-check rate limits
- Re-check attribution requirements
- Re-check whether public extension distribution is compatible with provider policies

Provider terms may change; do not rely permanently on planning-stage assumptions.

## Privacy documentation

Publish a clear privacy document covering:

```text
what SpectreMail stores locally
what providers receive
what SpectreMail does not collect
how users clear data
provider attribution
message lifecycle limitations
```

## Branding check

Before public release, validate final public name.

`SpectreMail` remains a codename until:

```text
name collision check
domain check
Chrome Web Store search
Firefox Add-ons search
GitHub search
basic trademark risk check
social handle check
```

If the name changes, architecture/package names may remain internal temporarily but public branding should be updated cleanly.

---

# 19. M13 — Public Beta

## Website release

Ship:

```text
standalone temporary mailbox
Guerrilla Mail
OTP detection
verification-link detection
mailbox history
privacy controls
Spectral Swiss UI
```

> **M0 result (2026-10-01) + decision (2026-10-02).** "Mail.tm" was removed from
> the website release list. `api.mail.tm` grants CORS only to its own origins and
> SpectreMail does not proxy provider APIs, so a SpectreMail web page never reads it. The
> website ships on Guerrilla Mail alone; Mail.tm stays extension-primary. See
> *Decision: provider roles* in `Project Status`. The website has no provider
> fallback until a second web-reachable provider exists.

## Chromium extension release

Ship:

```text
popup
content-script email integration
OTP notifications
copy/fill flow
side panel
local site mapping
```

## Beta goals

Collect:

```text
mailbox creation success
mail arrival reliability
OTP detection accuracy
provider failure rates
extension compatibility issues
email-field injection failures
site-specific UI conflicts
```

Do not optimize around vanity metrics yet.

---

# 20. M14 — Cross-Browser Expansion

## Firefox

Adapt:

```text
manifest differences
browser namespace differences
permissions
side-panel equivalent strategy
notification behavior
store requirements
```

## Edge

Chromium compatibility should make this relatively straightforward after Chrome stabilizes.

## Shared-extension rule

Do not fork the extension into completely separate Chrome/Firefox repositories.

Keep platform-specific differences behind small compatibility layers.

---

# 21. M15 — Post-Beta Evaluation

## Goal

Decide whether SpectreMail should remain provider-powered or begin owning infrastructure.

Evaluate:

```text
active users
provider reliability
domain rejection rates
provider policy risk
mail volume
support burden
abuse patterns
extension retention
site-integration value
operating cost projections
```

## Possible outcomes

### Outcome A — Continue provider-powered

If:

```text
providers remain reliable
terms remain compatible
usage remains manageable
```

continue improving the product layer.

### Outcome B — Add another provider

If one provider degrades:

```text
MailTmProvider
GuerrillaProvider
ThirdProvider
```

without changing UI architecture.

### Outcome C — Begin own infrastructure

Only if product traction justifies it:

```text
SpectreMailProvider
      ↓
our API
      ↓
our database
      ↓
mail-routing infrastructure
      ↓
our domain
```

This is intentionally not a V1 requirement.

---

# 22. Testing Strategy

## Unit tests

Required for:

```text
OTP detection
verification-link detection
provider normalization
expiry calculations
provider fallback logic
error normalization
storage serialization
```

## Provider contract tests

Every provider must pass equivalent behavior tests:

```text
createMailbox
listMessages
getMessage
health check
expiration handling
```

Optional methods should clearly report unsupported behavior.

## Integration tests

Test real provider lifecycles periodically.

Do not run destructive/high-volume integration tests on every local save.

## Browser tests

Website:

```text
create mailbox
copy address
switch mailbox
open message
copy OTP
clear data
```

Extension:

```text
detect email field
inject SpectreMail affordance
fill email
open popup
receive notification
fill OTP
open side panel
```

---

# 23. CI Gates

Every pull request should eventually require:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Later add:

```text
web Playwright smoke tests
extension smoke tests
provider contract tests with safe mocks
```

Real third-party provider integration tests should be scheduled or explicitly triggered to avoid flaky PRs and accidental API abuse.

---

# 24. Branch and Commit Strategy

## Stable branch

```text
main
```

## Feature branches

Examples:

```text
feat/m0-provider-spike
feat/monorepo-foundation
feat/mailtm-provider
feat/guerrilla-provider
feat/mail-parser
feat/web-mailbox
feat/web-inbox
feat/extension-foundation
feat/email-field-integration
feat/otp-fill
```

## Suggested commit style

```text
chore: initialize SpectreMail monorepo
docs: add architecture and roadmap
test: add provider compatibility spike
feat(providers): add Mail.tm adapter
feat(providers): add Guerrilla Mail adapter
feat(core): add normalized mailbox model
feat(parser): add OTP detector
feat(web): add mailbox creation flow
fix(extension): restore React-controlled email input
```

Avoid a giant first commit containing the entire product.

---

# 25. Pull Request Expectations

Every meaningful PR should answer:

```text
What changed?
Why does this belong in this layer?
What tests were added?
What user flow changes?
Does this introduce new provider coupling?
Does this introduce new extension permissions?
Does this add storage?
Does this affect privacy/security?
```

Provider-specific code outside `packages/providers` requires explicit justification.

---

# 26. Scope-Control Rules

These rules exist to prevent SpectreMail from becoming a generic email platform.

## V1 non-goals

Do not build:

```text
sending email
replying
forwarding
attachments
SMTP hosting
custom domains
SpectreMail accounts
social login
cloud synchronization
AI summaries
AI inbox assistant
premium plan
mobile app
mass account creation
CAPTCHA bypass
trial-abuse tooling
domain-block bypass
disposable-domain evasion
```

A feature should only enter V1 if it materially improves:

```text
get disposable address
receive verification message
find verification information
continue browsing workflow
```

---

# 27. UX Success Criteria

The website should aim for:

```text
Open app → usable email:
a few seconds

Generate mailbox:
1 action or automatic

Copy address:
1 action

See verification code:
immediately highlighted after message arrival

Account creation required:
0
```

The extension should aim for:

```text
Focused email field → disposable address:
1–2 actions

Incoming verification → code copied:
1 action

Incoming verification → code filled:
1 explicit action

Tab switching required:
ideally 0
```

---

# 28. Engineering Success Criteria

Early technical targets:

| Metric | Initial Goal |
|---|---:|
| Healthy-provider mailbox creation success | >95% |
| Incoming message display success | >95% |
| OTP recognition on fixture suite | >90% |
| False OTP suggestions | Low enough not to confuse users |
| Shared provider logic duplicated in apps | 0 |
| SpectreMail accounts required | 0 |
| Paid backend required for MVP | 0 |
| Raw email HTML rendered unsafely | 0 |

These are development targets, not public guarantees.

---

# 29. Privacy Model

SpectreMail should be transparent:

```text
SpectreMail state:
local-first

Incoming mail:
received by selected third-party mail provider

SpectreMail account:
none

Browsing-history database:
none

Ad injection:
none

User-data sale:
none

Analytics:
none initially
```

Do not claim:

> Messages never leave your device.

That is false while third-party providers receive the mail.

Prefer:

> SpectreMail does not require an account and keeps its own mailbox state locally. Incoming mail is processed by the temporary-email provider powering the address.

---

# 30. Provider Independence Exit Strategy

The project should always preserve this evolution path:

```text
V1

Web / Extension
      ↓
SpectreMail Core
      ↓
Mail.tm / Guerrilla
```

Later:

```text
Web / Extension
      ↓
SpectreMail Core
      ↓
SpectreMailProvider
      ↓
our infrastructure
```

The success of this roadmap depends on **never letting provider-specific implementation leak into the product UI**.

---

# 31. Recommended Development Order

The actual order of work should be:

```text
M0  Provider spike
 ↓
M1  Monorepo
 ↓
M2  Domain model
 ↓
M3  Provider layer
 ↓
M4  Parser
 ↓
M5  Functional website
 ↓
M6  Harden website
 ↓
M7  Apply Spectral Swiss design
 ↓
M8  Extension shell
 ↓
M9  Email-field integration
 ↓
M10 Verification workflow
 ↓
M11 Side panel
 ↓
M12 Release hardening
 ↓
M13 Public beta
 ↓
M14 Cross-browser
 ↓
M15 Evaluate own infrastructure
```

The most important sequencing rule is:

> **Do not spend significant time polishing the marketing website before real incoming email works reliably.**

---

# 32. Immediate Next Action

The next implementation task is:

## `M0 — Provider Compatibility Spike`

Create a small technical test harness that proves:

### Mail.tm

```text
create mailbox
receive real email
list message
open message
```

from both:

```text
normal web app
Chrome extension context
```

### Guerrilla Mail

Repeat the same lifecycle while documenting:

```text
session requirements
cookie behavior
expiration
browser restrictions
failure modes
```

At the end of M0, update:

```text
docs/PROVIDERS.md
```

with the actual findings.

Only then proceed to full repository scaffolding and production implementation.

---

# 33. Roadmap Completion Definition

SpectreMail's initial roadmap is considered successfully completed when:

```text
✓ Website is publicly usable
✓ Browser extension is publicly usable
✓ No SpectreMail account is required
✓ Guerrilla Mail works as the website provider
✓ Mail.tm works as the extension's primary provider
✓ Guerrilla fallback works in the extension where technically viable
✓ Provider-specific code is isolated
✓ OTP detection works reliably
✓ Verification links are safely exposed
✓ Browser email-field integration works
✓ Incoming verification notifications work
✓ Side panel provides usable inbox context
✓ Data remains local-first
✓ Privacy behavior is documented
✓ Public branding has been validated
✓ Architecture still permits future own-domain infrastructure
```

At that point the next roadmap should be based on real usage rather than assumptions.

---

## Final Rule

When choosing between:

```text
more features
```

and:

```text
making the disposable-email + verification workflow faster and more reliable
```

choose the second.

SpectreMail should win by making temporary email feel native to the browser, not by becoming a full email client.
