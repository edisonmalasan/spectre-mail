/**
 * The popup.
 *
 * ## What this milestone's popup does, and what it deliberately does not
 *
 * The roadmap's first-extension-milestone list is: create mailbox, copy address, view
 * provider, view status, basic inbox count. All five are here, and **one of them is
 * smaller than the roadmap's wording suggests**: the inbox count comes from an explicit
 * check the user asked for, because per `design.md` D1 no background context is polling.
 *
 * That is a real reduction and it is stated rather than dressed up. What it costs is that
 * the count is not live; what it buys is that nothing in this client depends on a service
 * worker's lifetime nobody in this repository has measured.
 *
 * ## Every mailbox operation goes through the shared session
 *
 * There is no provider call, no parsing, and no lifecycle logic in this file. The popup
 * renders what `packages/mailbox` reports, which is what makes this milestone's claim — a
 * second client over the same packages — testable rather than aspirational.
 *
 * ## No provider selector
 *
 * This client reaches two providers, so a selector becomes meaningful here in a way it is
 * not on the website. It is still not offered, and the reason is about what the control
 * would *do* rather than what it would *say*: at this milestone choosing is not a user
 * action, it is a disclosure. The popup names the provider it will reach, and after a
 * mailbox exists it names the one that **actually served it** — which is the claim that
 * matters, because a fallback presented as the primary would tell the user their mail
 * lives somewhere it does not.
 *
 * @module
 */

import { useCallback, useEffect, useState } from "react";

import type { Mailbox } from "@spectre-mail/core";
import { holdsMailbox } from "@spectre-mail/mailbox";
import type {
  InboxState,
  MailboxSession,
  ProviderHealth,
  SessionState,
} from "@spectre-mail/mailbox";

import { POPUP_COPY } from "./popup-copy";

/** What the popup's copy control has done so far. */
export type CopyState = "idle" | "copied" | "failed";

/** The slice of `SpectreStorage` this component uses. */
export interface PopupStorage {
  loadMailbox(): Promise<Mailbox | null>;
  saveMailbox(mailbox: Mailbox): Promise<void>;
}

export interface PopupProps {
  /**
   * The session to render.
   *
   * Injected rather than built here, so a test can hand over a session over a recording
   * transport and this file contains no provider wiring at all.
   */
  readonly session: MailboxSession;
  /** Where the popup persists its mailbox. */
  readonly storage: PopupStorage;
  /** The provider this client reaches first, named before any mailbox exists. */
  readonly primaryProviderName: string;
  /**
   * Told when the boot read has finished, and whether it found a mailbox.
   *
   * **`blocked` is a separate signal from `null`**, because `SpectreStorage` reserves
   * `null` for "nothing stored" and rejects for "could not read". Collapsing them would
   * tell a user who came back for their address that they had none — and then offer to
   * make a new one, overwriting the one they came back for.
   */
  readonly onBooted?: (stored: Mailbox | null, blocked: boolean) => void;
}

/**
 * **The popup's copy lives in `popup-copy.ts`, and that is a change of address rather than of
 * content.** It was declared here, module-private, and a constant no other module can read is
 * one the website's `Extension preview` region cannot derive its depiction from — so the
 * website would have hand-copied the strings below and a rename here would have left the page
 * describing a popup that no longer exists. See that module's own note for the assertion that
 * now guards it.
 */
const COPY = POPUP_COPY;

