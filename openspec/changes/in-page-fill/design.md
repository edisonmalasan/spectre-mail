# Design

## Context

The extension has three contexts and a message channel between two of them. The **content script**
runs on every `http`/`https` page and reads `chrome.storage.local` directly; it can insert an
address into an email field and, through delegation, can ask the **background worker** to create a
mailbox. The **popup** owns a `packages/mailbox` session and renders a count. The **worker** answers
one request and holds nothing.

Three facts shape everything below, and none of them is an assumption:

1. **The listing carries no detection.** `MessageSummary` has no codes or links, by construction —
   `packages/core` says so and gives the reason. A code exists only on an opened message.
2. **The content script cannot see `chrome.tabs`.** Measured this session: its world has no `tabs`
   namespace at all, so the reach a fill needs is one-directional, from an extension context.
3. **The popup can reach a tab, with no permission.** Measured below, in full, because it is the
   fact the whole slice rests on.

The write path into a page's field already exists and is already measured against React 19:
`content-script/insert.ts` sets the value through the prototype setter and then dispatches `input`
and `change`, and its own note records that assigning `field.value` alone leaves a controlled
component rendering a filled field that submits empty. **Nothing about filling a field is new. What
is new is deciding which field, and getting a value to it.**

## Goals / Non-Goals

**Goals**

- A code the user has seen can reach the open page's one-time-code field on one activation.
- No new manifest permission, no background polling, no new persisted record.
- One property for insertions, generalised rather than restated per caller.

**Non-Goals**

- Arrival notification, `chrome.alarms`, or any background context owning a session.
- Copying a code, or opening a verification link, from the popup.
- Remembering a filled code, or which field it went into. Nothing about a code is persisted.

## Decisions

### D1 — The popup delivers to the tab, and it costs no permission (measured 2026-10-10)

**This is the fact the slice depends on, and it was measured rather than assumed, in a throwaway
fixture outside the repository** carrying the shipped manifest's permissions verbatim — `storage`
only, `host_permissions` for the two providers, `content_scripts` matching `http://*/*` and
`https://*/*` — because a fixture that declared more would have measured a different extension.

Chromium 141, Playwright 1.63.0, headless, unpacked. A page was served at
`https://signup.invalid/signup` with an `autocomplete="one-time-code"` input. A **real action
popup** was opened with `chrome.action.openPopup()`.

| Question | Answer |
| --- | --- |
| Does the popup hold `chrome.tabs` without the `tabs` permission? | **Yes** |
| Does `chrome.permissions.contains({permissions:["tabs"]})` say yes? | **No — `false`** throughout |
| Does `chrome.tabs.query({active: true, currentWindow: true})` name the tab the popup is docked to? | **Yes** — it returned the id whose own reply carried `href: "https://signup.invalid/signup"` |
| Does `chrome.tabs.sendMessage` from that popup reach the content script there? | **Yes**, and the content script answered |
| Does that origin hold a host permission? | **No** — the only host permissions are the two provider origins |
| Does the reply carry the URL, as `tabs.query` would with the `tabs` permission? | **No** — `tab.url` is `undefined` throughout |
| Can the content script do this itself? | **No** — its world has no `chrome.tabs` (`hasTabs: false`) |
| Can the page see any of this? | **No** — the page's own world has no `runtime`, `storage` or `tabs` |

**So the extension learns a tab id and nothing else, and it does not need the URL** — the content
script knows which page it is in, and reports its own `href` in the reply. That is why the missing
`tab.url` costs nothing here, and it is recorded rather than left as a gap because "no URL" reads
like a limitation until a reader is told which limitation would have mattered.

**A broadcast is not an alternative, and the measurement says so.** Sending to *every* tab id
answered on exactly one tab; the others refused with *"Could not establish connection"*. Two things
follow, and the second is the reason this is a design note rather than a footnote: a fill cannot
work by trying every tab, and **it must not**, because that would put a verification code into the
content script of every page the user has open. Discovery is by `currentWindow`; delivery is to one
named tab.

