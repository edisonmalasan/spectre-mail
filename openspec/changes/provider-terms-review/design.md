# Provider terms review — design

## D1 — The finding is a probed path, not an absent document

`docs/PROVIDERS.md:234` cites `https://mail.tm/terms` -> `404` as the basis for *"no terms page
exists"*. The same section, at `:235`, cites `https://mail.tm/en/faq/` -> `200`. **The repository
knew the site prefixes its real paths and probed an unprefixed one anyway.**

Re-measured 2026-10-16 at both shapes:

| path | result |
| --- | --- |
| `mail.tm/terms` | **404** |
| `mail.tm/en/terms/` | **404** |
| `mail.tm/en/terms-of-service/` | **404** |
| `mail.tm/en/legal/` | **404** |
| `mail.tm/en/imprint/` | **404** |
| `mail.tm/privacy` | **404** |
| `mail.tm/en/privacy/` | **200 — Privacy Policy - Mail.tm** |
| `mail.tm/en/about/` | **404** |

**The conclusion about terms survives; the method does not.** At the prefixed shape, one of the two
documents this repository treats as absent is served. **A `404` on a guessed path is not evidence
of absence**, and the cost of the guess was one wrong half of one sentence — which the repository
then generalised into *"treat every terms-derived claim as unverified"*, a rule that is right and
that would have been right for the wrong reason.

**The rule that comes out of this is about how a path is recorded, not about what a path returned.**
A probed path that 404s is evidence that *that path* is not served. It is not evidence about the
site, and the difference is the difference between a fact and an inference from a fact.

## D2 — Mail.tm's privacy policy references a terms document its own site does not serve

The policy states, verbatim:

> *"it is found that your use of this site violates the site editor's policy, **terms of service**,
> or other usage guidelines"*

**The policy refers to terms of service, and every route tried for one returns 404.** That is a
precise and checkable statement, and it cuts exactly the way this repository's standing rule says:
**not to assume an obligation is absent, and therefore not to assume one is present either.** The
honest reading is that a document exists somewhere this repository has not found, not that no
obligation exists — and *that* is what `privacy-disclosure`'s attribution requirement already
demands, so the requirement is right and only its supporting sentence about the *other* provider
was wrong.

## D3 — Guerrilla Mail's Terms of Service exist, and the licence they grant is to *software*

`https://www.guerrillamail.com/` links `/about` and `/tos`. The terms state:

> *"Guerrilla Mail acts as **Software Service Provider**, granting you a license for the use of the
> software provided by our website. Your rights to the license are bound by the terms."*

**"Software Service Provider" is a material fact about what the provider is offering, and this
product ships a client that calls its API.** Nothing in the terms grants a third-party client
anything; the licence runs between Guerrilla Mail and the person using its software, and it is
**"non-transferable, subject to change"** with Guerrilla holding *"the right to change or revoke
licenses at any time"*.

**The requirement this produces is about how a decision is documented, not about whether this
product may use the API.** The repository's own rule already bans proxying as a **product policy
rather than a terms judgement** — a decision this change does not revisit. What changes is that the
policy is now stated beside a terms page that has been read, instead of beside an assumption that
none exists.

## D4 — The cadence's basis was an absence, and the provider publishes a sentence addressed to clients

This is the finding with teeth, and the requirement is deliberately narrow.

`docs/PROVIDERS.md` records that no provider limit was measured for the only provider a browser can
reach, because *"Guerrilla publishes nothing."* **Guerrilla's API document publishes two sentences:**

> *"Note: The API may be rate limited, **but we do not publish our rate limits**."*
>
> *"**The client should not check email too many times as to not overload the server.**"*

**The first confirms the repository's finding and the second is new**: a qualitative guidance
addressed to a client. **The product polls that provider every 5 seconds while a mailbox's contents
are changing**, doubling per unchanged check, capped at 30s.

**What the change does NOT do is change the cadence**, for two recorded reasons. A qualitative
prohibition is not a limit, and this repository's rule is that a limit it has not measured must not
be invented. And the cadence has never run against a live provider at all, so no figure here says
what five seconds costs anybody.

**What it does is make the cadence's basis honest.** It was chosen against a provider believed to
publish nothing; the provider publishes a sentence addressed to clients asking them not to check
email too often. **The product already renders a provider's verbatim limit statement — Mail.tm's
`30; w=60`, attributed, with its scope disclaimed — so the mechanism exists and only the quote was
missing.** The requirement is therefore *state the guidance the cadence was measured against*,
which is checkable, rather than *poll less often*, which is not this change's to decide.

## D5 — The instrument resolves claims about the shipped record, and it cannot resolve the web

