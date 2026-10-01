# SpectreMail

**Temporary email without interrupting what you're doing.**

SpectreMail gives you a disposable email address, lets you receive
verification messages in it, and surfaces the one thing you actually came for:
the code or the link — without making you leave the page you were on.

> **Status: pre-alpha.** Milestone **M0 (provider compatibility spike)** is
> complete and its findings materially changed the provider plan. There is no
> working product yet: no website, no extension, no user-facing UI.
> `SpectreMail` is a project codename until naming checks are complete.

- **Roadmap:** [`docs/ROADMAP.md`](docs/ROADMAP.md) — the program plan, with a
  `Project Status` block recording live progress.
- **Provider findings:** [`docs/PROVIDERS.md`](docs/PROVIDERS.md) — what the
  providers actually do, measured rather than assumed.
- **Engineering rules:** [`AGENTS.md`](AGENTS.md) — how work is planned,
  verified, and merged here.
- **How this repo works:** [`openspec/`](openspec) — spec-driven development.

---

## Current development status

| Milestone | State |
|---|---|
| M0 — Provider compatibility spike | ✅ complete (gate satisfied — see below) |
| M1 — Monorepo foundation | ⛔ not started |
| M2–M15 | ⛔ not started |

No application code exists yet. The repository currently contains
documentation, the OpenSpec change for M0, and the disposable spike harness.

### The one thing you should know

The M0 spike **inverted the provider plan**. Mail.tm — the planned primary
provider — is **unreachable from a normal web page**: it sends CORS headers only
to its own origins, and its terms forbid proxying the API. It works perfectly
from a Chromium extension, which holds host permissions.

Guerrilla Mail is the reverse: it works from a normal web page *and* from an
extension. The resulting decision: **the website ships on Guerrilla Mail only, and
the extension uses Mail.tm primary with Guerrilla Mail as fallback.**

Both providers were also proven end to end: a real external email was observed
arriving on a live mailbox for each. Mailbox expiry remains unproven — neither
provider advertises a TTL.

Full evidence, including what remains unproven, is in
[`docs/PROVIDERS.md`](docs/PROVIDERS.md).

---

## Architecture (planned)

The roadmap defines a monorepo where the website and the extension are two
clients of one shared core:

```text
apps/web ───────┐
                ├──→ packages/core
apps/extension ─┘      packages/providers
                       packages/mail-parser
                       packages/storage
                       packages/ui
```

Shared packages must never import from the apps. Provider-specific code lives
only in `packages/providers`; no React component may ever understand a
provider's JSON.

This structure is **not built yet**. It arrives in M1.

---

## Project structure

```text
spectre-mail/
├── AGENTS.md                     engineering + workflow authority
├── README.md                     this file
├── docs/
│   ├── ROADMAP.md                program plan + live Project Status
│   └── PROVIDERS.md              measured provider findings (M0)
├── openspec/
│   ├── specs/                    approved capability specs
│   └── changes/                  in-flight changes
└── tests/
    └── provider-spike/           DISPOSABLE M0 harness — not product code
```

### `tests/provider-spike/` is throwaway

It exists to answer whether providers work, in a real browser, before any UI is
built. Nothing may import it, reusable provider logic belongs in
`packages/providers` (M3), and it is retired or absorbed during M1/M3. See its
[README](tests/provider-spike/README.md).

---

## Local setup

Verified on **Windows 11**, **Node.js v26.10.0**, **pnpm 12.6.0**.

```bash
pnpm --version
node --version
```

The spike is the only thing installed today. It is deliberately **not** a
workspace member — no workspace exists until M1.

```bash
pnpm --dir tests/provider-spike install
pnpm --dir tests/provider-spike exec playwright install chromium
```

---

## Verified commands

Every command below was actually executed. Nothing else is verified yet.

