# Design: provider roles and the provider abstraction

## Context

M0 ran a disposable spike against `api.mail.tm` and `api.guerrillamail.com` from
a real web page and a real MV3 extension context, and observed the following.

| Finding | Measurement |
|---|---|
| Mail.tm CORS | `Access-Control-Allow-Origin` only for `https://mail.tm` and `https://api.mail.tm`. A page on a third-party origin gets no ACAO, not even for the public domain list. |
| Mail.tm from an extension | Full lifecycle reachable; host permissions bypass CORS. |
| Mail.tm real-time transport | Five SSE candidate paths returned 404/406. No WebSocket accepted a connection. |
| Mail.tm account creation | `ratelimit-policy: 1; w=60`. One account per minute per IP. |
| Guerrilla reachability | Works from a normal web page and from an extension. |
| Guerrilla content typing | A plain-text message arrived as raw HTML. |
| Guerrilla envelope fields | Sender and subject arrived empty on a real message. |
| Extension host permissions | `https://api.mail.tm` grants nothing; `https://api.mail.tm/*` works. |
| Real delivery | Verified on both providers, run `2026-10-01T18-08-41-251Z`. |
| Mailbox/session TTL | Not exposed by either API. Unverified. |
| Guerrilla dead session | HTTP 200 with an `error` key and no `list`; `auth.success` stays `true`. |

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
- **Operate our own relay.** Explicitly rejected: Mail.tm's terms forbid proxying
  the API, so a SpectreMail-operated proxy is not a permitted workaround. It is
  now a requirement rather than a preference, because it is the option someone
  will otherwise suggest.
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
- Does Mail.tm attribution have UI wording requirements beyond a visible credit?
  Deferred to the extension capability.