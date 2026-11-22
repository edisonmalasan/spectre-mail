# Mail.gw — provider research decision row

**Researcher:** research worker (`research/mailgw` worktree/branch).
**Investigation date:** 2026-11-22 (Asia/Shanghai, UTC+08:00; browser eval timestamps are UTC).
**Assignment scope:** Mail.gw only. Official starting point <https://docs.mail.gw/>.
**Status:** **BLOCKED (service unreachable from this machine) + REVIEW REQUIRED (third-party/competitive permission ambiguous).** Not rejected on merits. No mailbox was provisioned; no live-delivery claim is made.

## 1. Sources, retrieval dates, and exact quoted text

Every URL below was retrieved on **2026-11-22** unless a page states its own last-edited date. Quotes are verbatim.

| Source | URL | Retrieved | What it establishes |
|---|---|---|---|
| Official API documentation | <https://docs.mail.gw/> | 2026-11-22 | API contract, quota, access terms, error codes, domain/account/message endpoints, Mercure SSE |
| Official OpenAPI document | <https://api.mail.gw/docs.json> | 2026-11-22 — **transport error, UNREADABLE** | Docs say it exists; this machine could not fetch it (see §7) |
| Official website | <https://mail.gw/en/> | 2026-11-22 | "10 Minute Mail" product framing |
| Official FAQ | <https://mail.gw/en/faq/> | 2026-11-22 | 10-minute retention, no send, no extension, domain non-renewal |
| Official Privacy Policy | <https://mail.gw/en/privacy/> | 2026-11-22 | No IP storage, deletion, access scope; page says "Last edited: 20.04.2020" |
| Official Contact page | <https://mail.gw/en/contact/> | 2026-11-22 | `support@mail.gw`, Discord, Telegram |
| Terms page | <https://mail.gw/en/terms/>, <https://mail.gw/en/tos/>, <https://docs.mail.gw/terms/> | 2026-11-22 | **All 404** — no dedicated terms document located |

### 1.1 Access, quota, and third-party-use language (verbatim from <https://docs.mail.gw/>)

> "Usage of our API for illegal activity is strictly prohibited."
>
> "It is forbidden to sell programs or earn from it that exclusively uses our API (for example, creating a competing temp mail client and charging for it's usage)."
>
> "Available completely free of charge and without restriction."
>
> "The general quota limit is 8 queries per second (QPS) per IP address."
>
> "Keep in mind that no API keys are required to use our service."
>
> "We would appreciate any legal integrations to make usage of our service, please let us know to be added to the list."
>
> "Our API is compatible with Mail.tm API libraries as the only difference would be the base URL."

The docs also instruct: "Sign up only on sites that you have acquired permission to." The page footer reads "Updated at Mon, Jan 16, 2023" and the OpenAPI version is stated as "OpenAPI Specification v3".

**Interpretation (an interpretation, not a measurement):** the quoted prohibition is aimed at *charging* for a client that *exclusively* uses this API. SpectreMail is free and multi-provider, so the literal example may not apply — but there is no affirmative grant for repackaging Mail.gw inside a competing free product, and no dedicated terms page resolves it. Per GOAL §3, this is **REVIEW REQUIRED**, never PASS.

### 1.2 Privacy and lifetime (verbatim)

From <https://mail.gw/en/faq/>:

> "It is completely anonymous: personal data, address itself and emails are deleted after 10 minutes."
>
> "How long do you store incoming messages? We do store messages for only 10 minutes."
>
> "How to extend the life time of temporary mail? Unfortunately, we do not provide this feature."
>
> "Do you keep and renew your domains used by this service? No, we aren't renewing domains that were used by this service. If you need a constant account just use Mail.tm."
>
> "How do I send an email? Unfortunately, we do not provide this feature."

From <https://mail.gw/en/privacy/> ("Last edited: 20.04.2020"):

> "Mail.gw Service does not store your IP-address at all."
>
> "All emails and data temporarily stored on our service are permanently deleted."
>
> "Access to your data will only be provided to you personally and only for the lifetime of the temporary email address."

**Consequence for SpectreMail:** a 10-minute mailbox lifetime is materially shorter than the product's saved-address/reload flow. Domain non-renewal implies real retired-domain churn. Neither is a reason to reject on merits by itself, but both must be surfaced truthfully if this provider is ever integrated.

## 2. Dated decision row

**Decision date:** 2026-11-22.

