# Design

## The defect, in one sentence

`sessionIsLive` decided liveness by reading a field the listing call never sends, so
every live Guerrilla mailbox was reported `MAILBOX_EXPIRED` — measured in the user's
own Chrome on 2026-11-18, where a freshly created address was shown as *"gone"*.

## D1 — Liveness is decided by signals the provider is measured to send

Measured on 2026-11-18 from a real browser, four bodies, all `HTTP 200`:

```text
get_email_address   {"email_addr":"…@guerrillamailblock.com","email_timestamp":…,
                     "alias":"…","sid_token":"…"}

check_email (1 msg) {"list":[{"mail_from":"no-reply@guerrillamail.com",…}],
                     "count":"0","email":"…@guerrillamailblock.com","alias":"…",
                     "ts":…,"sid_token":"…","stats":{…},
                     "auth":{"success":true,"error_codes":[]}}

check_email (empty) {"list":[],"email":"…@guerrillamailblock.com","alias":"…",
                     "ts":…,"sid_token":"…","count":0,"users":1,"stats":{…},
                     "auth":{"success":true,"error_codes":[]}}

check_email (dead)  {"auth":{"success":true,"error_codes":[]},
                     "error":"Please call get_email_address or set_email_user first",
                     "stats":{…}}
```

The three signals the adapter now uses:

| signal | live | dead |
| --- | --- | --- |
| a top-level `error` string | absent | present |
| `list` is an array | yes | **absent entirely** |
| an echoed address, when present | equals the mailbox | absent |

**Rejected: `auth.success`.** It is `true` in every body above, including the dead one.
`docs/PROVIDERS.md` §5.1 records this and says so explicitly; the shipped code's own
comment already knew the `error` key was the clearest signal and then went on to
require a field that never arrives.

**Rejected: `count`.** Measured as the **string** `"0"` on a listing holding one
message and as the **number** `0` on a listing holding none. It does not even agree
with `list.length`, so it cannot decide anything. This is recorded because it is the
kind of field that looks like a liveness signal and is not one.

**Rejected: the `sid_token` echo.** The dead body echoes no token, so a "token echoed
means alive" rule would work today. It is not used, because nothing measured
establishes the converse — a provider may echo a token it no longer honours — and a
rule whose only evidence is one direction is the defect this change exists to repair.

## D2 — Absence is not evidence, and that inversion is the whole bug

The old final branch was:

```ts
// No address at all alongside a token means the provider did not recognise the
// session. A dead session still echoes a token back.
return false;
```

That comment is false in both clauses: the dead body echoes **no** token, and the
live listing carries no `email_addr`. The code read *"the field I expected is not
here"* as *"the session is dead"* — the repository's most-recorded shape, a reader
that matches nothing reporting the absence of the thing it looked for. The repair
makes absence mean **nothing**: only a present, disagreeing address is evidence.

## D3 — `email` on the listing, `email_addr` on creation

The creation call returns `email_addr`; the listing returns `email`. The adapter's
`createMailbox` already reads `email_addr` correctly (`guerrilla.ts:289`), which is
why creation worked and listing did not. Both spellings are Guerrilla wire format and
neither enters the normalized model; `conformance.ts`'s `WIRE_FIELD_NAMES` already
lists both, and is unchanged.

## D4 — The fixtures were the reason no gate caught this

Both fixtures were labelled `MEASURED` and both contradicted `docs/PROVIDERS.md`:

| fixture | claimed | recorded |
| --- | --- | --- |
| `guerrillaLiveList` | "the session's own address echoed back" | echoed under `email`, never `email_addr` |
| `guerrillaDeadSession` | "an empty list, no `error`" | no `list` at all, and an `error` string |

The unit case for a genuinely empty inbox **hand-built** `email_addr`, so it agreed
with the code rather than with the provider. `fixtures.test.ts` requires every fixture
to *begin* with `MEASURED` or `SYNTHETIC`; it cannot check that the label is true, and
here it was not. That limit is unchanged by this change and is named in D9 rather than
papered over.

## D5 — The new recording is a captured body, not a construction

`guerrillaEmptyLiveList` is the body captured on 2026-11-18 after deleting the
provider's welcome message, transcribed with the address and tokens normalised to
`GUERRILLA_ADDRESS` / `GUERRILLA_SESSION` — the file's existing convention, which
`guerrillaSessionCreated` already follows. The envelope is otherwise verbatim,
including `count: 0` as a number and the `users` and `stats` keys, because a
recording that drops the fields it does not need stops being a recording.

