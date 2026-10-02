import { describe, expect, it } from "vitest";

import { analyseMessage } from "../analyse";
import { LINK_CONFIDENCE_CEILING } from "../detect-links";
import { roundConfidence } from "../scoring";
import { MAIL_FIXTURES, PROVENANCE_SENTENCE, ROADMAP_SHAPES } from "./corpus";

/** The score a code with strong wording in its own block reaches, by construction. */
const STRONG_CODE = 0.85;

/**
 * Every fixture's declared expectation, checked against the parser.
 *
 * Expectations are declared in `fixtures/corpus.ts` as exact ordered lists rather than
 * here as a set of assertions. That is the whole measurement: a false positive appears
 * as an unexpected value in the list, a missed code as a missing one, and a ranking
 * regression as a reordering — all of them a visible diff in the fixture file rather
 * than a test someone has to notice.
 */
describe("the corpus yields exactly what each fixture declares", () => {
  for (const fixture of MAIL_FIXTURES) {
    it(`${fixture.id} yields its declared codes`, () => {
      const result = analyseMessage(fixture.body);

      expect(result.codes.map((code) => code.value)).toEqual([...fixture.expect.codes]);
    });

    it(`${fixture.id} yields its declared links`, () => {
      const result = analyseMessage(fixture.body);

      expect(result.links.map((link) => link.url)).toEqual([...fixture.expect.links]);
    });
  }
});

describe("the corpus measures false positives, not just detection", () => {
  it("ranks the real code above every misleading number in the transactional mail", () => {
    const fixture = MAIL_FIXTURES.find(
      (entry) => entry.id === "order-confirmation-with-misleading-numbers",
    );
    expect(fixture).toBeDefined();
    if (fixture === undefined) {
      return;
    }

    const result = analyseMessage(fixture.body);
    const real = result.codes[0];

    // The roadmap's third acceptance target. Five digit runs in one message, four of
    // which are not codes, and the requirement is only that the right one comes first.
    expect(result.codes).toHaveLength(5);
    expect(real?.value).toBe("706251");
    for (const candidate of result.codes.slice(1)) {
      expect(real?.confidence ?? 0).toBeGreaterThan(candidate.confidence);
    }
  });

  it("scores every misleading number in that message below a real code scores", () => {
    const fixture = MAIL_FIXTURES.find(
      (entry) => entry.id === "order-confirmation-with-misleading-numbers",
    );
    if (fixture === undefined) {
      throw new Error("the transactional fixture must exist");
    }

    const real = analyseMessage("<p>Your verification code is 706251</p>").codes[0];
    const misleading = analyseMessage(fixture.body).codes.slice(1);

    for (const candidate of misleading) {
      expect(candidate.confidence).toBeLessThan(real?.confidence ?? 1);
    }
  });

  it("does not report the transactional mail's price as a code", () => {
    const fixture = MAIL_FIXTURES.find(
      (entry) => entry.id === "order-confirmation-with-misleading-numbers",
    );
    if (fixture === undefined) {
      throw new Error("the transactional fixture must exist");
    }

    const result = analyseMessage(fixture.body);
    // "$129.90" is 5 digits but not a bare digit run, so it is never a candidate at
    // all — the length rule and the run rule together keep decimal figures out.
    expect(result.codes.map((code) => code.value)).not.toContain("12990");
  });

  it("reports nothing in bulk mail but a low-ranked copyright year", () => {
    const fixture = MAIL_FIXTURES.find((entry) => entry.id === "newsletter");
    if (fixture === undefined) {
      throw new Error("the newsletter fixture must exist");
    }

    const result = analyseMessage(fixture.body);
    const strong = analyseMessage("<p>Your verification code is 2026</p>").codes[0];
    // The reference point has to be an *unpenalised* candidate with no wording, not a
    // strong one. Comparing against a real code only proves the year is below 0.85,
    // which is also true if the year shape were removed entirely — the year would
    // simply rise to 0.6. This reference makes the reduction itself load-bearing.
    const unpenalised = analyseMessage("<p>Note 551203</p>").codes[0];

    // A newsletter's year is returned, ranked last. Claiming zero candidates would
    // require the parser to drop a digit run the roadmap forbids dropping, so the
    // expectation says what actually happens and the test holds it to what should.
    expect(result.codes.map((code) => code.value)).toEqual(["2026"]);
    expect(result.codes[0]?.confidence).toBeLessThan(strong?.confidence ?? 1);
    expect(result.codes[0]?.confidence).toBeLessThan(unpenalised?.confidence ?? 1);
  });

  it("reports no link in bulk mail, including the unsubscribe link", () => {
    const fixture = MAIL_FIXTURES.find((entry) => entry.id === "newsletter");
    if (fixture === undefined) {
      throw new Error("the newsletter fixture must exist");
    }

    // The unsubscribe link's own text names no verification wording, and the block
    // above it does not either — so it is not reported. This is the case D8 exists for.
    expect(analyseMessage(fixture.body).links).toEqual([]);
  });

  it("reports the reset link and not the unsubscribe link in the same message", () => {
    const fixture = MAIL_FIXTURES.find((entry) => entry.id === "password-reset");
    if (fixture === undefined) {
      throw new Error("the password-reset fixture must exist");
    }

    // Two links, one of which is an unsubscribe. Only the one the wording introduces
    // as a reset is reported — and its own text, "Reset password", names nothing.
    expect(analyseMessage(fixture.body).links.map((link) => link.url)).toEqual([
      "https://example.test/reset?token=zz",
    ]);
  });
});