A terms page read on a date is a measurement of the world, not of the tree, so it cannot be
re-verified by a test — and **an instrument that claimed to would be a check that could not fail**.
What *can* be checked is the repository's own use of it:

- every terms claim `docs/PROVIDERS.md` and `docs/PRIVACY.md` make names a **path that was served**,
  and a claim resting on a path that returned `404` is reported by name;
- no architectural decision cites a terms claim, in either direction — the standing rule, enforced;
- the attribution requirement's own supporting sentence about a provider matches what was read.

**This is the `security-audit.test.ts` shape with the arrow reversed**: that instrument resolves a
document's citations into the tree, and this one resolves a document's citations into *the shape of
its own evidence*.

## D6 — One requirement is `MODIFIED`, which changes this milestone's arithmetic

`privacy-disclosure`'s *Provider attribution is stated in neither direction* says, in its body:

> *"**Guerrilla Mail publishes nothing this repository found.**"*

**That is now measured false.** So the block is `MODIFIED` rather than `ADDED`, and **the promoted
requirement count therefore moves by two rather than three** — a `MODIFIED` block replaces rather
than adds. **That is the arithmetic working and not a promotion that missed**, and it is the first
milestone in four to produce a `MODIFIED`: the previous three shapes were three `ADDED`, three
`ADDED`, and three `ADDED`. **The reason the shape changed is the finding itself** — this is the
first change whose own review falsified a sentence inside an already-promoted requirement, and the
only honest response to that is to amend the requirement rather than to add a neighbour that
contradicts it.

**Adding a sibling requirement instead would have left `openspec/specs/` holding two requirements
that contradict each other**, which is the shape this repository records as where an amendment gets
attributed to the wrong assertion.

## D7 — What this change cannot establish, stated rather than smoothed over

- **No legal position, and no statement that any use is permitted.** A terms page read is not advice.
- **No claim about the `.com`-adjacent holder, or any other party.** Nothing here reaches outside the
  two providers this product contacts.
- **The terms can change, and the record is a date.** `docs/PROVIDERS.md` already carries
  "re-run before release"; this change adds no mechanism that re-runs it, because **re-running it is
  a human act against a website, and a test that fetches a provider would be a live network call in a
  suite whose standing property is that it makes none.**
- **Whether Chrome Web Store distribution is compatible with provider policy is `UNMEASURED` here.**
  It is one of the roadmap's five re-check items and this change records that it remains so rather
  than answering it by argument.
- **`docs/PROVIDERS.md` is on this repository's do-not-touch list.** The active task explicitly
  requires it, which is the condition that list states. Nothing else on that list is touched.

## D8 — Apply-stage record (2026-10-16)

### What shipped, and what it did not move

**`docs/PROVIDERS.md` is +180 / -34 across five edits, and `tests/architecture/provider-terms.test.ts`
is new at 11 cases.** No file under `apps/` or `packages/` changed, no `package.json` changed, and
**`apps/extension/static/manifest.json` is byte-identical by Git blob hash**
(`847ce07cfff39b00b4461067d12a6ffb0649a4a8` at `HEAD` and in the working tree — checked with
`git rev-parse` and `git hash-object`, not with `git diff`, because `git diff` was empty and an empty
diff is a claim about a *path* rather than a blob).

**One edit is outside §1 and §2 and is called out rather than buried:** §3's
`### Terms that affect the product` was a three-line stub reading *"Not re-verified by this spike"*,
and tasks 1.4, 1.5 and 1.6 require Guerrilla Mail's terms, its API document and the absence of an
attribution clause to be recorded. **That subsection is the document's own slot for the other
provider's terms**, so it was filled in and nothing else in §3 was touched. A §6 cross-reference
("see §2, which records that no Mail.tm terms page could be found") was corrected in the same pass,
because it is a cross-reference *into* §2 and would otherwise be the one stale sentence in the file.

### The instrument's shape, and why it is a map and not a sweep

`termsCitationsIn` finds a sentence that attributes an obligation or a permission to a provider's
terms, over **a closed set of fifteen verb forms in both grammatical orders**, and excludes
blockquotes structurally — a provider's own sentence is not this repository's claim, and a keyword
reader cannot tell the two apart.

**Measured against the three decision documents it names, the reader finds exactly three candidate
sentences**, and all three resolve: one in `docs/PROVIDERS.md` §1 and one in `AGENTS.md`'s
architecture rules each carry a **declared disclaimer**, and `docs/ARCHITECTURE.md` carries **none**.
That last fact is a measurement about the document, **not a fact about the reader**, so
`docs/ARCHITECTURE.md` is not asked to carry a citation and the reader is instead shown a citation
planted into architecture-shaped prose in the case below it. **Zero is never evidence that a reader
worked.**

