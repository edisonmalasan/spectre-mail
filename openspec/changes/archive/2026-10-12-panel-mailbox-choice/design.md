# Design

Ten decisions. Each is a fork this change took **knowing** it took it, and each names the
alternative it rejected and the cost of that choice — because a design record that only says what
was chosen cannot be reviewed, and this repository's rule is that the cost of a decision is part
of the decision.

**D10 is the one that is not a fork.** It is a defect this change found in its own delta and
repaired, recorded in the same list and the same form because **a repair whose reason is not written
down reads as a cosmetic edit the next time the clause is touched.**

## Context

Only what shapes the approach; `proposal.md` carries the motivation.

**The shipped panel's `panel-held` is a list of `<span>`s.** `Panel.tsx:540-551` renders it when
`held.length > 1`, newest first, each entry a `<span className="panel__held-address">`. It is
already gated on more than one mailbox, already names only mailboxes the device holds, and already
carries its order from `PanelRecords.loadMailboxes`. **Everything a chooser needs to be correct
about is therefore already computed; what is missing is a control and a piece of state.**

**The panel's mailbox is derived, not owned.** `Panel.tsx:275-283` computes `shown` by calling
`resolveForHost(held, reading.host, associated)`, and `:293-294` finds the whole `Mailbox` record
for the id that came out of it. The `restore` effect at `:310-315` compares that id against the
session's own and restores only when they differ. **A chooser does not need a new pipeline — it
needs one more input to the same one.**

**`panel-address` is guarded on `shown.kind === "named"`, and the guard has a recorded reason.**
`Panel.tsx:478-484` says the *section*, not the text, is the claim, because the addresses the
device holds render anyway under `panel-held`; `Panel.test.tsx:931-943` holds it that way. **This
guard is the seam the chooser meets**, and D4 states the rule for it.

**The panel already has a `host` reading that is not always a host.** `HostReading` is a four-way
union and only `named` may claim a mailbox is a page's (`:100-104`). The create control beside it
was deliberately widened to `shown.kind !== "named"` (`design.md` A17 of the previous slice), and
`panel-held` is **not** gated on the host at all — which is why `Panel.test.tsx:940` can assert the
inventory is still on screen beside a page the panel cannot name.

## Goals / Non-Goals

**Goals**

- One control per mailbox this device holds, on the surface that already lists them, so the roadmap's
  *recent mailboxes* is **offered** rather than named.
- The chosen mailbox becomes the mailbox **this panel view is about**, through the existing `shown`
  / `record` / `restore` chain, with no new session call and no new seam.
- A selection state that survives a re-resolution of the same host, dies on a host change, and
  leaves nothing on disk.

**Non-Goals**

- **Not a second host→mailbox rule.** See D3.
- **Not a durable preference.** See D2.
- **Not the singular-record merge** it unblocks. See D7.
- **Not "whether verification mail is pending".** See D8.
- **Not a menu inside somebody else's page.** The in-page affordance's limit stands, narrowed rather
  than lifted.
- **Not a new permission, a new manifest key, a new message kind, a new boundary rule, a new token,
  a new motion, or a change of any kind under `apps/web/`.** Each of these is a counted property
  `tasks.md` holds rather than an intention.

## D1 — This is an amendment, and the delta says so where a reader will hit the question

The promoted requirement said *names the mailboxes this device holds most recently* and the shipped
panel rendered them as inert text. **Those two statements were consistent with each other.** So the
first change this proposal makes is to its own framing: the delta opens with the amendment rather
than with a defect, and `tasks.md` records that the code is not being "fixed" from a broken state.

**The alternative — file it as a repair, and quietly repair the requirement's wording** — was
rejected because it puts a sentence in the promoted spec that no evidence supports. Four claims of
that shape have already been retracted in this repository, and a fifth would be the first one
introduced on purpose.

**The cost of this choice is real and is named:** a reader who only reads the *new* spec will not
learn that the panel once satisfied the old one, because the amendment paragraph lives inside the
requirement block rather than above the capability. That is the same trade `in-page-address`,
`in-page-fill`, `incoming-mail-notification` and `side-panel-surface` each made, and it is why the
non-goals requirement keeps its whole amendment chain rather than a summary of it.

## D2 — The choice is transient, and the recorded alternative is rejected here rather than later