**The address must stay normalised**, and that is load-bearing rather than tidy:
`apps/web/e2e/mailbox-history.spec.ts` stages an expired mailbox by planting
`planted-unreachable@sharklasers.com` and relying on the recording echoing a
*different* address. A verbatim capture would make the two agree and the arm would
stop testing disagreement.

## D6 — What changed in the requirement block, and what did not

The property is kept word for word in substance: a dead session is never an empty
inbox. What changed:

- the body gains the normative inversion — absence of a field is not evidence of
  death unless that absence is itself measured to mean it;
- the expired scenario's GIVEN says *an `error` string and no message list* where it
  said *an empty message list*, because the measured dead body carries no `list`;
- two scenarios are added: a live listing with no address (the defect arm) and a
  listing echoing a different address (the arm `mailbox-history.spec.ts` relies on);
- the measured-basis note names the signals, the two rejected fields and the date.

Both pre-existing scenarios are carried forward by title and body, which is what a
`MODIFIED` block must do or the archive refuses it.

## D7 — `docs/PROVIDERS.md` §3 gets a dated correction, and the original line stays

§3 records the M0 spike's summary as *"HTTP 200, no auth error, empty inbox"*. That
line is why the adapter was written to distrust an empty list, and it is also the
sentence that taught the shape that caused this. It is **not** deleted: it is the
record of what the spike reported, and rewriting a measurement to agree with a later
one is the defect this repository has recorded against its own instruments.

Instead a dated correction is appended under it: the bodies in §5.1 and the
2026-11-18 re-measurement show a top-level `error` and no `list`, and *"no auth error"*
is true only in the narrow sense that `auth.success` is `true` in both shapes. §5.1
itself is untouched — it already records the correct shapes and names the usable
signals, which is why the code's divergence from it is a defect rather than a gap.

## D8 — The repaired fixture reaches both browser tiers, and the expired arm survives

`apps/web/e2e/recorded-provider.ts:74` and `apps/extension/e2e/recorded-provider.ts:164`
serve `guerrillaLiveList` verbatim. So repairing the fixture is not a unit-tier
convenience: with the old code still in place it reproduces the defect in the website
tier, which is the tier that observed it live. The pre-fix red is recorded in
`tasks.md` and re-established as falsification arm A1 — the same measurement taken at
two moments, deliberately, so the claim is not only a memory of a run.

The expired arm in `mailbox-history.spec.ts` needs no stub and no edit: the planted
mailbox's address differs from the one the recording echoes, so disagreement remains
the signal under the new rule exactly as under the old one.

## D9 — What this does not establish

- **Whether the provider changed shape or the fixture was mis-transcribed in M0.**
  The spike stored summaries, not raw bodies; both `email_addr` hits in
  `tests/provider-spike/.runs/` are creation responses. The repository cannot say
  which, and this change does not guess.
- **That the extension's Guerrilla fallback failed live.** It uses the same adapter,
  so the reasoning is from shared code. No live extension run was made — the popup
  and panel require the user to load `apps/extension/dist` unpacked, which this
  change does not automate.
- **That `fixtures.test.ts` can tell a true label from a false one.** It checks that a
  label is present and first. Nothing in this repository checks that a recording
  matches the provider, and a green suite is not that check.
- **Anything about a dead session that also carries an empty `list`.** Not measured.
  The adapter would report it expired on the `error` signal; whether the provider can
  produce that body is unknown.
- **How any of it looks.** No test reads a rendered pixel; the live observation that
  started this was a person's screenshot and a page's text, and the fix is verified by
  behaviour, not appearance.

## D10 — Shipped prose that repeated the false shape

**Five** statements in shipped source asserted the shape the measurement refutes and are
corrected with the code, because a false comment beside a repaired guard is how the next
reader reintroduces the defect:

- `guerrilla.ts:14–18` — *"answers `HTTP 200` with an empty list and no auth error"*;
- `guerrilla.ts:220–237` — *"returns `HTTP 200` with an empty list and no error"* and
  *"the only signal available is whether the response still names the mailbox's own
  address"*;
- `guerrilla.test.ts:138–148` — *"carries no `error`"*;
- `guerrilla.ts:363–366` — the `MAILBOX_EXPIRED` description, which said the provider
  answers *"with an empty inbox and no error"*, false in both halves;
- `conformance.ts:284–290` — the comment beside the dead-session case, which said the
  measured Guerrilla case answers *"an empty inbox"*.

**The list was three, and the two it missed were found by sweeping the tree for the
phrase rather than by reading the list.** That is the finding worth carrying: a list of
sites written from memory is a reading, and a reading is not a search. The sweep is what
turned up the description and the conformance comment — and the description mattered
most, because it is the sentence a person reads when their own mailbox is reported gone.

