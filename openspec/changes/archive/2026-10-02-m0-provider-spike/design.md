# Design

## Context

See `proposal.md` for motivation. The state that shapes this design:

- The repository contains only `AGENTS.md`, `docs/ROADMAP.md`, and OpenSpec scaffolding. There is no package manifest, no toolchain, and no application code. Milestone M1 (monorepo foundation) has not started, so the spike cannot assume a workspace, a test runner, or a bundler.
- The roadmap places M0 **before** M1 and names `tests/provider-spike/` and `docs/PROVIDERS.md` as its deliverables. The spike therefore runs from its own minimal manifest and is expected to be absorbed or retired during M1.
- The spike must reach the real network. Nothing about provider behaviour can be proven offline.
- Exploration already established header-level facts for both providers (Mail.tm origin-restricted CORS, one-account-per-minute creation budget, no working real-time endpoint, Guerrilla `ACAO: *` with body-returned `sid_token`, Guerrilla send requiring a captcha). These are hypotheses to confirm in a real browser, not conclusions to encode.

## Goals / Non-Goals

**Goals:**

- Produce machine-readable evidence for every roadmap-mandated provider check, in a real browser, for both providers.
- Keep the spike runnable with one documented command on the supported platform, with no dependency on a monorepo that does not exist yet.
- Make "unverified" a first-class, visible outcome so a blocked check can never be mistaken for a pass.
- Produce `docs/PROVIDERS.md` from recorded results so the document and the tooling cannot drift.

**Non-Goals:**

- Any reusable provider abstraction. The spike deliberately writes throwaway request code; the real contract arrives in M3.
- Any attempt to work around a provider's CORS policy, terms, or captcha.
- Any product UI, styling, or marketing surface.
- Any change to the monorepo layout, which M1 owns.

## Decisions

### Standalone harness with its own manifest, not a workspace member

`tests/provider-spike/` gets its own `package.json` and is not added to a pnpm workspace, because no workspace exists yet and M1 owns that decision.

*Alternative considered:* add the spike to the monorepo now. Rejected — it would force M1 to accommodate a throwaway tool and would import M1's structure decisions into a spike that is meant to be disposable.

### Plain Node.js ESM with no framework for the request probes

Lifecycle probes use Node's built-in `fetch`/`WebSocket` and a small hand-rolled probe runner, so the spike has essentially zero runtime dependencies.

*Alternative considered:* Vitest, which the roadmap names as the eventual test runner. Rejected for M0 — a test framework's pass/fail semantics would flatten "blocked by CORS" and "not implemented by the provider" into the same failure bucket the spike must keep distinct. The probe runner reports `passed | failed | unsupported | unverified` explicitly, which is the whole point of the milestone.

### Headless Chromium via Playwright for the browser environments

The roadmap requires the checks to run from a normal web page and a Chrome extension context. The only way to satisfy that with reproducible evidence is a real browser, so the spike installs Playwright's Chromium.

*Alternatives considered:*
- *Header inspection only* (`Access-Control-Allow-Origin` presence per origin). Rejected as the primary method: it cannot distinguish a preflight failure from a response failure, and it cannot show whether a `credentials: 'include'` request survives an `ACAO: *` response. It is retained only as a cheap corroborating probe.
- *The interactive desktop browser session available to the agent.* Rejected as the primary method: it is not reproducible, cannot be re-run by the maintainer on demand, and cannot load an MV3 extension programmatically.

### A throwaway MV3 extension is loaded to test the extension context

The spike builds a minimal MV3 extension in a temp directory whose service worker requests the provider origins as host permissions, and uses Playwright's persistent-context launch with `--load-extension` to issue the same probes from the extension origin.

*Alternative considered:* testing a content script on a live site. Rejected — a content script inherits the *page's* origin and would test the page, not the extension. The service worker and an extension page are the contexts that actually hold the privileges a SpectreMail extension would rely on.

### CORS is recorded per environment and never conflated with provider health

A browser-blocked request is recorded as `blocked` with the CORS verdict attached, distinct from a provider-side failure. The roadmap's browser section and this design both need the distinction: a blocked request says nothing about whether the provider works in a privileged context.

### Pluggable real-delivery sender with an honest fallback

Real external delivery is the one check the spike cannot perform on its own, because it needs a sender that genuinely delivers mail. Evaluated options:

- *Guerrilla Mail's `f=send_email`* — returns `needs_captcha: true` for non-premium sessions. Not automatable.
- *Ethereal (`smtp.ethereal.email`)* — its documentation states messages are never delivered and inbound is disabled for public accounts, so it can never reach a Mail.tm or Guerrilla inbox.
- *An open SMTP relay* — rejected; it is abuse and it is not a legitimate test dependency.
- *A maintainer-supplied sender* — accepted. The harness reads sender configuration from environment variables (SMTP host/port/user/password, or an HTTP mail-send endpoint with a bearer token) and never persists the credentials.

When no delivering sender is configured, the harness records the delivery checks as `unverified` and prints the reason. `interactive` mode prints the live address and polls, so the maintainer can complete the check by sending one message from an existing mailbox. This keeps the spike honest without pretending a skipped check passed.

### Rate-limit discipline is enforced in the harness, not left to the operator

Mail.tm advertises `ratelimit-policy: 1; w=60` on account creation. The harness therefore serialises account creation, records the advertised budget alongside the observed one, treats `429` as an observed provider behaviour rather than an error to retry forever, and never runs against the live providers as part of routine repository commands.

### Findings document is authored from the recorded run

`docs/PROVIDERS.md` is written after a real run, and every claim in it must correspond to a recorded result. A finding with no recorded evidence behind it is either removed or labelled as an assumption. The roadmap is updated with the contradictions found, since a stale assumption is exactly the failure mode this milestone exists to prevent.

### `.gitignore` covers spike outputs, not spike code

Generated Chromium profiles, downloads, and raw run artifacts are ignored. The harness source and the findings document are tracked, because they are the evidence.

## Risks / Trade-offs

- **[Headless Chromium download is large and may fail on a locked-down or offline machine]** → Provider lifecycle probes still run standalone; browser-context probes report themselves `unverified` with the install reason instead of failing the run. The failure mode is visible, not silent.
- **[Providers change behaviour between runs, invalidating a findings document]** → Every run stamps the document's evidence with a date and the observed values, and the roadmap schedules a provider re-check before release. The spike is cheap to re-run for exactly this reason.
- **[Consuming a real provider's rate-limit budget]** → Serialised account creation, no live calls on routine commands, and a small probe count per run.
- **[A throwaway harness becomes accidental product code]** → The directory is not a workspace member, nothing may import it, and its README marks it disposable. M1/M3 are responsible for retiring it.
- **[Findings document drifts from reality]** → The document cites the run that produced it and the harness prints the summary that must be pasted into it. A claim without a recorded result is not allowed.
- **[Playwright's Chromium is a third-party binary in the toolchain]** → Pinned to an exact version in the spike manifest and only used by the spike, so removing it later is a manifest change with no blast radius.

## Migration Plan

Not applicable. This change adds a disposable tool and a document. It ships no runtime behaviour, touches no existing surface, and rollback is deleting the added paths.

## Open Questions

- Whether the maintainer is willing to supply a real sending credential or to perform the one manual send that completes the real-delivery check. Deferred: the spike is designed so the answer changes only a recorded status, not the harness, the findings structure, or the task breakdown.
- Whether the roadmap's provider roles should be swapped for the website now that Mail.tm's CORS appears origin-restricted. This is a roadmap/architecture decision, not a spike-design question. The spike's job is to produce the evidence that the decision needs; the decision itself is taken after the findings exist.
