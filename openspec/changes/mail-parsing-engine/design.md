# Design

## Context

See `proposal.md` for motivation and `specs/mail-parsing/spec.md` for the
requirements. What shapes the approach:

- **The input is already untrusted and already un-parsed.** `provider-adapters`
  requires that a provider's declared content type is not trusted and that raw
  content is never rendered as HTML, and it deliberately gives `Message` a single
  `text` field and **no markup field**. For Guerrilla Mail that text is, in practice,
  a raw HTML document: M0 measured `content_type: "text"` on an HTML body, and the
  real delivered message arrived as raw HTML (`docs/PROVIDERS.md` §3).
- **So the seam is exactly `Message.text`.** M4 does not receive "an HTML document"
  and does not receive "a clean body"; it receives a string that may be either, and
  must produce something readable and detectable from both. That is also why no
  declared content type appears anywhere in this package — there is none to consult.
- **The outputs are already modeled.** `shared-domain-model` defines
  `VerificationCode { value, confidence }` and
  `VerificationLink { url, hostname, confidence }`, and already bounds confidence to
  an inclusive `0..1` via `assertConfidence`. This change consumes them and adds
  nothing.
- **Nothing consumes this package yet.** `apps/web` renders a plain status page and
  `apps/extension` has no manifest. M4 is therefore testable but not observable, and
  every acceptance claim must be a claim about a function.
- **The corpus is authored, not recorded.** M0 captured a provider's own welcome
  message and one maintainer-sent message. It captured **no** verification mail from
  any service. So a fixture suite shaped like GitHub's or Discord's mail is
  **synthetic**, and the suite must say so rather than implying provenance it lacks —
  the same distinction M3 drew between measured and explicitly labelled `SYNTHETIC`
  recordings.
- The package is consumed as TypeScript source by a Vite web client and, later, by an
  MV3 service worker.

## Goals / Non-Goals

**Goals:**

- One pure function from `Message.text` to readable text plus ranked detections, so
  the whole milestone is verifiable without a provider, a network, or a clock.
- A safe-text path that is incapable of producing markup, so no later call site can
  be the thing that gets it wrong.
- Confidence that is **defensible** — every score traceable to a stated rule — rather
  than tuned until fixtures pass.
- A corpus that includes misleading mail, because that is the only way a
  false-positive claim means anything.

**Non-Goals:**

- Anything about how a detection is displayed, copied, filled, or opened (M10).
- A confidence threshold. See D6.
- Any tuning against real services' mail. See D11.

## Decisions

### D1 — The extraction is written here, not taken from a dependency

**Decision:** a small in-package extractor that yields readable text and anchors.
No HTML parser is added.

**Rationale.** The needed surface is narrow and unusual: strip tags, decode
entities, drop script/style content, and recover `href` paired with anchor text. It
is *not* "parse HTML" — no DOM is built, no tree is validated, nesting is irrelevant.

**Alternatives considered.**

- **A general parser (`node-html-parser`, `cheerio`).** Rejected for three reasons.
  It becomes part of a **security-relevant path** in both a page and an extension, so
  its bug surface is ours to audit either way but its size is not ours to control.
  It is the largest dependency in the workspace by an order of magnitude, in a
  package that M4 otherwise needs nothing for. And most of what it offers — tree
  construction, selector queries, serialization — is precisely what must *not* happen
  here, because every one of those is an opportunity to re-emit markup.
- **Regex over the raw string.** Rejected. It cannot pair a `href` with its anchor
  text, cannot know what is inside a `<script>`, and its failure mode on nested or
  unclosed tags is silent corruption of exactly the content we are trying to read.

**Honest limit, recorded rather than hidden:** this is not a conforming HTML parser
and does not claim to be. Malformed markup is handled by the rule that *no tag can
survive into the output* — an unrecognised construct costs us its tags, not its text.
That is the right failure direction for this product, and it is a real limitation on
any code that later tries to reuse this for something else. The module says so at the
top.

### D2 — Extraction is a separate seam from detection

**Decision:** two public steps, not one blob.

1. `extractReadableContent(text)` → `{ readable, anchors }`
2. `detectCodes(readable)` / `detectVerificationLinks(anchors, readable)`

