/**
 * The non-wire environment an adapter needs.
 *
 * Injected rather than reached for. A web page, an MV3 extension service worker,
 * and a test all need to supply these differently, and an adapter that read the
 * clock or a random source from a global would make its own tests
 * non-deterministic — a mailbox created "now" would differ between two runs of the
 * same test.
 *
 * This lives in its own module rather than beside one adapter because both adapters
 * consume it, and having the second import the first would make the dependency
 * graph lie about that.
 *
 * @module
 */

/** What every adapter needs, regardless of provider. */
export interface ProviderEnvironment {
  /**
   * Performs every outbound request.
   *
   * The seam the conformance suite depends on. See `./transport.ts`.
   */
  readonly transport: import("./transport").Transport;
  /** Epoch milliseconds. */
  readonly now: () => number;
}

/**
 * What an adapter needs when it must invent part of the credentials.
 *
 * Separate from {@link ProviderEnvironment} because the need is genuinely
 * provider-specific: Mail.tm issues no address and demands a password that is
 * later exchanged for a token, while Guerrilla hands out a random address outright
 * and needs no password at all. Requiring a random source of an adapter that never
 * calls it would be a fake dependency, and a fake dependency is one that silently
 * rots.
 */
export interface CredentialSourceEnvironment extends ProviderEnvironment {
  /** A lowercase alphanumeric string of the requested length. */
  readonly randomToken: (length: number) => string;
}
