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