# Proposal

## Why

`docs/ROADMAP.md` **§15, M9 - In-Page Email Integration** is the earliest incomplete milestone,
and `extension-client` already names what this change adds: the requirement *"The extension declares
its non-goals as requirements rather than leaving them absent"* lists a content script among the
surfaces this milestone **SHALL NOT** declare, and its own second scenario says that when the
in-page milestone arrives it *"SHALL amend this requirement in its own change rather than deleting
the assertion"*.

So the absence is deliberate and owned, and this change is the change that discharges it. Two
constraints shape what can be built and in what order.

**First, M9 is larger than one change can carry honestly.** The roadmap's behaviour block lists
five things clicking should do — create or select a mailbox, insert the address, fire the
right events, stay compatible with React/Vue-controlled inputs, and associate the mailbox with the
current site — and the UX rules add a three-way choice (current mailbox / new mailbox / recently
used mailbox for that site). The site association is a **second stored record kind**, and
`spectre-storage`'s contract says in its own opening that it *"has room for one of them"* and that
the other four are *"a schema to migrate rather than a feature"*. Building all of M9 in one change
would put that decision inside a change whose subject is detection and insertion.

**Second, and this is the ordering rule that decides it:** creating a mailbox from a page requires
a **cross-origin request from a context that holds host permission**, which in MV3 means the
background service worker — the one context whose lifetime `extension-client` records as
**unmeasured**, and whose requirement forbids a polling loop. Inserting an address the device
already holds requires **no network at all**. So the two halves have different risks, and the one
without the unmeasured risk goes first.

**M9 is therefore sliced.** This change is **slice 1**.

## What Changes

- **The extension declares a content script**, which is the surface `extension-client` has been
  holding absent on purpose. Its requirement is **amended in this change**, as that requirement's
  own scenario demands: the content script comes out of the forbidden list, and the **side panel,
  the notification, and the one-time-code copy-or-fill control stay in it** — those are M11's and
  M10's, and a change that removes the whole list would delete an assertion that is still true.
- **The affordance appears when an email input takes focus, and only then.** The roadmap's UX
  rules are explicit — *"Do not permanently overlay every email field"*, *"Prefer appearing on
  focus or explicit user interaction"* — and an always-present control on every email field on
  every page is the thing that rule exists to prevent.
- **It inserts the address already stored on this device**, read through `packages/storage` rather
  than by asking the worker. A content script holds the extension's `storage` permission, so the
  read needs no network, no message round trip, and no assumption about whether a terminated
  service worker wakes for a `sendMessage`. **Every one of those is a fact this repository has not
  measured**, and slice 1 has no reason to depend on any of them.
- **The insertion has to reach the framework's state, not just the DOM value.** A React-controlled
  input keeps its value in a tracker on the node; assigning `input.value` updates what the user
  sees and leaves the framework believing the field is empty, so the form submits without the
  address. The requirement states the **property** — the address becomes the value the framework's
  own state holds — and `design.md` D4 holds the mechanism, because a requirement naming a setter
  would fail any correct implementation that used a different one.
- **It never overwrites text that is already there, and it never submits anything.** Both are the
  roadmap's own UX rules, and a control that replaces a half-typed address is worse than no
  control.
- **It is absent when this device has no stored mailbox.** No address means nothing to offer, and a
  control whose only reachable answer is *"there is not one yet"* is exactly the control-that-cannot-
  act defect this repository has refused four times. Slice 2 is what makes it appear before a
  mailbox exists, because slice 2 is what can create one.
- **No new token, no motion, and `packages/ui` untouched.** The affordance is a single control in a
  shadow root with a minimal inline stylesheet, so it neither reaches into the page's cascade nor
  asks the token layer for values that were declared for this product's own surfaces.

**Two measurements are named in `design.md` as deciding two of these decisions, and both are
resolved before implementation rather than assumed:** whether Chromium injects the declared content
script with the manifest as it stands, and whether the address reaches a React-controlled input's
state. D2 is written so that the *permission* is a consequence of the measurement rather than the
thing being measured — see `design.md` D2 and D5.

## Capabilities

- **New `in-page-integration`** — what the affordance is, when it appears, what it inserts, what it
  must not do, and the isolation it must keep from the page it is injected into.
- **Modified `extension-client`** — the *"declares its non-goals"* requirement only, amended as its
  own scenario requires. Its six requirements and twenty scenarios are otherwise untouched, and
  `extension-client`'s browser-tier requirement needs no change because a new spec is collected by
  the existing suite automatically.
- **Untouched:** `provider-abstraction`, `mailbox-session`, `spectre-storage`, `visual-system`,
  `page-composition`, `website-client`, `mail-parsing`, `shared-domain-model`,
  `build-and-verification`. **No package changes at all** — slice 1 is a client change, and the
  strongest claim this proposal makes is that none of the five shared packages needed to move.

## Impact

- **New:** `apps/extension/src/content-script/` (the affordance, its entry, and its unit test), its
  browser cases in `apps/extension/e2e/`, and one module holding the `chrome.storage.local` read
  that `main.tsx` currently does for the popup alone.
- **Changed:** `apps/extension/static/manifest.json` (a `content_scripts` key, and whatever the
  D2 measurement says about host permissions), `apps/extension/vite.config.ts` and
  `apps/extension/package.json` (a **separate** build for the content script — D1), `apps/extension/src/main.tsx`
  (the global read moves to the shared module), and `apps/extension/e2e/manifest.spec.ts` (the case
  asserting no content script is **replaced by one asserting what the content script declares**, not
  deleted).
- **Not changed:** every package, `apps/web` in its entirety, the provider layer, the session, and
  the popup's own behaviour.
- **Counts this change expects to move, and expects the others to hold:** `apps/extension`'s unit
  count rises; **`apps/web` holds at 120** and the website's browser tier holds at **37**, because
  slice 1 has no business changing the page; `packages/*` hold, **`packages/ui` in particular at
  38**; the architecture boundary count rises by however many assertions the new rules need; the
  extension's browser tier rises from 16.