| Field | Finding |
|---|---|
| Provider / API version | Mail.gw; "10 Minute Mail API"; OpenAPI Specification v3; base URL `https://api.mail.gw`; docs footer "Updated at Mon, Jan 16, 2023" |
| Docs / terms / pricing URLs | Docs <https://docs.mail.gw/>; OpenAPI <https://api.mail.gw/docs.json> (unreadable here); pricing/access text on the docs page; site <https://mail.gw/en/>; FAQ <https://mail.gw/en/faq/>; Privacy <https://mail.gw/en/privacy/>; no terms page found (three 404s) |
| Free eligibility / signup / key / card | "Available completely free of charge and without restriction"; "no API keys are required". No signup or card for the API per docs. **NOT MEASURED** because the API host is unreachable. |
| Quotas / pricing / attribution | "8 queries per second (QPS) per IP address"; 429 documented. No price. No attribution obligation stated. Integration list is opt-in ("please let us know"). |
| Third-party / competitive use | **REVIEW REQUIRED.** Charging for a client that exclusively uses the API is explicitly forbidden; a free multi-provider competitor is not addressed affirmatively or negatively. No terms document located. |
| Live domain discovery | Documented: `GET /domains`, unauthenticated, `page` param, "up to 30 domains per page", `hydra:totalItems`, `hydra:view` with first/last/previous/next. Fields include `domain`, `isActive`, `createdAt`, `updatedAt`, `id`. `GET /domains/{id}` "Useful for deleted/private domains". **Live count: NOT MEASURED — host unreachable (§7).** Do not report a domain count. |
| Pagination | Yes (Hydra `hydra:view`/`hydra:member`), documented. Not exercised live. |
| Free vs premium flags | No premium/paid flag appears in the documented domain or account schema. The only lifecycle flag documented is `isActive` (and `isDeleted`, `isDisabled` on accounts). "Premium" is **NOT DOCUMENTED**, not proven absent. |
| Retired status / expiry | `GET /domains/{id}` is documented for "deleted/private domains"; FAQ says domains are **not renewed**. Account carries `retentionAt`; message carries `retention`/`retentionDate`; FAQ says 10 minutes. |
| Create | `POST /accounts` body `{address, password}` → account with `id`, `address`, `quota`, `used`, `isDisabled`, `isDeleted`, `createdAt`, `retentionAt`, `updatedAt`. Requires a product-generated password — a credential-handling design question for SpectreMail. **NOT EXECUTED.** |
| Auth / restore | `POST /token` body `{address, password}` → `{id, token}`; `Authorization: Bearer TOKEN` on every request except `POST /accounts` and `/domains`. `GET /me` → account for the token; `GET /accounts/{id}`; `DELETE /accounts/{id}` → 204. This is a restore-capable credential model on paper. **NOT EXECUTED.** |
| List / read | `GET /messages?page=` → 30 per page, `hydra:member` with `from{name,address}`, `to[]`, `subject`, `intro`, `seen`, `isDeleted`, `hasAttachments`, `size`, `downloadUrl`, `createdAt`, `updatedAt`. `GET /messages/{id}` → full `text`, `html[]`, `attachments[]`, `verifications[]`, `cc`, `bcc`, `retentionDate`. `PATCH /messages/{id}` marks read. `GET /sources/{id}` → raw `data`. **NOT EXECUTED.** |
| Delete | `DELETE /messages/{id}` → 204; `DELETE /accounts/{id}` → 204. Documented; **NOT EXECUTED**. No statement that deletion is instant or irreversible beyond "We can't restore your account". |
| Polling / push | No documented polling cadence. Mercure SSE is described at base `https://api.mail.gw/.well-known/mercure`, topic `/accounts/{id}`, Bearer token required; the same section says "we don't utilize them in this project" (about webhooks). **NOT MEASURED** — consistent with this repo's prior finding that advertised push transports must be verified, not assumed. |
| Message formats | List returns `intro` summary; detail returns `text` and `html[]` separately; `hasAttachments` and structured `attachments[]` with `contentType` (docs warn about decoding by contentType). Do **not** render the `html` field as markup (repo rule). |
| Privacy | Anonymous claim; "does not store your IP-address at all"; 10-minute deletion; per-account Bearer token. **Publicly addressable inboxes: NOT DOCUMENTED and NOT MEASURED.** Token storage/transmission security: not measured. |
| Website-origin CORS | **NOT MEASURED — host unreachable.** Real Chrome: `net::ERR_CONNECTION_REFUSED` navigating to `https://api.mail.gw/domains`; cross-origin `fetch` (including `mode:'no-cors'`, which skips the CORS check) throws `TypeError: Failed to fetch`. No `Access-Control-Allow-Origin`/`Allow-Headers` value was observable, so no CORS conclusion may be drawn. |
| Extension host-permission behavior | **NOT MEASURED** — no reachable API to call from an unpacked extension. A `https://api.mail.gw/*` host-permission pattern would be required by repo rules if this were ever integrated, but that is a design rule, not a measurement. |
| Throttling / errors | 8 QPS/IP; documented 400 (missing payload), 401 (bad/missing token), 404, 405 (wrong method), 418, 422 (bad payload/username/domain), 429 ("Try delaying the request by one second"). Success = 200/201/204. Verbatim from docs. |
| Liveness from this machine | **BLOCKED.** DNS resolves; TCP/443 and TCP/80 fail. See §7 for exact commands and errors. |
| Live delivery evidence | **NONE.** No mailbox created, no message received. Do not treat the documented flow or the docs site's availability as delivery proof. |
| Decision — website | **BLOCKED** (host unreachable from this machine; CORS unmeasured; terms REVIEW REQUIRED). Even if reachable, the 10-minute retention and non-renewed domains would need explicit UX truthfulness before any SUPPORTED status. |
| Decision — extension | **BLOCKED** (same unreachable host; no extension probe possible; terms REVIEW REQUIRED). |
| Overall | **BLOCKED + REVIEW REQUIRED.** Not `REJECTED` on merits: the API design is documented and Mail.tm-compatible, but nothing could be exercised. |