plus `analyseMessage(text)` composing them.

**Rationale.** The roadmap's pipeline lists these as separate stages, and they fail
differently. Anchors must be captured *during* extraction, because once markup is
gone the link text and its destination can no longer be paired — and link detection
depends on both. But detection then operates on clean text, which is what makes
"the same message always yields the same result" straightforward rather than
something to re-establish per detector.

It also makes each step testable against its own failure, which the corpus cannot do.

### D3 — "Near" is defined as the same text block, and that is the whole definition

**Decision:** a keyword raises or lowers a candidate's confidence when it appears in
the **same block** of readable text as the candidate. Blocks are separated by blank
lines. Nothing else counts as nearby.

**Rationale.** "Boost confidence near words such as…" needs a precise meaning or the
number it produces is arbitrary. Character windows were rejected: a `verification`
heading 200 characters above a code is common and meaningful, and a character window
would exclude it, while a `2026` inside a price one line down is not. Blocks are what
a reader perceives as "the part of the email about the code".

**Cost, stated:** a two-paragraph message can associate a code with the wrong
paragraph. The alternative — no association at all — is what the roadmap rejects, so
some inaccuracy is required; blocks are the smallest honest version of it.

#### AMENDED DURING APPLY — a bare candidate may borrow the block above it

**Amendment.** A candidate whose own block is **nothing but the candidate** also draws
on the wording of the block immediately above it. A candidate inside a block containing
any other text does not.

**Why this changed, and what forced it.** The corpus is what showed the rule above
failing on shapes the roadmap itself names. Real templates space a number out:

- a code as its own paragraph beneath a sentence introducing it, and
- a code as its own block beneath a **heading** and nothing else.

Both scored `0.6` instead of `0.85` under the rule as originally decided, because the
wording and the number were in different blocks. A detector that cannot rank the
messages the roadmap describes is not finished, so the rule changed rather than the
fixtures.

**Why the widening is this narrow.** The general form — "the paragraph above always
counts" — is clearly wrong, and the corpus contains the counterexample. In
`order-confirmation-with-misleading-numbers`, the order number `123456` sits in its own
sentence, `Order number 123456 was placed on 2026-04-15`, directly under a paragraph
reading `Your Example Store order is confirmed`. The word `confirmed` contains
`confirm`, so unconditional borrowing would hand an order number a full keyword boost
on the strength of a sentence it is not part of.

**Why the narrowing is the right one.** A block that is a bare number has no sentence,
no subject, and no verb. There is nothing in it that could be about anything, so the
wording above is the only candidate for what it refers to. A block that contains words
*is* a sentence about something, and a code inside it is part of that sentence. The
condition is not a tuning constant; it is a statement about whether the block has any
subject matter of its own.

**Cost, stated.** A bare number still inherits wording that may not concern it, and
because `Anchor.context` is captured when a link closes rather than at the end of its
block, a link followed by more of the same sentence reads as bare even though it is not
(`detect-links.test.ts` records that case as a limit rather than leaving it
undocumented). Both widen the rule's reach by a little. The failure direction is
acceptable because boosting is not reporting — every candidate is returned regardless
(D6) — so a borrowed boost can mis-rank a message but cannot invent a code or hide one.

### D4 — A small, closed set of numeric shapes, and the "reduce" list is not a denylist

**Decision:** candidates are runs of 4–8 digits that are not part of a longer
digit run. Eight numeric shapes reduce confidence: a currency symbol or `USD`/`EUR`
prefix or suffix, a month name or `/` date separator, a phone grouping (`555-1234`,
`+1 555`), an `order`/`#`-prefixed reference, a `tracking`/`tracking number`
reference, a postal-code label, a year in `19xx`/`20xx`, and a bare `ID`-suffixed
number.

**Rationale.** The roadmap says *reduce* confidence for these, and it means it: none
of them **removes** a candidate. A real order confirmation can contain a 6-digit
number that genuinely is an OTP; a hard exclusion would silently discard it, and the
cost of that error — the user never sees their code — is far worse than the cost of
surfacing a number they will not use.

The reduction is therefore a **score penalty**, and the ranking requirement is what
makes it work: in a message with both a price and a code, the code ranks first
because it was not penalised.

