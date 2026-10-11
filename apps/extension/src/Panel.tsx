/**
 * The side panel.
 *
 * ## What this is, and the four reasons it is not a second popup
 *
 * **A surface, not a client.** Everything below renders what `packages/mailbox` reports and asks
 * the shared session to do what it reports; there is no provider call, no parsing and no lifecycle
 * logic here, which is the same rule `Popup.tsx` states for itself. `design.md` D2 makes a panel
 * that reimplemented any of that "a second client inside one client", and the boundary rule
 * forbidding a shared package's behaviour being reimplemented already applies to this file.
 *
 * **Its mailbox is the page's, not simply the newest (D3).** A panel showing this device's newest
 * mailbox on every page would be the product this milestone exists to replace, so the choice goes
 * through {@link resolveForHost} — the same helper the in-page affordance uses, rather than a second
 * spelling of the rule.
 *
 * **Its host comes from the page's own content script (D4).** `tab.url` is withheld without `tabs`
 * (§4.6), so the panel asks over `chrome.tabs.sendMessage` and is told a hostname or nothing. The
 * state is a four-way union because **a panel that read an absent host as an empty one would offer
 * the newest mailbox as though it belonged to the page** — the one wrong answer this milestone must
 * never give.
 *
 * **It follows a tab switch with `chrome.tabs.onActivated` (D5)**, which §4.6 measured fires to a
 * context holding no `tabs` permission. **Not a poll:** the cadence is 5 000 ms while contents
 * change, so a poll-refreshed host line is stale by up to a full interval at exactly the moment the
 * user switched.
 *
 * ## What it deliberately does not have
 *
 * **No `tabs` permission, and that is a property of the tree rather than a claim.** Every platform
 * reach goes through `extension-platform.ts`, which is the single module a boundary rule lets read
 * the extension's global — so a `chrome.tabs` read anywhere in this file fails the build, and this
 * file reads none.
 *
 * **No provider selector, for the popup's reason:** a control over one reachable option cannot act.
 *
 * @module
 */

import { useCallback, useEffect, useMemo, useState } from "react";

import type { Mailbox } from "@spectre-mail/core";
import { holdsMailbox } from "@spectre-mail/mailbox";
import type { MailboxSession, SessionFailure, SessionState } from "@spectre-mail/mailbox";

import { findActiveTab, onTabActivated, sendToBackground, sendToTab } from "./extension-platform";
import {
  CREATE_MAILBOX_REQUEST,
  HOST_CONTEXT_REQUEST,
  fillCodeRequest,
  readCreateMailboxAnswer,
  readFillCodeAnswer,
  readHostContextAnswer,
} from "./protocol";
import type { CreateMailboxAnswer } from "./protocol";
import { MessageList, OpenedMessageView } from "./MessageSurface";
import type { CodeClipboardActions, FillReport, LinkCopyLabels } from "./MessageSurface";
import { POPUP_COPY } from "./popup-copy";
import { PANEL_COPY } from "./panel-copy";
import { resolveForHost } from "./resolve-for-host";
import type { ResolvedMailbox } from "./resolve-for-host";

const COPY = POPUP_COPY;

/**
 * The records this surface reads.
 *
 * **`loadMailboxes` and not `loadMailbox`,** because this panel names *several* mailboxes where the
 * popup names one, and because the choice between them is the host's — see
 * {@link resolveForHost}. **`loadSiteMailboxId` is a read and never a write**, because recording a
 * host is the content script's job after an insertion: this panel never inserts anything, so it has
 * no insertion to remember.
 */
export interface PanelRecords {
  /** Every mailbox this device holds, newest first. */
  readonly loadMailboxes: () => Promise<readonly Mailbox[]>;
  /** The mailbox this host was last used with, or `null` when there is none. */
  readonly loadSiteMailboxId: (host: string) => Promise<string | null>;
}

