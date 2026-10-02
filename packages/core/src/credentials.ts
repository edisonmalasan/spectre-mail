/**
 * Provider credentials.
 *
 * Credentials are the one part of the model that necessarily differs per provider,
 * because the two providers issue fundamentally different things: Mail.tm issues
 * an account plus a bearer token, while Guerrilla Mail issues a session identifier.
 * Those are not two spellings of one credential, and the type system says so.
 *
 * Two rules govern this module:
 *
 * 1. **The union is discriminated.** Supplying Mail.tm credentials where Guerrilla
 *    credentials are required is a compile-time error, not a runtime surprise that
 *    turns into an authentication failure against the wrong provider.
 * 2. **Field names are SpectreMail's own.** No field here is named after a
 *    provider's response field. An adapter translates; it does not rename the
 *    product's vocabulary to match a wire format, because that vocabulary would
 *    then outlive the provider that dictated it.
 *
 * @module
 */

import type { ProviderId } from "./provider";

/**
 * Credentials for a Mail.tm account.
 *
 * `accountId` and `accessToken` are SpectreMail's names for the account
 * identifier and the bearer token Mail.tm returns. Neither the adapter nor any
 * consumer needs the provider's own spelling of them.
 */
export interface MailTmCredentials {
  readonly provider: "mailtm";
  readonly accountId: string;
  readonly accessToken: string;
}

/**
 * Credentials for a Guerrilla Mail session.
 *
 * `sessionId` is the session identifier **returned in the response body**, never
 * the `PHPSESSID` cookie. This is a measured constraint, not a preference: the
 * provider sends `Access-Control-Allow-Origin: *` with **no**
 * `Access-Control-Allow-Credentials`, so a browser cannot send its cookie
 * cross-origin. A session persisted from the cookie would appear to work in a
 * non-browser context and then fail in the extension, which is the harder failure
 * to diagnose. See `docs/PROVIDERS.md`.
 */
export interface GuerrillaCredentials {
  readonly provider: "guerrilla";
  readonly sessionId: string;
}

/**
 * Credentials for exactly one provider.
 *
 * Discriminated by `provider`, which is also the only field both variants share.
 * Every consumer that branches on `credentials.provider` is guaranteed by the
 * compiler to be in a branch where that variant's own fields exist.
 */
export type ProviderCredentials = MailTmCredentials | GuerrillaCredentials;

/**
 * The provider a set of credentials was issued for.
 *
 * Safe to call on any credential because the discriminant is always present; this
 * exists so callers that hold a union do not have to restate the narrowing.
 */
export function credentialsProvider(credentials: ProviderCredentials): ProviderId {
  return credentials.provider;
}

/**
 * Narrow credentials to the Mail.tm variant.
 *
 * @throws {Error} If the credentials belong to another provider.
 */
export function assertMailTmCredentials(credentials: ProviderCredentials): MailTmCredentials {
  if (credentials.provider !== "mailtm") {
    throw new Error(
      `Expected Mail.tm credentials but received ${credentials.provider} credentials. ` +
        `These are not interchangeable: sending one provider's credentials to the ` +
        `other would be a wrong-provider authentication attempt.`,
    );
  }
  return credentials;
}

/**
 * Narrow credentials to the Guerrilla variant.
 *
 * @throws {Error} If the credentials belong to another provider.
 */
export function assertGuerrillaCredentials(credentials: ProviderCredentials): GuerrillaCredentials {
  if (credentials.provider !== "guerrilla") {
    throw new Error(
      `Expected Guerrilla credentials but received ${credentials.provider} credentials. ` +
        `These are not interchangeable: sending one provider's credentials to the ` +
        `other would be a wrong-provider authentication attempt.`,
    );
  }
  return credentials;
}
