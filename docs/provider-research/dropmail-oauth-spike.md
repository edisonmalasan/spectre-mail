# DropMail OAuth 2.1 + MV3 feasibility spike — result record

**Status:** TECHNICAL FEASIBILITY MEASURED. **Not an integration, not an approval, not a supported provider.**
**Research / evidence date:** 2026-11-22 (probe `runAt` **2026-11-22T21:54:27.788Z**, with an identical first run at `2026-11-22T21:50:14.390Z`).
**Worker:** M25 Worker B (test/spike). **Base:** `origin/main` at `0418d60401f2facfdb5099a237c88f81ce2c8704`.
**Ownership actually used:** two new files only — the quarantined probe and this record. No product code, provider config, manifest, `docs/PROVIDERS.md`, OpenSpec artifact, or architecture test was edited.

## 0. Evidence key

| Tag              | Meaning                                                                                            |
| ---------------- | -------------------------------------------------------------------------------------------------- |
| **MEASURED**     | An exact command was run / fetch made with the dated, verbatim (secret-redacted) output below.     |
| **DOCUMENTED**   | A verbatim value read from the provider's own RFC 8414 metadata or from the dated research record. |
| **INFERRED**     | A conclusion drawn from two MEASURED facts; stated as an inference, never as a run.                |
| **NOT VERIFIED** | No measurement exists; the exact reason is named.                                                  |
| **BLOCKED**      | An arm deliberately not completed; the exact resume condition is named. Never rounded to a pass.   |

**No token, authorization code, PKCE verifier, client id or client secret was printed, written to a file, placed in a URL by this instrument, or stored in browser-visible global state.** The PKCE verifier existed only in the throwaway worker's module scope and was cleared. Dynamic client registration was performed in the Node driver; only its shape was reported. The real authorize URL was built with **placeholders**, never a registered client id. Two bounded live provider calls per run (one public metadata GET, one registration POST); no token, revocation or GraphQL call was made.

## 1. Exact commands and their dated output

### 1.1 Environment (2026-11-22/23)

```text
$ node --version
v26.10.0

$ pnpm install --frozen-lockfile
Scope: all 9 workspace projects
Lockfile is up to date, resolution step is skipped
Packages: +266
Done in 18.7s using pnpm v12.6.0

$ node -e "console.log(require('./apps/web/node_modules/@playwright/test/package.json').version)"
1.63.0

$ node -e "const {chromium}=require('./apps/web/node_modules/@playwright/test'); console.log(chromium.executablePath())"
C:\Users\Edison\AppData\Local\ms-playwright\chromium-1243\chrome-win64\chrome.exe
```

### 1.2 The probe (MEASURED)

