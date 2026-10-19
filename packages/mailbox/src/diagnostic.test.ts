/**
 * The fold over a session's states, and what it counts.
 *
 * ## Why this file is about the fold and not about the report
 *
 * **Because the fold is where the counting happens, and the report is a mapping over what the fold
 * produced.** The shapes a report may carry are `@spectre-mail/ui`'s, and the words are each
 * client's; **the numbers are this package's**, and this file holds them to what they may be.
 *
 * **And the first case is positive rather than negative.** A fold that counted nothing would
 * satisfy every "counts nothing" assertion below it for ever.
 *
 * @module
 */

import { describe, expect, it } from "vitest";

import type { SessionState } from "./state";
import { emptySessionDiagnostic, isNewSessionState, observeSessionState } from "./diagnostic";

/** A session that has failed, with the provider's own normalized code. */
const failed = (code: string): SessionState =>
  ({
    kind: "failed",
    failure: { code, description: "the provider said so" },
  }) as unknown as SessionState;

describe("what a session did, counted", () => {
  it("counts nothing until it is told something", () => {
    const empty = emptySessionDiagnostic();

    expect(empty.created, "a session that has done nothing created something").toBe(0);
    expect(empty.listings, "a session that has done nothing received a listing").toBe(0);
    expect(empty.checksFailed, "a session that has done nothing failed a check").toBe(0);
    expect(empty.detections, "a session that has done nothing detected anything").toBe(0);
    expect(empty.creationFailures, "a session that has done nothing failed").toEqual({});
    expect(empty.firstArrivalMs, "a message arrived before the session did").toBeNull();
    expect(empty.startedAtMs, "the session started before it did").toBeNull();
  });

  it("counts a failure under the provider's own normalized code, and not under anything else", () => {
    const diagnostic = observeSessionState(emptySessionDiagnostic(), failed("RATE_LIMITED"), 1000);

    expect(diagnostic.created, "a failed creation created something").toBe(0);
    expect(diagnostic.creationFailures, "the failure was not counted under its code").toEqual({
      RATE_LIMITED: 1,
    });
    expect(
      Object.keys(diagnostic.creationFailures),
      "the failure was counted under something other than the provider's code",
    ).toEqual(["RATE_LIMITED"]);
  });

  it("counts two failures of the same kind twice, and two kinds separately", () => {
    let diagnostic = observeSessionState(emptySessionDiagnostic(), failed("RATE_LIMITED"), 1000);
    diagnostic = observeSessionState(diagnostic, failed("RATE_LIMITED"), 2000);
    diagnostic = observeSessionState(diagnostic, failed("NETWORK_ERROR"), 3000);

    expect(diagnostic.creationFailures, "the counts are not per kind").toEqual({
      RATE_LIMITED: 2,
      NETWORK_ERROR: 1,
    });
  });

  it("does not report an arrival time for a message that has not arrived", () => {
    // **A message that has not arrived is not a failure and has no arrival time.** A report that
    // said "0 ms" for a message that never came would be measuring the wrong thing.
    const diagnostic = observeSessionState(emptySessionDiagnostic(), failed("AUTH_FAILED"), 1000);

    expect(diagnostic.firstArrivalMs, "a message arrived that never did").toBeNull();
  });

  it("holds the moment it started, and never reports it", () => {
    const diagnostic = observeSessionState(emptySessionDiagnostic(), failed("AUTH_FAILED"), 4242);

    // **The moment is held so the arrival time can be a difference, and it is the one value in the
    // shape that is not a duration.** A duration cannot be placed on a calendar; a moment can.
    expect(diagnostic.startedAtMs, "the session did not record when it started").toBe(4242);
  });

  it("knows a state it has already seen from one it has not", () => {
    // **The guard that makes the count right under `StrictMode`**, and the reason it compares
    // identity rather than content: a session publishes a *new* state object on each transition, so
    // identity says "this is a transition" exactly, and two transitions that look alike are two
    // things that happened.
    const first = failed("AUTH_FAILED");
    const second = failed("AUTH_FAILED");

    expect(isNewSessionState(null, first), "the first state is not a new one").toBe(true);
    expect(isNewSessionState(first, first), "the same state is a new one").toBe(false);
    expect(
      isNewSessionState(first, second),
      "a second state that looks the same is not a new one",
    ).toBe(true);
  });
});
