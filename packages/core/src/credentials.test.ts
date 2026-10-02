import { describe, expect, it } from "vitest";

import {
  assertGuerrillaCredentials,
  assertMailTmCredentials,
  credentialsProvider,
} from "./credentials";
import type { GuerrillaCredentials, MailTmCredentials, ProviderCredentials } from "./credentials";

/**
 * Fixtures use SpectreMail's own field names.
 *
 * **There is deliberately no test here asserting that.** This file carried one for
 * a while - stringifying the fixtures below and asserting the result held no
 * provider field name - and it was proven incapable of failing. Injecting a real
 * wire field name into `packages/core/src/credentials.ts` left all six tests in
 * this file passing, both as originally written and after an attempt to "fix" it:
 * the fixtures are constructed here, with the normalized names, so the assertion
 * held no matter what the shipped module did.
 *
 * Wire format in a *type* is erased at runtime, so no runtime assertion in this
 * file could catch it. The rule is genuinely enforced by
 * `tests/architecture/boundaries.test.ts`, which reads real source across every
 * workspace package except `packages/providers`. That test was widened to reach
 * `packages/core` during M2 for exactly this reason.
 *
 * Recorded as a note because the natural instinct on reading this file is to add
 * the obvious test back, and the obvious test is the one that proves nothing.
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

  it("keeps every variant reachable through the union", () => {
    // Guards against a future edit narrowing the union and quietly removing a
    // provider, which would be a compile error elsewhere but is worth asserting
    // here because the failure would otherwise be confusing.
    const all: ProviderCredentials[] = [mailTm, guerrilla];
    expect(all).toHaveLength(2);
  });
});