## 3. Evidence — official documentation quotes (retrieved 2026-11-22)

Verbatim excerpts from <https://docs.mail.gw/>:

> "This API allows you to automate the registration process at the various sites which do require email confirmation for testing purposes."
>
> "You have to use this when creating an account, to retrieve the domain. Returns a list of domains"
>
> "There are up to 30 domains per page, to check the total number, retrieve it from `\"hydra:totalItems\"`"
>
> "Retrieve a domain by its id (Useful for deleted/private domains)"
>
> "Remember: You should first create the account and then get the token!"
>
> "At this point, you could now get the token and do all the cool stuff you want to do."
>
> "Be careful! We can't restore your account, if you use this method, bye bye dear account :c"
>
> "Gets all the Message resources of a given page."
>
> "Retrieves a Message resource with a specific id (It has way more information than a message retrieved with GET /messages but it hasn't the \"intro\" member)"
>
> "Marks a Message resource as read!"
>
> "To listen to messages you'll need a different base url. Base url: `https://api.mail.gw/.well-known/mercure`. Topic: `/accounts/{id}`. Remember! You must use the `Bearer TOKEN` authorization in the headers!"
>
> "Our stack includes API-Platform, Mercure, Nuxt.js, Haraka, Caddy, MongoDB, Node.js, CentOS"

## 4. Evidence — liveness probe commands and exact output

All commands run in PowerShell on Windows 11, Node v26.10.0, curl 8.21.0, on 2026-11-22 (local time ~11:36–11:42 UTC+08:00). No credentials or secrets were used. Only a handful of connection attempts were made; none created an account.

```text
=== DNS api.mail.gw ===
api.mail.gw   AAAA  900  Answer  2a01:4f9:4b:44df::2
api.mail.gw   A     826  Answer  135.181.20.167

=== curl api.mail.gw (GET /domains, no Origin header) ===
curl: (7) Failed to connect to api.mail.gw:443 after 3795 ms: Could not connect to server
http_code=000

=== curl -4 api.mail.gw ===
curl: (7) Failed to connect to api.mail.gw:443 after 3361 ms: Could not connect to server
http_code=000 connect=0.000000s total=3.361977s remote=

=== raw TCP 443 to 135.181.20.167 ===
TcpTestSucceeded=False RemoteAddress=135.181.20.167 RemotePort=443

=== curl --resolve api.mail.gw:443:135.181.20.167 ===
curl: (7) Failed to connect to api.mail.gw:443 after 3292 ms: Could not connect to server
http_code=000

=== curl http :80 ===
curl: (7) Failed to connect to api.mail.gw:80 after 3338 ms: Could not connect to server
http_code=000

=== curl -6 api.mail.gw ===
curl: (6) Could not resolve host: api.mail.gw

=== control: docs.mail.gw ===
http_code=200 connect=1.946532s total=2.492976s remote=104.21.92.177

=== control: mail.gw ===
http_code=200 connect=0.192992s remote=104.21.92.177

=== control: api.mail.tm ===
http_code=200 connect=0.334332s remote=49.12.20.211
```

