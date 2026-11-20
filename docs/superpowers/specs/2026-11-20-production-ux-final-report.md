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
- **No user-facing provider can currently select a domain** — Mail.tm is reachable only
  from the extension, which has no picker. This is reported, not hidden.

## D. Visual verification

Screenshots: `C:\Users\Edison\AppData\Local\Temp\opencode\uxfinal\{desktop,split,mobile}.png`.
Mobile shows single-line clipped address, stable toolbar 2×2, and "Date unavailable".

## E. Functional verification (fresh)

- `pnpm verify` → exit 0: typecheck, lint, format, **1439 tests / 79 files**, all builds.
- Website browser tier → **39 passed / 0 failed**.
- Extension browser tier → **109 passed / 0 failed**.
- `openspec validate --specs --strict` → 15 passed, 0 failed.
- Independent code review: 1 Critical (domain dropped between picker and session) fixed;
  Important items (toast live region, catalog filtering, e2e integrity) addressed.

## F. Final status: **PARTIALLY MET**

All six recorded UX defects are fixed and verified; the badge is gone; timestamps are
truthful; all automated checks and both browser tiers are green. Domain discovery is
real at the contract/provider/catalog level, but no shipped client can offer a usable
domain choice today (Guerrilla has no domain API and is the only browser-reachable
provider; Mail.tm works only in the extension, which has no picker). That mandatory
user-facing requirement is unresolved, so the goal cannot be declared MET. The next
step is an extension-side picker backed by Mail.tm's live domain list, or a documented
decision that the website remains automatic-only.
