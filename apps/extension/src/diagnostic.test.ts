/**
 * The extension's report, and the in-page answers it counts.
 *
 * ## Why this file is about the extension's half
 *
 * **Because the two clients' reports differ in their words and in one thing they count, and the
 * words are the extension's.** The *shapes* are `@spectre-mail/ui`'s and the *numbers* are
 * `@spectre-mail/mailbox`'s; what is here is the extension's own voice and the one answer only it
 * has.
 *
 * **The first case is positive**, for the reason the other files in this repository give: a reader
 * that classified nothing would satisfy every "refuses" assertion below it for ever.
 *
 * @module
 */

import { describe, expect, it } from "vitest";

import type { SessionDiagnostic } from "@spectre-mail/mailbox";

import {
  diagnosticReport,
  emptyInPageAnswers,
  EXTENSION_DIAGNOSTIC_LABELS,
  observeInPageAnswer,
} from "./diagnostic";

/** A session that has done nothing, which is the shape most of these cases start from. */
const nothing: SessionDiagnostic = {
  created: 0,
  creationFailures: {},
  listings: 0,
  checksFailed: 0,
  detections: 0,
  firstArrivalMs: null,
  startedAtMs: null,
};

describe("the extension's report of this session", () => {
  it("holds only counts and normalized outcomes", () => {
    // **Positive first.** A report that held nothing would satisfy every "holds nothing" assertion
    // below it for ever.
    const report = diagnosticReport(
      { ...nothing, created: 2, listings: 5, firstArrivalMs: 1200 },
      emptyInPageAnswers(),
      EXTENSION_DIAGNOSTIC_LABELS,
    );

    expect(report.entries.length, "the report held no line at all").toBeGreaterThan(0);

    for (const entry of report.entries) {
      expect(
        ["count", "normalizedOutcome"].includes(entry.value.kind),
        `the report held a value of shape "${entry.value.kind}", which is not one of the two`,
      ).toBe(true);
    }
  });

  it("counts the in-page recogniser's own answers, and names nothing about the page", () => {
    // **The extension has one thing the website does not, and it is exactly the roadmap's
    // "email-field injection failures": the recogniser's own answer, already normalized, already
    // saying why.**
    let answers = emptyInPageAnswers();
    answers = observeInPageAnswer(answers, "noField");
    answers = observeInPageAnswer(answers, "noField");
    answers = observeInPageAnswer(answers, "filled");

    const report = diagnosticReport(nothing, answers, EXTENSION_DIAGNOSTIC_LABELS);

    const rendered = report.entries
      .map((entry) => `${entry.label} ${JSON.stringify(entry.value)}`)
      .join("\n");

    expect(rendered, "the report does not count the noField answer").toContain("noField");
    expect(rendered, "the report does not count the filled answer").toContain("filled");

    // **And the count is right: two noField answers and one filled.**
    const counts = report.entries.filter(
      (entry) => entry.value.kind === "count" && entry.label.includes("noField"),
    );
    expect(counts.length, "the report did not count the noField answers").toBe(1);
    expect(counts[0]?.value, "the noField answers were not counted twice").toEqual({
      kind: "count",
      value: 2,
    });
  });

  it("holds no address, no hostname and no content", () => {
    let answers = emptyInPageAnswers();
    answers = observeInPageAnswer(answers, "noField");

    const report = diagnosticReport(nothing, answers, EXTENSION_DIAGNOSTIC_LABELS);
    const rendered = report.entries
      .map((entry) => `${entry.label} ${JSON.stringify(entry.value)}`)
      .join("\n");

    for (const forbidden of ["@", "http", "user@example", "subject", "sender"]) {
      expect(
        rendered.includes(forbidden),
        `the report holds "${forbidden}", which is one of the things a report may not be`,
      ).toBe(false);
    }
  });
});
