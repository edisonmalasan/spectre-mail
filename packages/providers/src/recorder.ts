/**
 * A recorded-response transport.
 *
 * Serves queued responses in order, records every request, and throws when a
 * request arrives with nothing queued for it. That last behaviour is the point:
 * an adapter that issues an unexpected request fails loudly instead of silently
 * getting a plausible-looking response it did not deserve.
 *
 * Used by the conformance suite and by every adapter test. Records come from
 * real measured provider runs (`docs/PROVIDERS.md`), so the suite exercises
 * shapes that genuinely occurred — including the awkward ones, like a message
 * with an empty subject.
 *
 * @module
 */

import type { Transport, TransportRequest, TransportResponse } from "./transport";

/** One queued response, optionally restricted to requests it will answer. */
export interface RecordedStep {
  /**
   * Restricts this step to matching requests.
   *
   * Without it a step answers whatever comes next, which is fine for a linear
   * flow and wrong the moment an adapter retries. A `429` recorded as a single
   * step with no matcher would hide a retry that should not have happened.
   */
  readonly match?: (request: TransportRequest) => boolean;
  readonly response: TransportResponse;
}

export interface Recorder {
  readonly transport: Transport;
  /** Every request the adapter made, in order. */
  readonly requests: readonly TransportRequest[];
  /** How many queued steps were never consumed. */
  readonly unusedSteps: () => number;
}

/**
 * Build a {@link Recorder} over `steps`.
 *
 * Steps are consumed in order. A step whose matcher rejects the request is
 * skipped rather than consumed, so a flow that conditionally makes a request can
 * be recorded without the unused-step count lying about what happened.
 */
export function createRecorder(steps: readonly RecordedStep[]): Recorder {
  const requests: TransportRequest[] = [];
  const consumed = new Set<number>();

  const transport: Transport = async (request) => {
    requests.push(request);

    for (const [index, step] of steps.entries()) {
      if (consumed.has(index)) {
        continue;
      }
      if (step.match !== undefined && !step.match(request)) {
        continue;
      }
      consumed.add(index);
      return step.response;
    }

    throw new Error(
      `No recorded response for ${request.method} ${request.url}. ` +
        `${requests.length} request(s) were made; the recording has ${steps.length} step(s).`,
    );
  };

  return {
    transport,
    requests,
    unusedSteps: () => steps.length - consumed.size,
  };
}

/** A `200` carrying `body` as JSON. */
export function jsonResponse(body: unknown, status = 200): TransportResponse {
  return { status, headers: { "content-type": "application/ld+json" }, body: JSON.stringify(body) };
}

/** A `200` carrying `body` as text. */
export function textResponse(body: string, status = 200): TransportResponse {
  return { status, headers: { "content-type": "text/plain" }, body };
}

/** A response with extra headers merged in. */
export function withHeaders(
  response: TransportResponse,
  headers: Record<string, string>,
): TransportResponse {
  return { ...response, headers: { ...response.headers, ...headers } };
}
