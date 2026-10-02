import { describe, expect, it } from "vitest";

import { detectVerificationCodes, explainCodePenalty } from "./detect-codes";
import { roundConfidence } from "./scoring";

/** The highest score the arithmetic can reach, per the module's published rules. */
const MAX_REACHABLE = 0.85;

/**
 * Assert a reported score is a clean two-decimal number.
 *
 * Stated as "rounding to two places changes nothing", not as "`score * 100` is a whole
 * number". Those look like the same assertion and are not: `0.55 * 100` is
 * `55.00000000000001` in floating point, so the arithmetic form rejects a score that is
 * already perfectly clean — a check narrower than the rule it claims to enforce, which
 * would have pushed the implementation into being wrong to satisfy it.
 */
function expectCleanScore(value: number): void {
  expect(roundConfidence(value)).toBe(value);
}

/**
 * Read the score of one value out of a result, so a test asserts about a *candidate*
 * rather than about array position — position is already covered by the ranking
 * tests, and coupling every assertion to it would make the ranking tests pass for the
 * wrong reason.
 */
function scoreOf(readable: string, value: string): number {
  const found = detectVerificationCodes(readable).find((code) => code.value === value);
  if (found === undefined) {
    throw new Error(`no candidate for ${value} in: ${JSON.stringify(readable)}`);
  }
  return found.confidence;
}

describe("candidate extraction", () => {
  it("accepts a four-digit run", () => {
    expect(detectVerificationCodes("Your verification code is 8421").map((c) => c.value)).toEqual([
      "8421",
    ]);
  });

  it("accepts an eight-digit run", () => {
    expect(
      detectVerificationCodes("Your verification code is 12345678").map((c) => c.value),
    ).toEqual(["12345678"]);
  });

  it("rejects a three-digit run", () => {
    expect(detectVerificationCodes("Call 123 to confirm").map((c) => c.value)).toEqual([]);
  });

  it("rejects a nine-digit run", () => {
    expect(detectVerificationCodes("Order 123456789 confirmed").map((c) => c.value)).toEqual([]);
  });

  it("does not extract digits from the middle of a longer run", () => {
    // The failure this guards: a ten-digit account number yielding its last eight
    // digits as a plausible "code", which the user would then try to paste somewhere.
    const result = detectVerificationCodes("Account 9876543210 was charged");

    expect(result).toEqual([]);
  });
});

describe("wording raises confidence", () => {
  it("scores a value higher beside verification wording than without it", () => {
    const withWording = scoreOf("Your verification code is 551203", "551203");
    const withoutWording = scoreOf("The number is 551203", "551203");

    expect(withWording).toBeGreaterThan(withoutWording);
  });

  it("lets a value standing alone in its block borrow the wording above it", () => {
    // The corpus's `block-separated-code` and `discord-style-verification` shapes. Under
    // the rule as originally proposed — own block only — both scored 0.6, because the
    // wording and the number sat in different paragraphs. A detector that cannot rank
    // the messages the roadmap describes is not finished.
    const separateBlock = scoreOf("Your verification code is\n\n551203", "551203");
    const sameBlock = scoreOf("Your verification code is 551203", "551203");

    expect(separateBlock).toBe(sameBlock);
  });

  it("borrows a heading above a bare value too", () => {
    const underHeading = scoreOf("Example Chat — account verification\n\n573091", "573091");
    const besideNothing = scoreOf("Some heading\n\n573091", "573091");

    expect(underHeading).toBeGreaterThan(besideNothing);
  });

  it("does not let a value in a sentence of its own borrow the block above", () => {
    // The narrowing that keeps the widening honest. "Item 551203 left the warehouse"
    // is a sentence about an item; the paragraph above it is not what that number is.
    const inSentence = scoreOf("Confirm your shipment\n\nItem 551203 left the warehouse", "551203");
    const bare = scoreOf("Confirm your shipment\n\n551203", "551203");

    expect(bare).toBe(MAX_REACHABLE);
    expect(inSentence).toBeLessThan(bare);
  });

  it("ignores a bare 'code', which is what discount and source mail says", () => {
    // A keyword that fires on unrelated mail is a keyword that gets tuned away within
    // a month, and tuning it away is how a detector silently stops detecting.
    const discount = scoreOf("Use discount code 551203 at checkout", "551203");
    const verification = scoreOf("Your verification code is 551203", "551203");

    expect(discount).toBeLessThan(verification);
  });
});

