/**
 * One-time code detection.
 *
 * Deterministic by product principle: no AI, no network, no provider, no clock. The
 * same message always yields the same codes with the same confidences, because a user
 * told "483920 is your code" is relying on that being a repeatable answer rather than
 * one sample from a model.
 *
 * ## Every score here is traceable to a stated rule
 *
 * The arithmetic is published below rather than tuned, because a confidence nobody can
 * derive is a confidence nobody can argue with. Change a number here and a fixture's
 * stated expectation changes visibly, which is the reviewable form of that change.
 *
 * ## Nothing is excluded, only ranked
 *
 * The roadmap asks for confidence to be *reduced* for values that read as prices,
 * dates, phone numbers, order numbers, tracking numbers, and postal codes. It does
 * not ask for them to be dropped, and the distinction is the important one: a real
 * order confirmation can contain a six-digit number that genuinely is a code, and the
 * cost of discarding it — the user never sees their code — is far worse than the cost
 * of surfacing one they will not use. So every shape is a **penalty**, and ranking is
 * what makes it work.
 *
 * @module
 */

import { assertConfidence } from "@spectre-mail/core";
import type { VerificationCode } from "@spectre-mail/core";

import { clampConfidence } from "./scoring";

/** The starting score, before any rule contributes. */
const BASE_CONFIDENCE = 0.5;

/** Added when the candidate's block says something about verification. */
const KEYWORD_BOOST = 0.25;

/**
 * Added when the candidate is the **only digit run in its block**.
 *
 * Deliberately wider than the comment this constant used to carry, which claimed a
 * block "that talks about verification". There is no keyword condition, and there was
 * never one: the boost has always fired on `blockRunCount === 1` alone, so
 * "The number is 551203" scored 0.6 rather than 0.5. The implementation is the
 * intended behaviour and D4 publishes the arithmetic, so the wording was wrong rather
 * than the code.
 *
 * The wider rule is also the better one, and for a stated reason: a lone digit run in
 * its own block is more likely to be the thing the message is about, whatever the
 * wording around it says. Requiring verification wording as well would make the boost
 * and `KEYWORD_BOOST` fire on exactly the same set of candidates, which is the same
 * signal counted twice rather than two independent signals.
 */
const SOLE_CANDIDATE_BOOST = 0.1;

/** Removed for each recognised non-code shape, in total. */
const SHAPE_PENALTY = 0.25;

/**
 * The most a set of penalties may take.
 *
 * A message that looks like an order confirmation *and* a shipping notice *and* a
 * receipt should produce a low-ranked candidate, not a negative one. Capping the total
 * keeps the worst case a weak result rather than a nonsensical score.
 */
const MAX_TOTAL_PENALTY = 0.35;

/**
 * The floor, so a heavily penalised candidate is still a candidate.
 *
 * **Unreachable by the arithmetic above, and kept anyway.** The worst score the rules
 * can produce is `BASE 0.5` with the penalty saturated at `MAX_TOTAL_PENALTY 0.35`,
 * which is `0.15`. So this constant cannot bind today, and an M4 verification pass
 * confirmed that deleting it entirely leaves the suite green.
 *
 * Kept rather than deleted, for the same reason `MAX_CONFIDENCE` is kept as a clamp as
 * well as a published sum: it is defence in depth against a **rule added later**.
 * Every term in this module is a number someone can change — a new boost, a larger
 * `SHAPE_PENALTY`, a cap raised above `0.5` — and any of them can push a score past
 * this bound without anyone revisiting this line. The floor then guarantees the
 * property that matters regardless: no detection is ever reported as *worthless*,
 * because D6 returns every candidate and a zero would read as a decision rather than
 * a ranking.
 *
 * Because it is a clamp and not the mechanism, the test that pins the floor's role
 * asserts the arithmetic minimum of `0.15` exactly. Asserting that the worst score is
 * merely greater than zero would pass for every input this module can produce, which
 * is the same defect the M4 verification pass found in that test.
 */
const MIN_CONFIDENCE = 0.05;

/**
 * The highest score this module can produce.
 *
 * **Reachable by construction: `BASE + KEYWORD + SOLE = 0.85`.** No set of rules can
 * reach certainty, which is deliberate. All the evidence here is wording, and wording
 * is a signal rather than a proof. The clamp below is a second line of defence, not the
 * mechanism — if someone adds a rule later and it pushes a score over, the clamp keeps
 * the promise that no detection is ever reported as certain.
 */
const MAX_CONFIDENCE = 0.85;

/** The shortest and longest digit run that can be a one-time code. */
const MIN_DIGITS = 4;
const MAX_DIGITS = 8;

