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

import { useCallback, useEffect, useState } from "react";

import type { Domain } from "@spectre-mail/core";
import { createDomainCatalog } from "@spectre-mail/providers";
import { createMailboxSession } from "@spectre-mail/mailbox";
import type { MailboxSession, OpenedMessageState } from "@spectre-mail/mailbox";

import { ActionToolbar } from "./ActionToolbar";
import { ArticlesSection, ExplainerSection, ReferenceSection } from "./PageSections";
import { PublicFooter } from "./PublicFooter";
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
    getNewAddress,
    retry,
    replace,
    checkInbox,
    openMessage,
    closeMessage,
    changing,
  } = useMailboxSession(active, store);

  useInboxVisibility(active);

  /**
   * Domains come only from a provider's own listDomains() answer. The website's
   * only browser-reachable provider (Guerrilla Mail) exposes none, so the list is
   * honestly empty here; the catalog is shared with the extension, where Mail.tm
   * can enumerate its real domains.
   */
  const [domains, setDomains] = useState<readonly Domain[]>([]);
  useEffect(() => {
    let cancelled = false;
    const catalogs = active.providers.map((provider) => createDomainCatalog(provider));
    void Promise.all(catalogs.map((catalog) => catalog.listDomains())).then((lists) => {
      if (!cancelled) setDomains(lists.flat());
    });
    return () => {
      cancelled = true;
    };
  }, [active]);

  /**
   * Clipboard feedback lives in one fixed toast, never inside the address field.
   * It auto-dismisses and is cleared when the mailbox changes, so a stale "Copied"
   * can never describe a different address.
   */
  const [feedback, setFeedback] = useState<{
    readonly seq: number;
    readonly ok: boolean;
    readonly mailboxId: string;
  } | null>(null);
  const currentMailboxId = state.kind === "ready" ? state.mailbox.id : null;
  // Deriving the visible state from the mailbox id means a stale toast cannot
  // describe a different address after a Change, with no state reset needed.
  const copyState: CopyState =
    feedback !== null && feedback.mailboxId === currentMailboxId
      ? feedback.ok
        ? "copied"
        : "failed"
      : "idle";
  const copy = useCallback(() => {
    if (state.kind !== "ready") return;
    const mailboxId = state.mailbox.id;
    void copyAddressToClipboard(state.mailbox.address).then((ok) =>
      // A sequence, not a state string, so a second copy restarts the timer.
      setFeedback((previous) => ({ seq: (previous?.seq ?? 0) + 1, ok, mailboxId })),
    );
  }, [state]);

  useEffect(() => {
    if (feedback === null) return;
    const timer = window.setTimeout(() => setFeedback(null), 2200);
    return () => window.clearTimeout(timer);
  }, [feedback?.seq]);

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
  const hiddenListClass = "inbox-panel__list--hidden";
  // Failure states carry no opened field, so read it through the same narrowing the
  // render below uses rather than assuming a shape the union does not guarantee.
  const readerIsOpen = "opened" in state && state.opened.kind !== "none";

  return (
    <>
      <main className="page">
        <AppHeader />

        <section className="hero" data-region="product" aria-labelledby="hero-heading">
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
            <StoredAddressGone
              mailbox={state.mailbox}
              onRetry={retryBoot}
              onReplace={getNewAddress}
            />
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
          onChange={(domain) => replace(domain)}
          onDelete={clearStored}
          changing={changing ?? false}
          domains={domains}
        />

        <section className="inbox-section" aria-label="Inbox">
          <div className="inbox-panel">
            {boot.kind !== "blocked" && state.kind === "ready" && (
              <>
                {/*
                 * Keep the inbox mounted while the reader is open: hiding it with an
                 * attribute preserves row identity across Back, so returning does not
                 * re-run every row's materialisation entrance. The reader is shown above
                 * it and the hidden inbox exposes no operable element.
                 */}
                <div className={readerIsOpen ? hiddenListClass : undefined}>
                  <Inbox inbox={state.inbox} onCheck={checkInbox} onOpenMessage={openMessage} />
                </div>
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

        {/*
         * One fixed live region for clipboard outcomes. It is outside every field,
         * so announcing a copy cannot resize the address or the toolbar. It clears
         * itself after a short delay and is announced by assistive technology.
         */}
        {/* The live region is always in the DOM so assistive tech registers it before
          its text changes; mutating the text is what gets announced. */}
        <p className="toast" role="status" data-testid="copy-feedback">
          {copyState === "copied"
            ? "Copied"
            : copyState === "failed"
              ? "Clipboard refused — select the address to copy it"
              : ""}
        </p>
      </main>

      {/* M16's below-fold information regions, in the declared PAGE_ORDER after the product.
          They are outside <main> only for the footer landmark; the three info sections are
          inside it and are read by data-region. */}
      <ExplainerSection />
      <ArticlesSection />
      <ReferenceSection address={state.kind === "ready" ? state.mailbox.address : null} />
      <PublicFooter />
    </>
  );
}
