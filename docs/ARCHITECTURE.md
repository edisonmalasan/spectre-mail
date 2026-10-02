# Architecture

This document records where code lives in SpectreMail and why. The rules here are
enforced by `tests/architecture/boundaries.test.ts`, not merely documented — see
[Enforcement](#enforcement).

The behavioural source of truth is the OpenSpec capability specs under
`openspec/specs/`. This document explains the code layout those specs describe; it
does not override them.

---

## Dependency direction

```text
apps/web  ────────┐
                  ├──> packages/*
apps/extension ───┘

packages/* ──✗──> apps/*      forbidden in both directions of that arrow
```

Two apps are clients. Five packages are shared. Everything both clients need lives
in a package, because the extension and the website have different capabilities,
different storage, and different provider access — and duplicating logic between
them is how the two copies drift.

A shared package importing from an app would invert the dependency and make the
package unusable by the other client. That is why the rule is symmetric: apps
depend on packages, never the reverse.

---

## Packages

| Package                     | Owns                                                                                                                                                                       | Must never contain                                                     |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `@spectre-mail/core`        | The normalized domain model and its invariants — mailbox, message, credentials, the closed set of normalized error codes, shared types                                     | Provider wire format; any HTTP call to a provider; lifecycle behaviour |
| `@spectre-mail/providers`   | The `MailProvider` contract, the Mail.tm adapter, the Guerrilla Mail adapter, the shared conformance suite, the provider manager, any future SpectreMail-operated provider | Business logic that belongs in `core`; presentation; any storage       |
| `@spectre-mail/mail-parser` | Safe text extraction, OTP detection, verification-link detection, message classification                                                                                   | Anything that renders markup; provider field names                     |
| `@spectre-mail/mailbox`     | The mailbox session — opening, replacing, retrying, provider health — as state values a client renders                                                                     | Any framework; any DOM; any storage; any request of its own            |
| `@spectre-mail/storage`     | The `SpectreStorage` interface, the web IndexedDB adapter, the extension storage adapter                                                                                   | Provider wire format; assumptions specific to one client               |
| `@spectre-mail/ui`          | Reusable product UI and design tokens                                                                                                                                      | Marketing-only website sections                                        |

### The session layer

`packages/mailbox` exists because **two sources disagreed**, and the conflict was
resolved against the approved specification rather than the plan. `docs/ROADMAP.md`'s
shared-package list assigned "mailbox lifecycle" and "mailbox manager" to
`packages/core`; the approved `shared-domain-model` Purpose says that package
describes "the model and its invariants only", and excludes lifecycle behaviour. A
roadmap sentence cannot amend an approved specification, so the behaviour moved to a
new package and the roadmap's list was amended to match.

**The boundary is enforced by the compiler, not by convention.** Its `tsconfig.json`
sets `lib: ["ES2023"]` with no `"DOM"` entry, so `window`, `document`, and
`navigator` fail to _compile_ in that package. A framework import would also fail
typecheck, and `tests/architecture/boundaries.test.ts` scans for one as a
supplementary backstop — but the backstop is the weaker of the two, because a `tsconfig`
cannot be forgotten in a file but a scanning rule can be outrun by syntax it did not
anticipate. That ordering is deliberate: the strongest available enforcement comes
first, and the weaker one exists only as a backstop with its own limits stated in its
own comment.

**The session holds no state that outlives it and no reference to itself.** Its state
is an immutable discriminated union — `creating`, `ready` with a mailbox, `failed`
with a normalized code — rather than a mailbox plus a loading flag, because those two
can disagree, and a disagreement is a rendering bug no unit test writes itself. Every
variant is `readonly` and holds no reference to the session that produced it, so a
client may render a state long after the session that made it is gone.

**It performs no request of its own.** Every call goes through the injected
`ProviderManager`; `packages/mailbox`'s own suite asserts zero requests against a
recording transport, and a positive control drives the same two operations straight
through the real Guerrilla adapter over that same transport so the zero is a
measurement rather than an inert assertion.

### The provider layer

`packages/providers` holds the `MailProvider` contract and the two adapters that
implement it. One contract, reached identically by every client, so a caller never
branches on which provider it asked.

**The contract has no subscription method.** Measured: five SSE candidate paths and
two WebSocket candidates were probed and none connected. Mail.tm's
`GET /messages/events` answers `406` for `Accept: text/event-stream` and `404` for
every format its negotiator accepts, while the provider's own marketing copy claims
SSE is available. An optional method is still a method — a caller that checks for it
and finds it absent still handles absence — so the method is removed rather than
declared and left unimplemented. Messages arrive by the caller polling.

**Every request goes through an injected transport.** There is no module-level
`fetch` call in the package, and `tests/architecture/boundaries.test.ts` asserts it.
Neither a web page nor an MV3 service worker lets a test intercept `fetch`, so
without this seam verifying an adapter means contacting a third party, and the suite
would then fail whenever that provider is down or rate-limiting — turning their
availability into this repository's CI status.

The recorded responses the suite runs from are real, measured provider output
(`docs/PROVIDERS.md`), so the awkward shapes are exercised: a message that arrived
with an **empty subject**, and an HTML body under a declared plain-text content type.

The cost is stated rather than hidden: recordings mean the suite cannot notice a
provider _changing_ a field name. Fixture refresh is a deliberate diff.

**Optional operations are guarded, not merely optional.** `deleteMessage?` and
`destroyMailbox?` stay genuinely optional so absence remains detectable via
`supports()`. `operations.ts` is the only sanctioned way to invoke them, and it
converts absence into `UNSUPPORTED_OPERATION` carrying the operation's name.

That guard exists because of what happened without it. The verification pass found
the requirement unimplemented: calling an absent optional method raised
`TypeError: provider.destroyMailbox is not a function`. A `SpectreError` is a value a
caller can branch on; a `TypeError` says "this program is broken", so no layer that
knows only the closed error vocabulary can catch, present, or recover from it — and
it named the implementation detail rather than the operation the caller asked for.

**Adapters hold no state.** Every call takes the mailbox it operates on and derives
the credential from it. This is asserted behaviourally, one test per adapter, by
driving a single adapter instance across two mailboxes with different credentials
and checking each request carried its own mailbox's credential.

That test exists because the coverage was structurally absent: every other test in
the package builds a **fresh adapter per call**, so an adapter caching the first
mailbox's credentials would have passed all of them — the cache would never be read
by a test handing over a different mailbox.

### The provider boundary

`packages/providers` is the **only** place provider wire format may appear. No
React component may ever need to understand Mail.tm JSON or Guerrilla Mail JSON.

This is not stylistic. Provider APIs are measured, not designed, and they behave in
ways that leak:

- Guerrilla Mail declares `content_type: "text"` while returning an HTML body. A
  real delivered message arrived as raw HTML.
- A dead Guerrilla session returns HTTP 200 with an `error` key and no message
  list, while `auth.success` stays `true`.

So a client that reads provider fields directly inherits two failures it cannot
recover from: it may render untrusted markup, and it cannot tell "no messages"
from "session gone". Normalization is what makes those states distinguishable, and
it has to happen at the adapter boundary — not in a component.

### Provider roles are per client

Provider availability is **not** a global property. It differs per client, for a
measured reason:

| Client                       | Providers                                | Why                                                                                                                                                |
| ---------------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Website (`apps/web`)         | Guerrilla Mail only                      | Mail.tm sends CORS headers only to its own origins, so no compliant web page can reach it. SpectreMail does not add a backend to work around this. |
| Extension (`apps/extension`) | Mail.tm primary, Guerrilla Mail fallback | A Chromium extension holds host permissions, so both are reachable.                                                                                |

Both providers are still built in `packages/providers`. A client not being able to
use a provider is a client concern, not a reason to omit the adapter — the
extension needs Mail.tm, so the website's single-provider setup must not shape the
shared package.

### The message parsing layer

`packages/mail-parser` is a **pure function of `Message.text`**: safe text
extraction, one-time-code detection, and verification-link detection. It has no
network, no clock, and no AI, and no client consumes it yet. Three properties of
it are architecture, not implementation detail:

**The seam is exactly `Message.text`, and there is no markup field to misuse.**
`shared-domain-model` deliberately gives `Message` one text field and no markup
field, because Guerrilla Mail was measured returning an HTML body under a declared
`content_type: "text"` (`docs/PROVIDERS.md` §3). So M4 does not receive "an HTML
document" or "a clean body" — it receives a string that may be either, and must
produce something readable and detectable from both. A consumer therefore cannot
reach for raw markup even by mistake, and no code in the package consults a declared
content type, because there is none to consult.

**Reading a message has no side effect, and that is enforced twice.** The package
must never gain a network call: detection reads a message a provider already
delivered, so a request inside it would mean parsing causes an effect — the opposite
of what the milestone promises. `tests/architecture/boundaries.test.ts` asserts no
module in the package reaches the global `fetch` (comments stripped first, or the
rule fires on its own documentation), and `fixtures/corpus.test.ts` proves **zero
requests by observation** with an instrumented transport. Neither substitutes for
the other: a source scan cannot see a resolver obtained indirectly, and an
instrumented transport cannot name the offending line.

The structural rule is one named escape hatch, not a general I/O audit. It matches
`fetch` and does **not** check `XMLHttpRequest`, `WebSocket`, `EventSource`, or a
dynamic import. That limit is stated in the rule itself so a reader does not assume
more than it checks.

**Detection reads wording and never the address.** A link's score is raised by its
anchor text and the surrounding wording, and by nothing in the URL's host, path, or
query — a large share of links in ordinary mail carry verification-shaped words in
their addresses for reasons unrelated to verification. Non-web schemes are rejected
rather than down-ranked, because a `javascript:` destination is not a weak
verification link; it is not a link to follow.

Two properties are load-bearing for later milestones and easy to break:

- **A reducing numeric shape is a penalty, never an exclusion.** A price, an order
  number, a tracking number, a postal code, a phone number, a date, or a year are all
  still **returned**, ranked last. A real order confirmation can contain a 6-digit
  number that genuinely is a one-time code, so a hard exclusion would silently delete
  it — the one failure mode this product cannot have. A consequence worth stating: a
  newsletter yields **one low-ranked candidate**, its copyright year, not zero
  candidates.
- **No detection is ever reported as certain.** The maximum is `0.85` for a code and
  `0.70` for a link, by construction (published arithmetic) rather than by clamp
  alone. `shared-domain-model` permits `1` because `0..1` is the right _range_; it
  says nothing about certainty being earned, and wording is a signal, not proof.

**There is no threshold in the parser.** Every candidate that survives shape
filtering is returned whatever its confidence, because where to cut off is a product
decision for whoever has a user in front of them, and a wrong constant here silently
deletes real codes. Links are the one exception, and it is a **gate** rather than a
cut-off: a link whose wording names nothing is an ordinary link rather than a weak
verification link, so no score is computed for it and none is discarded. There is no
constant in it to tune.

---

## Applications

### `apps/web`

A static Vite + React site with **no backend**. SpectreMail operates no server and
never proxies a provider API. That is a product policy, not a terms judgement:
Mail.tm grants no CORS to third-party origins, so the correct response is to leave
it out of the website rather than build infrastructure to route around it.

The dev server binds loopback only.

**The website holds no provider logic.** Its provider choice is a constant in
`apps/web/src/provider-config.ts`, composing the shared `ProviderManager` over
Guerrilla Mail alone and a `fetch` transport built by the shared factory. The three
files that may name an adapter or a composition seam are that module, `transport.ts`,
and `packages/mailbox`; `tests/architecture/boundaries.test.ts` enforces it by path,
strips comments before matching, and states its own limits in its own source — it
cannot tell a definition from a call, so it verifies _where_ an adapter may be named,
never _why_. A client that reached for Mail.tm anyway would pass that rule and be
caught by the `website-client` one-provider requirement instead.

**It creates a mailbox and renders its address, with no inbox, no styling, and no
persistence.** A reload discards the mailbox because storage is M6. The absence of
styling is a decision, not an omission: M7 owns the visual design, and markup written
before it would be markup M7 rewrites. There is also **no mailbox expiry countdown**,
because no provider returns a lifetime in any API response and none was measured live
— an elapsed guess is not an expiry signal.

### `apps/extension`

A placeholder. It has **no** `manifest.json`, no service worker, and no build step.

This is deliberate rather than incomplete. The roadmap schedules the extension
build for M8. A manifest with placeholder permissions would be worse than nothing,
because it would look like a working extension in precisely the area where M0
measured a silent-failure trap: a host permission declared as
`https://api.mail.tm` grants **nothing**, silently, while `https://api.mail.tm/*`
works. An absent manifest cannot mislead.

Extension work starts after the website core is stable. Doing it first would mean
building mailbox logic inside an app with no shared core, then extracting it under
deadline.

---

## The M0 spike is outside the workspace

`tests/provider-spike/` is **not** a pnpm workspace member. It keeps its own
`package.json` and its own `pnpm-lock.yaml`.

Three reasons:

1. It carries `playwright` as a dev dependency. As a member, every root
   `pnpm install` would pull Playwright's package graph for contributors who will
   never run it.
2. It is hand-rolled `.mjs` with no types, so it could not satisfy the workspace
   typecheck or lint gates without permanent suppressions.
3. Excluding it makes "product code must never import the spike" **structurally
   impossible** rather than a documented rule. Documentation is a rule someone can
   violate; workspace membership is a constraint.

It is not deleted. It is the reproducible evidence behind `docs/PROVIDERS.md`, which
must be re-runnable before release. Retiring it is M3's decision, once real
adapters exist to replace it.

To run it:

```bash
pnpm --dir tests/provider-spike install
pnpm --dir tests/provider-spike spike:selftest
```

The root `pnpm test` deliberately does **not** sweep `tests/`. The `include` glob
in `vitest.config.ts` names `tests/architecture/**/*.test.ts` explicitly, so no
change to the harness can accidentally cause a live provider probe to execute as
part of an ordinary test run.

---

## Build and consumption model

Shared packages are consumed **as TypeScript source**. Each package's `exports`
points at `./src/index.ts`, and Vite compiles workspace TypeScript directly.

There is no per-package build step and no bundler. That machinery would mean
choosing a bundler, a `tsc` emit strategy, declaration output, and a watch mode —
four decisions serving code that does not exist yet.

**The consequence, stated plainly:** `pnpm build` builds the website only. It does
not emit packages, because there is nothing to emit. Package correctness is
established by `pnpm typecheck`, which is a separate acceptance criterion. This is
documented rather than hidden behind a `build` script that quietly does nothing.

Revisit when a package must be consumed by something that is not Vite — a Node
script, or a published artifact. That is the moment to add a real build.

---

## TypeScript configuration

`tsconfig.base.json` at the root holds the shared strictness. Every package and app
extends it:

| Setting                                 | Why                                                                                                         |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `strict`                                | Non-negotiable baseline.                                                                                    |
| `noUncheckedIndexedAccess`              | Provider responses are untrusted arrays and maps. Without it, `messages[0]` is typed as defined and is not. |
| `exactOptionalPropertyTypes`            | Distinguishes "absent" from "present and undefined", which matters for optional fields like `expiresAt`.    |
| `verbatimModuleSyntax`                  | Makes type-only imports explicit, so an import cannot silently become a runtime dependency.                 |
| `isolatedModules`                       | Required for bundler-based transpilation.                                                                   |
| `moduleResolution: "bundler"`           | Matches how Vite actually resolves.                                                                         |
| `noUnusedLocals` / `noUnusedParameters` | Dead code fails the build rather than accumulating.                                                         |

A package must not weaken shared strictness to make its own type check pass. If a
genuinely package-specific option is needed, it goes in that package's extending
config and the difference is deliberate and reviewable.

`apps/extension` uses `"files": []` — TypeScript's documented way to declare a
project with no inputs on purpose, so `tsc --noEmit` succeeds instead of failing
with "No inputs were found".

---

## Enforcement

`tests/architecture/boundaries.test.ts` asserts **20** things:

- the packages and apps the roadmap specifies exist;
- the workspace declares exactly `apps/*` and `packages/*`;
- the spike is outside the workspace **and** still exists;
- no package imports an app, including a dynamic `import("…")` or a bare side-effect
  `import "…"`;
- no workspace source file outside `packages/providers` contains a measured provider
  JSON field name;
- a provider adapter is neither implemented nor re-exported outside
  `packages/providers`, and is named only in a client's `provider-config.ts` or a test
  file;
- the composition seams (`createProviderManager`, `createFetchTransport`) are named
  only in a client's `provider-config.ts` or `transport.ts`, in `packages/mailbox`,
  or in a test file;
- no module in `packages/providers` or `packages/mail-parser` reaches the global
  `fetch`;
- `packages/mailbox` imports no framework;
- no file under `apps/` reaches for a markup escape hatch;
- every client test file is actually **collected** by the configured globs;
- no workspace file references the spike.

Each check was proven able to fail by deliberately introducing the violation and
observing a non-zero exit. An empty suite was also proven to exit 1:
`passWithNoTests` is left off, because a green run that inspects nothing is worse
than no run at all.

**The adapter-identifier list was wrong until M3, and the test stayed green.** It
held `MailTmProvider`, `GuerrillaMailProvider`, and `SpectreMailProvider` — **none of
which had ever existed**. M3 named its exports `createMailTmAdapter` and
`createGuerrillaAdapter`, and the rule continued passing while guarding nothing,
because a list of identifiers nothing references cannot fail. That is the **fourth**
time this repository has shipped a check narrower than the rule it documented (M1:
the import pattern and this rule's scope; M2: the wire-format scope, then a type
assertion that resolved to `never` for every input). The list now names the real
exports _and_ matches the adapter-factory shape, so the next provider cannot be added
outside the package without naming it first.

The `fetch` rule initially fired on its own documentation — `contract.ts` explains
in prose that it has no subscription method, and a rule that cannot tell a
declaration from a comment about that declaration is measuring the wrong thing. Fixed
by stripping comments before matching, not by rewording the comment until the rule
went quiet.

**The `fetch` rule was widened at M4 to cover `packages/mail-parser`**, for a stronger
reason than the provider layer's: that package has no transport seam at all and must
never acquire one, since detection reads a message a provider already delivered. The
widening is proven able to fail — a `fetch` call introduced into the package makes the
rule exit non-zero naming the file and line.

**An eighth instance of the same defect class, found by falsification rather than by
reading.** M4's penalty-cap test asserted that a candidate matching three reducing
shapes scores the same as one matching two, which is the cap working. With
`MAX_TOTAL_PENALTY` deleted, **both scores fell through zero and clamped to the same
`0.05` floor — so the equality still held and the suite stayed green.** The assertion
survived deletion of the exact thing it was written to pin down. It now asserts the
published arithmetic directly, and the mutant is caught.

It is a sharper instance than the previous seven, and worth isolating: **an assertion
comparing two outputs of the same function can pass for a reason that has nothing to
do with the rule it names.** Every earlier instance was a rule failing to cover a case.
This one was a case covered by a comparison that could not distinguish the right reason
for equality from a wrong one.

**A ninth and tenth instance of the same defect class, both found at M5 and pointing
in opposite directions.** The adapter-confinement rule was **broader** than its
documented intent — it also forbade `createProviderManager` and
`createFetchTransport` outside `packages/providers`, which made `MailProvider` and
`ProviderManager` impossible to instantiate outside the package declaring them, and
made a browser unable to turn `fetch` into a `Transport` at all. Both are references
to a package's public API, which is what a public API is for. Confinement means an
adapter may not be _implemented_ or _re-exported_ outside the package, and may not be
_named_ outside the files entitled to choose providers. The rule now separates the
two entitlements, and states its limits in its own source: it is by path and cannot
tell a definition from a call.

Worse, that rule **fired on its own documentation** — the third time in this
repository that has happened. `packages/mailbox` explains in prose what it
deliberately does not do, and the scan read that sentence as a declaration. Fixed by
stripping comments before matching, **not** by rewording the prose until the rule went
quiet; rewording would have deleted the reason the next reader needs. The same
stripping fixed a second instance found the same day, where `Address.tsx` documents
`dangerouslySetInnerHTML` by name.

**The client-test collection check exists because a client test was silently
skipped.** The root Vitest `include` globs named `tests/architecture` and
`packages/*/src` but **not** `apps/*/src`, so `apps/web`'s tests never ran — and an
undiscovered test reads as covered. The globs are now named explicitly, and the
check resolves them against the real test files so narrowing the list **reports** the
uncovered file rather than passing. The global `environment` stays `"node"`: a client
test opts into jsdom per file, because setting jsdom globally would hand
`packages/mailbox` a DOM its own `tsconfig` exists to withhold.

**Scope of the field-name check.** It matches a fixed list of names measured from
live responses. It is a **tripwire, not a proof of absence**, and it can fire on
an unrelated local identifier. Broad words like `list`, `error`, `id`, and `token`
are deliberately excluded: a rule that fires on ordinary code gets disabled within
a week, which is worse than having no rule. When it fires, the fix is to rename the
local identifier — not to widen the exclusion.

**Widened at M2, after the M2 falsification pass found it too narrow.** It used to
scan `apps/` only, which meant `packages/core` — the package whose entire purpose is
to be free of provider wire format — was not covered by it at all. The scope is now
every workspace source file except `packages/providers`, which must speak the
provider's vocabulary in order to translate it. Two deliberate exemptions:
`*.test.ts` files, because a check that asserts a name's absence has to name it, and
this file, which holds the list itself. Widening the scope immediately caught one
real violation: a comment in `packages/mail-parser` quoting a provider's content-type
field name. The comment was reworded rather than the rule narrowed, on the grounds
that reproducing a wire identifier buys no clarity that `docs/PROVIDERS.md` does not
already provide.

---

## The shared domain model

`packages/core` holds SpectreMail's own vocabulary: what a mailbox, a message, a
credential, a verification code, and a failure _are_. It exists so that both clients,
both provider adapters, storage, and the parser can agree on those things without any
of them depending on a provider's wire format.

Three constraints shaped it, and all three came from measurement rather than taste:

- **A required field may be empty.** A real Guerrilla message arrived with an empty
  subject while its sender and body were present. A model that treated emptiness as
  absence would discard a message that genuinely arrived.
- **Expiry is observed, never inferred.** No provider reports a mailbox lifetime in
  any API response, so `expiresAt` is a field that is almost always absent. It may
  only ever be populated from a signal the provider actually reported — never from
  elapsed time, and never from published documentation.
- **The two session models differ in kind.** Mail.tm issues an account plus a bearer
  token; Guerrilla issues a session id that must come from the response body rather
  than the `PHPSESSID` cookie, because the provider sends
  `Access-Control-Allow-Origin: *` with no `Access-Control-Allow-Credentials`.

One structural point is worth knowing before reading the code. A mailbox carries both
a `provider` and its `credentials`, and nothing in the bare type connects them — while
the provider contract reads credentials straight off the mailbox. Left alone, a
mailbox could claim one provider and carry another's credentials. The model closes
this at a single construction entry point that derives `provider` from the credential
discriminant, so the caller cannot supply a contradicting provider at all.

Credentials are normalised too, in both senses: their shape is discriminated per
provider so the two are never interchangeable, and their field names are
SpectreMail's own rather than the provider's. Nothing in `packages/core` names a
provider's response field, and `tests/architecture/` now enforces that.

What the model deliberately does **not** contain: any `MailProvider` contract, any
provider adapter, any mailbox lifecycle or expiry evaluation, and any mapping from a
provider's HTTP response onto the normalized error codes. The contract and the
adapters are in `packages/providers`; the lifecycle is in `packages/mailbox`. Neither
belongs here, because this package describes **the model and its invariants only** —
that sentence is its approved Purpose, and it is why the roadmap's assignment of
"mailbox lifecycle" to `core` was amended rather than followed.

---

## Related

- `docs/ROADMAP.md` — the milestone plan, including what each package will own once
  implemented.
- `docs/PROVIDERS.md` — the measured provider evidence this architecture is built
  around.
- `openspec/specs/provider-abstraction/spec.md` — the provider capability contract
  (live).
- `openspec/specs/monorepo-foundation/spec.md` — the layout and boundary contract.
- `openspec/specs/build-and-verification/spec.md` — the toolchain contract.
- `openspec/specs/shared-domain-model/spec.md` — the domain model contract (live).