/**
 * Wording that indicates a code is present.
 *
 * Taken from the roadmap's list, plus `passcode` and `authenticate`. Two plausible
 * terms are deliberately **absent**:
 *
 * - Bare `code`, because it appears in discount codes, source code, and promo codes.
 * - Bare `security`, because it appears in advisories and newsletters about security
 *   with no code anywhere near.
 *
 * A keyword that fires on unrelated mail is a keyword that gets tuned away within a
 * month, and tuning it away is how a detector silently stops detecting. The
 * multi-word forms the roadmap lists (`security code`, `login code`) are kept precisely
 * because they are specific.
 */
const CODE_KEYWORDS: readonly string[] = [
  "verification",
  "verify",
  "verification code",
  "security code",
  "one-time",
  "one time",
  "otp",
  "authentication",
  "authenticate",
  "confirmation",
  "confirm",
  "login code",
  "passcode",
  "pass code",
  "pin code",
];

/**
 * Shapes that mean a digit run is probably not a code.
 *
 * Each is a predicate over the candidate's own block, so a price in one paragraph does
 * not penalise a code in another — the same-block rule from `design.md` D3 applies to
 * penalties as well as boosts.
 */
interface ReducingShape {
  /** What this shape is, so a penalty is explainable rather than mysterious. */
  readonly name: string;
  readonly matches: (block: string, value: string) => boolean;
}

/**
 * Matches when the block's wording, the value's own punctuation, or a currency marker
 * says this is money.
 */
const CURRENCY: ReducingShape = {
  name: "a price",
  matches: (block, value) =>
    new RegExp(`[$€£¥₹]\\s*${value}\\b|\\b${value}\\s*[$€£¥₹]`).test(block) ||
    new RegExp(`\\b${value}\\s*(?:USD|EUR|GBP|JPY|CAD|AUD)\\b`, "i").test(block),
};

/** Matches a month name, or a slash- or hyphen-separated date, near the value. */
const DATE: ReducingShape = {
  name: "a date",
  matches: (block, value) =>
    new RegExp(
      `\\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\\.?\\s+\\d{1,2},?\\s*${value}\\b|\\b${value}\\s*[-/]\\d{1,2}[-/]\\d{2,4}\\b|\\b\\d{1,2}[-/]${value}[-/]\\d{2,4}\\b`,
      "i",
    ).test(block),
};

/**
 * A run of digits and phone punctuation long enough to be a grouped number.
 *
 * **The rule this replaces was structurally broken, and the corpus is what showed it.**
 * It read the candidate's own value and asked whether that value "looked like a phone
 * number" — but candidates are extracted as bare digit runs, so the value can never
 * contain a separator. The test therefore matched *every* seven- and eight-digit
 * candidate and no other, penalising every eight-digit one-time code in the corpus.
 *
 * It could not do the one job it was written for: detecting a phone number. A grouped
 * number like `+1 555-1234` never reaches this rule whole, because only its groups are
 * candidates. So the judgement has to be made on the **block**, and only a token that
 * actually carries punctuation can be a phone number.
 *
 * **Narrowed during M4 verification, because the class over-reached.** It held both
 * whitespace and a hyphen, and neither belongs to a phone number:
 *
 * - With whitespace in it, `Your verification code is 1234 5678` was penalised as a
 *   phone number. A space-separated code is a **presentation** choice — it is the same
 *   code — and the shape the shape exists to detect (a phone number) is the one thing
 *   the penalty was wrong about. So `1234 5678` scored 0.5 where 0.75 was right, for
 *   a message whose wording was otherwise perfect.
 * - `Apr 15 663218` was penalised as a phone number *and* as a date for the same span
 *   of text: two penalties, one cause, and the total-penalty cap then hid which one
 *   had fired.
 *
 * Whitespace is therefore out. The hyphen stays, because `555-1234` is a real
 * grouping and is this rule's one reachable case in the corpus. What a hyphen cannot
 * decide on its own is whether `2026-04-15` is a date or a phone number, so that one
 * shape is separated out below rather than guessed at.
 */
const PHONE_LIKE_TOKEN = /(?<![\d+])\+?\d[\d().-]{5,}\d(?![\d])/g;

/**
 * A token that is a hyphenated date rather than a grouped number.
 *
 * `2026-04-15` and `555-1234` are the same characters in the same class, so the token
 * pattern cannot tell them apart. The date is not the phone shape's business: it is
 * already `DATE`'s, and counting it twice inflated the penalty without making the
 * ranking more honest. Anchored, because a token is already an isolated run.
 *
 * **Deliberately aligned with `DATE`'s own separator forms** rather than written as a
 * loose "three hyphenated numbers" test, so the two shapes cannot drift apart again.
 * The middle or leading group may be the candidate, because either can be — measured:
 * `2026-04-15`, `663218-04-15`, and `04-663218-15` all reach `DATE`, and only the
 * first was being spared the double count before this was widened.
 */
