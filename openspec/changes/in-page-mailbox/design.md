# Design

## Context

See `proposal.md` — Why. What follows is only the state and constraints that shape the approach.

**The extension already creates a mailbox.** `apps/extension/src/Popup.tsx` calls
`session.open()` and then `storage.saveMailbox(next.mailbox)`, gated on `holdsMailbox(next)` so that
nothing is persisted before the provider confirms it. `App.tsx` builds the manager and the session
from `provider-config.ts`, `transport.ts` and `scheduler.ts`. So this change adds no new capability
to the extension and no new dependency; it makes a **request from a page** reach a composition that
already works, and puts the same "persist only after the provider confirms" rule on the path that a
person on a stranger's page actually takes.

**The in-page surface reads storage itself.** `content-script/controller.ts` takes
`Pick<SpectreStorage, "loadMailbox">` and its own comment records that `saveMailbox` and `clearAll`
are *deliberately not offered*. That decision survives here and is extended rather than reversed
(see D3).

**Three measurements were taken before this document was written**, in real Chromium (Playwright
1.63.0), against throwaway fixtures on two loopback origins, with no third party contacted. The
probes lived outside the repository tree; what survives is `docs/PROVIDERS.md` §4.4.

| # | Question | Measured answer |
|---|---|---|
| A1 | Content script's own `fetch` to a cross-origin host the extension holds `host_permissions` for, provider sending **no** CORS headers | **refused** — `TypeError: Failed to fetch` |
| A2 | The same request, provider sending `Access-Control-Allow-Origin: *` | granted, HTTP 200 |
| A3 | The same content script fetching **its own** origin (harness control) | granted, HTTP 200 |
| B | The **service worker** fetching A1's URL, provider sending no CORS headers | **granted, HTTP 200** |
| C | Content script → message → worker → provider | answered |
| D | Content script wrote `chrome.storage.local`, worker read it | same value |
| E | Round trip after idle gaps of 0 / 5 000 / 35 000 ms | 17 ms / 5 ms / 5 ms, worker still registered at 35 000 ms |
| F | Does `context.route` reach an extension's service worker? | **yes** — worker, extension page and plain page all fulfilled; handler saw all three requests |

**A1 alone proves nothing.** It is equally consistent with "the content script's fetch obeys the
page's CORS policy", "the host permission was never granted", and "Chromium blocked loopback". B
rules out a missing permission; A2 rules out a request that never left; A3 rules out a broken
harness. Only the shape A1-refused / A2-granted / A3-granted / B-granted is attributable, and any
other shape reports inconclusive rather than a verdict.

**A defect found by reading rather than measuring.** `apps/extension/src/scheduler.ts` calls
`window.setTimeout`. A service worker has no `window`, so the scheduler the worker must be given
throws at call time. It compiles, and no current test reaches it from a worker, which is exactly how
a defect of this shape survives.

**No promoted requirement covers the one-module platform rule.** `extension-client` says nothing
about it; `tests/architecture/boundaries.test.ts` enforces it as
`CHROME_PLATFORM_READER = /^local-area\.tsx?$/`. This change makes that module carry a second seam,
so it is the moment to give the rule a requirement rather than leave a boundary that only a test
holds up.

## Goals / Non-Goals

**Goals.** A page can obtain an address when this device holds none, by asking the extension rather
than by fetching anything itself. The request reaches a composition that already exists and obeys the
same confirmation-before-persistence rule the popup obeys. The worker holds nothing afterwards. The
page never states an outcome nothing observed. The extension's browser tier keeps serving recorded
provider responses, so no test contacts a live provider.

**Non-goals.** No polling, no alarm, no session held between requests, no inbox in a page, no site
association, no recently-used offer, no new design token and no new motion — the last two are slice
1's commitments and nothing here changes them. No provider is contacted by any test. No measurement
of a real provider's latency is invented (see D5).

## Decisions

### D1 — Creation is delegated to the background worker, because a content script may not do it

**Chosen:** the content script asks the background worker by message; the worker performs the
creation over the shared session and the provider abstraction.

**Forced by measurement, not chosen by preference.** A1/B establish that the extension's host
permissions do not cover a content script's own cross-origin request, and that they do cover the
worker's. The alternative designs are not equivalent:

- *Create in the content script.* Does not work, and fails **per page** rather than per provider —
  it would succeed on a page with a permissive policy and fail on one without, for a reason no user
  can act on. A product that works on some sites and not others, with no visible cause, is worse
  than one that works nowhere and says so.
- *Ask the page for permission first.* Rejected outright: a page cannot grant what its own policy
  withholds, and asking a stranger's page for anything on a stranger's form is a request this
  product should not make.
