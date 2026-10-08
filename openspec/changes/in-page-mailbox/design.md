# Design

## Context

See `proposal.md` — Why. What follows is only the state and constraints that shape the approach.

**The extension already creates a mailbox.** `apps/extension/src/Popup.tsx` calls
`session.open()` and then `storage.saveMailbox(next.mailbox)`, gated on `holdsMailbox(next)` so that
nothing is persisted before the provider confirms it. `App.tsx` builds the manager and the session
from `provider-config.ts`, `transport.ts` and `scheduler.ts`. So this change adds no new capability
to the extension and no new dependency; it makes a **request from a page** reach a composition that
already works, and puts the same "persist only after the provider confirms" rule on the path that a
person on a stranger's page actually takes.

**The in-page surface reads storage itself.** `content-script/controller.ts` takes
`Pick<SpectreStorage, "loadMailbox">` and its own comment records that `saveMailbox` and `clearAll`
are *deliberately not offered*. That decision survives here and is extended rather than reversed
(see D3).

**Three measurements were taken before this document was written**, in real Chromium (Playwright
1.63.0), against throwaway fixtures on two loopback origins, with no third party contacted. The
probes lived outside the repository tree; what survives is `docs/PROVIDERS.md` §4.4.

| # | Question | Measured answer |
|---|---|---|
| A1 | Content script's own `fetch` to a cross-origin host the extension holds `host_permissions` for, provider sending **no** CORS headers | **refused** — `TypeError: Failed to fetch` |
| A2 | The same request, provider sending `Access-Control-Allow-Origin: *` | granted, HTTP 200 |
| A3 | The same content script fetching **its own** origin (harness control) | granted, HTTP 200 |
| B | The **service worker** fetching A1's URL, provider sending no CORS headers | **granted, HTTP 200** |
| C | Content script → message → worker → provider | answered |
| D | Content script wrote `chrome.storage.local`, worker read it | same value |
| E | Round trip after idle gaps of 0 / 5 000 / 35 000 ms | 17 ms / 5 ms / 5 ms, worker still registered at 35 000 ms |
| F | Does `context.route` reach an extension's service worker? | **yes** — worker, extension page and plain page all fulfilled; handler saw all three requests |

**A1 alone proves nothing.** It is equally consistent with "the content script's fetch obeys the
page's CORS policy", "the host permission was never granted", and "Chromium blocked loopback". B
rules out a missing permission; A2 rules out a request that never left; A3 rules out a broken
harness. Only the shape A1-refused / A2-granted / A3-granted / B-granted is attributable, and any
other shape reports inconclusive rather than a verdict.

**A defect found by reading rather than measuring.** `apps/extension/src/scheduler.ts` calls
`window.setTimeout`. A service worker has no `window`, so the scheduler the worker must be given
throws at call time. It compiles, and no current test reaches it from a worker, which is exactly how
a defect of this shape survives.

**No promoted requirement covers the one-module platform rule.** `extension-client` says nothing
about it; `tests/architecture/boundaries.test.ts` enforces it as
`CHROME_PLATFORM_READER = /^local-area\.tsx?$/`. This change makes that module carry a second seam,
so it is the moment to give the rule a requirement rather than leave a boundary that only a test
holds up.

## Goals / Non-Goals

**Goals.** A page can obtain an address when this device holds none, by asking the extension rather
than by fetching anything itself. The request reaches a composition that already exists and obeys the
same confirmation-before-persistence rule the popup obeys. The worker holds nothing afterwards. The
page never states an outcome nothing observed. The extension's browser tier keeps serving recorded
provider responses, so no test contacts a live provider.

**Non-goals.** No polling, no alarm, no session held between requests, no inbox in a page, no site
association, no recently-used offer, no new design token and no new motion — the last two are slice
1's commitments and nothing here changes them. No provider is contacted by any test. No measurement
of a real provider's latency is invented (see D5).

## Decisions

### D1 — Creation is delegated to the background worker, because a content script may not do it

**Chosen:** the content script asks the background worker by message; the worker performs the
creation over the shared session and the provider abstraction.

