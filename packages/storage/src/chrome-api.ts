/**
 * The slice of the extension storage API this adapter uses, declared rather than
 * depended on.
 *
 * ## Why this file exists rather than `@types/chrome`
 *
 * Two reasons, and the second is the one that would decide it alone.
 *
 * **First: the slice is three operations.** `chrome.storage` is a namespace of
 * `local`, `sync`, `session`, `managed`, and `onChanged` — several hundred
 * declarations for the whole API surface, none of which this adapter, this
 * package, or the extension calls. Importing the full type package to name three
 * methods is how a codebase ends up typed against an API surface it has not chosen
 * to use, and how "we only use `get`, `set`, and `clear`" becomes a claim with no
 * gate behind it.
 *
 * **Second: the declared shape is the contract, so it can be checked.** A test can
 * read this interface and know exactly which platform operations the product
 * depends on — which is what M12's permissions review will want, and what a
 * dependency bump cannot silently widen. `@types/chrome` would make that review a
 * question about someone else's declarations.
 *
 * ## What this deliberately does not declare
 *
 * The ambient `chrome` namespace itself. A file that declared `declare const
 * chrome: …` would put the platform's shape in this package's *ambient* scope,
 * where every file in it could reach it — including a future one that should not.
 * Declaring the **area interface** instead means the only way to obtain a platform
 * area is to be handed one, and the caller — the extension's composition root — is
 * the single place that decides where storage comes from.
 *
 * That is the same reasoning `createIndexedDbStorage` follows with its required
 * `IDBFactory`: the platform is injected, so no path exists that quietly picks a
 * default and runs only in production.
 *
 * ## The methods are promise-returning, and that is this platform's actual shape
 *
 * Manifest V3 `chrome.storage` methods return promises when no callback is given.
 * The callback form is deprecated, and modelling the callback form would make the
 * adapter write a promisifier the platform does not need — which is the kind of
 * difference `contract.ts` says should not be restated per platform. So the
 * promise shape is declared, and the adapter awaits it directly.
 *
 * @module
 */

/**
 * One `chrome.storage` area — `local`, `sync`, `session`, or `managed`.
 *
 * **Structural, not nominal.** The real platform object satisfies it, and so does
 * a test's fake, without either being declared to implement anything. That is
 * deliberate: the alternative would make a unit test assert against a hand-written
 * mock's own type rather than against the shape this adapter actually uses.
 */
export interface ChromeStorageArea {
  /**
   * Read the given keys, or the whole area when called with none.
   *
   * Resolves with an object **keyed by the requested keys**. A key that was never
   * written is **absent from that object** rather than present-and-`undefined` —
   * which is why the caller reads it defensively rather than treating a missing
   * key as a stored `undefined`.
   */
  get(keys?: string | string[] | Record<string, unknown> | null): Promise<Record<string, unknown>>;

  /**
   * Write the given items, replacing any existing value at each key.
   *
   * Resolves once the platform has accepted the write. **There is no transaction
   * and no commit step after this promise**, which is the platform difference the
   * adapter's module note records.
   */
  set(items: Record<string, unknown>): Promise<void>;

  /** Remove every key from this area, including keys this build does not recognise. */
  clear(): Promise<void>;
}
