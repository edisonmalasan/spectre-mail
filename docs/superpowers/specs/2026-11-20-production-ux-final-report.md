# Final report — production UX reconstruction + dynamic multi-domain

Date: 2026-11-20. Branch work against `main` at `a495047`.

## A. UX defects and fixes (verified against the recording)

| Defect                                            | Root cause                                                                           | Correction                                                                                                                                                                     | Verified by                                                                                                          |
| ------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| A address wraps to two lines; field reshapes      | `<wbr>` after `@` + `overflow-wrap: anywhere`; status paragraph inside the field     | One clipped, scrollable text node (`white-space: nowrap`), full value in `title`/accessible name; field `width:100%` so 390px cannot overflow                                  | browser case at 1440/956/390: one `getClientRects()`, stable box; screenshot                                         |
| B intrusive copy feedback                         | `<p role=status>` in-flow, hidden only while empty, never reset                      | Fixed toast outside the field, always-mounted live region, auto-dismiss 2.2s, sequence-based reset, icon swaps to a checkmark                                                  | unit + browser: field box identical before/after both Copy controls; `copy-feedback` hidden after dismissal          |
| C awkward Change transitions; stale messages      | `run()` ignored the promise; no generation id; `creating` unmounted address+inbox    | Generation token + in-flight suppression + `replacePending` coalescing; previous ready mailbox kept until success; Change disabled with "Changing…"; failure keeps old mailbox | unit: double Change → one create, stale response ignored, old state preserved; browser: Change reaches provider once |
| D message appended below inbox; stale after empty | `MessageView` sibling below `Inbox`; `pruneTo` deleted bodies but not `opened.state` | Reader replaces the inbox panel; `pruneTo` clears the selection when its message leaves the listing                                                                            | unit + browser: reader unmounts on Back, inbox restored; no stale reader after empty poll                            |
| E epoch timestamp                                 | Adapters returned `0` for missing dates; UI called `new Date(0).toISOString()`       | `receivedAt: number \| null` end-to-end; `Date unavailable` fallback; no `dateTime` when null                                                                                  | screenshots show "Date unavailable"; provider conformance forbids epoch; web + extension tiers                       |
| F weak hierarchy                                  | Small type, no intermediate breakpoint                                               | Larger address/lede/empty-state type within tokens; mobile field constrained to viewport                                                                                       | screenshots at all three viewports; no horizontal overflow                                                           |
| Provider badge                                    | `AppHeader.tsx` rendered a prominent "Guerrilla Mail" pill                           | Removed; header carries product facts only                                                                                                                                     | browser + unit: no provider name in header in any state                                                              |

## B. Domain research

See `docs/superpowers/specs/2026-11-20-provider-domain-research.md`. Browser `fetch(mode:"cors")`
from a local origin failed for Mail.tm, Mail.gw, DropMail; Guerrilla succeeded.
Official Temp Mail is RapidAPI-key-only. Mail.gw was network-unreachable here.
No proxy/backend was added; no invented domains.

## C. Implemented domain coverage

- `Domain` type + `listDomains()` on `MailProvider`; `createMailbox(domain?)` threaded
  App → hook → session → manager → provider (review fix).
- Mail.tm: bounded paginated `listDomains()`, dedupe, active/expiry filtering;
  domain-scoped creation rejects a foreign provider's domain.
- In-memory catalog: 5-min TTL, refresh, dedupe, provider-ownership + active/expiry
  defense-in-depth, empty on failure, no persistence, no hardcoded domains.
- Guerrilla: `listDomains()` returns `[]` (no API); the website's Change picker therefore
  honestly shows "Automatic — no browser-reachable provider exposes a domain list".
- **The extension popup offers real domain selection**: with its host permissions it loads
  Mail.tm's live domains through the shared catalog and passes the chosen `Domain` to
  `session.open(domain)` → `createMailbox(domain)`. A unit test asserts the exact domain
  reaches `session.open`. The picker renders only when a provider actually reported domains.
- The website remains automatic-only: Guerrilla (its sole browser-reachable provider) has
  no domain API. This distinction is reported, not hidden.

## D. Visual verification

Screenshots: `C:\Users\Edison\AppData\Local\Temp\opencode\uxfinal\{desktop,split,mobile}.png`.
Mobile shows single-line clipped address, stable toolbar 2×2, and "Date unavailable".

## E. Functional verification (fresh)

- `pnpm verify` → exit 0: typecheck, lint, format, **1440 tests / 79 files**, all builds.
- Website browser tier → **39 passed / 0 failed**.
- Extension browser tier → **109 passed / 0 failed**.
- `openspec validate --specs --strict` → 15 passed, 0 failed.
- **Live domain-selection probe** (`node apps/extension/e2e/live-domain-selection.mjs`) →
  PASSED against the real provider: chose `@euploading.com` from Mail.tm's live `domains`
  answer, created a real account, and the created address `kg662ixzdlxc@euploading.com`
  used that exact domain. Recorded requests were exactly
  `GET https://api.mail.tm/domains`, `POST https://api.mail.tm/accounts`,
  `POST https://api.mail.tm/token` — no Guerrilla request, so a Mail.tm domain did not
  fall back to the other provider. Screenshot: `apps/extension/test-results/live-domain-selection.png`.
  The probe is quarantined (opt-in) like the other live probes: it creates a real mailbox
  and must not run on every CI invocation.
- Independent code review: 1 Critical (domain dropped between picker and session) fixed;
  Important items (toast live region, catalog filtering, e2e integrity) addressed.

## F. Final status: **PARTIALLY MET**

All six recorded UX defects are fixed and verified; the badge is gone; timestamps are
truthful; all automated checks and both browser tiers are green. Real, provider-sourced
domain selection is now available in the extension popup, and the website honestly
reports automatic-only because its sole browser-reachable provider exposes no domain
API. The live probe now confirms Scenario D end to end against the real provider
(domain listed, mailbox created on that exact domain, requests routed to Mail.tm).
The goal is not declared MET because Scenario F — a controlled message actually
arriving at the chosen-domain mailbox, read in the browser — has not been performed:
no SMTP sender or HTTP send endpoint is configured in this environment
(`SPECTRE_SPIKE_SMTP_*` and `SPECTRE_SPIKE_SEND_URL` are all unset), and Mail.tm's own
API is receive-only while Guerrilla's send endpoint requires a captcha. Credentials
for a sender are the one thing only the user can supply; that live receive test is
the remaining step.