**Forced by measurement, not chosen by preference.** A1/B establish that the extension's host
permissions do not cover a content script's own cross-origin request, and that they do cover the
worker's. The alternative designs are not equivalent:

- *Create in the content script.* Does not work, and fails **per page** rather than per provider —
  it would succeed on a page with a permissive policy and fail on one without, for a reason no user
  can act on. A product that works on some sites and not others, with no visible cause, is worse
  than one that works nowhere and says so.
- *Ask the page for permission first.* Rejected outright: a page cannot grant what its own policy
  withholds, and asking a stranger's page for anything on a stranger's form is a request this
  product should not make.
- *A SpectreMail-operated proxy.* Already forbidden by `AGENTS.md` and by `provider-abstraction`
  ("Provider APIs are never proxied"). Not a candidate.

**Cost:** the worker's lifetime enters the design. D2 answers for it.

### D2 — The worker holds nothing between requests

**Chosen:** each request builds its own session, opens, persists, answers, and discards. The worker
is a stateless function of a request.

**Because its lifetime is still unmeasured.** `measurement.spec.ts` establishes a 30-second idle
*bound*; this change's E adds a round trip measured after a 35-second idle gap. **Both are bounds,
and neither is a termination point** — 5 ms at a 35-second gap is evidence the worker was *alive*,
not evidence about when it would not be. Anything retained across events is therefore retained in a
context whose death nobody has measured. Retaining nothing makes that unmeasured fact harmless:
a woken worker and a cold one behave identically, because there is no state whose absence the cold
one would notice.

**Considered and rejected: a session that lives in the worker.** It is what the website does, and it
would make "create once, insert many" cheaper. It trades an unmeasured lifetime for a measured one
that has not been taken. `extension-client`'s existing requirement already forbids building on that
assumption; this change amends that requirement to forbid retention rather than merely polling, and
the amendment is in the delta.

**Considered and rejected: keeping the session in the content script**, which lives as long as the
page. It cannot work at all — D1 — and the record of why is now in `docs/PROVIDERS.md` rather than in
a comment nobody reads.

### D3 — The worker persists; the page does not

**Chosen:** the worker stores the new mailbox before it answers. The content script's storage
surface stays `loadMailbox` only.

The alternative — widen `InPageOptions` to `saveMailbox` — was rejected for a reason that is about
failure reporting rather than tidiness. Creation and persistence then live in **two** contexts, so
"the provider confirmed it, the write failed" is a state one of them must notice and the other can
never see. Keeping both in the worker leaves exactly one place where a created mailbox is either
stored or reported as not stored.

The page still *reads* storage after an unanswered request (D5), and that read is the one case where
it needs to: it is asking whether something now exists, not writing one.

**The stored record is the same one.** `spectre-storage` needs no amendment: its `chrome.storage`
adapter requirement already covers a second extension context using the same contract, and its
"`null` means exactly one thing" rule is what makes the page's post-timeout read honest — a read
that rejected is not a read that found nothing.

### D4 — The one platform reader is renamed rather than widened

**Chosen:** `apps/extension/src/local-area.ts` becomes `apps/extension/src/extension-platform.ts`
and supplies both the local storage area and a narrow messaging seam, with
`CHROME_PLATFORM_READER` retargeted to the new name.

The module's own comment states the naming rule it follows: *the name says what the module supplies
rather than what it names*. A module supplying two things needs a name covering both, so
`local-area.ts` becomes false the moment a messaging seam is added to it — and a module whose name
has stopped describing it is how the next change ends up exempting paths by keyword.

**Rejected: a second permitted module.** It would weaken *"exactly one module"* to *"two modules"*
to serve a naming problem, and a permitted list is the mechanism by which a one-module boundary
becomes an N-module boundary without anybody deciding anything.

**Rejected: keeping the name.** Three options are available and two are worse: a carve-out exempting
any specifier containing a word would exempt a future path that reaches the global — the exact
mistake `local-area.ts` was renamed to escape — and a second copy of the read in the worker is the
duplication the boundary exists to prevent.

