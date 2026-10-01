# Specify provider roles and the provider abstraction

## Why

M0 measured that the roadmap's provider plan is inverted, and a maintainer
decision was required to continue. The decision is currently recorded only in
`docs/ROADMAP.md` under `Project Status`. That is the wrong home for it:

- `Project Status` is a progress ledger, not the behavioural source of truth. A
  later session may reconcile it against Git and discard the decision.
- `openspec/specs/` is empty, so M3's provider layer, the website capability, and
  the extension capability would each be written against the **superseded**
  roadmap assumption — Mail.tm primary for the website — unless the corrected
  roles are specified first.
- Several M0 findings are behavioural requirements, not measurements. Declared
  content type is untrustworthy, Mail.tm has no working real-time transport,
  account creation is capped at one per 60s, and a slash-less extension host
  permission pattern silently grants nothing. These must be requirements so the
  M3 spec inherits them rather than rediscovering them.

This change specifies the corrected provider roles and the constraints M0
measured. It deliberately implements no product code: M3 builds the adapter.

## What Changes

- **Correct the provider assignment.** The website uses Guerrilla Mail only. The
  extension uses Mail.tm as primary with Guerrilla Mail as fallback. This
  inverts the roadmap's stated roles and is the change's central decision.
- **Specify the `provider-abstraction` capability**, which `openspec/specs/` has
  never had. It defines the boundary every provider adapter sits behind, and
  records M0's measured constraints as requirements rather than as comments.
- **Forbid proxying provider APIs.** Mail.tm's CORS policy grants only its own
  origins and its terms forbid proxying, so a backend relay is not a permitted
  workaround. This must be a requirement, because it is the tempting one.
- **Forbid trusting declared content type or rendering raw HTML.** Guerrilla Mail
  was measured reporting `content_type: "text"` with an HTML body, and its real
  delivered message arrived as raw HTML.
- **Require adaptive polling** instead of the SSE/WebSocket transport the roadmap
  assumed, because Mail.tm has none that works.
- **Require surfaced throttling** instead of silent retry, because Mail.tm caps
  account creation at one per 60s per IP.
- **Require the wildcard extension host-permission form** and a test that
  exercises it, because `https://api.mail.tm` silently grants nothing while
  `https://api.mail.tm/*` works.
- **Forbid assuming a mailbox TTL.** Neither provider advertises one and it is
  unverified, so `MailboxStatus: expired` must not assume a duration.

## Non-Goals

- No adapter, transport, or UI code. That is M3 and later.
- No provider reliability work. The one untested dimension — delivery from senders
  that commonly blocklist disposable domains — is recorded as an open risk, not
  solved here.
- No own-domain mail infrastructure. The roadmap treats that as an M15 decision
  and it is not revisited here.
- No change to the provider APIs themselves or to provider terms.