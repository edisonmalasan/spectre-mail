# Design

## Context

The extension has three contexts and a message channel between two of them. The **content script**
runs on every `http`/`https` page and reads `chrome.storage.local` directly; it can insert an
address into an email field and, through delegation, can ask the **background worker** to create a
mailbox. The **popup** owns a `packages/mailbox` session and renders a count. The **worker** answers
one request and holds nothing.

Three facts shape everything below, and none of them is an assumption:

1. **The listing carries no detection.** `MessageSummary` has no codes or links, by construction —
   `packages/core` says so and gives the reason. A code exists only on an opened message.
2. **The content script cannot see `chrome.tabs`.** Measured this session: its world has no `tabs`
   namespace at all, so the reach a fill needs is one-directional, from an extension context.
3. **The popup can reach a tab, with no permission.** Measured below, in full, because it is the
   fact the whole slice rests on.

The write path into a page's field already exists and is already measured against React 19:
`content-script/insert.ts` sets the value through the prototype setter and then dispatches `input`
and `change`, and its own note records that assigning `field.value` alone leaves a controlled
component rendering a filled field that submits empty. **Nothing about filling a field is new. What
is new is deciding which field, and getting a value to it.**

## Goals / Non-Goals

**Goals**

- A code the user has seen can reach the open page's one-time-code field on one activation.
- No new manifest permission, no background polling, no new persisted record.
- One property for insertions, generalised rather than restated per caller.

**Non-Goals**

- Arrival notification, `chrome.alarms`, or any background context owning a session.
- Copying a code, or opening a verification link, from the popup.
- Remembering a filled code, or which field it went into. Nothing about a code is persisted.

## Decisions

### D1 — The popup delivers to the tab, and it costs no permission (measured 2026-10-10)

**This is the fact the slice depends on, and it was measured rather than assumed, in a throwaway
fixture outside the repository** carrying the shipped manifest's permissions verbatim — `storage`
only, `host_permissions` for the two providers, `content_scripts` matching `http://*/*` and
`https://*/*` — because a fixture that declared more would have measured a different extension.

Chromium 141, Playwright 1.63.0, headless, unpacked. A page was served at
`https://signup.invalid/signup` with an `autocomplete="one-time-code"` input. A **real action
popup** was opened with `chrome.action.openPopup()`.

| Question | Answer |
| --- | --- |
| Does the popup hold `chrome.tabs` without the `tabs` permission? | **Yes** |
| Does `chrome.permissions.contains({permissions:["tabs"]})` say yes? | **No — `false`** throughout |
| Does `chrome.tabs.query({active: true, currentWindow: true})` name the tab the popup is docked to? | **Yes** — it returned the id whose own reply carried `href: "https://signup.invalid/signup"` |
| Does `chrome.tabs.sendMessage` from that popup reach the content script there? | **Yes**, and the content script answered |
| Does that origin hold a host permission? | **No** — the only host permissions are the two provider origins |
| Does the reply carry the URL, as `tabs.query` would with the `tabs` permission? | **No** — `tab.url` is `undefined` throughout |
| Can the content script do this itself? | **No** — its world has no `chrome.tabs` (`hasTabs: false`) |
| Can the page see any of this? | **No** — the page's own world has no `runtime`, `storage` or `tabs` |

**So the extension learns a tab id and nothing else, and it does not need the URL** — the content
script knows which page it is in, and reports its own `href` in the reply. That is why the missing
`tab.url` costs nothing here, and it is recorded rather than left as a gap because "no URL" reads
like a limitation until a reader is told which limitation would have mattered.

**A broadcast is not an alternative, and the measurement says so.** Sending to *every* tab id
answered on exactly one tab; the others refused with *"Could not establish connection"*. Two things
follow, and the second is the reason this is a design note rather than a footnote: a fill cannot
work by trying every tab, and **it must not**, because that would put a verification code into the
content script of every page the user has open. Discovery is by `currentWindow`; delivery is to one
named tab.