**The verbs are spelled out and no `s?` is hung off a stem.** The first run of this file found
nothing in `AGENTS.md`, and the reason is the sentence that states the standing rule: *"do not assume
a required obligation is absent"*. `require` followed by a word boundary does **not** match *required* —
the reader stopped one character short, matched nothing, and **reported a clean tree.** That is the
most-recorded defect in this repository in its purest form, and it was caught only because the
non-vacuity assertion *required* `AGENTS.md` to yield a citation rather than merely permitting it.

**A fourth document carries a live violation of the rule this instrument checks.**
`docs/ROADMAP.md:3187` reads *"its terms forbid proxying, so no compliant design lets a SpectreMail web
page read it"* — **the exact withdrawn claim this change exists to end, stated as current rationale
in the roadmap.** It is outside the instrument's declared scope (`tasks.md` 3.3 names only
`docs/ARCHITECTURE.md`, `AGENTS.md` and `docs/PROVIDERS.md`) and outside the apply stage's write
scope. **It is reported, not repaired.** A sweep pointed at four files would have caught it; a sweep
pointed at three files and a list that says three looks identical from here, which is why the list is
a declared constant rather than a directory glob.

### Two pre-existing reds, and one finding this change produced

**`pnpm verify` is red, three times out of three, and none of the three is a surprise.**

1. **`docs/PRIVACY.md` §6 has drifted from what was read — this is the finding, and it is
   BLOCKING.** `provider-terms.test.ts`'s attribution case reports four items: both rows carry
   `2026-10-02` where the record carries `2026-10-16`, the Mail.tm row still reads *"No terms page
   exists"* off a probed path, and the Guerrilla Mail row still reads *"Nothing this repository found"*
   where `/tos` **was served and was read.** `tasks.md` 6.4 anticipated this and told the apply stage
   to report it rather than rewrite the document whose claims the instrument resolves, so
   **`docs/PRIVACY.md` was not edited and the instrument was not weakened.** The remedy is two table
   cells and belongs to whoever owns that document.

2. **`branding-audit.test.ts` is flaky, and it is NOT this change.** `shippedFiles()` calls
   `statSync(child)` on line 389 **before** the `PROBE_FILE.test(entry)` guard on line 400 — so a probe
   that `boundaries.test.ts` staged and then deleted in another worker dies with `ENOENT` on the
   `statSync`, and the guard that was written for exactly this never runs. The file's own header
   documents the failure it was repaired for; **the repair is one line too late.** Measured by
   stashing this change and running the full suite four times on the clean tree: **4 of 4 red, 3 of 4
   with the `ENOENT`**, against **1 of 3 red with the change applied.** Both files are outside this
   stage's write scope.

3. **`apps/extension/src/Panel.test.tsx` is flaky, and it is not this change either.** *"names the
   mailbox this page resolves to and the provider that served it"* failed with *"Unable to find
   role=heading and name guerrilla"* in the same runs, and is absent from every clean run. Also
   outside this stage's write scope.

**A red with no name is not a finding**, so all three are named, and **none was rounded away**.

### The falsification pass: 9 of 9, caught by the assertion each was aimed at

`wrongcatch`, `green`, `noop`, `nocompile` and `harness-error` are **all zero**. Two of the nine
mutate the *reader* rather than the data (V02 disables the unserved filter; V04 deletes the
`AGENTS.md` disclaimer so the sentence that states the rule becomes an unresolved citation), because a
pass in which only the fixture moves is not evidence that the instrument reads. **Pre-mutation
SHA-256 digests were taken before the first mutation and every file was verified byte-identical after
the last**, and `pnpm build` was re-run from the restored source (exit `0`).

**The harness's own self-test is 5/5 and was run in BOTH argument orders**, because reading `argv[2]`
resolves `--self-test` as a directory and that mistake has been made twice in this repository already.
**Its fifth case earned its keep on the first run**: it reported *"unresolved: V01"* because Prettier
had reflowed the anchor the violation aimed at. **A harness that checks its own anchors before writing
anything is what turned a silent no-op into a reported failure** — and the first version of a
falsification harness in this repository shipped two mutations as uncaught for exactly that reason.

### What the pass does not establish, added to D7 rather than replacing it

- **Nothing here is a re-measurement.** Every figure in the record carries `2026-10-16` and **no spike
  ran and no provider behaviour was re-probed**; this is a document review.
- **The instrument cannot re-read a website**, by design. **A claim recorded as served here was read by
  a person on a date**, and a terms page that changes tomorrow leaves this file green until a human
  goes and looks.
- **The quotes are checked for presence, not for accuracy.** The instrument asserts that the record
  *carries* a clause; it cannot assert that the provider still *says* it.
