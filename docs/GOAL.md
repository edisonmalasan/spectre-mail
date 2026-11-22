# GOAL: SpectreMail M25 — Authorized Free Provider Expansion & DropMail Pilot

**Status:** Proposed next milestone. This document is an execution brief, **not** evidence that M25 has started or that another provider is already supported.

**Repository:** `edisonmalasan/spectre-mail`  
**Executor:** The existing T3 Code main-thread orchestrator, using native delegated threads and isolated worktrees.  
**Product objective:** Expand SpectreMail's **receive-only** mailbox coverage with legitimate, working, freely available domains while preserving the current client-only architecture and Temp Mail-inspired UX.

## 1. Start from the verified repository, not the old prompt

Inspect the current `main` tree, `AGENTS.md`, `PRODUCT.md`, `DESIGN.md`, `docs/ROADMAP.md`, `docs/GOAL.md`, `docs/GOAL-REPORT.md`, `docs/ORCHESTRATION.md`, `docs/PROVIDERS.md`, `docs/provider-research/*`, approved OpenSpec capabilities, active changes, current provider adapters, client configurations and recent PRs.

Do **not** repeat the completed M16–M24 programmes. Reconfirm their status from code and Git.

Last observed baseline (2026-11-23, verify again before acting):

- `main`: `0418d60401f2facfdb5099a237c88f81ce2c8704`.
- Website: Guerrilla Mail only; extension: Mail.tm + Guerrilla Mail.
- M22: shared provenance/catalog, bounded fallback and selection foundations, already archived.
- M23 and M24: expired-mailbox and automatic address recovery, already archived.
- Prior expansion research: **19 candidates**, **zero newly approved/integrated providers**; read the dated `docs/GOAL-REPORT.md` and individual research reports for exact decisions.
- An actual incoming test message was received and read through Mail.tm on 2026-11-22. Do not reopen "no external sender" as a blanket blocker. The documented bare-text URL extraction limitation is a separate possible defect, not proof that reception failed.

**Deliver a new M25 plan, not a rewritten historical roadmap.** Amend the current status/overview through the repository's normal reviewed PRs only after verifying that M25 is not already assigned.

## 2. Correct the target: domains are not providers

Temp Mail (`temp-mail.org`) owns/operates a rotating disposable-domain pool. No verified evidence proves it is a bundle of unrelated free providers or that all of its domains are available to external clients. Its own API and its terms must be assessed separately; never rebrand independent providers' domains as Temp Mail domains.

For SpectreMail, maximize the number of **currently eligible, provisionable, readable, free** domains, sourced from supported APIs. Keep these counts distinct: candidate providers; permitted integrations; live available domains; successfully created mailboxes; domains with genuinely received test mail.

Do not hardcode guessed domains, abuse third-party endpoints, invent successful reception, bypass disposable-domain restrictions or introduce sending, forwarding, or SMTP hosting.

## 3. Primary target: DropMail OAuth / API feasibility

The existing `docs/provider-research/dropmail.md` records a technically promising candidate:

- Dynamic GraphQL domain listing (19 domains on 2026-11-22: 15 permanent, 4 rotating; verify again).
- Provider-reported domain expiry and health.
- Working extension-origin access with MV3 host permission; normal website requests blocked by CORS.
- Free `af_…` tokens; no shared token may be embedded in the distributed extension.
- Documented **OAuth 2.1 authorization-code flow with PKCE for third-party apps**.
- Permission/terms for a competing free product unresolved by the previous report.

**First resolve authorization.** Re-read the CURRENT official API/usage documentation, OAuth guidance, terms/privacy and any new policies. Classify:

- `CLEARLY PERMITTED` — documented provider terms/official written authorization cover this exact use and distribution.
- `PERMISSION REQUIRED` — material terms or business-use ambiguity remains; prepare a specific provider inquiry and request the owner's help sending it if no authorized contact integration exists.
- `PROHIBITED` — terms explicitly disallow the planned integration.
- `TECHNICALLY BLOCKED` — required operations cannot run within the selected client under approved architecture.

