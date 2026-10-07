# Design

## Context

M9 slice 1. The extension has a manifest, a popup, and a background service worker; it has no
content script, and `extension-client` records that absence as a requirement with an owner. This
change adds the surface and amends the requirement that forbade it.

The facts below were read out of the repository rather than assumed, and each is cited so a later
change can tell whether it still holds.

- **`apps/extension/static/manifest.json` declares** `"permissions": ["storage"]`,
  `host_permissions` for exactly the two provider origins, a `background` service worker, and an
  `action` default popup. There is **no `content_scripts` key and no `activeTab` permission**.
- **`apps/extension/e2e/manifest.spec.ts` asserts two absences today**: that no permission is
  requested that no shipped surface uses (`expect(manifest.permissions).toEqual(["storage"])`), and
  that the manifest *"declares no content script and no side panel"*. Both are consequences of a
  deliberate absence and **both become false the moment this change lands**.
- **`apps/extension/src/main.tsx` is documented as "the only file that names `chrome`"**, and it
  obtains the storage area through `Reflect.get(Reflect.get(globalThis, "chrome"), "storage")?.local`.
  The boundary rule's pattern is `chrome\s*\.\s*storage\b`, so the member-expression spelling is
  forbidden under `apps/` and the `Reflect.get` idiom is how the client reads the global without
  tripping it. **A content script is a second context that needs the same read**, so "one file"
  becomes either two copies or one shared module.
- **`packages/storage/src/chrome.ts` exists** and already adapts `chrome.storage.local`, so the
  adapter the content script needs is written and tested. **`spectre-storage` is a
  three-operation contract** — `loadMailbox`, `saveMailbox`, `clearAll` — and the site association
  M9 also wants is **not in it**.
- **`apps/extension/vite.config.ts` builds two inputs** as ES modules with `format: "es"`. Its
  module note is headed *"Three entry points, and why the worker is separate"* while the config
  declares two — a prose claim the code does not carry, which is this repository's recorded defect
  class, and this change is what makes the sentence true.

## Goals / Non-Goals

**Goals**

- The extension offers an address **inside an email input on an ordinary web page**, and the
  address becomes what the page's own framework believes the field contains.
- The surface is added by **amending** `extension-client`'s non-goals requirement, in this change,
  as that requirement's own scenario requires.
- Slice 1 depends on **no platform behaviour this repository has not measured**: no cross-origin
  request, no message round trip, no service-worker lifetime, no `chrome.alarms`.

**Non-Goals**

- **Creating a mailbox from a page.** That is slice 2, and it is where the worker's lifetime and
  the provider request become load-bearing.
- **The site association** (`hostname → mailbox`), which is a second stored record kind and a
  contract decision. Slice 3.
- **The three-way choice** the roadmap's UX rules list — current, new, recently used for this site.
  It is slice 2's and slice 3's, and a control offering one option under a three-option label is
  the misreporting this repository refuses.
- **The side panel, the notification, and any code copy-or-fill control.** M11's and M10's; they
  stay forbidden and stay asserted.

## Decisions

### D1 — The content script is a second build, not a third input to the first

**A Manifest V3 content script is a classic script.** It has no `"type": "module"`, it cannot
resolve a bare specifier at runtime, and it cannot code-split: a chunk the platform never loads is a
script that throws before its first line. The existing build emits `format: "es"` and permits
`chunks/[name].js`, which is exactly what a content script may not be.

Making it a third input of the same build would need Rollup's `output` as an **array** (so the two
entries can differ in `format`) plus per-entry chunk control so the content-script entry does not
inherit `chunkFileNames`. That is achievable, and it is how a content script would be built if this
client had three of them.

**This one is emitted by a second `vite build` with its own config**: one input, `format: "iife"`,
no chunking, and an assertion that the emitted file is a single self-contained script. The cost is
one more line in the package's build script. The benefit is that the property that matters — *one
file, no imports, no chunks* — is **checkable**, rather than a consequence of two overlapping
`output` entries that a future edit could quietly unpick.

**`design.md` records the check rather than assuming it**, because "the content script bundle is a
single classic script" is the kind of claim that is true on the day it is written and false after
someone adds an import.

### D2 — The host permission is a consequence of a measurement, not the thing being measured

Slice 1 needs no cross-origin request. So the question is only whether Chromium injects a declared
content script whose `matches` are broad **without** a matching entry in `host_permissions`, or
whether it requires one.

Both halves are recorded before implementation:

- **If Chromium injects without a new host permission**, `host_permissions` stays exactly the two
  provider origins and `"permissions"` stays exactly `["storage"]`. That is the smaller surface,
  and it is the outcome to prefer.
- **If Chromium requires the host permission**, it is added — and the change records **why**, because
  an install prompt reading *"read and change your data on all websites"* is a real cost and it is
  paid only when a measurement says the alternative does not work.

**Measured during apply (2026-10-07): the first branch is the one that happened.** Chromium injects a
declared content script whose `matches` cover the origin **without** a matching `host_permissions`
entry, and `chrome.storage.local` is readable *and* writable from the content script on the `storage`
permission alone. So `permissions` stays exactly `["storage"]` and `host_permissions` stays exactly the
two provider origins. The measurement, its harness, and the controls it ran are recorded in
**Measurements recorded during apply** below.

**`activeTab` is rejected, and the reason is that it does not match the roadmap's UX rule.**
`activeTab` is granted by an action click, a context-menu item, or a keyboard command — **not by
focus**, and the affordance must appear on focus. Choosing `activeTab` would mean choosing an
extension-icon-initiated affordance over the one the roadmap asks for, which is a scope decision
rather than an implementation detail, and it is the slice-2-or-later conversation rather than this
one.

**No requirement states which permission is declared.** The requirement states that the extension
SHALL declare whatever host reach the shipped surface needs **and no more**, which is the property
that survives either measurement outcome. The existing browser assertion — *"requests no permission
no shipped surface uses"* — is **kept and extended**, not replaced, because it is the assertion that
catches a permission nobody uses whichever way the measurement goes.

**What the measurement was taken against, and one thing it cannot speak to at all.** It was an
**unpacked** extension in the Chromium build Playwright `1.63.0` installs (`chromium-1243`), on one
machine, and that is the whole of the evidence — **the Chromium version behind that revision was not
looked up, so none is quoted here**: `docs/PROVIDERS.md` §4.2 carries the harness and §4.3 re-asks
the question of the **built** `dist` over both declared schemes. **Distribution review is not covered
by any of it, and this paragraph deliberately asserts nothing about how a store would treat the
shape** — a `content_scripts.matches` reaching every http and https origin while `host_permissions`
names only two is exactly the kind of mismatch a reviewer's rules speak to, **and those rules were
not read, quoted, or measured here.** This repository has no release pipeline and no packaging
target, so there was nothing to measure against; the sentence is recorded because the mismatch is
**real and visible in the manifest**, and the next reader should meet it as a known open question
rather than discover it at packaging time. **It is not a defect in this slice**, whose requirement is
about the *shipped surface's* reach and which is asserted from both directions — the manifest declares
nothing the suite does not script, and the suite scripts nothing the manifest does not declare.

