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

import type { Mailbox, MessageSummary } from "@spectre-mail/core";
import { holdsMailbox } from "@spectre-mail/mailbox";
import type {
  InboxState,
  MailboxSession,
  OpenedMessageState,
  ProviderHealth,
  SessionState,
} from "@spectre-mail/mailbox";

import { findActiveTab, sendToTab } from "./extension-platform";
import { fillCodeRequest, readFillCodeAnswer } from "./protocol";
import type { FillCodeAnswer } from "./protocol";
import { POPUP_COPY } from "./popup-copy";

/** What the popup's copy control has done so far. */
export type CopyState = "idle" | "copied" | "failed";

/**
 * What the last delivery attempt has to report, and why this is one union rather than a string.
 *
 * **Every sentence this popup can say about a delivery is a claim about somebody else's page, and
 * one of them — `filled` — is the only one that claims anything happened.** The rest are refusals,
 * and `extension-client` requires the popup to report that it *could not confirm* rather than to
 * infer an outcome. A `string | null` would make that distinction a matter of which words were
 * chosen at the call site; the union makes it a matter of which fact was observed.
 *
 * **`unconfirmed` is separate from `noTab` on purpose.** Neither confirms anything and both report
 * the same way in the only respect that matters — nothing is claimed about the page — but the two
 * are different faults, and this popup is the only place a person can learn which one happened.
 */
export type FillReport =
  | { readonly kind: "idle" }
  | { readonly kind: "sending" }
  | { readonly kind: "noTab" }
  | { readonly kind: "unconfirmed" }
  | { readonly kind: "answered"; readonly answer: FillCodeAnswer };

/**
 * The slice of this client's storage this component uses.
 *
 * **`addMailbox` rather than `saveMailbox`,** because this device holds several mailboxes and every
 * reader in this client now consults the collection. A write to the singular record would leave the
 * popup showing one address while the in-page control offered another.
 */
export interface PopupStorage {
  /** The mailbox this device would insert today, or `null` when it holds none. */
  loadMailbox(): Promise<Mailbox | null>;
  addMailbox(mailbox: Mailbox): Promise<void>;
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
  const [fill, setFill] = useState<FillReport>({ kind: "idle" });
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

  /**
   * What is open, or `null` where the session's state carries no notion of an open message.
   *
   * **`failed` is the one variant without one**, and it is a variant that only exists when there is
   * no mailbox — so the two facts the render needs are the same fact. Reading `state.opened`
   * directly would be a property access the compiler reports as absent on one variant of seven,
   * which is exactly the kind of thing that gets `as`-ed away.
   */
  const opened = "opened" in state ? state.opened : null;