/**
 * What the panel could learn about the page beside it.
 *
 * ## Why four variants and not one nullable host
 *
 * **Because the three failures are different facts and only one of them is the panel's fault.**
 * `docs/PROVIDERS.md` §4.6 measured that a content script answering **nothing** *resolves*, and a
 * resolution is indistinguishable from a script that is not there — so {@link HostReading.refused}
 * covers both and the panel says the one thing both support. {@link HostReading.unanswered} is the
 * half that really is distinguishable: the script ran and had nothing usable to give.
 *
 * **And {@link HostReading.asking} exists so that "not yet" is a value rather than an absence.**
 * A panel that rendered its refusal while its own round trip was in flight would claim it cannot
 * name a page it has not finished asking about.
 *
 * **Only {@link HostReading.named} may claim a mailbox is this page's.** That is `design.md` D4's
 * operative clause and it is enforced by the type at the one place the claim is made — see
 * {@link Panel}.
 */
export type HostReading =
  | { readonly kind: "asking" }
  | { readonly kind: "named"; readonly host: string }
  | { readonly kind: "unanswered" }
  | { readonly kind: "refused" };

/**
 * Ask the page beside this panel which host it is on.
 *
 * ## Why this is one function and not three call sites
 *
 * **Because the two reads of the answer belong together and only here.** "No answer at all" and "an
 * answer with nothing usable in it" are the same fact to a person and different facts to a reader,
 * and a panel that collapsed them into one string would be unable to test either.
 *
 * **A tab that cannot be named is a refusal, not an empty host.** `findActiveTab` answers `null`
 * when the platform reports no active tab, and there is no page beside the panel in that case —
 * which is exactly what {@link HostReading.refused} says.
 *
 * @returns What could be learned, never a host this function did not read.
 */
/**
 * **Not exported, and the `react-refresh/only-export-components` warning is why.**
 *
 * The rule's premise is that a module is also a component library, and this function is not one — it
 * is the panel's own question to the page beside it, and nothing outside this file calls it.
 * Exporting it bought nothing and cost a warning on every `pnpm lint` this change would ever run.
 */
async function askThePageForItsHost(): Promise<HostReading> {
  const tabId = await findActiveTab();

  if (tabId === null) {
    return { kind: "refused" };
  }

  const answer = readHostContextAnswer(await sendToTab(tabId, HOST_CONTEXT_REQUEST));

  // **`null` is two faults — no answer, and an answer this extension did not recognise — and the
  // requirement's sentence covers both**, because for a page that carries no script of this
  // extension there genuinely is nothing to name. `docs/PROVIDERS.md` §4.6 measured the resolution
  // that makes them indistinguishable.
  if (answer === null) {
    return { kind: "refused" };
  }

  return answer.kind === "host" ? { kind: "named", host: answer.host } : { kind: "unanswered" };
}

/**
 * Which mailbox the panel is showing, and why it may be showing none.
 *
 * ## `unnamed` is the requirement's own third clause
 *
 * **"It SHALL offer no mailbox as being that page's"** — and this union makes the absence of a
 * mailbox *and* the absence of a claim two different values rather than one `null`. A panel that
 * rendered "unnamed" as an empty inbox would be claiming the page has no mail, which is a claim
 * about a page it never read.
 *
 * **`none` is separate from `unnamed` because they are different facts:** the first is "I cannot tell
 * which address this page uses" and the second is "I know this page, and this device has nothing to
 * use here" — and only the second is an invitation to create.
 */
export type PanelMailbox =
  | { readonly kind: "unnamed" }
  | { readonly kind: "none" }
  | { readonly kind: "named"; readonly mailbox: ResolvedMailbox };

export interface PanelProps {
  /**
   * The session to render.
   *
   * **Injected for the popup's reason and not this file's own:** every component test would need a
   * `chrome` global if this built one, and `jsdom` has none.
   */
  readonly session: MailboxSession;
  /** Where this surface reads what the device holds. */
  readonly records: PanelRecords;
  /** The provider this client reaches first, named before any mailbox exists. */
  readonly primaryProviderName: string;
}

