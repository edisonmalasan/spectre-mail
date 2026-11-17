# Proposal

## Why

**The website reports every live Guerrilla Mail mailbox as gone.** Measured from a real
browser on 2026-11-18: the page created `zhepimcj@guerrillamailblock.com`, then rendered
*"Your saved address is gone"* while the provider was still serving it. The next poll
answered `HTTP 200` with the address echoed under `email`, the same `sid_token`,
`auth.error_codes: []`, and a one-message `list` holding the provider's own welcome
message — a live session.

An empty live listing was then measured separately, by deleting that welcome message and
listing again: `{"list":[],"email":…}` with no `error`. So both halves of this defect
rest on a body captured today rather than on an inference from the old record.

`sessionIsLive` (`packages/providers/src/guerrilla.ts:225`) decides liveness by reading
`body["email_addr"]`. That key is returned by `get_email_address`, the **creation** call,
and never by `check_email`, the listing call, which carries the address under `email`.
Measured on a freshly created session, one request apart:

| response | keys |
| --- | --- |
| `get_email_address` | `alias`, `email_addr`, `email_timestamp`, `sid_token` |
| `check_email` | `alias`, `auth`, `count`, `email`, `list`, `sid_token`, `stats`, `ts` |

So the address check can never succeed, and every listing falls through to `return false`
and then `MAILBOX_EXPIRED`. The website's core function is dead against the only provider
a web page can reach, and *"Get a new address"* leads back into the same state.

**This violates a promoted scenario rather than merely lacking one.** `provider-adapters`'
*"A mailbox is genuinely empty"* requires that an empty result **SHALL NOT** be reported as
a session failure, and `mailbox-session`'s note states that the adapter *"already tells
them apart"*. The intent was right; the key was wrong.

**And no gate caught it, because the fixtures disagree with the record.** `guerrillaLiveList`
is labelled MEASURED and carries `email_addr`, which no listing sends; `guerrillaDeadSession`
is labelled MEASURED and carries no `error` and no `list`, which is neither measured shape.
The repository's own record says otherwise: `docs/PROVIDERS.md` §4.5 records the healthy body
as `{"list":[...],"auth":{...}}` and the dead body as
`{"error":"Please call get_email_address or set_email_user first", ...}` with no `list`, and
names the usable signals as *the `error` key and the absence of `list`*. The code followed
the fixture, and the fixture contradicted the measurement.

## What Changes

- **Repair the two Guerrilla session fixtures to the measured shapes.** The live listing
  carries `list` plus `email` and no `email_addr`; the dead session carries `error` and no
  `list`. The docblocks that assert shapes the record refutes are corrected with them.
- **Add a recording shaped exactly like the live response captured on 2026-11-18** — empty
  `list`, echoed `email`, no `error` — and assert it lists as an empty inbox rather than
  expiring. Because both browser tiers serve the same fixture, this repair alone reproduces
  the defect in the browser tier, not only in the unit suite.
- **Rewrite `sessionIsLive` to key on measured signals**: an `error` string, a `list` that is
  not an array, and an echoed address that is present and disagrees. A response that echoes
  no address is **not** evidence of death; that inversion is the defect.
- **Amend the `provider-adapters` requirement** so its measured basis names the signals the
  provider actually sends, and so its decision table carries all four arms — expired, empty,
  different address, no address.
- **Append a dated correction to `docs/PROVIDERS.md` §3**, whose M0 summary line reads
  *"HTTP 200, no auth error, empty inbox"* and teaches the shape that caused this. The
  original line is kept; the correction records that §4.5's bodies and the 2026-11-18
  re-measurement refute it. §4.5 itself is untouched.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `provider-adapters`: *"A dead session is never reported as an empty mailbox"* — the property
  is kept, its measured basis is corrected to the signals Guerrilla actually sends, and the
  address-disagreement and no-address arms are written into the requirement.

## Impact

- `packages/providers` only: `guerrilla.ts`, `fixtures.ts`, `guerrilla.test.ts`.
- `apps/web` and `apps/extension` need no source change and gain working Guerrilla listing —
  the website directly, the extension on its Guerrilla fallback. Both consume the adapter
  through the same contract, and both browser tiers already serve `guerrillaLiveList`, so the
  repaired fixture reaches them without a client edit.
- No API change, no dependency, no storage change, no token or visual change.
- `docs/PROVIDERS.md` §3 receives one appended correction, explicitly required by this
  change's tasks; §4.5, the recorded measurement every provider decision cites, is unchanged.
- **Not established by this change**: whether the provider ever had the silent dead shape
  §3 describes. The M0 spike stored summaries and not raw bodies, so its `email_addr` hits are
  creation responses only. The extension's fallback failure is inferred from shared code and
  has not been run live.
