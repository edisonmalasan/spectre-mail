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