### D3 — The content script reads storage through `packages/storage`, and one module reads the global

A content script holds the extension's `storage` permission, so `chrome.storage` is available in
it. The client may not *name* it — `CLIENT_STORAGE_API_PATTERN` matches `chrome\s*\.\s*storage\b`
across `apps/` — and the adapter that can use it already exists in `packages/storage`.

So: the content script calls `createExtensionStorage(area)` exactly as the popup does, and the area
comes from the **same module both contexts use**. `main.tsx`'s note that it is *"the only file that
names `chrome`"* becomes *"the only module that reads the extension's `chrome` global"* — which is
the claim that survives a second context, and which is the difference between one reader and two
readers that must be kept in agreement.

**Why this rather than a message to the service worker**, which would work and would be the obvious
design: the worker route makes slice 1 depend on three things this repository has not measured —
whether a terminated worker wakes for a message, whether `sendMessage` survives the round trip, and
whether the worker holds the address the popup last saved. **The direct read needs none of them.**

### D4 — The mechanism is here; the property is in the spec

React keeps an input's value in a tracker hung on the DOM node, and `input.value = x` updates what
is painted without touching that tracker. A field filled that way submits empty. Reaching a
controlled component therefore means assigning through the prototype's own `value` setter — obtained
from `Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")` — and then dispatching
the events the page's own input handling listens for.

**Amended by measurement during apply (2026-10-07): the prototype setter turned out not to be
necessary on React `19.3.0`, and the events turned out to be the whole mechanism.** Three arms were
run against a real controlled input and all three are recorded below. What survives:

- The setter is now **defensive rather than load-bearing**. A framework that maintains its own value
  tracker is precisely the case where direct assignment fails, and none has been measured here, so the
  cheaper-looking arm is kept and its cost is stated as what it is.
- **Dispatching the events is the load-bearing half**, and that is now an observation rather than a
  recollection: assigning the value and dispatching nothing left React's state empty while the field
  painted the address. That is the failure this requirement exists to prevent, and it was reproduced.

**One platform fact this decision now depends on, measured here and easy to get wrong: a content
script cannot read a page's JavaScript globals.** Its `globalThis` is the isolated world, so *"the
page's own code reads back the address"* is observed through the **DOM** — a page rendering its own
state into the document — and never by reading a variable off the page.

**The requirement states the property**: the address becomes the value the page's own state holds,
which is observable as *"the page's own code reads back the address"*. **This file holds the
mechanism**, because a requirement naming a setter fails any correct implementation that used a
different one, and would then be "fixed" by editing the requirement instead of the code — the same
trap `extension-preview`'s D3 amendment records from the other direction.

**Both event types are dispatched, and the reason is measured rather than remembered:** a
React-controlled input listens for `input`, while plain-DOM and many libraries also read `change`.
Dispatching only one leaves the address invisible to half the forms this will meet.

### D5 — The affordance is absent when this device has no stored mailbox

The roadmap's "Allow using: current mailbox / new mailbox / recently used mailbox for that site" is
a three-option control. Slice 1 implements **one** of the three.

A control labelled as a choice and offering one option is the misreporting this repository refuses,
and a control whose only reachable answer is *"there is not one yet"* is the control-that-cannot-act
defect in its purest form: it appears, it is operable, and pressing it cannot do the thing it
promises. So **with nothing stored, no control appears at all.**

The requirement records this as a **forward constraint** rather than a note about today, so a
change that adds creation is *required* to amend it rather than silently finding a control already
there and leaving its empty case broken.

### D6 — The affordance lives in a shadow root, and the page cannot reach its styles

A control injected into somebody else's page inherits that page's cascade: `* { display: none }`, a
reset, a `transform` on an ancestor, a `z-index` of 0 behind a modal. None of that is a bug in
this extension and all of it would make the affordance unusable on a real site in a way no unit
test can see.

The affordance is therefore rendered into a **shadow root**, carrying its own minimal stylesheet.
Two consequences are requirements rather than implementation notes, because each is a way the
isolation can quietly stop being true:

- **the page's own styles SHALL NOT reach it**, and
- **the affordance SHALL NOT be reachable as the page's ordinary content** — the page's document
  text does not grow a `Use SpectreMail` string.

The second is the one worth a scenario, because "it is visually separate" and "it is separate in the
document" are different properties and only the second is checkable from outside.

### D7 — No token, no motion, and `packages/ui` untouched

The affordance is a control in somebody else's page, styled minimally in its own shadow root. It
draws no colour, radius, spacing step, type size, or duration from `packages/ui`, so D6's shadow
stylesheet is self-contained and **`packages/ui` holds at 38 tests** — the same check M7 slice 4
used, and the reason it is stated as a decision rather than left as a prediction.

**What this costs, stated plainly:** an affordance injected into arbitrary third-party pages has no
visual-design milestone behind it here, and its appearance is not verified by any gate in this
repository — no test reads a rendered pixel's colour or position. That is the standing fourth
limit, and here it is larger than usual because the surface under test is somebody else's CSS. A
human opening a real site is the only instrument for it.

### D8 — The browser tier needs a real page, and its own harness cannot reach one today

The extension's suite loads `apps/extension/dist` as an unpacked extension through
`chromium.launchPersistentContext` and **has no `webServer` at all**, because every case so far
drives the popup or the worker. A content script has to be injected *into a document*, and
`about:blank` is not a document a content script's `matches` will cover.

So this change adds a **fixture page served by the extension's own suite**, and the suite gains a
`webServer` — which is a change to the extension's runner configuration that
`extension-client`'s collection rule **reads rather than hard-codes**, so the rule is exercised by
this change rather than bypassed by it.

The fixture is a **local file under the extension's own test tree**, served by a static server on
loopback, holding a React-controlled input and a plain one. Two inputs, because *"the address
reaches the framework's state"* and *"the address reaches the field"* are different claims and the
second must not be able to satisfy the first.

### D9 — The affordance appears only on a field that is empty

The roadmap's UX rule is *"Never overwrite existing text without user action"*, and the two ways to
satisfy it are to overwrite on a click and to not offer anything at all.

