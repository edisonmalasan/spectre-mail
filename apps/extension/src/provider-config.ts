/**
 * The extension's provider configuration.
 *
 * ## Two providers, and the measured reason this client has them
 *
 * `apps/web` reaches Guerrilla Mail only, and its module note says to **keep the list
 * that length** — two entries there would claim redundancy a web page does not have.
 * That is not a preference; it is Mail.tm sending `Access-Control-Allow-Origin` only to
 * its own origins, so no compliant page can reach it at all.
 *
 * An extension is a different host environment. Holding a host permission for
 * `https://api.mail.tm/*` makes that origin reachable, and holding one for
 * `https://api.guerrillamail.com/*` makes the other reachable. **So both entries below
 * mean something**, which is the entire difference between the two clients: reachability
 * is a property of where the code runs, not of the provider.
 *
 * The order is the product's: Mail.tm first, because it is the provider whose addresses
 * this milestone's spec names as primary, and Guerrilla Mail behind it because it is the
 * one measured to work.
 *
 * ## The list configures the client, and that is enforced
 *
 * {@link EXTENSION_PROVIDER_IDS} is not documentation beside the real configuration. The
 * factory below **derives** from it, and {@link ADAPTERS} is typed
 * `Readonly<Record<ExtensionProviderId, …>>`, so an id added to the list with no adapter
 * beside it **does not compile**.
 *
 * That is the same repair `apps/web` needed, and for the same reason: its list once
 * described a coupling the factory did not have, so "adding a provider is a visible edit
 * to one list" was true of the prose and false of the code. `apps/web`'s exported list is
 * additionally required by a boundary rule to be **read as a value**, which is what stops
 * a module that only *describes* the coupling from satisfying the rule.
 *
 * @module
 */

import {
  createGuerrillaAdapter,
  createMailTmAdapter,
  createProviderManager,
} from "@spectre-mail/providers";
import type { MailProvider, ProviderManager, Transport } from "@spectre-mail/providers";

/**
 * The providers the extension reaches, in preference order.
 *
 * A named constant rather than a value inlined at the call site, so a test can read the
 * configuration instead of inferring it from what the popup rendered.
 */
export const EXTENSION_PROVIDER_IDS = ["mailtm", "guerrilla"] as const;

/** The ids this client declares, as a union. */
export type ExtensionProviderId = (typeof EXTENSION_PROVIDER_IDS)[number];

/**
 * One adapter per declared id, and the only place an adapter is constructed.
 *
 * Typed `Record<ExtensionProviderId, …>` on purpose. `Record` over a finite literal
 * union is exhaustive in the type system, so declaring a second id in
 * {@link EXTENSION_PROVIDER_IDS} without adding it here **does not compile**.
 *
 * **Client configuration, not shared provider machinery.** A registry like this would be
 * wrong inside `packages/providers`: keyed by id, it would let any client import an
 * adapter it must not reach, and the boundary rule that confines adapters to that package
 * exists precisely because reachability is per client.
 */
const ADAPTERS: Readonly<
  Record<ExtensionProviderId, (environment: ProviderEnvironment) => MailProvider>
> = {
  /**
   * **`randomToken` is real here, not a test convenience.** Mail.tm issues no address and
   * demands a password that is later exchanged for a token, so unlike the Guerrilla
   * adapter this one *must* invent part of its credentials. A fake random source would
   * make every mailbox this extension creates share a password, which is a real
   * credential defect rather than a test artefact.
   */
  mailtm: ({ transport, now }) =>
    createMailTmAdapter({
      transport,
      now,
      randomToken: (length) => randomToken(length),
    }),
  // **`randomToken` is absent deliberately.** The Guerrilla adapter hands out a random
  // address outright and needs no password, and requiring a random source of an adapter
  // that never calls it would be a fake dependency — one that silently rots.
  guerrilla: ({ transport, now }) => createGuerrillaAdapter({ transport, now }),
};

/** The non-wire environment both adapters are handed. */
interface ProviderEnvironment {
  readonly transport: Transport;
  readonly now: () => number;
}

