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
 * ## What it added once: a mailbox chooser, and the two things it deliberately is not
 *
 * **The held list is a `radiogroup` of one control per mailbox (D6),** because `extension-client`
 * now says *offers* rather than *names* — **and *names* was true of an inert list, so nothing
 * shipped broken and this is an amendment rather than a repair.**
 *
 * **It is not a second spelling of the host rule (D3).** {@link resolveForHost} is still the only
 * thing that decides what a host means, and it is called exactly where it always was; the choice is
 * applied **on top of** its result, in one memo, and only for the host currently named.
 *
 * **It is not a durable preference (D2).** The selection is component state keyed by the host it was
 * made for, so *resets when the page changes* is a **derivation** rather than an effect somebody has
 * to remember to write, and **nothing is written anywhere** — see the note on
 * {@link PanelRecords.loadSiteMailboxId}, which is a read for that reason and stays one.
 *
 * ## What it added twice: removing what this device holds
 *
 * *Requirement: `extension-client` — **Where the side panel has established that this device holds
 * something, it SHALL offer a way to remove it and SHALL say what removing it means.***
 *
 * **Four hooks and no fifth — a `<section>`, an `<h2>`, `<p>`s, and `<button className="control">`
 * — every one of which a rule already selects** (`design.md` D5, naming the four). **Adding a class
 * hook or a stylesheet rule for this region is a declared failure of the change**, so the region's
 * appearance is a human judgement no gate stands for, and the rules that style it are the ones that
 * already styled the chooser above it.
 *
 * **Four shapes, chosen by what has been established rather than by what the person pressed**
 * (`tasks.md` 2.3, modelling `apps/web/src/LocalData.tsx:14`–`:35`): **the region renders nothing at
 * all until the boot read has finished**, because a branch reachable on an unknown value is a branch
 * that will eventually assert something unverified. **And the shape after a removal is not the "this
 * device holds nothing" shape**, because the first answers *"is there anything here?"* and the second
 * answers *"did that press work?"* — a panel that answered the second with the first would leave a
 * person who just pressed a button unable to tell.
 *
 * **The mailbox is untouched by the removal, and that is structural rather than a promise.** The
 * callback reaches {@link PanelRecords.clearAll} and nothing else: no `session.destroy()`, no
 * `closeMessage()`, no state that drives the inbox — see the note on {@link removeEverything}.
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
import { PANEL_COPY, PANEL_VERDICT_WORDING } from "./panel-copy";
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
 *
 * ## And the one member that removes rather than reads
 *
 * **`clearAll`, and it is the whole area rather than the records this panel knows.** The extension
 * keeps four record kinds over one `chrome.storage.local` area — the singular mailbox record, the
 * collection, the site associations, and the message ids this device has been told about
 * (`storage.ts:68`–`:73`) — and *this* type names none of them beyond the two reads above. **A
 * member named for the records it covers would name a subset**, and a removal that removed only the
 * four kinds this build knows would pass every test written against those four.
 *
 * **It is named after the contract's own member** (`packages/storage/src/contract.ts:141`), which is
 * the contract's own meaning, and `panel-main.tsx` passes it through the **singular** contract while
 * the area holds four kinds — which is exactly the shape `chrome.test.ts:235` was written for.
 *
 * **And it is still not a write member.** A surface that could both remove and record is a surface
 * whose write-back the next change could add without any rule noticing, so the property that the
 * panel does not restore what a person removed is discharged by **the type having no outlet** —
 * see the note on the chooser's state below, which this member must not weaken.
 */