#### AMENDED DURING APPLY — the phone shape is judged on the block, not the value

**Amendment.** The phone-number shape no longer tests the candidate's own value. It
tests whether the candidate falls inside a **grouped** number in its block — a run of
digits carrying at least one separator — and is only reachable when such a token exists.

**Why this changed.** The rule as originally written was **structurally broken**, and
the corpus is what exposed it. It asked whether the candidate's value "looked like a
phone number", by matching the value against a phone-shaped character class. But
candidates are extracted as bare digit runs, so a candidate value can never contain a
separator. The test therefore matched *every* seven- and eight-digit value and nothing
else — penalising every eight-digit one-time code in the corpus, and being incapable of
detecting the single thing it was written for.

It could not detect a phone number even in principle. A grouped number like
`+1 555-1234` never reaches the detector whole; only its groups are candidates, and the
four-digit group is what would be offered to the user. Judging has to happen on the
block, and only a token that actually carries punctuation can be a phone number.

**Cost, stated.** The shape's reachable cases are now the *short* ones. A thirteen-digit
courier tracking number is not a candidate at all — the length rule already excludes it —
so the tracking shape guards international formats rather than domestic ones, and
`detect-codes.test.ts` asserts that limitation rather than letting the rule look broader
than it is.

**A seventh instance of the same class of defect.** This is the seventh time this
repository has shipped a check or a rule narrower than the rule it documented. The
earlier six were: the M1 import pattern missing dynamic and side-effect imports; the
M1 adapter-identifier rule scoped to `packages/` and `apps/`; the M2 wire-format scan
scope; the M2 type assertion that resolved to `never` for every input; the M3 adapter
list naming three identifiers that did not exist; and the M4 newsletter corpus
expectation, discussed under the corpus requirement in `specs/mail-parsing/spec.md`.
The pattern is consistent enough to be worth naming: **a rule that cannot be exercised
is not a rule, and a rule whose only reachable cases are the ones nobody tested is a
rule that has quietly become narrower than its documentation.**

**And an eighth, found by the falsification pass rather than by reading.** The test for
the total-penalty cap asserted that a candidate matching three reducing shapes scores the
same as one matching two — which is the cap working. With `MAX_TOTAL_PENALTY` deleted,
both scores fell through zero and clamped to the same `0.05` floor, so **the equality
still held and the suite stayed green**. The assertion survived deletion of the exact
thing it was written to pin down, because two clamped-to-floor values are equal for a
reason unrelated to the cap.

It now asserts the published arithmetic directly (`0.5` base, `0.35` penalty cap,
`0.15` result), and the mutant that deletes the cap is caught.

This is a sharper instance than the previous seven, and worth isolating as its own
lesson: **an assertion comparing two outputs of the same function can pass for a reason
that has nothing to do with the rule it names.** The two codes shared a whole pipeline;
the floor was the thing making them equal. Every other instance in this list was a rule
failing to cover a case. This one was a case covered by a comparison that could not
distinguish the right reason from a wrong one.

### D5 — Deduplication keeps the highest confidence, and candidates are returned ranked

**Decision:** deduplicate by value, keeping the maximum observed confidence; return
sorted descending.

**Rationale.** "Multiple candidates are surfaced instead of pretending certainty" is
the roadmap's third acceptance target, and it cuts against the obvious convenience of
returning only the top one. A client that receives one candidate cannot ask the user
"which of these two?" — and M10's fill-code rules explicitly require asking when more
than one input is possible. The parser is the only place that knows how many there
were.

Highest-wins on duplicates: the same code repeated in a heading and a footer should
not be penalised for appearing in the footer.

### D6 — No threshold in the parser

**Decision:** every candidate that survives shape filtering is returned, whatever its
confidence. There is no minimum-confidence cut-off.

**Rationale.** A threshold is a **product policy** decision, and putting it in the
parser means a wrong constant silently deletes real codes — the one failure mode this
product cannot have. Where to cut belongs to the client that has a user in front of
it and can say "here are three possibilities". Confidence is the information; the
cut-off is somebody's choice.

#### AMENDED DURING APPLY — D6 governs codes, and links are gated definitionally

