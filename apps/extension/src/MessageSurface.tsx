/**
 * The message surface: the listing, the opened message, and the codes inside it.
 *
 * ## Why this is a module and not a copy, and that is `design.md` D2
 *
 * **`Popup.tsx` held these four components module-private, and the panel needs them identically.**
 * The alternative — the panel writing its own list — was rejected on a defect this repository has
 * already paid for: **the code controls carry a decision table** (`in-page-fill`'s requirements: not
 * the top frame, a field that already holds text, exactly one empty candidate versus several put to
 * the person, prefer but never act). **Two implementations of a decision table drift, and the drift
 * is invisible in a diff because each copy is locally correct.** The same reasoning put
 * `CHANGED_DELIVERABLES` in one place rather than two, and put `protocol.ts` in a module neither
 * context imports.
 *
 * ## This is a move, and the count in `tasks.md` 9.4 is what says so
 *
 * **Nothing here was rewritten.** Every string, every class hook and every branch below is what
 * `Popup.tsx` rendered before, and `Popup.tsx` still renders exactly what it rendered — the
 * stylesheet-coverage boundary rule is the instrument that catches a hook dropped in the move, and
 * `Popup.test.tsx` is the instrument that catches a behaviour changed by it.
 *
 * ## The copy is the popup's own, and that is deliberate rather than an oversight
 *
 * **`POPUP_COPY`, not `PANEL_COPY`,** because these are the *message surface*'s words and this
 * change did not alter any of them: the panel shows the same listing, the same codes and the same
 * delivery reports because they are the same facts about the same mailbox. `design.md` D9 gives
 * `panel-copy.ts` the panel's **own** claims - the host, the inability to name it, a failed
 * provider, a mailbox that is gone, and the per-message verdict marking, which is panel-only
 * because the popup is forbidden from stating it - and those are panel-specific sentences that
 * exist nowhere else. Renaming `POPUP_COPY` was not an option either way: `apps/web`'s `Extension
 * preview` region resolves every label it declares against that constant by name, and `D9` commits
 * `apps/web` to **125 tests** and no change at all.
 *
 * @module
 */

import type { MessageSummary, VerificationLink } from "@spectre-mail/core";
import { verdictFor } from "@spectre-mail/mailbox";
import type { InboxState, MessageVerdict, OpenedMessageState } from "@spectre-mail/mailbox";

import type { FillCodeAnswer } from "./protocol";
import { POPUP_COPY } from "./popup-copy";

/**
 * The surface's copy.
 *
 * **An alias rather than a rename,** so the constant's name stays the one the website's boundary
 * assertion and `popup-copy.test.ts` both read. A second constant holding the same object would be a
 * second thing to keep in step, and one of the two would be edited.
 */
const COPY = POPUP_COPY;

/**
 * The clipboard control a surface offers beside each code, and its own words.
 *
 * **A caller-supplied object rather than a string in `POPUP_COPY`, and the reason is that this
 * control is the panel's and not the popup's.** The popup has no clipboard control per code - a
 * popup beside a form is a surface that has already lost the page's focus, and `Popup.tsx` has
 * never shipped one. **Putting its label in `POPUP_COPY` would let the website's depiction name a
 * control the popup does not render**, which is precisely the failure `popup-copy.ts` warns about
 * when it refuses to put a function in that object: *a depiction can only show a string, so a
 * function-valued entry is one no depiction may claim to render.*
 *
 * **So the words arrive with the behaviour.** A caller that offers the control supplies both the
 * action and its label, and a caller that does not supply the object renders no control at all -
 * which is why `Codes` below treats it as optional rather than as a disabled button.
 */
export interface CodeClipboardActions {
  /** Puts `code` on the clipboard. The caller reports the outcome; nothing here does. */
  readonly onCopy: (code: string) => void;
  /**
   * What this particular code's control says right now.
   *
   * **A function of the code rather than one string for the whole list,** because the report is
   * about *this* write: a list where a refusal on one code relabelled every control would claim
   * four copies where one was made. `Popup.tsx`'s address control keeps the same rule in a
   * component of its own.
   */
  readonly labelOf: (code: string) => string;
  /** Whether *this* code's control is working right now. */
  readonly busyOf: (code: string) => boolean;
}