**Three instrument defects, all found by running the probe rather than by reading it, and recorded
because each produced a confidently wrong answer first.**

1. **The first arm measured the wrong tab and said something true about it.** With the popup opened
   as an ordinary tab, `chrome.tabs.query({active: true, currentWindow: true})` returned *the
   popup's own tab*, and `chrome.tabs.sendMessage` to it failed with *"Receiving end does not
   exist."* Read alone, that is a clean negative result about delivery, and it would have been
   false. The fix was to record `chrome.tabs.getCurrent()` alongside the query and compare — and
   the two arms now differ in exactly that field, which is the control that separates them.
2. **The control I wrote for "was a popup really open" does not exist in MV3.**
   `chrome.extension.getViews` is not a function, and a control that cannot run is a control that
   cannot fail. The substitute is the one above: a real popup returns `null` from `getCurrent()`
   because it is not a tab.
3. **`"Receiving end does not exist"` has two causes** — no listener, or delivery refused — and the
   first version could not tell them. The fix was to have the content script stamp
   `data-probe-loaded` on the page's `documentElement` **at injection**, which the page can read
   without any message channel being involved. It read `"yes"` on every run, including the runs
   where every send failed — which is the observation that made the negative arms trustworthy.

`chrome.action.openPopup()` resolved but surfaced **no Page** to the harness, so the probe reads the
popup's findings back through the worker rather than through a page handle. A probe that waited for
a handle would have waited forever, and one that gave up and opened the popup as a tab would have
measured the wrong thing — which is defect 1.

**What this measurement does not establish**, stated because the list is the point: nothing about a
real signup page's markup, nothing about a site that marks its code field differently from the
fixture, and nothing about a page served in an iframe. The probe ran offline against one authored
document.

### D2 — This is not "arrival notification", and the reasons are measured

The roadmap's M10 opens with *"when likely verification mail arrives"* showing a notification. That
was the other option put to the user, and it was declined. Three reasons, two of them measured
already:

- **It reverses a committed requirement.** `extension-client` forbids the worker scheduling any
  repeated provider request and creating any alarm, and forbids any document claiming a background
  cadence this repository has not observed.
- **The two facts it would rest on are still unmeasured.** `measurement.spec.ts` established a
  *bound* — the worker was still registered after a 30 000 ms idle window — and no termination
  point. `alarm-floor.spec.ts` established what `chrome.alarms` **stores** (every period accepted
  down to 999.6 ms) and explicitly not when Chromium **fires** it; Chrome's documented packing to
  at most once per 30 seconds is unobserved here.
- **It needs two permissions the manifest does not declare**, and this capability's own scenario
  fails the build if the manifest requests a permission no shipped surface uses.

The honest consequence of declining it is stated in the specs rather than hidden: **a code is only
available after a check the user asked for.** That is a real reduction in what the product can do,
and it is the same reduction the popup's inbox count already carries.

### D3 — The user opens the message; the listing does not choose it

`MessageSummary` carries no detection, so the popup cannot mark which message holds a code. The
alternative — open messages until one yields a code — spends a provider request per message and
guesses.

**The user opens one message, and the popup renders its codes.** The shared session retains the
analysis of a message it has opened, so a second visit costs nothing, and that retention is already
required by `mailbox-session` rather than introduced here. This is the same division the website
already uses, and it is why the popup requirement forbids indicating that a message carries a
verification before it has been opened.

**Rejected: opening every listed message to find the newest code.** It is the behaviour a person
would want and the behaviour that costs the most at a provider, on a milestone whose provider
budget has never been measured against a real one.

### D4 — Delivery is a new message kind on an existing channel, and the worker is not in it

`protocol.ts` is already the one file both contexts read, and it already carries a request kind, a
matching narrowers on each side, and a `null` for every unrecognised shape. The fill adds one more
kind to that union and nothing else.