```text
$ node apps/extension/e2e/dropmail-oauth.mjs
runAt          2026-11-22T21:54:27.788Z

dropmail-oauth — MV3 OAuth/PKCE feasibility probe (quarantined, not an integration)
node           v26.10.0
command        node apps/extension/e2e/dropmail-oauth.mjs
base           https://dropmail.me/.well-known/oauth-authorization-server
surface        ["apiReport","clearPkce","makePkce","pkceSelfCheck","runWebAuthFlow","storageRead","storageWrite"]

[A1] chrome.identity in the MV3 service worker
    identity.getRedirectURL  true
    identity.launchWebAuthFlow true
    storage available        true
    extensionId              REDACTED
    redirectURL              https://REDACTED.chromiumapp.org/callback
    generated <id>.chromiumapp.org/callback shape  true

[A2] PKCE S256 generated inside the worker (values redacted)
    verifier length          43
    challenge length         43
    distinct                 true
    base64url verifier       true
    base64url challenge      true
    held / recomputed match  true / true

[A3] RFC 8414 metadata (one public GET: https://dropmail.me/.well-known/oauth-authorization-server)
    httpStatus                         200
    issuer                             "https://dropmail.me"
    authorization_endpoint             "https://dropmail.me/api/oauth/authorize"
    token_endpoint                     "https://dropmail.me/api/oauth/token"
    registration_endpoint              "https://dropmail.me/api/oauth/register"
    revocation_endpoint                null
    grant_types_supported              ["authorization_code"]
    response_types_supported           ["code"]
    code_challenge_methods_supported   ["S256"]
    token_endpoint_auth_methods_supported ["none"]

[A4] dynamic client registration (one POST; all returned values redacted)
    http status              201
    returned client id       true
    returned client secret   false
    redirect URI echoed      true
    grant types echoed       "authorization_code"
    error code               null
    error description        ""

[A5] LOCAL redirect interception (no provider, no credential)
    local origin             http://127.0.0.1:54761
    ok                       true
    final origin             "https://eoipnmcmjjemmfbebnpihfomdibodmap.chromiumapp.org"
    expected redirect origin "https://eoipnmcmjjemmfbebnpihfomdibodmap.chromiumapp.org"
    carried code / state     true / true
    error                    null

[A6] documented authorize endpoint, interactive:false, NO credential in the URL
    attempted                true
    url had real client id   false
    url had real verifier    false
    ok                       false
    error                    "Error: User interaction required. Try setting `REDACTED` and `timeoutMsForNonInteractive` if multiple navigations are required, or if code is used for redirects in the authorization page after it's loaded."

[A7] TOKEN EXCHANGE — BLOCKED
    Resume condition: a per-user authorization code from a completed interactive login;
    the token endpoint is https://dropmail.me/api/oauth/token. No token was requested.

[A8] REVOCATION / EXPIRY — BLOCKED
    Resume condition: a per-run token; revocation endpoint is unknown.
    Documented token durations were not exercised, and no token was requested.

[A10] MINIMAL GRAPHQL OPERATIONS — BLOCKED (no token)
    BLOCKED  live domain listing (expiry/health, free vs rotating flags)
    BLOCKED  mailbox creation
    BLOCKED  mailbox listing
    BLOCKED  reading one message
    BLOCKED  error mapping
    Resume condition: a per-user OAuth token obtained through an interactive login.

[A9] browser-session restart (same profile)
    PKCE held before restart true
    extension id restored    true
    redirect URL restored    true
    fixture value restored   true
    PKCE held after restart  false (worker memory does not survive; a token would need deliberate persistence)

[A11] WEBSITE CORS — BLOCKED (carried, not re-run)
    docs/provider-research/dropmail.md §4 measured no ACAO on 2026-11-22;
    no repeatable real-page test was run here, and no proxy or backend was added.

[summary] live provider calls: 2 (metadata GET + registration POST only)
[summary] arms that produced an observation: 11/11
[summary] no token, code, verifier, client id or client secret was printed or stored.
```

Exit `0`. The first run produced the same observations (different timestamp, local port and generated extension id). The probe was formatted with `pnpm exec prettier --write` after the first run; the second run above is on the final committed bytes.

### 1.3 Gates

```text
$ pnpm test tests/architecture
 Test Files  12 passed (12)
      Tests  175 passed (175)
   Duration  21.36s
exit 0
```

`boundaries.test.ts` held at **56** tests and passed, including _"quarantines every platform probe that reaches past what the product ships"_ and _"keeps the spike unreachable from workspace code"_. **No architecture file was edited**: the new probe is a `.mjs` under the extension tier's own `testDir`, which the client-storage rule exempts by reading `testDir` from the suite configuration; and the quarantine rule iterates a fixed list in `boundaries.test.ts` that still names the seven pre-existing probes. The new probe is unreachable from all three runners (not a `*.test.*`, not a `*.spec.*`, named by no `package.json` script), but **the list-based guard does not name it** — that list is outside this worker's write scope and is recorded here for the orchestrator rather than silently edited.

```text
$ pnpm verify     # with PLAYWRIGHT_BROWSERS_PATH = an empty directory (0 entries)
$ pnpm typecheck  ... 8 of 8 workspace projects, Done
$ eslint .        ✖ 4 problems (0 errors, 4 warnings)  [pre-existing apps/web warnings]
$ prettier --check .   All matched files use Prettier code style!
$ vitest run      Test Files 81 passed (81); Tests 1488 passed (1488)
$ pnpm --filter @spectre-mail/web build && pnpm --filter @spectre-mail/extension build
  both builds succeeded (vite 7.3.6)
VERIFY_EXIT=0
```

**One red is recorded rather than hidden:** the first `pnpm verify` exited `1` because `prettier --check .` rejected the newly written probe file. `pnpm exec prettier --write apps/extension/e2e/dropmail-oauth.mjs` repaired it; the gate was then re-run from scratch and exited `0`. The red was a formatting defect in this change's own file, not a flake.

