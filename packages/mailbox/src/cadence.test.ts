/**
 * The cadence calculation.
 *
 * Separate from the poller because it is the one piece of the inbox whose behaviour
 * is entirely a function of its input. Testing it directly is what lets the delays
 * be pinned as numbers, rather than inferred from how long a test happened to wait.
 */

import { describe, expect, it } from "vitest";

import { INBOX_POLL_CEILING_MS, INBOX_POLL_PROMPT_MS, nextDelay } from "./cadence";

describe("the inbox cadence", () => {
  it("doubles from the prompt interval while nothing changes, then holds the ceiling", () => {
    // The whole sequence, through the first capped value. Written out rather than
    // looped so a change to any single step is visible as a diff to this line
    // instead of a number that quietly moved.
    expect([nextDelay(0), nextDelay(1), nextDelay(2), nextDelay(3), nextDelay(4)]).toEqual([
      5_000, 10_000, 20_000, 30_000, 30_000,
    ]);
  });

  it("never exceeds the ceiling however long the mailbox has been quiet", () => {
    // A count this large is not hypothetical: a tab left open and visible overnight
    // produces thousands of consecutive unchanged checks.
    for (const quiet of [5, 6, 10, 100, 1_000, 1_000_000]) {
      expect(nextDelay(quiet)).toBe(INBOX_POLL_CEILING_MS);
    }
  });

  it("returns a whole number of milliseconds at or below the ceiling, for every input", () => {
    // A fractional delay would be a number no scheduler can honour exactly, and a
    // zero would be a busy loop - neither of which any assertion about the
    // doubling sequence would notice.
    for (let quiet = 0; quiet <= 64; quiet += 1) {
      const delay = nextDelay(quiet);
      expect(Number.isInteger(delay)).toBe(true);
      expect(delay).toBeGreaterThan(0);
      expect(delay).toBeLessThanOrEqual(INBOX_POLL_CEILING_MS);
    }
  });

  it("treats a negative count as a change rather than as a shorter wait", () => {
    // A count below zero is not a real state, so this pins which way an impossible
    // input falls rather than leaving it to arithmetic. It must fall toward the
    // prompt interval: a shorter-than-prompt wait would mean the one interval a user
    // is watching get faster because of a bug.
    expect(nextDelay(-1)).toBe(INBOX_POLL_PROMPT_MS);
    expect(nextDelay(-100)).toBe(INBOX_POLL_PROMPT_MS);
  });

  it("never waits less than the prompt interval, for any count", () => {
    for (let quiet = -5; quiet <= 64; quiet += 1) {
      expect(nextDelay(quiet)).toBeGreaterThanOrEqual(INBOX_POLL_PROMPT_MS);
    }
  });

  it("declares intervals that are ordered, and neither of them is zero", () => {
    // A ceiling below the prompt interval would make `nextDelay` constant, and a
    // silent backoff is worse than an honest fixed interval: the requirement says
    // the interval lengthens while the inbox is quiet.
    expect(INBOX_POLL_CEILING_MS).toBeGreaterThan(INBOX_POLL_PROMPT_MS);

    // Zero is the one value that turns a poll into a busy loop, and neither
    // assertion about the doubling sequence above would catch it.
    expect(INBOX_POLL_PROMPT_MS).toBeGreaterThan(0);
    expect(INBOX_POLL_CEILING_MS).toBeGreaterThan(0);
  });
});