**Amendment.** D6's scope is stated explicitly: it governs **code candidates**. Links
are not scored-and-filtered at all. A link is either named as a verification link by
its wording, in which case it is reported with a confidence, or its wording names
nothing, in which case it is not reported at all.

**Why the scope needed stating.** D6 as originally written said "every candidate that
survives shape filtering is returned", and `specs/mail-parsing/spec.md` requires that an
ordinary transactional link yields *no* detection. Those two are in tension: under
D6's general reading, an ordinary link should be returned at a low score and the
"no detection" scenario would be unsatisfiable. The corpus made this concrete — the
newsletter's `Unsubscribe` link and the password-reset's `Unsubscribe from security
alerts` are both ordinary, and both are reported by nothing.

**Why the link gate is definitional and not a tuned threshold.** D6 exists because a
wrong *constant* silently deletes real codes. There is no constant here. The roadmap
defines a verification link by the wording around it — a link is a verification link
because the mail says it is one — so a link whose wording says nothing is not a
low-confidence verification link, it is an ordinary link. The distinction is in the
thing's identity, not in how strongly it matched.

The score for a reported link is still meaningful, because it distinguishes the two
ways a link gets named: its own text (`0.7`) or the wording introducing it (`0.55`).

**The cost, which is real.** A magic-link message whose button reads "Click here" in a
block with no verification wording produces no link at all. The roadmap's fixture list
contains exactly that shape, and the corpus authors it with the introducing sentence
present, because real magic-link mail has one — but the failure direction is worth
naming: a missed link is visible to the user as "no link found", while a false
"verification link" sitting on an unsubscribe address is a tap they did not intend.

### D7 — No detection is ever reported as certain

**Decision:** the maximum reported confidence is below `1`, and the highest total
score is defined so it cannot reach it.

**Rationale.** `shared-domain-model` permits `1` because a number in `0..1` is the
right *range*. It says nothing about whether certainty is ever *earned*, and nothing
here can earn it: all the evidence is wording, and wording is a signal, not proof. The
roadmap's own acceptance target — "multiple candidates are surfaced instead of
pretending certainty" — is a statement about the product's posture, and a `1.0` on
screen contradicts it regardless of how good the match was.

This is a deliberate constraint on a value the model permits, and it is recorded so a
later milestone does not "fix" it as an off-by-one.

**Falsification found that D7 has two independent mechanisms, and no single-point
mutation can violate either alone.** The falsification pass raised `MAX_CONFIDENCE` to
`1` and the suite stayed green; it removed the clamp and the suite stayed green. That is
not a weak test — it is the property the design is for, and it is worth stating exactly
what it means:

- The **arithmetic** makes the highest reachable score `0.85`. Raising the ceiling
  alone therefore changes nothing, because nothing was near it.
- The **clamp** caps whatever the arithmetic produces. Removing it alone changes
  nothing, because the arithmetic was already below the cap.

Each protects against the failure the other cannot catch, which is the reason for having
both. The assertion was exercised by changing all three together — ceiling, clamp, and
keyword boost — at which point the strongest match did report `1.0` and
`detect-codes.test.ts` failed naming the intended test. **A test that only a three-part
mutation can falsify is a weaker claim than a test that one edit breaks**, and the honest
description of D7's verification is: proven to hold against any single change to either
mechanism, and proven to be load-bearing only when both are changed together.

### D8 — Link detection reads wording only, never address shape

**Decision:** a link's score is raised by its **anchor text** and the **block text
around it**. Nothing in the URL path, query, or host raises or lowers it. A URL that
contains "verify" with unremarkable wording is not a detection.

**Rationale.** The roadmap says exactly this — "inspect link text and nearby
wording" — and it is also correct on the merits. Address-shape heuristics are
dominated by `/unsubscribe`, `/promo`, `/confirm-email-preferences`, and every
confirmation mail's own tracking parameters. A URL-shape boost would light up on
exactly the mail that should yield nothing.

The cost is real and named: a magic-link email whose anchor reads "Click here" in a
block with no verification wording will score low. That is the trade, and it is the
safe direction — a missed link is visible to the user, a false "verification link" on
an unsubscribe URL is a click they did not intend.