**The popup sends to the tab directly; the worker is not asked to relay it.** The worker knows
nothing about tabs, adding relay would put a tab id into a context whose requirement is that it hold
nothing after answering, and it would buy a second failure mode for no capability. The one thing
the content script cannot do — reach a provider — is not needed for a fill.

**One protocol hazard, and it is not hypothetical.** `chrome.tabs.sendMessage` without a `frameId`
is delivered to **every frame** in the tab. A page with an advertising iframe containing a field
that looks like a code field would receive the code as well. The mitigation is that the content
script which performs the fill SHALL be the top-level document's, and it SHALL refuse to fill when
it is not — cheap, and correct whether or not the delivery turns out to be as broad as documented.
**This repository has not measured per-frame delivery**; the check is defensive rather than a
response to an observation, and it is written down so nobody later reads the absence of a
measurement as an absence of the risk.

**And the browser tier cannot falsify that check, which is worth knowing before a reader counts it
as covered.** The manifest declares **no `all_frames`**, so no content script exists in a subframe
at all: a case built on a framed page would be satisfied by the script's *absence* rather than by
the top-frame test, which is this repository's most-recorded defect wearing a new hat. The check
therefore lives in the unit tier, where a framed `window` is one line, and `tasks.md` 6.3 says so
rather than listing a browser mutation it cannot run.

### D5 — A code field is recognised from named signals, and a numeric keypad alone is not one

The signals are stated in the requirement and they are narrow on purpose. `inputmode="numeric"`
requests a numeric keypad; it does not say what the number is, and quantity, price, card, telephone
and postcode fields all request one. **Requiring a name or id that identifies a code alongside it is
the whole restriction**, and `autocomplete="one-time-code"` outranks an inferred match because a
page stating a field's purpose is telling the truth about it in the one way a machine can read.

The alternative — fill whatever empty short input is nearest the focus — is the behaviour that puts
a discount code into a quantity box, and it is rejected for the reason the requirement gives.

### D6 — `insert.ts` is generalised, not duplicated

`insertAddress` becomes a function of a value rather than of an address. **A second writer would be
the defect this repository has recorded repeatedly**: two copies of "put a value in a field so the
page's own code sees it" drift, and the second copy is the one nobody re-measures against React.

The scenarios under the renamed requirement are restated over *any inserted value* rather than
duplicated per caller, so the property is checked once and both callers are covered by it.

**The prototype setter is held here and in no requirement, and the falsification pass measured what
that costs — which is that no case can fail if it is removed.** Both arms of that mutation were run:
in jsdom (23 cases green) and in real Chromium against React 19 (the browser case reading React's own
published state, green). So **the suite asserts the property the requirement names — the page's own
code reads the value back — and not the mechanism**, which is what the amendment beside that
requirement says in advance.

**What is measured, exactly:** on React 19 in Chromium, `element.value = code` followed by a
dispatched bubbling `input` event *does* reach `onChange` and the component's state — the value
tracker that makes the prototype setter necessary elsewhere did not stand in the way here. **What is
not measured, and is not claimed:** that any other framework, or any other React version, behaves the
same way. The setter is kept because it is the mechanism that reaches framework state, not because
this repository holds evidence that the plain assignment fails somewhere; a sentence asserting how
React behaves in general is exactly what this file refuses to write.

### D7 — "Which field?" is asked in this extension's own surface, and nothing is filled first

Where several fields qualify and none is preferred, the person is asked. **The question is asked in
the page's shadow root**, because that is the only surface available at the moment of delivery and
because the alternative — filling one and asking afterwards — is a decision already taken.

The control is removed once the person chooses or dismisses it, so it obeys the same "no control
outlives its answer" rule the email affordance already carries.

### D8 — No new token, no new motion, and no boundary rule is exempted rather than rewritten

`packages/ui` gains nothing: the popup's new controls reuse the `control` classes the popup already
renders, and no entrance is added. **Its test count must therefore not move**, and a rise would
mean visual surface no capability describes.