**Three instrument defects, all found by running the probe rather than by reading it, and recorded
because each produced a confidently wrong answer first.**

1. **The first arm measured the wrong tab and said something true about it.** With the popup opened
   as an ordinary tab, `chrome.tabs.query({active: true, currentWindow: true})` returned *the
   popup's own tab*, and `chrome.tabs.sendMessage` to it failed with *"Receiving end does not
   exist."* Read alone, that is a clean negative result about delivery, and it would have been
   false. The fix was to record `chrome.tabs.getCurrent()` alongside the query and compare — and
   the two arms now differ in exactly that field, which is the control that separates them.
2. **The control I wrote for "was a popup really open" does not exist in MV3.**
   `chrome.extension.getViews` is not a function, and a control that cannot run is a control that
   cannot fail. The substitute is the one above: a real popup returns `null` from `getCurrent()`
   because it is not a tab.
3. **`"Receiving end does not exist"` has two causes** — no listener, or delivery refused — and the
   first version could not tell them. The fix was to have the content script stamp
   `data-probe-loaded` on the page's `documentElement` **at injection**, which the page can read
   without any message channel being involved. It read `"yes"` on every run, including the runs
   where every send failed — which is the observation that made the negative arms trustworthy.

`chrome.action.openPopup()` resolved but surfaced **no Page** to the harness, so the probe reads the
popup's findings back through the worker rather than through a page handle. A probe that waited for
a handle would have waited forever, and one that gave up and opened the popup as a tab would have
measured the wrong thing — which is defect 1.

**What this measurement does not establish**, stated because the list is the point: nothing about a
real signup page's markup, nothing about a site that marks its code field differently from the
fixture, and nothing about a page served in an iframe. The probe ran offline against one authored
document.

### D2 — This is not "arrival notification", and the reasons are measured

The roadmap's M10 opens with *"when likely verification mail arrives"* showing a notification. That
was the other option put to the user, and it was declined. Three reasons, two of them measured
already:

- **It reverses a committed requirement.** `extension-client` forbids the worker scheduling any
  repeated provider request and creating any alarm, and forbids any document claiming a background
  cadence this repository has not observed.
- **The two facts it would rest on are still unmeasured.** `measurement.spec.ts` established a
  *bound* — the worker was still registered after a 30 000 ms idle window — and no termination
  point. `alarm-floor.spec.ts` established what `chrome.alarms` **stores** (every period accepted
  down to 999.6 ms) and explicitly not when Chromium **fires** it; Chrome's documented packing to
  at most once per 30 seconds is unobserved here.
- **It needs two permissions the manifest does not declare**, and this capability's own scenario
  fails the build if the manifest requests a permission no shipped surface uses.

The honest consequence of declining it is stated in the specs rather than hidden: **a code is only
available after a check the user asked for.** That is a real reduction in what the product can do,
and it is the same reduction the popup's inbox count already carries.

### D3 — The user opens the message; the listing does not choose it

`MessageSummary` carries no detection, so the popup cannot mark which message holds a code. The
alternative — open messages until one yields a code — spends a provider request per message and
guesses.

**The user opens one message, and the popup renders its codes.** The shared session retains the
analysis of a message it has opened, so a second visit costs nothing, and that retention is already
required by `mailbox-session` rather than introduced here. This is the same division the website
already uses, and it is why the popup requirement forbids indicating that a message carries a
verification before it has been opened.

**Rejected: opening every listed message to find the newest code.** It is the behaviour a person
would want and the behaviour that costs the most at a provider, on a milestone whose provider
budget has never been measured against a real one.

### D4 — Delivery is a new message kind on an existing channel, and the worker is not in it

`protocol.ts` is already the one file both contexts read, and it already carries a request kind, a
matching narrowers on each side, and a `null` for every unrecognised shape. The fill adds one more
kind to that union and nothing else.

