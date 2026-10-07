# Tasks

## 1. Measure before deciding (blocking — D2 and D4 depend on these)

- [ ] 1.1 Measure whether Chromium injects the declared content script **without** a matching entry
      in `host_permissions`, using the extension's own tier and a throwaway build. Record the
      observed outcome in `docs/PROVIDERS.md` §4 and in this change's `design.md` D2, including
      whether `host_permissions` had to move.
- [ ] 1.2 Measure whether assigning through the prototype's own `value` setter makes a
      React-controlled input report the address to the page's own state, in real Chromium on the
      built fixture. Record the observed outcome in `design.md` D4.
- [ ] 1.3 Confirm the content script cannot reach `chrome.storage` if 1.1 shows it is not granted,
      and record which of the two designs D3's direct read depends on. **A measurement that
      contradicts D3's premise is recorded here and acted on in D3, not worked around in the code.**

## 2. Build (D1)

- [ ] 2.1 Add `apps/extension/vite.content.config.ts` emitting one input as a self-contained IIFE
      with no chunking.
- [ ] 2.2 Add the second `vite build` to `apps/extension`'s build script, keeping
      `build:extension` as the single entry point so no command in this repository names only one
      of the two builds.
- [ ] 2.3 Assert the emitted file carries no module specifier and needs no second file. The
      requirement names the property; the assertion is in the extension's browser tier, reading the
      **built** file rather than the source.

## 3. The affordance

- [ ] 3.1 One module that reads the extension's `chrome` global and returns the storage area, used
      by **both** the popup and the content script. `main.tsx`'s note changes from "the only file
      that names `chrome`" to the claim that survives a second context.
- [ ] 3.2 The affordance, rendered into a shadow root carrying its own minimal stylesheet.
- [ ] 3.3 Email-field recognition from the three named signals, and nothing else.
- [ ] 3.4 Focus handling: appear on focus of an empty field, at most one on the page, removed on
      blur.
- [ ] 3.5 Insertion that reaches the page's own state, dispatching both `input` and `change`.
- [ ] 3.6 No form activation of any kind.

## 4. Manifest

- [ ] 4.1 Add `content_scripts` with the patterns the shipped surface matches, and whatever 1.1
      requires of `host_permissions`.
- [ ] 4.2 **Replace** the case in `manifest.spec.ts` that asserts no content script with one that
      asserts what the content script declares. Not deleted — the assertion is the point, and the
      amendment belongs here.
- [ ] 4.3 **Keep and extend** *"requests no permission no shipped surface uses"*, so whichever way
      1.1 resolves, a permission nothing uses still fails.

## 5. Browser tier (D8)

- [ ] 5.1 A fixture page under the extension's own test tree, holding a React-controlled input and a
      a plain one, served on loopback by the suite's `webServer`.
- [ ] 5.2 Cases for: appearance on focus, absence without focus, absence on blur, one at a time,
      absence on a non-email field, absence on a field holding text, absence with no stored mailbox,
      the address reaching the controlled input's state, the address reaching the plain input,
      both events reaching the page, the page's document text not growing the label, and the
      declared reach matching what the content script matches.
- [ ] 5.3 **A negative control per form**, and the confirmation that the collection rule in
      `extension-client` still fires — the suite's configuration changed, and a rule that reads a
      configuration must be shown to still read it.

## 6. Boundary rules

- [ ] 6.1 The content script names no platform storage API; it reaches storage through
      `packages/storage`. Both contexts read the global through the one module.
- [ ] 6.2 A positive control for every form 6.1 misses, and a negative control, because a
      negative rule with one control is how a gap ships.

## 7. Falsification

- [ ] 7.1 Every new assertion above is observed to fail, with the **intended** test named. A
      different failing test is a distinct outcome, not a catch.
- [ ] 7.2 `nocompile`, `green`, `wrongcatch`, `noop` and `harness-error` are recorded as
      themselves. A mutation that cannot compile is not evidence about an assertion.
- [ ] 7.3 A mutation removing the *prototype setter* — keeping the direct assignment — must be
      caught by the controlled-input case. If it is not, the controlled-input case is a proxy and
      is rewritten rather than reported as coverage.
- [ ] 7.4 A mutation making the affordance render as ordinary page content (no shadow root) must be
      caught, and one making it overlay every field permanently must be caught.
- [ ] 7.5 Restoration verified by SHA-256 for every mutated file, and `dist/` rebuilt from the
      restored source.
- [ ] 7.6 The harness scripts live outside the repository tree. `pnpm lint` rejects a root `.cjs`,
      and a measuring instrument left in the root becomes something every future lint has an
      opinion about.

## 8. Gates

- [ ] 8.1 `pnpm verify` — with `PLAYWRIGHT_BROWSERS_PATH` pointed at an empty directory, so the
      claim stays that every gate runs with no browser installed. Run it more than once; a single
      green is a fact about one execution.
- [ ] 8.2 `pnpm test:browser`, ten consecutive runs, counting failures. The precedent is one run in
      three failing on a weak precondition.
- [ ] 8.3 `openspec validate in-page-address --strict`.

## 9. Documents

- [ ] 9.1 `docs/PROVIDERS.md` §4 gains the 1.1 and 1.2 measurements, with what each does not
      establish beside it.
- [ ] 9.2 `docs/ROADMAP.md`: the M9 slicing decision and the cursor.
- [ ] 9.3 `AGENTS.md`: the reconciled header, the extension's stack entry, the browser tier, the
      counts, and the CI record.
- [ ] 9.4 Correct every task above that predicted a count and is wrong about it **in place**.

## 10. Deliberately not ticked

- [ ] 10.1 **Open the extension on a real site and look at the affordance.** No test in this
      repository reads a rendered pixel's colour or position, so how the control looks inside
      somebody else's page is outside every gate here — and D7 makes that gap larger than usual,
      because the surface under test is a third party's CSS. An agent opening a page is not the
      judgement this task asks for.