/** What a surface says about the verification links detected in a message it opened. */
export interface LinkCopyLabels {
  /** The heading above the list. */
  readonly heading: string;
  /** What the list says when the parser found no link. */
  readonly none: string;
  /** The control that opens a link. */
  readonly open: string;
  /**
   * What *this* link's clipboard control says right now.
   *
   * **A function for the same reason {@link CodeClipboardActions.labelOf} is one**, and it is the
   * same defect it prevents: one string for the whole list would report a copy of every link when
   * one was written.
   */
  readonly copyOf: (url: string) => string;
  /** Whether *this* link's clipboard control is working right now. */
  readonly busyOf: (url: string) => boolean;
}

/** What the surface's copy control has done so far. */
export type CopyState = "idle" | "copied" | "failed";

/**
 * What the last delivery attempt has to report, and why this is one union rather than a string.
 *
 * **Every sentence this surface can say about a delivery is a claim about somebody else's page, and
 * one of them — `filled` — is the only one that claims anything happened.** The rest are refusals,
 * and `extension-client` requires a surface to report that it *could not confirm* rather than to
 * infer an outcome. A `string | null` would make that distinction a matter of which words were
 * chosen at the call site; the union makes it a matter of which fact was observed.
 *
 * **`unconfirmed` is separate from `noTab` on purpose.** Neither confirms anything and both report
 * the same way in the only respect that matters — nothing is claimed about the page — but the two
 * are different faults, and a report is the only place a person can learn which one happened.
 */
export type FillReport =
  | { readonly kind: "idle" }
  | { readonly kind: "sending" }
  | { readonly kind: "noTab" }
  | { readonly kind: "unconfirmed" }
  | { readonly kind: "answered"; readonly answer: FillCodeAnswer };

/**
 * The listed messages, each of which can be opened.
 *
 * ## Why the popup's listing shows no marker, and which clauses say so
 *
 * **`MessageSummary` carries no codes and no links, on purpose** - `packages/core` says listing a
 * mailbox must not require fetching bodies. So a row built from a summary alone *cannot* say a
 * message carries a verification.
 *
 * **And `extension-client` forbids exactly two surfaces from saying it, and both clauses name THE
 * POPUP** - *"The popup SHALL NOT indicate that a message carries a verification until it has opened
 * that message"*, inside the requirement headed *"The extension's popup performs its first
 * milestone's actions over the shared session"*, with the scenario *"A check has listed messages"*.
 * **An earlier version of this comment said the requirement "forbids a surface", which is broader
 * than the promoted text**, and a reader arriving at the marking below would have taken that broader
 * claim as the rule. `panel-mailbox-choice` left it here for the slice that ships the indicator.
 *
 * **The panel's listing does carry it, which is why the marking below exists at all.**
 * `InboxListing` carries `verdicts` once the session's verdict pass has run, and that requirement -
 * *"A message is analysed once, and only when it is new"* - already obliges the session to
 * determine it, hold it against the message, and report it. **The panel's permission is not the
 * absence of the popup's prohibition: it is a positive requirement of its own**, *"The side panel
 * states, per message, whether a detected verification was found in it"*.
 *
 * ## Why opening goes through the session rather than fetching anything
 *
 * **`packages/mailbox` owns the opened message**, including whether a session already analysed it,
 * and it retains that analysis so a second visit costs no provider request. A surface that fetched a
 * body itself would spend a request per message to recompute an answer already in hand.
 */

/**
 * A surface's own words for each verdict in the shared union.
 *
 * **Exhaustive, so a sixth `MessageVerdict["kind"]` fails to compile here.** The empty case is
 * written out rather than omitted, because *"the row shows no marking"* is a decision and not a
 * missing case, and an omitted key would be indistinguishable from one nobody wrote.
 */
export type VerdictWording = Readonly<Record<MessageVerdict["kind"], string>>;

