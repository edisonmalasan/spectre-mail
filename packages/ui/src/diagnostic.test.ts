/**
 * What may be reported, and what may not — the module's own cases.
 *
 * ## Why this file is about the shape rather than about a client
 *
 * **Because the shape is the claim, and a client that drifts is caught by the type rather than by
 * a test here.** `website-client` and `extension-client` each say that a reported value is a count,
 * a normalized outcome or an elapsed duration; this file is what holds *that definition* to those
 * three shapes and to the nine named exclusions, so a fourth shape cannot appear in a client
 * without appearing here first.
 *
 * **The first case is positive rather than negative**, for the reason `name.test.ts` gives: a
 * reader that classified nothing would satisfy every "refuses" assertion below it for ever.
 *
 * @module
 */

import { describe, expect, it } from "vitest";

import {
  EXCLUDED_REPORTABLE_VALUES,
  REPORTABLE_VALUE_KINDS,
  isReportableValue,
  reportableCount,
  reportableOutcome,
} from "./diagnostic";

describe("the shape of a reportable value", () => {
  it("is exactly three kinds, and the guard accepts one of each", () => {
    // **The first case, and it is positive.** A guard that refused everything would satisfy every
    // "refuses" assertion below it, so the three kinds are shown working before anything is claimed
    // about what the guard refuses.
    expect([...REPORTABLE_VALUE_KINDS]).toEqual(["count", "normalizedOutcome"]);

    expect(isReportableValue(reportableCount(3)), "a count is not recognised").toBe(true);
    expect(
      isReportableValue(reportableOutcome("RATE_LIMITED")),
      "a normalized outcome is not recognised",
    ).toBe(true);
  });

  it("excludes nine things by name, and the list is the whole of the exclusion claim", () => {
    // **A declared list, compared rather than derived.** A reader that produced the list from the
    // module's own export would satisfy this case for ever; the nine names are written out here so
    // that adding a tenth is a change somebody has to make in two places.
    expect([...EXCLUDED_REPORTABLE_VALUES]).toEqual([
      "address",
      "message id",
      "sender",
      "subject",
      "hostname",
      "URL",
      "form",
      "field",
      "content",
    ]);

    // **And no two of them are the same name**, because a list with a duplicate is a list where
    // one prohibition is stated twice and another is missing.
    expect(
      EXCLUDED_REPORTABLE_VALUES.filter((name, at, all) => all.indexOf(name) !== at),
      "exclusions named more than once",
    ).toEqual([]);
  });

  it("refuses every shape that is not one of the three", () => {
    for (const refused of [
      { kind: "address", value: "someone@example.com" },
      { kind: "count", value: -1 },
      { kind: "count", value: "3" },
      { kind: "normalizedOutcome", outcome: "" },
      { kind: "elapsedDuration", milliseconds: -1 },
      { kind: "elapsedDuration", milliseconds: Number.NaN },
      { kind: "timestamp", at: 1760000000000 },
      { kind: "rawResponse", body: "429 Too Many Requests" },
      "a string",
      42,
      null,
      undefined,
    ]) {
      expect(isReportableValue(refused), `the guard accepted ${JSON.stringify(refused)}`).toBe(
        false,
      );
    }
  });

  it("counts are never negative, and the guard says so", () => {
    // **A negative count is a bug in whatever produced it**, and the guard is where a bug is caught
    // before it reaches a person.
    expect(isReportableValue({ kind: "count", value: -1 })).toBe(false);
    expect(isReportableValue({ kind: "count", value: 0 })).toBe(true);
  });

  it("builds the two shapes with one spelling each", () => {
    // **The factories and the guard are two halves of one claim**, so they are checked together: a
    // factory that produced something the guard refuses would be a value no client could show.
    expect(isReportableValue(reportableCount(0))).toBe(true);
    expect(isReportableValue(reportableOutcome("created"))).toBe(true);
  });

  it("refuses a third shape, and names why there is no third shape", () => {
    // **There were three shapes once, and the third was an elapsed duration.** The website's page
    // forbids any interval of the product's own, and the panel has never shown one either -- so
    // **a report would have been the first place the product showed a figure of its own**, and a
    // shape with no consumer is a schema to migrate rather than a feature.
    //
    // **So the shape is gone rather than kept and unused**, and this case is what says so.
    expect([...REPORTABLE_VALUE_KINDS], "the shape list names a third kind").toEqual([
      "count",
      "normalizedOutcome",
    ]);
    expect(
      isReportableValue({ kind: "elapsedDuration", milliseconds: 1200 }),
      "the guard accepts a duration, which is not a shape any client shows",
    ).toBe(false);
  });

  it("builds the two shapes with one spelling each", () => {
    // **The factories and the guard are two halves of one claim**, so they are checked together: a
    // factory that produced something the guard refuses would be a value no client could show.
    expect(isReportableValue(reportableCount(0))).toBe(true);
    expect(isReportableValue(reportableOutcome("created"))).toBe(true);
  });
});
