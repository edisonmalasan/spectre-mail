# Design

## Context

See `proposal.md` — Why. The current state this design has to work against:

- `apps/extension/e2e/alarm-floor.spec.ts` measures what `chrome.alarms` **stores**. Its own header
  already states the limit: *"It measures what the API **stores**. It does not measure when Chromium
  **fires**."*
- `e2e/fixtures/alarm-probe/` exists to give that measurement a worker with the `alarms` permission,
  ships no behaviour, and is loaded unpacked via `extensionFlags()`.
- `packages/mailbox/src/cadence.ts` owns `INBOX_POLL_PROMPT_MS` (5 000) and `INBOX_POLL_CEILING_MS`
  (30 000). §4.1 names these two numbers as the stake itself: *"Nothing in this repository knows whether
  a background poller would wake every 5 seconds or every 30; `packages/mailbox`'s `INBOX_POLL_PROMPT_MS`
  of 5 000 is a *page* cadence. Whoever schedules background polling inherits an unanswered question, and
  it is not one this file answers."*

## Goals / Non-Goals

**Goals**

- Establish when Chromium **fires** a recurring alarm, against the product's own two periods.
- Turn the worker's 30 000 ms idle **bound** into a figure or a deliberately wider bound.
- Leave behind a re-runnable instrument and a recorded result in the one place the existing
  requirement names.

**Non-Goals**

- Deciding which context owns the session. That decision belongs to the notification slice, and this
  change exists so the decision becomes *possible*.
- Adding `alarms` or `notifications` to `static/manifest.json`, scheduling anything, or shipping a
  notification.
- Any claim about a real provider, a packed extension, or another engine.

## Decisions

### D1 — The instrument is a quarantined script, not a collected browser spec

`apps/extension/e2e/alarms-packing.mjs`, sibling to the existing
`apps/extension/e2e/live-host-permission.mjs`, with a boundary assertion keeping it out of all three
suites.

**Why:** the run needs a window long enough to separate the two hypotheses (D5), which is minutes.
Adding that to the routine `browser` job buys nothing once the answer is recorded — a measurement's
value is in being taken once and written down, and a two-minute cost on every push forever is a poor
trade for that. `live-host-permission.mjs` is the existing precedent, and it is quarantined for the
same reason: it does something a routine suite should not.

**Alternative considered:** a collected spec with a long timeout, so the platform change would be
caught if Chromium altered its behaviour. Rejected — `live-host-permission.mjs` already accepted that
trade, and consistency between two quarantined platform probes is worth more than a hypothetical
regression signal nobody has asked for.

### D2 — Firing times are persisted to `chrome.storage.local`, never held in a worker-memory array

**This is the decision the whole instrument turns on.** If the worker is terminated between firings, an
in-memory array is silently truncated, and a truncated record is indistinguishable from *"the alarm
stopped firing"* — a completely different finding that would be recorded as a measurement. The record
has to survive the very thing it is measuring.

So `e2e/fixtures/alarm-probe/manifest.json` gains `storage` alongside `alarms`. **That is a change to
the fixture, and it must not be a change to the product**: the quarantine argument in
`alarm-floor.spec.ts` — *"the instrument that answers a question may need rights the product must not
have"* — is unchanged by needing two rights instead of one. `static/manifest.json` still requests
`["storage"]` only.

**Alternative considered:** reading the array live through `worker.evaluate`. Rejected — it conflates
"the alarm did not fire" with "the worker died and took the record with it", which is the one
distinction this instrument exists to draw.

### D3 — Every recorded firing carries the identity of the worker that observed it

A UUID generated at module scope, so each fresh worker load has its own, written onto each firing.

**Why:** *"the alarm fired at 30 s"* and *"the alarm fired at 5 s, but the worker was terminated and
the next delivered event arrived at 30 s"* are different claims about the platform, and the second is
the one a naive timestamp log would report as the first. Without the stamp the instrument cannot tell
a platform cadence from a platform lifecycle, and §4.1's open question is arguably about both.

**Alternative considered:** inferring restarts from Playwright's `context.serviceWorkers()` count.
Rejected as the primary record — it is polled, so it samples a continuous event, and a stamp written
by the worker at the moment of the event is not a sample.

