# Design

## Context

M8 is the first milestone whose subject is a **second client** rather than a new layer. Every
package beneath it exists and is verified; what has never existed is a proof that those packages
can be consumed by something other than `apps/web`. That is the change's real deliverable, and
most of what follows is about not breaking it.

The measured facts this design rests on, all recorded in `docs/PROVIDERS.md` and
`tests/provider-spike/`:

| Fact | Consequence for M8 |
| --- | --- |
| Mail.tm sends `Access-Control-Allow-Origin` only to its own origins | Unreachable from a **web page**; reachable from an extension with host permission. This is why the two clients have different provider setups, and it is not a preference. |
| `https://api.mail.tm` is accepted into a manifest and **grants nothing** | Host permissions use the wildcard path form. A slash-less manifest ships looking correct and fails every request with an opaque `TypeError`. |
| No push transport connects — five SSE paths, two WebSocket paths | Polling is the only option, here as on the website. |
| An unrecognised Guerrilla session answers `HTTP 200` with an empty inbox | The adapter's dead-session check is load-bearing, and "no mail" must never be read as "the address is gone". |
| Neither provider publishes a polling limit that governs this client | `INBOX_POLL_PROMPT_MS` and `INBOX_POLL_CEILING_MS` remain the product's own numbers. M8 does not get to invent a measured one. |

## Goals / Non-Goals

**Goals**

- A manifest that is correct in the one way that is measured to be silently wrong if it is not.
- A second implementation of `SpectreStorage` that serves the same contract without pretending
  the platforms are the same.
- The extension's provider configuration derived from one list, reaching two providers in
  preference order — the first exercise of the fallback path.
- A popup that creates, copies, names, reports, and counts, over the shared session.
- **A measurement** of the service worker's lifetime and the `chrome.alarms` floor, recorded in
  `docs/PROVIDERS.md`, before any decision is taken about where the session lives.
- The deferred live host-permission check, performed against the live provider.

**Non-Goals**

- **The content script.** M9 owns in-page integration.
- **The side panel.** M11 owns it.
- **Any polling in the background service worker.** D1.
- **Notifications, OTP copy/fill, verification-link opening.** M10.
- **Site association (`hostname → mailbox`).** M9, with the content script.
- **A provider selector in the popup.** The popup names the provider it used and the one it fell
  back to. A control that can only ever show one state is the control `website-client` already
  forbids the website from shipping; the extension's case for one arrives with M10's workflow,
  where choosing is a user action rather than a disclosure.
- **Styling work.** The popup consumes `packages/ui` tokens and is otherwise unstyled
  composition. M7's visual pass was the website's; the extension's is a later slice and this
  change does not pretend otherwise.

## Decisions

### D1 — The background service worker starts with no polling, and the lifetime is measured first

**The problem.** `packages/mailbox` polls through an injected `MailboxScheduler` and the website
drives it from a live tab. `INBOX_POLL_PROMPT_MS` is **5 000ms** and the ceiling is **30 000ms**.
An MV3 background service worker is idle-terminated — nominally after 30 seconds of inactivity —
and `chrome.alarms` has its own floor, historically **1 minute**, relaxed in later Chromium
versions for unpacked extensions only in some cases. So a session living in the service worker is a
session that **dies**, and one living in the popup dies whenever the popup closes, which is most
of the time. Neither is what the shared layer assumes, and the roadmap does not say which to
choose.

**The options, recorded so the decision is legible later:**

| Option | Cost |
| --- | --- |
| Service worker owns the session, `chrome.alarms` drives it | The effective cadence **cannot** be the shared layer's 5s prompt delay. The mismatch must be an explicit reconciliation, never a silent divergence. |
| Popup owns the session | Unchanged shared layer, but the mailbox goes stale when the popup closes — and M11's side panel exists precisely because the popup is not enough. |
| Offscreen document holds the session | Sidesteps termination, but a persistent hidden document is a real cost to decide deliberately. |
| **Defer; measure first** | The popup ships without polling, and the measurement decides the next slice. |

