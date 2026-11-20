# Production UX reconstruction + dynamic multi-domain — design

Date: 2026-11-20. Approved direction: `docs/GOAL.md` (the user's directive) and
the live screen recording `C:\Users\Edison\Videos\Screen Recordings\Screen Recording 2026-11-20 173739.mp4`.

## Intent

The recording shows six real UX defects in the shipped website. Fix their root
causes, demote the provider badge, and add genuine dynamic multi-domain support
only where a provider can legally and technically be reached from the browser.
Do not proxy, do not invent domains, do not fake mailbox functionality.

## Recorded defects (verified from the recording + code trace)

| Defect                                            | Root cause                                                                                                  | Fix                                                                                                                                                                                 |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A address wraps into two lines                    | `Address.tsx` emits `<wbr>` after `@`; `.address__value { overflow-wrap: anywhere }`; narrow flex field     | One-line clipped field with horizontal scrolling on focus; full value always in `title`/accessible name and selectable; remove the wrap test                                        |
| B copy feedback reshapes field                    | `<p role=status>` is an in-flow flex child of `.address-region`, only hidden while `:empty`, never reset    | Move feedback to a fixed, auto-dismissing toast + temporary icon state; never in field flow; keep `role=status` announcement                                                        |
| C Change shows awkward transitions                | `run()` sets `creating`, unmounts address+inbox, ignores the promise, no generation id                      | Keep address/inbox mounted; show in-button progress; generation id rejects stale responses; coalesce duplicate clicks; atomic message clear on success; preserve mailbox on failure |
| D message appended below inbox; stale after empty | `MessageView` is a sibling below `Inbox`; `pruneTo` deletes retained bodies but never clears `opened.state` | Reader replaces the inbox as a structured panel with Back; `pruneTo` clears the open selection when its message leaves the listing                                                  |
| E `1970-01-01T00:00:00.000Z`                      | Both adapters map missing/invalid dates to `0`; UI calls `new Date(0).toISOString()`                        | Make `receivedAt` nullable; adapters return `null`; UI shows "Date unavailable"; conformance asserts no epoch fabrication                                                           |
| F weak hierarchy                                  | 16px mono address, 14px lede, small empty state, no intermediate breakpoint                                 | Raise address/lede/empty-state type and give the 956px viewport its own rules, within the approved token set                                                                        |
| Provider badge                                    | `AppHeader.tsx` renders a prominent "Guerrilla Mail" pill                                                   | Remove it; keep truthful side facts; keep legally required attribution in docs, not as a header ad                                                                                  |

## Provider research (live, 2026-11-20)

| Provider           | Official API                      | Auth                      | Free               | Domain discovery                    | Domains verified                       | Inbox access  | Browser-only                                                                 | Status                                               |
| ------------------ | --------------------------------- | ------------------------- | ------------------ | ----------------------------------- | -------------------------------------- | ------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------- |
| Official Temp Mail | RapidAPI `Privatix/temp-mail`     | RapidAPI key              | free tier unknown  | not exposed publicly                | 0 verified                             | via paid API  | **No** (key required; no ACAO)                                               | Unsupported — no authorized browser access           |
| Mail.tm            | `https://api.mail.tm`             | account + Bearer token    | Yes, no key, 8 QPS | `GET /domains` (paginated)          | 1 recorded fixture; live ACAO absent   | Yes           | **No** from website (ACAO absent), **Yes** from extension (host permissions) | Supported in extension; domain catalog enabled there |
| Mail.gw            | `https://api.mail.gw`             | account + Bearer token    | Yes, no key, 8 QPS | `GET /domains` (paginated, 30/page) | 0 — host unreachable from this machine | Yes           | Unverified                                                                   | Unimplemented — cannot verify; not added             |
| DropMail           | `https://dropmail.me/api/graphql` | `af_` token or OAuth PKCE | Yes                | `domains` query                     | 0 verified                             | Yes (GraphQL) | **No** — no ACAO, token-in-app prohibited                                    | Unsupported — would need OAuth + CORS/proxy          |
| Guerrilla Mail     | `ajax.php`                        | session token             | Yes                | none                                | n/a                                    | Yes           | **Yes** (`ACAO:*`)                                                           | Current website provider                             |

Evidence: browser `fetch(mode:'cors')` from a `127.0.0.1` origin failed for Mail.tm,
Mail.gw and DropMail; Guerrilla succeeded. No backend/proxy will be added: project
policy forbids it and the goal requires reporting unsupported rather than a fragile workaround.

## Approach chosen

- **UX work on the website** (components + CSS + hook), with tests retargeted.
- **Shared contract additions**: `Domain` type, `listDomains()`, optional `createMailbox(domain?)`, `getCapabilities()`; in-memory catalog with TTL, dedup, active/expiry filtering, bounded refresh.
- **Mail.tm** gains full domain pagination and domain-scoped creation; it is the only provider whose catalog is exercised (in the extension). Guerrilla keeps provider-assigned addresses.
- **Website domain picker** appears inside Change, driven by the live catalog; with Guerrilla-only it honestly shows "automatic" and explains that no domains are available from a browser-reachable provider.
- **No new provider IDs** are added: Mail.gw cannot be reached, DropMail cannot be used browser-only, and Temp Mail has no authorized browser API. Recorded as unsupported in the final report.

## Non-goals / anti-goals

- No proxy, backend, API key, or shared token shipped to the browser.
- No fabricated domains, no fake mailboxes, no promise that a fresh domain is unblocked.
- No new marketing/explanation sections; no provider advertisement in the header.
- No expansion of the extension's existing Mail.tm+Guerrilla fallback contract.

## Where it goes

Code in `apps/web/src`, `packages/core/src`, `packages/providers/src`,
`packages/mailbox/src`; tests alongside; design/plan/report under
`docs/superpowers/`; promoted specs amended for nullable dates, dynamic domains
and the website's provider statement.
