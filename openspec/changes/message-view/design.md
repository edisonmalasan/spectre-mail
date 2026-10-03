# Design — message view

Decisions are numbered and the alternatives are recorded, because the point of this
file is not the choice but the reasons a later reader would otherwise have to
reconstruct.

---

## D1 — The session owns the opened message, not the client

**Decision.** `OpenedMessageState` lives on `SessionState.ready`, beside `inbox`. A
client asks the session to open a message and reads the result off the session state.

**Rejected:** the client holds `selectedId` plus its own opened/failed union.

**Why.** A selection is a message **id**, and message ids are provider-scoped. Slice 2
already learned this the hard way and wrote the lesson into `inbox.ts`'s `reset()`:
*"Verdicts are keyed by message id and message ids are provider-scoped, so carrying
them across a mailbox change would attach one mailbox's analysis to another's message
that happened to share an id."*

A client-held selection must be cleared when the mailbox is replaced. The client
mirrors session state and derives nothing, so "clear it when the mailbox changes" is a
rule the client has to remember — and the natural place to remember it is
`useMailboxSession.ts`, which is a binding that deliberately holds no judgements of its
own. Putting the selection in the client means the clearest implementation is also the
one that violates the rule.

The second reason is tighter. The retention in D2 and the selection must **agree**: a
selected message whose analysis has been pruned would show a body for a message the
current listing no longer contains. One owner makes that disagreement unrepresentable,
which is the same argument that put `checkFailed`'s `listing` inside `InboxState`
rather than beside it.

**Cost, stated honestly.** The session now knows something about presentation — that
exactly one message may be open. That is a real widening of its responsibility and the
opposite of slice 1's instinct. It is accepted because the alternative is a correctness
hazard in a layer with no mechanism to catch it, and because "which message is open" is
not a presentation concern once opening costs a provider request.

---

## D2 — Retain the analysis; do not re-read on click

**Decision.** `determine()` already fetches and analyses every new message. That
analysis is **retained**, keyed by message id, and pruned to the ids of the current
listing on each successful check. `openMessage(id)` serves a retained analysis and
makes **no provider request**; a message with no retained analysis is fetched and
analysed on demand.

**Rejected:** always fetch on click. **Rejected:** always retain, unbounded.

**Why retain.** M4 established that detection is *deterministic* — the same body always
yields the same codes, links, and confidences. So a second read of a message already in
memory has **no correctness benefit whatsoever**. It costs one provider request, and
slice 2 spent its whole verification budget establishing that request cost is load-
bearing in this product: a cadence exists partly because the provider's tolerance is
unknown, a declared limit is honoured as a floor, and a throttled listing *halts the
loop* so the user can see it. Spending a request to recompute a known answer, against a
provider whose tolerance for the existing cadence has never been measured, would trade
a certainty for a risk.

**Why prune.** `verdicts` is sticky by design — slice 2 keeps an entry per message ever
seen, because a verdict is cheap and idempotent. A body is neither. Retention that
never shed would grow without bound over a long-lived session, so it is pruned to the
current listing each check. The verdict map stays sticky; only the expensive part is
bounded. The asymmetry is deliberate and the comments must say which is which.

**Why retain at all rather than read on demand.** The converse: if retention is bounded
to the listing, a message dropped by a later listing would be re-read anyway, so the
fast path only covers messages still listed. That is the right coverage — a user opens
messages from the list they are looking at.

---

## D3 — A distinct opened-message type, not a `Message`

**Decision.** The session hands the client an `OpenedMessage`: the listing fields,
a `readable: string`, and the model's own `VerificationCode[]` and
`VerificationLink[]`. The body **as received is not retained**.

**Rejected:** reuse `packages/core`'s `Message` with `text` set to the readable text.
**Rejected:** re-export `MessageAnalysis` from `@spectre-mail/mail-parser` and let the
client read `readable` / `codes` / `links` off it.

**Why not `Message`.** `Message.text` is documented as *"the message body, as untrusted
text"*, and the raw body **is** an HTML document in the one case that was measured
(`docs/PROVIDERS.md`, run `2026-10-01T18-08-41-251Z`: Guerrilla declared a plain-text
content type and delivered an HTML body). Overwriting `text` with the extracted readable
text would make a field whose documented meaning is "the body as received" hold
something else. The rename to `readable` is the whole safety property: there is no field
on this type a renderer could mistake for something to interpret.

**Why not re-export `MessageAnalysis`.** Because `tests/architecture/boundaries.test.ts`
has `PARSER_ALLOWED_IMPORTERS = ["mailbox"]`, and `apps/web` importing the parser
directly would break a rule that exists for a good reason. An `OpenedMessage` built from
`packages/core`'s own `VerificationCode` and `VerificationLink` gives the client
everything it renders **without** loosening that rule — the parser stays reachable only
through the session, which is what guarantees detection happens exactly once.

---

## D4 — Codes and links are displayed, not actionable

**Decision.** The message view renders the detected codes and links as text. There is
no copy button and no anchor.