describe("scores are honest across the whole corpus", () => {
  const everyScore = MAIL_FIXTURES.flatMap((fixture) => {
    const result = analyseMessage(fixture.body);
    return [
      ...result.codes.map((code) => code.confidence),
      ...result.links.map((l) => l.confidence),
    ];
  });

  it("reports no score as certain", () => {
    expect(everyScore.length).toBeGreaterThan(0);
    for (const score of everyScore) {
      expect(score).toBeLessThan(1);
    }
  });

  it("reports every score inside the shared model's range", () => {
    for (const score of everyScore) {
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    }
  });

  it("reports every score as a clean two-decimal number", () => {
    // Stated as "rounding to two places changes nothing", not as "`score * 100` is a
    // whole number". Those look like the same assertion and are not: `0.55 * 100` is
    // `55.00000000000001` in floating point, so the arithmetic form rejects a score that
    // is already perfectly clean. A check narrower than the rule it claims to enforce is
    // a capability failure, and this one would have failed the implementation into
    // being wrong.
    for (const score of everyScore) {
      expect(roundConfidence(score)).toBe(score);
    }
  });

  it("never reports a code above the maximum its published arithmetic can reach", () => {
    for (const fixture of MAIL_FIXTURES) {
      for (const code of analyseMessage(fixture.body).codes) {
        expect(code.confidence).toBeLessThanOrEqual(STRONG_CODE);
      }
    }
  });

  it("never reports a link above the maximum its published arithmetic can reach", () => {
    for (const fixture of MAIL_FIXTURES) {
      for (const link of analyseMessage(fixture.body).links) {
        expect(link.confidence).toBeLessThanOrEqual(LINK_CONFIDENCE_CEILING);
      }
    }
  });
});

describe("every fixture is labelled, or the corpus is not trustworthy", () => {
  it("declares that every fixture is synthetic", () => {
    for (const fixture of MAIL_FIXTURES) {
      expect(fixture.synthetic).toBe(true);
    }
  });

  it("explains why each fixture exists", () => {
    for (const fixture of MAIL_FIXTURES) {
      expect(fixture.note.length).toBeGreaterThan(40);
      expect(fixture.shape.length).toBeGreaterThan(0);
    }
  });

  it("claims no capture from a named service without saying mail was never received", () => {
    // The provenance rule. A fixture named after a service has to carry the sentence
    // that no mail from that service was ever received, or the naming itself becomes
    // the false claim — the naming is the thing a future maintainer would trust.
    for (const fixture of MAIL_FIXTURES) {
      if (!/-style-/.test(fixture.id)) {
        continue;
      }
      expect(fixture.note).toContain(PROVENANCE_SENTENCE);
    }
  });

  it("uses only reserved domains, so no fixture can point at a real host", () => {
    for (const fixture of MAIL_FIXTURES) {
      for (const match of fixture.body.matchAll(/https?:\/\/([^\s"'/]+)/g)) {
        const host = match[1] ?? "";
        expect(
          host.endsWith(".test") || host.endsWith(".example") || host.endsWith(".invalid"),
        ).toBe(true);
      }
    }
  });

  it("has a unique identifier for every fixture", () => {
    const ids = MAIL_FIXTURES.map((fixture) => fixture.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it("covers every shape the roadmap lists, and names no shape it does not", () => {
    // Asserted as set coverage rather than as a count. A count would pass with the
    // wrong thirteen — a duplicated shape and a dropped one balance out, and the corpus
    // would read as complete while a shape the roadmap names had never been measured.
    const covered = new Set(MAIL_FIXTURES.flatMap((fixture) => fixture.covers));

    expect([...covered].sort()).toEqual([...ROADMAP_SHAPES].sort());
  });

  it("keeps fixtures the roadmap did not ask for, and marks them as additions", () => {
    // There is one: `block-separated-code`. It is here because it measured a defect in
    // the rule as proposed, and a corpus that only contained what was planned would not
    // have found it. Asserting the count of additions is what makes that decision
    // reviewable rather than a silent extra file.
    const additions = MAIL_FIXTURES.filter((fixture) => fixture.covers.length === 0);

    expect(additions.map((fixture) => fixture.id)).toEqual(["block-separated-code"]);
  });
});

describe("parsing the corpus produces no side effect", () => {
  it("records zero requests made while parsing every fixture", () => {
    // Observed rather than asserted. A source scan cannot see a `new Image()` or an
    // injected resolver; an instrumented transport that records every request and is
    // then asserted to have recorded none can.
    const attempts: string[] = [];
    const globalScope = globalThis as Record<string, unknown>;
    for (const name of ["fetch", "XMLHttpRequest", "WebSocket", "EventSource"]) {
      globalScope[name] = (...args: unknown[]): never => {
        attempts.push(`${name}:${String(args[0])}`);
        throw new Error("the parser must not open a connection");
      };
    }

    try {
      for (const fixture of MAIL_FIXTURES) {
        analyseMessage(fixture.body);
      }
    } finally {
      for (const name of ["fetch", "XMLHttpRequest", "WebSocket", "EventSource"]) {
        delete globalScope[name];
      }
    }

    expect(attempts).toEqual([]);
  });

  it("still parses correctly while those globals are trapped", () => {
    // A positive control for the check above. If the traps made parsing fail instead,
    // the zero-request assertion would pass for the wrong reason — because nothing was
    // parsed at all.
    const globalScope = globalThis as Record<string, unknown>;
    globalScope["fetch"] = () => {
      throw new Error("must not be called");
    };
    try {
      expect(analyseMessage("<p>Your verification code is 483920</p>").codes[0]?.value).toBe(
        "483920",
      );
    } finally {
      delete globalScope["fetch"];
    }
  });
});