- *A SpectreMail-operated proxy.* Already forbidden by `AGENTS.md` and by `provider-abstraction`
  ("Provider APIs are never proxied"). Not a candidate.

**Cost:** the worker's lifetime enters the design. D2 answers for it.

### D2 — The worker holds nothing between requests

**Chosen:** each request builds its own session, opens, persists, answers, and discards. The worker
is a stateless function of a request.

**Because its lifetime is still unmeasured.** `measurement.spec.ts` establishes a 30-second idle
*bound*; this change's E adds a round trip measured after a 35-second idle gap. **Both are bounds,
and neither is a termination point** — 5 ms at a 35-second gap is evidence the worker was *alive*,
not evidence about when it would not be. Anything retained across events is therefore retained in a
context whose death nobody has measured. Retaining nothing makes that unmeasured fact harmless:
a woken worker and a cold one behave identically, because there is no state whose absence the cold
one would notice.

**Considered and rejected: a session that lives in the worker.** It is what the website does, and it
would make "create once, insert many" cheaper. It trades an unmeasured lifetime for a measured one
that has not been taken. `extension-client`'s existing requirement already forbids building on that
assumption; this change amends that requirement to forbid retention rather than merely polling, and
the amendment is in the delta.

**Considered and rejected: keeping the session in the content script**, which lives as long as the
page. It cannot work at all — D1 — and the record of why is now in `docs/PROVIDERS.md` rather than in
a comment nobody reads.

### D3 — The worker persists; the page does not

**Chosen:** the worker stores the new mailbox before it answers. The content script's storage
surface stays `loadMailbox` only.

The alternative — widen `InPageOptions` to `saveMailbox` — was rejected for a reason that is about
failure reporting rather than tidiness. Creation and persistence then live in **two** contexts, so
"the provider confirmed it, the write failed" is a state one of them must notice and the other can
never see. Keeping both in the worker leaves exactly one place where a created mailbox is either
stored or reported as not stored.

The page still *reads* storage after an unanswered request (D5), and that read is the one case where
it needs to: it is asking whether something now exists, not writing one.

**The stored record is the same one.** `spectre-storage` needs no amendment: its `chrome.storage`
adapter requirement already covers a second extension context using the same contract, and its
"`null` means exactly one thing" rule is what makes the page's post-timeout read honest — a read
that rejected is not a read that found nothing.

### D4 — The one platform reader is renamed rather than widened

**Chosen:** `apps/extension/src/local-area.ts` becomes `apps/extension/src/extension-platform.ts`
and supplies both the local storage area and a narrow messaging seam, with
`CHROME_PLATFORM_READER` retargeted to the new name.

The module's own comment states the naming rule it follows: *the name says what the module supplies
rather than what it names*. A module supplying two things needs a name covering both, so
`local-area.ts` becomes false the moment a messaging seam is added to it — and a module whose name
has stopped describing it is how the next change ends up exempting paths by keyword.

**Rejected: a second permitted module.** It would weaken *"exactly one module"* to *"two modules"*
to serve a naming problem, and a permitted list is the mechanism by which a one-module boundary
becomes an N-module boundary without anybody deciding anything.

**Rejected: keeping the name.** Three options are available and two are worse: a carve-out exempting
any specifier containing a word would exempt a future path that reaches the global — the exact
mistake `local-area.ts` was renamed to escape — and a second copy of the read in the worker is the
duplication the boundary exists to prevent.

`extension-platform.ts` contains no `chrome` token in its path, so the rule's original false positive
(the file being called `chrome-platform.ts` while the rule matched the identifier) cannot recur.

### D5 — The wait has a ceiling, and crossing it produces a **read**, not a claim

**Chosen:** the page waits a stated interval; if no answer arrives, it re-reads this device's stored
mailbox. A mailbox found there is the created address and is inserted. None found means the copy
says SpectreMail **could not confirm** an address was created, never that none was created.

**The ceiling cannot be derived from a measurement, and pretending otherwise is the defect this
decision exists to avoid.** The 5–17 ms round trip in E measures *the worker's* latency against a
loopback origin. No provider latency has ever been observed here, and Mail.tm's published limit
(`30; w=60`) is a creation **rate**, not a duration — `provider-abstraction` requires a stated limit
to be obeyed and never converted into a schedule. So the interval is declared as **this product's
own choice**, in the module that uses it, with that reasoning attached, and it is not printed
anywhere: `website-client` forbids the page showing a cadence it has not measured, and the same
rule applies here.

**Why a read rather than a failure.** It converts "did it work?" from a guess into a measurement the
page is already equipped to make, and it removes the duplicate-creation case that a bare "it failed,
try again" would invite. If the worker succeeded late, the mailbox is already stored, the page finds
it, and it inserts — so the person pressing again gets a second mailbox **only** when the first
genuinely did not happen.

