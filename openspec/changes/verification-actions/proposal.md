# Proposal

## Why

The roadmap schedules the verification workflow at M10, and its first two user
actions - `Copy code` and `Open verification link` - need no new permission, no new
context and no notification. Everything they act on is already computed: `packages/mailbox`
runs `analyseMessage` on every opened message, and the website already renders the ranked
codes and links as text. So the detection is done and the page is the only place a user can
reach it, and the two actions are the cheapest real delivery of the milestone.

This is also the first time any client *acts* on anything `packages/mail-parser` found. That
package is 149 tests with no consumer that shows a finding to a user; this slice makes its
output mean something in a browser.

## What Changes

The website's message view gains two controls, both reached only by an explicit user action:

- **Copy a detected one-time code.** A control per detected code, not one for the top code,
  and not a silent clipboard write. Each names the code it copies, copies it unchanged,
  confirms the copy happened, and - if the clipboard refuses - reports the refusal and
  leaves the code visible and selectable. This mirrors the mailbox-address copy control,
  which `website-client` already requires to behave exactly that way.
- **Open a detected verification link.** The link becomes a real anchor with the
  destination host visible inside it, opening in a new tab with `rel="noopener noreferrer"`.
  Rendering a message still follows nothing; only pressing the link navigates.

Two existing `website-client` requirements are modified rather than left contradicted:

- `This slice shows what it found and does not act on it` becomes a requirement about
  acting *only on an explicit request*. It is the requirement that currently forbids both
  controls, so the milestone's own prerequisite has to be amended here or the change ships
  code its own spec forbids.
- `The page's limits are stated in its footer` keeps its four facts but its code-and-link
  sentence is reworded, because after this change "it does not copy codes" would be a
  false claim printed on the page.

Two build-failing boundary rules in `tests/architecture/boundaries.test.ts` currently
forbid the copy control and the anchor. They are removed with this change, not exempted,
and the properties they were standing in for are carried by behavioural requirements and
tests instead. This is recorded because deleting a rule and dropping a property look the
same in a diff and are not the same thing.

Not in this slice, and named so the boundary is a decision rather than an omission:

- No notification, and no `notifications` permission. The extension popup holds no message
  list, so a notification would need the worker to fetch, parse and put a code in a
  notification body on a background poll whose cadence has never been measured.
- No filling a code into a form, and no auto-submit.
- No extension-side copy or link. The in-page and popup clients get their own requirements
  when that surface is built.

## Capabilities

### New Capabilities

None. The actions belong to `website-client`, which already specifies what the page does
with an opened message; a new capability here would split one client's behaviour across
two specs for no gain.

### Modified Capabilities

- `website-client`: the requirement that forbids acting on a code or link is replaced by
  one that permits it on an explicit request only; the footer's limits list is amended so
  its code-and-link sentence stays true; and two requirements are added for copying a code
  and for opening a link.

## Impact

- `apps/web/src/MessageView.tsx` renders the copy control per code and the link as an
  anchor. It gains no provider knowledge and no new state beyond a per-code copy result.
- `apps/web/src/sections.ts` rewords one footer limit; the limits list stays five entries.
- `apps/web/src/styles.css` extends the `:focus-visible` rule to the link so the new
  interactive element meets the existing focus requirement. No new token and no new
  animation, so `packages/ui` is unchanged.
- `tests/architecture/boundaries.test.ts` loses the two rules that forbid the copy control
  and the anchor. The client-storage rule's single `navigator.clipboard` carve-out
  already covers the new write.
- `apps/extension`, `packages/*` and `packages/mail-parser` are untouched. This is a
  single-client slice.