**And the sweep also found eight further occurrences, and the split between the ones this
change repaired and the ones it reports is a measurement rather than a judgement.**
`packages/mailbox/src/adoption.test.ts` and `packages/mailbox/src/session.test.ts` **moved
in scope**, because a fixture carrying the refuted shape is not prose about the defect — it
is a body the adapter reads. **Six files and three promoted requirements remain reported
and unedited**: `packages/mailbox/src/session.ts:62`,
`packages/storage/src/contract.ts:53`, `packages/storage/src/index.ts:29`,
`apps/extension/src/Popup.tsx:229`, `apps/extension/src/panel-copy.ts:178`,
`apps/web/src/App.tsx:39`, plus `mailbox-session/spec.md:690`,
`spectre-storage/spec.md:187` and `provider-adapters/spec.md:186`, the last of which this
change's own delta replaces at sync. Editing any of them is a different change: none is a
body a test drives, and a change that repairs every comment it can find is a change that
cannot say what it measured.

**The two that moved did so for different reasons, and both are worth naming.**
`adoption.test.ts` **went red** under the repaired adapter — `7 failed / 1415 passed` on
three consecutive runs, one cause — so leaving it would have shipped a red gate.
`session.test.ts` **stayed green**, and that is the sharper of the two: its
`guerrillaMessageAnswer` listing carried `email_addr` set to the mailbox's own address, so
the *old* rule was satisfied by the fixture and the case passed. **A fixture that satisfies
the rule it is meant to exercise cannot fail for that rule's absence**, and the instrument
that found it was a sweep rather than a red — which is the same reason the list above grew
from three to five in the first place.

**Measured, by restoring the `email_addr` rule and running `packages/mailbox` on the
otherwise-unrepaired tree: 11 failed.** Reverting **only** the message responder's `email`
back to `email_addr`, under that same restored rule, gives **10** — and the one that stops
being caught is *adds no request of its own to what the provider makes while opening*.
**So that case could not fail for the reason it existed until the fixture was corrected**,
and the second run is what establishes it: one arm says the repaired fixture is
load-bearing, and only the pair says the repair is what made it so.

**And one case *name* moved with the body, which is the third repair this change did not
set out to make.** `adoption.test.ts` carried
*"does not call an expiry something it could not tell"*, asserting `isExpired(state)` on
`deadSession` — and under the old fixture that name was defensible, because `deadSession`
was a bare `{ list: [] }`, which is exactly the shape the adapter could not classify.
**The repaired body carries the provider's own `error` string and no `list`, so the
adapter *can* tell**, and a case named for a guess would have gone on asserting the right
outcome for a reason that no longer existed. It is now *"reports a session the provider
has disowned as an expiry, not as a failure to ask"*, and the comment says which sentence
became false and why. **A test title is a claim about the body it drives, and this
repository has recorded that shape often enough that shipping a false one inside the
change that falsified it would have been the least defensible place to leave it.**

## D11 — The measured-basis citation was §4.5, and the measurement is §5.1

Every artifact in this change cited `docs/PROVIDERS.md` **§4.5** for the measured session
shapes, and **§4.5 is *"Notification facts"*** (line 800). The shapes are in **§5.1**,
*"Harness defects found while closing this gap"*, at lines 1134–1154, recorded
2026-10-02.

**The correction is the pointer and nothing else.** The bodies this change quotes are
byte-for-byte what §5.1 records, so the claim was right and the citation was wrong —
which is the failure a citation has, and it is the reason the delta's note was fixed
before sync promoted it rather than after. A wrong section number inside a `MODIFIED`
block becomes a wrong section number in `openspec/specs/`, where nothing re-reads it.

## D12 — The fixture repair found a second consumer, and it was a harness

**One invented field had two dependants, and only one of them was shipped code.**
`apps/extension/e2e/recorded-provider.ts` held **one** entry for the whole Guerrilla
host — `[GUERRILLA_AJAX, recorded(guerrillaLiveList)]` — so `get_email_address`
and `check_email` were both answered with the *listing* body. That was correct only
while `guerrillaLiveList` carried `email_addr`, a key no listing sends: `createMailbox`
reads `email_addr` and `sid_token`, found both in a listing, and built a mailbox from a
body creation never returns.

**Measured in the order it happened, and the order is the finding.** The tier was red at
`10 failed | 96 passed (106)` in **6.0 minutes** *before* the adapter was fixed — the
liveness defect. It was red at the **same count, in the same duration, on the same case
names** *after* the adapter was fixed — creation failing with `UNKNOWN_PROVIDER_ERROR`.
**Not one number in the summary distinguished them.** What separated them was reading the
popup's own accessibility snapshot, which said *"Addresses this session created: 0"* where
the first red had shown a mailbox reported gone.

