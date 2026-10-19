/**
 * The website's report of this session.
 *
 * ## Why this file exists beside the extension's
 *
 * **Because the two reports have different words, and the words are the one thing the two clients
 * must not share.** The *shapes* are `@spectre-mail/ui`'s and the *numbers* are
 * `@spectre-mail/mailbox`'s; what this file holds is the page's own voice and the guarantee that
 * the page's voice carries nothing the shape forbids.
 *
 * @module
 */

import { describe, expect, it } from "vitest";

import type { SessionDiagnostic } from "@spectre-mail/mailbox";

import { diagnosticReport, WEBSITE_DIAGNOSTIC_LABELS } from "./session-diagnostic";

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

describe("the website's report of this session", () => {
  it("holds only counts and normalized outcomes", () => {
    // **Positive first**, for the reason the other files in this repository give.
    const report = diagnosticReport(
      { ...nothing, created: 1, listings: 3 },
      WEBSITE_DIAGNOSTIC_LABELS,
    );

    expect(report.entries.length, "the report held no line at all").toBeGreaterThan(0);

    for (const entry of report.entries) {
      expect(
        ["count", "normalizedOutcome"].includes(entry.value.kind),
        `the report held a value of shape "${entry.value.kind}", which is not one of the two`,
      ).toBe(true);
    }
  });

  it("holds no address, no hostname and no content", () => {
    const report = diagnosticReport(
      { ...nothing, created: 1, creationFailures: { RATE_LIMITED: 2 } },
      WEBSITE_DIAGNOSTIC_LABELS,
    );
    const rendered = report.entries
      .map((entry) => `${entry.label} ${JSON.stringify(entry.value)}`)
      .join("\n");

    // **A bare hostname, with no scheme and no address, is the one a list of three misses.**
    // The first version of this case forbade "@" and "http", and a report holding
    // `example.com` passed it -- **and a hostname is one of the nine things the requirement
    // names**, so the list was shorter than the rule it held.
    for (const forbidden of ["@", "http", "user@example", "subject", "sender", "example.com"]) {
      expect(
        rendered.includes(forbidden),
        `the report holds "${forbidden}", which is one of the things a report may not be`,
      ).toBe(false);
    }
  });

  it("names a provider's normalized code and nothing of the provider's answer", () => {
    const report = diagnosticReport(
      { ...nothing, creationFailures: { RATE_LIMITED: 1 } },
      WEBSITE_DIAGNOSTIC_LABELS,
    );

    const outcomes = report.entries.filter((entry) => entry.value.kind === "normalizedOutcome");
    expect(outcomes.length, "the failure was not named as an outcome").toBe(1);
    expect(outcomes[0]?.value, "the outcome was not the provider's own code").toEqual({
      kind: "normalizedOutcome",
      outcome: "RATE_LIMITED",
    });
  });
});