**The decision.** A chosen mailbox lives in component state, keyed by the host it was chosen for. It
survives a re-resolution of that same host; a different host discards it; **nothing is written.**

**The rejected alternative — a recorded choice.** It would write `location.hostname -> mailbox id`,
which is exactly what `site-associations` already stores, and it would make a person's pick in the
panel change what the **in-page control offers on that host tomorrow**. It was rejected for three
reasons, in order of weight:

1. **`in-page-integration:563-567` says the association is written by an insertion**, and states why
   in terms that make a second writer the actual hazard: a page can make a field take focus by
   script, so anything recorded on a *view* lets a site decide which mailbox this device offers on
   a host it mentions. **A panel choice is not an insertion and the panel inserts nothing**, so a
   recorded panel choice would put an intention into the one record whose safety rests on being
   written by a confirmed use.
2. **It would be a second writer.** `content-script/controller.ts` is the module that writes the
   association, and `Panel.tsx:68-72` says so explicitly — *"recording a host is the content
   script's job after an insertion: this panel never inserts anything, so it has no insertion to
   remember."* That comment is currently accurate **because nothing here writes**. A recorded
   choice makes it a lie, and the lie would be in the file whose job is to keep the write single.
3. **It would silently change a surface this change does not own.** The consequence of a recorded
   choice lands on the content script's offer. Shipping that as a side effect of a panel change is
   the exact thing `in-page-integration`'s deferral note refused — *"added as a side effect."*

**The cost of this choice**, stated rather than omitted: **a person who picks a mailbox and closes
the panel has picked nothing permanent**, and on their next visit to that host they get the rule's
answer again. That is a real annoyance and it is the right trade here — the alternative buys
convenience for one person by removing the property that makes the record mean what its name says.

**The shape that discharges it.** State keyed by host rather than a bare id, so "resets when the
host changes" is a *derived* fact (a state whose key is not the current host is not read) rather than
an effect someone has to remember to write. A single `chosen: { host, mailboxId } | null` is
sufficient and is preferred over a map, because **this panel shows one page at a time** and a map
would be storage for history this surface does not have.

## D3 — The chooser is an override applied after `resolveForHost`, not a second spelling of it

`resolve-for-host.ts:78` is shared by `content-script/controller.ts` and `Panel.tsx`, and its own
module note says the file exists so that *"two answers to one question is how a product ends up
showing one address in a panel and offering another beside the form"* cannot happen. **A chooser is
exactly that second answer, if it is written as a rule.**

So the chooser takes the shape **the rule is asked, and the person's answer replaces its result
while it is asked for the same host**:

- `resolveForHost(held, host, associated)` is still the only thing that decides what a host means.
  It is called where it is called today, unchanged.
- The choice is applied **on top of that result**, not inside it, and only when the choice was made
  for the host currently named.
- **The chosen mailbox must be one this device holds.** The delta requires it and `tasks.md` names
  the case; a chooser that could select a mailbox no longer in `held` would be offering to read
  something that does not exist here, which is the stale-association hazard stated a different way.

**The rejected alternative — teach the chooser to resolve hosts, or give `resolveForHost` a
"preferred" parameter.** Both were rejected for the same reason and it is worth naming both because
they are the tempting ones. A preferred parameter looks like tidiness and is actually the defect:
it moves a *person's choice for this panel view* into the module that answers *"which address does
this site get"*, and the in-page control would then inherit an override it has no control for.
**The preference is not a fact about a host; it is a fact about a moment.**

**The cost:** `Panel.tsx` grows one more input to `shown`, so the `useMemo`'s dependency list grows
with it, and a mutation that drops the dependency would be invisible to every other test. D6 names
the case that catches it.

## D4 — The chosen mailbox is what `panel-address` reports, and the guard stays on `named`

`data-testid="panel-address"` is guarded on `shown.kind === "named"` and its own comment says the
**section is the claim** because the addresses the device holds render anyway. That is unchanged, and
it is unchanged *because a choice does not move the guard*.

**A person who has chosen a different mailbox beside a named host is still on a named host.** So:

- The guard remains `shown.kind === "named"`. **Only a resolved host may show a mailbox as being
  that page's**, and a choice is not a host.
