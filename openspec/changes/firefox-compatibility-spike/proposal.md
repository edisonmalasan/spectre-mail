# Firefox compatibility spike

## Why

**The roadmap's M14 assumes Firefox is a matter of adapting a manifest, and the measurement says the
first question is not what to adapt but whether this repository can reach Firefox at all.**

`docs/ROADMAP.md`'s M14 lists six things to adapt — *manifest differences, browser namespace
differences, permissions, side-panel equivalent strategy, notification behavior, store requirements* —
and the first of them is the smallest-seeming. Measured, it is not.

### Measured, here, on 2026-10-21

**1. Playwright's Firefox is present and launches.** `firefox-1543` and `firefox-1555` are in the
local browser cache, and `firefox.launch()` reported **155.0**. **So the absence of a Firefox in
this repository is not the obstacle.**

**2. The extension does not load into it by the route the extension tier uses.** Chromium's route is
`--load-extension`, a flag only Chromium has, and the extension's own configuration says so:

> *"**Chromium only**, for the same reason the website's config says it — `--load-extension` is a
> Chromium flag. **No other engine here has it**, and the honest form of this claim is *"verified in
> Chromium"* rather than *"verified in a browser"*."*

**3. The extension did not install, by either of the two routes this repository can reach.**
Firefox's own record of the add-on held **no `uuid`** — which is Firefox's way of saying it
**never read the manifest**.

- **Route one: a profile carrying the add-on**, with the record hand-written into it. Firefox
  **left the record exactly as written**, with no uuid.
- **Route two: an unsigned XPI with `xpinstall.signatures.required` off**, dropped into the
  profile's `extensions/` directory — **the route a developer would take**, and the one a build
  could rely on. **Firefox installed nothing**, and the record says so.

**And one of those measurements was wrong before it was right, and the way it was wrong is worth
recording.** The first version of the instrument read the record from
`<profile>/extensions/extensions.json` rather than `<profile>/extensions.json`, **and so reported
*the add-on was not installed* for a profile where the answer was simply not looked for.**
**A reader that matches nothing reports the absence of the thing it looked for** — and that is the
shape this repository has recorded more than once.

**4. And the manifest asks for three things Firefox has no equivalent for as written:**

| the manifest says | Firefox's equivalent |
| --- | --- |
| `permissions: ["storage", "alarms", "notifications", "sidePanel"]` | no `sidePanel` permission |
| `side_panel: { "default_path": "sidepanel.html" }` | `sidebar_action`, a **different surface** |
| `background: { "service_worker": "service-worker.js", "type": "module" }` | `background.scripts`, an event page |

**An unknown permission is a manifest error rather than a missing feature**, so the three asks are
not three adaptations — they are three things that have to be *decided*, and one of them is a
surface rather than an API.

**5. And the compatibility seam already exists and is one file.**
`apps/extension/src/extension-platform.ts` is **709 lines** and exports **eleven** capabilities —
storage, messaging, tabs, notifications, alarms, asset URLs, browser start, tab activation, alarm
firing, the active tab, the local area. **The roadmap's *"keep platform-specific differences behind
small compatibility layers"* has a home, and it is the one module the boundary rule already
confines the platform global to.**

**⇒ So the compatibility work has a seam to live in, the manifest has three asks to decide, and the
measurement says the tier cannot currently reach the engine at all.**

## Why this is a change and not a task

**Because the answer decides the shape of every implementation slice that follows, and it is not
known.**

**There are two outcomes, and they are not variations on one plan:**

- **Firefox can be reached by a mechanism a build can rely on.** Then M14's implementation is a
  matter of a compatibility layer over the eleven capabilities, a second manifest, and a second
  browser project — **and the second project must make its own claims, per engine**, because the
  repository's own rule is that *adding a project per engine would turn "verified" into "verified
  somewhere" without adding evidence about the claim.*
- **Firefox cannot be reached by this repository's automation.** Then **the extension can be built
  for Firefox and cannot be verified in it here**, and **the honest claim is a second build and not
  a second verification** — which is a materially different thing to ship, and one a person should
  choose rather than a measurement discover by accident.

**And the repository's own rule is that this is what a spike is for.** `alarms-packing-interval`
measured when Chromium *fires* an alarm rather than what the API stores, and
`side-panel-runtime-facts` measured whether a side panel can be opened and run. **Both were
measurement changes whose output decided the implementation that followed**, and both were
quarantined instruments outside the suite.

## What ships

1. **The measurement**, by a quarantined instrument outside the suite, establishing four things:
   - **whether Firefox can be made to install this extension at all**, and by what mechanism a build
     could rely on;
   - **whether Firefox accepts the manifest as shipped**, and **which** of the three asks it
     refuses — so the first compatibility change is named rather than guessed;
   - **which of the eleven platform capabilities Firefox's namespace covers**, and **with what
     shape** — because a promise-based `browser` namespace against a callback-based `chrome` one is a
     changed signature and not a missing method, and the two fail differently;
   - **the side panel's shape question**, which is a product decision rather than a compatibility
     shim: Firefox's `sidebar_action` is a docked sidebar with no `open()` API, so *"the side panel"*
     has no Firefox equivalent and *"a panel"* has a different one.
2. **The record**, in `docs/`, so the implementation slices that follow are based on measurements
   rather than on a table of differences remembered from elsewhere.
3. **A requirement amendment**: a claim about an engine is made **per engine**, and an engine the
   tier cannot reach is **named as unreachable**. **The phrase *"verified in Firefox"* is not one this
   repository uses without a measurement behind it.**

## What this does not establish

- **Anything about Firefox's behaviour beyond what the instrument measured.** A measurement of one
  route is a measurement of one route.
- **That Firefox is supported, or that it will be.** The spike measures; it does not decide the
  product question of whether to ship to Firefox at all.
- **That the two outcomes are the only ones.** The measurement is the first of them, and the record
  says so.
