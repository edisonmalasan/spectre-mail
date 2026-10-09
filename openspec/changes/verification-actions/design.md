# Design

## Context

What this design has to fit inside, all measured against the tree at
`272ee13` rather than recalled:

- `packages/mailbox` already runs `analyseMessage` on every opened message and exposes
  `OpenedMessage.codes` and `OpenedMessage.links`. The detection pipeline is finished;
  nothing about it changes here.
- `apps/web/src/MessageView.tsx` renders those two lists as **text**: a code in a `<code>`,
  a link as `<span class="link__host">` plus `<span class="link__url">` and deliberately
  no `href`. The module header states why, and this slice is the milestone that discharges
  it.
- `Address.tsx` is the only existing clipboard consumer and the shape to mirror: a copy is
  a **rendered state** (`"idle" | "copied" | "refused"`), not a thrown error, and
  `website-client`'s address requirement already demands a confirmation and a reported
  refusal.
- `website-client` has **two** requirements this change contradicts: the one that forbids
  the copy control and the anchor, and the footer's, whose third limit sentence says the
  page "does not copy codes or follow links for you".
- Two build-failing boundary rules in `tests/architecture/boundaries.test.ts` enforce that
  prohibition: `findCodeClipboardWrites` (a windowed match on clipboard calls near the word
  "code") and `DETECTED_LINK_HREF_PATTERN` (`href={...url}` / `{...href}`).
- **The recorded message body carries a code and no link.** `guerrillaMessageFetched` holds
  `"<pre>Dear Random User, Thank you for using Guerrilla Mail\n\nYour code is 493028</pre>"`,
  so the codes half is reachable in the browser tier today and the **links half is not**.

See `proposal.md` for why, and `specs/website-client/spec.md` for what is required.

## Goals / Non-Goals

**Goals:**

- Copy a detected code, and open a detected link, both only on an explicit user action.
- Retain every property the two deleted boundary rules were standing in for, carried by
  requirements and tests instead of by a rule that forbids the feature.
- Move no token, no animation, and no package. `packages/ui` stays at 38 and `apps/web`'s
  count is the one to watch.

**Non-Goals:**

- Notification, `chrome.notifications`, and any background poll. The extension popup holds
  an inbox **count** from a user-asked check and no message list, so the roadmap's
  notification — which shows a code in its own body — would need the worker to fetch and
  parse on a cadence this repository has never measured.
- Filling a code into a form, and auto-submitting one. `docs/ROADMAP.md`'s fill rules are
  written for a stranger's page, which the website is not.
- Any extension-side copy or link, and any change to `packages/*`.

## Decisions

### D1 — The prohibition is removed, not amended, and the surviving half becomes a new requirement

`website-client`'s *"This slice shows what it found and does not act on it"* is
`REMOVED` rather than `MODIFIED`.

**Why.** Every clause of it is a prohibition and this slice delivers two of the three things
it prohibits, so nothing survives to be restated. But a `MODIFIED` block keeps the
requirement's **heading**, and that heading states the exact opposite of what the replacement
requires — and this repository has a promoted requirement whose title has disagreed with its
body before, in `page-composition`'s *"The page is five regions in a stated order"*, where the
count lived only in the heading until the apply stage had to move it.

The middle ground — keep the title, rewrite the body, and note that the title is historical —
was rejected: a reader scanning requirement titles would believe the title, and the whole
point of a heading is that it is the claim.

**The property is not lost with the rule.** `A detection is acted on only when the user asks`
is `ADDED` and carries the entire surviving half: opening a message copies nothing, follows
nothing, and submits nothing.

### D2 — One copy control per detected code, not one for the top-ranked code

**Chosen.** A control per code, each with an accessible name naming the value it copies.

**Rejected — a single control copying the highest-ranked code.** Less to read, one button,
and it copies the code the page believes is most likely. It is rejected because
`mail-parsing` guarantees no detection is ever reported as certain and `website-client`
already requires the page to say its detections may be wrong. **The page therefore cannot
know which candidate the user wants**, and a control that resolves that question on the
user's behalf is the page guessing at the one thing it has just told the user it does not
know. The ranking still orders the list; it does not choose from it.

**Rejected — copying only when exactly one code was detected.** It would read as tidier, and
it makes the control's availability depend on a coincidence, which is the "a control over
one reachable option cannot act" reasoning applied backwards: the single-code case is the
one case where the product is *least* sure.