**The second is chosen**, and the reason is the one D5 already gave: pressing a control that replaces
a half-typed address is a data-loss gesture wearing a helpful label, and a user who has typed part
of an address and then pressed a SpectreMail button has asked for something ambiguous. Making
absence the answer removes the ambiguity rather than resolving it, and it turns *"never overwrite"*
from a behaviour to check into a **condition under which the control does not exist**.

**This is a second condition for absence, not a replacement of D5's** — a field is offered only
when it is empty *and* this device holds an address. Both are recorded as requirements, so the
change that adds creation amends one of them deliberately rather than finding the empty case
already handled.

**What it costs, stated plainly:** a user with a typo in the field has no in-page way to replace it,
and clearing the field costs one keystroke. That is the cheaper of the two mistakes.

## Risks / Trade-offs

- **The affordance appears in every page the user visits.** That is inherent to in-page
  integration and is the roadmap's explicit ask. The mitigations are the two the roadmap names and
  this change implements: **focus, not permanent overlay**, and **one control at a time**, removed
  when the input loses focus.
- **A broad content-script match pattern is a real install-time prompt.** D2 defers the permission
  question to a measurement, and D2's requirement form is written so the *measurement's* answer
  cannot make the requirement wrong.
- **Slice 1 delivers one of the roadmap's three options** and is therefore narrower than M9's
  behaviour block. That is the slicing decision stated at the top, not a shortfall hidden at the
  end, and slices 2 and 3 are named in the Non-Goals with the reason each is deferred.
- **The shadow-root isolation is a structural claim, not a visual one.** D6's requirements are
  checkable from outside; whether the control *looks* right inside somebody else's page is not, and
  no requirement here claims it is.

## Migration Plan

None. No stored state, no schema, no data. The extension gains a context that reads storage it
already owns; nothing stored by any earlier build is reinterpreted.

## Open Questions

- **Whether the site association belongs in `spectre-storage`.** Its contract says in its own
  opening that it has room for one record kind and that the rest are *"a schema to migrate rather
  than a feature"* — which is an argument that a record kind **with a consumer** belongs. Slice 3
  has to answer it, and the answer changes a shared package rather than only a client.
- **Whether slice 2's mailbox creation must go through the service worker at all.** D3 shows a
  content script *can* reach `chrome.storage`; whether it can reach `https://api.mail.tm/*` under
  MV3's rule that a content script's `fetch` is subject to the **page's** CORS policy is a
  platform fact this repository has not measured, and it decides the whole shape of slice 2.
- **Whether `chrome.action.openPopup()` is the right way to offer creation from a page.** It needs
  a user gesture and a recent Chromium, and slice 2 should measure rather than discover.

---

# Measurements recorded during apply (2026-10-07)

Tasks 1.1-1.3 were blocking, so they ran before any product code. The harness lives **outside the
repository tree**, in `%TEMP%\opencode\inpage-probe`, because `pnpm lint` rejects a root `.cjs` and
a measuring instrument left in the root becomes something every future lint has an opinion about.

Chromium is the full `channel: "chromium"` binary, launched through `chromium.launchPersistentContext`
with `--load-extension` **and** `--disable-extensions-except` — the four-flag fact this repository
already recorded. The extension was confirmed loaded before any result below was read, by waiting for
its service worker to register: an extension whose declared background script is missing **does not
load at all**, and the first run of this harness omitted `sw.js` and so read as a platform fact when it
was a manifest defect.

**The fixture is a real React `19.3.0` app**, bundled with `esbuild` from the workspace's own copy.
React 19 ships no UMD build, so a hand-written mimic of a controlled input would have been a proxy for
the thing under test.

## D2 — measured: **no new host permission is required**

With `content_scripts.matches` set to `["http://127.0.0.1/*"]` and `host_permissions` left at exactly
the two provider origins:

| Observation | Result |
| --- | --- |
| Content script injected | **yes** |
| `chrome.storage.local` read **and** write | **yes**, on the `storage` permission alone |
| Written value read back | `written-by-content-script` |

**So the manifest keeps `permissions: ["storage"]` and keeps `host_permissions` at the two provider
origins.** D2's preferred branch is the one that happened, and the requirement was written so that
either branch would have satisfied it. `activeTab` stays rejected, and the reason it gave still holds:
focus is not a gesture `activeTab` recognises.

**D3's premise is confirmed by the same run:** a content script holds the extension's `storage`
permission, so the direct read works and slice 1 needs no message round trip to a service worker whose
lifetime is unmeasured.

## D4 — measured: **the prototype setter is NOT what makes it work; the events are**

Three arms, all against a real controlled input (`value` + `onChange`), all reading back what React
rendered:

| Arm | What was done | React's own state afterwards |
| --- | --- | --- |
| Prototype setter + `input` + `change` | D4's original mechanism | **updated** |
| **Direct `input.value = x` + both events** | the control | **also updated** |
| Prototype setter, **no events dispatched** | the control | **not updated** |

**Two consequences, and the first one is a design amendment.**

**1. The prototype setter is unnecessary on React `19.3.0`, so D4's mechanism is withdrawn.** A plain
assignment reaches the controlled component's state exactly as well. The requirement stated the
*property* rather than the mechanism, and that is now the difference between a change whose
requirement survived its own measurement and one that would have had to be edited to accommodate it.

**2. Dispatching the events is what makes it work, and that is now measured rather than remembered.**
The third arm changed the painted value and left React's state empty — a field that looks filled and
submits empty, which is the failure D4 exists to prevent. D4's requirement that **both** `input` and
`change` be dispatched stands, and it now stands on an observation: dropping the events is what breaks
it.

**What this measurement does not establish.** It is one controlled-input shape, on one React version,
in one browser. It says nothing about Vue, Svelte, or any framework that keeps its own tracker, and a
framework that *does* maintain a value tracker is precisely the case where direct assignment fails and
the prototype setter matters. **So the implementation keeps the prototype setter** — it costs one
`getOwnPropertyDescriptor` call, it is what makes the arm that failed here pass on a framework whose
tracker would reject the direct assignment, and it is the arm with no measured downside. What the
measurement changed is the *justification*: it is defensive, not load-bearing, and D4 now says so.

**And the first version of this measurement was wrong in the most expensive direction available.** It
read a page global (`globalThis.__reactValue`) from inside the content script and got `null` for every
arm — **including the arm taken before any insertion**, which should have been the empty string. The
cause is that **a content script runs in an isolated world and its `globalThis` is not the page's**, so
the probe was reading a different JavaScript world than it wrote to. On that evidence the setter
looked *necessary* and the events looked irrelevant, which is the exact inverse of the truth and would
have been recorded as a platform fact. Every read-back in the harness is now the DOM, which is the one
thing a content script and a page genuinely share.