**Considered and rejected: no ceiling.** A permanently stuck button is a defect, and "the page's
wait" has to be stated for a reader to know what stuck means.

**Considered and rejected: `INBOX_POLL_CEILING_MS` from `packages/mailbox`.** It is 30 000 ms, it is
already imported by a browser spec precisely because hand-picking a number large enough is the
recorded defect — but importing it here would assert that a creation completes inside an **inbox
polling** ceiling. That is a category error, and the shared cadence means nothing to this request.

### D6 — The message seam is typed on the way out and validated on the way in

**Chosen:** a shared module declares the request and the answer as a discriminated union; the sending
side narrows the platform's untyped reply, and the receiving side acts on nothing it has not checked.

`chrome.runtime.sendMessage` answers with whatever the other side put there, untyped. A page is
arbitrary input to a content script and a content script is arbitrary input to a worker, so the
reply is treated as data to be **verified** rather than trusted. Both halves are required: a type
annotation on the request alone would leave the answer unchecked, which is the half that matters.

### D7 — One request per activation, enforced by the control's own state

**Chosen:** while a request is outstanding the affordance reports that it is waiting and cannot be
activated again.

Two activations create two mailboxes at a provider and discard one. That cost is outside this
product and there is no way to undo it, so the outstanding request is a thing a person cannot start
a second of. The requirement states it, and the negative half is falsifiable in the browser tier: a
second activation produces no second provider request.

### D8 — The control outlives a focus change only while an answer is outstanding

**Chosen:** `focusout` still removes the affordance, except while an answer this extension asked for
is outstanding.

Without the exception, a person who presses the control and tabs to the password field loses the only
place the answer could be reported, and the field the address belonged to is one they have left.
The exception is bounded to one outstanding request and is removed the moment the answer arrives,
so it does not make the control persistent — which is the property the capability's whole first
requirement exists to protect. The amended clause is in the delta.

### D9 — The browser tier keeps serving recorded responses

**Chosen:** the delegated path is browser-verified through `context.route`, against the **built**
extension, with the worker's provider requests fulfilled by the harness.

Measurement F is what makes this a decision rather than an assumption. Playwright's interception of
service-worker requests has historically not reached them, and had it not, the alternatives were a
fixture extension (weakening every claim that says "the built extension"), a live call (breaking the
one-live-call rule), or unit coverage only. F establishes none of those are needed.

**The route must also cover the worker's requests, not only the page's** — the existing extension
tier routes provider traffic, and a case whose assertion only holds when the worker's request was
fulfilled would be a case that silently depends on a live provider the rest of the time.

### Risks / Trade-offs

- **[The worker is terminated and never wakes, so a page waits out its ceiling]** → the page's
  post-ceiling read still reports honestly, and the copy says *could not confirm* rather than
  *failed*. The alternative — a longer wait — cannot fix it, because the question is unbounded.
- **[A person presses again after an unconfirmed outcome and a second mailbox is created]** →
  accepted and stated in the requirement, not prevented: refusing the request would leave somebody
  who was told nothing with no way forward, and the possibility is disclosed in the spec rather than
  left to be discovered.
- **[The message seam's answer is wrong-shaped and something acts on it]** → the union is validated
  at both ends, and each refusal shape is a named variant rather than a string, so an unrecognised
  shape degrades to "no answer" instead of to a claim.
- **[The renamed module's boundary rule is retargeted to the wrong thing]** → the rule keeps its
  negative control, and the retarget is verified by planting a probe at a fresh path and watching it
  reported, not by reading the pattern.
- **[`docs/PROVIDERS.md` grows a section asserting platform behaviour]** → each row states what it
  does **not** establish, as §4.2 does: nothing about a live provider, nothing about a real provider's
  latency, nothing about how long the worker survives.

## Migration Plan

None. No stored record changes shape, no version bump, and the `chrome.storage` key is unchanged.
A person who already has an address is unaffected: the creation offer appears **only** when this
device holds none, so the insertion path from slice 1 is unchanged for every existing user.

Rollback is the revert of this branch. The only externally visible additions are a control that
appears when this device holds no address, and a request a page can make of the extension.

## Open Questions

None that change the specs, the approach, or the task breakdown. Two things are deliberately left
**unmeasured and unclaimed** rather than open: how long a real provider takes to create a mailbox,
and when an MV3 worker is actually terminated. The first is why D5's interval is declared as a
product choice, and the second is why D2 retains nothing. Neither blocks this slice, and a later
milestone may measure either without amending anything here.