No boundary rule is relaxed. The one this change could have provoked is the rule confining the
extension's platform global to a single module — `chrome.tabs` is read from the popup and the
content script, so the delivery has to go through the module that already owns the platform rather
than beside it. **That is the rule being worked with, not widened**, and widening it would be the
cheaper-looking option and the wrong one.

### D9 — Closing a message is not forgetting it, and the browser tier found that by counting requests

**The requirement was right and the code was wrong, which is the outcome worth writing down because
the usual one is the reverse.** `mailbox-session`'s `A message already read is not read again` bounds
the retention to the current listing and to the mailbox being replaced, and names no third bound.
`OpenedMessages` had one method doing two jobs: `reset()` cleared the reported state *and* dropped
every reading, and `closeMessage()` called it.

The cost is one provider request, and it is invisible at the tier where the defect lives. The unit
suite was green throughout: the case asserting that `reset` sheds a reading passed, because `reset`
did; the case asserting that closing clears the reported state passed, because `close` clears the
reported state too. **The two methods were indistinguishable through everything either test could
observe, and the only observable difference is a request this repository never made.** The comment in
`opened.ts` said the retention "is not a change anyone can observe" — **which is true of the state
transition and false of the request**, and the false half was the one that cost something.

Found by `in-page-fill`'s browser case, which counted `/messages/{id}` requests in the recorded
traffic across a close-and-reopen and read **two where the requirement says one**. The fix splits the
member: `close()` publishes the state change and retains; `reset()` retains nothing and is now only
called on the mailbox-replacement paths. **No requirement changed, and no delta block was added for
it** — a repair that needs no specification is the outcome this repository's own rule produces when a
requirement was already complete.

Two cases hold it, and they are only meaningful together: `opened.test.ts` proves `close` retains
while `reset` sheds, and `session.test.ts` proves the *session* reaches `close` rather than `reset`.
The second is the one that would have caught the wiring, and it is cheap; the first alone would have
passed just as happily if `reset` retained too.

### D10 — What the browser tier held, and the one link it could not

**The tier drives the popup document opened at its own origin, not a real action popup window.** D1's
measurement was made against a real one with `chrome.action.openPopup()`, and the tier cannot be. The
reason was measured on 2026-10-10 rather than assumed: after `chrome.action.openPopup()`,
`context.pages()` was **identical before and after** — headless Chromium surfaces no page object for
an action popup, and `chrome.extension.getViews` does not exist in MV3. So the substitute is the same
module loaded from the same bundle at the same origin, and the one link it cannot hold is Chromium's
own toolbar button, which is not code in this repository.

**The substitute needed one thing arranged deliberately, and arranging it is also what makes the case
honest.** A popup document opened as a *tab* is its own active tab: measured in the same probe, the
popup reported `ownTabId` and `chrome.tabs.query({active:true,currentWindow:true})` returned **itself**,
and `sendMessage` to it answered with the page's own `{where:"content", hasTabs:false}` marker. So
`findActiveTab` would have named the popup. Every case therefore brings the **target page to the
front** before pressing — which is not a workaround invented to pass a test but the truth about a real
popup: the page the user was reading is the active tab, and the popup is a panel over it rather than
a tab beside it.

**What the tier does hold**, and it is the whole chain: a control in the popup, `chrome.tabs` in a
context holding `permissions: ["storage"]` only, `sendMessage` to an origin with no host permission, a
content script in the **isolated world**, and a write that lands in a **real React 19 controlled
input** — the last of which is the part no substitute platform can stand in for, and the reason this
file's cases read React's readback rather than the field's `value`.

### D11 — Reading the permission from the manifest Chromium parsed