**Decision: defer, and measure.** The two questions — how long the worker actually survives idle
in real Chromium, and what `chrome.alarms` will actually accept in this Chromium — are
**empirical**, and this repository does not answer an empirical question with a recollection of
documentation. The change therefore **builds the worker, declares it in the manifest, and puts no
polling in it**, and a requirement states that absence so it cannot quietly become an omission.

**What this costs.** The popup shows a mailbox it has created and a status it has read, and its
inbox count comes from an **explicit user-triggered check** rather than a background loop. That is
a real reduction in what the popup does, and the roadmap's "basic inbox count" is satisfied by a
count the user asked for. The alternative — shipping a loop whose lifetime nobody in this
repository has measured, against a provider with no published limit — is the failure mode this
repository has recorded itself avoiding twenty-nine times.

**Why not decide it in this change anyway.** Because the answer is a measurement, and a
measurement taken after the architecture is built is a measurement of the architecture that was
built. Deferring costs one slice of polling. Guessing costs the wrong architecture plus the
measurement that shows it was wrong.

### D2 — The `chrome.storage` adapter lives in `packages/storage`, not in `apps/extension`

**Decision.** The adapter is added beside the IndexedDB one, in the package whose own module note
has said since it was written that the extension's `chrome.storage` adapter is M8's work.

Three reasons, in order of weight:

1. **The boundary rule already says so.** `tests/architecture/boundaries.test.ts` forbids any file
   under `apps/` from naming a platform storage API, with one carve-out for
   `navigator.clipboard`. An adapter inside `apps/extension` would need a second carve-out for
   `chrome.storage`, which is a rule weakened to accommodate a placement.
2. **`packages/storage` is the one package whose `tsconfig` declares `DOM`**, because it is the
   only one whose job is to speak to a platform API. A second client needs a second platform, and
   putting both adapters in one package keeps that justification singular and true.
3. **The website would otherwise grow a sibling.** `apps/web` would import an extension adapter,
   or the adapter would be copied. Either is the duplication M8's gate forbids, one layer down.

**The platform differences are documented, not smoothed over.** `chrome.storage` has **no
transactions**, so `saveMailbox` resolves on the platform's confirmation of the individual write
rather than on a transaction commit, and that difference is stated in the adapter's own
documentation. `clearAll` calls `chrome.storage.clear()` — the **whole area**, not one key, for
the reason the contract already gives and which is a **stronger** fit here than it was for
IndexedDB: there is no `deleteDatabase` and no `onblocked`, so the blocked-removal semantics
`fake-indexeddb` recorded do not arise at all. That is a platform difference that makes the
contract **easier** to satisfy, and it is recorded rather than left for someone to rediscover.

### D3 — The provider list is named, and the fallback is the first it will exercise

**Decision.** `EXTENSION_PROVIDER_IDS = ["mail-tm", "guerrilla"] as const`, with the adapter
registry typed `Record<ExtensionProviderId, …>` exactly as `apps/web`'s is.

The `Record` over a finite literal union is what makes the list a configuration rather than a
comment: adding an id without an adapter beside it **does not compile**. The existing boundary
rule requires the list to be **read as a value** by the factory, which exists because
`apps/web`'s once documented a coupling it did not have.

**This is the first client where fallback can actually happen**, and that is worth stating
precisely: the website's list is one long and `provider-config.ts` says to keep it that way,
because two entries would claim redundancy the website does not have. Here redundancy is real —
Mail.tm is unreachable from a page and reachable from an extension — so the list has two entries
and each means something.

### D4 — The live host-permission check is quarantined from `pnpm verify`

**Decision.** One test contacts a live provider, and it does not run in `pnpm verify`, `pnpm test`,
or the browser tier.

`provider-abstraction` requires that *"a test SHALL exercise the declared pattern against the live
provider origin to prove it grants access."* This milestone is the one `README.md` deferred it to,
so the requirement is owed here and closing it is a deliverable.