`extension-platform.ts` contains no `chrome` token in its path, so the rule's original false positive
(the file being called `chrome-platform.ts` while the rule matched the identifier) cannot recur.

### D5 — The wait has a ceiling, and crossing it produces a **read**, not a claim

**Chosen:** the page waits a stated interval; if no answer arrives, it re-reads this device's stored
mailbox. A mailbox found there is the created address and is inserted. None found means the copy
says SpectreMail **could not confirm** an address was created, never that none was created.

**The ceiling cannot be derived from a measurement, and pretending otherwise is the defect this
decision exists to avoid.** The 5–17 ms round trip in E measures *the worker's* latency against a
loopback origin. No provider latency has ever been observed here, and Mail.tm's published limit
(`30; w=60`) is a creation **rate**, not a duration — `provider-abstraction` requires a stated limit
to be obeyed and never converted into a schedule. So the interval is declared as **this product's
own choice**, in the module that uses it, with that reasoning attached, and it is not printed
anywhere: `website-client` forbids the page showing a cadence it has not measured, and the same
rule applies here.

**Why a read rather than a failure.** It converts "did it work?" from a guess into a measurement the
page is already equipped to make, and it removes the duplicate-creation case that a bare "it failed,
try again" would invite. If the worker succeeded late, the mailbox is already stored, the page finds
it, and it inserts — so the person pressing again gets a second mailbox **only** when the first
genuinely did not happen.

**Considered and rejected: no ceiling.** A permanently stuck button is a defect, and "the page's
wait" has to be stated for a reader to know what stuck means.

**Considered and rejected: `INBOX_POLL_CEILING_MS` from `packages/mailbox`.** It is 30 000 ms, it is
already imported by a browser spec precisely because hand-picking a number large enough is the
recorded defect — but importing it here would assert that a creation completes inside an **inbox
polling** ceiling. That is a category error, and the shared cadence means nothing to this request.

### D6 — The message seam is typed on the way out and validated on the way in

**Chosen:** a shared module declares the request and the answer as a discriminated union; the sending
side narrows the platform's untyped reply, and the receiving side acts on nothing it has not checked.

`chrome.runtime.sendMessage` answers with whatever the other side put there, untyped. A page is
arbitrary input to a content script and a content script is arbitrary input to a worker, so the
reply is treated as data to be **verified** rather than trusted. Both halves are required: a type
annotation on the request alone would leave the answer unchecked, which is the half that matters.

### D7 — One request per activation, enforced by the control's own state

**Chosen:** while a request is outstanding the affordance reports that it is waiting and cannot be
activated again.

Two activations create two mailboxes at a provider and discard one. That cost is outside this
product and there is no way to undo it, so the outstanding request is a thing a person cannot start
a second of. The requirement states it, and the negative half is falsifiable in the browser tier: a
second activation produces no second provider request.

### D8 — The control outlives a focus change only while an answer is outstanding

**Chosen:** `focusout` still removes the affordance, except while an answer this extension asked for
is outstanding.

Without the exception, a person who presses the control and tabs to the password field loses the only
place the answer could be reported, and the field the address belonged to is one they have left.
The exception is bounded to one outstanding request and is removed the moment the answer arrives,
so it does not make the control persistent — which is the property the capability's whole first
requirement exists to protect. The amended clause is in the delta.

### D9 — The browser tier keeps serving recorded responses

**Chosen:** the delegated path is browser-verified through `context.route`, against the **built**
extension, with the worker's provider requests fulfilled by the harness.

Measurement F is what makes this a decision rather than an assumption. Playwright's interception of
service-worker requests has historically not reached them, and had it not, the alternatives were a
fixture extension (weakening every claim that says "the built extension"), a live call (breaking the
one-live-call rule), or unit coverage only. F establishes none of those are needed.

**The route must also cover the worker's requests, not only the page's** — the existing extension
tier routes provider traffic, and a case whose assertion only holds when the worker's request was
fulfilled would be a case that silently depends on a live provider the rest of the time.

### D10 - A late answer inserts nothing, and the address is still recorded