- **The address the section shows becomes the chosen one**, because the section's job is to say
  *which mailbox this panel view is about* — and after a choice that is the chosen one. This is
  what makes `panel-address` a statement about the view rather than about the resolution rule's
  output.
- **Beside an unnamed page, choosing changes only which mailbox this view is about** and the section
  still does not render. There is no host to be choosing against, and the create control's own
  widened gate (`shown.kind !== "named"`) is the precedent: *this panel* cannot read which mailbox
  belongs to a page it cannot name, and a person's pick does not make it able to.

**The host sentence is not rewritten.** `hostSentence()` reports *"last used with X"* from the
association and the resolved record. After a choice those can differ, and **the sentence stays
true** — it says what the host was *last used* with, which is a fact about storage, while the
address section says what this view is *about*, which is a fact about the moment. **Two sentences
carrying two different facts is the honest rendering; one sentence trying to carry both would have
to be wrong about one of them.** `tasks.md` names the case that holds them apart.

## D5 — No new seam, no new permission, and nothing in the manifest moves

The chooser reads `PanelRecords.loadMailboxes` (`Panel.tsx:76`), which the panel already holds, and
writes nothing. So there is no `protocol.ts` message kind, no `extension-platform.ts` seam, no
`chrome` reach in the new code, and no manifest entry — `sidePanel` stays the only permission this
change's surface family added, and `storage`/`alarms`/`notifications` are untouched.

**This is D5 rather than a line in the proposal because it is falsifiable and the manifest is the
cheapest thing in the repository to read.** `extension-client`'s manifest scenario asks it directly,
`manifest.spec.ts` reads the built file, and **a byte-identical `apps/extension/static/manifest.json`
is a stronger statement than a promise not to change it** — so `tasks.md` requires the digest to be
compared before and after rather than reviewed.

**The rejected alternative — reaching for a `tabs`-backed host or a second storage read to make the
chooser work.** Neither is needed: `held` is already in state and is already what the list renders.
**The rejected alternative of a new `getHeldMailboxes` message** was rejected because the panel is
an extension page reading extension storage directly, exactly as it already does.

## D6 — Each mailbox is one radio, not a `<select>` and not a row of toggle buttons

**The decision.** `panel-held` becomes a `role="radiogroup"` whose entries are `role="radio"`
elements, each carrying its address as text and its own selection state, with `aria-checked` naming
which is current.

**Why a radiogroup.** The choice is **exactly one of N**, it is **visible after the press**, and it
is **not independent per item** — so `aria-pressed` toggle buttons would be the wrong role: they
say "these are things you can turn on", and three radios where one is on say what is actually true.
A `<select>` is a dropdown, and **a dropdown hides the other addresses behind a press**, which
undoes the one property the list has: it shows every address this device holds at once, and the
roadmap's word is *recent mailboxes* rather than *a mailbox chooser*.

**Why each entry is its own control rather than a row that acts.** `extension-client` says a control
SHALL act on what it is beside; a row whose press target is the row and whose meaning is "this
mailbox" is the same thing stated as a control, and a separate `<button>` inside a clickable row is
two targets for one choice. One target per entry.

**The cost, and it is a real one:** a radiogroup needs a label, and the requirement's *names the
most recent ones* means **a person must be able to tell which entry is current without pressing
anything** — so the selection is carried by `aria-checked` **and** by a visible difference, not by
one. `tasks.md` names the case that reads the resolved selection **and** the case that reads the
selection survives a re-resolution, because a radiogroup whose `aria-checked` is stale reads as
correct to assistive technology and wrong to a person.

**The new class hooks get stylesheet rules in the same change.** The boundary rule requiring every
class hook a client renders to be selected by a stylesheet fires on any new name — **and
`website-sections` deleted three hooks no stylesheet was meant to select rather than styling them,
so which of the two applies here is a decision, not a default.** Here the selection difference must
be *visible*, so the hooks are styled, **using tokens `styles.css` already resolves for this
region and adding none** — the previous slice's D8 commitment repeats, and `packages/ui` staying at
38 is the measurement that says it was kept.

## D7 — `loadInsertableMailboxes`' recorded reason has lapsed, and this change corrects the note without implementing the merge

`apps/extension/src/storage.ts:105-131` states why the collection and the pre-collection singular
record are never merged. Its operative sentence is **"Merging becomes right the day a surface lists
them, and it would have been wrong to do it before."**