A documentation page explicitly inviting third-party browser extensions is significant evidence; analyze it carefully rather than reflexively marking all unspecified competitor wording forbidden. **Do not substitute inference for a required legal permission or override current OpenSpec policy.** If permission remains ambiguous, seek written clarification instead of shipping the provider.

### DropMail preintegration spike (isolated and bounded)

Run a safe, quarantined **technical** proof using a user-controlled free test token if permissible under the API's published rules. Do not ship or enable the adapter as a supported provider until the authorization decision is resolved.

Check Chrome's `identity.getRedirectURL` / `identity.launchWebAuthFlow` with DropMail's documented OAuth dynamic registration, redirect allowlist, PKCE verifier/challenge, token exchange, revocation/expiry and browser-session restoration. **Do not assume** a `chrome-extension://` callback is accepted; Chrome's generated `https://<extension-id>.chromiumapp.org/*` callback must be tested with the actual provider. Test in a real unpacked Chromium extension, not Node alone.

Use per-user tokens through OAuth. Never place a single shared secret/token in shipped code, URLs, logs, committed files or browser-visible global state. Store tokens with the repository's approved storage contract and protect them from content scripts and page origins. Request only narrowly necessary host/identity permissions through an approved OpenSpec/permissions review.

Validate the exact GraphQL requests, schema, health status, free/rotating domains, creation, session expiry, restore key, polling/list/read behavior and error mapping. Limit calls, avoid quotas/captcha bypass, and keep test recordings redacted.

**Website:** Keep DropMail `BLOCKED` unless a repeatable real-page CORS test changes the documented result; do not add a proxy/backend merely to make it work.

## 4. Secondary targets — short, evidence-based re-evaluation

Do not launch another undirected 19-provider sweep. Use the 2026-11-22 reports as a baseline, then check for materially changed evidence:

1. **Mail.gw:** official docs indicate a free, keyless API and discuss legal integrations, but the API was unreachable in prior probes. Recheck real liveness and assess free third-party client use; avoid claiming its CORS status was measured when the host did not respond.
2. **Guerrilla Mail and Mail.tm:** preserve working integrations; evaluate published terms, attribution and authorization obligations already flagged by `docs/GOAL-REPORT.md`. Implement required Mail.tm attribution where it can be done without misleading provider claims and with approved UI changes.
3. **Official Temp-Mail.org API:** investigate its permitted API/price/domain access, but do not assume its free website domains are available to an external service. No key, subscription or fee may be committed without owner approval.
4. **Other previously rejected candidates:** reopen only when dated evidence changes the relevant gate. Reject public-inbox privacy risks, API resale/service prohibitions, paid-only commercial integration, inaccessible APIs or keys that would need to be exposed.

Keep a dated per-client decision matrix with official URLs, precise terms language, runtime evidence, API costs, free-domain count, privacy implications, and written-permission status. If outreach is required, prepare concise messages stating SpectreMail is a **free, receive-only, client-side, multi-provider** website/extension and asking explicitly about public integration, user-token model, attribution and API limits. The orchestrator should handle all non-human follow-up; do not claim outreach was sent without a send action.

## 5. Implementation only after gates pass

For every approved provider, follow the full OpenSpec lifecycle **Explore → Propose → Apply → Verify → Sync → Archive**. The worker should extend the existing shared `MailProvider` / domain catalog, not invent a parallel provider system.

Required behavior:

- Dynamic, provider-sourced, eligible-domain discovery and proper provider/domain provenance.
- Automatic and manual selection only among usable compatible domains.
- Correct provider-owned mailbox creation, authentication, safe credential/session persistence and restoration.
- Correct normalized listing/reading, timestamps, OTP extraction, text/HTML handling and secure link behavior.
- No cross-provider mailbox mixing, no duplicate generation, no stale responses, no silent substitution for manually chosen domains.
- Bounded retry/fallback, throttling and expiration handling; honor rotating-domain expiry and provider health.
- Preserve the prior mailbox on failure; truthful deletion and local-forget semantics.
- No change to the primary four-action Temp Mail-inspired UI except minimal, accessible provider/domain selection. If DropMail OAuth adds user friction, make it explicit and opt-in; do not launch an authentication popup automatically on first page load.
- Keep website and extension support **separate**: an extension-compatible provider is not automatically website-compatible.

