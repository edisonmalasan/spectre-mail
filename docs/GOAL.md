# GOAL — SpectreMail Receive-Only Provider & Domain Expansion

**Status:** New proposed execution goal, not a claim of completion.  
**Executor:** Existing T3 Code Orchestrator thread on `main`.  
**Mission:** Offer the largest sustainable selection of **legitimate, genuinely working, free disposable-email domains** while preserving SpectreMail's receive-only functionality, privacy, Temp Mail-inspired UI/UX, and client-only architecture.

## 1. Product goal and boundaries

SpectreMail is **receive-only**. Users need to create a working mailbox, optionally pick an available domain, copy an address, refresh an inbox and read arriving messages; they do not need to send mail from SpectreMail. Do not build SMTP sending, reply, forwarding, signup automation, domain-block evasion or unrelated dashboard features.

**Distinguish providers and domains.** A provider may serve many domains. Only show domains discovered through a **provider-supported source** for which SpectreMail can provision and read an actual mailbox. Do not build arbitrary `name@domain` strings, scrape stale domain lists, or claim that other providers' domains are owned by `temp-mail.org`. The official Temp-Mail.org domain pool must be accessed only through a permitted API, if available.

Do not equate successful mailbox creation with proven incoming-mail delivery: a **live external sender** is needed to verify reception. A missing test sender should block that one evidence claim, not all other independently actionable tasks.

## 2. Start with the actual repository state

Before acting, inspect `AGENTS.md`, `PRODUCT.md`, `DESIGN.md`, `docs/ROADMAP.md`, `docs/ORCHESTRATION.md`, `docs/PROVIDERS.md`, OpenSpec specifications/active changes, the current provider adapters and tests, both client configs, and the M21 audit records. Reconcile reports against Git rather than trusting remembered status.

The previously reported provider roles were website = Guerrilla Mail and extension = Mail.tm plus Guerrilla Mail. **Recheck the actual current code**; these might have changed. The repo previously measured Mail.tm's API CORS restriction for ordinary web origins: working in the extension **does not** imply working on a website. Test separately using real browser contexts, not Node.js alone.

Do not restart M16–M21. Create the next properly numbered milestone after checking the actual roadmap. Preserve historical milestone records; use OpenSpec to approve any new capability requirements before implementing them.

## 3. Broad, official-source provider investigation

Research every credible, documented free receive-only temporary-mail API that is reasonably discoverable, starting with the following **candidates, not promised integrations**:

| Candidate      | Official starting point                             | Questions to resolve                                             |
| -------------- | --------------------------------------------------- | ---------------------------------------------------------------- |
| Guerrilla Mail | https://www.guerrillamail.com/GuerrillaMailAPI.html | Existing adapter, address assignment, rate guidance              |
| Mail.tm        | https://docs.mail.tm/                               | Dynamic domains, third-party use restrictions, CORS              |
| Mail.gw        | https://docs.mail.gw/                               | Dynamic domains, separate usage terms, CORS                      |
| DropMail       | https://dropmail.me/api/                            | GraphQL, domain rotation, token/OAuth, session expiry            |
| TempMail.lol   | https://tempmail.lol/api                            | Anonymous free tier, quotas, free/premium pools                  |
| Tmailor        | https://tmailor.com/temp-mail-api/                  | Free API tier, registration/key, limits, third-party use         |
| Maildrop       | https://docs.maildrop.cc/                           | Public inbox model, privacy for verification messages            |
| Temp-Mail.org  | https://temp-mail.org/en/api/                       | Official API/RapidAPI permissions, free-tier limits, domain list |

Discover additional suitable providers if evidence supports them. **Do not conflate** `temp-mail.org`, `temp-mail.io`, and similarly named businesses. Read actual provider documentation, terms, pricing and access rules as of the investigation date. A public or free API does **not** automatically authorize repackaging it as a competing temporary-email product.

Each researcher must produce a dated, cited decision row with:

- Provider, API version, documentation and terms URLs, verification date.
- Free API eligibility, signup/key/card requirements, quotas, pricing and attribution obligations.
- Permitted versus prohibited third-party/competitive use; unresolved permission is **REVIEW REQUIRED**, not PASS.
- Whether it offers live domain discovery, pagination, free-vs-premium flags, active/retired status and expiration.
- Mailbox create/auth/restore, list/read, delete (if supported), polling and message formats.
- Privacy characteristics, especially publicly addressable inboxes, token secrecy and content retention.
- Website-origin CORS and extension host-permission behavior, **measured independently**.
- Throttling, error/recovery behavior, service liveness and live-delivery evidence where available.
- Decision per client: **SUPPORTED / PROVISIONAL / REJECTED / BLOCKED / NEEDS AUTHORIZATION**, with reasoning.

Report domain counts with fetch timestamps. Distinguish **provider count**, **free active domain count**, **provisioned domains**, and **domains with verified real incoming mail**. Do not claim a complete current inventory if the provider does not expose it.

## 4. Integration decision gate

Prioritize candidates that: (1) explicitly permit the intended integration; (2) offer usable free operations; (3) support **real** mailbox creation and message reading; (4) operate safely in at least one of SpectreMail's existing runtimes without a prohibited proxy; (5) have an acceptable privacy model; and (6) can be maintained and tested. Suggested _investigation_ order: Mail.gw, DropMail, TempMail.lol, Tmailor, official Temp-Mail.org, Maildrop, and newly discovered candidates. This is not advance approval.

**Reject unsupported approaches rather than faking support.** A free tier requiring a user-owned API key needs an approved credential-delivery design; no shared secret in shipped browser code. A provider blocked by website CORS may still be evaluated for extension-only use. A backend/proxy remains outside existing architecture unless the owner explicitly approves a formal architectural change. Do not sidestep provider access controls, scraping restrictions, CAPTCHA, quotas, or terms. Providers that prohibit competing services should be excluded unless authorized.

Do not exhaust provider quotas by provisioning accounts for every catalog item continuously. When full live-delivery verification is impossible, maintain a clearly bounded sample and a separate **delivery unverified** status.

## 5. Native T3 Code multi-agent orchestration

Keep the **existing main-thread Orchestrator on a clean `main` checkout**. It owns planning, dependency mapping, blocker decisions, code review, integration, and honest progress reporting. It does **not** directly modify application code on `main`.

Use `docs/ORCHESTRATION.md` and the actual available T3 Code tools:

1. Discover native capabilities through `orchestrator_capabilities` before delegation.
2. Use `delegate_task` with `isolation: "worktree"` for implementation work and asynchronous child reporting. Do not simulate workers or assume that manually created worktrees are T3-bound threads.
3. Run about **2–4 independent workers** when useful: divide research by provider; assign implementation/testing/review only after candidates pass the decision gate.
4. Give workers specific source files, nonoverlapping ownership, acceptance checks, evidence requirements and branch/worktree scope. Serialize tasks that modify shared interfaces or OpenSpec deltas.
5. Workers return exact changes, tests, findings, commit SHA, PR and blockers. The Orchestrator checks results, obtains independent review, checks actual CI and merges verified changes using the repository's required **merge-commit PR workflow**.
6. Follow Superpowers and the existing **OpenSpec Explore → Propose → Apply → Verify → Sync → Archive** lifecycle. Resume an active change rather than creating a duplicate. Do not edit historical archives.
7. Clean up worktrees only after T3 confirms task completion and no unmerged work is at risk. Maintain the orchestrator's clean `main` throughout.
8. After integration, update the next action, refresh the blocker ledger and delegate the next independent task. **One failed provider, finished PR, or blocked live sender must not stop unrelated viable work.**

`AGENTS.md` and approved OpenSpec capabilities are authoritative over this goal where implementation constraints conflict. Any necessary specification migration must be explicit and approved. Updates to otherwise protected `docs/PROVIDERS.md` are authorized **only as a scoped, evidence-backed provider-research or integration task**, not for speculative cleanup.

## 6. Reusable provider adapters and true domain catalog