**This is that day, so the stated reason is false, and a code comment whose justification is false
is a defect in the direction nothing ever reads.** So the note is corrected. That is the whole of
this change's storage work.

**The merge itself is not implemented, and the reason is not caution — it is scope.** Merging changes
what `loadInsertableMailboxes` returns for **every caller**, and the callers that matter are the
**content script** and the **background wake**, neither of which renders a list. The requirement
would change *"the control prefers the mailbox this site was last used with"*'s observable
behaviour for every site on every device that upgraded, **as a side effect of a panel change** —
which is the side effect `in-page-integration`'s deferral note explicitly refused and which this
change's own delta records as a narrowing rather than a widening. It would also change what a wake
lists.

**So the lapse is recorded and the merge is named as the next thing this slice unblocks**, with its
own cost stated where the cost is: a mailbox recorded before the collection stops being insertable
once this device records another one, and `spectre-storage`'s collection requirement carries that as
a scenario today. **A change that noticed the lapse and shipped it as a comment is doing the part
of the work that belongs to it.** The next slice that acts on it must own the content script's
offerable set, and it should be measured against the same scenario.

## D8 — A real divergence between a code comment and a requirement, recorded and not resolved here

`MessageSurface.tsx:128-134` says **"`extension-client` forbids a surface from indicating that one
[a message carries a verification]"** — read as a **class-wide** rule. `extension-client:252-257`
says **"The popup SHALL NOT indicate that a message carries a verification until it has opened that
message"** — read as **surface-specific**.

**The code comment and the requirement text disagree today**, and this change found it rather than
caused it.

**It is not resolved here, and the reason is that it is not this slice's question.** The class-wide
reading forbids what M11's other undelivered item — *"whether verification mail is pending"* — is
made of. Resolving it means deciding whether the panel may carry a marker about a message nobody has
opened, and **that decision has to be made on the evidence that item will produce**, not borrowed
from a mailbox chooser that has no opinion about message bodies. A panel choosing a mailbox has no
pending-verification surface to get wrong, so there is nothing here for the divergence to bite.

**What this change owes the next one:** the comment is not edited to match either reading, because
editing it picks a side without evidence. It is recorded here, in `tasks.md` as an unticked
hand-off, and in `proposal.md` under *Impact*. **A divergence left visible is a finding; a divergence
silently resolved in the direction that happened to be typed is a defect nobody will ever find.**

## D9 — What the chooser is not allowed to become

Three things a person might reasonably expect from "choose a mailbox", each refused with a reason:

- **Not a deletion control.** This product ships no deletion, and `Panel.tsx` already says a missing
  record stops the restore effect rather than passing `null` because *"`null` means create on that
  path."* A chooser that could remove an address would add a third writer to the collection.
- **Not a reorderer.** The list's newest-first order is `loadInsertableMailboxes`'s contract and
  `resolve-for-host.ts:68-70` names it as this module's assumption. **A chooser that sorted by
  recency of use would be a second order for the same list**, and the order is what the wake lists.
- **Not a provider selector, and not a "create" control in disguise.** Both are already refused for
  the panel by the previous slice, for the popup's reason: a control over one reachable option cannot
  act, and creation beside a named host is already offered above the list.

## D10 — One scenario said *held* where the requirement is about a choice, and the word would have permitted a panel with no chooser

The scenario *"A chosen mailbox is still there"* — the only one stating that a choice survives a
re-resolution, which is D2's first clause and therefore half the transient decision — read:

> **WHEN** the panel resolves the same host again **while a chosen mailbox is held**
> **THEN** the panel SHALL continue to show the chosen mailbox

**It now reads:**

> **WHEN** the panel resolves the same host again while **a mailbox a person chose is still
> selected**
> **THEN** the panel SHALL continue to show **that** chosen mailbox

**Why *held* was the wrong word, and it is not a synonym problem — it is a collision with a word
this repository has already spent.** *Held* means **this device stores a mailbox**: it is the
subject of `extension-client`'s *"Several mailboxes are held"* scenario, the wording
`docs/ROADMAP.md` uses for this very list, the name of `PanelRecords.loadMailboxes`'s return, and
the variable `held` in `Panel.tsx:187`. **A reader — and the author — has that meaning loaded
before reaching this line.** So *"a chosen mailbox is held"* reads as *while the device still
stores the mailbox that was chosen*, which is a claim about **storage** and not about **selection**.
**The requirement is about the second and the clause named the first.**