**Chosen:** after the ceiling has passed and the page has reported it could not confirm, an answer
that arrives afterwards writes nothing into the field. The created address is recorded as this
device's mailbox, so the next field focus offers it rather than offering a creation.

**This decision did not exist when the change was proposed, and the gap it closes was in the
proposal's own scenarios.** D5 names a ceiling precisely because a provider round trip is not bounded
by anything this product decided - which means a late answer is *the case the ceiling exists to
create*, not an edge around it. "The wait passes and nothing was stored" ended with the affordance
remaining available and said nothing about what a subsequent answer does.

**Two halves, and the second is the one that is easy to leave out.** Inserting nothing is the
obvious half: the page has already told a person it could not stand behind the request, and writing
into the field afterwards is acting on an offer it withdrew. **Recording the address anyway is the
half that costs something to get right.** D3 has the worker persist a mailbox *before* it answers,
so a late `created` answer describes a mailbox that is real and is this device's. A controller that
learned the address only by inserting it would offer to create a **second** mailbox on the next
field focus - and the requirement already states the cost of permitting a further request, so this
would be a second way of paying it, silently, on the path nobody would think to check.

**Considered and rejected: insert on the late answer too.** It is the more helpful behaviour when the
field still has focus and is empty, and it is still wrong: the page has said "could not confirm", and
an address appearing afterwards without explanation is the product contradicting itself in the one
place there is no region to explain the contradiction in.

**Considered and rejected: ignore the late answer entirely.** Correct on the field, and wrong on the
device - it leaves a stored mailbox the controller does not know about, which is the same "create a
second mailbox" defect by a shorter route.

The amendment is in `specs/in-page-integration/spec.md`, recorded in place with the reason.

### D11 - The outstanding-request exception lives in the focus *arrival*, not the departure

**Chosen:** while a request is outstanding, no focus event anywhere on the page changes the
affordance - it stays where it is, and nothing new is offered.

**Found by the browser tier on its first run, and it was in the wrong place.** D8 put the exception
in the *removal* branch, which is where the proposal put it, and which is why onFocusOut returns
early while a request is outstanding. That branch is correct and it is insufficient: **ocusin
reaches the same controller for whatever was focused next**, and every branch of onFocusIn either
removes the control or builds a new one. A person who pressed *Create* and then tabbed to the next
input lost the control on every one of those paths - and the failure looked like a hung request,
because the request was genuinely still in flight and genuinely had nowhere left to be reported.

**The unit tier could not have found this**, which is worth stating because it is the shape of the
defect. content-script-create.test.ts dispatches ocusout and ocusin by hand, and its
"keeps the control when focus leaves" case asserts the count immediately after ocusout. That
passes on the shipped code. The failure needs the two events the platform delivers in one task - out,
then in - with nothing dispatched between them, which is what a real focus move is and what a
hand-dispatched pair is not.

**The second half is the one that is easy to omit.** While a request is outstanding, address is
still 
ull, so an affordance built for the newly focused field would offer *creation* - and
askForAnAddress returns immediately because outstanding is set. That is a control that cannot
act, drawn inside somebody else's form, whose only reachable outcome is to report a provider
failure by doing nothing. Returning early prevents it, and it is the same reasoning
\in-page-integration\ already applies to a device whose boot read failed: **a control whose only
reachable answer is a guess is a control that cannot act.**

**Considered and rejected: let the new field take over.** It would keep a control visible per field
and let the answer land in a field nobody asked for. The request records the field it was made for,
so the answer would insert into a field the person has left - the same mistake the late-answer rule
avoids, reached by a different route.

### D12 - A refusal reaches the page as the adapter's report, not a provider's body

**Chosen:** the control's name is the extension's composed refusal report - the manager's sentence
naming every provider that was asked, and for each one its id, its normalised error code, and the
condition in full.

**The proposal's wording was false and this records that rather than quietly matching the code.**
The proposal required a refusal *"in the words the provider used"*, and the browser tier's first
refusal case read the control's name in real Chromium and found
\No configured provider could create a mailbox.\ followed by \mailtm: RATE_LIMITED - Mail.tm is
throttling this request while creating a mailbox.\ **The provider's raw body never reaches this
surface**: the adapter classifies a throttled creation as \RATE_LIMITED\ and substitutes its own
sentence, and the recorded body (\Too many accounts created. Please wait and try again.\) is
discarded before the page is involved at all.

