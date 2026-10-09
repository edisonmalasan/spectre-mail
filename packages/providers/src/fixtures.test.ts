/**
 * Every recorded fixture says which kind of evidence it is.
 *
 * ## Why this test exists
 *
 * `fixtures.ts` is the substrate for **every** provider assertion in this repository, and
 * its own header makes the claim that matters about it: a fixture that quietly stopped
 * resembling the provider would make the conformance suite green and wrong. That is the
 * failure mode the file exists to prevent.
 *
 * The M10 slice that added `guerrillaMessageWithVerificationLink` is the case that made
 * the gap concrete. This repository has **never received verification mail from any
 * service** — `docs/PROVIDERS.md` records the one real delivery, and it carried a code
 * and no link — so the slice had to invent a message body to put a link in front of a
 * browser. **Inventing one is legitimate here and labelling it is mandatory**, because an
 * unlabelled synthetic fixture is a fabricated measurement wearing a recording's clothes,
 * and the next reader has no way to tell which they are holding.
 *
 * **The rule is over every fixture, not over the one this slice added.** Asserting that
 * *this* fixture's comment contains the word `SYNTHETIC` would be satisfiable by editing
 * the test, and would say nothing about the fixture added next month. A scan is the only
 * version that can fail for the reason it exists.
 *
 * ## The first version of this rule scanned the whole comment, and a fixture's own prose defeated it
 *
 * The first version asked whether the doc comment *contained* `MEASURED` or `SYNTHETIC`
 * anywhere. Relabelling `guerrillaMessageWithVerificationLink` from `SYNTHETIC` to
 * `MEASURED` left the suite **green** — because the comment goes on to explain that it
 * "is labelled `SYNTHETIC` here", so the word appears in a sentence about the label
 * whether or not the label is right.
 *
 * That is this repository's recurring defect in miniature, and it is the thirty-second
 * recorded instance of an assertion narrower than the rule it documents: **a rule that
 * cannot tell a declaration from a comment about that declaration is measuring the wrong
 * thing.** `boundaries.test.ts` has been bitten by it three times, always by the same fix
 * — read the declaration, not the prose around it.
 *
 * So this rule reads the **first content line** and requires the marker to *start* it.
 * The convention is not imposed: measured across this file, **19 of 19** fixtures put
 * `MEASURED.` or `SYNTHETIC.` on their first content line, and `guerrillaThrottled` and
 * `guerrillaUnclassifiable` put theirs on a single-line comment where there is no second
 * line to hide in at all.
 *
 * ## What it does and does not establish
 *
 * It establishes that each exported fixture **declares** a provenance. It cannot
 * establish that a `MEASURED` fixture genuinely came from a live provider — that is a
 * claim about a capture this repository can only record, and `docs/PROVIDERS.md` is where
 * a measurement is argued for. What this test removes is the silent case: a fixture with
 * no marker at all, which currently reads as recorded by default.
 *
 * @module
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(HERE, "fixtures.ts");

/** The markers a fixture's doc comment may open with. */
const PROVENANCE_MARKERS = ["MEASURED", "SYNTHETIC"] as const;

/** Every exported fixture, matched on its declared type rather than on its name. */
const FIXTURE_DECLARATION = /^export const (\w+): RecordedStep\b/gm;

/**
 * The first content line of the doc comment immediately above a declaration.
 *
 * **The nearest `/**` before the declaration, not the nearest comment.** A fixture whose
 * own comment carries no marker but which sits under a section banner reading
 * `/* -- Guerrilla Mail --` must not be able to borrow it, and taking the *last* block
 * before the declaration is what keeps a banner from counting as provenance.
 *
 * **A line, not the comment.** See the module note: the whole comment is defeatable by a
 * sentence that mentions the marker, and this file's own fixtures do exactly that. The
 * leading `*` of a JSDoc continuation line is stripped so the form where the marker and
 * the comment's closing token share one line, and the multi-line form, answer the same
 * thing.
 *
 * **No literal comment terminator appears in this block**, which is why that clause is
 * worded rather than quoted. The first draft of this comment spelled the single-line form
 * out, and the closing token inside that quotation ended this block early: the rest of
 * the note was compiled as code, and the file reported a syntax error where it expected a
 * statement — a **collect** failure, not a test failure, and the second time this comment
 * did it, because the first repair quoted the very token it was warning about. It was
 * caught because the unmutated control was run before the mutations, and **a control that
 * reports `no tests` is not a pass**.
 *
 * Returns `null` when no doc comment precedes the declaration, which the caller reports
 * as a missing marker rather than treating as a pass.
 */