### D3 — A per-code copy result is component-local state, not session state

Each code's copy result lives in `MessageView` as local state, mirroring `Address.tsx`'s
three-state result. It is **not** added to `SessionState`, `OpenedMessage`, or
`packages/mailbox`.

**Why.** It is the position of a control on this page and nothing else: it is not the
mailbox's state, it is not persisted, it does not survive closing the message, and no other
context can read it. Putting it in the session would mean a shared package carries a field
whose only writer is one component in one client — and `packages/mailbox` is
**framework-free and DOM-free by compiler**, which is exactly the property this repository
protects by `tsconfig` rather than by convention.

**The consequence, stated because it is a real limit.** Re-rendering the message resets every
copy result to idle. That is acceptable and is asserted as such rather than worked around: a
stale "copied" badge next to a code the user has not re-copied would be a false claim about
the clipboard, which is the exact failure mode `Address.tsx`'s comment exists to prevent.

### D4 — The anchor is real markup, not JavaScript

`<a href={link.url} target="_blank" rel="noopener noreferrer">`, with the host visible inside
it and the URL still rendered as text beside it.

**Why markup and not a click handler.** `javascript:` URLs, a synthetic click, and
`window.open` are three ways to make a link that a reviewer reads as inert do something
else. Real anchor markup is the form whose behaviour the platform, the browser tier, and a
user's own middle-click all agree on.

**`rel="noopener noreferrer"` is two requirements, not a hardening convention.** `noopener`
because a new tab opened without it hands the destination a `window.opener` reference back to
this page. `noreferrer` because this page's **URL carries a mailbox address**, so the default
`Referer` would hand the one piece of this product's data a user has an interest in keeping
to an unrelated site. Both are stated in the requirement so neither is dropped as noise
during a later edit.

**The host stays visible.** `VerificationLink.hostname` already exists precisely so a view
does not re-parse the URL, and the host is the part a user judges a link by. The URL text is
**kept**, not replaced by the host, because the previous requirement required it and a
shortened link is a link whose destination cannot be read before acting on it.

### D5 — The two boundary rules are deleted, and their two properties are given instruments

The clipboard-code rule and the detected-link-href rule are removed, because the
requirement they enforce is removed. **A rule retired with its requirement is not the same
event as a property dropped**, and the diff shows only the first.

Each property gets a named replacement:

| Retired rule | Property it held | Replacement instrument |
|---|---|---|
| `findCodeClipboardWrites` | rendering a message writes no code to the clipboard | the *nothing is copied* assertion plus the per-code control test |
| `DETECTED_LINK_HREF_PATTERN` | rendering a message navigates nowhere | the *opened with a link* assertion, in jsdom **and** in Chromium |

**Why not convert the rules into their opposites.** A rule that required an anchor's
`rel` to be present, or that required a copy control per code, would be asserting this
implementation's shape in a file whose subject is repository-wide boundaries. And the
properties are not expressible as prohibitions any more — that is the whole change.

**The one thing the rules could still do that tests cannot** is catch a *third* view added
later that grows its own copy button. That is stated as a limit on this design rather than
answered with a narrower rule, because the answer this repository reached on the previous
question is that a rule narrower than its own documentation is a capability failure in either
direction.

### D6 — A synthetic recorded message is added so the anchor is verified in a real browser

The recorded corpus has a message carrying a **code** and **no link**, so the anchor is
unreachable in the browser tier from the corpus as it stands.

**Chosen.** Add a clearly marked `SYNTHETIC` recorded step carrying a message with a
verification link, and assert in Chromium that the rendered anchor has the destination it
was found with, `target="_blank"`, `rel` carrying both `noopener` and `noreferrer`, and a
visible host.

**Why this is worth a fixture.** `jsdom` renders an `<a>` and cannot tell you what a browser
does when it is activated — that is the twenty-ninth recorded instance of a substitute
platform hiding a defect the real platform names, and this is the most safety-relevant
element the slice adds. The fixture is marked `SYNTHETIC` and uses a reserved
`.example`/`.invalid` domain, following the precedent already in `fixtures.ts`
(`guerrillaThrottled`, `guerrillaUnclassifiable`) and the corpus discipline in
`packages/mail-parser`.