**This is the change's one scope decision, and the sources conflict on it.**
`docs/ROADMAP.md`'s M5 acceptance criteria say a user must be able to **"copy the OTP"**
in M5. `AGENTS.md` says the verification workflow — *"notifications, OTP copy/fill"* — is
**M10**, whose "User actions" block lists `Copy code`, `Fill code`, and
`Open verification link`.

Resolved in favour of `AGENTS.md`:

1. **That sentence is a correction, not a summary.** The same file records that an
   earlier draft put storage at "M5–M6" — naming a milestone from the layer that felt
   like it should come next rather than the one `docs/ROADMAP.md` schedules — and that
   this was wrong. Where a deliberate correction and a plan's aspirational list
   disagree, the correction is the better evidence of intent.
2. **The conservative reading is the smaller slice.** This change's scope is opening a
   message. A copy button is the verification *workflow*, which is what M10 is named
   for, and M10's fill rules ("never silently fill codes", "require explicit user
   action") are a workflow's rules rather than a message view's.
3. **It needs no amendment.** Deferring is a one-line record. Absorbing the copy action
   would require rewriting `AGENTS.md`'s M10 sentence to justify it, which is the
   wrong direction for a document whose job is to say where things are scheduled.

The roadmap's acceptance criteria are **left exactly as written**. D4 names the
milestone that delivers the criterion. Editing a plan's exit conditions from inside a
slice is how a plan stops being a plan.

**Links show their hostname and are not clickable.** The model already carries
`hostname` on `VerificationLink` *"extracted so a UI can label it without parsing the
URL again"*. Showing it is free, and it is the information M10's rule
("show destination hostname") needs. Making it an anchor would import a new-tab policy
and a follow-the-link decision that M10 owns, and this repository has a standing rule
that detection must cause no side effect — a link that navigates because a message was
rendered is a side effect.

---

## D5 — No router, no URL state

**Decision.** Selection is session state; a button returns to the list. No router is
introduced and nothing is written to `location`.

**Why.** No router exists, the extension at M8 will not share one, and a single mailbox
with one open message needs no addressable URL. Introducing routing now would be
building a navigation model that M7's visual design and M8's extension would both have
to revisit. `AGENTS.md` is explicit that markup written before M7 is markup M7 rewrites,
and a router is not markup — it is an architectural commitment.

**Consequence, stated.** The browser Back button will not close an open message. That is
a real limitation, it is the price of not committing to a navigation model, and it is
recorded here rather than discovered later.

---

## D6 — Confidence is never shown as a number

**Decision.** Codes are listed in the parser's rank order. No confidence value appears
anywhere in the UI.

**Why.** A bare `0.85` means nothing to a user and invites reading it as a percentage
chance, which it is not — `packages/mail-parser` describes every score as *"a judgement,
not a probability"* traceable to a published rule. Showing the rank order plus one
sentence saying the detector can be wrong honours M4's guarantee that **no detection is
ever reported as certain** without inventing a probability the parser does not have.

---

## D7 — An unreadable message is not an empty message

**Decision.** `openFailed` is a distinct state carrying a `SessionFailure`. A message
whose body cannot be read never renders as an opened message with nothing in it.

**Why.** This is slice 2's `undetermined` discipline applied one level down. `state.ts`
already says the false claim that *"costs a user the code they were waiting for"* is
reporting "no code here" about a message the product never looked at. A view that
rendered an unreadable message as an opened message with no codes would make exactly
that claim, in the place the user is looking for the code.

Slice 2 also showed the recovery is real: `determine()` swallows a failed read into
`undetermined`, so a message marked unreadable may well be readable on a second attempt.
`openMessage` therefore always *tries* rather than refusing on the strength of a cached
failure.

---

## D8 — An id absent from the listing is refused without a request

**Decision.** `openMessage(id)` where `id` is not in the current listing reports
`MESSAGE_NOT_FOUND` and **contacts no provider**.

**Why.** The session cannot know that an id belongs to this mailbox. Both measured
adapters scope ids per mailbox, and slice 2's `reset()` comment records that carrying a
per-mailbox key across a mailbox change attaches one mailbox's analysis to another's
message. Reading an id the listing does not contain would mean asking a provider about a
message this mailbox has not reported, which is a request made on a guess.
`MESSAGE_NOT_FOUND` already means *"the requested message does not exist, or is no
longer retained"*, so it is the honest code rather than a new one.

---

## Open questions

None that block implementation. Two things a maintainer may want to overrule, both
recorded above rather than hidden: **D2's memory-versus-request trade** (retaining
bodies for the current listing costs memory proportional to the mailbox, to save a
provider request whose cost has never been measured), and **D5's missing Back-button
support**.

## Carried forward, not solved here

- The cadence has still never been exercised against a live provider.
- No live browser run of the website has ever been made. Slice 3 adds a component that
  has therefore never been seen by anything other than jsdom.
- Mail.tm publishes no terms page; nothing may be cited about it.
- CI has never been made to fail, so its ability to catch a regression is unproven.