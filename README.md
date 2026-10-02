# SpectreMail

Temporary email for the web and the browser.

SpectreMail gives you a disposable email address you can read without leaving the
page or the signup flow you were on. It exists as a website and as a browser
extension, both talking to the same provider abstraction.

**There is no product yet.** This repository currently contains the architecture,
the toolchain, and the measured provider research that the product will be built
on. See [Current status](#current-status).

---

## Current status

| Milestone                         | State                                 |
| --------------------------------- | ------------------------------------- |
| M0 — Provider compatibility spike | complete (gate satisfied — see below) |
| M1 — Monorepo foundation          | complete and archived                 |
| M2 — Shared domain model          | complete and archived                 |
| M3 — Provider layer               | complete and archived                 |
| M4 — Mail parsing engine          | complete and archived                 |
| M5 — Website core MVP             | next, not yet proposed                |
| M6–M15                            | not started                           |

| Capability spec          | State |
| ------------------------ | ----- |
| `provider-abstraction`   | live  |
| `monorepo-foundation`    | live  |
| `build-and-verification` | live  |
| `shared-domain-model`    | live  |
| `provider-adapters`      | live  |
| `mail-parsing`           | live  |

`provider-adapters` was promoted at the sync stage of the `provider-layer` change, and
`mail-parsing` at the sync stage of the `mail-parsing-engine` change — 9 requirements
and 31 scenarios, three of which were added by its verification pass.

The website **creates a mailbox and renders its address.** That is the first thing in
this repository a user can see work. It has **no inbox, no styling, and no
persistence** — a reload discards the mailbox, because storage is M6. The absence of
styling is a decision rather than an omission: M7 owns the visual design, so markup
written now would be markup M7 rewrites.

Nothing has yet been verified against the **live** Guerrilla Mail API from a
browser. The website's 33 tests render against a stub provider or a recording
transport, which establishes that the page composes the abstraction correctly and
says nothing about whether a real browser reaches that provider successfully.

`packages/core` holds SpectreMail's **normalized domain model** — mailbox, message,
credentials, verification code, verification link, and a closed set of normalized
error codes. It is real, tested code, and it deliberately contains **no provider wire
format and no runtime behaviour**: a provider's field name does not appear anywhere
in it.

`packages/providers` holds the **`MailProvider` contract** and its two adapters —
Mail.tm and Guerrilla Mail — plus one shared conformance suite both must pass with
no per-provider exemption. It is real, tested code, and **no test in it contacts a
live provider**: every test replays recorded provider responses, so the suite
establishes this repository's mapping of a measured wire format and nothing about
either provider's current behaviour.

The website now consumes it, through **one provider only** — Guerrilla Mail, chosen
for the measured CORS reason below. Mail.tm is deliberately _not_ configured for the
website; it remains reachable from the extension, where host permissions make it
legally and technically reachable.

`packages/mail-parser` turns a message body into **readable text plus ranked
detections** — one-time codes and verification links. It is a pure function of
`Message.text`: no network, no clock, no AI, so the same message always yields the
same answer. That matters for a product that tells a user "this is your code", and
it is why the milestone was verifiable without contacting a provider.

It **never renders anything and never opens a link.** There is no markup field to
misuse, and reading a message has no side effect. Nothing it reports is ever
presented as certain — the evidence is wording, and wording is a signal, not proof.

Its 149 tests are driven by a 14-message corpus that is **written, not captured**:
this repository has never received verification mail from any service, so every
fixture says so, and the ones named after services say so explicitly. The corpus
deliberately includes misleading mail — newsletters, order confirmations full of
numbers that are not codes — because a suite of only verification messages cannot
measure a false-positive rate. It establishes how this parser handles mail it was
authored against, and **nothing about any real service's mail.**

Also still a capability rather than a feature: **no client consumes it yet.**

### The one thing you should know

SpectreMail has **no backend and will never proxy a provider API.**

Mail.tm — one of the two providers — sends CORS headers only to its own origins.
A normal web page therefore cannot reach it. There is a tempting fix: stand up a
server and relay the request. SpectreMail does not do that, and the reason is
product policy rather than a terms judgement: the correct response to a provider
that will not serve a web page is to not use it on the web page.

This is why the two clients have different providers, and it is a measured fact,
not a preference:

| Client    | Providers                                | Why                                                                 |
| --------- | ---------------------------------------- | ------------------------------------------------------------------- |
| Website   | Guerrilla Mail only                      | Mail.tm is unreachable from a web page. No fallback in V1.          |
| Extension | Mail.tm primary, Guerrilla Mail fallback | A Chromium extension holds host permissions, so both are reachable. |

Provider availability is **per client**, not global. Both adapters are built in
`packages/providers`, and a client is configured with the providers its own runtime
can actually reach — a manager holding one provider does not pretend a fallback
exists.

---

## Architecture

```text
apps/web  ────────┐
                  ├──> packages/*
apps/extension ───┘
```

Six shared packages, each with one responsibility:

| Package                     | Owns                                                                                                      |
| --------------------------- | --------------------------------------------------------------------------------------------------------- |
| `@spectre-mail/core`        | The normalized domain model and its invariants — mailbox, message, credentials, closed error codes, types |
| `@spectre-mail/providers`   | The Mail.tm and Guerrilla Mail adapters — the only place provider code may live                           |
| `@spectre-mail/mail-parser` | Safe text extraction, OTP detection, verification-link detection                                          |
| `@spectre-mail/mailbox`     | The mailbox session: opening, replacing, retrying, and reporting provider health                          |
| `@spectre-mail/storage`     | The `SpectreStorage` contract, the web IndexedDB adapter, the extension storage adapter                   |
| `@spectre-mail/ui`          | Reusable product UI and design tokens                                                                     |

`packages/mailbox` is **framework-free and DOM-free by compiler rather than by
convention**: its `tsconfig.json` sets `lib: ["ES2023"]` with no `"DOM"`, so `window`,
`document`, and `location` fail to compile there. That is why placing the session
outside `apps/web` is not premature abstraction — it is what keeps the extension from
becoming a rewrite.

**The compiler's reach has a measured limit, and it is worth knowing before
relying on it.** It does **not** reject `navigator`, `localStorage`, or
`sessionStorage` — `@types/node` declares all three, and `"types": []` does not
exclude them — and Node v26.10.0 additionally defines `navigator` and
`sessionStorage` on `globalThis` at runtime. So the missing `DOM` lib removes the
DOM and **not** storage; the second half of that boundary is held by an explicit
rule in `tests/architecture/boundaries.test.ts` rather than by a compiler option.

The boundaries are enforced by a test, not just documented — **23 assertions** in
`pnpm test`. They fail if a package imports an app, if a file outside
`packages/providers` contains a provider JSON field name, if a provider adapter is
implemented or re-exported outside `packages/providers`, if a module in
`packages/mail-parser` or `packages/mailbox` reaches the global `fetch` instead of
its injected transport, if `packages/mailbox` imports a UI framework **in any of the
four import forms**, if it reaches a global store, cookie jar, or URL, if `apps/`
inserts untrusted values as markup, and if **any** shipped test is not actually
collected by the test runner.

Each rule states its own limits in the source, and each was proven able to fail. That
last clause is not a formality: this repository has now recorded **fifteen** instances
of a check that was narrower or broader than the rule it documented while staying
green, including rules that fired on their own documentation and rules whose single
positive control proved only the case its author thought of.

Full detail, including why each rule exists: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

---

## Repository structure

```text
apps/
  web/                 Vite + React website client — creates a mailbox, shows its address
  extension/           placeholder — no manifest, no service worker
packages/
  core/                normalized domain model
  providers/           provider adapters
  mail-parser/         message content interpretation
  mailbox/             the mailbox session
  storage/             persistence contracts and adapters
  ui/                  reusable product UI
docs/
  ARCHITECTURE.md      where code lives and why
  PROVIDERS.md         measured provider evidence
  ROADMAP.md           the milestone plan
openspec/
  specs/               live capability specs
  changes/             active and archived changes
tests/
  architecture/        boundary enforcement
  provider-spike/      the M0 measurement harness — NOT a workspace member
```

### `tests/provider-spike/` is disposable

The M0 spike is **not** a pnpm workspace member. It keeps its own lockfile. This
makes "product code must never import the spike" structurally impossible rather
than a documented rule.

It is not deleted: it is the reproducible evidence behind `docs/PROVIDERS.md`, which
must be re-runnable before release.

---

## Setup

Requires Node.js `v26.10.0` and pnpm `12.6.0` — the versions this repository is
verified against.

```bash
pnpm install
```

That installs the workspace. It does **not** install the spike. To run the spike:

```bash
pnpm --dir tests/provider-spike install
```

---

## Verified commands

Every command below was actually executed on 2026-10-02 and passed. Nothing else
is verified yet.

These results were reached **after** a defect was found and fixed. An independent
verification pass discovered that `pnpm format:check` and `pnpm verify` were
failing on Windows — the environment this project supports — because the
repository pinned `endOfLine: "lf"` for Prettier without shipping a
`.gitattributes`, so Git checked files out as CRLF. CI stayed green throughout,
because `core.autocrlf` does nothing on Linux. `.gitattributes` now makes LF a
committed fact; see [`.gitattributes`](.gitattributes). The lesson is recorded
here rather than quietly dropped: **a green CI run is not evidence that a gate
works on your machine.**

| Command                              | What it proves                                                                 | What it does **not** prove                                                                         |
| ------------------------------------ | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| `pnpm install`                       | The workspace resolves and installs from the committed lockfile.               | Anything about providers or product behaviour.                                                     |
| `pnpm typecheck`                     | All 8 workspace projects type check under the shared strict config.            | That the types are useful — that is what the tests are for.                                        |
| `pnpm lint`                          | ESLint passes.                                                                 | Type correctness; `pnpm typecheck` owns that.                                                      |
| `pnpm format:check`                  | Prettier passes on the files this repository governs.                          | That historical documents are formatted; those are deliberately excluded.                          |
| `pnpm test`                          | 382 tests across 21 files pass, including 23 architecture boundary assertions. | Product behaviour against a **live** provider. Every provider test replays recorded responses.     |
| `pnpm build`                         | The website builds with Vite.                                                  | That packages emit anything — they are consumed as TypeScript source, so there is nothing to emit. |
| `pnpm dev:web`                       | The website dev server starts and serves the app on `127.0.0.1:5173`.          | That a real browser can reach Guerrilla Mail. No live browser run has been made.                   |
| `pnpm spike:selftest`                | The M0 harness records outcomes correctly and writes its artifacts.            | Anything about real providers — it issues zero network requests.                                   |
| `pnpm verify`                        | typecheck + lint + format + test + build all pass in sequence.                 | Anything beyond those five gates.                                                                  |
| `openspec validate --specs --strict` | The live capability specs are internally consistent.                           | That the implementation matches them.                                                              |

### What M0 established

Delivery was observed on **both** providers in spike run `2026-10-01T18-08-41-251Z`.

Still unverified, and stated as such:

- **Long-run mailbox and session expiry.** Mail.tm publishes a 7-day message
  retention and states a mailbox lasts until deleted, but neither value appears in
  any API response and neither was measured live. No countdown may be derived from
  documentation.
- **Delivery reputation.** Proven from one sender. Providers that commonly
  blocklist disposable domains are untested.
- **Mail.tm's terms.** No terms page could be located. No attribution, resale, or
  quota obligation may be asserted _or denied_ until real terms are found.

Measurements, with the exact observations, are in
[`docs/PROVIDERS.md`](docs/PROVIDERS.md).

---

## Deferred verification

**The live host-permission check has not been performed.**

The measured fact stands: `https://api.mail.tm/*` is the required wildcard form, and
a host permission declared as `https://api.mail.tm` **silently grants nothing**.
A manifest using the slash-less form would fail with no error, which is the kind of
trap that is invisible until a user reports a feature that "just doesn't work."

The test that exercises the declared pattern against the live provider needs an
extension and browser-test infrastructure that does not exist yet. It is therefore
**deferred to the milestone that owns extension and provider infrastructure.**

No result is claimed for it, and no throwaway production code was built to
manufacture one. `apps/extension` has no manifest at all, which is why the trap
cannot currently be hit.

---

## Development workflow

`main` is the integration branch. Planned work never goes directly onto `main`.
Every OpenSpec stage uses its own remote branch and a pull request, merged with a
**merge commit** — not squash, not rebase.

Branch naming is by technical scope:

```text
docs/<scope>-proposal      proposal / planning artifacts
feat/<scope>               feature implementation
fix/<scope>                bug fix
refactor/<scope>           behaviour-preserving restructuring
test/<scope>               tests or technical validation
docs/<scope>-spec-sync     syncing a delta spec back to the main specs
chore/archive-<scope>      archiving a completed change
```

Commits use [Conventional Commits](https://www.conventionalcommits.org/):
`feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`.

### OpenSpec

Nontrivial behavioural and architectural changes are specified before they are
implemented. The cycle is:

```text
Explore -> Propose -> Apply -> Verify -> Sync -> Archive
```

```bash
openspec list                            # active changes
openspec status --change <name>          # artifact progress
openspec validate <name> --strict        # artifact consistency
openspec validate --specs --strict       # live capability specs
```

### Relationship to the roadmap

`docs/ROADMAP.md` is the **program-level plan**: fifteen milestones from the
provider spike to a public beta. It owns the `Project Status` ledger.

OpenSpec changes are **bounded implementation units**, not milestones. The roadmap
says _what_ the program does and in what order; an OpenSpec change specifies _how_
one coherent piece of it behaves. The roadmap is the plan, OpenSpec is the
specification, and the capability specs under `openspec/specs/` are the
behavioural source of truth when the two disagree.

---

## Privacy model

SpectreMail reads disposable mailboxes and nothing else.

- **No backend.** No SpectreMail-operated server, and no proxying of provider APIs.
- **No account.** There is no sign-up and no user record.
- **Client-side storage.** Mailboxes persist in IndexedDB on the web and extension
  storage in the extension, behind a shared contract. Storage is the client's, not
  the provider's and not ours.

Temporary addresses are disposable by design. Anything sent to one is readable by
whoever holds the address, so it must never be used for anything that matters.

---

## License

No license has been chosen yet. All rights reserved until one is.