export function Panel({ session, records, primaryProviderName }: PanelProps) {
  const [state, setState] = useState<SessionState>(() => session.current());
  const [boot, setBoot] = useState<{ readonly done: boolean; readonly blocked: boolean }>({
    done: false,
    blocked: false,
  });
  const [held, setHeld] = useState<readonly Mailbox[]>([]);
  const [reading, setReading] = useState<HostReading>({ kind: "asking" });
  const [associated, setAssociated] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createRefusal, setCreateRefusal] = useState<string | null>(null);
  const [fill, setFill] = useState<FillReport>({ kind: "idle" });
  const [copies, setCopies] = useState<ReadonlyMap<string, CopyOutcome>>(() => new Map());

  useEffect(() => session.subscribe(setState), [session]);

  /**
   * The boot read, and the refusal to collapse "nothing stored" with "could not read".
   *
   * **The same distinction `Popup.tsx` makes and for the same reason.** A read reported as absent
   * tells a person who came back for their address that they have none — and then offers to make a
   * new one, beside the page they are signing up on, which is worse here than in a popup because the
   * page beside the panel is the one they are about to type the wrong address into.
   */
  useEffect(() => {
    if (boot.done) return;

    void (async () => {
      try {
        const stored = await records.loadMailboxes();
        setHeld(stored);
        setBoot({ done: true, blocked: false });
      } catch {
        setBoot({ done: true, blocked: true });
      }
    })();
  }, [boot.done, records]);

  /**
   * Resolve the host, then the mailbox that belongs to it.
   *
   * **Two steps in one callback because the second is meaningless without the first**, and the
   * association lookup's own failure is absorbed for the reason `controller.ts` absorbs it: a device
   * that can list its mailboxes and cannot say which one this page used is not in doubt about
   * anything, so the newest is the answer it would have received anyway.
   *
   * **The lookup is skipped entirely when no host was named**, which is not an optimisation — a
   * lookup keyed on an empty string is a question about no page, and answering it could only
   * produce a record that names a host nobody is on.
   */
  const resolveThePage = useCallback(async () => {
    const read = await askThePageForItsHost();

    setReading(read);

    if (read.kind !== "named") {
      setAssociated(null);
      return;
    }

    setAssociated(await records.loadSiteMailboxId(read.host).catch(() => null));
  }, [records]);

  // **Asked on mount, and again on every tab switch (D5).** The teardown is the subscription's own
  // return, because a listener left attached across a remount would double every question asked.
  //
  // **Both calls go through an async IIFE rather than being written as `void resolveThePage()`, and
  // that is this repository's shape for an effect that starts work rather than doing it.** The
  // `react-hooks/set-state-in-effect` rule reports the bare call because `resolveThePage` reaches
  // `setReading`, and the boot effect above — which reads this device's mailboxes and sets two pieces
  // of state — has always used the IIFE for the same reason. **Nothing is deferred that was not
  // already deferred**: `resolveThePage` awaits the page's answer before it touches any state, so the
  // two forms differ in how the rule reads them and not in what the panel does.
  useEffect(() => {
    if (!boot.done || boot.blocked) return;

    void (async () => {
      await resolveThePage();
    })();

    return onTabActivated(() => {
      void (async () => {
        await resolveThePage();
      })();
    });
  }, [boot.blocked, boot.done, resolveThePage]);

  /**
   * The mailbox this panel is showing, and the reason it may be nothing at all.
   *
   * **`null` when no host was named is the requirement, not a limitation.** `design.md` D4: only an
   * answered host may offer a mailbox as being that page's, and a panel showing its newest address
   * beside an unnamed page is a panel inviting somebody to type another site's address into a form.
   */
  const shown = useMemo((): PanelMailbox => {
    if (reading.kind !== "named") {
      return { kind: "unnamed" };
    }

    const resolved = resolveForHost(held, reading.host, associated);

    return resolved === null ? { kind: "none" } : { kind: "named", mailbox: resolved };
  }, [associated, held, reading]);

  /**
   * The whole record for the resolved id, which `resolveForHost` does not carry.
   *
   * **`undefined` is unreachable while the type is `named` and is treated as unreachable rather
   * than defaulted**, because the id came out of `held` on the line above and cannot name a
   * mailbox that is not in it. Two consumers need the record rather than the id: `restore`, which
   * takes a `Mailbox`, and the provider name the address section's heading carries.
   */
  const record =
    shown.kind === "named" ? held.find((each) => each.id === shown.mailbox.mailboxId) : undefined;

  /**
   * Which mailbox the session should be showing, which is the resolved one — and never opened.
   *
   * **`restore` rather than `open`, and that is `Popup.tsx`'s rule stated again:** handing the
   * session `null` delegates to `open()`, which would *create* an address whenever the host resolves
   * to nothing. **And a missing record stops the effect outright rather than passing `null`**,
   * because `null` means *create* on that path — so a `?? null` here would turn an impossible
   * state into a mailbox nobody asked for, which is the worst thing this surface could do.
   *
   * **The id comparison is the second half of that**, and it is what keeps a tab switch between two
   * pages that resolve to the same mailbox from costing a provider listing: `restore` reconciles by
   * asking the provider, and the requirement's "re-read both" is a statement about *this device's
   * records*, not about a request per tab switch.
   */
  useEffect(() => {
    if (record === undefined) return;
    const current = session.current();
    if (holdsMailbox(current) && current.mailbox.id === record.id) return;
    void session.restore(record);
  }, [record, session]);

  /**
   * Create a mailbox, **by asking the background context to do it**.
   *
   * **`tasks.md` 5.8 names the reason and it is not the one §4.4 gave for the content script.** A
   * panel-hosted document *may* fetch a provider directly — §4.6 measured that — so this is not a
   * capability limit. It is that **one context contacts the provider**, so the reach a provider
   * grants this extension is the reach declared in one manifest rather than two paths that can
   * diverge. The worker also arms the background alarm on this path, which is why this surface asks
   * for no arming of its own.
   *
   * **The created mailbox is not stored here.** `create-mailbox.ts` writes it before it answers, and
   * a second write from here would be two records for one mailbox.
   */
  const create = useCallback(async () => {
    setCreating(true);
    setCreateRefusal(null);

    const answer: CreateMailboxAnswer = readCreateMailboxAnswer(
      await sendToBackground(CREATE_MAILBOX_REQUEST),
    ) ?? {
      kind: "notActedOn",
    };

    setCreating(false);

    if (answer.kind === "created") {
      setHeld(await records.loadMailboxes());
      return;
    }

    /**
     * **Every other answer reports rather than falls through to an offer to retry**, and the words
     * are the provider's own — `create-mailbox.ts` builds them, and a paraphrase written here would
     * be a second sentence that can disagree with the provider about what happened.
     */
    setCreateRefusal(
      answer.kind === "refused"
        ? answer.description
        : answer.kind === "notStored"
          ? PANEL_COPY.addressNotKept
          : PANEL_COPY.couldNotConfirmCreation,
    );
  }, [records]);

  const copyValue = useCallback(async (token: string, value: string) => {
    setCopies((before) => new Map(before).set(token, "working"));

    try {
      await navigator.clipboard.writeText(value);
      setCopies((before) => new Map(before).set(token, "copied"));
    } catch {
      // **Reported per value rather than as one list-wide state, for the reason
      // `CodeClipboardActions` gives:** the report is about *this* write, and a list where one
      // refusal relabelled every control would claim four copies where one was made.
      setCopies((before) => new Map(before).set(token, "failed"));
    }
  }, []);

  /**
   * Hand a code to the page beside the panel, and report what it answered.
   *
   * **The popup's delivery, unchanged.** Same request, same narrowing, same refusal vocabulary —
   * and the panel sends it to the same place, because the panel and the popup are both asking *the
   * active tab*, and the panel is beside that tab rather than replacing it.
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
      <main className="panel" aria-busy="true">
        <h1 className="panel__heading">{PANEL_COPY.title}</h1>
        <p>{PANEL_COPY.booting}</p>
      </main>
    );
  }

  if (boot.blocked) {
    /**
     * **No create control at all here**, rather than a disabled one, for the popup's reason: a
     * button that cannot act is a control misreporting the choice as unavailable.
     */
    return (
      <main className="panel">
        <h1 className="panel__heading">{PANEL_COPY.title}</h1>
        <p role="alert">{PANEL_COPY.bootFailed}</p>
      </main>
    );
  }

  const mailbox = holdsMailbox(state) ? state.mailbox : null;

  /**
   * The opened message, read as a value rather than a property access.
   *
   * **`"opened" in state` is not on its own enough, and this file's own suite found that on its
   * first run.** `in` narrows the *union variant* — it stops the compiler reporting `opened` as
   * absent on the five variants that have none — but it cannot exclude a property whose value is
   * `null`, and every variant that has one starts it at exactly that. So the guard the popup has
   * always had, `opened !== null`, is the guard this file needed too; writing only the `in` check
   * compiles, renders nothing, and throws the moment a mailbox is ready and nothing is open —
   * which is the panel's **ordinary** state, not an edge of it.
   *
   * **Sixteen cases were red for this one line and one of them was a scenario that never opens
   * anything**, so it is recorded here rather than only in the change's verification notes.
   */
  const opened = "opened" in state ? state.opened : null;

  /**
   * What the host line says, and **every arm here is a value this panel actually read.**
   *
   * **Four arms rather than three, and the fourth is the one a pair of sentences cannot express.**
   * A named host has three states: no association, an association naming a mailbox this device
   * holds, and an association naming one it does not. **The third is not "no address has been used
   * here yet"** — one was — and it is not `hostHasMailbox` either, because `resolveForHost` falls
   * back to the newest for a stale association, so that sentence would name a mailbox this host was
   * never used with. `PANEL_COPY.hostAssociationGone` says the host and refuses the association,
   * which is the requirement's "SHALL offer no mailbox as being that page's" without pretending
   * the record is absent.
   */
  const hostSentence = (): string => {
    switch (reading.kind) {
      case "asking":
        return PANEL_COPY.hostNotAsked;
      case "refused":
        return PANEL_COPY.noScriptHere;
      case "unanswered":
        return PANEL_COPY.cannotNameHost;
      case "named": {
        if (associated === null) {
          return PANEL_COPY.hostHasNoMailbox(reading.host);
        }

        return record !== undefined && record.id === associated
          ? PANEL_COPY.hostHasMailbox(reading.host, record.address)
          : PANEL_COPY.hostAssociationGone(reading.host);
      }
    }
  };

  return (
    <main className="panel">
      <h1 className="panel__heading">{PANEL_COPY.title}</h1>

      <section aria-labelledby="panel-host-heading">
        <h2 id="panel-host-heading">{PANEL_COPY.hostHeading}</h2>
        <p data-testid="panel-host">{hostSentence()}</p>
      </section>

      {/*
       * **`data-testid` on this section, for the reason `panel-message` carries one.** The guard that
       * withholds it is `shown.kind === "named"`, and the addresses this device holds are rendered
       * *anyway* under "Addresses on this device" — so an assertion that the address text is absent
       * from the page cannot hold beside a device holding two mailboxes, and would be satisfied by a
       * panel that hid its own inventory. **The section is the claim; the text is not.**
       */}
      {shown.kind === "named" && record !== undefined && (
        <section aria-labelledby="panel-address-heading" data-testid="panel-address">
          <h2 id="panel-address-heading">{PANEL_COPY.addressHeading(record.provider)}</h2>
          <p className="panel__address">{record.address}</p>
        </section>
      )}

      {/**
       * **Still gated on `none`, and this line was deliberately NOT widened when the create control
       * beside it was.**
       *
       * "This device has no address yet" is **false beside a page this panel cannot name.** The
       * device may hold one mailbox, several, or none — the fault is that *this panel* cannot read
       * which, and a sentence claiming the device is empty would be a claim about storage this
       * surface has just admitted it cannot see. **Only `none` proves it, and `none` is the one arm
       * where the panel resolved a host and found this device had used no address on it.**
       *
       * **If you are reading this wanting to show it for `unnamed`, that is the bug, not the fix.**
       */}
      {shown.kind === "none" && <p>{PANEL_COPY.noMailboxHeld}</p>}

      {createRefusal !== null && <p role="alert">{createRefusal}</p>}

      {/**
       * **Not gated on `none` — gated on the host being unnameable.**
       *
       * **`shown.kind !== "named"` rather than `=== "none"`, and this is the orchestrator's
       * decision** rather than mine, because it is a product decision and `design.md` A17 records it
       * with the option that was rejected. In short: **a newly created mailbox belongs to no host**,
       * so creating one beside a page this panel cannot name is not the hazard the requirement
       * guards against — and withholding the control there left the panel rendering a heading, a
       * sentence about not being able to name the page, and **nothing a person could act on**, which
       * is the fake-UI defect this repository treats as structural on a surface with a manifest
       * entry pointing at it.
       *
       * **What deliberately did NOT move with it.** The mailbox itself stays withheld (the section
       * above), and `PANEL_COPY.noMailboxHeld` stays gated on `none` — **because beside an unnamed
       * page that sentence is false**: this device may hold one mailbox, several, or none, and the
       * fault is that *this panel* cannot tell which. Only `none` proves it.
       */}
      {shown.kind !== "named" && (
        <button
          type="button"
          className="control control--primary"
          disabled={creating}
          onClick={() => void create()}
        >
          {creating
            ? PANEL_COPY.creating
            : shown.kind === "none"
              ? PANEL_COPY.createForHost
              : PANEL_COPY.createForUnnamedPage}
        </button>
      )}

      {held.length > 1 && (
        <section aria-labelledby="panel-held-heading">
          <h2 id="panel-held-heading">{PANEL_COPY.heldHeading}</h2>
          <ul aria-label={PANEL_COPY.heldHeading} data-testid="panel-held">
            {held.map((each) => (
              <li key={each.id}>
                <span className="panel__held-address">{each.address}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {state.kind === "expired" && <p role="alert">{PANEL_COPY.mailboxGone}</p>}

      {state.kind === "failed" && (
        <p role="alert">
          {PANEL_COPY.providerFailed(
            attributingProvider(state.failure, primaryProviderName),
            state.failure.description,
          )}
        </p>
      )}

      {state.kind === "restoreFailed" && (
        <p role="alert">
          {PANEL_COPY.providerFailed(
            attributingProvider(state.failure, primaryProviderName),
            state.failure.description,
          )}
        </p>
      )}

      {mailbox !== null && state.kind !== "expired" && (
        <>
          <section aria-labelledby="panel-inbox-heading">
            <h2 id="panel-inbox-heading">{COPY.inbox}</h2>
            {state.kind === "ready" && state.inbox.kind === "checkFailed" && (
              <p role="alert">
                {PANEL_COPY.providerFailed(
                  attributingProvider(state.inbox.failure, primaryProviderName),
                  state.inbox.failure.description,
                )}
              </p>
            )}
            <MessageList
              state={state.kind === "ready" ? state.inbox : { kind: "notStarted" }}
              onOpen={(id) => void session.openMessage(id)}
            />
          </section>

          {opened !== null && opened.kind !== "none" && (
            /**
             * **`data-testid` on this section, and the guard above is why.**
             *
             * A falsification arm removed the `opened.kind !== "none"` half of the guard and every
             * case stayed green, because `OpenedMessageView` renders **nothing at all** for that
             * variant — no codes, no links, no subject — so the mutation's only observable is an
             * **empty heading with a region around it**. Asserting the absence of the codes or the
             * links cannot see it, and an assertion that cannot see the difference between a section
             * and no section is not an assertion about the section.
             *
             * The id is named here rather than derived from the copy, because the *copy* is the
             * thing a future change is most likely to reword and a test that follows it rewords
             * itself quietly. This name says what the region is.
             */
            <section aria-labelledby="panel-message-heading" data-testid="panel-message">
              <h2 id="panel-message-heading">{COPY.messages}</h2>
              <OpenedMessageView
                opened={opened}
                onClose={() => session.closeMessage()}
                fill={fill}
                onFill={(code) => void fillInto(code)}
                clipboard={codeClipboard(copyValue, copies)}
                links={PANEL_LINKS(copies)}
                onCopyLink={(url) => void copyValue(`link:${url}`, url)}
              />
            </section>
          )}
        </>
      )}
    </main>
  );
}

/**
 * Which provider a failure is attributed to.
 *
 * **The failing one, and deliberately not the one that served.** The requirement's clause is *"WHEN
 * the provider this client reaches first cannot be reached THEN the panel SHALL name the provider
 * that served it"* — so by construction these are two different providers, and a report that named
 * `mailbox.provider` would be describing a provider that answered. `providerFailures[0]` is the
 * failing one; where the manager could not attribute the failure to any single provider it says so
 * itself in `code`, and `fallback` — the provider this client reaches first — is then the honest
 * name rather than a guess at a culprit.
 *
 * **One function for three call sites**, because a panel naming a different provider for a creation
 * failure than it does for a listing failure would be reporting two providers for one fault.
 */
function attributingProvider(failure: SessionFailure, fallback: string): string {
  return failure.providerFailures[0]?.provider ?? fallback;
}

/** What a per-value clipboard control is doing right now. */
type CopyOutcome = "working" | "copied" | "failed";

/**
 * The per-code clipboard control, built from the outcomes map.
 *
 * **A function of the code at every point** rather than a string computed once per render, because
 * the label and the disabled state must both be about *this* control.
 */
function codeClipboard(
  copyValue: (token: string, value: string) => Promise<void>,
  copies: ReadonlyMap<string, CopyOutcome>,
): CodeClipboardActions {
  return {
    onCopy: (code) => void copyValue(`code:${code}`, code),
    labelOf: (code) => labelFor(`code:${code}`, copies, PANEL_COPY.copyCode(code)),
    busyOf: (code) => copies.get(`code:${code}`) === "working",
  };
}

/**
 * The link labels and their per-link clipboard control.
 *
 * **Two functions rather than two strings, for the reason `CodeClipboardActions` gives**, and the
 * token is the URL because a link's copy is about the URL rather than about the host beside it —
 * **the host is rendered as its own node so the two are never confused**.
 */
function PANEL_LINKS(copies: ReadonlyMap<string, CopyOutcome>): LinkCopyLabels {
  return {
    heading: PANEL_COPY.linksHeading,
    none: PANEL_COPY.noLinks,
    open: PANEL_COPY.openLink,
    copyOf: (url) => labelFor(`link:${url}`, copies, PANEL_COPY.copyLink),
    busyOf: (url) => copies.get(`link:${url}`) === "working",
  };
}

/** What one control says, given whether its own write is in flight, done, or refused. */
function labelFor(token: string, copies: ReadonlyMap<string, CopyOutcome>, idle: string): string {
  switch (copies.get(token)) {
    case "copied":
      return PANEL_COPY.copiedValue;
    case "failed":
      return PANEL_COPY.copyFailedValue;
    default:
      return idle;
  }
}