## 2. Evidence table

| #   | Question                                                                                                         | Tag                                        | Measured answer                                                                                                                                                                                                                                         | What it does **not** establish                                                                                                                                          |
| --- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | Does `identity.getRedirectURL` produce the generated `https://<id>.chromiumapp.org/*` form in a real MV3 worker? | **MEASURED**                               | `true`; shape `https://<id>.chromiumapp.org/callback` matched; `launchWebAuthFlow` present in the worker's published surface                                                                                                                            | Nothing about any provider accepting that URI; A4/A5 below are the separate measurements for that                                                                       |
| A2  | Can the worker generate and verify an S256 PKCE pair without exposing it?                                        | **MEASURED**                               | verifier and challenge both 43 base64url chars, distinct, recomputed challenge equals stored challenge, `held=true`                                                                                                                                     | Nothing about a provider's PKCE acceptance — no verifier or challenge was sent to DropMail                                                                              |
| A3  | What does the provider's OAuth metadata declare?                                                                 | **MEASURED**                               | HTTP 200; `authorization_endpoint`, `token_endpoint`, `registration_endpoint`; `grant_types=["authorization_code"]`, `response_types=["code"]`, `code_challenge_methods=["S256"]`, `token_endpoint_auth_methods=["none"]`; **no `revocation_endpoint`** | Nothing about the endpoints' behaviour under a real code or token; A7/A8 blocked                                                                                        |
| A4  | Does documented dynamic client registration accept the generated redirect URI?                                   | **MEASURED**                               | HTTP **201**, client id returned, **no client secret**, redirect URI echoed, `grant_types=["authorization_code"]`, no error                                                                                                                             | The echo is a registration-time assertion; **not** proof that a completed login will redirect there or that a code will be accepted. Values redacted and never stored   |
| A5  | Does Chromium intercept a redirect to the generated URI?                                                         | **MEASURED (local fixture only)**          | a Node localhost server 302'd to `https://<id>.chromiumapp.org/callback?code=…&state=…`; `ok=true`, final origin equalled the expected redirect origin, code and state flags `true`                                                                     | **No provider was involved** and the code was a local fixture string. This measures the browser redirect mechanism, not a DropMail authorization                        |
| A6  | What does the documented authorize endpoint do under `interactive:false`?                                        | **MEASURED**                               | it was reached with placeholder client id and a placeholder challenge; `ok=false`, error **"User interaction required"**                                                                                                                                | Does **not** prove a human login is the only gate, nor that a real client id would be accepted. It is the observed reason this arm stopped                              |
| A7  | Token exchange                                                                                                   | **BLOCKED**                                | no token requested; endpoint `https://dropmail.me/api/oauth/token` from A3                                                                                                                                                                              | Resume: a per-user authorization code from a completed interactive login                                                                                                |
| A8  | Revocation and expiry                                                                                            | **BLOCKED**                                | metadata declares no `revocation_endpoint`; no token requested; documented durations not exercised                                                                                                                                                      | Resume: a per-run token (and a declared revocation endpoint, which metadata does not currently provide)                                                                 |
| A9  | Browser-session restoration                                                                                      | **MEASURED (substrate) / BLOCKED (token)** | after closing and relaunching the same profile: extension id restored `true`, redirect URL restored `true`, probe-owned fixture value restored `true`; worker-held PKCE `false` after restart                                                           | **Token restoration itself is NOT VERIFIED** — no token existed. The measured fact is that worker memory does not survive, so a token would need deliberate persistence |
| A10 | Minimum GraphQL operations                                                                                       | **BLOCKED**                                | domain listing (expiry/health, free vs rotating), create, list, read one message, error mapping — all five blocked                                                                                                                                      | Resume: a per-user OAuth token obtained through an interactive login                                                                                                    |
| A11 | Website CORS                                                                                                     | **BLOCKED (carried)**                      | `docs/provider-research/dropmail.md` §4 measured no ACAO on 2026-11-22; not re-run                                                                                                                                                                      | No repeatable real-page test was run and no result changed; no proxy or backend was added                                                                               |

### Inferences, explicitly labelled