**What it would have permitted, and this is the part that makes it a defect rather than an
ambiguity: a panel with no chooser at all.** Take a panel in which nothing about a choice exists.
Nothing is ever chosen, so `shown` is `resolveForHost(held, host, associated)` and nothing else. Now
run the scenario as written: the panel resolves the same host again — which it does, on every tab
activation — and the mailbox that *would* have been chosen is, say, the one this host resolves to.
**Both clauses hold and no chooser was involved.** The scenario was satisfied by the pre-change
implementation doing exactly what it already does, which means it was not a scenario about this
change at all; it was a restatement of D3's rule wearing a choice's vocabulary.

**That is the recorded defect this repository calls an assertion narrower than the rule it
documents, arriving in a requirement rather than a test — and the direction is the dangerous one.**
A test too narrow for its rule fails to catch a defect; **a scenario too narrow for its requirement
does not even appear to be trying to**, because it sits in a delta beside the requirement it is
supposed to pin down and reads as though it were. **The class is the same, and it is found here by
no gate:** not by a mutation, and not by running anything. **It was found by reading a delta's
vocabulary against the vocabulary the code already uses** — the same instrument that found the
`MessageSurface.tsx` divergence in D8, and the one `site-associations` recorded as *"the instrument
that finds this class of defect is not a gate."*

**And the check that settles it is the panel as it stands today.** Read against the shipped source,
the reworded scenario is **unreachable** for the pre-change panel: `Panel.tsx:546` renders each held
mailbox as `<span className="panel__held-address">` with no role, no handler and nothing operable,
so no person can choose anything, and the `WHEN`'s precondition cannot come into being. Corroborated
by `Panel.tsx:275-283`, where `shown` is a `useMemo` over `{ associated, held, reading }` — **there
is no fourth input for a choice to arrive on**, so even a state variable injected beside it would
have nothing to reach `record` through. **A scenario the pre-change implementation cannot fail is a
scenario; the previous spelling was one, and this is the sentence that makes that claim about the
shipped tree rather than about it.**

**The same check was run over the other four scenarios this change adds**, because a defect found in
one clause of a block is evidence about the block and not about the clause. **Two are falsifiable by
the shipped panel and two are not, and both non-falsifiable ones are recorded here rather than
quietly reworded** — they are regression guards for behaviour that cannot exist until this change
lands, which is a different and legitimate thing for a scenario to be, and reworded without that
distinction being named they would read as though they had been checked:

- **"A person chooses a mailbox"** and **"Nothing is recorded"** — both name **a person choosing**,
  which is unreachable on the shipped panel for the same reason, so both are falsifiable. **"Nothing
  is recorded" is falsifiable in a weaker and more specific sense worth stating**: its falsifiability
  comes from the `WHEN` being unreachable, **not from its `THEN` failing**, because "the extension
  wrote no association" is true of a panel that has written nothing at all. **Its bite arrives the
  moment a chooser exists** — a chooser that planted a write is caught by the `THEN`, and that is the
  mutation `tasks.md` 3.7 asks for.
- **"The page beside the panel changes"** and **"A person chooses beside a page the panel cannot
  name"** — **not falsifiable as written.** The first is satisfied outright by the shipped panel,
  which already re-resolves on every tab activation and already shows whatever `resolveForHost`
  returns; the second's first and third clauses hold today as well (`panel-held` is ungated by the
  host and `.panel__address` is withheld), and only its middle clause — the effect of choosing — is
  new, and it is vacuous rather than false on a panel that cannot choose. **Both guard D2's reset and
  D4's unnamed-page clause, and neither has another scenario doing that job**, so the honest repair is
  a `WHEN` that names the choice (`"…and a person has chosen one of them"`), which would make both
  reachable-only-after-this-change. **That has not been done here**, because a reword that turns a
  regression guard into a falsifiable scenario is a scope question for the maintainer rather than a
  precision fix, and **the direction it would move is the opposite of the defect D10 is about.**

## Risks / Trade-offs