Use the existing shared `MailProvider` abstraction and package boundaries. Extend them carefully through an approved specification if needed; never create a second inconsistent provider framework.

**Adapter behavior:** discover domains when supported; create a provider-confirmed mailbox; authenticate/restore its session; list/read normalized messages; report truthful expiration, throttling, unsupported operations and errors; support provider deletion only if proven. Preserve previous provider sessions and local data through upgrades.

**Domain catalog rules:**

- Fetch free **active and creatable** domains via documented APIs, following pagination/cursors; refresh with a measured/justified cache policy.
- Store provenance: provider identity, domain, discovery time, supported runtime, lifecycle/status and applicable provider capability flags.
- Deduplicate catalog options without treating identically spelled domains from different providers as interchangeable.
- Exclude premium, private, retired, inaccessible or account-creation-ineligible entries.
- Select only from providers compatible with the current client and its authorized access.
- Route every mailbox/message request to the exact provider/session that created it; prevent stale asynchronous responses from crossing mailbox boundaries.
- Use bounded retries, timeouts, appropriate backoff/rate limiting and fallback; no indefinite retries or aggressive polling.
- Do not promise deletion, custom local parts, infinite lifetimes, attachments, or working domain choice unless the selected provider genuinely supports those capabilities.

**Truthful states:** `available in provider catalog` is weaker than `mailbox successfully provisioned`, which is weaker than `real external mail received`. Report each separately. Never display a generated address as ready before the provider's confirmed provisioning semantics have been satisfied.

## 7. Minimal domain-selection UX

Preserve the existing Temp Mail-inspired layout, responsive design, motion and message reader. Do not restart completed M16–M21 work just to integrate providers.

Keep the four main actions: **Copy, Refresh, Change, Delete**. Within **Change**, offer an uncomplicated **Automatic** mode and optional manual domain selector if more than one usable choice exists. Automatic can choose a healthy compatible provider/domain based on actual availability, quotas and reliability; the user should not need to understand provider internals.

- If a manually chosen domain fails, show a concise error and allow retry or another selection; **never silently substitute** a different domain.
- If automatic creation fails, use bounded fallback among approved compatible providers; preserve the previous working mailbox on failure.
- Keep the inbox stable during Refresh, remove obsolete messages/reader selection after a successful Change, and guard against rapid double-clicks and out-of-order responses.
- Make loading, clipboard feedback and switching visually stable; preserve keyboard accessibility, touch targets, reduced motion and existing approved animations.
- Keep provider attribution only where required; don't add large configuration cards, exposed API diagnostics or irrelevant domain counters to the hero.
- Do not claim domains will defeat a website's disposable-email blocking.

## 8. Verification gates — no fake green checks

For **each** proposed integration and supported runtime, require:

1. **Contract tests:** domain filtering/pagination, account creation/authentication, restore, list/read/normalization, malformed responses, missing timestamps, expiration, 429/5xx, cancellation and stale-response isolation.
2. **Minimal live API probe:** actual documented list/create/auth/read calls within provider limits; redact secrets and avoid unneeded mailbox creation. Test deletion only where the provider supports it.
3. **Browser proof:** website CORS measured from a real page; extension lifecycle from an actual unpacked Chromium extension, including any required minimal host permissions. Browser-only failures cannot be covered up by Node results.
4. **Actual incoming mail (separate, stronger claim):** an authorized external sender emails a newly created mailbox; verify sender, subject, timestamp, body, OTP and verification link as actually received. If no sender or user-owned credential is available, mark **LIVE DELIVERY NOT VERIFIED** and continue other tasks. Never turn recorded fixtures into purported live evidence.
5. **Regression and security:** `pnpm verify`, architecture boundaries, OpenSpec validation, website + extension browser suites, message HTML sanitization, token isolation, privacy and provider terms; check that the new domain picker does not degrade approved layout and motion.
6. **Operational behavior:** no stale cross-provider messages, no invalid Unix-epoch dates, correct handling of retired domains, rate limits, network failure, reload/session restore, mobile/keyboard interactions and provider fallback.

