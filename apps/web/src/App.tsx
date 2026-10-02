/**
 * Website client root component.
 *
 * ## What this milestone is, and is not
 *
 * M5 slice 1 gives the page its first real behaviour: it creates a mailbox through
 * the provider abstraction and renders the address. This is **structure, not
 * design** — there is no stylesheet, no design token, and no layout system here, and
 * that is deliberate. The visual milestone owns those, and building them now would
 * produce markup it rewrites. The approved design skills are not applied at this
 * milestone.
 *
 * The page states only what is true:
 *
 * - It reaches **one** provider, for the measured CORS reason recorded in
 *   `provider-config.ts`. It does not claim redundancy it does not have, and it
 *   offers no provider selector, because a selector offering only one reachable
 *   provider is a control that cannot do anything.
 * - It has **no inbox** yet. The page does not pretend otherwise, and does not show
 *   a message list.
 * - **A reload discards the mailbox.** Nothing is persisted; that is M6.
 * - No backend is involved, and SpectreMail never proxies a provider API.
 *
 * ## Each state is distinct in words, not in colour
 *
 * `creating`, `ready`, and `failed` each render their own heading and their own
 * prose. No state is signalled by styling alone, so nothing here depends on colour
 * being perceived or a stylesheet having loaded.
 *
 * @module
 */

import { createMailboxSession } from "@spectre-mail/mailbox";
import type { MailboxSession } from "@spectre-mail/mailbox";

import { Address } from "./Address";
import { MailboxFailure } from "./MailboxFailure";
import { MailboxLifetime } from "./MailboxLifetime";
import { createWebsiteProviderManager } from "./provider-config";
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
  const active = session ?? createMailboxSession(createWebsiteProviderManager());
  const { state, retry, replace } = useMailboxSession(active);

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
          <li>There is no inbox on this page yet, so no message can be read here.</li>
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