**Rejected — unit coverage only.** It would have been free, and it would have left the one
new element that can navigate a user away from the page verified only by the platform this
repository has the most recorded reasons not to trust for navigation claims.

**Amendment, recorded at apply, 2026-10-09: the fixture did not work as first written, and
the cause is a fact about `mail-parser`.**

The first version put the destination in the message body as **plain text** inside the
`<pre>`, the way the recorded corpus's body is plain text. The browser case rendered
*"No verification link was found in this message"* on a page whose readable text plainly
contained the URL, and the accessibility snapshot Playwright wrote into `test-results/` is
what named it.

**Anchors are recovered from `<a href>` elements only.** `packages/mail-parser`'s extractor
is a small parser rather than a regular expression for a stated reason - a regex over the raw
string cannot pair an `href` with the text a reader sees beside it - and a URL nobody wrote
as a link is not an anchor. **This is the plan measuring false against the code, and it was
found by running the thing rather than by reading either side of it.**

The fixture now carries a real `<a href>`, which is what the mail it imitates would carry.
**The limit is real, is not fixed here, and is named rather than left for someone to discover
through the page:** a provider that delivered its verification destination as bare text would
produce a message this product shows the URL for and reports no link for. That is
`mail-parsing`'s behaviour and out of this change's scope. **This repository has never
received verification mail from any service**, so there is no measurement of which shape real
mail arrives in, and no fixture may stand in for one.

### D7 — The clipboard is verified in the unit tier, and the browser tier's limit is stated

`navigator.clipboard.writeText` in headless Chromium needs a permission the tier does not
grant, and the page's URL is a `file`-less `127.0.0.1` origin whose clipboard behaviour is
not something this repository has measured.

**Chosen.** The copy **outcome** — value unchanged, confirmation shown, refusal reported and
the code still selectable — is covered in the jsdom tier, where `App.test.tsx` already
stubs `navigator.clipboard` and already asserts both the success and the refusal arms for the
address. The browser tier covers that the control is **reachable and named**, not that the
clipboard took it.

**The limit is written down rather than left to be discovered.** This is the same shape as
the recorded `blocked-deleteDatabase` limit: a real behaviour verified on one substrate and
not corroborated on the other.

### D8 — No new token and no new motion, and the focus rule is extended rather than replaced

The copy control reuses `.control`, which is already in the `:focus-visible` rule and so
already draws a resolved outline this product declared. The anchor needs the same rule, so
`.link` is **added to the existing selector list** — one line, no new token, and the browser
tier's existing focus assertion then covers it.

**Why this is stated as a decision.** `visual-system` requires *every* interactive control
to have a visible focus indicator, and the extension's slice learned that an assertion
satisfied by the browser's own `outline: auto` proves nothing about a ring this product drew.
Adding the selector is what makes the existing `not.toBe("auto")` assertion meaningful for
the new control.

**Nothing animates.** The codes and links are already on screen when the message opens; a
copy result appearing is a text change inside an existing region, not an entrance, and the
`visual-system` motion requirement names three selectors.

**Correction recorded at apply: the selector is `.link__anchor`, not `.link`.** `.link` is
the `<li>`, and a `<li>` is not focusable, so naming it would have added a rule that cannot
match and would have left the anchor with no ring — a decision that reads right and changes
nothing. The stylesheet's list is now `.control`, `.inbox-row`, `.link__anchor`, and the third
entry is this slice's. **The class hook is not a rename for tidiness**: `link__anchor` is what
the anchor carries so a view could render one link in one row without the row itself reading
as activatable.

## Verification record

Measured at this change's apply stage, 2026-10-09. **Every number here came from a run in this
session**, and the instrument lived outside the repository tree — a measuring script left in
the root is something every future `pnpm lint` has an opinion about, which is what
`extension-preview`'s pass failed on.

**Nine deliberate violations, nine caught by the intended assertion.** `wrongcatch`, `green`,
`nocompile`, `noop` and `harness-error` are all **zero**, restoration was SHA-256 verified per
mutated file, and `dist/` was rebuilt from the restored source — no SHA covers a build
artefact, and `dist/` outlives the run.