const HYPHENATED_DATE_TOKEN = /^(?:\d{4,8}-\d{1,2}-\d{2,4}|\d{1,2}-\d{4,8}-\d{2,4})$/;

/**
 * Matches a candidate that falls inside a grouped number in its block.
 *
 * The punctuation requirement is what makes this rule mean anything: without it, any
 * seven-digit run is a "phone number", and a bare digit run is exactly what an
 * eight-digit verification code looks like.
 */
const PHONE: ReducingShape = {
  name: "a phone number",
  matches: (block, value) => {
    for (const token of block.match(PHONE_LIKE_TOKEN) ?? []) {
      if (HYPHENATED_DATE_TOKEN.test(token)) continue;
      if (/[^\d]/.test(token) && token.replace(/\D/g, "").includes(value)) {
        return true;
      }
    }
    return false;
  },
};

/** Matches a value labelled as an order or reference number. */
const ORDER: ReducingShape = {
  name: "an order number",
  matches: (block, value) =>
    new RegExp(
      `\\b(?:order|order\\s*(?:no|number|#)|invoice|ref)\\s*(?:number\\s*)?[:#-]?\\s*${value}\\b`,
      "i",
    ).test(block),
};

/** Matches a value labelled as a tracking number. */
const TRACKING: ReducingShape = {
  name: "a tracking number",
  matches: (block, value) =>
    new RegExp(`\\btrack(?:ing)?(?:\\s*(?:no|number|#))?\\s*[:#-]?\\s*${value}\\b`, "i").test(
      block,
    ),
};

/** Matches a value labelled as a postal code. */
const POSTAL: ReducingShape = {
  name: "a postal code",
  matches: (block, value) =>
    new RegExp(`\\b(?:postal|post\\s*code|zip(?:\\s*code)?)\\s*[:#-]?\\s*${value}\\b`, "i").test(
      block,
    ),
};

/**
 * Matches a bare year.
 *
 * Note the honest cost: a four-digit code that happens to be `2026` is penalised as a
 * year. It is still returned, still ranked, and still visible to the user — which is
 * the right outcome, because a year-shaped code is genuinely ambiguous and only the
 * user can settle it.
 */
const YEAR: ReducingShape = {
  name: "a year",
  matches: (_block, value) => /^1[89]\d{2}$/.test(value) || /^20\d{2}$/.test(value),
};

/** Matches a value labelled as an identifier, which is usually something else's. */
const IDENTIFIER: ReducingShape = {
  name: "an identifier",
  matches: (block, value) =>
    new RegExp(
      `\\b(?:id|identifier|ref(?:erence)?|account|invoice|customer)\\s*(?:no|number|#)?\\s*[:#-]\\s*${value}\\b`,
      "i",
    ).test(block),
};

/**
 * Every reducing shape, in a fixed order so the reported penalty is deterministic.
 *
 * The order is stable for reproducibility, not meaningful: a value matching three
 * shapes is penalised three times either way.
 */
const REDUCING_SHAPES: readonly ReducingShape[] = [
  CURRENCY,
  DATE,
  PHONE,
  ORDER,
  TRACKING,
  POSTAL,
  YEAR,
  IDENTIFIER,
];

/** One digit run found in a block. */
interface Candidate {
  readonly value: string;
  readonly block: string;
  /** How many digit runs this block contains, for the sole-candidate boost. */
  readonly blockRunCount: number;
  /** The block immediately above this one, when there is one. */
  readonly previousBlock: string | undefined;
}

/** Split readable text into the blocks that same-block association operates over. */
function toBlocks(readable: string): string[] {
  return readable
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter((block) => block !== "");
}

/**
 * A digit run that is 4–8 long and is not part of a longer one.
 *
 * `(?!\d)` and `(?<!\d)` together are what stops a nine-digit account number from
 * yielding its last eight digits as a "code".
 */
const DIGIT_RUN = new RegExp(`(?<!\\d)\\d{${MIN_DIGITS},${MAX_DIGITS}}(?!\\d)`, "g");

function collectCandidates(readable: string): Candidate[] {
  const blocks = toBlocks(readable);
  const found: Candidate[] = [];

  blocks.forEach((block, index) => {
    const runs = block.match(DIGIT_RUN) ?? [];
    const previousBlock = index > 0 ? blocks[index - 1] : undefined;
    for (const value of runs) {
      found.push({ value, block, previousBlock, blockRunCount: runs.length });
    }
  });

  return found;
}

