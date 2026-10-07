# Proposal

## Why

The in-page surface can insert only an address this device already holds. On a device holding none it
offers no affordance at all — so the product's first browser-native advantage is unavailable exactly
where it is most wanted: a person sitting on somebody else's signup form who has never used
SpectreMail. Slice 1 said so in the requirement itself, in terms this change must honour: *"the
milestone that adds creating a mailbox from a page SHALL amend it rather than finding a control
already present and leaving its empty case unaddressed."*

Creating an address is a round trip to a provider, and this repository had never established which
extension context may make one. That is not a detail to settle during implementation — the two
possible answers produce opposite designs. Measured in real Chromium against two loopback origins on
2026-10-08, before this proposal was written:

- a content script's `fetch` to a cross-origin host **the extension holds a host permission for was
  refused** — `TypeError: Failed to fetch`;
- the **same request from the service worker succeeded** with HTTP 200, and the **same request with
  an `Access-Control-Allow-Origin` header succeeded from the content script**;
- a content script reaching the worker by message worked, and the worker and the script were shown
  to see one `chrome.storage.local`.

So the extension's host permissions do not cover a content script's own request; the **page's** CORS
policy governs it. Creation therefore cannot happen where the control is drawn, and must be
delegated to the background worker — which makes the worker, and the shape of what the worker is
allowed to keep, load-bearing in a way they were not before.

## What Changes

- **The affordance is offered when this device holds no address, and says what pressing it will do.**
  Creating a mailbox has a consequence at a provider and takes longer than an insertion, so the
  control's label states that rather than reading as a paste of something already held.
- **Creation is performed by the background service worker**, over the shared mailbox session and the
  shared provider abstraction — the same composition the popup already performs, reached by a request
  from a page rather than by a person opening a popup.
- **The worker persists a new mailbox before it answers**, and only after the provider confirms it.
- **The worker retains no session between requests.** Its lifetime is still unmeasured, so nothing
  that outlives one request may be stored in it. The existing requirement forbidding background
  polling stays true and is extended to cover this.
- **The page reports a creation as failed only when the extension said so.** When its wait passes
  without a confirmation, the page re-reads this device's stored mailbox rather than guessing, and
  the copy it shows says what it could confirm and nothing more.
- **The extension's `chrome` global is read from one module**, renamed because that module now
  supplies messaging as well as the local storage area.
- **The extension's scheduler works in a context that has no `window`**, which the worker is.

## Capabilities

### New Capabilities

None. A new capability here would be a near-duplicate of `in-page-integration`, which already owns
the behaviour of this product inside somebody else's page; slice 1 established it as the home for
exactly this surface.

### Modified Capabilities

- `in-page-integration`: the requirement *"The affordance offers no address this device does not
  hold"* is **modified** — it is the requirement slice 1 wrote an amendment obligation into, and its
  empty case becomes reachable. New requirements are added for the creation offer, for the fact that
  creation does not depend on the page's own permission to reach a provider, and for what the page
  is permitted to claim about an outcome nobody confirmed.
- `extension-client`: the requirement *"The background service worker carries no polling until its
  lifetime is measured"* is **modified** to cover the worker now performing work on request, and a
  new requirement is added for the worker's creation request and its answer.

## Impact

**Code.** `apps/extension/src/local-area.ts` is renamed and gains a messaging seam; a new shared
module defines the typed request and validated answer between the two contexts;
`apps/extension/src/service-worker.ts` gains a creation handler; `apps/extension/src/scheduler.ts`
ceases to assume a `window`; `apps/extension/src/content-script/{affordance,controller,entry}.ts`
gain the creation offer and its states.

**Tests.** New unit cases for the request/answer validation, the worker's handler and the content
script's states; new cases in the extension's browser tier for the delegated path, served recorded
provider responses. Measured first, not assumed: Playwright's request routing **does** reach an
extension's service worker in this repository's Chromium, so the tier keeps its offline property
rather than falling back to a fixture extension or a live call.

**Boundaries.** One boundary assertion changes — the single permitted reader of the extension's
platform global is renamed — and it must keep its negative control, because a rule narrowed by a
rename is a rule that can stop guarding.

**Documentation.** The three measurements above are recorded in `docs/PROVIDERS.md` before anything
depends on them, in the form slice 1 used: what each arm establishes and what it does not.

**Not touched.** `spectre-storage` needs no amendment: its `chrome.storage` adapter requirement
already covers a second extension context using the same contract, and its "`null` means exactly one
thing" rule is what makes the page's re-read honest. `mailbox-session` needs none either — the
worker is a client of it, and `restore` never saving is a rule this change obeys rather than
changes.