## D6 — measured: shadow isolation holds, with a control that fires

The fixture links a deliberately hostile stylesheet — `button { display: none !important; transform:
scale(0.1); color: transparent }` — and the harness asserts **the page's own button really is
`display: none`** before reading anything about the affordance. The first version of the fixture served
that stylesheet but never linked it, so "the page's styles do not reach the affordance" was satisfied
by the page not being hostile at all: a control that does not fire is not a control.

| Observation | Result |
| --- | --- |
| Hostile sheet linked, and firing on the page's own button | **yes** (`display: none`) |
| Affordance button's computed `display`, inside the shadow root | `inline-block` |
| Affordance button's computed `transform` | `none` |
| Buttons the page's own `document.querySelectorAll("button")` reaches | **1** — the page's own |
| Page's `document.body.textContent` contains the affordance's label | **no** |

**The two halves of D6's requirement are therefore different properties, and both were measured.** The
label is absent from the page's text, and the page cannot reach the control by query at all — which is
the stronger statement and the one worth keeping.

## One observation recorded and explicitly not turned into a requirement

The fixture's plain input received `input, input, change, change` — each event twice. That is
**React `StrictMode` double-invoking effects in development**, not a product fact: the fixture renders
inside `<StrictMode>`, which mounts, unmounts and remounts to surface unsafe effects. It is recorded
here so that nobody later reads the doubled list as evidence about how the extension dispatches
events, and the shipped fixture does not use `StrictMode` for exactly that reason.

## What these measurements do not establish

- **Nothing about a live provider.** No provider request was made; the probe names the two origins in
  `host_permissions` and calls neither.
- **Nothing about whether a content script may `fetch` cross-origin.** That is slice 2's question and
  remains open, deliberately.
- **Nothing about any browser but this Chromium**, on this one machine.
- **Nothing about how anything looks.** Every style fact above is a computed value, not a rendered
  pixel, and the affordance's appearance in a real site remains a human judgement — task 10.1.

---

# Findings recorded during apply, after the measurements above

These are ordered by how much they changed the work, not by when they happened. The first is the
largest recorded instance of a measuring instrument destroying what it measures.

## Two copies of the falsification harness ran over one working tree, and both reported success

**This is the thirty-first recorded instance of an instrument being wrong about its own subject, and
the first where the instrument was *two copies of itself*.** It is placed first because it is the
event that decides whether any number in this change's falsification record can be believed.

### What happened

A first harness run exited `0` having printed nothing and written no report. That is unexplained,
and the response to an unexplained instrument failure was to **relaunch it without diagnosing it** —
which is the error, and it is the ordinary one. The second instance started 54 seconds after the
first. From that moment **two processes were mutating and restoring the same six files
concurrently** for the next half hour.

### Why every safety check passed anyway

The harness verifies each restoration by SHA-256 against **the bytes it read at its own start**. A
mutation the *other* process applied before that read became this process's "original" — and was
then faithfully restored. So:

- every restoration check passed in both runs, and
- both runs exited `0`, and
- **both runs disagreed with each other about the same mutation.**

That last one is the tell, and it is the only reason the corruption was caught before the results
were written down. Mutation `B11` came back `caught-by-intended` from one instance and
`wrongcatch` from the other. `B13` and `B14` differ likewise. **Two runs of one deterministic
harness cannot disagree**, so a disagreement is not noise to be averaged over — it is proof that at
least one of them measured a tree that was being rewritten underneath it.

### What survived into the next hour

**Four leftovers, in three files and one build artefact, and not one of them was reported by either
run.**

| Left behind | What it was | Found by |
| --- | --- | --- |
| `insert.ts` | `B07`'s mutation: the `change` dispatch deleted, so only `input` was dispatched | the unit suite, failing on `fails the field, dispatches both events` |
| `vite.content.config.ts` | `B02`'s mutation: `formats: ["es"]` instead of `["iife"]` | the signature audit |
| `controller.ts` | `B14`'s mutation: the permanent-overlay loop, attaching a control to **every** email input on load | the browser tier, failing with **7** controls where there must be 1 |
| `dist/content-script.bundle.js` | a build artefact emitted while a filename mutation *and* a format mutation were both applied — 8092 bytes, which is the 8.09 kB recorded for `B02` | `manifest.spec.ts`, reporting 4 emitted JS files against an expected 3 |

**The build artefact is the sharpest one, and it sharpens a lesson this repository already has.**
`apps/extension/vite.config.ts` sets `emptyOutDir: false` deliberately, because the three builds
share one output directory and the popup build must not erase the content script's. The consequence
is that **no build ever removes an artefact a previous build emitted.** So the source was restored,
the final rebuild faithfully produced the correct 4491-byte `content-script.js` — and left an
8092-byte file beside it that no source produces. The recorded rule *"restoring a source file is not
restoring what the browser serves"* is therefore **too weak as stated**: it is not only that a build
must be re-run, it is that a restored source does not *un-emit* anything, and no SHA covers a build
artefact at all. The harness now removes `dist/` before every build, per mutation and for the final
rebuild, because the build's own configuration cannot be asked to.

**The `content-script.js` size is the receipt.** With the leftovers in place the file was **4642
bytes**; after the four repairs and a clean rebuild it is **4491**, which is the 4.49 kB task 2.1
recorded from the intact tree. A build artefact's size was the only measurement in this repository
that noticed.

### The audit that found the last one was itself wrong first

After the unit suite named `insert.ts`, the leftovers were hunted with `Select-String` for the
tokens each mutation introduced. On `controller.ts` that grep found `insertAdjacentElement` **on two
lines** — one legitimate, at the point the controller attaches the control to a focused field, and
one inside `B14`'s loop. **Both were read as legitimate.** A grep for a token is not an attribution:
the question is never "does this string appear?" but "is this the *only* place it appears, and is
this the right one?"

The instrument that works is duller: **one signature per mutation's `to` text, all 19 checked
across the 6 mutated files in a single pass**, each hit reported by file and line. That pass found
`B14`, and reported one remaining hit — `field.value = value` in `insert.ts` — which is the
legitimate fallback inside `setFieldValue` and was confirmed by reading it rather than by assuming.

### The two repairs, and what each one is

- **A pid lock.** The harness refuses to start when `harness.lock` holds a live pid, and says so in
  the message rather than proceeding. **This is the repair that matters**, because the failure it
  prevents is the one where every downstream number looks fine.
- **A clean `dist/` before each build**, for the reason in the table above.

**And the standing conclusion, which is the same shape as every other entry in this file: a check
that did not run is not a check that passed, and neither is a check whose subject was moving.** The
twenty-ninth through thirty-first instances all reduce to one sentence — the instrument has to be
shown to be measuring the thing it names — and this one needed a *second* instance of the same
harness to demonstrate it.