export function Popup({ session, storage, primaryProviderName, onBooted }: PopupProps) {
  const [state, setState] = useState<SessionState>(() => session.current());
  const [copy, setCopy] = useState<CopyState>("idle");
  const [health, setHealth] = useState<ProviderHealth | null>(null);
  const [boot, setBoot] = useState<{ readonly done: boolean; readonly blocked: boolean }>({
    done: false,
    blocked: false,
  });

  useEffect(() => session.subscribe(setState), [session]);

  useEffect(() => {
    if (boot.done) return;

    void (async () => {
      try {
        const stored = await storage.loadMailbox();
        // **`restore` only when there is something to restore.** Handing it `null`
        // delegates to `open()`, which would create a mailbox during boot — so a popup
        // that simply opened would manufacture an address the user never asked for, on
        // every visit, before they had pressed anything.
        if (stored !== null) {
          await session.restore(stored);
        }
        setBoot({ done: true, blocked: false });
        onBooted?.(stored, false);
      } catch {
        // **Reported, not treated as absence.** See `onBooted`'s note.
        setBoot({ done: true, blocked: true });
        onBooted?.(null, true);
      }
    })();
  }, [boot.done, onBooted, session, storage]);

  const mailbox = holdsMailbox(state) ? state.mailbox : null;

  const create = useCallback(async () => {
    const next = await session.open();
    if (holdsMailbox(next)) {
      // **Persisted only after the provider confirms it.** `docs/PROVIDERS.md` records
      // an unrecognised Guerrilla session answering `HTTP 200` with an empty inbox, so
      // "nothing has arrived" and "this address is gone" are the same response — a
      // mailbox stored before the provider confirmed it would be offered back as though
      // it worked.
      await storage.saveMailbox(next.mailbox);
    }
  }, [session, storage]);

  const copyAddress = useCallback(async () => {
    if (mailbox === null) return;
    try {
      await navigator.clipboard.writeText(mailbox.address);
      setCopy("copied");
    } catch {
      // Swallowed and reported as state, for the reason `apps/web`'s `Address` gives:
      // the clipboard rejects for ordinary reasons, and an escaping rejection leaves a
      // button that looks like it worked and an address the user never received. The
      // address stays on screen either way, because selecting it by hand is a complete
      // answer to the same need.
      setCopy("failed");
    }
  }, [mailbox]);

  if (!boot.done) {
    return (
      <main className="popup" aria-busy="true">
        <h1 className="popup__heading">SpectreMail</h1>
        <p>{COPY.booting}</p>
      </main>
    );
  }

  if (boot.blocked) {
    // **No create action at all in this state**, rather than a disabled one. A button
    // that cannot act is a control misreporting the choice as unavailable, which is the
    // same reasoning `website-client` uses to forbid the website's provider selector.
    return (
      <main className="popup">
        <h1 className="popup__heading">SpectreMail</h1>
        <p role="alert">{COPY.bootFailed}</p>
      </main>
    );
  }

  return (
    <main className="popup">
      <h1 className="popup__heading">SpectreMail</h1>

      {mailbox === null ? (
        <section aria-labelledby="create-heading">
          <h2 id="create-heading">{COPY.reaching.replace("{provider}", primaryProviderName)}</h2>
          <button type="button" className="control control--primary" onClick={() => void create()}>
            {state.kind === "creating" ? COPY.creating : COPY.create}
          </button>
        </section>
      ) : (
        <>
          <section aria-labelledby="address-heading">
            <h2 id="address-heading">{mailbox.provider}</h2>
            <p className="popup__address">{mailbox.address}</p>
            <button type="button" className="control" onClick={() => void copyAddress()}>
              {COPY.copy}
            </button>
            {copy === "copied" && <p role="status">{COPY.copied}</p>}
            {copy === "failed" && <p role="status">{COPY.copyFailed}</p>}
          </section>

          <section aria-labelledby="status-heading">
            <h2 id="status-heading">{COPY.status}</h2>
            <p data-testid="status">
              {health === null
                ? COPY.unknown
                : `${health.provider}: ${health.status}${
                    health.rateLimit === undefined ? "" : ` (${health.rateLimit})`
                  }`}
            </p>
            <button
              type="button"
              className="control"
              onClick={() => void session.health().then(setHealth)}
            >
              {COPY.askStatus}
            </button>
          </section>

          <section aria-labelledby="inbox-heading">
            <h2 id="inbox-heading">{COPY.inbox}</h2>
            <InboxCount
              state={state.kind === "ready" ? state.inbox : { kind: "notStarted" }}
              expired={state.kind === "expired"}
            />
            <button
              type="button"
              className="control"
              onClick={() => void session.checkInbox()}
              disabled={mailbox === null}
            >
              {COPY.check}
            </button>
          </section>
        </>
      )}
    </main>
  );
}

/**
 * The inbox count, from whatever the session already knows.
 *
 * **Never a request of its own.** The count is what the last check produced, so the popup
 * reports the session's state rather than asking the provider again — the same reason
 * the website's inbox retains a verdict the session already computed.
 *
 * `expired` is passed separately because an `expired` mailbox's state carries **no inbox
 * at all** — by design, so that rendering "no messages" for an address that cannot
 * receive any is unrepresentable rather than merely avoided.
 */
function InboxCount({ state, expired }: { readonly state: InboxState; readonly expired: boolean }) {
  if (expired) return <p>{COPY.expired}</p>;

  switch (state.kind) {
    case "checked": {
      const count = state.listing.messages.length;
      return <p>{count === 0 ? COPY.empty : COPY.count(count)}</p>;
    }
    case "checking":
      return <p>{COPY.checking}</p>;
    case "checkFailed":
      // **The last known listing, kept.** A failed check is a condition of the inbox,
      // not the loss of it — the same reason `checking` retains its listing.
      return <p>{COPY.checkFailed(state.listing.messages.length)}</p>;
    case "notStarted":
      return <p>{COPY.empty}</p>;
  }
}