- **A selection state that does not reset on a host change** → the panel would show the previous
  site's mailbox beside this one, which is the one wrong answer `side-panel-surface`'s D4 exists to
  prevent. *Mitigation:* the state is **keyed by host**, so reset is a derivation rather than an
  effect; `tasks.md` names a case that switches host and asserts the rule's answer returns, and a
  mutation that keeps the old host key is caught by the same case rather than by a narrower one.

- **The `shown` `useMemo` gains a dependency that a mutation drops** → invisible to every other
  test, because a stale chooser state looks correct until the host changes. *Mitigation:* D3's case
  is read through the rendered address, not through state, and `tasks.md` requires the mutation
  that removes the dependency to be falsified rather than assumed.

- **The panel grows a control and the boundary rule about class hooks fires** → either a new hook
  with no rule, or a rule added for a property already covered. *Mitigation:* D6 decides it — the
  hooks are styled, in existing tokens — and the **boundary count must stay at 53**, so this is a
  stylesheet edit and not a rule.

- **A chooser beside an unnamed page** → either the list disappears (fake UI, the defect the
  previous slice spent A17 avoiding) or it offers a choice that implies a host (a claim the panel
  has just said it cannot make). *Mitigation:* the list stays, choosing changes only the view, and
  the address section stays withheld — `Panel.test.tsx:931-943` is the positive control this keeps,
  and it must be extended rather than replaced.

- **The panel's host sentence and its address section disagree after a choice** → reads as a bug to
  a person. *Mitigation:* D4 — they carry two different facts and are required to; `tasks.md` names
  the case that reads both together rather than one at a time, which is what the existing
  `side-panel.spec.ts` case at `:226-234` already does.

- **The singular-record lapse is fixed by a comment and the underlying cost remains** → a reader may
  take "corrected" as "resolved". *Mitigation:* D7 says in the note itself that the merge is
  **unblocked and not done**, and `tasks.md` records the scenario it still costs.

- **This change is small and could absorb more.** The two things it deliberately does not absorb are
  named in *Non-Goals*, and `proposal.md` says what each one is. **A slice that quietly took the
  merge would have changed the content script's offerable set without a requirement describing it** —
  which is the recorded shape of scope creep that costs more to unpick than to decline now.

## Amendments recorded at apply (2026-10-12)

**Nothing above is rewritten.** Every decision above is unchanged by the implementation, and the four
entries here record what happened *while* carrying them out — because each one changed what the
instrument could measure, and a falsification record that omits that is a record of a cleaner run than
occurred.

### A1. The Playwright classifier had its polarity backwards, and swapping the branches was the wrong repair

**The defect.** Exit `0` was read as `red` and exit `1` as `green`, so the first run reported **four of
five** browser arms backwards: two real catches filed as survivors and two survivors filed as catches.
**`side-panel-runtime-facts` recorded the identical defect in its own harness**, so this is the second
occurrence in this repository.

**The repair, and why it is not a swap.** The obvious fix is to exchange the two branches. That makes
the instrument correct *for this run* and leaves it trusting a **single** signal, which is the property
that let four arms go backwards in the first place. **So the classifier now reads two independent facts
— the process exit code and the reporter's own summary line — and requires them to agree.** A
disagreement is `harness-error`, not a verdict.

**And two absences became outcomes of their own**, because both had been silently classified by
whatever the code did with the leftover: a run where `-g` matched nothing exits `1` exactly like a real
failure, and a run whose summary never printed **never reached the reporter at all**. Either one filed
as a catch is counting a run that did not run.

### A2. Two harness processes ran concurrently, and the tree was corrupted underneath the first

**This is the recorded `pnpm.cmd`-cannot-be-spawned lesson's second half, and it is worse.** A shell
redirect reported exit `0` against a **0-byte** output file while the process was **still alive**, so
the run looked finished and empty. A second harness process was then started against the same tree.

**What that produced is the reason `restoreOk` alone is not trustworthy here.** Each arm compares the
file's SHA-256 before and after *its own* edit, so an arm whose site had already been mutated by the
*other* process restored cleanly and reported `restoreOk: true` — while three arms hit already-mutated
anchors, reported `noop`, and every unit arm cascaded to a uniform `n=11`. **A restoration check
watches one file across one arm; a concurrent writer is outside both of those windows.**