## A boundary rule's own control deleted ten source files, and five were not recoverable from Git

**This is the most important thing this apply stage has to say, and it is the reason the
`in-page-address` boundary work is shaped the way it is.**

Task 6.2 asks for "a positive control for every form 6.1 misses, and a negative control". The rule
being controlled is new — *keep the extension platform global to one module* — and its control was
written in the shape every other control in `boundaries.test.ts` uses: plant a probe in every file
the rule must scan, require each to be reported, then **delete the probes**.

**The probes were written over the real files and the cleanup removed them.** Ten tracked sources
went with them — `App.tsx`, `Popup.tsx`, `main.tsx`, `popup-copy.ts`, `provider-config.ts`,
`scheduler.ts`, `service-worker.ts`, `storage.ts`, `styles.css`, `transport.ts` — and the suite
then failed to load entirely, on a module-level import of a file that no longer existed. Ten were
restored exactly, with `git checkout --`, because they were tracked and unmodified.

**Five were not: the whole of `src/content-script/`** — `entry.ts`, `controller.ts`, `affordance.ts`,
`email-field.ts`, `insert.ts`. They were **untracked**, Git had no copy, `git fsck` found no dangling
blob containing them, and `git status` never mentioned them: Git does not report an untracked file as
missing. Their recovery is recorded below because **the method is reusable and the loss is
survivable only by accident.**

### What made them recoverable, and what did not

**`apps/extension/dist/content-script.js` was intact, at 4476 bytes.** It is an IIFE bundle of exactly
those five modules plus the packages they import, so every branch, every comparison, every event
name, the whole stylesheet and all three attribute names were recoverable from it. The constants read
straight out: `data-spectre-affordance`, `data-spectre-affordance-button`, `Use SpectreMail`.

**The two consumers were intact and pinned the exports.** `src/content-script.test.ts` and
`apps/extension/e2e/helpers/in-page-fixture.ts` both import by name, so every export's spelling was
known exactly rather than guessed. **The file now holds 25 cases rather than the 21 this paragraph
recorded** — two of the four added by the falsification repairs below, and the count is measured
from the JSON reporter rather than recounted.

**Three things had to be supplied and none of them was in the bundle: the comments, the file split, and
the reasoning.** Those are reconstructed, and a reader must treat the prose in those five files as
**rewritten after the loss** rather than as the text that was there before. No behavioural claim in
them is reconstructed — every one is checked below.

### How the reconstruction was verified, which is the part worth keeping

**Four instruments, and each answers a different question.**

1. **All 66 string literals in the rebuilt bundle are byte-identical to the pre-loss artifact.** That is
   every attribute name, every event name, every error message, the whole stylesheet and every
   separator. Extracted by regex from both files and compared with `Compare-Object`: no differences.
2. **The built file is 4475 bytes against 4476, and the first differing character is position 34** — a
   minifier-assigned identifier (`f` became `d`). The difference is naming, not behaviour.
3. **The function-definition count and relative order match** across the whole bundle: 20 each, with
   `createAffordance`, `isEmailField`, `holdsText`, `insertAddress`, `setFieldValue`,
   `startInPageIntegration` in the same sequence.
4. **Both tiers pass against the reconstructed source**: 21 unit cases and all **34** browser cases,
   including the 16 in-page ones, which drive a real Chromium against a real page.

**And instrument 4 is the one that decides it.** The other three are consistency; a behaviour
difference large enough to matter would show as a red case in a suite that presses the control, reads
a React-controlled field, and checks what a page's own queries can see. None did.

### The repair, and why the rule's control now copies the tree

**`chromeGlobalViolationsIn(root)` takes a root; `chromeGlobalViolations()` — the rule — takes none.**
The split is not a convenience. M6 slice 1 recorded twice that a parameter is *a second spelling of
what to scan*, and that narrowing it leaves the suite green because what it stopped scanning was clean.
So the **rule** has no argument, and the **control's instrument** has one — and the control copies
`apps/extension/src` into a temp directory with `cpSync`, plants every probe there, and asserts against
the copy. **Nothing real is written, so a crash, a failed assertion or a `Ctrl-C` leaves the working
tree exactly as it was.**

This is the thirtieth recorded instance of an instrument being wrong about its own subject, and the
first where the instrument was the destructive part rather than the blind part.

## The falsification run found four assertions that could not have caught what they named

**Nineteen forbidden defects and five probes were run. Thirteen were caught by the intended
assertion, six by other assertions, and none survived.** Five mutations came back `green` on the
first pass, and **each of the five was a real gap in this change's own tests rather than in the
product.** Four are closed and re-verified; the fifth is a property of the platform rather than of a
test, and is recorded below as a limit on what the browser tier can say.

### The run, in full

Restoration was SHA-256 verified for every mutated file and `dist/` was rebuilt from restored source
afterwards — **and that verification is what the concurrent-instance defect below defeated, which is
why it was not enough.**

| id  | tier   | outcome                | intended case                                            | failing     |
| --- | ------ | ---------------------- | -------------------------------------------------------- | ----------- |
| U01 | unit   | caught-by-intended     | autocomplete naming email                                 | 1 / 106     |
| U02 | unit   | caught-by-intended     | name identifying email                                   | 3 / 106     |
| U03 | unit   | caught-by-intended     | a button naming email                                    | 1 / 106     |
| U04 | unit   | caught-by-intended     | the affordance on a field holding only whitespace         | 1 / 106     |
| U05 | unit   | wrongcatch             | offers nothing on a field that already holds text         | 10 / 106    |
| U06 | unit   | caught-by-intended     | does not insert over text typed between focus and press   | 1 / 106     |
| U07 | unit   | wrongcatch             | exactly one control when focus moves between two fields  | 1 / 106     |
| U08 | unit   | caught-by-intended     | exactly one control when focus moves between two fields  | 1 / 106     |
| U09 | unit   | caught-by-intended     | survives the focus that pressing it moves                | 1 / 106     |
| U10 | unit   | **probe-not-fired**    | survives the focus that pressing it moves                | —           |
| B01 | browser | wrongcatch            | ships the content script the manifest declares           | 4 / 36      |
| B02 | browser | **probe-not-fired**   | ships the content script the manifest declares           | —           |
| B03 | browser | **probe-not-fired**   | ships the content script the manifest declares           | —           |
| B04 | browser | caught-by-intended    | the page's own rules do not apply to the control         | 1 / 36      |
| B05 | browser | caught-by-intended    | exactly one control on an empty email field              | 1 / 36      |
| B06 | browser | **probe-not-fired**   | does not submit the form the field belongs to            | —           |
| B07 | browser | caught-by-intended    | reaches a plain field and dispatches its events          | 1 / 36      |
| B08 | browser | wrongcatch            | reaches a React-controlled field's state                 | 3 / 36      |
| B09 | browser | **probe-not-fired**   | reaches a React-controlled field's state                 | —           |
| B10 | browser | caught-by-intended    | offers nothing when this device holds no mailbox         | 1 / 36      |
| B11 | browser | caught-by-intended    | runs on a plain-http page too                            | 3 / 36      |
| B12 | browser | wrongcatch            | the control carries no stylesheet of the page's          | 4 / 36      |
| B13 | browser | wrongcatch            | declares no surface it does not render                   | 4 / 36      |
| B14 | browser | caught-by-intended    | shows nothing until an email field is focused            | 16 / 36     |