describe("non-code shapes reduce confidence rather than removing the value", () => {
  it("still returns a penalised value", () => {
    const result = detectVerificationCodes("Order 123456 confirmed");

    // This is the distinction the whole design turns on. Dropping it would mean an
    // order confirmation containing a real six-digit code silently hides it.
    expect(result.map((code) => code.value)).toEqual(["123456"]);
  });

  it("ranks a penalised value below an unpenalised one of the same shape", () => {
    const readable = "Order 123456 confirmed\n\nYour verification code is 551203";
    const result = detectVerificationCodes(readable);

    expect(result.map((code) => code.value)).toEqual(["551203", "123456"]);
    expect(result[0]?.confidence).toBeGreaterThan(result[1]?.confidence ?? 0);
  });

  it("reduces a value beside a currency marker", () => {
    const price = scoreOf("Total: $551203", "551203");
    const code = scoreOf("Your verification code is 551203", "551203");

    expect(price).toBeLessThan(code);
    expect(explainCodePenalty("Total: $551203", "551203")).toContain("a price");
  });

  it("reduces a value beside a tracking label", () => {
    const readable = "Tracking number 7788123";
    const tracking = scoreOf(readable, "7788123");
    const code = scoreOf("Your verification code is 7788123", "7788123");

    expect(tracking).toBeLessThan(code);
    expect(explainCodePenalty(readable, "7788123")).toContain("a tracking number");
  });

  it("never has to reduce a full-length tracking number, because length already excludes it", () => {
    // Recorded because it means the tracking rule's *reachable* cases are the short
    // ones. A 13-digit courier number is not a candidate at all, so this rule is
    // narrower than it looks — it guards international formats, not domestic ones.
    expect(detectVerificationCodes("Tracking number 9400111899562")).toEqual([]);
  });

  it("reduces the last group of a grouped phone number", () => {
    // The reachable case for the phone rule. A grouped number never reaches the
    // detector whole — only its groups do — so the judgement is made on the block, and
    // only a token carrying punctuation can be a phone number.
    const readable = "Call +1 555-1234 ext 9 to reach us";
    const group = scoreOf(readable, "1234");
    const code = scoreOf("Your verification code is 1234", "1234");

    expect(group).toBeLessThan(code);
    expect(explainCodePenalty(readable, "1234")).toContain("a phone number");
  });

  it("does not treat an eight-digit code as a phone number", () => {
    // The bug the corpus found. The phone rule used to ask whether the candidate's own
    // value looked like a phone number — but candidates are bare digit runs, so that
    // test matched *every* seven- and eight-digit value and nothing else. This
    // assertion is the regression.
    const readable = "<p>Your verification code is 12345678</p>";
    const strong = scoreOf(readable, "12345678");
    const weak = scoreOf("<p>Some heading</p><p>12345678</p>", "12345678");

    expect(strong).toBe(MAX_REACHABLE);
    expect(strong).toBeGreaterThan(weak);
    expect(explainCodePenalty(readable, "12345678")).toEqual([]);
  });

  it("does not read a code shown as two space-separated groups as a phone number", () => {
    // Narrowed during M4 verification. The phone token's character class held
    // whitespace, so `1234 5678` — the same code, presented in two groups — was
    // penalised as a phone number and scored 0.5 instead of 0.75 on wording that was
    // otherwise perfect. A space is a presentation choice, not a phone's punctuation.
    const readable = "Your verification code is 1234 5678";

    expect(scoreOf(readable, "1234")).toBe(0.75);
    expect(scoreOf(readable, "5678")).toBe(0.75);
    expect(explainCodePenalty(readable, "1234")).toEqual([]);
    expect(explainCodePenalty(readable, "5678")).toEqual([]);
  });

  it("does not read an ISO date as a phone number", () => {
    // The same over-reach, seen from the date side: `2026-04-15` and `555-1234` are the
    // same characters in the same class, so before the date was separated out, an ISO
    // date took a phone penalty for a cause it did not have. The score is unchanged
    // here — the total-penalty cap hid the double count — which is exactly why the
    // penalty *names* are asserted rather than the number alone.
    const readable = "Placed 2026-04-15";

    expect(explainCodePenalty(readable, "2026")).toEqual(["a date", "a year"]);
    expect(explainCodePenalty(readable, "2026")).not.toContain("a phone number");
  });

  it("still reads a genuinely grouped number as a phone number", () => {
    // The control for the two above. If narrowing the class had removed hyphen along
    // with whitespace, this rule would have had no reachable case left at all and the
    // two passing tests would have been passing for the wrong reason.
    expect(explainCodePenalty("Call +1 555-1234 today", "1234")).toContain("a phone number");
    // Grouped by a dot, which is the other punctuation the class keeps.
    expect(explainCodePenalty("Call 555.1234 today", "1234")).toContain("a phone number");
    // Recorded as a limit rather than left implicit: a parenthesised group alone is no
    // longer reachable, because `(555) 1234` is only six characters of punctuation and
    // the token pattern needs seven. Dropping whitespace necessarily narrowed this.
    expect(explainCodePenalty("Call (555) 1234 today", "1234")).toEqual([]);
  });

  it("reduces a value labelled as an identifier", () => {
    const readable = "Customer ID: 4471902";
    const identifier = scoreOf(readable, "4471902");
    const code = scoreOf("Your verification code is 4471902", "4471902");

    expect(identifier).toBeLessThan(code);
  });

  it("reduces a bare year, and says so", () => {
    // The honest cost: a four-digit code that happens to be 2026 is penalised as a
    // year. It is still returned and still ranked, which is the right outcome — only
    // the user can settle a genuinely ambiguous value.
    const readable = "Copyright 2026 Example Ltd";
    const result = detectVerificationCodes(readable);

    expect(result.map((code) => code.value)).toEqual(["2026"]);
    expect(explainCodePenalty(readable, "2026")).toContain("a year");
  });

  it("penalises a date even when nothing else in the block matches a shape", () => {
    // **The `DATE` shape's only corpus case was untested.** The one fixture input where
    // it fires is `2026-04-15` in the order confirmation, and that value matches three
    // shapes at once — date, phone, year — with the 0.35 total cap saturating. So
    // deleting `DATE` from `REDUCING_SHAPES` left the whole suite green: the shape was
    // published in D4 and present in the code while no assertion depended on it.
    //
    // This input is chosen so `DATE` is the *only* shape that can match. No currency
    // marker, no `order`/`invoice`/`ref` word, no tracking or postal label, and 663218
    // is neither a `19xx`/`20xx` year nor long enough to be grouped with punctuation.
    // The comma after `15` is load-bearing too: it is not in the phone token's class,
    // so nothing else can reach the value. Verified by measurement before asserting —
    // the `Apr 15 663218` spelling suggested for this test reaches the same score only
    // because of the whitespace the phone shape used to accept.
    const readable = "Delivered April 15, 663218";

    expect(explainCodePenalty(readable, "663218")).toEqual(["a date"]);
    // base 0.5, sole-candidate boost 0.1, one shape at 0.25.
    expect(scoreOf(readable, "663218")).toBe(0.35);
  });

  it("keeps a penalised candidate above the floor rather than scoring it zero", () => {
    // Rewritten during M4 verification. It asserted `toBeGreaterThan(0)`, which is true
    // of every possible output of this module — it passed for any input and therefore
    // held nothing. It now pins the **published minimum**, so deleting the constant
    // `MAX_TOTAL_PENALTY` (which pushes the arithmetic below the floor and lets the
    // clamp bind) makes it go red.
    //
    // The minimum is derived, not observed: a block with **more than one** digit run
    // forfeits the `+0.1` sole-candidate boost, so the worst arithmetic is
    // `BASE 0.5` with the penalty saturated at `0.35`, giving `0.15`. A one-run block
    // cannot go below `0.25`, which is why the input below deliberately shares a block
    // between two digit runs.
    const readable = "Order 123456 ref: 98765";
    const worst = Math.min(...detectVerificationCodes(readable).map((code) => code.confidence));

    expect(worst).toBe(0.15);
  });

  it("caps the total penalty so a triple match stays a weak candidate, not a nonsense one", () => {
    const triple = scoreOf("Order 123456 tracking 123456 ZIP 123456", "123456");
    const double = scoreOf("Order 123456 ZIP 123456", "123456");

    // Pinned to the published arithmetic: base 0.5, three shapes at 0.25 each is 0.75,
    // the total penalty is capped at 0.35, so the score is 0.15.
    //
    // Asserting only that the two are equal is **not** sufficient, and this was
    // observed rather than reasoned: with the cap deleted, both scores fall through
    // zero and clamp to the same 0.05 floor, so the equality still held and the suite
    // stayed green. That is the seventh recorded instance in this repository of a check
    // narrower than the rule it claims to enforce — an equality that survives the
    // removal of the thing it was written to pin down.
    expect(triple).toBe(double);
    expect(triple).toBe(0.15);
    expect(triple).toBeGreaterThan(0);
    expect(triple).toBeLessThan(0.5);
  });

  it("boosts the only digit run in a block with no verification wording at all", () => {
    // Pins `SOLE_CANDIDATE_BOOST`'s actual condition, which the constant's comment used
    // to misstate. The comment claimed a block "that talks about verification"; the code
    // has always tested `blockRunCount === 1` alone, with no keyword requirement, so a
    // wording-free message still collects the boost and scores 0.6 rather than 0.5.
    //
    // The wording-bearing comparison is included so the assertion cannot pass because
    // the boost simply always fires: if `KEYWORD_BOOST` and `SOLE_CANDIDATE_BOOST`
    // collapsed into one, both halves here would still hold. The gap between them is
    // exactly what the two constants are.
    const wordingFree = scoreOf("The number is 551203", "551203");
    const withWording = scoreOf("Your verification code is 551203", "551203");

    expect(wordingFree).toBe(0.6);
    expect(withWording).toBe(0.85);
    expect(withWording - wordingFree).toBe(0.25);
  });

  it("withholds the sole-candidate boost from a block carrying several digit runs", () => {
    // The other half of the condition. Both values here are 0.6 and both have no
    // wording, so only the boost separates them: a second digit run in the same block
    // costs the lone one its +0.1.
    const alone = scoreOf("Reference 551203", "551203");
    const shared = scoreOf("Reference 551203 backup 992417", "551203");

    expect(alone).toBe(0.6);
    expect(shared).toBe(0.5);
  });
});