**Why quarantine rather than integrate.** Every other provider interaction in this repository is
driven by **recorded** responses, and that is a property the whole suite rests on: no test contacts
a live provider, so the suite is deterministic, offline, and free. Folding one live call into it
would make the whole suite depend on a third party's uptime and rate limit, and would mean
`pnpm verify` fails when Mail.tm is down — which is a fact about Mail.tm, not about this code. The
check runs from its **own** script, is **opt-in**, and its result is recorded in
`docs/PROVIDERS.md` whether it passes or fails.

**What it proves and what it does not.** It proves the **declared pattern** grants cross-origin
access from a real privileged extension context — the thing the slash-less form silently fails. It
does **not** prove `use it externally`: that is the whole signup flow against a real service, and
this is one request from one origin.

**The negative half is the part that matters.** A test that fetches once and passes would also pass
with the slash-less pattern on some configurations. So the check runs **both forms**: the wildcard
form must succeed **and** the slash-less form must fail, in the same run, against the same origin.
A check that cannot fail for the reason it exists is not a check, and that is the thirtieth
instance of that shape in this repository.

### D5 — The browser tier's scope is stated, not widened silently

**Decision.** The extension gets **its own** spec directory and its own runner configuration, and
the existing rule requiring every `*.spec.ts` to be collected by exactly one browser suite is
**extended** to cover it rather than satisfied by the existing `apps/web` suite.

Two things force this. First, `pnpm test:browser` builds the website and serves `apps/web/dist` —
an extension is not a page, and loading one requires a **persistent context** with
`--load-extension`, which is a different Playwright API from `chromium.launch`. Second, the
existing collection rule resolves the configured globs from `playwright.config.ts`; adding a second
suite means **two** configurations to read, and a rule that reads one of them would pass unchanged
while the other collected nothing — which is exactly the silent-skip failure M5 slice 1 recorded
in `packages/` and `browser-verification` recorded again in `apps/`.

The extension's suite runs in **Chromium only**, for the same reason the website's does: adding a
project per engine would turn "verified" into "verified somewhere" without adding evidence.

## Risks / Trade-offs

- **A manifest is a promise.** Shipping one makes the extension installable, and an installable
  extension with a broken permission ships looking correct — which is the entire trap. Mitigated
  by D4's negative half, and by the wildcard form being asserted in the **unit** tier too, so the
  cheap check does not need a browser to run.
- **The popup does less than the roadmap's list suggests.** D1's consequence. Recorded rather than
  hidden: the inbox count is user-triggered, not ambient.
- **A second client is a second place for the abstractions to leak.** Mitigated by the boundary
  rules, which are **widened** rather than satisfied — the collection rule reads both
  configurations, and the client storage rule already covers `apps/extension` today despite it
  having no source.
- **Bundling adds a build step and possibly a dependency.** Preferred path is the Vite already in
  the lockfile at `7.3.6` and already permitted by `allowBuilds`. A genuinely new tool would need
  its reason recorded in `proposal.md`, because a bundler is the kind of dependency that arrives
  silently and then owns the build.

## Migration Plan

None. This is greenfield: there is no legacy extension to migrate and no existing user of one.

## Open Questions

- **Where the session lives** — D1 defers this to a measurement in this change and a decision in
  the next. The measurement is a deliverable, not a best effort.
- **Whether `chrome.alarms` in this Chromium accepts a 30-second period.** Also a measurement.
  It is recorded rather than assumed because the floor has changed across Chromium versions and
  this repository's rule is that a number it cannot defend is not printed.
- **Whether the popup needs `chrome.tabs` or `chrome.scripting`.** Not requested here; the content
  script is M9's, and a permission nothing uses is one M12's permissions review would remove.

### Amendment, recorded during apply (2026-10-07): D1's second open question is answered, and only half

The second open question asked whether `chrome.alarms` accepts a 30-second period. It was measured
(`apps/extension/e2e/alarm-floor.spec.ts`, `docs/PROVIDERS.md` §4.1) and the answer is narrower than
the question implied, so the question is closed as written and a sharper one replaces it:

- **Closed:** the API raises **no floor** in this Chromium. Every requested period was stored
  unchanged, down to 999.6 ms.