**A count that matches is not a cause that matches.** This repository already records the
mirror of this shape — a red that appears and disappears without the tree changing means
nothing — and the practical consequence here is the same: a second run that reproduces
the first run's *number* is not a confirmation, and the instrument that separated the two
causes was the one that reads what the surface **says** rather than how many cases failed.

**The repair is a third branch in the seam that already told operations apart**, not a
second mechanism: `GUERRILLA_CREATE_OPERATION` is named beside the listing and read
operations, and `get_email_address` is answered with `guerrillaSessionCreated`. **`SCRIPT`'s
bare-host entry is deliberately left alone**, because it is the documented default for an
*unstaged* body read — the `carriesNothing` verdict depends on a read being answered by a
listing that carries no body field — so keying `SCRIPT` by operation would have broken
that default in order to fix a different arm. The seam's own docblock said *"two
operations"* and is corrected to three: it went stale the moment creation needed the same
treatment, which is the same class of prose this change exists to correct.

**The website's table already keyed by operation**
(`apps/web/e2e/recorded-provider.ts:73—74`), which is what makes the extension's an
outlier rather than a convention — and **the two fixtures name the same address and the
same token**, so no assertion in either tier needed editing. The repair changed which body
answers, not what a person would see.

**The rule worth carrying out of it: a fixture that is wrong in the generous direction makes
its consumers look correct.** `guerrillaLiveList` carried one field too many, and both the
adapter's liveness check and this harness were green because of it. Removing the field found
both, and a change that had repaired only the shipped half would have shipped a green suite
over a harness staging a shape the provider never sends.

## D13 — The sync promoted one block, and it rotted two citations

**The promotion was rehearsed in full on a throwaway copy of `openspec/` before it touched
the real tree, and the real promotion produced the rehearsal's exact SHA-256**
(`AF0A2532…` on both) — so the rehearsal was faithful rather than approximately so. The
tree moves from **196 requirements / 650 scenarios / 15 capabilities** to **196 / 652 /
15**, with `provider-adapters` **12 / 30 → 12 / 32**. **Requirements moving by zero is the
arithmetic working and not a promotion that missed**: a `MODIFIED` block *replaces* rather
than adds, so the block's two pre-existing scenarios come forward by title and body and its
two new ones are additions.

**The promoter ends a block at a line-anchored `### Requirement:`, `## ` or `# `**, and
refuses before writing if the result would carry a delta-only `## MODIFIED Requirements`
heading or if the delta block carries no scenario. **The first of those is the defect this
repository recorded twice as *"opening is not closing"***, where a block that simply runs on
to the next requirement absorbs the section heading above it — and a count cannot see it,
because the block count is unchanged. **The verifier shares no reader with the promoter**:
one walks lines with a state machine, the other splits whole text by regex, so neither can
inherit the other's blind spot. **It also carries a negative control** — a changed word
planted into the block must be reported, or a reader that returned one string for
everything would pass the file for ever.

**⇒ And the promotion rotted two citations in a document it never touched, which is the
second time for this document.** `docs/SECURITY.md` cited `provider-adapters/spec.md` at
**209** and **233**; **both cited blocks are byte-identical to their pre-promotion
copies**, and the replaced block grew the file, so every heading below it moved — to
**238** and **262**. **The repair is the document and not the reader**: widening the
resolver to accept a line above its heading would have made the instrument agree with a
stale document, which is the shape this repository records as a check loosened to
accommodate a wrong pointer. `security-audit.test.ts` resolves both, and its
backticked-token assertion is untouched because only digits moved.

**And the repair was falsified rather than assumed**: with the two pre-promotion numbers put
back, `security-audit.test.ts` is **`1 failed`** on *"every citation the audit makes
resolves, and each is reported by name when it does not"*, and the file was restored
**byte-identical** against a SHA-256 taken before the mutation — from memory and never from
Git, because a restore from a commit discards uncommitted work.

**⇒ And the roadmap carried two stale claims about this change, both repaired here.**
Its **standing** spec figure said `196 / 650` and now says `196 / 652` with the delta
named; and **the block describing this change cited `docs/PROVIDERS.md` §4.5 for the
measured dead-session body, where the bodies are §5.1** — **the same error D11 records in
the delta's own note**, arriving a second time in a document written from it. **A citation
error that appears twice is a shape rather than a slip**, and both are corrected at the
section rather than at the reference.

