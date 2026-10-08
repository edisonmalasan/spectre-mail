/**
 * The background context's answer to "create a mailbox for this device".
 *
 * ## Why the worker performs creation rather than the page that asked for it
 *
 * Measured on 2026-10-08 and recorded in `docs/PROVIDERS.md` §4.4: a **content script's** own
 * `fetch` to a host the extension holds `host_permissions` for is **not** covered by that
 * permission — it obeys the **page's** CORS policy, and the identical request from this worker
 * succeeds. So a control drawn inside somebody else's signup form cannot reach a provider. Doing
 * it here is not an architectural preference; it is the only place a provider round trip can be
 * made from.
 *
 * ## Why this module holds no session, and no state of any kind
 *
 * **`open()` is asked for per request and the session is released in a `finally`.** An MV3
 * background worker is idle-terminated and this repository has measured **a bound, not a
 * lifetime** (§4.4 arm E: the worker was still registered after a 35-second idle gap and answered
 * in 5 ms — which says it was alive, not when it would not be). Anything retained between events
 * is retained in a context whose death nobody has measured. Retaining nothing makes that fact
 * harmless: a woken worker and a cold one behave identically, because there is no state whose
 * absence a cold one would notice.
 *
 * **The session is destroyed in a `finally` rather than left to go out of scope**, because
 * `destroy()` is the only call that releases the session's scheduler, and leaving it to garbage
 * collection would be relying on a GC root being collected rather than on a call being made.
 *
 * ## Why `isReady` and not `holdsMailbox`
 *
 * `holdsMailbox` admits `expired` and `restoreFailed`, and its own note says that over-inclusion
 * is deliberate — **because it is the right question for a page that needs to *name* an address
 * the user came back for.** It is the wrong question here. Both of those variants mean the
 * provider told us the mailbox is gone, and `provider-abstraction` plus the Guerrilla dead-session
 * trap in `docs/PROVIDERS.md` §3 are the reason this product does not present an address the
 * provider has not confirmed is working. `open()` cannot return either today; a session that
 * returned one would still be stored, offered back on the next visit, and inserted into somebody's
 * form.
 *
 * ## Why every path answers
 *
 * A context that answers on the paths it controls and not on the others turns a fault into a
 * request that never returns — and the page's only instrument for that is a wait it must invent a
 * ceiling for. So the four outcomes are exhaustive here, and each is a fact rather than a guess:
 * created, refused with the provider's words, created-but-not-stored, and not-acted-on.
 *
 * @module
 */

import {
  createMailboxSession,
  isExpired,
  isFailed,
  isReady,
  isRestoreFailed,
} from "@spectre-mail/mailbox";
import type { SessionState } from "@spectre-mail/mailbox";
import type { Transport } from "@spectre-mail/providers";
import type { SpectreStorage } from "@spectre-mail/storage";

import { isCreateMailboxRequest } from "./protocol";
import type { CreateMailboxAnswer } from "./protocol";
import { createExtensionProviderManager } from "./provider-config";
import { extensionScheduler } from "./scheduler";

/**
 * What this module needs to answer one request.
 *
 * **A function rather than a session**, and that is the whole of the statelessness: the opener is
 * called once per request and builds its own session, so there is no parameter through which a
 * retained session could arrive.
 */
export interface CreateMailboxDependencies {
  /** Where the created mailbox is stored, through the shared contract rather than the platform. */
  readonly storage: SpectreStorage;
  /** Creates a mailbox and reports the resulting state. Called once per request. */
  readonly openMailbox: () => Promise<SessionState>;
}

/**
 * Build the opener this context uses, given how requests are performed.
 *
 * **The transport is a parameter, not a global read**, for the reason
 * `createExtensionProviderManager` gives: a global read would compile in any environment and run
 * only in production, and this function's failure branch is exactly the branch a test needs to
 * reach without a network.
 *
 * **Built per call rather than once at module scope**, so a `Transport` handed to a test is the
 * one that performs the request, and so nothing about a composition survives between requests.
 *
 * @param transport - How provider requests are performed. Production passes `extensionTransport`.
 */