**Every probe behaved exactly as declared**, and that is the part of this table worth reading first.
Five mutations were predicted *not* to fire and none did: a probe that fired would have meant this
design's own measurement was wrong, and a probe that was never run would have meant the harness was
not looking. `U10`, `B09` and `B02` are the ones D4 predicted; `B03` is the one the build
measurement predicted; `B06` is the platform limit below.

### Three of the six `wrongcatch` results are the platform refusing to load the extension

`B01`, `B12` and `B13` produced an **identical** list of four failing titles. Three unrelated defects
cannot share a cause among the assertions, so the cause has to be upstream of them — and it is: each
of the three leaves Chromium with a manifest it will not load. `B01` names a content script the build
did not emit; `B12` names a stylesheet that does not exist; `B13` declares a `side_panel` with no
permission behind it.

Measured rather than assumed, by running each in isolation against the suite's own launch helper:

```text
Error: The built extension at ...\apps\extension\dist (manifest name: SpectreMail)
registered 0 service worker(s). Chromium did not report an error, so the usual causes are
a malformed manifest, a "background.service_worker" path that does not exist in dist, or a
worker that threw while loading.
```

**All three are caught, loudly and by the platform — but by the suite's shared extension-launch
precondition, not by the assertion that names the defect.** A `wrongcatch` is not always a weak
assertion: here three strong ones were made unreachable by Chromium's own validation. The
consequence is stated rather than papered over: the shipped cases for these three requirements
**cannot** be shown to fail for the reason they name.

### The other three `wrongcatch` results, and why each is honest rather than a gap

- **`U05`** replaces `holdsText`'s property with a different one. Ten cases fail and the intended
  case is not among them, because a recogniser that refuses everything satisfies *"offers nothing
  on a field that already holds text"* trivially. **The negative assertion cannot hold its own
  property alone, and it is the positive one — the whitespace case — that pins the direction.** That
  is why U04 was worth repairing even though it cost nothing to leave green.
- **`U07` and `U08` are the two halves of one defect**, and the intended case catches only one of
  them: removing the deferred teardown is caught by the press-time focus case, while removing the
  cancellation is caught by the one-control case. **Together they hold the requirement, one case
  apart**, and the record names both rather than crediting the one that happened to be intended.
- **`B08`** drops the dispatched `input` event and keeps `change`. The React-controlled case does not
  notice, because React's change plugin accepts `change` as well as `input` and de-duplicates
  between them; the plain-field case does notice. **So D4's measurement stands as recorded —
  *neither* event alone is load-bearing for React, but at least one is, and the direct assignment
  alone is not** — while the case named for it is not the one that proves it.

### The whitespace case could not fail, because the platform had already emptied the field

The case exists *for* the mutation that removes `trim()` from `holdsText`, and its own comment says
so. Removing `trim()` leaves the entire suite green.

**The reason is that an `<input type="email">` never held the whitespace to begin with.** Assigning
`"   "` to one leaves `""`: the value sanitization algorithm runs, and by the time a line of this
product executes the field is **empty** — so `trim()` was never load-bearing *in this fixture*, and
removing it changed nothing. Measured with a throwaway probe rather than inferred:

```text
type="email"  value = "   "  ->  ""      length 0   holdsText: false
type="text"   value = "   "  ->  "   "   length 3   holdsText: false
```

**A case whose fixture silently normalises the condition under test cannot fail, and its comment
claimed the opposite.** This is the recorded defect class — *an assertion narrower than the rule it
documents* — in a form this repository had not recorded: not a check that examines too little, but a
check whose **subject had already been altered by the platform before the check ran**. The fix is
`type="text"` with `name="email"`, which is recognised through the identity signal and keeps all
three spaces. **Re-verified: the mutation is now caught by the intended case.**

### The "a button" row never reached the guard it names

`isEmailField` opens with `element.tagName !== "INPUT"`, and `email-field.ts` justifies it in exactly
these words: *"a `<button autocomplete="email">` is a button."*

The table's button row was `{ tag: "button", type: "button", text: "go" }` — **nothing email-shaped
on it.** Deleting the `tagName` guard entirely left the case green, because the row is refused by the
other two signals failing. The case was named for the guard and never reached it. The row now
carries `autocomplete="email"`, which is the button the module's own note describes, and **the
mutation is now caught by the intended case.**

### What the browser tier cannot falsify, and why the unit tier carries it alone

`button.type = "button"` is what keeps the affordance from submitting the field's form. Setting it to
`"submit"` is caught — **by the unit tier**, in `fills the field, dispatches both events, and does
not submit the form`.

**The browser tier cannot see it at all.** A submit-typed control is removed from the document by
its own click handler before activation behaviour runs, so it has no form owner and the form is never
submitted. The in-page case now carries the **positive control it never had** — a real submit-typed
button planted in the same form, pressed, with the submission required to appear — so the case is
demonstrably capable of firing and is not simply asserting the absence of something that never
happens. **And it still cannot distinguish the two implementations, because the difference between
them is erased by the self-removal.** That is a fact about the platform and this design, not about the
spec, and it is why the requirement is carried by the unit tier and the browser case is not claimed
to hold it alone. It is filed as `B06`, a probe expected not to fire, with the reason attached — and
the positive control is what stops that filing from being a coverage claim.

**Getting the positive control to run took one measured detour, and it is the fixture's own
hostility.** The page links `button { display: none !important }` on purpose — that is D6's
precondition — so a probe planted into the page is invisible and Playwright refuses to press it.
The affordance is unaffected because it lives in a shadow root the sheet cannot reach, which is the
property under test elsewhere in the same file. The probe therefore carries
`display: inline-block !important`, and without it the control silently times out rather than
failing.

### And the last signature sweep found a comment naming the wrong filename