/**
 * Whether a bare candidate may borrow the wording of the block above it.
 *
 * **A widening of the rule proposed for this change, made because the corpus showed
 * the original rule failing on a shape the roadmap names.**
 *
 * `design.md` D3 originally associated a candidate only with its own block. The corpus
 * contains the shapes real templates produce — a code as its own paragraph beneath a
 * heading, or beneath a sentence introducing it — and under the original rule both
 * scored 0.6 instead of 0.85, because the wording and the number were in different
 * blocks. A detector that cannot rank the message the roadmap describes is not
 * finished.
 *
 * The widening is deliberately narrow, because the general version is clearly wrong:
 * any rule of the form "the paragraph above counts" would raise an order number that
 * happens to follow the words "your order is confirmed".
 *
 * So the borrowing has one condition: the candidate's own block must be **nothing but
 * the candidate**. A block that is a bare number has no sentence, no subject, and no
 * verb — there is nothing in it that could be about anything, so the wording above is
 * the only candidate for what it refers to. A block that contains words is a sentence
 * about something, and the code in it is part of that sentence.
 *
 * The cost, stated: a bare number in a block of its own still inherits wording that may
 * not concern it. The failure direction is acceptable because boosting is not
 * reporting — every candidate is returned regardless (`design.md` D6) — so a borrowed
 * boost can mis-rank a message but cannot invent a code or hide one.
 */
function borrowsPrecedingWording(candidate: Candidate): boolean {
  return (
    candidate.previousBlock !== undefined &&
    candidate.blockRunCount === 1 &&
    candidate.block === candidate.value
  );
}

/**
 * Whether the wording associated with a candidate says a code is present.
 *
 * Its own block always counts. The block above counts only under the borrowing rule.
 */
function saysCode(candidate: Candidate): boolean {
  const haystacks = [candidate.block.toLowerCase()];
  if (borrowsPrecedingWording(candidate)) {
    haystacks.push((candidate.previousBlock as string).toLowerCase());
  }
  return haystacks.some((haystack) => CODE_KEYWORDS.some((keyword) => haystack.includes(keyword)));
}

/** The names of the reducing shapes this candidate matches. */
function matchingShapes(candidate: Candidate): string[] {
  return REDUCING_SHAPES.filter((shape) => shape.matches(candidate.block, candidate.value)).map(
    (shape) => shape.name,
  );
}

function score(candidate: Candidate): number {
  let value = BASE_CONFIDENCE;

  if (saysCode(candidate)) {
    value += KEYWORD_BOOST;
  }
  if (candidate.blockRunCount === 1) {
    value += SOLE_CANDIDATE_BOOST;
  }

  const penalties = matchingShapes(candidate).length * SHAPE_PENALTY;
  value -= Math.min(penalties, MAX_TOTAL_PENALTY);

  return clampConfidence(value, { min: MIN_CONFIDENCE, max: MAX_CONFIDENCE });
}

/**
 * Find the one-time codes in readable text.
 *
 * Returns every candidate that survived shape filtering, deduplicated by value, ranked
 * by confidence, highest first. **No minimum is applied.** Where the results should be
 * cut off is a product decision for whoever has a user in front of them, and putting
 * a constant here would let a wrong number silently delete a real code.
 *
 * @param readable Plain text, as produced by `extractReadableContent`.
 * @returns Ranked candidates. Empty when the text contains no plausible code.
 */
export function detectVerificationCodes(readable: string): VerificationCode[] {
  const best = new Map<string, number>();
  for (const candidate of collectCandidates(readable)) {
    const existing = best.get(candidate.value);
    // Highest wins on a duplicate: the same code repeated in a heading and a footer
    // must not be penalised for appearing in the footer.
    best.set(
      candidate.value,
      existing === undefined ? score(candidate) : Math.max(existing, score(candidate)),
    );
  }

  return [...best.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([value, confidence]) => ({
      value,
      // Asserted where a detection enters the model, so an out-of-range score cannot
      // reach storage and later be displayed as if it meant something.
      confidence: assertConfidence(confidence, "code detection"),
    }));
}

/**
 * The names of the shapes that reduced a value's confidence.
 *
 * Exported so a detector's output can be explained rather than merely displayed. A
 * number with no stated reason is not something a user can judge.
 *
 * @param readable Plain text, as produced by `extractReadableContent`.
 * @param value A candidate value, as it appears in the text.
 * @returns The shapes that matched, empty when none did.
 */
export function explainCodePenalty(readable: string, value: string): string[] {
  const candidate = collectCandidates(readable).find((found) => found.value === value);
  return candidate ? matchingShapes(candidate) : [];
}
