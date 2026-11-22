# GOAL report — Receive-Only Provider & Domain Expansion

Date: 2026-11-22. Source objective: `docs/GOAL.md` (merged as PR #236). This is the single auditable handoff required by GOAL §11. Every verdict below is tied to a dated measurement or a cited record; nothing here rounds a blocked or unverified row to a pass.

## Verdict: **PARTIALLY MET**

All authorization-free work in the goal was completed and verified. Two human dependencies remain (a real external test message and final visual acceptance), and **no candidate provider passed the integration gate**, so no new provider was integrated and none is advertised as supported. `pnpm verify` reports all tests passing but exits non-zero on the repository's documented load-driven worker-timeout; that is recorded rather than called green.

## A. Provider matrix (GOAL §3)

Nineteen candidates were researched from official sources on 2026-11-22. The full dated rows — API version, documentation/terms/pricing URLs, free eligibility, quotas, permitted use, domain discovery, create/auth/restore/list/read/delete, privacy, measured browser CORS, extension evidence, throttling and liveness — are in `docs/provider-research/`. Decisions are for **(website / extension)**.

| Provider | Decision | Decisive measured fact |
| --- | --- | --- |
| Guerrilla Mail | NEEDS AUTHORIZATION / NEEDS AUTHORIZATION | Working adapter, `ACAO: *`, live anonymous create/list/read measured; terms silent on competitive third-party use. |
| Mail.tm | BLOCKED / NEEDS AUTHORIZATION | Browser CORS denied from a real page; Hydra spec receive-only, one active domain; newly published attribution clause unmet; "no proxy services" ambiguous. |
| Mail.gw | BLOCKED / BLOCKED | Host unreachable on two network paths and from a real Chrome; `REVIEW REQUIRED` on terms; no CORS or API operation measurable. |
| DropMail | BLOCKED / NEEDS AUTHORIZATION | `GET /domains` returns 19 live domains and 10-minute sliding sessions, but no ACAO header; token/OAuth delivery design and Terms of Service absent. |
| TempMail.lol | BLOCKED / NEEDS AUTHORIZATION | Anonymous API probed once (201/200/200/ deletion), but ACAO locked to own origin; terms prohibit creating your own temporary-email service. |
| Tmailor | BLOCKED / NEEDS AUTHORIZATION | Preflight has no ACAO; account + key + one-IP allowlist; terms restrict use to services you own. |
| Maildrop | REJECTED / REJECTED | GraphQL CORS open and operational, but privacy policy states every inbox is public with no expectation of privacy. |
| Temp-Mail.org (official) | REJECTED / REJECTED (free), NEEDS AUTHORIZATION (premium) | RapidAPI key required (401/403 measured); free inboxes publicly viewable; terms conflict on third-party access. Not conflated with TempMail.io. |
| GrabMail | NEEDS AUTHORIZATION / NEEDS AUTHORIZATION | Keyless, CORS `*` measured, 3 free public domains; terms silent on competitive use; inboxes public. |
| Best-TempMail | REJECTED / NEEDS AUTHORIZATION | 5 live domains but browser CORS blocked; commercial use is a paid-plan feature. |
| PlainlyKit | REJECTED / REJECTED | 6 live domains but CORS blocked and explicit server-to-server-only rule. |
| TempMail.io | REJECTED / REJECTED | Key-gated; ToS restricts data access to Temp Mail's own products. |
| Mailsac | REJECTED / REJECTED | Key required; ToS forbids third-party account creation and non-personal business use. |
| Mailinator | REJECTED / REJECTED | Token requires signup; personal-use-only licence, automation prohibited. |
| 1secmail | REJECTED here / REJECTED here | Certificate/transport failure from this machine; not a global liveness claim. |
| TempMailGrab | REJECTED / REJECTED | Key-gated, no domain-list endpoint. |
| Three further plausible candidates | REJECTED | `mail7.io` parked, `tempr.email` and `mailnesia.com` 404 at official API paths. |

**GOAL §4 gate result: no candidate passes.** The uniform first-gate failure is the absence of explicit authorization for a free, competing, multi-provider client. That is `REVIEW REQUIRED` / `NEEDS AUTHORIZATION`, never a PASS, and it is a written-authorization dependency rather than a technical one.

## B. Domain inventory (GOAL §3 counts kept separate)

Counts are dated snapshots, not permanent inventories. See `docs/provider-research/selection-report.md` for per-row timestamps and sources.

- **Candidates considered:** 19.
- **Free active domain snapshots:** Mail.tm 1 (`euploading.com`, 2026-11-22T03:40:37Z); DropMail 19 (15 permanent, 4 rotating with `expiresAt`); GrabMail 3 free public (97 premium names withheld); Best-TempMail 5; PlainlyKit 6; Maildrop 1; Guerrilla 0 API-exposed (it assigns an address, it does not expose a domain list); 10 providers unmeasurable or key-gated.
- **Domains actually provisioned in a bounded probe:** 1. No quota was exhausted; no more than one or two bounded anonymous accounts were created per eligible provider.
- **Domains with verified real incoming mail on 2026-11-22:** **0**. The only two positive delivery observations in the repository are historical (2026-10-01, `docs/PROVIDERS.md` §5) and are not re-used as today's evidence. `LIVE DELIVERY NOT VERIFIED` is the reported state everywhere.

## C. Implementation trace

| Stage | PR | Evidence |
| --- | --- | --- |
| Goal document | #236 | `docs/GOAL.md` merged, Prettier-corrected in a follow-up commit. |
| Parallel provider research (7 worktree threads) | #237–#240, #242, #243 | Seven dated reports under `docs/provider-research/`. |
| Phase C selection | #244 | `docs/provider-research/selection-report.md`. |
| Phase D OpenSpec proposal | #245 | `openspec/changes/...` (now archived); 4/4 artifacts, strict validation exit 0, cross-provider dedup decision recorded. |
| Roadmap status ledger | #246 | Project Status updated; stale `docs/GOAL.md` sentence corrected. |
| Apply slice A (shared provenance/catalog) | #248 | Domain provenance, tri-state capabilities, catalog fetch time/aggregation/truncation; 6/6 falsification arms caught. |
| Apply slice B (bounded fallback/routing) | #250 | One attempt per provider, verbatim throttle, typed failure, stale-answer guard; 6/6 falsification arms caught. |
| Apply slice C (client UX/truth) | #249 | Popup Change control, coalescing, failure preservation, three truth claims; lint error found by CI and repaired in the same PR. |
| Website selection check | #247 | Task 5.5 verified: no website code or spec change needed. |
| Independent verification | #251 | 17 tasks VERIFIED, no GAP; 5.4/6.1/6.2/6.3 reported NOT VERIFIED. |
| Apply task ledger | #252 | Tasks 1.1–6.4 ticked with the verification record. |
| Spec sync | #253 | Promoted 9 requirement blocks byte-identically; 204/670/16 → **209/694/17**; strict validation 17/17. One rotted `docs/SECURITY.md` citation repaired in the document. |
| Archive | #254 | `openspec/changes/archive/2026-11-22-m22-provider-catalog-foundations/`; 8/8 pre-archive digests identical, 7 renames R100 and `tasks.md` at 96% with the two mandated ticks, 17 specs byte-identical, no active changes. |

Current milestone: M22 **APPLIED, SYNCED and ARCHIVED**. No M0–M21 history was rewritten. Architecture boundary count remains 56 and no new provider id, SMTP, proxy, shared secret or premium tier was introduced.

## D. Verification evidence

- **Contract/unit:** `pnpm verify` on the merged tree reported `81 files passed`, `1480 tests passed`, lint 0 errors (4 pre-existing warnings), format clean, builds green — but **exit 1** from `Error: [vitest-worker]: Timeout calling "onTaskUpdate"`, a documented load-driven flake. The independent verifier saw the same signature in two further runs. Reported as red, not rounded to green.
- **Focused checks:** slice A `catalog.test.ts` 18 passed; slice B 3 files/112 passed; slice C 45 focused tests plus 14 branding-audit tests; independent verifier 13 M22 files/266 tests and 175 architecture tests, all exit 0.
- **Browser:** website tier **70 passed, exit 0**. Extension tier: the orchestrator's run was `108 passed / 1 failed` (`in-page-fill.spec.ts:308`, request count 2 vs 1); a focused worker then ran that case ~24 times including two full tiers at **109 passed, exit 0** each, with no reproduction and no product edits. The single red is recorded as a load-dependent observation, not a regression claim.
- **Falsification:** slice A 6/6 and slice B 6/6 mutations caught by the intended assertions with byte-identical restoration. Slice C cases are designed falsifiably but no separate mutation table was run; the independent verifier records that as NOT VERIFIED.
- **Live API probes:** bounded, credential-free, secret-redacted probes for Mail.tm and Guerrilla, plus documented CORS measurements in real Chrome for the candidates where reachable. No live inbound delivery was observed.

## E. Blocker ledger

| Blocker | State | What would resolve it |
| --- | --- | --- |
| Real external delivery | **BLOCKED** | A person sends one test message from their own mail app to a freshly prepared mailbox; no password or credential is requested. |
| Final visual/functional acceptance | **NOT VERIFIED** | A person opens the built site and extension and accepts the rendered result; no test here reads a rendered pixel. |
| New provider integration authorization | **NEEDS AUTHORIZATION** | Written permission from each provider for competitive third-party use; Mail.tm additionally needs its attribution clause satisfied or clarified. |
| `pnpm verify` gate | RED, attributed to a pre-existing flake | All 1480 tests pass; the non-zero exit is the recorded `onTaskUpdate` worker timeout, not a named test failure. |
| One extension tier red | NOT REPRODUCIBLE | 1-of-109 observed once; ~24 subsequent executions passed with no code change. Recorded, neither fixed nor rounded. |
| Free/premium flags | NOT VERIFIED | No measured free-tier response carried one; the provenance field is populated only when a provider reports it. |
| M22 open questions 2–3 | Open in archived `design.md` | Runtime marker source for unreporting providers; whether to expose popup Change before provider authorization is answered. |

## Final answer

**PARTIALLY MET.** The authorization-free programme — research, selection, shared foundations, truthful states, minimal domain-selection UX, independent review, spec sync and archive — is complete with measured evidence. The provider-diversity mission cannot go further without written third-party authorization, and two human gates (live delivery, final visual acceptance) remain open by design.
