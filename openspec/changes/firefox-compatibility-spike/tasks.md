# Firefox compatibility spike — tasks

## 1. The instrument

- [ ] 1.1 A quarantined script under `apps/extension/e2e/`, **outside the suite**, named for what it
      measures — and **listed in `QUARANTINED_PROBES`**, because the list is what keeps a new probe
      from being a file nobody reasons about.
- [ ] 1.2 It SHALL read Firefox's **own record of the add-on** — the `uuid` it assigns and the reason
      it gives for a refusal — **and not a path of our own choosing.** **The first version of this
      instrument read the record from `<profile>/extensions/extensions.json` rather than
      `<profile>/extensions.json`, and so reported *the add-on was not installed* for a profile where
      the answer was simply not looked for.** **A reader that matches nothing reports the absence of
      the thing it looked for.**
- [ ] 1.3 It SHALL try the routes **in order** and say **which one worked**: a profile carrying the
      add-on, an unsigned XPI with `xpinstall.signatures.required` off, a Firefox-shaped manifest,
      and **a further route if a third fails** — because **a route that fails is a fact about that
      route and not about Firefox.**
- [ ] 1.4 The instrument SHALL be **outside the repository** while it is being written, and its
      findings land in the record — **because a measuring instrument is not a shipped file**, and this
      repository's own rule says so.

## 2. What the measurement establishes

- [ ] 2.1 **Whether Firefox can be made to install this extension at all**, and by what mechanism a
      build could rely on. **Measured so far: Playwright's Firefox launches here and reports 155.0,
      and the extension did not install by the first two routes tried.**
- [ ] 2.2 **Whether Firefox accepts the manifest as shipped**, and **which** of the three asks it
      refuses — the `sidePanel` permission, the `side_panel` key, or the `background.service_worker` —
      **so the first compatibility change is named rather than guessed.**
- [ ] 2.3 **Which of the eleven platform capabilities Firefox's namespace covers**, and **with what
      shape**: a promise-based `browser` namespace against a callback-based `chrome` one is **a changed
      signature and not a missing method**, and **a measurement that records only presence would miss
      every one of them.**
- [ ] 2.4 **The side panel's shape question**, stated as a product decision and not a compatibility
      shim: Firefox's `sidebar_action` is a docked sidebar with no `open()` API, so **the side panel
      has no Firefox equivalent and a panel has a different one.**

## 3. The record

- [ ] 3.1 A section in `docs/`, in the shape `docs/PROVIDERS.md` uses — **what was measured, on what,
      and what it does not establish** — and **naming what the *extension* needs rather than what
      Firefox has in general.**
- [ ] 3.2 The record SHALL say **which route worked and which did not**, and **that a route that
      failed is evidence about the route** — not about the engine.
- [ ] 3.3 The record SHALL say **what the measurement does not establish**, because **that is the half
      that keeps the next slice honest.**
- [ ] 3.4 The record SHALL name the **outcome's two branches** — *Firefox is reachable* and *Firefox
      is not reachable* — **and what each makes of M14**, so the next slice's shape is not a guess.

## 4. The requirement

- [ ] 4.1 A `MODIFIED` on `browser-verification`'s **"What the browser tier establishes is stated,
      not assumed"**, and **not an `ADDED` sibling** — because the requirement already carries the
      property, and **two requirements about one subject is the shape this repository has recorded
      as a second spelling of a set.**
- [ ] 4.2 The amendment SHALL say that **a claim about an engine is made per engine** — **a second
      engine adds a second set of claims rather than widening the first**, because *"verified in
      Chromium and Firefox"* is a phrase that means *"verified somewhere"*.
- [ ] 4.3 The amendment SHALL say that **an engine the tier cannot reach is named as unreachable** —
      **not omitted, and not called unsupported**, because *unreachable* is a fact about this
      repository's automation and *unsupported* is a claim about the product.
- [ ] 4.4 The amendment SHALL say that **a measurement of a route is a measurement of that route.**

## 5. The gate

- [ ] 5.1 `pnpm verify` — exit `0`, three times, with `PLAYWRIGHT_BROWSERS_PATH` pointed at a
      directory measured empty.
- [ ] 5.2 The instrument's own run is **recorded with its output**, and **a run that produced no
      answer is a harness error and not a measurement** — because the first version of this
      instrument produced *the add-on was not installed* for a profile where it had looked in the
      wrong place.
- [ ] 5.3 `openspec validate --specs --strict` — **15 passed, 0 failed**.

## 6. What the change does not establish

- [ ] 6.1 That Firefox is supported, or that it will be. **The spike measures; the product question
      is somebody else's.**
- [ ] 6.2 Anything about Firefox's behaviour beyond what the instrument measured. **A measurement of
      one route is a measurement of one route.**
- [ ] 6.3 That the two outcomes are the only ones. **The measurement is the first of them, and the
      record says so.**
