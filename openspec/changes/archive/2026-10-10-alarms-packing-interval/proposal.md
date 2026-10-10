# Proposal

## Why

`extension-client` holds a promoted requirement that refuses to let any change put a polling session
in a background context until the platform's own behaviour has been measured and recorded. The
scenario is quoted **whole**, including its third bullet, because that bullet is the reason this
change exists:

> #### Scenario: A change needs a background poll
>
> - **WHEN** a change would place the polling session in a background context
> - **THEN** the recorded measurement SHALL already exist
> - **AND** the effective cadence SHALL be reconciled explicitly with the shared cadence rather than
>   diverging from it silently

**And a tension inside that requirement, worth naming rather than arguing past.** Its own "SHALL
measure" clause asks for *"how long the worker survives idle and what period `chrome.alarms` accepts"*.
The second half of that was measured in full at M8 — every requested period was stored verbatim, down
to `999.6 ms` — so **by a literal reading the clause is already discharged.** What is missing is the
one measurement that makes the third bullet computable at all: *"the **effective** cadence"*, to be
reconciled against `packages/mailbox`'s, is a term that means nothing until someone observes **when the
alarm fires** rather than what was requested of it.

So this change is not here to satisfy a clause that reads as already satisfied. It is here because a
promoted scenario demands a reconciliation that **cannot be performed** with the numbers this
repository currently holds — and a requirement whose terms cannot be evaluated is not a satisfied one.

`docs/PROVIDERS.md` §5.2 names the row as still open: **"MV3 `chrome.alarms` packing interval — §4.1
measured what the API *stores*, not when Chromium *fires*."** Alongside it, §4.1 records the
consequence: *"Nothing in this repository knows whether a background poller would wake every 5 seconds
or every 30; `packages/mailbox`'s `INBOX_POLL_PROMPT_MS` of 5 000 is a *page* cadence. Whoever schedules
background polling inherits an unanswered question, and it is not one this file answers."*

That leaves **M10 with one item it owns that cannot honestly be started** — the incoming-mail
notification. Its own declared-absence requirement still lists *"a notification"* among the surfaces
the extension forbids, and lifting that requires a background poll.

So the next slice is not a feature. It is the measurement, and it is worth doing on its own because
**nobody should build a wake-up cadence on an assumption this repository has already written down as
an assumption.**

## What Changes

- **A runnable instrument that measures when Chromium actually _fires_ a recurring alarm**, against
  the two numbers the product owns: `INBOX_POLL_PROMPT_MS` (5 000 ms) and `INBOX_POLL_CEILING_MS`
  (30 000 ms), read from `packages/mailbox/src/cadence` rather than restated.
- **A second measurement that turns the worker's 30-second idle *bound* into a figure or a wider
  bound** — §4.1 could say only *"a bound, not a figure"*, because it stopped watching at 30 000 ms.
- **The result recorded in `docs/PROVIDERS.md` §4.1**, with §5.2's open row closed or restated, and
  the change to §6's roadmap consequences if the answer moves one.

**Explicitly not in scope:** no product code changes, no permission added to the shipped manifest, no
polling loop, no alarm, no notification, and no decision about which context owns the session. This
change makes a decision *possible*; it does not make one.

**This change declares `skip_specs: true`.** It changes no product behaviour — it adds an instrument
and records what it observed. Every requirement it touches already exists and stays true:
`extension-client`'s no-polling requirement continues to forbid a polling loop, its "the measurement
has not been taken" scenario continues to forbid any document claiming an unobserved cadence, and its
"a change needs a background poll" scenario continues to gate the notification on this measurement
existing. **Inventing a delta to satisfy validation would add a requirement describing a platform's
behaviour, which is precisely what the requirement being satisfied exists to prevent.**

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None, for the reason given above: the measurement is what `extension-client` already requires, and
recording it changes no requirement.

## Impact

- **New:** `apps/extension/e2e/` gains one measurement script, alongside the existing
  `alarm-floor.spec.ts` and reusing its `e2e/fixtures/alarm-probe/` fixture — which exists for
  precisely this purpose and declares `alarms` **and nothing else**.
- **`apps/extension/static/manifest.json` is not touched.** The shipped manifest requests
  `["storage"]` only, and `alarm-floor.spec.ts`'s header records that measuring the floor in the
  shipped worker failed with `TypeError: Cannot read properties of undefined (reading 'create')` —
  which the file treats as a *result*, not a wrong turn, because the platform confirming the absence
  is stronger evidence than a JSON review.
- **`docs/PROVIDERS.md` §4.1, §5.2 and possibly §6**, which the existing requirement names as the
  place the measurement must be recorded.
- **No effect on CI.** The instrument is **not** added to the routine browser suite; a two-minute
  one-shot measurement would add minutes to every run to re-establish something already recorded. It
  follows the precedent of `apps/extension/e2e/live-host-permission.mjs`, which is quarantined from
  all three suites with a boundary assertion keeping it out.
- **No effect on any test count.** `pnpm verify` must still pass with `PLAYWRIGHT_BROWSERS_PATH`
  pointed at an empty directory.