| Command | What it proves | What it does **not** prove |
|---|---|---|
| `pnpm --dir tests/provider-spike install` | The spike manifest resolves and installs. | Anything about providers or the product. |
| `pnpm --dir tests/provider-spike spike:selftest` | The harness records `passed`/`failed`/`unsupported`/`unverified` correctly, a failing probe never aborts a run, and both run artifacts are written. | Anything about real providers — it issues zero network requests. |
| `pnpm --dir tests/provider-spike spike` | The real Mail.tm and Guerrilla Mail lifecycles, CORS behaviour, and browser-context reachability, as recorded in `docs/PROVIDERS.md`. | Real external message delivery — it has no sender, so that check reports `unverified` unless you use `spike:interactive`. Also not long-run mailbox expiry. |
| `pnpm --dir tests/provider-spike spike:interactive` | Same, plus it prints a live address and waits for you to send it a real message. This is how delivery was verified. | Anything if you don't send a message — the check reports `unverified`. |
| `openspec validate m0-provider-spike --strict` | The active OpenSpec change is internally consistent. | That the implementation matches it. |

The spike exits non-zero when a probe **fails**. `unsupported` and `unverified`
are findings, not failures, and never affect the exit code — but they are
printed prominently and are never described as passes.

### A note on `unverified`

Real external message delivery has been **verified on both providers**: run
`2026-10-01T18-08-41-251Z` observed a genuine external email arriving on a live
mailbox for Mail.tm and for Guerrilla Mail.

One check is still unverified and must not be reported as working:

- long-run session and mailbox expiry — neither provider advertises a TTL, so
  `MailboxStatus: expired` cannot yet assume one

Re-running the spike without a sender still reports delivery as `unverified`,
because it cannot observe an inbound message unattended. That is the expected
result, not a regression.

---

## Privacy model

Current, not aspirational. The product does not exist yet, so there is nothing
collecting anything.

Intended model, from the roadmap:

```text
SpectreMail account        none
SpectreMail state          local-first
Browsing-history database  none
Ad injection               none
User-data sale             none
Analytics                  none
```

**What SpectreMail must not claim:** that messages never leave your device.
That is false — while third-party providers power the addresses, the provider
receives the mail.

**What SpectreMail may claim:** it does not require an account, and keeps its
own mailbox state locally. Incoming mail is processed by the temporary-email
provider powering the address.

Provider terms also impose obligations that are easy to forget: mail.tm
**requires visible attribution** wherever its API is used, and forbids
reselling it or proxying it. See [`docs/PROVIDERS.md`](docs/PROVIDERS.md).

---

## Development workflow

Work is spec-driven. Non-trivial behavioural changes go through a full OpenSpec
lifecycle and a reviewed pull request — there is no direct-to-`main` work.

```text
Explore → Propose → Apply → Verify → Sync → Archive
```

Each stage gets its own branch, pushed to `origin` immediately, and lands via a
**merge commit** (never squash, never rebase).

```text
main
  ├── docs/<scope>-proposal      plan the change
  ├── feat|spike|test/<scope>    implement it
  ├── docs/<scope>-spec-sync     reconcile approved behaviour into specs
  └── chore/archive-<scope>      close it out
```

Typical loop:

```bash
git switch main
git pull --ff-only origin main
git switch -c docs/<technical-scope>-proposal
git push -u origin docs/<technical-scope>-proposal
# ... create the OpenSpec change ...
gh pr create --base main --head docs/<technical-scope>-proposal
gh pr merge <PR> --merge --delete-branch
```

`AGENTS.md` is the authority on naming, commit conventions, verification duties,
and the orchestration rules. Read it before making changes.

### Relationship to the roadmap

- `docs/ROADMAP.md` is the **program plan** — which milestone, and why.
- `openspec/changes/` holds the **bounded implementation unit** currently in
  flight.
- `docs/ROADMAP.md`'s `Project Status` block is a **progress ledger** owned by
  the root agent, updated at each lifecycle transition.
- `openspec/specs/` plus the active change artifacts are the **source of truth
  for behaviour**.

The roadmap is never treated as proof. When a milestone's reality contradicts a
planning assumption, the roadmap is corrected — that is exactly what M0 was for.

---

## License

Not yet chosen. `LICENSE` will be added before any public release.