- **Still open, and it is the one D1 actually depends on:** whether Chromium **fires** at that rate.
  `getAll()` reports the requested period; Chrome's documented behaviour is to *pack* recurring
  alarms to at most once per 30 seconds. "Accepted 5 s" and "wakes every 5 s" are separate claims and
  only the first is established.

**This does not reopen D1.** A background poller at the page cadence is still unsupported by
evidence, which is what D1 requires. The correction is to the question's wording, not to its answer.

## Verification record

Run by `openspec/changes/extension-foundation/falsify.mjs` on 2026-10-07: **17 deliberate
violations, 17 caught by the intended assertion**, with every mutated file restored and SHA-256
verified and `dist/` rebuilt from restored source. `S16` and `S17` were added *after* the two
repairs below, so the count is a record of the change as it ended rather than a number written
once. What follows is not the tally — a tally proves nothing without the mutants — but the
results worth carrying forward.

### The sync stage, and the one place the delta was weaker than the requirement it replaced

**Recorded at the sync stage (2026-10-07), because the interesting part is what nearly went
wrong and the clause that is still there because it was checked.**

`provider-abstraction`'s MODIFIED block for *"Provider roles are assigned per client, not
globally"* is **weaker** than the requirement it replaces, in one specific detail. The promoted
spec's `A provider is unreachable from a client's environment` scenario carried two clauses the
delta does not:

```text
- **AND** the reason SHALL be recorded in `docs/PROVIDERS.md`
- **AND** a measured reason SHALL cite the run that observed it, while an
  unverified reason SHALL be labelled "unverified" with **no** run claimed
```

Both were searched for across every promoted spec and **exist nowhere else.** Copying the delta
verbatim would therefore have deleted a standing clause about evidence honesty at sync time —
and **nothing would have caught it.** `openspec validate` does not know a clause went missing,
and after the copy the delta and the promoted spec would be perfectly consistent with each
other. The one instrument that would have caught it is the block-for-block comparison below, and
that is now the recorded method for this stage rather than an optional extra.

**This is the recorded M4 lesson arriving from the other direction.** That milestone's sync
stage *added* three scenarios to a promoted spec that its delta did not contain, leaving a gap a
reader would have to reconcile. Here the delta would have *removed* a clause — and an addition
reads as a difference while a removal reads as nothing happening.

The resolution is the same rule stated in the other direction: **the merge keeps the clauses and
the change's delta is amended to match**, so the archived delta and the promoted spec are the
same block. Verified after the amendment, **13 of 13 blocks byte-identical**, checked as whole
blocks and not by title.

**The comparison instrument was itself wrong first, twice, and the second failure is the one
worth carrying.** It reported a divergence in `build-and-verification` that did not exist: the
delta block for the browser-tier requirement had run past its section into
`## ADDED Requirements`, so it held 51 lines where the promoted block holds 49. The spec was
correct and the instrument was not.

**That is the dangerous direction, because a verifier that reports false drift gets deleted
rather than fixed** — and deleting the only verbatim comparison would have removed the check
that caught the clause loss above. Fixed by truncating a block at the next `##` header as well
as the next `### Requirement:`, then re-run.

**The sync's guard regexes were silently dead for one run, and the run reported success.** Two
guards in the spec-creation script asserted that the delta carries no `## Purpose` and is
ADDED-only. A repair written as a `node -e` string substitution turned `/(?m)^## Purpose/` into
`/^m## Purpose/m`, which matches a line starting with the literal characters `m` and can
therefore never fire. The script then ran to completion and wrote a correct spec — **which is
what makes it dangerous**, because a guard that never fires on a correct run also never fires on
a wrong one, and the output was identical either way.

Proving the guards needed **two failed harnesses** before it proved anything, and both failures
were in the proof rather than the guard: the first extracted whole multi-line `if` statements and
re-evaluated them, producing `Unexpected token ')'` for **all three cases including the one meant
to pass**; the second extracted the text correctly and left `delta` unbound, erroring on line one
before any case ran. Only the third — which extracts **the regex literal alone**, the part that
was actually wrong — reported anything: **9 of 9 properties hold**, including the two negative
cases that matter most (a guard must not fire on a line merely *containing* the words, and must
not fire on a requirement body mentioning `## MODIFIED Requirements` in prose — the
"fires on its own documentation" failure this repository records five times).

