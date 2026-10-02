/**
 * The transport seam.
 *
 * Every request an adapter makes goes through an injected {@link Transport}.
 * There is no module-level `fetch` call anywhere in this package, and
 * `tests/architecture/boundaries.test.ts` asserts that.
 *
 * This is what makes the conformance suite possible. Neither a web page nor an
 * MV3 service worker lets a test intercept `fetch`, so verifying an adapter
 * without this seam would mean calling a third party — and the suite would then
 * fail whenever that third party is down, rate-limiting, or has renamed a field.
 * A provider's availability would become this repository's CI status.
 *
 * The cost is stated rather than hidden: recorded responses mean the suite
 * cannot notice a provider *changing*. That is a real weakness, and design.md D2
 * records it as one.
 *
 * @module
 */

/** HTTP methods any provider here actually uses. */
export type TransportMethod = "GET" | "POST" | "DELETE";

/**
 * One outbound request, fully resolved.
 *
 * Absolute URLs rather than a base-plus-path pair, because the two providers are
 * reached at unrelated origins and a shared base would be fiction.
 */
export interface TransportRequest {
  readonly url: string;
  readonly method: TransportMethod;
  readonly headers: Readonly<Record<string, string>>;
  readonly body?: string;
}

/**
 * One inbound response.
 *
 * Headers are flattened to a plain record rather than a real `Headers` object so
 * a recorded fixture is literal data with no platform dependency.
 */
export interface TransportResponse {
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string;
}

/**
 * Performs one request.
 *
 * Throws only for a transport-level failure (DNS, offline, CORS rejection). A
 * provider answering with an error status is a **response**, not a throw — which
 * is what lets an adapter read an error body it needs to classify.
 */
export type Transport = (request: TransportRequest) => Promise<TransportResponse>;

/**
 * Adapt a `fetch` implementation to a {@link Transport}.
 *
 * `fetchImpl` is a parameter rather than a global reference so that this module
 * contains no bare `fetch(` call at all. A production caller passes the global;
 * nothing here decides that for it.
 */
export function createFetchTransport(fetchImpl: typeof fetch): Transport {
  return async (request) => {
    const response = await fetchImpl(request.url, {
      method: request.method,
      headers: request.headers,
      ...(request.body === undefined ? {} : { body: request.body }),
    });

    // Header lookup is case-insensitive per HTTP, and a recorded fixture may spell
    // `Ratelimit-Policy` differently from a real server. Normalizing once here
    // means no adapter has to guess at casing.
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });

    return { status: response.status, headers, body: await response.text() };
  };
}

/**
 * Read a header case-insensitively.
 *
 * Exported because every adapter reads `ratelimit-policy`, and three adapters
 * each spelling the lookup three ways is how a casing bug reaches production.
 */
export function readHeader(response: TransportResponse, name: string): string | undefined {
  const wanted = name.toLowerCase();

  // The stored keys are scanned rather than indexed directly. `createFetchTransport`
  // lowercases what a real server sent, but a recorded fixture is hand-written and
  // may spell a header differently — and a header read as absent when it is
  // present turns a throttle into a plain failure.
  for (const [key, value] of Object.entries(response.headers)) {
    if (key.toLowerCase() === wanted) {
      return value;
    }
  }
  return undefined;
}