The "no new permission" requirement is enforced against `chrome.runtime.getManifest()` in the running
extension rather than against the file on disk. **The source file is what was written; what a user's
browser grants is what was parsed**, and a build that dropped or added a permission on the way through
would leave the file unchanged. `manifest.spec.ts` reads the built file and this reads the running
extension, deliberately — two instruments, two facts, and neither able to answer the other's question.

The expectations are written out as literals (`["storage"]`, the two provider origins, and `tabs`
named explicitly even though it is already absent) because an expectation that imported the manifest
would move when the manifest moved.

### D12 — The branch that reported a write it had not performed

**The first version of `fill.ts` returned `{ kind: "filled" }` from outside the block that performed the
write.** It read

```ts
if (empty.length === 1) {
  const only = empty[0];
  if (only !== undefined) {
    insertValue(only.field, request.code);
  }
  return { kind: "filled" };
}
```

`noUncheckedIndexedAccess` makes `empty[0]` a `| undefined` even where the length has just been
checked, so the guard exists for the compiler; and the `return` sat **outside** it. **The path is
unreachable — a one-element array has an element at `0` — and the defect is not that it can be
reached.** It is that the arrangement says a thing that is not true: a branch that writes nothing
and says it wrote something, one edit away from being reachable.

**`filled` is the only answer in this union that claims anything happened.** `asked`, `noField`,
`fieldHoldsText`, `notTopFrame` and `notActedOn` are all facts about a page that a person can go and
check, and `filled` is the one that tells a person their code is in the form. A false `filled` is
therefore not a cosmetic defect: it is the single value in this feature that could put a code in the
wrong place while telling the person it went in the right one.

**What the repair is, and what it deliberately is not.** The branch is now written on the element
rather than on the count — `const only = empty.length === 1 ? empty[0] : undefined;` — so the guard
and the report are the same expression and a future edit cannot separate them, and the `fieldHoldsText`
arm moved below it rather than above. It is **not** a throw, and it is **not** a cast: this module's
contract says `handle` never throws, and `provider-config.ts`'s `primaryProviderName` shows the
shape this repository uses when it wants a compiler-forced branch to say something out loud — a
branch with a comment and a consequence. A cast here would have been a guess rendered as a type,
which is the thing that comment exists to warn against.

**How it was found, because the instrument that found it is the part worth keeping.** It was not a
test, not a gate, and not a mutation. It was **reading this file against the repository's own
established idiom** — `primaryProviderName` handles the same `noUncheckedIndexedAccess` situation by
handling it, and this branch handled it by falling through. **A change's own suite can be green about
a shape the rest of the repository would not have written**, because the suite was written alongside
the shape and neither was compared with anything.

**It was found after the falsification pass, not before it, and that has a cost worth stating rather
than hiding.** The pass had run all twenty-four arms green-by-intent against the tree that contained
this branch, and **no arm was aimed at it**, because the branch is unreachable and a mutation of
unreachable code proves nothing. The tree therefore changed after the pass, and the arms whose
mutated file is `fill.ts` — `U05`, `U06`, `U07`, `U08` and `W01` — were **re-run against the repaired
tree and caught by the same assertions**, with restoration verified by SHA-256 as before. **A pass
that had reported "twenty-four of twenty-four" without saying the tree changed afterwards would have
been reporting a property of a file that was no longer there.**

### D13 — Two measurement streams, and the run whose cause had to be measured rather than guessed

**One of the thirty repeat runs produced no measurement at all, and the instrument refused to call it
a pass.** The block runner reports `HARNESS-ERROR` when a run's output carries fewer than two tier
summary lines, because `pnpm test:browser` is `build && build:fixture && web tier && extension
tier` — a run with **no** tier summary never reached Playwright at all, and counting it would be
counting a run that did not run. That refusal is the reason the number is a question rather than a
discarded line, and the answer was not obvious.

**Two hypotheses were tested and both were false, and that is the part worth keeping.** *"A build
step failed because the falsification pass had just rebuilt the extension"* was tested by building the
extension twice and running `pnpm test:browser` immediately after: the run was green with both tier
summaries. *"Two concurrent `pnpm test:browser` runs collide"* was tested at a twelve-second gap:
both runs printed both summaries. Neither was the condition.