function firstDocLineAbove(source: string, declarationIndex: number): string | null {
  const open = source.lastIndexOf("/**", declarationIndex);
  if (open === -1) return null;
  const close = source.lastIndexOf("*/", declarationIndex);
  // A `/**` with no `*/` between it and the declaration means the block is unterminated,
  // which is a malformed source rather than an absent comment. Falling through to the
  // remainder lets the marker check answer `false` instead of this helper answering
  // "no comment".
  const body = close >= open ? source.slice(open + 3, close) : source.slice(open + 3);

  for (const raw of body.split("\n")) {
    const line = raw.replace(/^\s*\*+/, "").trim();
    if (line !== "") return line;
  }
  return null;
}

/** Whether a fixture's own doc comment opens by declaring its provenance. */
function declaredMarker(source: string, declarationIndex: number): string | null {
  const line = firstDocLineAbove(source, declarationIndex);
  if (line === null) return null;
  return PROVENANCE_MARKERS.find((marker) => line.startsWith(marker)) ?? null;
}

describe("recorded provider fixtures", () => {
  it("declares MEASURED or SYNTHETIC on every exported fixture", () => {
    const source = readFileSync(FIXTURES, "utf8");

    const unmarked = [...source.matchAll(FIXTURE_DECLARATION)]
      .filter((match) => declaredMarker(source, match.index ?? -1) === null)
      .map((match) => match[1]);

    // **Named, not counted.** "3 fixtures are unmarked" is a number a reader has to take
    // on trust; "these three carry no provenance" is a claim they can check, and this
    // repository has three published counts that were wrong.
    expect(unmarked, "every exported fixture must declare MEASURED or SYNTHETIC").toEqual([]);
  });

  it("is not vacuous: it reads at least the fixtures this file declares", () => {
    // **The scan above could match nothing and pass.** An empty `unmarked` array is the
    // same value whether the file exports nineteen fixtures or none, so a rule that
    // stopped matching would report success — the shape this repository has recorded
    // repeatedly. This case is the floor under it: the pattern must find the fixtures it
    // is here to police, so a broken pattern fails here rather than passing silently
    // above.
    const source = readFileSync(FIXTURES, "utf8");
    const declared = [...source.matchAll(FIXTURE_DECLARATION)].map((match) => match[1]);

    expect(declared).toContain("guerrillaMessageFetched");
    expect(declared).toContain("guerrillaMessageWithVerificationLink");
    expect(declared.length).toBeGreaterThan(10);
  });

  it("marks the link-carrying fixture SYNTHETIC, and the measured one MEASURED", () => {
    // **The two the M10 slice turned on, pinned by name.** The scan above proves every
    // fixture carries *a* marker; this proves the two this repository's verification
    // story depends on carry the **right** one — because a synthetic fixture marked
    // MEASURED satisfies the scan and is exactly the fabrication the scan exists to
    // prevent. It is the case that failed when the scan read whole comments.
    const source = readFileSync(FIXTURES, "utf8");
    const seen: string[] = [];

    for (const match of source.matchAll(FIXTURE_DECLARATION)) {
      const name = match[1] as string;
      const expected =
        name === "guerrillaMessageWithVerificationLink"
          ? "SYNTHETIC"
          : name === "guerrillaMessageFetched"
            ? "MEASURED"
            : null;
      if (expected === null) continue;

      seen.push(name);
      expect(
        declaredMarker(source, match.index ?? -1),
        `${name} must declare itself ${expected}`,
      ).toBe(expected);
    }

    // **Both halves, or the case above could pass by matching nothing** — which is the
    // same vacuity the second case guards, one level down.
    //
    // **Membership, not order.** The first version asserted an exact array, and it was
    // wrong: the synthetic fixture is declared *above* the measured one, so the assertion
    // encoded a source order the test has no reason to know. That is this repository's
    // recorded `focus.spec.ts` defect in miniature — two places disagreeing about which
    // element an index addresses — and it was caught by the case failing on a tree where
    // both markers were already correct.
    expect(seen).toHaveLength(2);
    expect([...seen].sort()).toEqual([
      "guerrillaMessageFetched",
      "guerrillaMessageWithVerificationLink",
    ]);
  });
});