export function MessageList({
  state,
  onOpen,
  verdictWording,
}: {
  readonly state: InboxState;
  readonly onOpen: (messageId: string) => void;
  /**
   * Absent renders no marking on any row, which is what the popup asks for.
   *
   * **The default is off and that direction is the requirement.** A prop defaulting to *on* would
   * make the forbidden behaviour the default and the allowed one the exception, so the failure mode
   * of a future refactor would be a spec violation rather than a missing feature. **This is the
   * {@link LinkCopyLabels} precedent exactly** - a record of labels the caller owns, whose absence is
   * what keeps the popup free of them.
   *
   * **It carries the words and NOT the verdicts map, and that is deliberate.** The verdicts are
   * already inside `state`: `listing.verdicts` sits beside `listing.messages`, so each row reads its
   * own through {@link verdictFor}. **A caller handed the map instead would be a second source that
   * can disagree with the rows it marks** - a panel holding another mailbox's map would mark these
   * rows with that mailbox's verdicts, and nothing anywhere would report it.
   */
  readonly verdictWording?: VerdictWording;
}) {
  if (state.kind !== "checked" && state.kind !== "checkFailed") {
    return null;
  }

  return (
    <ul aria-label={COPY.messages} data-testid="message-list">
      {state.listing.messages.map((message) => {
        /**
         * **`verdictFor` rather than a lookup written here**, because its default is the whole
         * point: an id the map has never heard of is `undetermined` - "not known" - rather than an
         * accidental `undefined` a row might treat as a negative answer. **The same holds for the
         * `checkFailed` variant above**, which carries the last known listing *with its verdicts*, so
         * a row the session did read is marked by what it actually found and never by "could not be
         * read".
         */
        const verdict = verdictFor(state.listing.verdicts, message.id);
        const marking = verdictWording?.[verdict.kind] ?? "";

        return (
          <li key={message.id}>
            <span className="message__from">{describeSender(message)}</span>
            <span className="message__subject">{message.subject}</span>
            {/**
             * **A bare `<p>` carrying a `data-testid` and no class at all.**
             *
             * `.panel p` and `.popup p` are declared already, so the words are styled by a rule that
             * exists today, and **a new class hook would be a stylesheet obligation** the boundary
             * rule reports by name. The marking is **words only, with no accent rule**: a rule beside
             * a row is a claim that something is in it, and an undetermined row must not carry one.
             */}
            {marking !== "" && <p data-testid="message-verdict">{marking}</p>}
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
        );
      })}
    </ul>
  );
}

/**
 * What to show as the sender, in that order.
 *
 * **A display name when the provider gave one, the address otherwise, and the provider's own absence
 * when it gave neither.** A blank sender is allowed by the model — the field is required and may be
 * empty — so the fallback is a sentence rather than nothing: a row with an empty line where the
 * sender goes reads as a rendering fault rather than as a message from nowhere.
 */
/**
 * **Module-private, and the `react-refresh/only-export-components` warning is why.**
 *
 * Task 5.3 names this function as part of what moved here, and it is called from exactly one place
 * in this file. Exporting it would make the module a component library it is not, for a consumer
 * that does not exist.
 */
function describeSender(message: MessageSummary): string {
  const name = message.fromName ?? "";
  if (name.length > 0) {
    return name;
  }

  return message.from.length > 0 ? message.from : COPY.unnamedSender;
}

/**
 * The opened message, its codes, its links, and the controls that act on them.
 *
 * ## Why every code gets its own control
 *
 * **The parser never reports a detection as certain**, and its ranking is exactly that — so a control
 * offered only for the top-ranked code would act on a guess about which of several was real. One
 * control per code is the same decision `website-client` reaches for the same reason, and it costs
 * nothing here because the codes are already ranked and already visible.
 *
 * ## Why two of the four props are optional, and that is the extraction's safety
 *
 * **`clipboard` and `links` are absent for the popup, which is what keeps `design.md` D2's "a move,
 * not a rewrite" literally true.** The popup renders no clipboard control beside a code and no
 * verification links at all, and it must keep rendering neither — so a surface that does not ask
 * for an affordance does not get one. **Not a disabled control and not a hidden one:** the
 * requirement's own words are that a control SHALL *act on* the value it is beside, and a button
 * that is inert is the defect `page-composition` already forbids on the website.
 */
