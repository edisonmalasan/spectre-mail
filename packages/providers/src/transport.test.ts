/**
 * Transport and recorder tests.
 *
 * The recorder is load-bearing for everything else in this package: it is what
 * lets the conformance suite run without a provider, so its own behaviour has to
 * be trustworthy rather than assumed. The "throws when nothing is queued"
 * behaviour in particular is what stops an adapter from quietly receiving a
 * response it did not earn.
 */

import { describe, expect, it } from "vitest";

import { createRecorder, jsonResponse, textResponse, withHeaders } from "./recorder";
import type { RecordedStep } from "./recorder";
import { createFetchTransport, readHeader } from "./transport";
import type { TransportRequest } from "./transport";

describe("readHeader", () => {
  it("finds a header regardless of the casing it arrived in", () => {
    const response = withHeaders(textResponse("body"), { "Ratelimit-Policy": "1; w=60" });

    // HTTP header names are case-insensitive, and a recorded fixture may spell one
    // differently from a real server. An adapter that guessed at casing would read
    // the throttle as absent and report a plain failure instead.
    expect(readHeader(response, "ratelimit-policy")).toBe("1; w=60");
    expect(readHeader(response, "RATELIMIT-POLICY")).toBe("1; w=60");
  });

  it("returns undefined for a header the provider did not send", () => {
    expect(readHeader(textResponse(""), "ratelimit-policy")).toBeUndefined();
  });
});

describe("recorder", () => {
  it("serves queued responses in order", async () => {
    const recorder = createRecorder([
      { response: jsonResponse({ first: true }) },
      { response: jsonResponse({ second: true }) },
    ]);

    const one = await recorder.transport(request("GET", "https://api.test/one"));
    const two = await recorder.transport(request("GET", "https://api.test/two"));

    expect(JSON.parse(one.body)).toEqual({ first: true });
    expect(JSON.parse(two.body)).toEqual({ second: true });
    expect(recorder.unusedSteps()).toBe(0);
  });

  it("records every request it was given", async () => {
    const recorder = createRecorder([
      { response: jsonResponse({}) },
      { response: jsonResponse({}) },
    ]);

    await recorder.transport(request("GET", "https://api.test/first"));
    await recorder.transport(request("POST", "https://api.test/second", { body: "{}" }));

    expect(recorder.requests.map((r) => `${r.method} ${r.url}`)).toEqual([
      "GET https://api.test/first",
      "POST https://api.test/second",
    ]);
    expect(recorder.requests[1]?.body).toBe("{}");
  });

  it("throws when a request has nothing queued, naming the request", async () => {
    const recorder = createRecorder([]);

    await expect(recorder.transport(request("GET", "https://api.test/unexpected"))).rejects.toThrow(
      /GET https:\/\/api\.test\/unexpected/,
    );
  });

  it("reports how many steps were never consumed", async () => {
    const recorder = createRecorder([
      { response: jsonResponse({}) },
      { response: jsonResponse({}) },
    ]);

    await recorder.transport(request("GET", "https://api.test/one"));

    expect(recorder.unusedSteps()).toBe(1);
  });

  it("skips a step whose matcher rejects the request rather than consuming it", async () => {
    const calls: string[] = [];
    const recorder = createRecorder([
      {
        match: (r) => {
          calls.push(r.url);
          return false;
        },
        response: jsonResponse({ wrong: true }),
      },
      { response: jsonResponse({ right: true }) },
    ]);

    // The conditional first request must fall through to the second step, so a
    // recording does not have to be ordered around control flow the adapter owns.
    const response = await recorder.transport(request("GET", "https://api.test/only"));

    expect(JSON.parse(response.body)).toEqual({ right: true });
    expect(calls).toEqual(["https://api.test/only"]);
    expect(recorder.unusedSteps()).toBe(1);
  });

  it("routes to the matching step when several match the same request", async () => {
    const steps: RecordedStep[] = [
      { match: (r) => r.url.endsWith("/messages"), response: jsonResponse({ kind: "list" }) },
      { match: (r) => r.url.endsWith("/messages/x"), response: jsonResponse({ kind: "fetch" }) },
    ];
    const recorder = createRecorder(steps);

    // The list matcher would also accept the fetch URL, so first-match-wins would
    // hand the wrong body back unless the more specific step is matched first.
    const response = await recorder.transport(request("GET", "https://api.test/messages/x"));

    expect(JSON.parse(response.body)).toEqual({ kind: "fetch" });
  });
});

describe("createFetchTransport", () => {
  it("issues the request it was given and reads the response", async () => {
    const seen: unknown[] = [];
    const transport = createFetchTransport(async (url, init) => {
      seen.push({ url, init });
      return new Response("body text", { status: 201, headers: { "Ratelimit-Policy": "1; w=60" } });
    });

    const response = await transport({
      url: "https://api.test/resource",
      method: "POST",
      headers: { accept: "application/json" },
      body: '{"a":1}',
    });

    expect(seen).toEqual([
      {
        url: "https://api.test/resource",
        init: {
          method: "POST",
          headers: { accept: "application/json" },
          body: '{"a":1}',
        },
      },
    ]);
    expect(response.status).toBe(201);
    expect(response.body).toBe("body text");
    // Lowercased on the way in, so no adapter has to know how the server cased it.
    expect(response.headers["ratelimit-policy"]).toBe("1; w=60");
  });

  it("omits the body entirely for a request that has none", async () => {
    let init: unknown;
    const transport = createFetchTransport(async (_url, options) => {
      init = options;
      // A null body, not "": the `Response` constructor rejects a body on a 204,
      // which is itself the correct rule for a no-content response.
      return new Response(null, { status: 204 });
    });

    await transport({ url: "https://api.test/x", method: "DELETE", headers: {} });

    // Passing `body: undefined` explicitly would be a different request to some
    // fetch implementations, so the property is absent rather than undefined.
    expect(init).not.toHaveProperty("body");
  });

  it("lets a transport-level rejection propagate", async () => {
    // A rejected fetch is a transport failure, not an HTTP response. An adapter
    // must be able to tell the two apart, so this is not swallowed here.
    const transport = createFetchTransport(async () => {
      throw new Error("network down");
    });

    await expect(
      transport({ url: "https://api.test/x", method: "GET", headers: {} }),
    ).rejects.toThrow("network down");
  });
});

function request(
  method: TransportRequest["method"],
  url: string,
  extra: { readonly body?: string } = {},
): TransportRequest {
  return {
    url,
    method,
    headers: {},
    ...(extra.body === undefined ? {} : { body: extra.body }),
  };
}