| # | Violation | Caught by |
| --- | --- | --- |
| M01 | the copy control's label drops the code it copies | `MessageView` — *gives every detected code its own copy control* |
| M02 | the clipboard is given a value other than the detected one | same |
| M03 | the confirmation is shown on a **refused** write | *reports a refused clipboard and leaves the code on screen* |
| M04 | the write happens on **open** rather than on activation | *copies nothing when a message carrying codes is opened* |
| M05 | the `rel` attribute is dropped | *renders a detected link as a real anchor and follows nothing on its own* |
| M06 | `target` is changed to `_self` | same |
| M07 | the host is removed from the anchor's text | same |
| M08 | the copy control is removed from one code but not the others | *gives every detected code its own copy control* |
| M09 | `.link__anchor` is removed from the `:focus-visible` list | `verification-actions.spec.ts` — *the anchor draws a focus indicator this product declared* |

**M09 is not in `tasks.md` 6.1's list of eight, and it is the only one that reaches the browser
tier's new case.** It was added because the slice ships a new file in the browser tier, and a
green browser suite that no mutation can turn red is the recorded shape of coverage that
verifies nothing. The eight the task names are all present and all caught.

**Two mutations were also caught by a second assertion, and both are the same property rather
than a rival one.** M04 also fails *forgets a copy result when the message is shown again*,
because the effect fires again on the reopen and the clipboard receives a second write. M08
also fails *copies nothing when a message carrying codes is opened*, whose positive control
requires two controls to be on screen before it presses one. **A catcher that names another
assertion about the same property is an attribution to record; one naming an unrelated
assertion is the real defect**, and neither of these is the latter.

**One mutation needed a line-anchored edit, and the reason is worth recording.** `target="_blank"`
appears twice in `MessageView.tsx` — once as the attribute and once in the comment explaining
why it is there — so an unanchored replacement would have mutated the documentation alongside
the code. A mutation that only partly applied has been filed as a survivor before, and a
mutation that also edits prose is not evidence about an assertion.

**Two assertions this slice wrote were caught being unfalsifiable before the mutation pass
found them, and the first is the more interesting.** The browser focus case originally reached
the anchor with `element.focus()` and read its resolved outline: `style: "none"`. Chromium
applies `:focus-visible` only when focus arrived from a keyboard, so **every** focusable element
reads as though this product drew no ring anywhere — and the case would have passed with
`.link__anchor` deleted from the list, and with the whole focus rule deleted. It now tabs to
the anchor, bounded, and reports what focus last rested on when it gives up. **A case that
cannot fail on the defect it is named for is not coverage**, and this repository has now
recorded that shape many times over.

## Risks / Trade-offs

- **The codes list grows a control per row, and the list can hold several.** → The name
  requirement (`Copy 493028`) is what keeps the controls distinguishable to a screen reader,
  and it is asserted rather than assumed. A mutation that drops the name from the accessible
  name is the falsification target for this slice's D2 decision.

- **The copy result is lost when the message re-renders** (D3). → Asserted as the intended
  behaviour rather than worked around, because the alternative is a stale clipboard claim.

- **A third view could later add its own copy button**, which D5's deletion no longer
  prevents. → Stated as a limit on D5. The mitigation available today is the requirement,
  which any such view would violate.

- **The synthetic link fixture could be mistaken for recorded evidence.** → It is marked
  `SYNTHETIC` in `fixtures.ts` with a comment saying no mail from any such service was
  received, exactly as `packages/mail-parser`'s corpus does.

- **The footer's third limit is reworded, and `page-composition` requires every sentence a
  section states to correspond to something the product does.** → The reworded sentence names
  the two controls this slice ships and the user's asking, so it describes shipped behaviour.
  `sections.spec.ts` already sweeps the page's text, so a reword that drifted from the
  implementation would be caught there rather than left to a reader.

- **The `codes` list is index-keyed and stays so**, so adding a button per row does not
  change identity: the key is the rank plus the value, and the value alone would collide on a
  message that repeats its code.

## Migration Plan

None. No persisted record changes, no storage contract changes, no provider change, and no
message the page has shown before changes meaning. Rollback is reverting the commit.

## Open Questions

None that would change the specs, the approach, or the task breakdown.

One thing is worth recording as *not* an open question, because it looks like one: whether
the extension should get its own copy control for a code. It should, and it will, in a later
M10 slice under `extension-client`. Deciding it now would mean writing a requirement about a
surface this milestone does not build — which is the same defect `page-composition`'s
*"The section set is not invented by this slice"* exists to prevent.