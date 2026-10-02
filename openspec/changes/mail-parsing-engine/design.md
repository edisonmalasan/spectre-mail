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