So the requirement was amended, and the amendment is not a loosening: *"the provider's own words"*
was **uncheckable as written** - nothing defined what those words were, so any prose would satisfy
it - while naming the provider, the code, and the condition in full is something a reader can go and
look for. **Carrying the raw body through instead would mean widening \provider-abstraction\'s error
contract**, which changes what every client shows and is not this change's business.

**One consequence worth stating, because it is how this branch is reached at all.** The extension's
manager prefers Mail.tm and falls back, so throttling only Mail.tm produces *a mailbox created by
Guerrilla Mail* - correct behaviour, and unreachable as this branch. Every case that exercises it
stages two refusals, and **Guerrilla's 429 is synthetic**: none was ever observed. So the tier
establishes that a refusal reaches the page when no provider could serve the request, and nothing
about what any one provider does when it refuses.

### Risks / Trade-offs

- **[The worker is terminated and never wakes, so a page waits out its ceiling]** → the page's
  post-ceiling read still reports honestly, and the copy says *could not confirm* rather than
  *failed*. The alternative — a longer wait — cannot fix it, because the question is unbounded.
- **[A person presses again after an unconfirmed outcome and a second mailbox is created]** →
  accepted and stated in the requirement, not prevented: refusing the request would leave somebody
  who was told nothing with no way forward, and the possibility is disclosed in the spec rather than
  left to be discovered.