A provider must not appear as production-supported until licensing/terms, creation, read, target-browser, security and other agreed release gates pass. Real external-message receipt is separately labeled and never silently equated with account creation.

## 6. T3 Code orchestration and concurrency

The existing main thread is the **orchestrator**, not a coding worker. It keeps the current `main` checkout clean and maintains the work queue, dependencies, review and integration.

Discover native T3 Code capabilities (`orchestrator_capabilities`) and delegate via `delegate_task` with `isolation: "worktree"` (or the genuinely available equivalent). Use approximately 2–4 workers on **nonoverlapping work**:

- Worker A — current official DropMail policy/authorization and outreach draft.
- Worker B — safe isolated DropMail OAuth + MV3 redirect feasibility probe.
- Worker C — Mail.gw reachability/terms plus existing Mail.tm attribution/permissions review.
- Worker D — independent architecture, security and testing review when artifacts exist.

Workers must provide exact evidence, files touched, commit SHA, PR and blockers. Do not simulate native delegation, edit app code directly on `main`, let workers modify shared OpenSpec requirements concurrently, or merge without reviewed CI. Integrate through the repository's existing merge-commit PR workflow; clean up worktrees only when safe.

Resolve routine technical blockers autonomously. Escalate to the owner only when a provider response, user-owned credentials, a significant policy/architecture change, or final subjective acceptance is genuinely needed. Continue other independent work while one provider is pending.

## 7. Acceptance gates and final report

Record a **separate PASS / FAIL / BLOCKED / NOT VERIFIED** for each provider and target runtime:

1. Official usage permission/terms, free-tier suitability and attribution — no ambiguous claim marked passed.
2. Valid live domain inventory and provider-specific provisioning path, with timestamp and honest eligibility counts.
3. Browser tests: real Chromium extension and real ordinary website CORS, as applicable.
4. Secure per-user OAuth/token flow where needed; no packaged privileged shared secrets.
5. Contract tests for create/auth/restore/list/read, pagination/health/expiry, 429/5xx, malformed content, concurrency and fallback.
6. Actual incoming email from an authorized external sender for the integration's delivery claim, or `LIVE DELIVERY NOT VERIFIED` if not performed.
7. Current `pnpm verify`, OpenSpec validation, architecture constraints, website/extension browser tests, and UI screenshot/regression review with **actual command outputs**. Record timeouts/flakes separately; do not invent a pass.
8. PR/CI history, implementation trace, security/attribution changes, human-dependent permission decisions, and remaining risks.

**M25 outcome is one of:**

- **GOAL MET:** authorization and technical feasibility resolved, at least one newly permitted provider is production-integrated with all mandatory gates, and the selected catalog works reliably. Report live-delivery status separately.
- **PARTIALLY MET:** provider research/OAuth proof and/or preparatory work succeeded but no new permitted provider can yet be enabled, or mandatory tests are unresolved.
- **BLOCKED:** all remaining tasks truly require external authorization or human inputs; provide ready-to-send provider inquiries and the exact resume conditions.

Do not change the definition of success to call a research-only milestone full provider expansion. If approval cannot be obtained, document the obstacle and propose the next legitimate alternative without bypassing the existing no-backend/no-proxy and privacy policies.

**Final directive:** Complete the *next real step toward more usable free domains*, not another list of names. Reuse M22 foundations, investigate DropMail's per-user OAuth pathway, obtain or establish proper provider-use permission, ship only real authorized integrations, and continue orchestrating independently actionable work without repeatedly asking for the next prompt.