**The popup sends to the tab directly; the worker is not asked to relay it.** The worker knows
nothing about tabs, adding relay would put a tab id into a context whose requirement is that it hold
nothing after answering, and it would buy a second failure mode for no capability. The one thing
the content script cannot do — reach a provider — is not needed for a fill.

**One protocol hazard, and it is not hypothetical.** `chrome.tabs.sendMessage` without a `frameId`
is delivered to **every frame** in the tab. A page with an advertising iframe containing a field
that looks like a code field would receive the code as well. The mitigation is that the content
script which performs the fill SHALL be the top-level document's, and it SHALL refuse to fill when
it is not — cheap, and correct whether or not the delivery turns out to be as broad as documented.
**This repository has not measured per-frame delivery**; the check is defensive rather than a
response to an observation, and it is written down so nobody later reads the absence of a
measurement as an absence of the risk.

### D5 — A code field is recognised from named signals, and a numeric keypad alone is not one

The signals are stated in the requirement and they are narrow on purpose. `inputmode="numeric"`
requests a numeric keypad; it does not say what the number is, and quantity, price, card, telephone
and postcode fields all request one. **Requiring a name or id that identifies a code alongside it is
the whole restriction**, and `autocomplete="one-time-code"` outranks an inferred match because a
page stating a field's purpose is telling the truth about it in the one way a machine can read.

The alternative — fill whatever empty short input is nearest the focus — is the behaviour that puts
a discount code into a quantity box, and it is rejected for the reason the requirement gives.

### D6 — `insert.ts` is generalised, not duplicated

`insertAddress` becomes a function of a value rather than of an address. **A second writer would be
the defect this repository has recorded repeatedly**: two copies of "put a value in a field so the
page's own code sees it" drift, and the second copy is the one nobody re-measures against React.

The scenarios under the renamed requirement are restated over *any inserted value* rather than
duplicated per caller, so the property is checked once and both callers are covered by it.

### D7 — "Which field?" is asked in this extension's own surface, and nothing is filled first

Where several fields qualify and none is preferred, the person is asked. **The question is asked in
the page's shadow root**, because that is the only surface available at the moment of delivery and
because the alternative — filling one and asking afterwards — is a decision already taken.

The control is removed once the person chooses or dismisses it, so it obeys the same "no control
outlives its answer" rule the email affordance already carries.

### D8 — No new token, no new motion, and no boundary rule is exempted rather than rewritten

`packages/ui` gains nothing: the popup's new controls reuse the `control` classes the popup already
renders, and no entrance is added. **Its test count must therefore not move**, and a rise would
mean visual surface no capability describes.

No boundary rule is relaxed. The one this change could have provoked is the rule confining the
extension's platform global to a single module — `chrome.tabs` is read from the popup and the
content script, so the delivery has to go through the module that already owns the platform rather
than beside it. **That is the rule being worked with, not widened**, and widening it would be the
cheaper-looking option and the wrong one.

## Risks / Trade-offs

- **A page marks its code field in a way this change does not recognise** → the fill reports that it
  found no field rather than filling a wrong one; the signals are a requirement rather than a
  heuristic, so adding one is a spec amendment rather than a silent widening.
- **Several qualifying fields is common on real pages** → the person is asked rather than the
  extension choosing, which is slower and is the roadmap's own rule.
- **Per-frame delivery is documented but unmeasured here** → the top-frame check in D4, written down
  so its absence would be a decision rather than an oversight.
- **The user closes the popup mid-flow** → the fill happens on the click that triggers it, and the
  content script holds the control until the answer or a ceiling, so a report has somewhere to go.
- **A code is delivered into a page that is not the one the user is looking at** → impossible by
  construction: `currentWindow` names the active tab of the window the popup is docked to, and the
  content script answers with its own `href`, which the popup can report if it disagrees.
- **The extension's `host_permissions` list could grow to make delivery "supported"** → the
  manifest scenario fails the build, and D1 records that no permission is needed, so a growth would
  be unexplained rather than merely unnoticed.