### The thirty-first recorded instance of a check narrower than the rule it documents, also authored by this change — and this one was in the rule D2 rested on

Task 4.4 asked for confirmation that relocating the `chrome.storage` adapter into
`apps/extension` would **fail** the client storage rule. The measurement says it would not
have. The real 9 242-byte adapter was copied to `apps/extension/src/` and the suite ran:

```text
baseline, probe absent                      0 failed, 53 passed
with the adapter planted in apps/extension  0 failed, 53 passed
```

**The rule named for "no client may reach a store" was blind to the one store a second
client actually uses**, because `chrome.storage` was in neither the client pattern nor the
shared-package one. `D2`'s own module note claimed the decision was safe *because* the rule
would catch a relocated adapter — a claim written before it was measured.

**Widening it cost nothing, and the reason is worth recording because it is not a
lucky accident.** Adding `chrome\s*\.\s*storage\b` fires on **no shipped client file**,
because both seams were written to avoid the literal spelling: `storage.ts` takes the area
as a **parameter**, and `main.tsx` reaches it through
`Reflect.get(Reflect.get(globalThis, "chrome"), "storage")`. **So `D2`'s prediction was
right for a reason that did not yet exist** — it assumed the seam would need a carve-out,
and the seam was written not to, which is what made the wider rule free.

**The widening was falsified rather than assumed load-bearing**, because "the rule now
covers a thing" is exactly the shape of claim that is easy to assert and easy to get
cosmetic:

```text
widened rule    1 failed, 52 passed, probe reported = true
un-widened rule 1 failed, 52 passed, probe reported = false
→ LOAD-BEARING
```

The narrowing was reverted and the file SHA-256 verified. Note what the un-widened run's
*own* failure was: the **new control**, `"chrome storage": "export const x =
chrome.storage.local;"`, which fails when the member is removed — so the control is
load-bearing too, and not merely present.

**The relocated adapter is still not caught, and the reason is the right reason.** It takes
its area as a parameter, so all ten of its `chrome.storage` occurrences are **prose in
comments**, which `stripComments` removes. There was nothing in the relocated file for any
rule to catch. **The requirement is not about where the adapter lives; it is that no client
reaches a store directly**, and that is what is now enforced and what is now measured.

**And the widening found a genuine copy defect on the way.** It reported
`apps/extension/src/storage.ts` line 72 — a **user-facing string** reading *"This extension
context provides no chrome.storage, so SpectreMail cannot store anything here."* A user in a
popup has no idea what `chrome.storage` is, and `apps/web`'s equivalent message comes from
`describeCause(cause)`, which reports the platform's own words and names no internal API.
**This is not the reword-the-prose-until-the-rule-goes-quiet failure this file records three
times over**, and the difference is the distinction worth carrying: the rule fired on a
**string literal**, not on a declaration, and what it found was copy leaking an internal
identifier to an end user. Removing the identifier is the fix; the rule is still doing its
job.

### The thirtieth recorded instance of a check narrower than the rule it documents, authored and caught by this change

`chrome.test.ts > resolves a save only after the platform accepted the write` held a fake that
resolved the write **synchronously inside the promise executor**. A promise resolved on the spot has
already settled by the time the adapter reaches its `await`, so `await area.set(...)` and
`void area.set(...)` produced the same two pushes in the same order, and mutation **S13** — replacing
the `await` with `void` — left the test green.

**The test's name promised "only after"; its fixture could not distinguish "after" from
"immediately".** The repair is the one M6 slice 2's retry assertion needed for the same reason:
**hold the attempt open and inspect the state while the write is out**, rather than only inspecting
the state the buggy implementation also reaches. The wait is a macrotask, not a counted number of
microtasks, because `void` settles on the very next microtask and a guessed tick count is the
recorded defect with a smaller number in it.

