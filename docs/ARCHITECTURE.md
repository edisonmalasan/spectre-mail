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

| Package                     | Owns                                                                                                                                                | Must never contain                                       |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `@spectre-mail/core`        | Mailbox lifecycle, provider selection, provider health, the mailbox manager, message and error normalization, expiration logic, shared domain types | Provider wire format; any HTTP call to a provider        |
| `@spectre-mail/providers`   | The Mail.tm adapter, the Guerrilla Mail adapter, any future SpectreMail-operated provider                                                           | Business logic that belongs in `core`; presentation      |
| `@spectre-mail/mail-parser` | Safe text extraction, OTP detection, verification-link detection, message classification                                                            | Anything that renders markup; provider field names       |
| `@spectre-mail/storage`     | The `SpectreStorage` interface, the web IndexedDB adapter, the extension storage adapter                                                            | Provider wire format; assumptions specific to one client |
| `@spectre-mail/ui`          | Reusable product UI and design tokens                                                                                                               | Marketing-only website sections                          |

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

---

## Applications

### `apps/web`

A static Vite + React site with **no backend**. SpectreMail operates no server and
never proxies a provider API. That is a product policy, not a terms judgement:
Mail.tm grants no CORS to third-party origins, so the correct response is to leave
it out of the website rather than build infrastructure to route around it.

The dev server binds loopback only.

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

`tests/architecture/boundaries.test.ts` asserts:

- the packages and apps the roadmap specifies exist;
- the workspace declares exactly `apps/*` and `packages/*`;
- the spike is outside the workspace **and** still exists;
- no package imports an app;
- no file under `apps/` contains a measured provider JSON field name;
- provider adapter identifiers appear only in `packages/providers`;
- no workspace file references the spike.

Each check was proven able to fail by deliberately introducing the violation and
observing a non-zero exit. An empty suite was also proven to exit 1:
`passWithNoTests` is left off, because a green run that inspects nothing is worse
than no run at all.

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

What the model deliberately does **not** contain yet: any `MailProvider` contract,
any provider adapter, any mailbox lifecycle or expiry evaluation, and any mapping
from a provider's HTTP response onto the normalized error codes. Those need a
provider that has actually been observed, which is the next milestone's job.

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