  const create = useCallback(async () => {
    const next = await session.open();
    if (holdsMailbox(next)) {
      // **Persisted only after the provider confirms it.** `docs/PROVIDERS.md` records
      // an unrecognised Guerrilla session answering `HTTP 200` with an empty inbox, so
      // "nothing has arrived" and "this address is gone" are the same response — a
      // mailbox stored before the provider confirmed it would be offered back as though
      // it worked.
      await storage.addMailbox(next.mailbox);
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

  /**
   * Hand `code` to the page this extension is looking at, and report what it answered.
   *
   * **Three facts, in this order, and each one is the reason the next is not reached.** Which tab,
   * then whether that page confirmed anything. **A tab that cannot be named is never replaced by
   * "some tab"** — `design.md` D1 measured what sending to every tab id does, and it is a delivery
   * to every page the user has open rather than a delivery.
   *
   * **The popup does not know what the page did, and does not guess.** It reads the answer through
   * `protocol.ts` and reports the variant it was given; `no answer at all` becomes *could not
   * confirm*, because a page that sent nothing has confirmed nothing and this popup is the only
   * place the claim could have been made.
   */
  const fillInto = useCallback(async (code: string) => {
    setFill({ kind: "sending" });

    const tabId = await findActiveTab();

    if (tabId === null) {
      setFill({ kind: "noTab" });
      return;
    }

    const answer = readFillCodeAnswer(await sendToTab(tabId, fillCodeRequest(code)));

    setFill(answer === null ? { kind: "unconfirmed" } : { kind: "answered", answer });
  }, []);

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
            {mailbox !== null && (
              <MessageList
                state={state.kind === "ready" ? state.inbox : { kind: "notStarted" }}
                onOpen={(id) => void session.openMessage(id)}
              />
            )}
          </section>

          {mailbox !== null && opened !== null && opened.kind !== "none" && (
            <section aria-labelledby="message-heading">
              <h2 id="message-heading">{COPY.messages}</h2>
              <OpenedMessageView
                opened={opened}
                onClose={() => session.closeMessage()}
                fill={fill}
                onFill={(code) => void fillInto(code)}
              />
            </section>
          )}
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

/**
 * The listed messages, each of which can be opened.
 *
 * ## Why the listing shows no marker at all, and that is the requirement
 *
 * **`MessageSummary` carries no codes and no links, on purpose** — `packages/core` says listing a
 * mailbox must not require fetching bodies. So a row *cannot* say a message carries a verification,
 * and `extension-client` forbids the popup from indicating that one does. **Rendering the sender
 * and the subject and nothing else is the whole of what a listing can honestly show**, and a marker
 * here would be a guess about a message nobody has read.
 *
 * ## Why opening goes through the session rather than fetching anything
 *
 * **`packages/mailbox` owns the opened message**, including whether this session already analysed
 * it, and it retains that analysis so a second visit costs no provider request. A popup that fetched
 * a body itself would spend a request per message to recompute an answer already in hand.
 */
function MessageList({
  state,
  onOpen,
}: {
  readonly state: InboxState;
  readonly onOpen: (messageId: string) => void;
}) {
  if (state.kind !== "checked" && state.kind !== "checkFailed") {
    return null;
  }

  return (
    <ul aria-label={COPY.messages} data-testid="message-list">
      {state.listing.messages.map((message) => (
        <li key={message.id}>
          <span className="message__from">{describeSender(message)}</span>
          <span className="message__subject">{message.subject}</span>
          <button
            type="button"
            className="control"
            onClick={() => {
              onOpen(message.id);
            }}
          >
            {COPY.openMessage}
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * What to show as the sender, in that order.
 *
 * **A display name when the provider gave one, the address otherwise, and the provider's own
 * absence when it gave neither.** A blank sender is allowed by the model — the field is required
 * and may be empty — so the fallback is a sentence rather than nothing: a row with an empty line
 * where the sender goes reads as a rendering fault rather than as a message from nowhere.
 */
function describeSender(message: MessageSummary): string {
  const name = message.fromName ?? "";
  if (name.length > 0) {
    return name;
  }

  return message.from.length > 0 ? message.from : COPY.unnamedSender;
}

/**
 * The opened message, its codes, and the control that puts a code into the open page.
 *
 * ## Why every code gets its own control
 *
 * **The parser never reports a detection as certain**, and its ranking is exactly that — so a
 * control offered only for the top-ranked code would act on a guess about which of several was
 * real. One control per code is the same decision `website-client` reaches for the same reason, and
 * it costs nothing here because the codes are already ranked and already visible.
 */
function OpenedMessageView({
  opened,
  onClose,
  fill,
  onFill,
}: {
  readonly opened: OpenedMessageState;
  readonly onClose: () => void;
  readonly fill: FillReport;
  readonly onFill: (code: string) => void;
}) {
  return (
    <>
      {opened.kind === "opening" && <p>{COPY.reading}</p>}
      {opened.kind === "openFailed" && <p role="alert">{COPY.readFailed}</p>}
      {opened.kind === "opened" && (
        <Codes codes={opened.message.codes} fill={fill} onFill={onFill} />
      )}
      <button type="button" className="control" onClick={onClose}>
        {COPY.closeMessage}
      </button>
    </>
  );
}

/** The codes found in the message the user opened, each with its own delivery control. */
function Codes({
  codes,
  fill,
  onFill,
}: {
  readonly codes: readonly { readonly value: string }[];
  readonly fill: FillReport;
  readonly onFill: (code: string) => void;
}) {
  if (codes.length === 0) {
    return <p>{COPY.noCodes}</p>;
  }

  return (
    <>
      <h3>{COPY.codes}</h3>
      <ul aria-label={COPY.codes} data-testid="code-list">
        {codes.map((code) => (
          <li key={code.value}>
            <code>{code.value}</code>
            <button
              type="button"
              className="control"
              disabled={fill.kind === "sending"}
              onClick={() => {
                onFill(code.value);
              }}
            >
              {COPY.fillCode.replace("{code}", code.value)}
            </button>
          </li>
        ))}
      </ul>
      <p role="status">{fillSentence(fill)}</p>
    </>
  );
}

/**
 * The one sentence a delivery report may become, and the reason most of them are refusals.
 *
 * **`filled` is the only branch that claims the page now holds the code.** Every other outcome —
 * including a page that answered, and every one of those answers is a fact about somebody else's
 * document — says what did not happen rather than what did. `notActedOn` reports as *could not
 * confirm* because that is exactly what it means: the content script received a request and declined
 * it, which is not a page confirming anything.
 */
function fillSentence(report: FillReport): string {
  if (report.kind !== "answered") {
    switch (report.kind) {
      case "idle":
        return "";
      case "sending":
        return COPY.filling;
      case "noTab":
        return COPY.fillNoTab;
      case "unconfirmed":
        return COPY.fillUnconfirmed;
    }
  }

  switch (report.answer.kind) {
    case "filled":
      return COPY.fillFilled;
    case "asked":
      return COPY.fillAsked;
    case "noField":
      return COPY.fillNoField;
    case "fieldHoldsText":
      return COPY.fillFieldHoldsText;
    case "notTopFrame":
      return COPY.fillNotTopFrame;
    case "notActedOn":
      return COPY.fillUnconfirmed;
  }
}
