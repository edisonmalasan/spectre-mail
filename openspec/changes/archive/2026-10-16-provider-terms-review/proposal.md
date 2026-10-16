# Provider terms review

## Why

M12's provider review is the last item in the milestone, and it is the one item whose absence has
been load-bearing this whole time. `docs/PROVIDERS.md` records that **no Mail.tm terms page exists**,
and every provider decision in this repository has leaned on that absence: that is *why* proxying is
banned as a **product policy rather than a terms judgement**, and why no attribution direction may be
claimed.

**Measured on 2026-10-16, that absence is half wrong, and the wrong half came from a probe that
guessed a path.** `docs/PROVIDERS.md:234` cites `https://mail.tm/terms` -> `404`. The site serves its
real paths **locale-prefixed** — the same document, at `:235`, records `https://mail.tm/en/faq/` ->
`200` — and at the locale-prefixed paths:

```text
mail.tm /terms            404        mail.tm /en/terms/            404
mail.tm /privacy          404        mail.tm /en/privacy/          200   Privacy Policy - Mail.tm
mail.tm /legal            404        mail.tm /en/terms-of-service/ 404
mail.tm /imprint          404        mail.tm /en/imprint/          404
```

**So the conclusion about *terms* holds — Mail.tm serves no terms at any path tried — and the same
probe method would have concluded its privacy policy was absent too.** A `404` on a guessed path is
not evidence of absence at a site whose real paths are prefixed, and **this repository wrote down the
guessed path and the prefixed path in consecutive lines of the same section.**

## What Changes

- **ADDED** `provider-abstraction` — **no provider decision rests on a terms claim this repository
  has not read at the provider's own published path**, and a probed path is named as a path rather
  than as a page.
- **ADDED** `mailbox-session` — the polling cadence **states the provider guidance it was measured
  against**, attributed and scoped, and a provider that publishes qualitative guidance is quoted
  rather than reported as silent.
- **MODIFIED** `privacy-disclosure` — *Provider attribution is stated in neither direction* — because
  **its own body says "Guerrilla Mail publishes nothing this repository found", and that is now
  measured false.**

**Two `ADDED` and one `MODIFIED`, so the promoted requirement count moves by exactly two.** That is
the arithmetic working, not a promotion that missed: a `MODIFIED` block replaces rather than adds.
**It is the first milestone in four to produce a `MODIFIED`,** and the shape is the reason — this is
the first change whose own finding falsified a sentence in an already-promoted requirement.

## The measurement that made this a change and not a document

**Guerrilla Mail publishes Terms of Service, linked from its own homepage, and this repository has
never read them.** `https://www.guerrillamail.com/` links `/about` and `/tos`. Verbatim from `/tos`:

> *"Guerrilla Mail acts as **Software Service Provider**, granting you a license for the use of the
> software provided by our website. Your rights to the license are bound by the terms."*

> *"Generally, this service prohibits: **Over-use our resources by repeatedly making many requests to
> our servers**. Reverse engineer, circumvent or attack our website for the purpose of gaining
> unauthorised privileges. Use of our service for purposes other than intended."*

> *"The license is non-transferable, subject to change, and Guerrilla Mail has the right to change or
> revoke licenses at any time."*

**And Guerrilla's API document says, verbatim:**

> *"Note: The API may be rate limited, **but we do not publish our rate limits**."*
>
> *"**The client should not check email too many times as to not overload the server.**"*

**`docs/PROVIDERS.md` records that Guerrilla "publishes nothing" about rate limits. It publishes
both of those sentences, in the API document this repository already cites as its source.** And the
second is addressed to **a client** — which is what this product is.

## What this does not say, and the reason it does not say more

**Nothing here says the cadence is wrong.** A qualitative prohibition and a qualitative
recommendation are not a limit, and this repository's rule is that a limit it has not measured must
not be invented. **What the change does is make the cadence's basis honest**: it was chosen against
a provider believed to publish nothing, and the provider publishes a sentence addressed to clients
that asks them not to check email too often. **A maintainer reading those two facts together is
better placed than one reading "no published limit", and the product's footer already renders
Mail.tm's verbatim limit statement — so the mechanism exists and only the quote was missing.**

## What ships

| file | role |
| --- | --- |
| `docs/PROVIDERS.md` §2 | corrected: Mail.tm's privacy policy located at the prefixed path; Guerrilla's `/tos` read, quoted, and attributed; its API document's two sentences quoted verbatim |
| `tests/architecture/provider-terms.test.ts` | resolves every terms claim `docs/PROVIDERS.md` and `docs/PRIVACY.md` make against the shipped record — **and asserts that no claim rests on a path that was probed rather than served** |

## What this change deliberately does not do

- **It does not change the cadence.** That is a product decision about a risk this change only
  now makes visible, and it belongs to whoever reads the finding.
- **It does not state a legal position.** A terms page read is not advice, and nothing here says
  what any use is permitted.
- **It does not re-probe either provider's behaviour.** No spike ran; this is a document review.