describe("every plausible candidate is surfaced", () => {
  it("reports several candidates in one message, ranked", () => {
    const readable = "Your verification code is 551203\n\nBackup code 992417";
    const result = detectVerificationCodes(readable);

    expect(result.map((code) => code.value)).toEqual(["551203", "992417"]);
  });

  it("reports a weakly-worded candidate rather than dropping it", () => {
    const result = detectVerificationCodes("The number is 551203");

    expect(result.map((code) => code.value)).toEqual(["551203"]);
  });

  it("reports nothing for a message with no plausible code", () => {
    expect(detectVerificationCodes("Hello, and welcome aboard.")).toEqual([]);
  });

  it("does not name a single winner", () => {
    const result = detectVerificationCodes(
      "Your verification code is 551203\n\nBackup code 992417",
    );

    // M10's fill rules require asking when more than one input is possible, which is
    // only possible if the parser hands over more than one.
    expect(result).toHaveLength(2);
    expect(result.every((code) => "value" in code && "confidence" in code)).toBe(true);
  });
});

describe("duplicates collapse to the highest confidence", () => {
  it("reports a repeated value once", () => {
    const readable =
      "Your verification code is 483920\n\nIf this was not you, code 483920 stands by";
    const result = detectVerificationCodes(readable);

    expect(result.map((code) => code.value)).toEqual(["483920"]);
  });

  it("keeps the higher score when one occurrence has stronger wording", () => {
    const alone = scoreOf("551203", "551203");
    const repeated = scoreOf("551203\n\nYour verification code is 551203", "551203");

    // The same code repeated in a footer must not be penalised for being in a footer.
    expect(repeated).toBeGreaterThan(alone);
    expect(detectVerificationCodes("551203\n\nYour verification code is 551203")).toHaveLength(1);
  });
});

describe("no detection is reported as certain", () => {
  it("keeps the strongest possible match below certainty", () => {
    const strongest = scoreOf("Your verification code is 483920", "483920");

    // Wording is a signal, not a proof. A product that says "this is your code" about
    // the wrong number teaches a user to trust a detector that cannot be sure.
    expect(strongest).toBeLessThan(1);
    expect(strongest).toBe(MAX_REACHABLE);
  });

  it("reports every score inside the shared model's range", () => {
    const readable = "Your verification code is 483920\n\nOrder 98765\n\n© 2026 Example";
    const scores = detectVerificationCodes(readable).map((code) => code.confidence);

    expect(scores.length).toBeGreaterThan(0);
    for (const score of scores) {
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
      expect(score).toBeLessThan(1);
      expectCleanScore(score);
    }
  });
});

describe("determinism", () => {
  it("produces identical results for identical input", () => {
    const readable = "Your verification code is 483920\n\nOrder 98765";
    const first = detectVerificationCodes(readable);
    const second = detectVerificationCodes(readable);
    const third = detectVerificationCodes(readable);

    expect(second).toEqual(first);
    expect(third).toEqual(first);
  });
});
