/**
 * Website client root — a reconstruction of temp-mail.org's working surface.
 *
 * The page is deliberately small: a dark header, a dark hero holding a compact
 * dashed panel with the address, a light four-action strip, and a light inbox with
 * a dark table header. Everything that used to explain the product below the inbox
 * is gone. All session, provider, clipboard and storage behaviour is preserved
 * behind those four surfaces.
 *
 * Every state still has its own words rather than relying on colour, so a state is
 * never signalled only by how the page looks.
 *
 * @module
 */

import { useCallback, useState } from "react";

import { createMailboxSession } from "@spectre-mail/mailbox";
import type { MailboxSession, OpenedMessageState } from "@spectre-mail/mailbox";

import { ActionToolbar } from "./ActionToolbar";
import { Address } from "./Address";
import type { CopyState } from "./Address";
import { AppHeader } from "./AppHeader";
import { BootFailure } from "./BootFailure";
import { Inbox } from "./Inbox";
import { MailboxFailure } from "./MailboxFailure";
import { MessageView } from "./MessageView";
import { StoredAddressGone } from "./StoredAddressGone";
import { StoredAddressUnchecked } from "./StoredAddressUnchecked";
import { copyAddressToClipboard } from "./clipboard";
import { createWebsiteProviderManager } from "./provider-config";
import { webScheduler } from "./scheduler";
import { useInboxVisibility } from "./useInboxVisibility";
import { useMailboxSession } from "./useMailboxSession";
import { useWebsiteStorage } from "./storage";
import type { WebsiteStorage } from "./storage";

/** The id of whatever is open, or `null` when nothing is. */
function openedMessageId(opened: OpenedMessageState): string | null {
  return opened.kind === "opening" || opened.kind === "openFailed" ? opened.messageId : null;
}

export interface AppProps {
  /** An injected session, so a test can drive the page without a network. */
  readonly session?: MailboxSession;
  /** An injected storage, or the reason there is none. */
  readonly storage?: WebsiteStorage;
  /** Retained for existing test callers; the reconstructed page renders no mailbox list. */
  readonly mailboxes?: import("./storage").WebsiteMailboxes;
}

export function App({ session, storage }: AppProps = {}) {
  const [ownSession] = useState(() =>
    createMailboxSession(createWebsiteProviderManager(), webScheduler),
  );
  // Called unconditionally — a hook whose call order depends on props is the bug
  // React's rules exist to prevent, and the builder never throws.
  const ownStorage = useWebsiteStorage();
  const active = session ?? ownSession;
  const store = storage ?? ownStorage;

  const {
    state,
    boot,
    saving,
    clearStored,
    retryBoot,
    startFresh,
    retry,
    replace,
    checkInbox,
    openMessage,
    closeMessage,
  } = useMailboxSession(active, store);

  useInboxVisibility(active);

  /** The one clipboard write, shared by the in-field and toolbar Copy controls. */
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const copy = useCallback(() => {
    if (state.kind !== "ready") return;
    void copyAddressToClipboard(state.mailbox.address).then((ok) =>
      setCopyState(ok ? "copied" : "failed"),
    );
  }, [state]);

  const loadingText =
    state.kind === "idle"
      ? "Checking what this device has stored."
      : state.kind === "creating"
        ? "Asking the provider for a new address."
        : state.kind === "adopting"
          ? "Checking the saved address."
          : "Loading..";
  const loadingTestId =
    state.kind === "idle" || state.kind === "creating" || state.kind === "adopting"
      ? state.kind
      : undefined;

  return (
    <main className="page">
      <AppHeader />

      <section className="hero" aria-labelledby="hero-heading">
        <div className="hero__panel">
          <h2 className="hero__title" id="hero-heading">
            Your Temporary Email Address
          </h2>
          <div className="hero__field">
            {boot.kind !== "blocked" && state.kind === "ready" ? (
              <div className="hero__address" data-testid="ready">
                <Address mailbox={state.mailbox} onCopy={copy} copyState={copyState} />
                {saving.kind === "notSaved" && (
                  <p className="notice notice--danger" data-testid="save-failed">
                    This address could not be saved to this device. {saving.reason}
                  </p>
                )}
              </div>
            ) : (
              <p className="hero__loading" data-testid={loadingTestId}>
                {loadingText}
              </p>
            )}
          </div>
        </div>
        <p className="hero__lede">
          Forget about spam, advertising mailings, hacking and attacking robots. Keep your real
          mailbox clean and secure. SpectreMail gives you a temporary, disposable email address.
        </p>

        {boot.kind === "blocked" && <BootFailure reason={boot.reason} onRetry={retryBoot} />}
        {boot.kind !== "blocked" && state.kind === "expired" && (
          <StoredAddressGone mailbox={state.mailbox} onRetry={startFresh} onReplace={startFresh} />
        )}
        {boot.kind !== "blocked" && state.kind === "restoreFailed" && (
          <StoredAddressUnchecked
            mailbox={state.mailbox}
            failure={state.failure}
            onRetry={retry}
            onStartFresh={startFresh}
          />
        )}
        {boot.kind !== "blocked" && state.kind === "failed" && (
          <MailboxFailure failure={state.failure} onRetry={retry} />
        )}
      </section>

      <ActionToolbar
        onCopy={copy}
        onRefresh={checkInbox}
        onChange={replace}
        onDelete={clearStored}
      />

      <section className="inbox-section" aria-label="Inbox">
        <div className="inbox-panel">
          {boot.kind !== "blocked" && state.kind === "ready" && (
            <>
              <Inbox inbox={state.inbox} onCheck={checkInbox} onOpenMessage={openMessage} />
              {state.opened.kind !== "none" && (
                <MessageView
                  opened={state.opened}
                  onClose={closeMessage}
                  onRetry={() => {
                    const id = openedMessageId(state.opened);
                    if (id !== null) openMessage(id);
                  }}
                />
              )}
            </>
          )}
        </div>
      </section>
    </main>
  );
}
