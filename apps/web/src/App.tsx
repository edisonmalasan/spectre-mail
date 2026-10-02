/**
 * Website client root component.
 *
 * ## What this milestone is, and is not
 *
 * M5 slice 2 adds the inbox: the page now lists the current mailbox's messages and
 * marks the ones carrying a verification. This is **structure, not design** — there is
 * no stylesheet, no design token, and no layout system here, and that is deliberate.
 * The visual milestone owns those, and building them now would produce markup it
 * rewrites. The approved design skills are not applied at this milestone.
 *
 * The page states only what is true:
 *
 * - It reaches **one** provider, for the measured CORS reason recorded in
 *   `provider-config.ts`. It does not claim redundancy it does not have, and it
 *   offers no provider selector, because a selector offering only one reachable
 *   provider is a control that cannot do anything.
 * - It **shows no cadence**. It says that it checks while the page is open, and never
 *   how often — no provider limit was measured for the only provider a browser page
 *   can reach, so any figure would be an invention presented as a measurement.
 * - **A reload discards the mailbox.** Nothing is persisted; that is M6.
 * - **Opening a message is not implemented.** Rows show what a message carries, not
 *   its body; that is the next slice, and a row that looks like it can be opened but
 *   cannot would be worse than one that does not pretend.
 * - No backend is involved, and SpectreMail never proxies a provider API.
 *
 * ## Each state is distinct in words, not in colour
 *
 * `creating`, `ready`, and `failed` each render their own heading and their own prose,
 * and so do the inbox's four states. No state is signalled by styling alone, so
 * nothing here depends on colour being perceived or a stylesheet having loaded.
 *
 * @module
 */

import { useState } from "react";

import { createMailboxSession } from "@spectre-mail/mailbox";
import type { MailboxSession } from "@spectre-mail/mailbox";

import { Address } from "./Address";
import { Inbox } from "./Inbox";
import { MailboxFailure } from "./MailboxFailure";
import { MailboxLifetime } from "./MailboxLifetime";
import { createWebsiteProviderManager } from "./provider-config";
import { webScheduler } from "./scheduler";
import { useInboxVisibility } from "./useInboxVisibility";
import { useMailboxSession } from "./useMailboxSession";

export interface AppProps {
  /**
   * The session to render.
   *
   * A parameter rather than something built inside the component, so a test can
   * supply a session over a stub provider and assert the page's behaviour without a
   * network. Production leaves it unset and gets the real one.
   */
  readonly session?: MailboxSession;
}

export function App({ session }: AppProps = {}) {
  // **Built once, in a `useState` initialiser.** Calling `createMailboxSession` in the
  // component body produced a *new* session on every render, which was harmless while
  // the session only ever held a mailbox and quietly wrong now: the binding keys its
  // first listing on the mailbox's id, so a fresh session per render would reset the
  // poller — and its verdict cache — on every state change.
  const [ownSession] = useState(() =>
    createMailboxSession(createWebsiteProviderManager(), webScheduler),
  );
  const active = session ?? ownSession;
  const { state, retry, replace, checkInbox } = useMailboxSession(active);

  useInboxVisibility(active);

  return (
    <main>
      <h1>SpectreMail</h1>
      <p>Temporary email for the web and the browser.</p>

      {state.kind === "creating" && (
        // No address here, and no placeholder shaped like one. An empty input or a
        // greyed-out sample would be read as a real address the moment it appeared,
        // and a user could type a signup form's first field into it.
        <section aria-labelledby="creating-heading">
          <h2 id="creating-heading">Creating your address</h2>
          <p data-testid="creating">Asking Guerrilla Mail for a new address.</p>
        </section>
      )}

      {state.kind === "ready" && (
        <section aria-labelledby="ready-heading">
          <h2 id="ready-heading">Ready</h2>
          <p data-testid="ready">Your address is below. Nothing was required to create it.</p>
          <Address mailbox={state.mailbox} />
          <MailboxLifetime mailbox={state.mailbox} />
          {/* Rendered above the inbox, and always: an address the user has to scroll
              to find after a failed check is an address they will assume is gone. */}
          <Inbox inbox={state.inbox} onCheck={checkInbox} />
          <button type="button" onClick={replace}>
            Replace address
          </button>
        </section>
      )}

      {state.kind === "failed" && <MailboxFailure failure={state.failure} onRetry={retry} />}

      <section aria-labelledby="limits-heading">
        <h2 id="limits-heading">What this page can and cannot do</h2>
        <ul>
          <li>It reaches Guerrilla Mail and nothing else.</li>
          <li>It lists what is in the address, and marks mail that carries a code or a link.</li>
          <li>It cannot open a message yet, so a message body is not shown here.</li>
          <li>A reload discards this address. SpectreMail stores nothing on your device yet.</li>
          <li>
            No server is involved. SpectreMail operates no backend and never relays a provider
            request.
          </li>
        </ul>
      </section>
    </main>
  );
}