- **[The message seam's answer is wrong-shaped and something acts on it]** → the union is validated
  at both ends, and each refusal shape is a named variant rather than a string, so an unrecognised
  shape degrades to "no answer" instead of to a claim.
- **[The renamed module's boundary rule is retargeted to the wrong thing]** → the rule keeps its
  negative control, and the retarget is verified by planting a probe at a fresh path and watching it
  reported, not by reading the pattern.
- **[`docs/PROVIDERS.md` grows a section asserting platform behaviour]** → each row states what it
  does **not** establish, as §4.2 does: nothing about a live provider, nothing about a real provider's
  latency, nothing about how long the worker survives.


- **[The worker's absence rule listed identifiers it has never mentioned]**  → `createMailboxSession`
  and `createExtensionProviderManager` had been passing by import indirection, so the rule could not
  fail however the worker behaved - the thirty-first recorded instance of a check narrower than its
  rule, and the first that was *true while guarding nothing*. It now reads the property the
  requirement was amended to name: neither the worker nor the module that performs the work may
  declare a module-scope binding, because that is the only shape a value surviving a request can take.
- **[The renamed module's boundary control now fails loudly on a rename]**  → it copied the reader
  by its old name and stopped with `ENOENT`, which is the outcome worth having. A control that fell
  back to "any reader-shaped file" would have kept passing while the exemption covered a path nothing
  shipped.

## Migration Plan

None. No stored record changes shape, no version bump, and the `chrome.storage` key is unchanged.
A person who already has an address is unaffected: the creation offer appears **only** when this
device holds none, so the insertion path from slice 1 is unchanged for every existing user.

Rollback is the revert of this branch. The only externally visible additions are a control that
appears when this device holds no address, and a request a page can make of the extension.

## Open Questions

None that change the specs, the approach, or the task breakdown. Two things are deliberately left
**unmeasured and unclaimed** rather than open: how long a real provider takes to create a mailbox,
and when an MV3 worker is actually terminated. The first is why D5's interval is declared as a
product choice, and the second is why D2 retains nothing. Neither blocks this slice, and a later
milestone may measure either without amending anything here.

## Falsification

Fifteen deliberate violations, run against the working tree with the tree restored and verified by
SHA-256 after each. **Fourteen were caught by the assertion each was aimed at; one is recorded as
evidence and not counted.** The instrument lives **outside the repository** - a measuring script left
in the root is something every future `pnpm lint` has an opinion about, and `extension-preview`'s
verification pass failed on exactly that, with four temporary scripts deleted rather than fixed.

**And one assertion did not survive its own first mutation**, which is the finding worth leading
with, so it is written first.

### The one-request claim rested on a mechanism that never ran

`M03` deletes the guard inside `askForAnAddress` that refuses a second request while one is
outstanding. **The whole workspace stayed green at 844 of 844.**

The reason is worth keeping because it is not about the guard. The case that carried the requirement
pressed the control twice with `HTMLElement.click()`, and **`click()` respects `disabled`** - that is
what `disabled` means on this platform - so neither press ever reached the handler. The case was
asserting the *button's state*, and the case's own comment claimed it would also have caught a guard
in the handler. It would not have. **The requirement is that a provider is asked once; the evidence
was that a button is disabled; and only one of those is the claim.**

This is the repository's most repeated defect shape - an assertion narrower than the rule it
documents - and it was **authored and caught inside this change**, which is the third time that has
happened and the first time it was a *precondition* that could never fail rather than an assertion
pointed at the wrong thing.

A case now reaches the handler by `dispatchEvent`, which bypasses activation behaviour, and reads the
control's own refusal first so it cannot be satisfied by a button that never became disabled. **It is
the second half rather than a replacement**: a dispatched event is not a press a person can make, and
the requirement is about a person.

### The table

| # | Tier | Deliberate violation | Caught by | Outcome |
| --- | --- | --- | --- | --- |
| M01 | unit | the `onFocusIn` outstanding arm deleted | `ignores focus arriving elsewhere while a request is outstanding` | caught |
| M02 | unit | **the same arm narrowed** to a condition false whenever consulted | the same case | caught |
| M03 | unit | the one-request guard in `askForAnAddress` deleted | `asks once even when an activation bypasses the disabled control` | caught, **after the case above was written** |
| M04 | unit | the control never re-offered after the wait passes | `reports that it could not confirm when nothing is held, and stays offered` | caught |
| M05 | browser | the unconfirmed label claims `no mailbox was created` | the page-text sweep in `in-page-create.spec.ts` | caught |
| M06 | browser | the ceiling pushed to `2_147_483_647` | the same case, after waiting the real ceiling | caught |
| M07 | unit | the worker's `saveMailbox` removed | `creates through the shared session, stores the mailbox, and only then answers` | caught |
| M08 | unit | a module-scope binding in `create-mailbox.ts` | `retains nothing, so a woken worker and a cold one behave identically` | caught |
| M09 | unit | a platform handle cached at module scope in `service-worker.ts` | the same case | caught |
| M10 | unit | `CHROME_PLATFORM_READER` retargeted to the file's pre-rename name | `keeps the extension platform global to one module` | caught |
| M11 | unit | **a fresh path planted**, which the rule must report by name | the same case | caught |
| M12 | unit | the answer reader invents a `created` address from an unrecognised message | `reports no answer for a variant this product does not write` | caught |
| M13 | unit | a thrown platform call answered as a provider refusal | `resolves no answer when the platform throws rather than answering` | caught |
| M14 | unit | a payload added to the payload-free `notActedOn` answer | `answers notActedOn for a message it does not recognise, without asking anything` | caught |
| M15 | browser | the account-creation hold gate removed | **the case's premise, not its claim** | evidence |

### Four results in that table are worth reading twice

**M05 cannot be caught by the case's own text assertion, and that is why the sweep is there.** The
case asserts `toHaveText(AFFORDANCE_UNCONFIRMED_LABEL)`, and `AFFORDANCE_UNCONFIRMED_LABEL` is
imported from the very module the mutation edits - so a literal assertion on a constant cannot fail
when the constant changes. The sweep over the page's text is the only assertion in the file that can,
and it is the one that caught it. **A case carrying both a literal assertion and a sweep is not
redundant.**

**M06 is the only instrument in this repository that can fail, because it is the only one that waits
the real number.** Every unit case advances timers by `IN_PAGE_CREATE_CEILING_MS` itself, so
lengthening the constant to twenty-four days leaves all of them passing. **An assertion that imports
the value under test cannot fail when the value changes.** This is the same finding as
`AGENTS.md`'s `INBOX_POLL_CEILING_MS` entry, reached from the opposite direction: there the ceiling
was too small and a hand-picked fix would have drifted; here there is no fix at all, only an
instrument that reads the product's own value.

**M14 was declared `nocompile` before it was run, and it compiled.** That was a prediction about the
type system rather than a measurement: an answer carrying an extra field on a payload-free variant
passes `tsc`, because the return position never sees an object literal excess-property checking would
have caught. **So the type is not what keeps that payload out - the assertion is.** Had the row been
filed on the strength of the prediction, this list would carry a claim no run established. The
harness reports a declared outcome that turns out wrong as an explicit `MISMATCH` for the same reason
it reports a mutation that did not compile as its own class: *a mutation that cannot compile is not
evidence about an assertion*, and neither is a prediction that one will.

**M15 was predicted to be a reliability measure, and it is load-bearing for something.** This entry's
first text followed `M7 slice 2`'s held-listing finding: a hold that only makes a wait dependable, not
the catcher. Measured, the case fails at its **second activation** - `dispatchEvent` cannot find the
button, because without the hold the answer arrives, the address is inserted, and the control is
**removed**. So the hold is load-bearing for the case's **premise**: without it there is no
outstanding request, no second activation, and no test of "a provider is asked once" at all. The case
would still have read as the test it names. It is recorded as evidence rather than counted because
what the run establishes is about the case, not about the product - a tally reading `caught` would
credit an assertion with a defect the product does not have.

### The instrument was wrong five times before it produced that table

1. **Every runner path was hardcoded to the repository root.** `vitest` and `typescript` are root dev
   dependencies; `vite` and `playwright` are not, because pnpm does not hoist a workspace member's
   dependencies. **The final rebuild reported `MODULE_NOT_FOUND` after all fifteen mutations had been
   applied and restored** - and that is the exact shape of the recorded `archive-bytes` defect: a
   measurement of the instrument rather than of the thing measured. Both are now resolved from the
   package that owns them, so a dependency bump cannot break the instrument either.
2. **`vite/bin/vite.js` is not an exported subpath.** `vite` declares an `exports` map that does not
   publish `bin/`, so resolving it directly fails with `ERR_PACKAGE_PATH_NOT_EXPORTED`. The manifest
   is resolved and the entry joined onto it, which is the spelling that works for a package that keeps
   a manifest out of its export map - which is most of them.
3. **Playwright was resolved from `apps/web` and then from `playwright`.** Neither exists there: both
   clients declare `@playwright/test`, whose own `cli.js` is the binary. A missing runner produces no
   output, and *no output read as green* is the single worst failure mode in this repository's
   instrument history - it is why `harness-error` is an outcome class at all.
4. **`M04`'s declared catcher was a browser case that two unit assertions already covered.** The run
   said `wrongcatch`, and the reason was worth recording rather than re-running until it agreed. **A
   `wrongcatch` naming an assertion about the same property is an attribution to fix; one naming an
   unrelated assertion is the real thing.**
5. **`M12`'s declared catcher was that file's *control*, and the control was correctly unaffected.**
   The control asserts the reader is *permissive* where it should be, so making the reader permissive
   cannot fail it; the seven rows that assert refusals are what carry the requirement. **A control
   surviving a mutation is the control working.**

And one of the five was found by a mechanism rather than by reading: with `catcher: null`, the
Playwright `-g` pattern fell back to one from an unrelated spec, so `M15`'s first run recorded a
failure in a file the mutation had nothing to do with. **A recorded observation about the wrong test is
worse than no observation**, and every evidence row now names the case its run is pointed at.

### What this block does not establish

**The mutations establish that the assertions can fail, which is not the same claim as that the
product is right.** Every number here is about this repository's own checks. In particular: the
content script's delegated request was never made against a live provider, the ceiling has never
elapsed against a real provider round trip, and no test in either tier reads a rendered pixel - so
what the affordance looks like inside somebody else's page is still a human judgement, and that task
is left unticked for the same reason slice 1 left it unticked.
