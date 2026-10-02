import { describe, expect, it } from "vitest";

import { PROVIDER_IDS, assertProviderId, isProviderId } from "./provider";

describe("ProviderId", () => {
  it("accepts exactly the providers the project decided on", () => {
    // provider-abstraction: the website reaches Guerrilla Mail only; the extension
    // reaches Mail.tm as primary with Guerrilla Mail as fallback. Both are in the
    // domain vocabulary even though no single client reaches both.
    expect(PROVIDER_IDS).toEqual(["mailtm", "guerrilla"]);
  });

  it("narrows each known provider", () => {
    for (const provider of PROVIDER_IDS) {
      expect(isProviderId(provider)).toBe(true);
    }
  });

  it("refuses to coerce an unrecognised provider", () => {
    // The requirement is that an unrecognised provider is an error condition, not
    // silently coerced to a known one. Coercion would attribute stored data to the
    // wrong provider, which is worse than admitting we do not recognise it.
    expect(isProviderId("protonmail")).toBe(false);
    expect(isProviderId("MAILTM")).toBe(false);
    expect(isProviderId("")).toBe(false);
    expect(isProviderId(null)).toBe(false);
    expect(isProviderId(undefined)).toBe(false);
    expect(isProviderId(42)).toBe(false);
    expect(isProviderId({ provider: "mailtm" })).toBe(false);
  });

  it("names the known providers when rejecting an unknown one", () => {
    // A bare "invalid provider" tells a reader nothing about what was expected.
    expect(() => assertProviderId("protonmail")).toThrow(/mailtm, guerrilla/);
  });

  it("returns the value unchanged when it is already valid", () => {
    expect(assertProviderId("mailtm")).toBe("mailtm");
    expect(assertProviderId("guerrilla")).toBe("guerrilla");
  });
});
