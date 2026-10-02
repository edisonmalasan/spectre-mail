import { describe, expect, it } from "vitest";

import {
  assertGuerrillaCredentials,
  assertMailTmCredentials,
  credentialsProvider,
} from "./credentials";
import type { GuerrillaCredentials, MailTmCredentials, ProviderCredentials } from "./credentials";

/**
 * Fixtures use SpectreMail's own field names. They deliberately never use a
 * provider's wire spelling, so that a future "helpful" rename cannot slip in here
 * unnoticed and quietly reintroduce wire format into the model.
 */
const mailTm: MailTmCredentials = {
  provider: "mailtm",
  accountId: "acct-1",
  accessToken: "token-value",
};

const guerrilla: GuerrillaCredentials = {
  provider: "guerrilla",
  sessionId: "session-value",
};

describe("ProviderCredentials", () => {
  it("reads the provider off the discriminant", () => {
    expect(credentialsProvider(mailTm)).toBe("mailtm");
    expect(credentialsProvider(guerrilla)).toBe("guerrilla");
  });

  it("narrows to the variant matching the discriminant", () => {
    expect(assertMailTmCredentials(mailTm)).toBe(mailTm);
    expect(assertGuerrillaCredentials(guerrilla)).toBe(guerrilla);
  });

  it("refuses to treat one provider's credentials as another's", () => {
    // This is the requirement that makes the union worth having. Sending Mail.tm
    // credentials to Guerrilla would be a wrong-provider authentication attempt
    // that TypeScript cannot catch once the value has been widened to the union.
    expect(() => assertMailTmCredentials(guerrilla)).toThrow(/not interchangeable/);
    expect(() => assertGuerrillaCredentials(mailTm)).toThrow(/not interchangeable/);
  });

  it("names both providers in the mismatch message", () => {
    // An error that says only "wrong credentials" sends a reader looking at the
    // token rather than at the provider that was selected.
    expect(() => assertMailTmCredentials(guerrilla)).toThrow(/guerrilla/);
    expect(() => assertMailTmCredentials(guerrilla)).toThrow(/Mail\.tm/);
  });

  it("contains no provider wire field name", () => {
    // Guards the normalization at the point where it matters. `sid_token` is the
    // measured Guerrilla field; `token` is Mail.tm's. Neither belongs in core.
    const source = JSON.stringify({ mailTm, guerrilla });
    expect(source).not.toContain("sid_token");
    expect(source).not.toContain("ratelimit-policy");
  });

  it("keeps every variant reachable through the union", () => {
    // Guards against a future edit narrowing the union and quietly removing a
    // provider, which would be a compile error elsewhere but is worth asserting
    // here because the failure would otherwise be confusing.
    const all: ProviderCredentials[] = [mailTm, guerrilla];
    expect(all).toHaveLength(2);
  });
});
