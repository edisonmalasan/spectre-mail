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
 * ## Why the heading renders a value in all three of its branches
 *
 * **This component used to spell the product's public name as a bare literal three times**, one
 * per return branch, ten lines from a `popup-copy.ts` that already exists. It now renders the one
 * value `@spectre-mail/ui` exports as `PRODUCT_NAME` in all three - **three references is the
 * measurement, one is the claim**: a fourth branch added tomorrow and left alone is reported by name
 * rather than counted. `main.tsx` owns a fourth heading, in the storage-not-ready branch this
 * component does not have, and it renders the same value; both are declared in the surface table
 * `docs/BRANDING.md` carries, and `tests/architecture/branding-audit.test.ts` resolves that table
 * against the tree in both directions.
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
import { PRODUCT_NAME } from "@spectre-mail/ui/name";

import { findActiveTab, sendToTab } from "./extension-platform";
import { fillCodeRequest, readFillCodeAnswer } from "./protocol";
import {
  diagnosticReport,
  emptyInPageAnswers,
  EXTENSION_DIAGNOSTIC_LABELS,
  observeInPageAnswer,
  type InPageAnswers,
} from "./diagnostic";
import { PopupDiagnostic } from "./PopupDiagnostic";
import { useSessionDiagnostic } from "./useSessionDiagnostic";
import { MessageList, OpenedMessageView } from "./MessageSurface";
import type { CopyState, FillReport } from "./MessageSurface";
import { POPUP_COPY } from "./popup-copy";

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
  /**
   * Asked to arm the background schedule once this component has stored a mailbox of its own.
   *
   * **Required rather than optional, and the reason is a browser case.** This popup creates a mailbox
   * in its own context — it is not the delegated path the worker arms on — so a composition that
   * omitted this prop would silently ship a device that is told about nothing until the next browser
   * start. An optional seam would make that state reachable by forgetting an argument, and a
   * requirement that is only met when someone remembers is not a requirement.
   *
   * **Returns whatever the background context answered, and this component reads none of it.** The
   * arming is a side effect that follows a write that has already succeeded; making the create
   * control wait on it, or report it, would put a schedule into the answer of a request about a
   * mailbox. The value is returned rather than dropped at the call site so the signature can say what
   * it is without this component having to know that nothing reads it.
   */
  readonly requestBackgroundAlarm: () => Promise<unknown>;
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

export function Popup({
  session,
  storage,
  primaryProviderName,
  onBooted,
  requestBackgroundAlarm,
}: PopupProps) {
  const [state, setState] = useState<SessionState>(() => session.current());
  const [copy, setCopy] = useState<CopyState>("idle");
  const [health, setHealth] = useState<ProviderHealth | null>(null);
  const [fill, setFill] = useState<FillReport>({ kind: "idle" });

  /**
   * The in-page answers this session has seen, counted.
   *
   * **A ref, and not state, because the count is read on demand and nothing re-renders for
   * it** -- and because a count that re-rendered the popup on every answer would be a count
   * that moved the control the person was about to press.
   *
   * **The answers are counted where they happen**, which is this popup: it is the surface that
   * asks the page to fill a field, so it is the surface that is told what the page answered.
   */
  const [inPageAnswers, setInPageAnswers] = useState<InPageAnswers>(emptyInPageAnswers);
  /**
   * The session's own report, counted as the session goes.
   *
   * **Called here, beside the popup's other state, and not further down** -- the popup has
   * early returns, and a hook called after one has a call order that depends on the props.
   * That is this file's own rule, and it is the reason the storage and the session above are
   * unconditional too.
   */
  const diagnostic = useSessionDiagnostic(state);

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
      /**
       * **And the schedule is asked for here, after the write, and this line is the whole of a
       * defect a browser case found.**
       *
       * The background worker's alarm is reconciled wherever a mailbox is written. **This component
       * writes one itself**, so before this line existed the device that had just created an address
       * through the popup — the path a person takes — was left with **no alarm at all** until the next
       * browser start, and `e2e/background-check.spec.ts` reads exactly that from the platform.
       *
       * **Awaited, and nothing is done with the answer.** Awaiting is what keeps a refused channel
       * from becoming an unhandled rejection; the reply is unread because arming is a side effect that
       * follows a write which has already succeeded, and a create control that reported a schedule
       * failure would be reporting something the person cannot act on. `sendToBackground` resolves
       * `undefined` rather than rejecting, so there is no error here to swallow.
       */
      await requestBackgroundAlarm();
    }
  }, [requestBackgroundAlarm, session, storage]);

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

    // **The answer is counted, and the answer is the whole of what happened.** The page is not
    // read, the field is not named, and nothing about the document is kept -- the recogniser
    // already answered in a closed vocabulary that says what it did and why.
    setInPageAnswers((previous) =>
      answer === null
        ? observeInPageAnswer(previous, "unconfirmed")
        : observeInPageAnswer(previous, answer.kind),
    );
  }, []);

  if (!boot.done) {
    return (
      <main className="popup" aria-busy="true">
        <h1 className="popup__heading">{PRODUCT_NAME}</h1>
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
        <h1 className="popup__heading">{PRODUCT_NAME}</h1>
        <p role="alert">{COPY.bootFailed}</p>
      </main>
    );
  }

  return (
    <main className="popup">
      <h1 className="popup__heading">{PRODUCT_NAME}</h1>

      {/* **The report of what this session did, and it renders in every state.**
       * The popup has an address on screen a few lines below it, and **a report that could
       * not hold an address cannot leak one** -- so the report's shape is the claim, and the
       * claim is beside the thing it is about.
       *
       * **The in-page answers are counted here**, in the surface that is told them, and
       * reported here for the same reason. **It holds counts, normalized outcomes and one
       * elapsed duration, and nothing else.** */}
      <PopupDiagnostic
        entries={diagnosticReport(diagnostic, inPageAnswers, EXTENSION_DIAGNOSTIC_LABELS).entries}
      />

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