**Three residues survived into the tree** and were repaired before the counted run: a `role="option"`
attribute at `Panel.tsx:694`, a dropped host-key comparison, and a `heldGroup` string claiming a
page. **Two pre-existing `Panel.test.tsx` cases went red because of the second one**, which is how a
residue announces itself when a gate is run and how little it announces itself when one is not.

**The residue scan is therefore its own instrument, and it asks the harness for its own edit sites**
rather than a hand-kept list that could disagree with it. `-SimpleMatch` over the **raw** string is
the whole of its method; combining `-SimpleMatch` with a regex-escaped pattern matches nothing, which
is how a clean tree reads as a dirty one. **Measured: 24 edit sites, 0 residue, before and after the
counted run.**

### A3. Two arms were broken mutants, and reading them was the work rather than a formality

**U01/B01 mutated `role="radio"` unanchored and this file's own documentation came first** — the
permitted-parent rule is documented at `Panel.tsx:664`, thirty-one lines above the JSX. `String.replace`
rewrote the **comment** and left the attribute alone, so both tiers went green because **nothing
shipped was broken**.

**Both arms are now line-anchored, and they caught.** **The generalisable half is that
`role="radio"` appearing in prose about `role="radio"` is enough to make a mutation of this file a
mutation of its documentation**, and the same file's `setChosen`, `aria-checked` and `hostKey`
spellings all appear in its comments too. Every anchor in the instrument is therefore anchored, and
the first version of this entry — crediting the catch to a "clean run" — is what made the anchoring
look unnecessary.

### A4. The planted write needed two files, and `PanelRecords` having no write member was not a barrier

**Task 5.3 asks for a planted write**, and the arm's first version planted a **read** — which the panel
already performs at boot, so it was discharged by shipped code and could not have failed.

**The structural argument was true and it was not the answer.** `PanelRecords` really has no write
member, and `choose` really writes nothing: a *single-file* write cannot be planted, because the
compiler refuses it. **But `SpectreSiteAssociations.saveSiteMailboxId` really exists and really is
reachable from `panel-main.tsx`**, so the write plants cleanly across **three edits in two files** — a
member added to the interface, a call added in `choose`, and the real adapter supplied from the real
composition root. It compiles, it builds, it runs, and the browser case catches it.

**So the instrument gained multi-file arms, and the property is now caught rather than argued.** A
single-file mutation of a read-only contract proves the contract is read-only *at that one site*; the
two-file version is what a regression would actually look like, and **half a planted write is not a
write** — it compiles, it runs, and it records nothing.

**One arm remains declared evidence rather than counted, and the reason is that its catch is
impossible here.** Mutating `[aria-checked="true"]` to `[aria-checked="maybe"]` in the stylesheet
leaves the **boundary** suite green, because that rule asks whether the **class hook** is styled and
`.panel__held-choice` still is. **The property is held at the browser tier** by the case reading both
resolved styles — so this is a **scope** finding about an existing rule, not a gap in this change, and
it is recorded in `tasks.md` 4.3 rather than closed with a fourth boundary rule where an instrument
already exists.

### A5. Two cases this change wrote were green for a reason, and both reasons were about the *fixtures*

**Neither was found by a mutation, and neither would have been.** U06's negative half and U10's
subject were both unheld before this pass:

- **The gate's negative half had no case.** Ten `Panel.test.tsx` cases hold **two or more** mailboxes,
  so mutating `held.length > 1` to `held.length > 0` — a device holding exactly one being given a
  chooser of one — changed nothing they could see. **The gate is a product decision (D9), and the arm
  that mutates it was aimed at a case that did not exist.** `offers a device holding exactly one
  mailbox no chooser to choose with` exists because of that mutation.
- **Nothing held the wire between the two halves of a string.** The copy suite held `PANEL_COPY`'s
  *entries* and the panel suite held the *rendered* `aria-label`, and the case that connected them —
  that the group's own name comes from the entry that says what it is for — was absent. A literal
  `"Addresses"` would have passed both. That case exists because of that mutation.

**And two arms were added for task 3.7's own clause** — *"the case fails if the fake is made
permissive"* — which is a clause about the **check** rather than the **product**, and so cannot be
satisfied by any arm aimed at the panel. U16 makes the unit tier's recorder vacuous; **B06 makes the
browser tier's storage reader return nothing.** Both are caught.