export function createExtensionMailboxOpener(transport: Transport): () => Promise<SessionState> {
  return async () => {
    const manager = createExtensionProviderManager(transport);
    const session = createMailboxSession(manager, extensionScheduler);

    try {
      return await session.open();
    } finally {
      // **The scheduler the session was built with is released here.** Nothing in this path polls,
      // so this cancels nothing that was scheduled; it is the statement that the session is spent.
      session.destroy();
    }
  };
}

/**
 * Answer one message from another of this extension's contexts.
 *
 * **Never rejects.** A rejection here would be reported by the transport as *no answer at all*,
 * which the page renders as "SpectreMail could not confirm" — losing the difference between a
 * provider that refused and a device that could not be written, for a fault this function can
 * name. Every `catch` below answers instead.
 *
 * @param request - Whatever the message channel delivered. Untyped by construction.
 * @param dependencies - The opener and the store, both used once.
 */
export async function handleCreateMailbox(
  request: unknown,
  dependencies: CreateMailboxDependencies,
): Promise<CreateMailboxAnswer> {
  if (!isCreateMailboxRequest(request)) {
    // **Named rather than defaulted by a later branch, because the distinction is load-bearing.**
    // A message this context does not act on has caused no provider request and no write, which is
    // a different fact from a request that was made and could not be stored.
    return { kind: "notActedOn" };
  }

  let state: SessionState;

  try {
    state = await dependencies.openMailbox();
  } catch (cause) {
    // **`open()` documents itself as never throwing a throttled failure and never retrying**, so a
    // rejection here is a fault rather than a provider verdict — and it is reported with what was
    // thrown rather than with a sentence written here, for the same reason the refusal below is.
    return { kind: "refused", description: describe(cause) };
  }

  if (!isReady(state)) {
    return refusalFor(state);
  }

  try {
    // **Persisted before the answer, and only after the provider confirmed it.** Both halves are
    // the popup's rule (`Popup.tsx`'s `create`), and both are load-bearing: a mailbox stored
    // before confirmation is offered back as though it worked, and answering before the write
    // would hand a page an address this device cannot produce again.
    await dependencies.storage.saveMailbox(state.mailbox);
  } catch {
    // **No address in the answer, deliberately.** There is a mailbox at the provider and no note
    // of it here; a variant carrying the address would be one a caller could insert on the
    // strength of a write that failed.
    return { kind: "notStored" };
  }

  return { kind: "created", address: state.mailbox.address };
}

/**
 * Turn a state that is not a usable mailbox into an answer.
 *
 * **The provider's own words, in every branch that has them.** `provider-abstraction` requires a
 * refusal to be surfaced rather than summarised, and a sentence written here would be a second
 * thing that can disagree with the provider about what happened.
 *
 * **The last branch is the one the type cannot rule out**, and it says what was observed rather
 * than what it suspects: the session came back holding nothing and explaining nothing. `open()`
 * resolves to `ready` or `failed` today, so no shipped path reaches it — but it is answered
 * rather than cast, because a cast would be a guess rendered as a type.
 */
function refusalFor(state: SessionState): CreateMailboxAnswer {
  if (isFailed(state) || isRestoreFailed(state)) {
    return { kind: "refused", description: state.failure.description };
  }

  // **`expired` carries a mailbox and no `failure`,** which is why it cannot be folded into the line
  // above. `open()` cannot produce it; a session that did would have been told the address it just
  // made no longer receives mail, and that is a sentence about the address rather than an error the
  // provider reported — so it is written here rather than read from a field that does not exist.
  if (isExpired(state)) {
    return {
      kind: "refused",
      description:
        "SpectreMail's provider reported that the address it returned no longer receives mail, so it is not offered.",
    };
  }

  return {
    kind: "refused",
    description:
      "SpectreMail asked its provider for an address and came back with nothing to show for it.",
  };
}

/** Whatever was thrown, in its own words, falling back to its type rather than to a blank string. */
function describe(cause: unknown): string {
  if (cause instanceof Error && cause.message.length > 0) {
    return cause.message;
  }

  return String(cause);
}