**What this does not establish.** **Nothing about whether the promotion is semantically
right.** Byte-identity proves the promoted block is the block the change asked for; **it
says nothing about whether that block is the requirement the product should have**, which
only reading the implementation against it can answer. **And nothing about the six files
and two requirements this change reported and left** — they still repeat the old shape, and
a future change will meet them.

## Falsification arms


Each arm is aimed at one assertion; `wrongcatch`, `green`, `noop` and `harness-error`
are counted separately, and every mutated file is restored byte-identically against a
SHA-256 taken before the first mutation. The instrument is
`node node_modules/vitest/vitest.mjs run packages/providers --reporter=json`, and the
control run on the unmutated tree was green at **93 of 93** before the first arm.

| arm | mutation | measured outcome |
| --- | --- | --- |
| A1 | restore the `email_addr` requirement in `sessionIsLive` | **caught, 8 failed.** Named by *returns a genuinely empty list for a live session* and *keeps a live session alive when the listing names no address at all*, plus six cases that read `guerrillaLiveList`. |
| A2 | `sessionIsLive` returns `true` unconditionally | **caught, 4 failed.** *reports a dead session as expired rather than as an empty inbox* and the conformance case *never reports a dead session as a successful empty inbox*, plus the different-address case and the conformance credential case. |
| A3 | key on `auth.success` instead of the measured signals | **caught, 6 failed.** The two dead-session cases, and **four live cases** — three of them bodies that carry no `auth` block at all, which the mutant therefore expires. |
| A4 | drop the address-disagreement branch | **caught, 1 failed**, exactly *treats a session reporting a different address as dead*. |
| A5 | treat any non-array `list` as live | **SURVIVOR, 0 failed.** See below. |
| A6 | treat an absent `list` as an empty inbox | **SURVIVOR, 0 failed.** Same cause as A5. |
| A7 | remove `MEASURED` from the new fixture's docblock | **caught, 1 failed**, *declares MEASURED or SYNTHETIC on every exported fixture*. |

**A8 is recorded and not counted.** Reverting the repaired envelope to `email_addr`
and dropping `email` leaves every case green, and that is the designed result: the new
rule ignores `email_addr` and treats an absent address as live, so the fixture's
`email` key is load-bearing for the address-disagreement arm and for faithfulness, not
for the code path. **A survivor means the assertion did not catch this, never that the
assertion is too weak, until the mutant has been read and shown to be the thing it
claims.**

**⇒ And two arms survived, and the table's catcher column was a prediction for both.**
A5 and A6 leave the suite green at 93 of 93, and the reason is structural rather than a
missing case: **the measured dead body carries both signals at once** — a top-level
`error` string *and* no `list` — and the `error` check is answered first, so no mutation
of the `list` check is ever reached by a body the provider has been observed to send.
**The three signals are not independently falsifiable: the `error` check subsumes the
`list` check for every measured body.**

**That is not a gap against the requirement, and it is not repaired by inventing a
body.** The promoted requirement's only dead-session scenario names *an `error` string
and no message list* together, and no scenario asks the absence of `list` to decide on
its own. The `list` check is a **defensive second signal** for a body with no `error` and
no `list`, which the provider has never been measured sending. It stays because it is
three lines and guards a shape the provider could send; **the record says plainly that no
measured body isolates it, and that adding it or deleting it changes nothing the suite can
see.** A case written to make A5 fail would be a fixture composed from belief to satisfy
an arm, which is the exact artifact this change exists to remove.

**⇒ And A3's six failures are a second finding rather than a longer list.** Keying on
`auth.success` does not merely fail to detect death — `auth.success` is `true` in the
dead body too, so the mutant reports it live — **it also expires live listings that omit
`auth`**, which is why three inline bodies with no `auth` block joined the failure list.
A signal that is `true` in both states and absent in a third is worse than no signal, and
the arm demonstrates both halves.

**The browser half of A1 is already measured, and on the tree rather than on a copy.**
Tasks 2.1 and 2.2 ran the two browser tiers *before* the adapter was touched — that tree
**was** the A1 mutant — and recorded **15 failed / 43 passed** on the website and
**10 failed / 96 passed** on the extension, every failure a live mailbox reported gone.
A copied mutation is a weaker instrument than the shipped defect, so the arm is not re-run
in the browser tier here.

**Restoration is verified twice, and neither time from Git.** Every mutated file was
restored from an in-memory copy of its pre-mutation bytes — a restore from a commit would
discard this branch's uncommitted work — and its SHA-256 was recomputed after **every**
arm and once more after the last, matching the digest taken before the first. **`dist/`
was then rebuilt from the restored source**, because a mutation that reaches a build
artefact outlives the source restore that undid it.
