# Firefox compatibility spike — design

## D1 The measurement is the deliverable, and the instrument is not a test

**This change ships a measurement and a record, and the code it ships is an instrument rather than
a feature.** That is the house pattern, twice over: `alarms-packing-interval.mjs` and
`side-panel-runtime.mjs` are both quarantined scripts under `apps/extension/e2e/`, both are listed
in `QUARANTINED_PROBES`, and **both exist because a measurement cannot be a suite** — a suite
asserts a property, and what Firefox does is not a property of this repository.

**So the instrument is a script, it is quarantined, and the list of quarantined probes grows by
one.** The boundary rule that covers the list already checks that each probe names the live check
it needs — **and that rule is what keeps a new probe from being a file nobody reasons about.**

## D2 The measurement's first question is reachability, and it is asked first

**Not *does the side panel work* but *can Firefox be reached*.** The order matters, because the
second question's answer differs depending on the first's:

- **If Firefox cannot be reached**, then *does Firefox accept the manifest* is unanswerable here,
  and the manifest work is guesswork about a platform this repository cannot observe.
- **If Firefox can be reached**, then the manifest's three asks are each measured rather than
  assumed, and the side panel's question is asked of a real Firefox.

**So the instrument tries the routes in order and reports which one worked:** a profile carrying the
add-on, an unsigned XPI with `xpinstall.signatures.required` off, a Firefox-shaped manifest, and
**a further route if a third fails** — because *a route that fails is a fact about that route and
not about Firefox*, and the instrument has to say which.

**And every route's result is read from Firefox's own record of the add-on** — the `uuid` it
assigns, and the reason it gives for a refusal. **The first version of this instrument read the
record from the wrong path** — `<profile>/extensions/extensions.json` rather than
`<profile>/extensions.json` — **and so reported *the add-on was not installed* for a profile where
the answer was simply not looked for.** **A reader that matches nothing reports the absence of the
thing it looked for**, and that is the shape this repository has recorded more than once.

## D3 The manifest's three asks, and which of them is a decision rather than an adaptation

| the manifest says | the question it raises |
| --- | --- |
| `permissions: ["storage", "alarms", "notifications", "sidePanel"]` | **which permissions does Firefox have?** `storage`, `alarms` and `notifications` exist; `sidePanel` does not. **An unknown permission is a manifest error, not a missing feature** — so this is the ask most likely to make Firefox refuse the extension outright. |
| `side_panel: { "default_path": "sidepanel.html" }` | **is the panel a surface or a feature?** Firefox's `sidebar_action` is a **docked sidebar with no `open()` API** — so *the side panel* has no Firefox equivalent and *a panel* has a different one. **That is a product decision, not a compatibility shim**, and the record must present it as one. |
| `background: { "service_worker": "service-worker.js", "type": "module" }` | **can the background be an event page?** Firefox's MV3 background is `background.scripts`. The service worker's own assumptions — *it is one worker, it can be terminated, it holds the record* — are what this repository already has to reason about, so the question is what an event page changes about them. |

**And the content script's reach is a fourth question the manifest does not show:** `matches` is
`http://*/*` and `https://*/*`, and `host_permissions` names two provider origins. **Firefox's
permission model for host access differs in shape** — and the extension reads its own storage and
sends its own messages, so the question is what the *namespace* covers, which is the next section.

## D4 The eleven capabilities, and the difference between a missing method and a changed shape

**`extension-platform.ts` is the seam, and it exports eleven capabilities.** The roadmap's rule —
*"keep platform-specific differences behind small compatibility layers"* — has its home, and **the
boundary rule already confines the platform global to exactly this one module**, so the layer has
nowhere else to leak.

**The measurement is per capability, and it asks two questions of each:** *is it there* and *what
shape is it*. **The shape is the half that is easy to miss.** Firefox's `browser` namespace is
promise-based and Chromium's `chrome` namespace is callback-based, so a capability that exists in
both can **fail differently**: a `chrome.tabs.query` that takes a callback has a
`browser.tabs.query` that returns a promise, and **the extension's own code awaits the Chromium
shape**. So the compatibility layer's work is not *find the missing methods* — **it is *find the
ones whose calling convention differs***, and a measurement that records only presence would miss
every one of them.

**So the instrument asks each capability for its presence and its return shape, and the record
says which of the eleven are absent, which differ in shape, and which are the same.**

## D5 The record's shape, and why it is a document rather than a table in a commit message

**`docs/PROVIDERS.md` is the house pattern for a platform's measured behaviour** — §4.1 the rate
limits, §4.4 the CORS reach, §4.5 the notifications, §4.6 the side panel, and **each section says
what was measured, on what, and what it does not establish.**

**So the measurement lands in `docs/` in that shape, and the section names what the *extension*
needs rather than what Firefox has in general.** *"Firefox has `browser.tabs`"* is not this
repository's business; *"the extension's eleven capabilities, measured, and the four that differ"*
is.

**And the record says what the measurement does not establish** — because that is the half that
keeps the next slice honest, and because the repository's own standard is that a red which appears
and disappears without the tree changing is a red that means nothing.

## D6 The requirement, and what it forbids

**The capability is `browser-verification`, and its requirement *"What the browser tier
establishes is stated, not assumed"* is the one that carries this.**

**The amendment says three things, and each forbids a specific shortcut:**

1. **A claim about an engine is made per engine.** *"The browser tier establishes"* names the
   engines it ran, and **a second engine adds a second set of claims rather than widening the
   first** — because *"verified in Chromium and Firefox"* is a phrase that means *"verified
   somewhere"*.
2. **An engine the tier cannot reach is named as unreachable.** **Not omitted, and not called
   unsupported** — *unreachable* is a fact about this repository's automation, and *unsupported* is a
   claim about the product.
3. **A measurement of a route is a measurement of that route.** A route that failed is evidence
   about the route, and the record must not carry it as evidence about the engine.

**And the amendment is a `MODIFIED` rather than an `ADDED`, because the requirement already carries
the property** — the spike's job is to *extend* it to the second engine, and **an `ADDED` sibling
would be two requirements about one subject, which is the shape this repository has recorded as a
second spelling of a set.**

## D7 What this change deliberately does not do

- **It does not ship a Firefox build.** The spike measures; the build is a later slice, and its
  shape depends on what the measurement found.
- **It does not decide whether to support Firefox.** **That is a product decision**, and the spike's
  job is to put the decision's inputs in front of whoever makes it.
- **It does not add a second browser project.** The tier is Chromium-only **for a measured reason**,
  and **the reason is re-measured before the answer changes.**