### D9 — Non-web schemes are rejected, not down-ranked

**Decision:** a destination whose scheme is not `http` or `https` is **dropped** from
the link set entirely. It does not become a text string and does not appear with a
low confidence.

**Rationale.** M10 will render these as something a user taps. A `javascript:` or
`data:` destination in a message body is an attack on exactly that affordance, and
down-ranking it leaves it on screen next to a real link where it is easiest to tap by
mistake. Dropping is also the simpler rule, and it matches the fact that no legitimate
verification link uses another scheme.

This is the one place in M4 where a **scheme** is examined, and it is a safety check
rather than a heuristic — deliberately not in tension with D8.

### D10 — The shared model is consumed, never widened

**Decision:** no change to `@spectre-mail/core`. `assertConfidence` is called where a
detection enters the model, so an out-of-range score cannot reach storage and later be
displayed as if it meant something.

**Rationale.** Same rule M3 followed, and for the same reason: the model is
established, and nothing in this milestone's scope required a field. `confidence` as a
plain bounded `number` was chosen at M2 precisely so a detector could produce one
without ceremony, and it works.

### D11 — The corpus is authored, and its fixtures say so

**Decision:** twelve fixtures covering the roadmap's listed shapes, each labelled as
**synthetic** and each declaring the candidates it is expected to yield. No fixture
claims to be a captured message from a named service.

**Rationale.** The roadmap asks for "GitHub-style verification" and
"Discord-style verification". Those are *shapes* — a short code beside strong
wording; a magic link whose anchor is the address itself — and this repository has
never received mail from either service. Writing a fixture that reads like a captured
sample would create a false provenance claim in the one place a future maintainer
would rely on it: deciding whether a detector still works.

The corpus is therefore a **specification of shapes**, stated as expectations, so a
regression is a visible diff in a fixture's stated expectation rather than a silent
discrepancy.

### D12 — The scanner boundary is widened to cover this package's identifiers

**Decision:** `tests/architecture/boundaries.test.ts` gains the rule that this package
must not reach the global `fetch`, matching the one already applied to
`packages/providers`.

**Rationale.** M3 proved the transport seam is load-bearing — without it, verifying an
adapter means contacting a third party. The identical argument applies here: the whole
reason M4's corpus can be trusted is that parsing touches nothing. A parser that
quietly resolved a URL would turn a green suite into a network dependency, and it
would do so invisibly.

Stated scope limit, so this rule is not read as stronger than it is: it matches
`fetch` **calls** and identifiers, not arbitrary I/O. It cannot prove no network
occurs — that is covered behaviourally by D13's tests running against an
environment with no transport, and by asserting no request was made.

### D13 — Detections are proven side-effect-free by observation, not by assertion

**Decision:** the corpus tests run with an instrumented transport that records every
request, and assert that **zero** were made.

**Rationale.** D12's rule cannot see a `new Image()` or an injected resolver. A
behavioural check can: it observes the absence of an effect rather than the presence
of a prohibition. Together the two cover what a source scan cannot.

## Falsification record

Every assertion added by this change was exercised by reintroducing the defect it
forbids, and each introduced violation was required to produce a non-zero exit **naming
the intended test** — not merely to turn the suite red. Every mutated file was restored
and verified byte-identical by hash, and no control file was left behind.

**34 mutations attempted. 32 were caught, naming the intended test, with every file
restored byte-identical.** The two that were not caught are the `D7` cases above, where
the design is deliberately defended twice over; they are recorded as uncaught rather
than counted as passes, and the three-part mutation that does catch them is recorded
alongside.

| Group | Cases | Caught | What was falsified |
| --- | --- | --- | --- |
| Extraction | 6 | 6 | tag survival, script/style/comment leakage, entity decoding, a link's context window, the paragraph above a link, context spilling across blocks |
| Codes | 15 | 15 | digit-length bounds, digits from the middle of a longer run, keyword boost, borrowing in both directions, **penalty becoming exclusion**, the phone shape, the year shape, the penalty cap, dedupe direction, the certainty ceiling, ranking |
| Links | 7 | 7 | non-web scheme handling, address shape deciding, host carrying a port, ordinary links being reported, the surrounding-wording signal, borrowing in both directions |
| Composition and corpus | 7 | 7 | state accumulating between calls, the composed result diverging from its steps, a connection opened while parsing, an unlabelled fixture, a missing provenance sentence, lost roadmap coverage, a resolvable host in a fixture |

