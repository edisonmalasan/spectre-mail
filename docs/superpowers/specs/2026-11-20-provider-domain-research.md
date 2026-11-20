# Domain and provider research — 2026-11-20

## Method

Official API/docs pages were fetched with `webfetch`. Browser reachability was
tested with a Chromium `fetch(mode: "cors")` from a `http://127.0.0.1:4188`
origin against each API (`C:\Users\Edison\AppData\Local\Temp\opencode\cors-test.cjs`).
This distinguishes "the API exists" from "this website may call it" — the
project forbids a proxy/backend, so CORS is decisive.

## Provider table

| Provider           | Official API                                                                                                                        | Authentication                               | Free access               | Domain discovery                                                                              | Domains verified at inspection                                                                  | Inbox access                          | Browser-only (website)                                                       | Restrictions                                                                                                              | Implementation status                                                                              |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | ------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Official Temp Mail | [RapidAPI Privatix/temp-mail](https://rapidapi.com/Privatix/api/temp-mail) via [temp-mail.org/en/api](https://temp-mail.org/en/api) | RapidAPI key                                 | free tier not established | Not exposed publicly; docs say any `username@our_domains` works but no authorized domain list | **0** (no authorized enumeration)                                                               | Only through the paid API             | **No** — key required, no public ACAO                                        | API platform terms; messages self-destruct in 1–2 h; government/financial senders and role addresses blocked              | **Unsupported** — no authorized browser access; not integrated                                     |
| Mail.tm            | [docs.mail.tm](https://docs.mail.tm/) / `https://api.mail.tm`                                                                       | Account + `POST /token` Bearer token         | Yes, no key, 8 QPS/IP     | `GET /domains` (Hydra paginated)                                                              | **1** in the recorded fixture (`uberip.com`); live list not readable from this origin (no ACAO) | `GET /messages`, `GET /messages/{id}` | **No** from website (ACAO absent); **Yes** from extension (host permissions) | No illegal use, no resale, **no proxy**, visible attribution required; no terms page located                              | Already integrated for the extension; domain catalog + domain-scoped creation added in this change |
| Mail.gw            | [docs.mail.gw](https://docs.mail.gw/) / `https://api.mail.gw`                                                                       | Account + Bearer token                       | Yes, no key, 8 QPS/IP     | `GET /domains` paginated, 30/page, `isActive`, `hydra:totalItems`                             | **0** — `api.mail.gw:443` connection refused from this machine                                  | Full REST + Mercure SSE               | Unverified (host unreachable)                                                | No illegal use; forbidden to sell a product that exclusively wraps the API; no proxy                                      | **Not implemented** — cannot verify reachability or terms compliance; not added                    |
| DropMail           | [dropmail.me/api](https://dropmail.me/api/) GraphQL                                                                                 | Free `af_…` token or OAuth 2.1 PKCE per user | Yes, no account           | `domains { id name availableVia expiresAt }`                                                  | **0** verified live                                                                             | GraphQL `session(id){ mails { … } }`  | **No** — no ACAO; token-in-browser prohibited                                | Tokens identify usage for rate limiting; OAuth PKCE required for apps acting for users; rotating domains have `expiresAt` | **Unsupported** — needs per-user OAuth + a browser-reachable transport; not added                  |
| Guerrilla Mail     | `https://api.guerrillamail.com/ajax.php`                                                                                            | Session token from `get_email_address`       | Yes                       | None — provider assigns the address                                                           | n/a                                                                                             | `check_email` / `fetch_email`         | **Yes** — `ACAO: *`                                                          | ToS prohibit resource over-use; no attribution clause measured                                                            | Current website provider; no domain catalog because the API exposes none                           |

## Authoritative vs third-party

All entries above are from the providers' own documentation or live endpoints.
No scraped/historical domain list was used. The `uberip.com` figure is a
**recorded fixture value**, not a live inventory count, and is labelled as such.

## Conclusion

Mail.tm is the only integrated provider that can enumerate real domains, and it is
browser-reachable only from the extension. The website's only reachable provider
(Guerrilla Mail) has no domain API. Adding Mail.gw, DropMail or the official Temp
Mail API to the browser client would require a key, a shared token, or a proxy —
all forbidden. The implementation therefore adds a dynamic catalog where it is
real (Mail.tm, exercised in the extension) and reports the website limitation
truthfully rather than faking domain choice.
