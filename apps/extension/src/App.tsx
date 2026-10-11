/**
 * The popup's composition root.
 *
 * ## What this owns, and what `main.tsx` owns
 *
 * This module builds the two objects the popup needs — a provider manager and a
 * mailbox session — and owns nothing else. `main.tsx` owns the one thing that cannot
 * exist in a test environment at all, which is `chrome.storage.local`.
 *
 * That split is the reason both exist. If `main.tsx` also built the session, every
 * component test would need a `chrome` global, and `jsdom` has none — so the injection
 * point that makes the popup testable would have been designed out by convenience.
 *
 * ## The session is created once, not per render
 *
 * The requirement is that a session is **built once**, because one rebuilt on a re-render
 * would **discard the inbox the user was already shown** and every mailbox created before
 * it. A popup that forgets its mailbox because something else in it changed state is a
 * data-loss bug wearing a performance optimisation's clothes.
 *
 * **It is `useState` with a lazy initialiser, and this file previously got the reason
 * wrong.** It read *"useRef rather than useState/useMemo, and the reason is specific"* —
 * but that reason does not distinguish them: `useState(() => …)` is also built once and is
 * never rebuilt on a re-render, so the note rejected the correct hook for a property the
 * wrong hook did not uniquely have. `pnpm lint` then reported `react-hooks/refs` twice on
 * this file, because **reading `ref.current` during render is genuinely unsafe** under
 * concurrent rendering: React may discard a render and read the ref again.
 *
 * **The lint rule is right and the note was wrong, which is the same shape as every other
 * correction in this file's history** — so the note is rewritten rather than the rule
 * silenced. The property that was actually wanted, *built once*, is now stated in the
 * terms of the hook that provides it.
 *
 * @module
 */

import { useState } from "react";

import { createMailboxSession } from "@spectre-mail/mailbox";
import type { MailboxSession } from "@spectre-mail/mailbox";

import { sendToBackground } from "./extension-platform";
import { Popup } from "./Popup";
import type { PopupProps, PopupStorage } from "./Popup";
import { RECONCILE_ALARM_REQUEST } from "./protocol";
import {
  createExtensionProviderManager,
  EXTENSION_PROVIDER_IDS,
  primaryProviderName,
} from "./provider-config";
import { extensionScheduler } from "./scheduler";
import { extensionTransport } from "./transport";

/**
 * Ask the background worker to look at its own storage and arm or withhold its schedule.
 *
 * **A named function rather than an inline arrow in the render**, so the seam has one definition this
 * module can talk about, and so a test that wants to observe the request has a value to replace
 * rather than a closure it has to rebuild.
 *
 * **`sendToBackground` resolves `undefined` on every refusal and never rejects** — its own note says
 * so — so this function has no error path to handle. That is what lets the popup `await` it without
 * a `catch`, and the reason the popup's own note can say there is nothing to swallow.
 */
function askBackgroundToReconcileAlarm(): Promise<unknown> {
  return sendToBackground(RECONCILE_ALARM_REQUEST);
}

export interface AppProps {
  /**
   * Where the popup persists its mailbox.
   *
   * Required rather than defaulted, so a component test cannot accidentally exercise a
   * path where persistence is silently absent — which is the failure
   * `packages/storage`'s "read reported as absent" requirement is about.
   */
  readonly storage: PopupStorage;
  /** Overrides the session. Tests that need a specific one pass it here. */
  readonly session?: MailboxSession;
  /** Told when the boot read finishes, for a test to observe. */
  readonly onBooted?: PopupProps["onBooted"];
  /**
   * Overrides how the popup asks the background context to arm its schedule.
   *
   * **Optional here and required on {@link PopupProps}, and the asymmetry is the point.** This is the
   * composition root, so the real seam is bound here once and every shipped popup gets it; the popup
   * itself demands one so that no *other* composition can be built without it. A test that renders
   * `App` in jsdom inherits `sendToBackground`, which resolves `undefined` against a platform that is
   * not there — an arming that does nothing, in a test that is not about arming.
   */
  readonly requestBackgroundAlarm?: PopupProps["requestBackgroundAlarm"];
}

export function App({
  storage,
  session: injected,
  onBooted,
  requestBackgroundAlarm: armAlarm,
}: AppProps) {
  /**
   * Built once, by the lazy initialiser.
   *
   * **A function, not a value.** `useState(buildStuff())` would call `buildStuff` on every
   * render — evaluating the argument even though the returned state is discarded — so the
   * lazy form is what actually provides the "built once" property the note above claims
   * this hook has.
   *
   * **Both halves come from one manager object**, so the popup cannot be told one
   * provider's name while the session was handed another. That drift is exactly what the
   * string literal this file used to hold made possible.
   */
  const [built] = useState(() => {
    const manager = createExtensionProviderManager(extensionTransport);
    return {
      session: injected ?? createMailboxSession(manager, extensionScheduler),
      providerName: primaryProviderName(manager),
    };
  });

  return (
    <Popup
      session={built.session}
      storage={storage}
      primaryProviderName={built.providerName}
      // **Spread rather than a straight pass-through**, because the shared config sets
      // `exactOptionalPropertyTypes`, under which an optional property may be *absent*
      // but may not be present-and-`undefined`. Passing it straight through is the
      // difference between the callback existing and not existing, as far as the type is
      // concerned — and the popup's own effect depends on that identity being stable.
      // **The alarm seam is defaulted rather than spread for the opposite reason**: it is
      // required below, so the one value this composition always has has to reach it
      // whether or not a caller supplied an override.
      {...(onBooted === undefined ? {} : { onBooted })}
      requestBackgroundAlarm={armAlarm ?? askBackgroundToReconcileAlarm}
    />
  );
}

/**
 * The provider ids this client is configured with, for the manifest build to check.
 *
 * **Exported rather than re-read from a constant**, because the manifest's host
 * permissions and this list have to agree, and the only way two things agree is if one
 * is derived from the other. `manifest.test.ts` asserts the built manifest's patterns
 * are the wildcard form of exactly the origins these providers are reached at.
 */
export const PROVIDER_IDS = EXTENSION_PROVIDER_IDS;