A sweep over every mutation's own signature — run deliberately, because the *first* audit after the
concurrent-instance repair was a targeted grep and reported the tree clean while three mutations were
live — turned up `content-script.bundle.js` inside `vite.content.config.ts`'s **module prose**,
describing it as the literal the manifest refers to. **The manifest says `content-script.js`, and the
exported constant two lines below says `content-script.js`.** So the code was right and a comment
about it was wrong, and `dist/content-script.js` is 4491 bytes.

**A comment can be wrong about a value that is correct beside it, and nothing in a build reads
prose.** That is worth stating as its own small finding because the alternative reading — "a stale
mutation was left behind" — is the one a reader would reach for first, and **it is not supported**:
every mutated file is restored byte-identically, and a mutation could not have edited a comment
without also failing to revert one. The comment was simply written wrong.

### And one claim was narrowed, because the sentence was broader than the instrument under it

A final read of the extension tier found `manifest.spec.ts`'s module note claiming the second
instrument read what Chromium had **granted**, through `chrome.management` — **an API this
extension does not have, and cannot have.** Reading an extension's own granted permissions from
inside that extension has no API; the case itself already said so in a comment beside the call, and
the file's own heading said otherwise. So two things were true at once and only one of them was
being read.

The case now reads `chrome.runtime.getManifest` inside the worker, which is Chromium's **parsed**
manifest rather than the file this process wrote — a real second instrument, and the one the file
had been claiming. And the claim was narrowed to match it: **parsing a permission list is not
being granted one.** Every provider response in this tier is fulfilled by the harness, so **no
case here exercises a grant**; the only observable of one is a cross-origin `fetch` succeeding,
which is what the quarantined M0 probe exists for. The case's name, its `describe` heading,
`AGENTS.md`'s M8 sentence, and the note are now all the same claim.

**A heading, a test name, and a comment inside the test disagreed with each other, and the two that
read as summary were the two that were wrong.** That is the shape worth keeping: the detail beside a
call is usually the last place to be corrected and the first place to be right.

### The instrument that investigated all of this produced its own false green, twice

Both are recorded because each one nearly became a **finding**, and a finding is worse than a gap:
it is a number someone will believe.

- **A helper script reported "no failures" for two mutations when Playwright had never run.** It
  pointed at the workspace root's `@playwright/test`, which does not exist — Playwright is a dev
  dependency of `apps/extension`. `node` exited with `MODULE_NOT_FOUND`, the script found no failing
  titles, and it printed *no failures* — **which is the answer the mutation was supposed to produce.**
  On that output `button.type = "submit"` looked uncaught by the browser tier, which is a claim, and
  the claim was wrong. The script now refuses to start if the CLI is absent and treats **an output carrying no runner count as `harness-error` rather than as a clean tier.** This is the *same defect this repository has recorded four times* — `pnpm.cmd` unspawnable from Node, `nocompile` read as a pass, a deleted `testDir` read as coverage — committed by a new instrument on its first run.
- **PowerShell silently deleted the double quotes out of an edit site.** Two hand-run mutations were
  passed as command-line arguments containing `""`, and Windows PowerShell strips embedded quotes
  from a native command line: the argument arrived as `return field.value.trim() !== ;`, reported
  *"edit site occurs 0 times"* for a site plainly on screen, and **a mutation that never ran looks
  exactly like a mutation nothing caught.** Every edit site used from here on lives inside a module,
  never in a shell argument. **This is the second time this session that a quoting artefact nearly
  became a recorded defect** — and it is worth naming the general shape, because it is not the same
  bug as the first: there the instrument was blind, and here it was **actively wrong in the safe-looking
  direction**, reporting "nothing to do here" rather than "I broke".

## Two focus-ordering defects in the controller, both found by pressing the control rather than by a red test

Neither is derivable from the requirement, and **both were found while running the tier, not by reading
it.** They are the reason `cancelPendingRemoval()` and a two-element identity test exist, and both read
as defensive noise without them.

**1. A deferred `focusout` teardown removed the *new* affordance.** `focusout` precedes `focusin` when
focus moves between two fields, so a controller that removed on `focusout` showed the control and took
it away again the moment a person tabbed from one address field to the next. The removal is deferred by
one task and cancelled when a `focusin` arrives first.

**2. Pressing the control moved focus onto it, and `focusin` arrived before `click`** — so the
controller tore down its own control before the press was delivered. **The guard cannot name one
element.** At a document listener `event.target` is **retargeted to the host**, because the button is in
a shadow root and the event is composed. It is checked against `affordance.host` **and**
`affordance.button`, and neither alone is right: a host-only check passes today, a button-only check can
never match.

**The first unit test written for defect 2 passed green with the document listener never called.** A
`FocusEvent` defaults to `composed: false`, so a non-composed event never leaves the shadow root and the
listener was never entered. The test now dispatches with `composed: true`, and it is the case that
holds the retargeting fact rather than the mechanism.

## The browser tier has a page but no `webServer`, and the task that said otherwise is corrected in place

Task 5.1 originally read "served on loopback by the suite's `webServer`". **That is corrected in
`tasks.md` rather than reinterpreted.** The suite uses **route interception** and the origin
`https://in-page.invalid`, for a measured reason: `AGENTS.md` records that this repository's `browser`
job **hung five times** in CI because `pnpm preview` spawns `vite` as a child, and Playwright hangs
shutting that webServer down. Adding a second `webServer` to the suite that has the most recorded
failure modes would be choosing the known-bad instrument on purpose.

**This costs something real and it is stated rather than discovered.** The fixture page is served by
Playwright's own router rather than by a static file server, so nothing here proves a real server serves
a real page. `in-page.spec.ts` also has **no page of its own** in the config — `popup.spec.ts` owns the
launch, and the in-page suite adds specs against that launched context.

## Three defects in the browser tier's own fixture, all found by reading a run rather than a red test

- **A blur target that was not focusable.** `focus()` does **not** move `activeElement` onto a
  `display: none` element — neither by `element.focus()` nor by `locator.focus()`. The default target
  is `username-input`, which the fixture renders.
- **The negative control compared a selector against an attribute.** It planted an escape using
  `setAttribute` where it needed a selector, so it set an attribute literally named
  `[data-spectre-affordance-button]` and matched nothing — **and then reported the same answer with and
  without the escape it was planted to simulate**, which is the definition of a control that proves
  nothing.
- **A miscounted shadow-root button.** A reader counted `document.querySelectorAll("button")` to assert
  the page's own buttons were untouched, and the affordance's button was not in that list, so the count
  had to be reasoned about rather than read off.

## Three boundary rules, and each of them changed the implementation rather than the other way round

### The markup rule exempts no test, and that is why the unit fixture stopped writing markup