### A6. A red that took thirty gate runs to reproduce, and the repair was a wait rather than a threshold

**The one red `pnpm verify` produced across this change's tree was not a product defect and not a
weakened assertion — it was a ninth instance of the recorded *precondition* shape, in a case this
change did not author.**

**What the red measured.** `AssertionError: expected [] to have a length of 1 but got +0`, on
`Panel.test.tsx > the panel renders the mailbox beside the page > lists what the last check found and
opens the one that is pressed`, at `expect(platform.asked).toHaveLength(1)`. **One reproduction in
87 full-gate runs, none in 55 cheaper runs** — which is what "load-sensitive" means here, and is the
reason the ledger below counts the gate runs rather than reporting three greens as if nothing had
happened.

**The mechanism, read rather than guessed.** The fixture's `tabs.sendMessage` pushes to `asked`
synchronously, so an empty array can only mean **the panel had not asked yet**. The host question is
gated on `boot.done`, which `Panel.tsx` sets **only after `await records.loadMailboxes()` resolves**,
and the host effect returns early until it is true. The case's own wait —
`await screen.findByText("Your sign-in code")` — resolves from **synchronous** `session` state, because
the stub session publishes its listing on construction. **So the wait released the case one commit
before the read it went on to assert on.** It is the same defect this repository has recorded against
`Popup.spec.ts`'s *"waiting for the address to appear does not wait for the `saveMailbox` write"*, on a
different surface and with the roles reversed: here the visible signal is **synchronous** and the work
behind it is **asynchronous**.

**The repair waits on the panel's own output rather than on the recorder, and the reason it is not
circular is a strict ordering rather than an intention.** `asked.push` happens when the question is
asked; the host sentence renders only after `resolveThePage` has published the reading **and** awaited
`loadSiteMailboxId`. So *"the host line stopped saying it was asking"* is strictly later than the push,
and the existing exact-count assertion is untouched — the wait establishes **at least one** and
`toHaveLength(1)` is still what would fail a second ask. **A `waitFor` on `platform.asked` itself would
also pass, and four cases in this file already use that shape**, but it would wait on the very thing
being counted, and the count is the one thing this case adds to the listing it already covers.

**Two facts about the repair are recorded because they are the kind a re-run would erase.** The
asserting line is **unchanged context in this change's diff**, so the defect was shipped by
`side-panel-surface` and merely *measured* here — which is the ninth entry against two totals this
change's own files already carry (a "fifth" and a "sixth", then a "seventh" and an "eighth"), and this
one follows the higher. And **the repair was confirmed under the condition that produced the red**: 20
consecutive runs of the file unloaded and 10 more with six busy loops running, 30 for 30, followed by
three clean `pnpm verify` runs and a clean block of ten browser runs. **A repair confirmed only on an
unloaded machine would be a repair confirmed under easier conditions than the one that found the
defect.**

### A7. What none of this measured

**Nothing about how a chooser of three addresses looks.** The chooser's cases read the **DOM**, a
**resolved computed style**, the **recorded provider's own traffic**, and **`chrome.storage` read
through the platform's own API**. None of those is a rendered pixel, so **whether a person can tell
the current entry from the others at a glance is outside every gate in this change**, and `tasks.md`
7.1 is deliberately unticked for that reason and not because it was overlooked.

**And nothing about reachability in a real browser.** With `openPanelOnActionClick` unset, the panel is
reachable only through Chromium's own side-panel entry point, and **no instrument in this repository
reads a browser's own UI** — `docs/PROVIDERS.md` §4.6's probe measures the API, not a person opening
it.

## Open Questions

None. Everything deferred above is deferred **with its reason written next to it** - the merge, the
pending-verification divergence, and the in-page affordance's limit - rather than left as a question
whose answer would change these specs, this approach, or the task breakdown. The one thing a
following slice must not inherit as settled is the divergence in D8, and `tasks.md` records it as an
open item belonging to the next slice by name. **The apply stage added none**, and the six findings it
recorded are all recorded above rather than left as questions about this design: **two about an
instrument** (A1, A2), **one broken mutant whose being green was correct** (A3), **one planted write
that needed two files** (A4), **two cases whose subjects no assertion held** (A5), and **one
precondition in a case an earlier change shipped** (A6).
