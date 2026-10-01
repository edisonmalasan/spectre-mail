# Design: provider roles and the provider abstraction

## Context

M0 ran a disposable spike against `api.mail.tm` and `api.guerrillamail.com` from
a real web page and a real MV3 extension context, and observed the following.

| Finding | Measurement |
|---|---|
| Mail.tm CORS | `Access-Control-Allow-Origin` only for `https://mail.tm` and `https://api.mail.tm`. A page on a third-party origin gets no ACAO, not even for the public domain list. |
| Mail.tm from an extension | Full lifecycle reachable; host permissions bypass CORS. |
| Mail.tm real-time transport | Five SSE candidate paths returned 404/406. No WebSocket accepted a connection. |
| Mail.tm account creation | `ratelimit-policy: 1; w=60`. The header states a quota of 1 per 60s window but **does not state its scope**; "per IP" was inferred and is not evidenced. A `429` was observed in run `2026-10-01T18-18-42-250Z`, on a probe that **failed** because the spike exceeded its own budget — so it evidences the limit's existence, not a clean throttle. |
| Guerrilla reachability | Works from a normal web page and from an extension. |
| Guerrilla content typing | A plain-text message arrived as raw HTML. |
| Guerrilla envelope fields | The subject arrived empty on a real message; the sender was present. |
| Extension host permissions | `https://api.mail.tm` grants nothing; `https://api.mail.tm/*` works. |
| Real delivery | Verified on both providers, run `2026-10-01T18-08-41-251Z`. |
| Mailbox/session TTL | Not exposed by either API. Mail.tm's **FAQ** publishes a 7-day message retention and states a mailbox lasts until deleted; neither value is in the API response, and neither was measured live. Guerrilla publishes nothing equivalent. |
| Guerrilla dead session | HTTP 200 with an `error` key and no `list`; `auth.success` stays `true`. |
| Mail.tm terms | **No terms page exists** (`/terms` → 404). The FAQ is silent on proxying, resale, attribution, and quota. Verified 2026-10-02. |

The roadmap's plan was "Mail.tm primary for the website, Guerrilla Mail as
fallback where technically reliable". Measurement inverts it.

## Goals / Non-Goals

**Goals**

- Specify the corrected provider roles so M3 and the client capabilities are
  written against measured behaviour.
- Record the measured constraints as requirements, so they are inherited rather
  than rediscovered during implementation.
- Give `openspec/specs/` its first real capability.

**Non-Goals**

- Implementing an adapter, transport, or UI. That is M3 onward.
- Choosing between providers again. The roles are decided; this change records
  them.
- Solving disposable-domain reputation. It is measured as untested and carried
  as an open risk.

## Decisions

### 1. Provider roles are per client, not global

The website is Guerrilla-only. The extension is Mail.tm primary with Guerrilla
fallback.

Rejected alternatives:

- **A CORS-friendly primary for the website.** No such provider was measured as
  satisfying the roadmap's other requirements, so this was speculative.
- **Operate our own relay.** Explicitly rejected as a matter of product policy:
  SpectreMail does not relay a provider API to work around an origin restriction.
  This is deliberately **not** justified by provider terms — Mail.tm publishes no
  terms page at all, and its FAQ is silent, so no terms-derived argument is
  available or cited. The rule stands on its own purpose. It is written as a
  requirement rather than a preference because it is the option someone will
  otherwise suggest once the website's single-provider limitation becomes
  uncomfortable.
- **Drop Mail.tm entirely.** Rejected: it works fully from the extension, where
  CORS does not apply, and it is the stronger provider there.

The cost is accepted rather than hidden: **the website has no provider fallback
in V1.** That is recorded as a known limitation, not smoothed over.

### 2. Roles are specified, not left in a progress ledger

The decision lives in `Project Status` in `docs/ROADMAP.md`, which is explicitly
not the behavioural source of truth. If a later session reconciles that block
against Git and discards it, the decision would be lost while M3 was already
built against it. It is specified here so it survives reconciliation.

### 3. Measured constraints become requirements, not comments

Content-type distrust, absent real-time transport, account-creation throttling,
the wildcard host-permission form, and the absent mailbox TTL are all things an
implementation could get wrong in a way that only shows up in production. Each is
a scenario here.

### 4. Polling, not push

Mail.tm advertises SSE and serves none. Depending on an unverified transport
would produce a feature that silently never fires. Adaptive polling is required,
with rate-limit-aware intervals, rather than a fixed poll.

### 5. Throttling is surfaced

`1; w=60` on account creation means one mailbox per minute. A user who clicks
generate three times gets throttled. Silently queueing or retrying would hide a
provider limit behind an indefinite spinner. The condition is surfaced with a
retry time.

### 6. No assumed mailbox TTL

Neither API exposes one, and it was not measured. Guessing a duration would
produce false expiries that destroy live mailboxes. Expiry is driven by an
observed signal only. This requirement should be revisited if a TTL is ever
measured.

## Risks / Trade-offs

- **No website fallback.** One provider means one provider's outage or blocklisting
  takes down the website entirely. Accepted for V1 as the only compliant option;
  adding a provider later is additive because the abstraction is mandatory.
- **Disposable-domain reputation is untested.** Delivery was verified from a
  single sender. Providers that commonly blocklist disposable domains may refuse
  these mailboxes. This is a real product risk, carried forward rather than
  solved here.
- **A one-provider website is a thin abstraction argument.** The abstraction is
  still required, because the extension already has two providers and because the
  website will need a second one eventually. The requirement stands on its own
  merit.
- **Expiry semantics are weaker than planned.** Without a TTL, a mailbox can look
  alive while the provider has already discarded it. The client must handle a
  mailbox failing mid-session, which this change does not specify; it belongs to
  the mailbox capability when it is written.

## Migration Plan

Documentation and specification only. No code changes, so there is nothing to
migrate and nothing to roll back.

## Open Questions

- Which mailbox capability owns "the provider silently discarded a live-looking
  mailbox"? Deferred to the capability that defines mailbox lifecycle.
- **Where are Mail.tm's actual terms, if they exist?** No terms page was found.
  Until located, no attribution, resale, or proxying obligation may be asserted or
  denied. This blocks any claim about commercial use.
- Does the "register disposable mailboxes in bulk" path Mail.tm advertises on its
  homepage sit behind a different quota than the measured `1; w=60`? Unmeasured.
- Was the Guerrilla dead-session trap deliberately excluded from the requirements?
  It was not: five of six measured constraints became requirements and this one
  was deferred to the mailbox capability. If that reasoning is wrong it should be
  reversed here, not silently later.