`website-client` forbids rendering untrusted content as markup under `apps/`, and — **unlike the
storage rules — that scan exempts no test file.** The first version of `content-script.test.ts` built its
fields from HTML strings and cleared the body with `innerHTML = ""`, which reported **three** violations
and failed `pnpm test` for it. The repair was **to stop writing markup**, not to widen the exemption:
these tests are about a controller that watches focus, HTML parsing is not what they are about, and a
`FieldSpec` shows the recognition signals outright instead of hiding them in a string. It also made a
case expressible that the string form could not — an `<input>` with no attributes at all.

### A shared e2e helper tripped the client-storage rule, and the fix was to read the global the way the product does

`apps/extension/e2e/helpers/stored-mailbox.ts` moved `popup.spec.ts`'s local `clearStoredMailbox` out
so the suite has one spelling of "empty the extension's storage". **A `.spec.ts` is exempt from the
client-storage rule; a helper beside one is not**, and the rule already forbids `chrome.storage` — so the
helper reported a violation for an error *message* naming the API.

**The fix is the product's own seam, not a reworded string.** `src/local-area.ts` walks the global with
`Reflect.get`, and the helper now walks it the same way, with the path passed in from Node as
`AREA_PATH = ["chrome", "storage", "local"]` so both operations share one definition of where the area
lives. **It is not a workaround for a rule:** the writes still go through the platform's own API inside
the worker's own context, which is the point of the file. **And `apps/web/src` is required to stay at
114, which it does** — the helper is extension-tier only.

### The single-reader rule found a real duplication on its first run, and then the file's name broke it

The new rule matches the bare identifier, which catches member access, the reflective spelling the
shipped code actually uses, and the identifier bound to something else. **On its first run it reported
two violations, and neither was speculative: `main.tsx` carried its own copy of the reflective read and
its own shape check**, identical in logic to the new `local-area.ts`, written beside it. D3's claim —
"both contexts read the global through the one module" — was **false when it was written**, and the only
reason nothing caught it is that no rule existed. Two copies of a shape check drift: one gains a method
the other does not, and the extension stores a mailbox the popup cannot read back. `main.tsx` now calls
the reader.

**And then the rule fired on the two imports of that reader**, because the module was named
`chrome-platform.ts` and the pattern matches inside a module specifier. **A rule that reports the only
correct import in the codebase has to move the file or carve the pattern.** The carve-out was rejected:
exempting any specifier containing the word would exempt a future one that reached the global. **The file
was renamed `local-area.ts`** — named for what it supplies rather than what it names, and distinct from
`storage.ts`, which is the adapter over that area.

### And the rule had a decision nothing exercised — found by mutation, not by reading

**Nothing in the recorded run touched this rule.** The pass covered `apps/extension`'s two suites —
U01-U10 and B01-B14 — and the two new boundary assertions were written in the same breath as the
rename above and never targeted. **A new boundary rule that has never been shown able to fail is
exactly the class of thing this repository keeps finding**, so it got its own pass rather than being
inherited as coverage. Four mutations, each removing one of the rule's decisions:

| Mutation | Defect | Outcome | Caught by |
|---|---|---|---|
| C01 | the scan reports nothing at all | **caught by the intended case** | `keeps the extension platform global to one module` |
| C02 | the reader exemption widened to every file | **caught by the intended case** | `keeps the extension platform global to one module` |
| C03 | the pattern narrowed to the member-expression spelling the shipped code does not use | **caught by both cases** | both |
| C04 | the **rule** retargeted at a tree holding no extension source | **survived** | — |

**C04 is the finding, and it is M6 slice 1's arriving one directory over.** Every control the rule has
plants into a **disposable copy** and passes the root in as an argument, so none of them can tell
the no-argument rule *which* tree it reads — and retargeting it at `apps/web/src`, a real tree that
simply contains no `chrome`, leaves the suite green. **A rule scanning nothing reports nothing, and a
negative assertion is trivially satisfied by refusing everything.**

**It was not closable by reasoning, and that is worth stating rather than hiding.** The shipped tree
is clean, so there is nothing about it to observe; every candidate control — asserting a named root
constant, deriving the expectation from the tree — is either circular or survives the same
mutation. The only honest control is to plant something in the tree the rule claims to read.

**So the control plants a probe at a fresh path in the real tree** and removes the single file it
created, and the safety argument is specific rather than reassuring: **it overwrites nothing.** A
sibling control on this rule once overwrote the shipped sources and destroyed ten of them, which is
why the disposable-copy note above says the real tree is never written to. **And the failure mode is
loud rather than quiet** — a probe left behind by a crash is named by the very assertion that
follows it, so the next run reports the leftover instead of skipping over it. That asymmetry is the
whole reason this repair is safe where the earlier one was not.

Re-run after the repair: **all four caught by the intended case**, restoration SHA-256 verified for
every mutated file, and no probe left in the tree.

### The instrument that falsified the rule was wrong three times before it produced that number

Its own count was wrong in the way this repository has recorded before: `/(\d+)\s+passed/` matched
anywhere in Vitest's output, and Vitest prints `Test Files  1 passed (1)` immediately above
`Tests  2 passed (2)` — so the first run reported **one** test for a filter matching two, and the
exemption case was never executed at all. Anchoring on the line fixed the number and exposed the
second defect: **the summary line does not begin with `Tests`, it begins with an ANSI colour escape**,
so the anchored version found no line and reported `harness-error` for a run that had passed two of
two. **Declining to answer is the correct behaviour and declining for the wrong reason is its own
defect** — the run's real result was sitting in the output the function had just refused to read. The
third was the lock: releasing it wrote `""`, `Number("") === 0`, and `process.kill(0, 0)` asks about
*this process group* and succeeds — so every later run was refused by a lock nobody held, and the
refusal read as "another instance is running" rather than as "the lock's own release is wrong".

**Three defects in the instrument, and the pattern is the one already on this page:** each was a
check that could not fail for the reason it exists, and each was found by reading the runner's own
output against what the file contains rather than by trusting the verdict.

## The reading order of this document, for a reader who has just been told the above

D1-D9 and the measurements above were written before any of the findings on this page. **Nothing on this
page contradicts them.** D3 named the single-reader discipline and this apply stage found it was not
implemented; D8 named the harness gap and this stage replaced it with route interception; D9 named the
empty-field rule and this stage found the press-time case it needs. **What this page adds is the record
of the instrument that was wrong three times** — once about focus order, once about the repository it was
measuring, and once about **itself being present twice**: the falsification harness ran as two
concurrent instances over one tree, both reported success, both disagreed with each other, and four
leftovers outlived them. **The first entry on this page is the one to read before any number in the
falsification record is believed.**