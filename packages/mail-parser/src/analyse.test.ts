import { describe, expect, it } from "vitest";

import { analyseMessage } from "./analyse";
import { detectVerificationCodes } from "./detect-codes";
import { detectVerificationLinks } from "./detect-links";
import { extractReadableContent } from "./extract";

describe("the composed result equals the steps applied in sequence", () => {
  it("matches extraction followed by both detectors", () => {
    const body =
      "<p>Your verification code is 483920</p>" +
      '<p>Or <a href="https://example.test/v">verify your email</a></p>';

    const { readable, anchors } = extractReadableContent(body);
    const composed = analyseMessage(body);

    expect(composed.readable).toBe(readable);
    expect(composed.codes).toEqual(detectVerificationCodes(readable));
    expect(composed.links).toEqual(detectVerificationLinks(anchors));
  });

  it("returns nothing for a message with neither codes nor links", () => {
    const result = analyseMessage("<p>Nothing of interest here.</p>");

    expect(result).toEqual({ readable: "Nothing of interest here.", codes: [], links: [] });
  });

  it("returns readable text with no markup for a markup body", () => {
    const result = analyseMessage(
      "<html><body><p>Your verification code is <b>483920</b></p></body></html>",
    );

    expect(result.readable).toBe("Your verification code is 483920");
    expect(result.readable).not.toContain("<");
    expect(result.codes.map((code) => code.value)).toEqual(["483920"]);
  });

  it("finds a code in a plain-text body unchanged", () => {
    const result = analyseMessage("Hi,\n\nYour security code is 8421\n\nThanks.");

    expect(result.codes.map((code) => code.value)).toEqual(["8421"]);
  });

  it("finds both a code and a link in one message", () => {
    const result = analyseMessage(
      "<p>Your verification code is 483920</p>" +
        '<p><a href="https://example.test/v">Verify your email address</a></p>',
    );

    expect(result.codes).toHaveLength(1);
    expect(result.links).toHaveLength(1);
    expect(result.links[0]?.hostname).toBe("example.test");
  });
});

describe("composed results are repeatable", () => {
  it("produces byte-identical output for identical input", () => {
    const body =
      "<p>Your verification code is 483920</p>" +
      '<p><a href="https://example.test/v">Verify</a></p>' +
      "<p>Order 98765 shipped</p>";

    const first = analyseMessage(body);
    const second = analyseMessage(body);
    const third = analyseMessage(body);

    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    expect(JSON.stringify(third)).toBe(JSON.stringify(first));
  });

  it("is unaffected by parsing the same body in between", () => {
    // A shared accumulator or cached buffer between calls would make the result depend
    // on history, which the determinism guarantee forbids.
    const body = '<p>Code 551203</p><p><a href="https://example.test/v">Verify</a></p>';

    analyseMessage("<p>Code 111111</p>");
    analyseMessage("<p>Code 222222</p>");

    expect(analyseMessage(body)).toEqual(analyseMessage(body));
  });
});

describe("the composed result carries no field beyond the shared model", () => {
  it("exposes exactly the readable text, the codes, and the links", () => {
    const result = analyseMessage("<p>Your verification code is 483920</p>");

    expect(Object.keys(result).sort()).toEqual(["codes", "links", "readable"]);
  });

  it("gives each code exactly a value and a confidence", () => {
    const result = analyseMessage("<p>Your verification code is 483920</p>");
    const code = result.codes[0];

    expect(code !== undefined && Object.keys(code).sort()).toEqual(["confidence", "value"]);
  });

  it("gives each link exactly a url, a hostname, and a confidence", () => {
    const result = analyseMessage('<p><a href="https://example.test/v">Verify your email</a></p>');
    const link = result.links[0];

    expect(link !== undefined && Object.keys(link).sort()).toEqual([
      "confidence",
      "hostname",
      "url",
    ]);
  });
});