Independent corroboration: the `webfetch` service (a separate network path from this machine's curl) was asked for `https://api.mail.gw/docs.json` and returned exactly `{"error":{"type":"unknown","message":"Transport error (GET https://api.mail.gw/docs.json)"}}`. No other `webfetch` request to this host was made. This is **two distinct network paths** failing on the one endpoint each attempted, but neither proves a global outage: the finding is scoped to **this machine and these tools on 2026-11-22**.

DNS for `status.mail.gw` returns only the parent-zone SOA (`curt.ns.cloudflare.com`, serial `2420289389`) — no dedicated status host was discovered.

## 5. Evidence — real-browser CORS attempt (Chrome, 2026-11-22)

Tools: `tools.browse.navigate` / `tools.browse.eval` in a dedicated tab group `research-mailgw`, browser `chrome-this-computer`, Chrome/158.0.0.0. All tabs opened by this worker were closed before the report was written; other workers' tab groups were left untouched.

**Origin used for the third-party test:** `https://example.com` (verified `location.origin === "https://example.com"`).

```text
=== navigate https://example.com ===
{"url":"https://example.com/","navigated":true,"status":200,"tab":1030131933}

=== eval @ 2026-11-22T03:39:38.883Z (origin https://example.com) ===
simpleGet  -> {"label":"GET /domains simple","message":"Failed to fetch","name":"TypeError","thrown":"TypeError: Failed to fetch"}
authGet   -> {"label":"GET /domains with Authorization","message":"Failed to fetch","name":"TypeError","thrown":"TypeError: Failed to fetch"}
preflight -> {"label":"POST /token preflight","message":"Failed to fetch","name":"TypeError","thrown":"TypeError: Failed to fetch"}

=== controls @ 2026-11-22T03:40:03.680Z ===
control docs.mail.gw  -> {"status":200,"ok":true,"len":105588,"acao":null}
control example.com   -> {"status":200,"ok":true,"len":577,"acao":null}
api /domains          -> TypeError: Failed to fetch
api /                 -> TypeError: Failed to fetch
api mode:'no-cors'    -> TypeError: Failed to fetch

=== direct top-level navigation ===
Navigation to https://api.mail.gw/domains failed: net::ERR_CONNECTION_REFUSED

=== response-type control @ 2026-11-22T03:41:39.640Z ===
docs.mail.gw mode:'cors'    -> {"type":"cors","status":200,"len":105588,"acao":null}
docs.mail.gw mode:'no-cors' -> {"type":"opaque","status":0,"len":0}
api.mail.gw mode:'no-cors'  -> {"thrown":"TypeError: Failed to fetch"}
```

**Conclusion, narrowly:** the cross-origin request to `api.mail.gw` fails in a real browser, but `mode:'no-cors'` — which does not perform a CORS check — fails identically, and top-level navigation reports `ERR_CONNECTION_REFUSED`. The failure therefore occurs **before CORS is evaluated**. No ACAO/ACAH/ACAM value exists to quote. **Website CORS is NOT MEASURED, not "blocked by CORS"**, and no inference about a hypothetical ACAO policy is made. The `docs.mail.gw` control shows the browser harness can read a cross-origin 200 response, so the harness itself is not incapable of cross-origin reads.

## 6. Provider count vs domain count vs provisioned vs delivered

| Measure | Value for Mail.gw on 2026-11-22 |
|---|---|
| Provider count | 1 (this report covers Mail.gw only) |
| API-documented domain count | "up to 30 domains per page"; total via `hydra:totalItems` — **not fetched** |
| Live free active domain count | **NOT MEASURED** (host unreachable) |
| Provisioned domains / mailboxes | **0** (none created) |
| Domains with verified real incoming mail | **0** (no live delivery attempted; none verified) |

No recorded fixture or successful create is being presented as delivery evidence.

## 7. Blocker ledger and unknowns

1. **BLOCKED — service unreachable.** `api.mail.gw` DNS resolves to `135.181.20.167` (AAAA `2a01:4f9:4b:44df::2`) but TCP/443 and TCP/80 fail from curl, from Chrome (`ERR_CONNECTION_REFUSED`), and from the webfetch service. Re-test from another network before any further work. Do not convert this into a merits rejection.
2. **REVIEW REQUIRED — third-party/competitive permission.** The docs forbid *charging* for a client that exclusively uses the API; no terms page exists at the three URLs tried. A free, multi-provider competitor is not affirmatively authorized. Escalate for authorization if this provider is reconsidered.
3. **NOT MEASURED — CORS and extension host permissions.** Require a reachable host; then repeat §5 from a third-party origin and from an unpacked Chromium extension with the documented wildcard pattern.
4. **NOT MEASURED — every write/read operation.** Account creation, token, restore (`/me`), domain pagination, message list/read/delete, Mercure SSE. The API description is documentation only; no live probe succeeded.
5. **Privacy detail not measured.** Publicly addressable inboxes, token storage, IP handling asserted by the privacy page but not observed. The privacy page is dated 2020-04-20.
6. **Design constraint if ever reconsidered:** 10-minute mailbox and message retention plus non-renewed domains conflict with SpectreMail's saved-address reload flow; a truthful UI would need to state this. Product-generated password/token persistence would need an approved design (no shared secret in shipped browser code).

## 8. What this report did NOT verify

Nothing about Mail.gw's live API, domain inventory, CORS policy, extension behavior, actual delivery, or current third-party permission was verified. All endpoint descriptions are quoted from the provider's own documentation dated 2023, and all privacy/lifetime statements are quoted from provider pages dated 2020. The only live observations are the connection failures in §4 and the browser behavior in §5.
