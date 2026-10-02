/**
 * Deterministic environments for tests.
 *
 * Kept out of `transport.test.ts` so the adapter tests can use them without
 * importing another test file.
 *
 * @module
 */

import type { CredentialSourceEnvironment, ProviderEnvironment } from "./environment";
import { createRecorder } from "./recorder";
import type { RecordedStep } from "./recorder";
import type { TransportRequest } from "./transport";

/** A fixed instant, so a mailbox created twice has the same `createdAt`. */
export const FIXED_NOW = Date.parse("2026-10-02T12:00:00.000Z");

/**
 * A clock that advances by a fixed step per call.
 *
 * A frozen clock would make two mailboxes created in sequence indistinguishable,
 * which is exactly the kind of bug a test should catch.
 */
export function countingClock(start = FIXED_NOW, step = 1_000): () => number {
  let current = start;
  return () => {
    const value = current;
    current += step;
    return value;
  };
}

/**
 * Predictable credential material.
 *
 * Fixed strings rather than random ones: a recorded response is keyed to nothing,
 * so a random address would make a failure impossible to reproduce. The generator
 * still honours the requested length, because the adapters rely on that and a
 * stub that ignored it would pass tests the real generator would fail.
 */
export function fixedTokens(): (length: number) => string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  return (length) => {
    let out = "";
    for (let i = 0; i < length; i += 1) {
      out += alphabet[i % alphabet.length];
    }
    return out;
  };
}

export interface StubEnvironment extends CredentialSourceEnvironment {
  readonly requests: readonly TransportRequest[];
}

/**
 * An environment replaying `steps`, exposing the requests made.
 *
 * A request with nothing queued for it throws rather than receiving a plausible
 * default, so an unexpected request surfaces as a failure instead of as a
 * silently-passing assertion.
 */
export function stubEnvironment(
  steps: readonly RecordedStep[],
  now: () => number = countingClock(),
): StubEnvironment {
  const recorder = createRecorder(steps);

  return {
    transport: recorder.transport,
    randomToken: fixedTokens(),
    now,
    requests: recorder.requests,
  };
}

/**
 * An environment for an adapter that needs no credential generation.
 *
 * Built by removing the extra requirement rather than by supplying a random source
 * the adapter will never call, so the two adapter types stay distinguishable.
 */
export function providerOnlyEnvironment(
  steps: readonly RecordedStep[],
  now: () => number = countingClock(),
): ProviderEnvironment & { readonly requests: readonly TransportRequest[] } {
  const recorder = createRecorder(steps);

  return { transport: recorder.transport, now, requests: recorder.requests };
}