**The cause was found by reproducing the exact reported symptom rather than by reasoning about it.**
The instrument's own vocabulary — *tier summaries: 0*, *exit 1* — is the output of a run that died
before Playwright, so the question became *what makes a run die before Playwright*. Two
`pnpm test:browser` runs started at the **same instant** produced it on demand: the loser printed

```text
Error: Process from config.webServer was not able to start. Exit code: 1
```

**A fourth block then ran against the exact tree this change is committed as, and the distinction
between "the tree" and "the tree being committed" is worth measuring rather than asserting.**
`site-associations` had to establish it by hand — thirty runs on a tree differing in three
documentation files, and a search proving no build and no spec reads them. Here the block's
fingerprint files are written at **04:50:33** and **04:59:12**, and **none of the 413 source files has
a write time inside that window**: the latest is **04:40:40**, ten minutes before the block opened.
Ten runs, all green at 40 website and 63 extension, on the tree this commit ships.

**The instrument that established that was wrong twice first, and both failures are the shape this
milestone has already recorded twice.** The first stamped into a directory that did not exist, so
`Set-Content` failed as a non-terminating error, the function still returned a count, and the
comparison read a file that had never been written — **printing `files that changed during the block:
1` beside a comparison that never happened, naming no file.** The second excluded `dist/` and said so
in its own comment, and then swept in `apps/extension/test-results/`: the extension profile
directories Playwright creates and deletes on every run, so the same comparison reported **2930
changed files**, all of them written by the measurement. **A fingerprint that cannot tell a source
file from an artefact the measurement itself produces reports a change every time**, which is the
same defect as a sweep that matches nothing, in the direction where it looks busy rather than
vacuous. Both versions were discarded rather than repaired in place, because their output was
already wrong; the third takes a timestamp bracket instead, and `test-results/` and
`playwright-report/` are excluded by name with the exclusion written down.

and **zero** tier summaries. The website tier serves the built `dist/` through `vite preview` on
`127.0.0.1:4173` with `--strictPort`, precisely because of the recorded `http://127.0.0.1:4173/ is
already used` hang, so **the second run cannot bind the port and dies before the first tier starts.**
A twelve-second gap is enough to hide this because it lets the first run finish its build first —
which is why the first probe read "not reproduced" and was wrong to stop there.

**And why there were two streams at all is this session's own mistake, recorded rather than smoothed
over.** A block of ten runs was launched, then a `fill.ts` defect was found (D12) and the block had
to be abandoned. **Stopping the block *script* did not stop its wrapper**, so the wrapper continued
into the next block and a second series of runs carried on against a tree that was being edited and
re-measured at the same time. Its output — which reported three red runs and two harness-errors —
was **discarded and not counted**, and those reds are now explained by the same collision measured in
the other direction: two suites writing the same `dist/` and contending for the same port. **A
measurement taken while the tree is moving is not a weak measurement; it is not a measurement**, and
the right response is to throw the output away rather than to reconcile it.

**What the block instrument did here is the thing to carry forward.** It printed `HARNESS-ERROR`
rather than `passed`, it exited non-zero on that count, and its tally and its exit code came from the
same variables. **The recorded defect from `site-associations` — a completed block reporting
`exit 1` with no explanation and an aborted one reporting the same — is what this avoided**, and it
is why the tally reads `passed=9 failed=0 harness-error=1` rather than a clean ten.

### D14 — What the promotion destroyed, and the checker that could not tell

**The sync's promoter was rehearsed in full on a throwaway copy of `openspec/` before it touched the
real tree, and the rehearsal found a defect that would have silently deleted two requirements from
two capabilities.** The span end was computed as `Math.min(candidates) + 1`, where each candidate
index is the index *of the newline* preceding the next heading. Adding one consumed that newline, so
a replacement was spliced directly onto the following requirement's header:

```text
...rather than deleting the assertion### Requirement: The background service worker carries no polling...
```

**No requirement content was lost, and the file still parsed.** But that heading stopped being a
heading — `^### Requirement: ` no longer matched it — so `extension-client` fell from **six
requirements to four** and `in-page-integration` never gained its four, in a promotion whose
arithmetic was supposed to be `153 + 4 - 0 = 157`.

**What makes it worth carrying is that the promoter's own checks all passed.** It logged every
operation as performed, it re-read the file it had written, and it found every block it had written
byte-for-byte where it put it. The defect lived in the **separator between** two blocks, which no
check of a block's own bytes can see. **Only the verifier reported it, and only because it read the
promoted file with a different reader than the promoter wrote it with** — the structural
independence this milestone has relied on three times now, earning it a fourth.

The repair is a guard that names the property directly: after every replacement, the character
following the inserted block must be the newline that starts the next heading, or the run throws. A
second guard rejects any file in which a line *contains* `### Requirement: ` without *starting* with
it — the shape of this defect, read off the damaged output rather than off the requirement that
produced it.

**And the verifier had a defect of its own, in the expensive direction.** Its block reader located a
delta header with `indexOf`, and a delta file carries the same header text twice: once as the
requirement and once inside backticks in the `## RENAMED Requirements` section's `- TO:` line. The
substring search found the `TO` line, sliced a seven-line "block" whose first line ended in a
backtick, and reported **a byte-comparison failure against a promotion that was correct**. Repaired
by locating headers as whole lines. **A checker that reports a difference for the wrong reason is
worse than no checker**, because it looks exactly like a corrupt promotion and invites a repair to
the thing that was right.

**Both instruments were then falsified against the damaged tree rather than trusted.** Reinstating the
`+ 1` with the new guard removed reproduces the rehearsal's damage exactly, and the verifier
reports **8 problems, `extension-client` at 4 requirements, TOTAL 151 instead of 153** — naming the
loss rather than inferring it. A green verifier on a green promoter is worth nothing until it has
been seen to go red.

## Risks / Trade-offs

- **A page marks its code field in a way this change does not recognise** → the fill reports that it
  found no field rather than filling a wrong one; the signals are a requirement rather than a
  heuristic, so adding one is a spec amendment rather than a silent widening.
- **Several qualifying fields is common on real pages** → the person is asked rather than the
  extension choosing, which is slower and is the roadmap's own rule.
- **Per-frame delivery is documented but unmeasured here** → the top-frame check in D4, written down
  so its absence would be a decision rather than an oversight.
- **The user closes the popup mid-flow** → the fill happens on the click that triggers it, and the
  content script holds the control until the answer or a ceiling, so a report has somewhere to go.
- **A code is delivered into a page that is not the one the user is looking at** → impossible by
  construction: `currentWindow` names the active tab of the window the popup is docked to, and the
  content script answers with its own `href`, which the popup can report if it disagrees.
- **The extension's `host_permissions` list could grow to make delivery "supported"** → the
  manifest scenario fails the build, and D1 records that no permission is needed, so a growth would
  be unexplained rather than merely unnoticed.
- **The disqualifying list refuses a genuine one-time-code field** → it is a list of classes rather
  than a rule, so `giftCode` on a real gift-card flow is not recognised and the fill reports that it
  found no field. **That is the direction this feature fails in on purpose**: a page left untouched
  with an explanation beats a page with a verification code written into a checkout form, and the
  requirement's own framing ("nothing SHALL be filled into a field that already holds text") takes
  the same view of ambiguity. A list is also replaceable without a requirement change, which a new
  signal would not be.
- **The popup is not a real action popup in the browser tier** → D10: the substitute is the same
  bundle at the same origin, and the untested link is Chromium's own button rather than any code in
  this repository.