- **INFERRED from A4 + A5:** a generated `chromiumapp.org` redirect URI is _plausible_ for this OAuth design — the provider echoed it at registration and Chromium intercepted a redirect to it locally. This is **not** an end-to-end authorization result: A6 stopped at "User interaction required", so no code, token or GraphQL response ever existed.
- **INFERRED from A6:** the technical feasibility work is complete and the remaining gate is a human authorization decision, not a missing platform capability. This is an inference from one error string plus the documented authorization-code flow, not a provider statement.
- **DOCUMENTED (carried):** `docs/provider-research/dropmail.md` §3 records that the provider discourages a shipped shared token and documents per-user OAuth 2.1 PKCE; §3/§8 record that third-party/competitive permission is **REVIEW REQUIRED** and that no Terms of Service document was located. This spike changes none of those verdicts.

## 3. GOAL §7 rows 3, 4 and 5

The Worker B brief named rows 3, 4 and 5 without quoting their text, so the row-to-arm mapping below is **INFERRED from the brief's own enumerated goals**; the verdicts are about the arms actually run.

| Row (as mapped from the brief)                                                                                                                                | Verdict     | Basis                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **§7 row 3 — DropMail OAuth 2.1 + MV3 feasibility: `identity.getRedirectURL`, `launchWebAuthFlow`, dynamic registration, PKCE, generated redirect allowlist** | **PASS**    | A1, A2, A3, A4, A5 all MEASURED with exact redacted output; A6 established the exact stopping point. This is a _technical feasibility_ pass only |
| **§7 row 4 — token acquisition, revocation/expiry, browser-session restoration**                                                                              | **BLOCKED** | A7 and A8 blocked on a human login / per-run token; A9 restoration substrate MEASURED but token restoration NOT VERIFIED                         |
| **§7 row 5 — minimum live GraphQL operations and website CORS**                                                                                               | **BLOCKED** | A10's five operations blocked on a token; A11 website CORS carried BLOCKED from the dated measurement, not re-run                                |

**No candidate provider is advertised as supported. No DropMail entry was added to any shipped provider list, adapter registry or manifest.**

## 4. Blockers and exact resume conditions

| Blocker                       | Resume condition                                                                                                                                                                                                                                                    |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A6/A7 — no authorization code | A human completes DropMail's interactive login for their own account, with a real per-run client id in the authorize URL. This instrument deliberately does not put a credential in a URL, so that step belongs to a future human-supervised probe, not to this one |
| A8 — revocation / expiry      | A per-run token, and a declared `revocation_endpoint` (metadata currently declares none)                                                                                                                                                                            |
| A10 — live GraphQL            | A per-user OAuth token from that completed login                                                                                                                                                                                                                    |
| A11 — website CORS            | A repeatable real-page test that changes the 2026-11-22 no-ACAO measurement; a proxy/backend is forbidden by repository policy and was not added                                                                                                                    |
| Authorization to integrate    | Written provider permission for competitive third-party use; **REVIEW REQUIRED**, unchanged by this spike                                                                                                                                                           |

## 5. What this record does **not** verify

- **No live DropMail token, authorization code, mailbox, message, domain list or error mapping was obtained.** Every GraphQL arm is BLOCKED.
- **No end-to-end OAuth success.** A4 and A5 are two separate facts (provider echo; local Chromium interception), not one completed flow; A6 stopped on "User interaction required".
- **No real provider redirect after login, no token exchange, no revocation, no expiry timing, and no token restoration across sessions.**
- **Nothing about a headed desktop, another engine, a packed extension, or a real person seeing an OAuth page.** One Chromium, one machine, headless, one profile.
- **Website CORS was not re-measured.** The 2026-11-22 block is carried, not re-derived.
- **Nothing about terms or permission.** The absence of a ToS document and the REVIEW REQUIRED verdict are carried from the dated research record.

## 6. Files changed

| Path                                             | Change                                                                                                |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `apps/extension/e2e/dropmail-oauth.mjs`          | New quarantined probe (generated fixture lives only in the OS temp dir and is deleted after each run) |
| `docs/provider-research/dropmail-oauth-spike.md` | This record                                                                                           |

No other file was touched: `tests/architecture/staged-probes.ts` and `tests/architecture/boundaries.test.ts` required no edit (the architecture gate passed unchanged), and `docs/PROVIDERS.md`, product source, `openspec/**`, CI and permissions were read-only.