/**
 * The display name of the provider this client reaches first, **read from the manager.**
 *
 * ## This used to be a string literal in `App.tsx`, under a comment claiming it was not
 *
 * It read `export const PRIMARY_PROVIDER_NAME = "Mail.tm";` with a comment saying the name
 * was *"named from the id list rather than written out"* — and it was written out. That is a
 * prose claim no assertion held up, which is a defect class `AGENTS.md` records by name.
 *
 * The cost was real rather than cosmetic. **`packages/providers` owns the display name** —
 * `MailProvider.displayName` is declared there and both adapters set it — so a second copy
 * in a client can name a provider the adapter calls something else, and nothing here would
 * notice. Renaming Mail.tm in the package would leave this popup announcing the old name
 * with every test still green, because the browser spec asserted the heading against the
 * very constant that had drifted. `tests/architecture/boundaries.test.ts` now forbids a
 * client file from containing a string the provider package declares.
 *
 * ## Why `available[0]` and not the id list
 *
 * **The manager is the thing that knows.** `ProviderManager.available` is the ordered list
 * of adapters this client actually built, so its first entry *is* the provider this client
 * reaches first — which is the claim being made. Deriving from `EXTENSION_PROVIDER_IDS`
 * would only be one step better: an id is a string too, and mapping an id to a name means
 * writing the mapping out, which is the duplication again.
 *
 * ## Why this lives here rather than in `App.tsx`
 *
 * **It is configuration, and `App.tsx` is a component.** Two concrete reasons, and the
 * second is the one that decided it: `eslint`'s `react-refresh/only-export-components`
 * correctly warns when a component module also exports a non-component, and — more to the
 * point — **a function in `App.tsx` has no unit test**, because `App.tsx` has no test file.
 * Placed here it is one line above a test that asserts it against the real manager.
 */
export function primaryProviderName(manager: ProviderManager): string {
  const first = manager.available[0];
  if (first === undefined) {
    // **Unreachable through `createExtensionProviderManager`**, which builds from a
    // non-empty list — and it is stated rather than cast because a cast here would be a
    // guess rendered as a type. If the list is ever emptied the popup should say so rather
    // than render `undefined`. **Reachable from a test**, which is why the branch is
    // covered rather than merely asserted unreachable.
    throw new Error(
      "The extension's provider manager has no providers, so there is no name to announce.",
    );
  }
  return first.displayName;
}

/**
 * A lowercase alphanumeric string of `length` characters.
 *
 * **`crypto.getRandomValues`, not `Math.random`.** This is a password for a provider
 * account, and `Math.random` is neither cryptographically strong nor required to be.
 * Where the platform provides nothing, this throws rather than falling back to a weaker
 * source: a mailbox account created with a guessable password is a defect the user would
 * discover by receiving mail addressed to someone else.
 */
function randomToken(length: number): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  const source = Reflect.get(globalThis, "crypto");
  if (source === undefined || source === null) {
    throw new Error(
      "This environment provides no Web Crypto, so SpectreMail cannot create a Mail.tm " +
        "account: the account password would have to be guessable. Reported rather than " +
        "worked around.",
    );
  }
  const bytes = new Uint8Array(length);
  (source as Crypto).getRandomValues(bytes);
  // **Modulo, and the bias it introduces is recorded rather than pretended away.** It is
  // a uniform draw from `alphabet.length` (36) out of 256, so values below 252 are
  // very slightly favoured. For a password on a disposable mailbox account that is not
  // a material weakness, and rejection-sampling to remove it would be a longer function
  // guarding a property nothing here claims.
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

/**
 * Build the extension's provider manager.
 *
 * Derives its adapters from {@link EXTENSION_PROVIDER_IDS}, in that order, so the
 * exported list and the client's actual providers cannot drift apart.
 *
 * Takes the transport as a parameter rather than reading the global `fetch`, so this file
 * contains no `fetch` call and a test can supply a recording transport without the module
 * reaching for a browser global.
 *
 * @param transport - How requests are performed. Production passes
 *   {@link extensionTransport}.
 */
export function createExtensionProviderManager(transport: Transport): ProviderManager {
  return createProviderManager(
    EXTENSION_PROVIDER_IDS.map((id) => ADAPTERS[id]({ transport, now: () => Date.now() })),
  );
}
