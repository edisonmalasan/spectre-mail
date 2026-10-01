# Proposal

## Why

SpectreMail's entire roadmap is built on the assumption that a browser client can talk to a temporary-mail provider end to end: create a mailbox, receive a real external message, list it, and open it. That assumption has never been verified, and it is the single riskiest dependency in the product — the roadmap itself gates all UI work behind M0.

Manual reconnaissance during exploration already produced findings that contradict the roadmap's planning assumptions, so the spike must be executed for real and its conclusions recorded rather than assumed:

- `api.mail.tm` echoes `Access-Control-Allow-Origin` **only for its own origins** (`https://mail.tm`, `https://api.mail.tm`). Any third-party web origin receives no CORS header at all, which would make a browser-hosted SpectreMail website unable to call the API.
- Mail.tm's published terms forbid mirroring or proxying the API under another domain, so a SpectreMail-operated proxy is not a compliant escape hatch.
- Mail.tm account creation advertises a `ratelimit-policy: 1; w=60` header, i.e. one account per minute per IP — a hard product constraint for "generate a mailbox instantly" UX.
- No working real-time endpoint exists: `GET /messages/events` rejects `text/event-stream` with `406` and every negotiated format with `404`; no WebSocket endpoint accepts a connection.
- `api.guerrillamail.com` responds with `Access-Control-Allow-Origin: *` and returns its session token (`sid_token`) in the response body, so it appears callable from an ordinary web page.
- Guerrilla Mail's `f=send_email` requires a captcha (`needs_captcha: true`), so it cannot be used to inject a real test message.

Until this is proven with reproducible tooling and written down, every later milestone is speculative.

## What Changes

- Add a standalone, disposable technical spike under `tests/provider-spike/` that exercises the real Mail.tm and Guerrilla Mail APIs.
- The spike covers the roadmap's required lifecycle tests: domain/address discovery, mailbox creation, authentication/session handling, message listing, message fetch, mailbox/message deletion, provider error handling, rate limiting, and real-time transport behaviour.
- The spike runs the same provider probes from a real **normal web page** and from a real **Chromium MV3 extension** context using headless Chromium, so browser-context feasibility is measured rather than inferred from headers.
- Real external message delivery is attempted through a pluggable sender: an optional credentialed sender supplied by the maintainer via environment variables, and an interactive manual mode that prints the live address and polls until the message arrives. The spike reports honestly when real delivery is unverified instead of implying success.
- Every probe writes a machine-readable result artifact, and the harness prints a findings summary.
- Add `docs/PROVIDERS.md` recording the **actual observed** provider behaviour: working endpoints, auth/session model, CORS and browser restrictions, rate limits, expiration behaviour, realtime behaviour, failure modes, fallback viability, and terms that affect the product.
- Add a root `README.md` describing the project, its current status, and how to run the verified spike commands.
- Add a `Project Status` block to `docs/ROADMAP.md` and record the M0 findings that materially affect later milestones, including any that invalidate a planning assumption.

Explicitly **not** in this change: production provider adapters, the monorepo, any user-facing UI, any product styling, and any attempt to route around a provider's terms.

## Capabilities

### New Capabilities

- `provider-spike`: The disposable feasibility harness and its reporting contract — which provider lifecycle checks must exist, which browser environments they must run in, how results must be recorded, and the rule that unverified steps must be reported as unverified.

### Modified Capabilities

None. The project has no existing OpenSpec specs; this is the first change.

## Impact

- **New paths:** `tests/provider-spike/`, `docs/PROVIDERS.md`, `README.md`, `.editorconfig`, `.gitignore`.
- **No production code.** The spike is explicitly temporary and is expected to be retired or absorbed into the monorepo during M1.
- **No existing behaviour is changed.** No shipped surface depends on this change.
- **External dependencies:** the real `api.mail.tm` and `api.guerrillamail.com` services are exercised over the network, and headless Chromium is downloaded for the browser-context probes. Both providers rate-limit; the harness must stay within documented limits and must not run on every commit.
- **Risk:** the spike may conclude that the roadmap's "Mail.tm primary" assumption is not viable for the website, which forces a provider/architecture decision before M5. That is the intended outcome of running a real feasibility test, and it is recorded rather than avoided.