export function OpenedMessageView({
  opened,
  onClose,
  fill,
  onFill,
  clipboard,
  links,
  onCopyLink,
}: {
  readonly opened: OpenedMessageState;
  readonly onClose: () => void;
  readonly fill: FillReport;
  readonly onFill: (code: string) => void;
  /** Absent renders no clipboard control, which is what the popup asks for. */
  readonly clipboard?: CodeClipboardActions;
  /** Absent renders no link list at all, which is what the popup asks for. */
  readonly links?: LinkCopyLabels;
  /** Puts a link on the clipboard. Required whenever `links` is, and useless without it. */
  readonly onCopyLink?: (url: string) => void;
}) {
  return (
    <>
      {opened.kind === "opening" && <p>{COPY.reading}</p>}
      {opened.kind === "openFailed" && <p role="alert">{COPY.readFailed}</p>}
      {opened.kind === "opened" && (
        <>
          {/* **`exactOptionalPropertyTypes` is why this is spread rather than passed as
              `undefined`.** The shared `tsconfig.base.json` enables it, so naming an optional prop
              `undefined` is a type error - and omitting a prop is not the same thing as passing
              `undefined` to it. "The popup asked for no clipboard control" is the claim
              `design.md` D2''s move-not-rewrite rests on, and it is only literally true if the
              prop is absent rather than present-and-empty. */}
          <Codes
            codes={opened.message.codes}
            fill={fill}
            onFill={onFill}
            {...(clipboard === undefined ? {} : { clipboard })}
          />
          {links !== undefined && (
            <Links
              links={opened.message.links}
              labels={links}
              {...(onCopyLink === undefined ? {} : { onCopy: onCopyLink })}
            />
          )}
        </>
      )}
      <button type="button" className="control" onClick={onClose}>
        {COPY.closeMessage}
      </button>
    </>
  );
}

/**
 * The codes found in the message the user opened, each with its own delivery control.
 *
 * **The clipboard control is the panel's and is asked for, not assumed** — see
 * {@link CodeClipboardActions} for why its label arrives with its behaviour.
 */
export function Codes({
  codes,
  fill,
  onFill,
  clipboard,
}: {
  readonly codes: readonly { readonly value: string }[];
  readonly fill: FillReport;
  readonly onFill: (code: string) => void;
  /** Absent renders no clipboard control. */
  readonly clipboard?: CodeClipboardActions;
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
            {clipboard !== undefined && (
              <button
                type="button"
                className="control"
                disabled={clipboard.busyOf(code.value)}
                onClick={() => {
                  clipboard.onCopy(code.value);
                }}
              >
                {clipboard.labelOf(code.value)}
              </button>
            )}
          </li>
        ))}
      </ul>
      <p role="status">{fillSentence(fill)}</p>
    </>
  );
}

/**
 * The verification links the parser detected, each with its destination's host beside it.
 *
 * ## Why the host is rendered rather than derived, and why the control is an anchor
 *
 * **`VerificationLink` carries `hostname` so a surface can label a link without parsing a URL
 * again**, and this surface uses that field rather than reaching for `new URL(...).host` — the same
 * reason `website-client` requires the host beside the control there.
 *
 * **An `<a href>` and not a button that navigates.** A control that opened a verification
 * destination by rewriting the panel's own location would navigate an extension document, and the
 * person's signup form would be gone. `rel="noopener noreferrer"` is carried for the reason
 * `website-client` names: the destination is an outside page and the referring document is this
 * extension's, and `noreferrer` is what stops that document's own URL - which is a
 * `chrome-extension://` URL naming this device's extension id - from travelling with the request.
 */
export function Links({
  links,
  labels,
  onCopy,
}: {
  readonly links: readonly VerificationLink[];
  readonly labels: LinkCopyLabels;
  readonly onCopy?: (url: string) => void;
}) {
  if (links.length === 0) {
    return <p>{labels.none}</p>;
  }

  return (
    <>
      <h3>{labels.heading}</h3>
      <ul aria-label={labels.heading} data-testid="link-list">
        {links.map((link) => (
          <li key={link.url}>
            {/* **The host is a separate node beside the control**, not part of its text: the
                requirement is that the destination's host is legible next to the thing that opens
                it, and a control whose own accessible name had the host baked into it would be a
                control whose name changes with every link. */}
            <span className="message__link-host">{link.hostname}</span>
            <a className="control" href={link.url} target="_blank" rel="noopener noreferrer">
              {labels.open}
            </a>
            {onCopy !== undefined && (
              <button
                type="button"
                className="control"
                disabled={labels.busyOf(link.url)}
                onClick={() => {
                  onCopy(link.url);
                }}
              >
                {labels.copyOf(link.url)}
              </button>
            )}
          </li>
        ))}
      </ul>
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
 *
 * **Exported because the panel reports a delivery with the same words,** and a panel that spelled
 * this out again would be the second copy of the decision table `design.md` D2 forbids.
 */
/** **Module-private for the same reason {@link describeSender} is: one caller, no consumer.** */
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