### Three mutants that were not violations, and the rule that says so

**S06 came back green and the temptation was to call the sweep too weak.** It is not: the sweep tests
five *named* categories, and the mutant's `outline-offset: 7px` is a length in none of them — a literal
outside the rule's stated scope. **A survivor means the assertion did not catch this, never that the
assertion is too weak, until the mutant has been read.** M7 slice 3 recorded three survivors that were
broken mutants, one of which had been reported as a coverage gap; this is that lesson arriving in a new
shape. Re-targeted to `border-radius: 3px`, it is caught.

**S03 was a `wrongcatch` whose real content was "the mutant broke the product".** Chromium refuses to
load an extension whose declared content script file does not exist, so the spec's `beforeAll` threw
and the test the mutation targeted was never reached. The mirror of the survivor rule: *a wrongcatch
does not mean the assertion is misattributed until the mutant has been read either.* The harness grew
a `plantFiles` mechanism so the mutant could be **repaired into a valid one** rather than filed.

**S13's first form was caught by the wrong test** — a try/catch around the whole load is precisely the
defect the read-failure test names, and the narrower requirement was covered only incidentally. Reading
it said the mutant was not the defect it was aiming at, so it was replaced by one touching only the
write path.

### Task 3.4's claim, falsified before it was ticked

The task says the root `build` "fails when either emits nothing", and that is a claim about a shell
command rather than about an assertion — so it got the same treatment. **The first mutation was a
no-op**: the replacement targeted a `path:` entry `apps/web/vite.config.ts` does not have (it names no
`input` at all, so Vite infers it), the build succeeded, and the run read as a pass. **Verifying the
edit landed is not optional, and this is the second time in this change that a landing-looking green
was actually a failed mutation.** Re-targeted at the thing that actually decides it — `index.html`
moved aside — the measurement is unambiguous:

```text
pnpm build exit=1        error: Could not resolve entry module "index.html"
extension build SKIPPED  true
```

So the `&&` chain is load-bearing and the extension's `dist` is **not** silently left holding the
previous build while the tally claims the command succeeded.

### The harness was wrong first, in the same way as everything else in this list

**Eight of twelve mutations reported `harness-error` on the first run.** Vitest prints
`Tests [22m[39m [1m[32m726 passed`, so a pattern anchored on `^\s*Tests\s+\d+` never matched — and every
mutation read as *"the runner printed neither a passed nor a failed count"*. That is S01's defect one
level down: **an instrument that measured less than the sentence beside it**, and 8/12 failing is a
number that reads like evidence. The tally would have supported the conclusion *"these assertions are
unfalsifiable"*, which is why the repair is recorded next to the `stripAnsi` function rather than only
in the tally.

Two further recorded defects were designed out rather than discovered: **a mutation whose own text
failed to apply skips the run and reports `noop`**, and **a failed build reports `nocompile` with no
run at all** — the browser is never served the previous `dist/` while the tally claims the mutation
survived.

### Two measurements recorded as results rather than as gaps

**The `chrome.alarms` floor could not be measured in the shipped worker**, and that failure is the
finding: `chrome.alarms` is `undefined` there because the manifest correctly omits the permission.
Measuring the floor required rights the product must not have, so it was measured in
`apps/extension/e2e/fixtures/alarm-probe/` — the same quarantine shape D4 establishes. The instrument
that answers a question may need rights the product must not have, and a fixture that ships nothing
is how that is reconciled.

**Task 9.4's confirmation is an instrument, not a claim.** Global `fetch` was patched to throw and all
three suites were run: `pnpm verify` and `pnpm test` green at 726/39, both browser tiers green with no
unrecorded origin requested. **The guard's own positive control was run and failed as it must** — a
planted fetching test goes red with the guard's message — because a green run under a guard that never
fires is the shape this repository has been bitten by repeatedly. **What it does not establish:** the
guard covers the global `fetch` in Node, not a request issued from a Chromium process, and the
quarantine from `pnpm verify`'s *scripts* is enforced by a boundary assertion (mutation **S14**), not by
the guard.