**The defect most likely to be introduced by a well-meaning later change was falsified
explicitly**: turning the reducing shapes from a penalty into an exclusion. That is the
one refactor that looks like a simplification — "these are not codes, so drop them" — and
it would silently hide a real code in an order confirmation. The mutant that skips any
candidate matching a reducing shape is caught by
`detect-codes.test.ts` naming *"still returns a penalised value"*, and also by the corpus,
where the order-confirmation fixture would lose four of its five candidates.

**Positive controls ran in the opposite direction.** A suite that only ever goes red
cannot distinguish a strict detector from a broken one, so three controls assert the
conforming behaviour directly: a message matching every code signal still reports its
expected candidate; a genuine verification link is still reported while the traps are
installed; and a message with no plausible code still reports nothing. A fourth control
guards the falsification harness itself — a mutation that takes the file down with a
type error, or that an unrelated test happens to notice, was rejected as a proof, and
three cases were re-run after their first attempt proved defective in exactly that way.

**Three of the 34 attempts were defective mutations, and each was corrected rather than
accepted.** Two disabled a shape by adding an unused constant instead of changing the one
in use; one deleted a template-literal expression and so failed to compile, which is a
red suite proving nothing. A fourth attempt revealed a real weakness in a test rather
than a defect in a mutation — the eighth instance discussed under `D4`.

## Risks / Trade-offs

- **A code is missed because its block contains no recognising wording.** → The
  candidate is still returned, at an unboosted score, because D4 reduces rather than
  excludes and D6 applies no threshold. The failure is a low-ranked result, never an
  absent one. This is the direction that leaves the user able to act.
- **A non-code is surfaced and the user taps the wrong thing.** → Mitigated by
  ranking (D5) rather than by suppression, and by the corpus including an
  order-confirmation fixture full of plausible non-codes whose expectations state
  they must rank below any real code. *Not* mitigated for the no-real-code case:
  the honest outcome is one low-ranked candidate, and the spec requires surfacing it
  rather than pretending there is none.
- **The extractor is not a conforming HTML parser.** → Recorded in D1 and in the
  module's own documentation. The failure direction is safe (tags are dropped, text
  is kept), and the module is scoped so it cannot be reused where full parsing is
  needed.
- **The confidence numbers are not calibrated against real mail.** → Every score is
  traceable to a stated rule and every rule is asserted, so a wrong rule is
  identifiable; but no score here means "probability". That is a claim this change
  does **not** make and no UI should repeat.
- **Block-based association can attribute a code to the wrong paragraph.** → Stated in
  D3. Blocks are the coarsest association that still lets wording matter at all.
- **A later milestone adds a dependency and reintroduces risk in this path.** → The
  package has no dependency but its workspace sibling; `pnpm-lock.yaml` is the place
  that would show it, and D1's rationale is recorded here for whoever reviews it.
- **The corpus is synthetic and could encode my assumptions rather than reality.**
  → Mitigated by labelling every fixture and by the shape-based framing in D11. The
  honest limit: this suite proves the parser handles these shapes, not that it
  handles tomorrow's mail.

## Migration Plan

None. This adds a package's behaviour. `@spectre-mail/core` is unchanged, no
published surface changes, and no client consumes the package yet, so nothing can
regress. `packages/mail-parser/package.json` gains a workspace link to
`@spectre-mail/core`; the root lockfile is updated in the same commit.

Rollback is deleting the added modules and the manifest entry.

## Open Questions

- Whether the corpus should later gain fixtures captured from real mail. Deferred
  because answering it needs messages this repository does not have, and because it
  changes no spec requirement — the corpus requirement already says a difference must
  be a visible diff, which is how captured fixtures would be added when they exist.
- Whether a real code ever appears in a block with no recognising wording. Not
  answerable without real mail, and it would change a score rather than a rule, so it
  is tunable without touching a spec.
- What a client should cut off at. Belongs to M10, which is where a user is present
  (D6).