A provider/domain cannot be advertised as fully **delivery verified** without actual external mail arriving. But lack of a sender does not prevent verifying provision/read compatibility and integrating other legitimate domains with truthful status.

## 9. Prior M21 blockers and blocker autonomy

Track the existing **human visual approval** and **live external message reception** independently of this expansion goal.

- The Orchestrator may delegate automated screenshot/video comparisons, fix objectively documented UI defects, and ask the user for **final subjective acceptance** only after delivering reviewable evidence.
- The Orchestrator may research legitimate SMTP/send services and reuse an already authorized sender configuration. If none exists, prepare a **fresh** mailbox and a precise manual test-email instruction; request only a message from the user's own mail app, **not their email password**.
- The Orchestrator decides normal technical blockers, can reject unsuitable providers with evidence, and can proceed to the next viable provider. Only a genuine secret, account permission, paid plan, architectural policy change or final human judgment requires escalation.
- Never mark a `BLOCKED`, `PENDING`, `NOT VERIFIED` or `REJECTED` provider/acceptance row as passed merely to close the goal.

## 10. Execution plan and milestone hygiene

Complete these workstreams in order, overlapping independent research only when safe:

**Phase A — Baseline:** inventory current provider adapters, browser capabilities, OpenSpec state, roadmap cursor, and remaining M21 audit rows.

**Phase B — Parallel research:** assign individual provider groups to research workers; assemble the dated official-source matrix and independent compatibility probes.

**Phase C — Selection:** review provider terms/security and choose approved, realistic integrations. Record rejected and blocked candidates. Propose the next real M-number milestone only after checking the roadmap; do not rewrite completed M0–M21 history.

**Phase D — Shared foundations:** implement necessary provider contract/catalog adjustments and specification deltas in small reviewed slices before dependent provider work.

**Phase E — Integration:** add the highest-confidence permitted providers, one or more per independently reviewable PR as file ownership permits. Recheck all existing adapters and stored mailbox compatibility.

**Phase F — Product UX:** add lightweight available-domain selection and automatic rotation/fallback without compromising the Temp Mail reference.

**Phase G — Verification/handoff:** run actual real API and browser checks, CI, security, terms, visual regression, and independent review. Sync/archive completed approved OpenSpec changes; update roadmap ledger with measured evidence.

Do not promise indefinite off-platform background work. Within T3 Code's available orchestration runtime, **continue automatically to the next ready task** after each worker result or verified merge. Stop only when no independent work remains or a true human dependency requires input.

## 11. Required final report and acceptance verdict

Deliver one auditable report containing:

- **Provider matrix:** every researched candidate with official sources, terms, free limits, website/extension support and verified/rejected/blocked decisions.
- **Domain inventory:** dated live API counts by provider, active/free/eligible breakdown, pagination completeness and which domains could actually provision a mailbox. Never imply these counts are permanent.
- **Implementation trace:** adapter and catalog changes, runtime wiring, local persistence, PR links/SHAs, OpenSpec changes and roadmap progress.
- **Verification evidence:** contract tests, live provider calls, actual browser tests, security/CI checks, screenshots and any genuinely received test message.
- **Blocker ledger:** exact unresolved human input, inaccessible provider, ambiguous terms, lack of external sender and deferred human UI acceptance.

Use **GOAL MET** only if all providers _advertised as supported_ meet their compatible creation/list/read/browser/security/terms gates; domain catalog and UI function accurately; required non-live tests are green; and mandatory visual/functionality review has evidence. Never falsely claim every domain received an external email if only a sample was tested. Use **PARTIALLY MET** for remaining mandatory unverified items, or **BLOCKED** when all remaining tasks require genuine external authority.

**Final directive:** Build **sustainable provider diversity**, not a fake count of email domains. Keep `main` clean, delegate to real T3 Code worktrees, independently review and merge verified work, resolve normal blockers yourself, respect provider terms and privacy, and keep progress moving without waiting for a new prompt after every PR.