### D4 — A second alarm runs concurrently, on the same code path, as the positive control

The `INBOX_POLL_CEILING_MS` (30 s) alarm is created alongside the 5 s one and recorded the same way.

**Why:** **a run that observes no firings is otherwise indistinguishable from a listener that never
fired.** This repository has recorded that shape more than once — a whole-page sweep matching nothing
satisfies every assertion above it, and a boundary rule narrowed to an empty package list passes
because everything it stopped scanning happens to be clean. Here the cost of the mistake is a
recorded measurement of nothing.

So: if **both** alarms are silent, the run reports a **harness error**, not a result. If the 30 s one
fires and the 5 s one does not, that is a real and very interesting finding, and it is recorded as
one rather than as a failure of the instrument.

### D5 — The window is derived from the two candidate intervals, and is stated

**120 seconds.**

Under no packing, a 5 s alarm fires about 24 times; under packing to 30 s, about 4. The window is
chosen so the two outcomes differ by a wide margin rather than by a little, and it is *computed from
the candidates* in the script so the reasoning is visible at the point of use.

**A window under about 90 s could not separate the hypotheses at all** — it would have to be one
observation against another with nothing in between. This is the repo's recorded rule about
precedences applied to a ceiling: a number chosen to be large enough is the recorded defect with a
larger number.

**Scope limit, recorded with the number:** Chrome's documented 30-second packing applies to
**unpacked** extensions, and this probe is loaded unpacked. The measurement therefore describes the
substrate it ran on, and the record says so in the same sentence as the figure.

### D6 — Termination is observed, never inferred, and the wording follows the outcome

A separate run with **no alarm at all**, polling `context.serviceWorkers()` and recording the last
observation at which the worker was present and the first at which it was not.

The record is written as a **figure** if it went away, and as a **wider bound** if it did not — and
the two are worded differently on purpose. §4.1's present entry is a bound for exactly one reason:
*it stopped watching at 30 000 ms*. A run that watches longer and sees nothing has not improved on
it, and must not be recorded as though it had.

### D7 — The probe writes a profile under `test-results/`, and the instrument says so

`launchProbe()` already writes `test-results/alarm-probe-profile-<pid>`. The new script does the
same, and **its own header states that this directory is churned by the measurement**, so any later
fingerprint or cleanliness check excludes it by name.

Recorded because this repository has already been caught by it: a source-tree fingerprint that swept
in `apps/extension/test-results/` reported **2930 changed files**, every one of them written by the
measurement that was asking the question.

## Risks / Trade-offs

- **The answer may be "it fires at neither 5 s nor 30 s"** → that is a legitimate result and is
  recorded as one. The script must not be shaped to confirm the documented 30 s figure; its only
  requirement is that the record be complete and that the two control conditions in D4 held.
- **One run is one observation** → the record says *"one run on <substrate>"* and never *"Chromium
  fires every N seconds"*. A single observation of a browser policy is not a guarantee about the
  browser, and this document's own §4.1 table has a column for exactly that distinction.
- **The worker never wakes at all** → the run has a ceiling and reports a harness error rather than
  hanging, because a check that did not run is not a check that passed.
- **The fixture now declares two permissions** → the risk is a later reader adding `alarms` to the
  shipped manifest because the probe needs it. The fixture's manifest description and this decision
  both name the quarantine, and the boundary assertion keeps the script out of the suites.
- **`skip_specs: true` is the flag that can be set for the wrong reason and still validate** → the
  reasoning is recorded in `.openspec.yaml` itself, not only in the proposal, so a reader who finds
  the flag finds the argument.

## Migration Plan

None. Nothing ships. Rollback is deleting a script, a fixture permission and a documentation section.

## Open Questions

**One, and it is deferrable because it cannot change this change's approach:** whether the answer
changes what the *notification* slice should schedule. That is a decision for that slice, taken with
the measurement in hand — which is the whole point of taking it first. If the measurement shows 30 s
packing, the notification has a ceiling and an honest promise; if it shows 5 s, it has neither
problem and the cadence question reopens at the notification's own proposal.