export interface PanelRecords {
  /** Every mailbox this device holds, newest first. */
  readonly loadMailboxes: () => Promise<readonly Mailbox[]>;
  /** The mailbox this host was last used with, or `null` when there is none. */
  readonly loadSiteMailboxId: (host: string) => Promise<string | null>;
  /**
   * Remove **everything** this device holds for SpectreMail, through the storage contract.
   *
   * **A promise, because a removal the panel cannot wait for is a removal it cannot report on** —
   * and the report is the requirement's operative clause whatever the outcome.
   */
  readonly clearAll: () => Promise<void>;
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

/**
 * Which shape the removal region is in.
 *
 * **Six variants and four rendered shapes**, and `unknown` is the one that renders **nothing at
 * all** rather than a fifth shape: `LocalData.tsx:14`–`:35` gives the reason and it is the
 * requirement's ninth scenario — *"a branch reachable on an unknown value is a branch that will
 * eventually assert something unverified."* **So the panel may say neither that something is kept nor
 * that nothing is** until the boot read has finished.
 *
 * **`holdsNothing` and `removed` are both "there is nothing here" and they are different sentences**,
 * because they answer different questions — see {@link PANEL_COPY.removalDone}'s own note. Collapsing
 * them is the defect `LocalData.tsx:24`–`:29` records.
 *
 * **`working` is a shape rather than a flag on `confirmed`,** so the control that removes is rendered
 * from one place in both and the difference between *"you may press it"* and *"it is pressed"* is
 * the `disabled` attribute rather than a second button that exists only sometimes.
 */
type RemovalView =
  | { readonly kind: "unknown" }
  | { readonly kind: "holdsNothing" }
  | { readonly kind: "offering" }
  | { readonly kind: "confirmed" }
  | { readonly kind: "working" }
  | { readonly kind: "removed" };

/**
 * The region's own `data-testid`, per shape.
 *
 * **Two names and both are named rather than derived from the copy**, for `Panel.tsx:783`–`:788`'s
 * reason: a test that follows the wording rewords itself quietly. **`working` shares the confirmed
 * shape's name deliberately** — the control that removes exists in both, and a case asserting
 * *"it exists only after the further step"* wants to find it in either rather than to have it appear
 * and disappear around the assertion.
 */
const REMOVAL_TESTID: Readonly<Partial<Record<RemovalView["kind"], string>>> = {
  confirmed: "panel-removal-confirmed",
  working: "panel-removal-confirmed",
  removed: "panel-removal-removed",
};

/**
 * The platform's own words for a refusal.
 *
 * **Never a sentence written here, and never a fallback that claims anything.** The three branches
 * are *a message*, *a rejected string*, and *whatever the rejection was* — and the last is a last
 * resort rather than a chosen shape: an `Error` with an empty message would otherwise render
 * `"This did not happen. The browser said: "` and read as though the platform had said nothing at all,
 * which is a claim about the platform made by this product.
 */
function platformWords(failure: unknown): string {
  if (failure instanceof Error && failure.message.length > 0) {
    return failure.message;
  }

  if (typeof failure === "string" && failure.length > 0) {
    return failure;
  }

  return String(failure);
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

  /**
   * ## The removal, as three pieces of state rather than one
   *
   * **`confirming`, `working` and `removed` are separate booleans rather than one enum because they
   * are three independent facts**: a person may confirm, a removal may be refused and the person may
   * confirm again, and a removal that *has happened* is not undone by anything that happens after it.
   * A single enum would make "a removal happened and then the person pressed offer again" a state
   * the requirement never describes, and the region would need a rule about which of the two facts
   * wins.
   *
   * **`removed` is the only one that is not a view of the others**, and it is what makes the region
   * distinguish *"did that work?"* from *"is there anything here?"* — `removed` is a **derivation
   * from a completed removal** rather than from `held`, which this panel does **not** re-read after a
   * removal: re-reading would be a second claim about storage, and the mailbox must stay on screen
   * (`tasks.md` 2.5).
   */
  const [confirming, setConfirming] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [removed, setRemoved] = useState(false);
  const [removalRefusal, setRemovalRefusal] = useState<string | null>(null);

  /**
   * The mailbox a person chose for the host beside the panel, and **the host it was chosen for**.
   *
   * **Keyed by host rather than a bare id, and that is the whole of D2's transient decision.**
   * "A choice dies when the page changes" then needs no effect, no timer and no comparison: a
   * choice whose key is not the host currently named is simply not read, and the panel is asking
   * about the host beside it right now.
   *
   * **One entry rather than a map, because this panel shows one page at a time** — a map would be
   * storage for a history this surface has no way to revisit.
   *
   * **Nothing here is written anywhere**, and the requirement's *"SHALL NOT be recorded"* is
   * discharged by the *type* having no outlet: this state is never handed to a seam, never given a
   * mailbox id for a host, and `PanelRecords` has no write member at all.
   */
  const [chosen, setChosen] = useState<{
    readonly host: string;
    readonly mailboxId: string;
  } | null>(null);

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
   * The host this panel is resolving, as a value rather than a reading.
   *
   * **`""` for every reading that named no host, and that is `resolve-for-host.ts:90`'s own
   * vocabulary** — *"no host, no association"* — so the chooser's key and the rule's key are the same
   * key. A panel beside a page it cannot name resolves against no host, exactly as the in-page
   * affordance's controller does for a document with none.
   */
  const hostKey = reading.kind === "named" ? reading.host : "";

  /**
   * The mailbox this panel view is about, and the one decision this memo makes (D3).
   *
   * **The rule is asked first, and the choice replaces its answer rather than competing with it.**
   * `resolveForHost` is called with the same three arguments, at the same point in the same pipeline,
   * and its result is the answer whenever no choice applies — so a chooser that nobody uses is
   * byte-for-byte the panel that shipped before it.
   *
   * **A choice is read only when it was made for the host currently named**, which is the derivation
   * D2 asks for rather than an effect: there is nothing to reset, and nothing to forget to reset.
   *
   * **A choice naming a mailbox this device no longer holds falls back to the rule's answer**, for
   * the reason `resolveForHost` falls back to the newest for a stale association: offering to read
   * something that does not exist here is the hazard, and a chooser that could select an absent
   * mailbox would offer it.
   */
  const resolution = useMemo((): ResolvedMailbox | null => {
    const byRule = hostKey.length === 0 ? null : resolveForHost(held, hostKey, associated);
    const chosenId = chosen !== null && chosen.host === hostKey ? chosen.mailboxId : null;
    const chosenMailbox = chosenId === null ? undefined : held.find((each) => each.id === chosenId);

    return chosenMailbox === undefined
      ? byRule
      : { address: chosenMailbox.address, mailboxId: chosenMailbox.id };
  }, [associated, chosen, held, hostKey]);

  /**
   * The mailbox this panel is showing, and the reason it may be nothing at all.
   *
   * **`null` when no host was named is the requirement, not a limitation.** `design.md` D4: only an
   * answered host may offer a mailbox as being that page's, and a panel showing its newest address
   * beside an unnamed page is a panel inviting somebody to type another site's address into a form.
   *
   * **A choice does not move that guard (D4), and the guard is read from the *reading* rather than
   * from {@link resolution}.** A person who has chosen a different mailbox is still beside a page
   * this panel may name; a person beside a page it may not is still beside a page it may not, and
   * their pick does not make the panel able to say which mailbox belongs to it.
   */
  const shown = useMemo((): PanelMailbox => {
    if (reading.kind !== "named") {
      return { kind: "unnamed" };
    }

    return resolution === null ? { kind: "none" } : { kind: "named", mailbox: resolution };
  }, [reading, resolution]);

  /**
   * The whole record for the resolved id, which `resolveForHost` does not carry.
   *
   * **`undefined` is unreachable while the type is `named` and is treated as unreachable rather
   * than defaulted**, because the id came out of `held` above and cannot name a mailbox that is not
   * in it. Two consumers need the record rather than the id: `restore`, which takes a `Mailbox`,
   * and the provider name the address section's heading carries.
   */
  const record =
    shown.kind === "named" ? held.find((each) => each.id === shown.mailbox.mailboxId) : undefined;

  /**
   * The mailbox this host was last used with, read **directly** and not through {@link record}.
   *
   * **This is D4's "two sentences, two facts", and reading it through the view would break it.**
   * After a choice the two differ by design: the host sentence says what the host was *last used*
   * with, which is a fact about storage, while the address section says what this view is *about*,
   * which is a fact about the moment. **So this finds the associated id in `held` itself** — a choice
   * of the older mailbox would otherwise flip the host line to `hostAssociationGone` and tell a
   * person that the address they used on this site is no longer on their device, which is false.
   */
  const associatedRecord =
    associated === null ? undefined : held.find((each) => each.id === associated);

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
   *
   * **A chosen mailbox arrives here through the same door, and needs no arming of its own (D3).**
   * `record` is read from `shown`, which is read from `resolution`, so a press moves this effect's
   * input rather than adding a second effect that would race it. **The effect's own comparison is
   * what stops a press costing nothing** when the chosen mailbox is already the session's.
   */
  useEffect(() => {
    if (record === undefined) return;
    const current = session.current();
    if (holdsMailbox(current) && current.mailbox.id === record.id) return;
    void session.restore(record);
  }, [record, session]);

  /**
   * Make one of the offered mailboxes the mailbox this view is about.
   *
   * **The host is captured into the choice rather than read at render time**, and that is what makes
   * the reset a derivation: the key travels with the choice, so {@link resolution} can compare it
   * against the host beside the panel and read a choice that was not made for this page as though it
   * had not been made.
   *
   * **It writes nothing.** There is no seam here, no message and no storage call — which is the
   * requirement's *"SHALL NOT be recorded anywhere"* discharged structurally rather than by a rule
   * that scans for the absence of one.
   */
  const choose = useCallback(
    (mailboxId: string) => {
      setChosen({ host: hostKey, mailboxId });
    },
    [hostKey],
  );

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

  /**
   * Remove everything this device holds, and report whichever way it went.
   *
   * ## What this deliberately does NOT do, and it is the requirement's sixth scenario
   *
   * *Requirement: **WHEN** removal has happened and the person does nothing further **THEN** the
   * mailbox SHALL remain on screen **AND** its inbox SHALL remain usable **AND** the extension SHALL
   * write no storage record of that mailbox again.*
   *
   * **So: no `session.destroy()`, no `session.closeMessage()`, no `session.close()`, and no state
   * that drives the inbox is touched here or anywhere else on this path.** The mailbox is the
   * session's, and the only thing the removal is allowed to reach is the storage area. **Nothing is
   * written back either**, and that half is structural rather than promised: {@link PanelRecords} has
   * no write member, so there is nothing here that *could* write.
   *
   * **`held` is deliberately not re-read after a removal**, for the same reason: the address section
   * and the inbox are rendered from the session and from `held`, and a second `loadMailboxes()` after
   * a whole-area clear is a second claim about storage that this panel would have to keep true.
   *
   * ## The refusal claims nothing in either direction
   *
   * `packages/storage/src/chrome.ts:218` records that `chrome.storage` provides **no
   * `deleteDatabase` and therefore no blocked-removal event** — so unlike the website's IndexedDB
   * removal there is nothing queued that might complete later, and a rejection **is** the whole
   * answer. **A sentence saying the data is still here would be inventing a state the substrate
   * cannot be in, and a sentence saying it is gone would be inventing the other one**, so the
   * platform's own words are all this reports.
   *
   * **`confirming` goes back to false on a refusal** and the region returns to its offering shape with
   * the report beside it: the person who pressed the wrong thing needs a way forward, and the shape
   * that says *"this has not happened"* is a shape with a control on it.
   */
  const removeEverything = useCallback(async () => {
    setRemoving(true);
    setConfirming(false);
    setRemovalRefusal(null);

    try {
      await records.clearAll();
      setRemoved(true);
    } catch (failure) {
      setRemovalRefusal(platformWords(failure));
    } finally {
      setRemoving(false);
    }
  }, [records]);

  /**
   * The shape the removal region is in, decided by what has been established rather than by what the
   * person pressed.
   *
   * **`unknown` first, and it renders nothing at all** — `tasks.md` 2.3, on `LocalData.tsx:14`–`:35`'s
   * reasoning: before the boot read has finished this panel does not know whether this device holds
   * anything, so it may say neither that something is kept nor that nothing is.
   */
  const removal = ((): RemovalView => {
    if (!boot.done) {
      return { kind: "unknown" };
    }

    if (removed) {
      return { kind: "removed" };
    }

    if (removing) {
      return { kind: "working" };
    }

    if (confirming) {
      return { kind: "confirmed" };
    }

    return held.length === 0 ? { kind: "holdsNothing" } : { kind: "offering" };
  })();

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
   *
   * **The `named` arm reads {@link associatedRecord} and not {@link record}, and that is D4's whole
   * point.** Those two differ by design once a choice exists: `record` is what this view is *about*
   * and `associatedRecord` is what the host was *last used with*. **Reading the host sentence
   * through the view would let a person's choice rewrite a fact about storage** — telling them the
   * address they used on this site is no longer on their device because they picked a different one
   * to read.
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

        return associatedRecord === undefined
          ? PANEL_COPY.hostAssociationGone(reading.host)
          : PANEL_COPY.hostHasMailbox(reading.host, associatedRecord.address);
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

      {/**
       * **The mailbox inventory is withheld after a removal, and the mailbox itself is not.**
       *
       * *Requirement: **After a completed removal the panel SHALL report that it holds nothing for
       * SpectreMail, rather than continuing to render an inventory this device no longer has** **AND**
       * the mailbox SHALL remain on screen and its inbox SHALL remain usable afterwards.*
       *
       * **Those two clauses name two different regions, and reading them as one is how a panel ends up
       * either keeping a chooser over addresses this device has forgotten or taking the mailbox off
       * screen.** The inventory is `panel-held` — the *"Addresses on this device"* list and the choice
       * among them — and it is the half that would be an inventory of nothing. The mailbox is the
       * address section above and the inbox below, and it is the half a person is reading mail
       * through, so it stays exactly where it was.
       */}
      {held.length > 1 && !removed && (
        <section aria-labelledby="panel-held-heading">
          <h2 id="panel-held-heading">{PANEL_COPY.heldHeading}</h2>

          {/**
           * **A `radiogroup` and not a `<ul>`, and the reason is a rule rather than a preference.**
           * `role="radio"` has one permitted parent, and it is not `listitem` — so the list items
           * that used to be here would have made every entry an orphan of the group the requirement
           * asks for. **The section's own `<h2>` still names the list**; the group carries its own
           * `aria-label` naming what the list is *for*, so the two sentences do different work
           * (`panel-copy.ts` says why).
           *
           * **The gate above is unchanged, and it is a product decision rather than an
           * optimisation** (`design.md` D9): a device holding one mailbox is not given a chooser,
           * because a group of one offers no choice and would be a control set that cannot act on
           * anything.
           */}
          <div
            className="panel__held"
            role="radiogroup"
            aria-label={PANEL_COPY.heldGroup}
            data-testid="panel-held"
          >
            {held.map((each) => (
              /**
               * **One target per entry, `aria-checked` on it, and a visible difference besides
               * (D6).** `aria-checked` alone reads as correct to assistive technology and as *which
               * one?* to a person, which is why the class carries a `[aria-checked="true"]` rule as
               * well and why `showingMailbox` says it in words underneath.
               *
               * **The newest-first order is `loadMailboxes`' contract and is not re-sorted here** —
               * a chooser ordering by recency of use would be a second order for one list, and this
               * is the order the background wake lists too.
               */
              <button
                key={each.id}
                type="button"
                role="radio"
                aria-checked={resolution !== null && resolution.mailboxId === each.id}
                className="control panel__held-choice"
                onClick={() => choose(each.id)}
              >
                {PANEL_COPY.chooseMailbox(each.address)}
              </button>
            ))}
          </div>

          {/**
           * **Which mailbox this view is about, in words, and it renders whether or not anybody has
           * pressed anything.** D6's cost is that a person must be able to tell which entry is
           * current without a press, and this sentence plus the entry's own styling are the two
           * visible halves of that; `aria-checked` is the third and invisible one.
           *
           * **It sits inside the chooser rather than beside the address section**, because the
           * address section is not always rendered — beside a page this panel cannot name it is
           * withheld — and there this is the only sentence saying what the view is about.
           *
           * **A bare `<p>` and no new class hook**, because `.panel p` already styles it and a hook
           * nothing selects differently would be a rule added for its own sake.
           */}
          {resolution !== null && <p>{PANEL_COPY.showingMailbox(resolution.address)}</p>}
        </section>
      )}

      {/**
       * ## The removal region
       *
       * **Four hooks and no fifth (`design.md` D5):** a `<section>`, an `<h2>`, `<p>`s and
       * `<button className="control">`. **Every one of those is already selected by a rule that
       * exists** — `.panel section`, `.panel h2`, `.panel p` and `.control` — so this region adds no
       * class hook and no stylesheet rule, **and a fifth hook here is a declared failure of this
       * change** rather than a taste question. **The cost is stated rather than hidden: the region
       * cannot be made prettier, and it will not be.**
       *
       * **The shape is decided by what has been established, and `unknown` renders nothing at all**
       * (`tasks.md` 2.3) — before the boot read has finished the panel may say neither that something
       * is kept nor that nothing is.
       *
       * **The control that removes exists only from `confirmed` onwards.** That is the requirement's
       * *"the control that performs the removal SHALL exist only after a further explicit step"*,
       * and it is a property of the render rather than of the person remembering a dialog.
       *
       * **The further step is this region and not a dialog the platform owns** — the requirement says
       * so, and `chrome.windows`' own confirm is not reachable from here without a platform this
       * panel has no seam for. `LocalData.tsx:135`–`:172` is the shape the model is copied from, and
       * **not** its wording: every sentence below is `PANEL_COPY`'s.
       */}
      {removal.kind !== "unknown" && (
        <section aria-labelledby="panel-removal-heading" data-testid={REMOVAL_TESTID[removal.kind]}>
          <h2 id="panel-removal-heading">{PANEL_COPY.removalHeading}</h2>

          {/**
           * **A device holding nothing is told so and offered no removal at all**, rather than a
           * disabled control: a control that cannot act is a control misreporting what is available,
           * and this panel has refused that twice already (`createRefusal`, and the boot refusal above).
           */}
          {removal.kind === "holdsNothing" && <p>{PANEL_COPY.removalHoldsNothingYet}</p>}

          {removal.kind === "offering" && (
            <button
              type="button"
              className="control"
              onClick={() => setConfirming(true)}
              data-testid="panel-removal-offer"
            >
              {PANEL_COPY.removalOffers}
            </button>
          )}

          {/**
           * **Confirmed and in-flight render the same two controls, and differ only in `disabled`.**
           * That is deliberate: the pair is one decision — *remove, or keep what is here* — and
           * rendering it from one place means a change cannot add a third button to one shape and
           * forget the other.
           */}
          {(removal.kind === "confirmed" || removal.kind === "working") && (
            <>
              <p>{PANEL_COPY.removalConfirmWarning}</p>

              <button
                type="button"
                className="control"
                disabled={removal.kind === "working"}
                onClick={() => void removeEverything()}
                data-testid="panel-removal-confirm"
              >
                {removal.kind === "working" ? PANEL_COPY.removing : PANEL_COPY.removalConfirm}
              </button>

              <button
                type="button"
                className="control"
                disabled={removal.kind === "working"}
                onClick={() => setConfirming(false)}
                data-testid="panel-removal-keep"
              >
                {PANEL_COPY.removalKeep}
              </button>
            </>
          )}

          {/**
           * **The removed shape, and it is two sentences rather than one** because they answer two
           * different questions — *"did it work?"* and *"what did it do?"* — and the requirement makes
           * both claims separately. **The second is the one that must never say the address is gone**,
           * which is what {@link PANEL_COPY.removalDoneMeans} is for.
           */}
          {removal.kind === "removed" && (
            <>
              <p>{PANEL_COPY.removalDone}</p>
              <p>{PANEL_COPY.removalDoneMeans}</p>
            </>
          )}

          {/**
           * **The refusal is an alert and lives inside the region**, so it is read in the context of the
           * control that produced it. **`role="alert"` rather than plain text**, for the same reason
           * every other failure in this panel carries it: a refusal a person cannot notice is a
           * refusal that reported nothing.
           */}
          {removalRefusal !== null && (
            <p role="alert">{PANEL_COPY.removalRefused(removalRefusal)}</p>
          )}
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
            {/**
             * **The marking is asked for, and the panel is the only surface that asks.**
             *
             * `MessageList` is one component serving both surfaces, and `extension-client` forbids the
             * **popup** from indicating that a message carries a verification before it has opened it.
             * **So the prop's absence is what keeps the popup free of it, and its presence here is
             * this panel exercising a capability it owns.** The verdicts themselves are not passed:
             * they are already inside `state.inbox.listing.verdicts`, and each row reads its own -
             * **a second source handed in here could disagree with the rows it marks.**
             *
             * **And this costs nothing.** The panel already restores through the full
             * `session.restore`, which runs the verdict pass; this adds no request and reads no body.
             */}
            <MessageList
              state={state.kind === "ready" ? state.inbox : { kind: "notStarted" }}
              onOpen={(id) => void session.openMessage(id)}
              verdictWording={PANEL_VERDICT_WORDING}
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
