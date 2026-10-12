/**
 * The side panel, in jsdom.
 *
 * ## What this tier is for, given a browser tier exists
 *
 * The browser suite answers **"does this work"** — a real `chrome-extension://` panel document, a
 * real content script answering a real host request. It cannot cheaply walk every **state**, and the
 * states that matter for this surface are the ones a browser cannot be put into on demand: **a page
 * that answers nothing, a page that is not there, an association naming a mailbox this device has
 * since lost, a clipboard that refuses, a storage read that fails.**
 *
 * So the division is `Popup.test.tsx`'s, restated: **this tier answers "does every state say the
 * right thing".**
 *
 * ## The fixture never models a hang as a refusal, and the reason is a measurement this repository
 * already holds
 *
 * **`docs/PROVIDERS.md` §4.6 measured that a content script answering *nothing* still resolves.**
 * So `tabs.sendMessage` here **always calls back** — with an answer, or with `undefined` — because
 * a fake that simply never answered would model something the platform does not do, and the one
 * requirement it would falsify (`no answer arrives` ⇒ *say it cannot name the page*) is the one
 * whose true behaviour is the ambiguity §4.6 recorded. A fake that never calls back models a hang,
 * and a hang would leave the panel on *"Asking that page…"* forever, which reads as the same defect
 * and is not it.
 *
 * ## Every provider response is recorded
 *
 * Same rule as every other tier in this repository and for the same reason: **no test here contacts
 * a live provider**, and `use it externally` stays unverified.
 *
 * @vitest-environment jsdom
 */

import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createMailbox } from "@spectre-mail/core";
import type { Mailbox } from "@spectre-mail/core";
import type {
  InboxState,
  MailboxSession,
  MessageVerdict,
  SessionState,
} from "@spectre-mail/mailbox";

import { MessageList } from "./MessageSurface";
import { Panel } from "./Panel";
import type { PanelRecords } from "./Panel";
import { HOST_CONTEXT_REQUEST, fillCodeRequest, hostContextAnswer } from "./protocol";
import { PANEL_COPY, PANEL_VERDICT_WORDING } from "./panel-copy";

/** The mailbox a host resolves to in most of these cases. */
const MAILBOX: Mailbox = createMailbox({
  id: "session-token",
  address: "shadow@sharklasers.com",
  createdAt: 1_757_000_000_000,
  credentials: { provider: "guerrilla", sessionId: "session-token" },
});

/** A second mailbox this device holds, so "more than one" is reachable. */
const OLDER: Mailbox = createMailbox({
  id: "older-token",
  address: "older@sharklasers.com",
  createdAt: 1_756_000_000_000,
  credentials: { provider: "mailtm", accountId: "older", accessToken: "older-token" },
});

/**
 * A third mailbox, and the only reason it exists is that one case needs the **held set itself** to
 * change while a chooser is still on screen.
 *
 * **It is not a fixture added for tidiness: `loadMailboxes` is read once at boot and once after a
 * creation, so "this device no longer holds what a person chose" is reachable in this tier only
 * through the creation path.** A case that wanted the change to be *smaller* would re-read the
 * collection with no address going anywhere, and there is no such read on this surface — which is
 * itself the property `PanelRecords` documents.
 */
const NEWEST: Mailbox = createMailbox({
  id: "newest-token",
  address: "newest@sharklasers.com",
  createdAt: 1_758_000_000_000,
  credentials: { provider: "guerrilla", sessionId: "newest-token" },
});

/** One listed message, with the fields a row renders. */
const LISTED = {
  id: "m1",
  mailboxId: MAILBOX.id,
  provider: "guerrilla" as const,
  from: "no-reply@example.test",
  fromName: "Example",
  subject: "Your sign-in code",
  receivedAt: 1_757_000_000_000,
};

/** The opened message, carrying one detected code and one detected verification link. */
const OPENED = {
  ...LISTED,
  readable: "Your code is 493028",
  codes: [{ value: "493028", confidence: 0.85 }],
  links: [
    {
      url: "https://verify.example.test/confirm?t=abc",
      hostname: "verify.example.test",
      confidence: 0.7,
    },
  ],
};

/**
 * A refusal carrying the provider's own words, which the panel must not paraphrase.
 *
 * **The failing provider and the one that served are different providers by construction** — that is
 * what the requirement's scenario stages — so `providerFailures[0]` names `mailtm` while the mailbox
 * on screen was served by `guerrilla`.
 */
const FAILURE = {
  code: "PROVIDER_UNREACHABLE",
  description: "Mail.tm answered 503.",
  /**
   * **A one-element tuple rather than an array**, so a case may read `[0]` without a
   * non-null assertion. `noUncheckedIndexedAccess` is on for every workspace project, and
   * `providerFailures[0]!` in an assertion is a cast that invites the reader to believe the
   * element exists when nothing checks that it does.
   */
  providerFailures: [{ provider: "mailtm", description: "Mail.tm answered 503." }] as const,
};

/**
 * A session stub that actually publishes.
 *
 * **The reason is `Popup.test.tsx`'s and it is worth repeating:** the first such stub returned
 * `subscribe: () => () => undefined` and never published, so every assertion about a post-restore
 * state failed because the component never left the state it was constructed with. **A stub that
 * satisfies a type without implementing the behaviour the type describes is a fixture that hides
 * the code under test.**
 */
function stubSession(initial: SessionState) {
  let state = initial;
  const listeners = new Set<(next: SessionState) => void>();

  const publish = (next: SessionState): SessionState => {
    state = next;
    for (const listener of listeners) listener(next);
    return next;
  };

  /**
   * **Cast rather than `satisfies`, and the reason is that this surface only ever reads six of the
   * session's members.** A stub that implemented all ten would be a second implementation of the
   * lifecycle to satisfy a type checker, and the members this panel never calls would be the ones
   * with no cases — which is exactly the shape of a fixture that passes without being exercised.
   */
  return {
    current: () => state,
    subscribe: (listener: (next: SessionState) => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    open: vi.fn(async () => publish({ ...initial } as SessionState)),
    restore: vi.fn(async (stored: Mailbox | null) =>
      publish({
        kind: "ready",
        mailbox: stored ?? MAILBOX,
        inbox: { kind: "notStarted" },
        opened: null,
      } as unknown as SessionState),
    ),
    openMessage: vi.fn(async () =>
      publish({
        kind: "ready",
        mailbox: MAILBOX,
        inbox: { kind: "notStarted" },
        opened: { kind: "opened", message: OPENED },
      } as unknown as SessionState),
    ),
    closeMessage: vi.fn(),
  } as unknown as MailboxSession & {
    readonly open: ReturnType<typeof vi.fn>;
    readonly restore: ReturnType<typeof vi.fn>;
    readonly openMessage: ReturnType<typeof vi.fn>;
    readonly closeMessage: ReturnType<typeof vi.fn>;
  };
}

/** The records this surface reads, with both answers controllable and both failures available. */
function stubRecords(
  options: {
    readonly held?: readonly Mailbox[];
    /**
     * What the collection read answers **after the first one**.
     *
     * **`loadMailboxes` is read once at boot and once after a creation, and there is no third
     * call** — so "this device no longer holds what a person chose" is reachable in this tier only
     * by way of a creation, which is why the case that needs it also presses create. A fixture
     * that changed the answer on a call count with no creation behind it would be modelling a read
     * this surface does not perform.
     *
     * **The counter exists so the *first* read is unaffected.** The boot read is what decides
     * whether the panel asks the page anything at all, so a fixture whose boot answer depended on
     * whether a later creation had happened would be a fixture contradicting itself.
     */
    readonly heldAfter?: readonly Mailbox[];
    readonly association?: string | null;
    /**
     * A per-host association, consulted **before** `association`.
     *
     * **This is what makes "the page beside the panel changes" a fixture that can report a change.**
     * One `association` for every host would make a two-host case assert the fixture's own
     * repetition rather than the panel's reaction to two different facts — which is the fourth
     * recorded shape of a precondition satisfied before the thing under test happened.
     */
    readonly associations?: Readonly<Record<string, string | null>>;
    readonly collectionFails?: boolean;
    readonly associationFails?: boolean;
  } = {},
): PanelRecords & { askedForHost: string[]; collectionReads: number } {
  const askedForHost: string[] = [];
  let collectionReads = 0;

  return {
    askedForHost,
    get collectionReads() {
      return collectionReads;
    },
    loadMailboxes: async () => {
      if (options.collectionFails === true) {
        throw new Error("this device cannot say what it holds");
      }

      const read = collectionReads++;

      // **The first read is the boot read, and only later ones see a changed set.**
      return read === 0
        ? (options.held ?? [MAILBOX])
        : (options.heldAfter ?? options.held ?? [MAILBOX]);
    },
    loadSiteMailboxId: async (host: string) => {
      askedForHost.push(host);

      if (options.associationFails === true) {
        throw new Error("this device cannot say what this host used");
      }

      return options.associations?.[host] ?? options.association ?? null;
    },
  };
}

/**
 * Every entry of a chooser group, in DOM order, read as **the entry itself** rather than as the
 * region's text.
 *
 * **Why every case here reads the radios and not `panel-held.textContent`, in one place.**
 *
 * Before the chooser, an entry was a `<span>` whose whole text was the address, so
 * `group.textContent` said exactly which addresses the group named and in what order. **That is no
 * longer true**: an entry's own words are `PANEL_COPY.chooseMailbox(address)`, and the group carries
 * a sentence naming the mailbox it is showing. `textContent` therefore still *contains* every address
 * — so every old assertion keeps passing — while saying nothing about whether any of them is offered
 * **as a control that acts**. A reader counting addresses in one string would be satisfied by the
 * sentence underneath alone.
 *
 * **`addressOf` refuses to guess.** An entry whose text names none of the mailboxes it was given
 * returns the whole string, so an assertion comparing against an address list fails loudly rather than
 * passing on a substring match.
 */
function entriesOf(
  group: HTMLElement,
): { readonly text: string; readonly checked: string | null }[] {
  return [...group.querySelectorAll<HTMLElement>('[role="radio"]')].map((entry) => ({
    text: entry.textContent ?? "",
    checked: entry.getAttribute("aria-checked"),
  }));
}

/** The addresses the entries name, in the order they render, or the whole text where none matches. */
function addressesOf(group: HTMLElement, known: readonly Mailbox[]): string[] {
  return entriesOf(group).map(
    ({ text }) => known.find((mailbox) => text.includes(mailbox.address))?.address ?? text,
  );
}

/** The address a particular entry names, for a case that presses one and asks what became current. */
function pressedFor(mailbox: Mailbox): string {
  return PANEL_COPY.chooseMailbox(mailbox.address);
}

/**
 * The extension's platform, as this component's three seams see it.
 *
 * **`findActiveTab`, `sendToTab`, `sendToBackground` and `onTabActivated` all go through
 * `extension-platform.ts`, the only module allowed to read `chrome` — so a jsdom test drives them by
 * installing that one global rather than by passing them anything.**
 *
 * **`answerFor` is asked per request rather than fixed once**, because the panel sends two
 * different kinds of message to two different destinations and a fixture that answered both alike
 * would hide the whole seam.
 */
function installPlatform(options: {
  readonly host?: string;
  readonly hostByTab?: (tabId: number) => string | undefined;
  readonly hostAnswer?: unknown;
  readonly answer?: (request: unknown) => unknown;
  readonly createAnswer?: unknown;
  readonly noActiveTab?: boolean;
}) {
  const asked: unknown[] = [];
  const delivered: unknown[] = [];
  const created: unknown[] = [];
  const activations: Array<(activation: unknown) => void> = [];
  let active = 7;

  const chrome = {
    tabs: {
      query: (_query: unknown, callback: (found: unknown) => void) => {
        callback(options.noActiveTab === true ? [] : [{ id: active }]);
      },
      sendMessage: (_tabId: number, request: unknown, callback: (reply: unknown) => void) => {
        if (HOST_CONTEXT_REQUEST === request) {
          asked.push(request);
          // **`hostAnswer` is asked for separately from `host`,** because two different facts have
          // to be staged independently: a page that answered *nothing* at all (`undefined`) and a
          // page that ran and reported nothing usable (`{ kind: "unconfirmed" }`). §4.6 measured
          // that the first two are indistinguishable from the platform's side, and `Panel.tsx`
          // carries one union for both — so a fixture could offer only one of them.
          //
          // **`hostByTab` is what a tab switch needs**, because the panel re-asks on every
          // activation and a switch that answered with one fixed host would make "the page beside
          // the panel changes" unreachable — the fixture would be asserting a change the platform
          // never reported.
          const host = options.hostByTab === undefined ? options.host : options.hostByTab(_tabId);

          callback(
            options.hostAnswer !== undefined
              ? options.hostAnswer
              : host === undefined
                ? undefined
                : hostContextAnswer(host),
          );
          return;
        }

        delivered.push(request);
        callback(options.answer === undefined ? undefined : options.answer(request));
      },
      onActivated: {
        addListener: (listener: (activation: unknown) => void) => activations.push(listener),
        removeListener: (listener: (activation: unknown) => void) => {
          const at = activations.indexOf(listener);
          if (at >= 0) activations.splice(at, 1);
        },
      },
    },
    runtime: {
      sendMessage: (request: unknown, callback: (reply: unknown) => void) => {
        created.push(request);
        callback(options.createAnswer);
      },
    },
  };

  Object.defineProperty(globalThis, "chrome", { value: chrome, configurable: true });

  return {
    asked,
    delivered,
    created,
    /**
     * Make another tab active and fire the platform's activation event, which is what `design.md`
     * D5 measured arriving in a context holding no `tabs` permission.
     */
    activate: (tabId: number) => {
      active = tabId;
      for (const listener of [...activations]) listener({ tabId });
    },
  };
}

/** A clipboard that answers, and records every value it was given. */
function grantingClipboard() {
  const written: string[] = [];

  Object.defineProperty(globalThis.navigator, "clipboard", {
    value: {
      writeText: async (value: string) => {
        written.push(value);
      },
    },
    configurable: true,
  });

  return written;
}

/** A clipboard that refuses every write, which `jsdom` cannot do on its own. */
function refusingClipboard() {
  Object.defineProperty(globalThis.navigator, "clipboard", {
    value: {
      writeText: async () => {
        throw new Error("the clipboard refused");
      },
    },
    configurable: true,
  });
}

describe("the panel renders the mailbox beside the page", () => {
  const ORIGINAL_PLATFORM = Object.getOwnPropertyDescriptor(globalThis, "chrome");

  /**
   * **Restore the global after every case, and this file is the reason it has to be said.**
   *
   * `globalThis` is shared with every other test in the process, and a leaked `chrome` would let a
   * later case pass by finding a platform nobody installed.
   */
  afterEach(() => {
    if (ORIGINAL_PLATFORM === undefined) {
      Reflect.deleteProperty(globalThis, "chrome");
    } else {
      Object.defineProperty(globalThis, "chrome", ORIGINAL_PLATFORM);
    }

    cleanup();
  });

  /** A panel showing one ready session, and the platform answering with a host. */
  function renderPanel(
    options: {
      readonly session?: ReturnType<typeof stubSession>;
      readonly records?: ReturnType<typeof stubRecords>;
      readonly state?: SessionState;
    } = {},
  ) {
    const session =
      options.session ??
      stubSession(
        options.state ??
          ({
            kind: "ready",
            mailbox: MAILBOX,
            inbox: { kind: "checked", listing: { messages: [LISTED], verdicts: new Map() } },
            opened: null,
          } as unknown as SessionState),
      );

    const records = options.records ?? stubRecords({ held: [MAILBOX], association: MAILBOX.id });

    render(<Panel session={session} records={records} primaryProviderName="Mail.tm" />);

    return { session, records };
  }

  it("names the mailbox this page resolves to and the provider that served it", async () => {
    installPlatform({ host: "signup.example.test" });

    renderPanel();

    // **The address section's heading is the provider that served the mailbox, not the one this
    // client reaches first** — a mailbox served by the fallback is never described by the
    // preference that was tried first.
    expect(await screen.findByRole("heading", { name: "guerrilla" })).toBeDefined();
    expect(screen.queryByText("Mail.tm")).toBeNull();
    expect(screen.getByText(MAILBOX.address)).toBeDefined();

    /**
     * **The positive control for the `panel-address` absence assertion in the case below**, and it
     * is here rather than there because this is the arm where the section is supposed to be on
     * screen.
     *
     * **Without it that absence assertion is satisfied by anything.** `queryByTestId` returns
     * `null` when *no element carries the id* — so a panel that rendered the section with the id
     * deleted from it, or with the section deleted from it, or a panel that rendered nothing at
     * all, would all satisfy *"still offers no mailbox as being that page's"*. **A falsification
     * arm caught exactly that**: removing `data-testid="panel-address"` left the whole suite green.
     * That is this repository's recorded *narrower than its rule* shape, and the repair is a case
     * that fails when the id is absent from a panel that **should** be showing the section.
     */
    expect(screen.getByTestId("panel-address").textContent).toContain(MAILBOX.address);
  });

  it("lists what the last check found and opens the one that is pressed", async () => {
    const platform = installPlatform({ host: "signup.example.test" });
    const { session } = renderPanel();

    await screen.findByText("Your sign-in code");

    /**
     * **The ninth recorded *precondition* defect, the first this file's own surface shipped, and the
     * repair is a wait rather than a relaxed assertion.**
     *
     * **What the red measured.** Thirty `pnpm verify` runs of this change's tree produced exactly
     * one red, and it was this case: `AssertionError: expected [] to have a length of 1 but got +0`
     * on the last line. It was reproduced once in 87 full-gate runs and did not occur in 55 cheaper
     * runs, so it is **load-sensitive** — a property of one execution's timing and not of the code
     * it names.
     *
     * **The wait above cannot establish what this assertion reads, and reading the two together is
     * the whole finding.** `findByText("Your sign-in code")` resolves from **synchronous**
     * `session` state — the stub session publishes its listing on construction — so it returns as
     * soon as the row is on the page. **The thing this case then asserts about is the platform round
     * trip, which is asynchronous and is gated on `boot.done`** (`Panel.tsx`'s boot effect sets it
     * only after `await records.loadMailboxes()` resolves, and the host effect returns early until
     * it is true). **So the wait released the case while the read it asserted on had not happened
     * yet**, and `asked === []` meant *the panel had not asked* rather than *the panel asked twice*.
     * It is the same defect this repository has recorded against `Popup.spec.ts`'s *"waiting for the
     * address to appear does not wait for the `saveMailbox` write"*, on a different surface: **a
     * visible signal and the work behind it are not the same moment**, and one of the two here is
     * synchronous.
     *
     * **The repair waits on the panel's own output rather than on the recorder, and that choice is
     * the reason it is not circular.** `asked.push` happens when the question is asked; the host
     * sentence renders only after `resolveThePage` has published the reading **and** awaited
     * `loadSiteMailboxId`, so *"the host line stopped saying it was asking"* is strictly **later**
     * than the push. **A `waitFor` on `platform.asked` itself would also pass — four cases in this
     * file already use that shape — but it would wait on the very thing being counted**, and the
     * count assertion is the one thing this case adds to the listing it already covers.
     */
    await waitFor(() => {
      expect(screen.getByTestId("panel-host").textContent).not.toMatch(/asking/i);
    });

    // **Named by what the control says, not by a fragment of it** — "Read" is the row's whole
    // accessible name, and matching `/open/i` would have found nothing at all while looking as
    // though it had looked in the right place.
    fireEvent.click(screen.getByRole("button", { name: "Read" }));

    expect(session.openMessage).toHaveBeenCalledWith("m1");
    // **The host question was asked once, and the listing cost nothing of the panel's own** — the
    // listing came from the session the popup also drives. **The count is still an exact count**:
    // the wait above establishes *at least one*, and this line is what would fail a second ask.
    expect(platform.asked).toHaveLength(1);
  });

  /**
   * **The panel's own message guard, which a mutation found nothing asserted.**
   *
   * **This case exists because a falsification arm aimed at it went green, and the reason it went
   * green is the fourth recorded instance of the same shape: the assertion I first added was in the
   * wrong case.** It went into *"lists what the last check found and opens the one that is pressed"*,
   * asserting the message view is absent before the press — and that case's fixture **already has a
   * message open**, so the assertion was false on arrival and the arm was caught by a test that was
   * already red rather than by the mutation. **A catcher that was failing before the mutation is not
   * a catcher**, and it is the same defect as a mutation that never compiled being filed as a catch.
   *
   * **The guard has two halves, and each half needs a state the other does not cover.** `opened` is
   * `null` when the session has no `opened` member at all — which is every state that has not had a
   * message opened in it — and `opened.kind === "none"` when a message *was* opened and held
   * nothing. **The mutation under test removes only the second half**, so a case that staged the
   * first would have satisfied it and passed.
   */
  it("renders no message surface when there is no message, and none when it held nothing", async () => {
    installPlatform({ host: "signup.example.test" });

    const noOpenedAtAll = stubSession({
      kind: "ready",
      mailbox: MAILBOX,
      inbox: { kind: "checked", listing: { messages: [LISTED], verdicts: new Map() } },
    } as unknown as SessionState);

    const rendered = renderPanel({ session: noOpenedAtAll });

    /**
     * **The listing is still rendered**, so what is asserted absent is the *opened* surface and not
     * the panel working — an assertion that cannot tell those two apart is satisfied by a panel that
     * rendered nothing at all. **This is also where the first version of this case went wrong: it
     * asserted `message-list` was null, and `message-list` is the inbox listing, not the opened
     * message** — a reader pointed at the wrong element, which is the same defect as a sweep whose
     * pattern matches the wrong thing.
     *
     * **And `panel-message` is the assertion that makes this case falsifiable at all.** Asserting
     * the codes and links are absent cannot see the mutation, because `OpenedMessageView` renders
     * **nothing** for the `none` variant: the mutation's only observable is an empty heading inside a
     * region. **The region is what the guard controls, so the region is what is asserted.**
     */
    expect(await screen.findByText("Your sign-in code")).toBeDefined();
    expect(screen.queryByTestId("message-list")).not.toBeNull();
    expect(screen.queryByTestId("panel-message")).toBeNull();
    expect(screen.queryByTestId("code-list")).toBeNull();
    expect(screen.queryByTestId("link-list")).toBeNull();

    // **`cleanup` rather than a second `render`,** because two panels on one document would both be
    // answering `queryByTestId` and the second half of the case would be satisfied by the first.
    cleanup();
    void rendered;

    // **And the other half: a message that was opened and held nothing.** The view reads
    // `opened.message`, which this variant does not carry, so rendering it is a crash rather than an
    // empty box — and a crash is what the guard is preventing.
    renderPanel({
      session: stubSession({
        kind: "ready",
        mailbox: MAILBOX,
        inbox: { kind: "checked", listing: { messages: [LISTED], verdicts: new Map() } },
        opened: { kind: "none" },
      } as unknown as SessionState),
    });

    expect(await screen.findByText("Your sign-in code")).toBeDefined();
    expect(screen.queryByTestId("message-list")).not.toBeNull();
    expect(screen.queryByTestId("panel-message")).toBeNull();
    expect(screen.queryByTestId("code-list")).toBeNull();
    expect(screen.queryByTestId("link-list")).toBeNull();
  });

  it("shows the codes and links of a message opened in the panel", async () => {
    installPlatform({ host: "signup.example.test" });
    const session = stubSession({
      kind: "ready",
      mailbox: MAILBOX,
      inbox: { kind: "checked", listing: { messages: [LISTED], verdicts: new Map() } },
      opened: { kind: "opened", message: OPENED },
    } as unknown as SessionState);

    renderPanel({ session });

    expect(await screen.findByText("493028")).toBeDefined();
    // **The destination's host is its own node beside the control**, because a control whose own
    // accessible name carried the host would be a control whose name changed with every link.
    expect(screen.getByText("verify.example.test")).toBeDefined();
    expect(screen.getByRole("link", { name: /open/i }).getAttribute("href")).toBe(
      "https://verify.example.test/confirm?t=abc",
    );
  });

  it("gives every detected code its own clipboard control", async () => {
    const written = grantingClipboard();
    installPlatform({ host: "signup.example.test" });
    const session = stubSession({
      kind: "ready",
      mailbox: MAILBOX,
      inbox: { kind: "notStarted" },
      opened: { kind: "opened", message: { ...OPENED, links: [] } },
    } as unknown as SessionState);

    renderPanel({ session });

    fireEvent.click((await screen.findAllByRole("button", { name: /copy code/i }))[0]!);

    expect(written).toEqual(["493028"]);
  });

  it("reports a refused clipboard write rather than a copy", async () => {
    refusingClipboard();
    installPlatform({ host: "signup.example.test" });
    const session = stubSession({
      kind: "ready",
      mailbox: MAILBOX,
      inbox: { kind: "notStarted" },
      opened: { kind: "opened", message: { ...OPENED, links: [] } },
    } as unknown as SessionState);

    renderPanel({ session });

    const control = (await screen.findAllByRole("button", { name: /copy code/i }))[0]!;
    fireEvent.click(control);

    // **The refusal is reported in the control's own label rather than as a success this product
    // invented**, and it names the way out — the value is on screen, so nothing is lost.
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /the clipboard refused/i })).toBeDefined();
    });
    expect(screen.queryByText("Copied.")).toBeNull();
  });

  it("puts a link's URL on the clipboard rather than its host", async () => {
    const written = grantingClipboard();
    installPlatform({ host: "signup.example.test" });
    const session = stubSession({
      kind: "ready",
      mailbox: MAILBOX,
      inbox: { kind: "notStarted" },
      opened: { kind: "opened", message: OPENED },
    } as unknown as SessionState);

    renderPanel({ session });

    // **Named exactly rather than matched on `/copy/`,** because a message with both a code and a
    // link renders two controls whose names both contain that word.
    fireEvent.click(await screen.findByRole("button", { name: "Copy this link" }));

    expect(written).toEqual(["https://verify.example.test/confirm?t=abc"]);
  });

  it("hands a code to the page beside the panel and reports what it answered", async () => {
    const platform = installPlatform({
      host: "signup.example.test",
      answer: () => ({ kind: "filled" }),
    });
    const session = stubSession({
      kind: "ready",
      mailbox: MAILBOX,
      inbox: { kind: "notStarted" },
      opened: { kind: "opened", message: { ...OPENED, links: [] } },
    } as unknown as SessionState);

    renderPanel({ session });

    fireEvent.click((await screen.findAllByRole("button", { name: /fill in code/i }))[0]!);

    // **The request is the popup's, unchanged** — the panel is beside the active tab rather than
    // replacing it, so it asks the same place the popup does. **Waited for rather than read after
    // the click**, because `onFill` is `void`-ed and the delivery runs after two awaits.
    await waitFor(() => {
      expect(platform.delivered).toEqual([fillCodeRequest("493028")]);
    });
    // **`filled` is the only outcome that claims the page now holds the code**, so it is the one
    // the report has to become.
    await waitFor(() => {
      expect(screen.getByRole("status").textContent).toMatch(/\w/);
    });
  });

  it("reports a provider failure rather than an empty listing", async () => {
    installPlatform({ host: "signup.example.test" });
    renderPanel({
      state: {
        kind: "ready",
        mailbox: MAILBOX,
        inbox: {
          kind: "checkFailed",
          listing: { messages: [LISTED], verdicts: new Map() },
          failure: FAILURE,
        },
        opened: null,
      } as unknown as SessionState,
    });

    // **The failure is attributed to the provider that failed, not the one that served the
    // mailbox** — by construction those are two different providers, and a report naming the one
    // that answered would be describing a provider that worked. **The provider id is read as the
    // failure carries it**, rather than as the panel chose to spell it.
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("mailtm");
    expect(alert.textContent).not.toContain("guerrilla");
    expect(alert.textContent).toContain("Mail.tm answered 503.");
    // **And the listing it already had is kept**, because a failure is a condition of the inbox
    // rather than the loss of it.
    expect(screen.getByText("Your sign-in code")).toBeDefined();
  });

  it("says an address that no longer receives mail rather than reporting an empty inbox", async () => {
    installPlatform({ host: "signup.example.test" });
    renderPanel({
      state: {
        kind: "expired",
        mailbox: MAILBOX,
        opened: null,
      } as unknown as SessionState,
    });

    expect(await screen.findByText(/that address no longer exists/i)).toBeDefined();
    expect(screen.queryByText(/no mail has arrived/i)).toBeNull();
  });

  it("names the mailboxes this device holds, and only mailboxes it holds", async () => {
    installPlatform({ host: "signup.example.test" });
    renderPanel({ records: stubRecords({ held: [MAILBOX, OLDER], association: OLDER.id }) });

    const list = await screen.findByTestId("panel-held");

    /**
     * **Read through the entries rather than through the container's `textContent`, and that is what
     * this case's re-point was for.**
     *
     * Every entry is now a control whose own words are *"Show `<address>` in this panel"*, and the
     * group carries a sentence saying which mailbox it is showing. **`textContent` would still
     * contain both addresses, so the old assertions would have kept passing while asserting less**
     * — the whole region's text would satisfy "names this address" whether the address was in an
     * entry, in the sentence underneath, or in a comment that had not been typed yet. Reading the
     * entries restores what the case was written to say.
     *
     * **One array against two addresses says both halves of the case at once** — it is exactly
     * `held`, and it is `held` in order. **The order is read from the array of entries rather than
     * from two `indexOf` calls on one string**, because a single string cannot say *which entry* came
     * first: it says only that one address appears before another, which a group whose heading
     * happened to name the newer mailbox would satisfy.
     */
    expect(addressesOf(list, [MAILBOX, OLDER])).toEqual([MAILBOX.address, OLDER.address]);

    // **Each entry reads as a control that acts rather than as text**, which is what `extension-client`
    // now requires of the list — and it is the half `textContent` could never have said. A chooser
    // offering a mailbox this device cannot find would also be offering to read something that does
    // not exist here, so the addresses are matched exactly rather than by containment.
    expect(entriesOf(list).map((entry) => entry.text)).toEqual([
      PANEL_COPY.chooseMailbox(MAILBOX.address),
      PANEL_COPY.chooseMailbox(OLDER.address),
    ]);
  });

  it("offers to create when this device holds nothing, and names no address as being that page's", async () => {
    installPlatform({ host: "signup.example.test" });
    // **A session that holds nothing either**, because the first version of this case left it
    // `ready` with a mailbox and then asserted no inbox rendered - a fixture contradicting itself.
    // A device holding no mailbox cannot have one in its session, so the two agree here.
    const { session } = renderPanel({
      session: stubSession({ kind: "idle" } as unknown as SessionState),
      records: stubRecords({ held: [] }),
    });

    const control = await screen.findByRole("button", { name: "Create an address" });

    expect(control).toBeDefined();
    // **No address at all, and no inbox** - the panel may not offer a mailbox as being a page's when
    // it holds none, and it must not have *opened* one either.
    expect(session.open).not.toHaveBeenCalled();
    expect(screen.queryByText(MAILBOX.address)).toBeNull();
    expect(screen.queryByTestId("message-list")).toBeNull();
  });

  it("asks the background context to create rather than contacting a provider itself", async () => {
    const platform = installPlatform({ host: "signup.example.test" });
    renderPanel({
      session: stubSession({ kind: "idle" } as unknown as SessionState),
      records: stubRecords({ held: [] }),
    });

    fireEvent.click(await screen.findByRole("button", { name: "Create an address" }));

    // **The worker contacts the provider and arms the alarm itself**, so this surface asks for no
    // arming of its own and reaches no provider origin.
    await waitFor(() => {
      expect(platform.created).toHaveLength(1);
    });
    expect(platform.delivered).toEqual([]);

    /**
     * **And it asked the worker to *create*.**
     *
     * **The count above was not enough, and a mutation found it: sending the worker a reconcile
     * request instead leaves `created` holding exactly one message, so the length assertion and the
     * no-delivery assertion both passed while the panel asked for the wrong thing entirely.** The
     * title names *"to create"* and the case had been carrying *"to the background"*.
     *
     * **Spelled by hand rather than imported from `protocol.ts`,** for the reason
     * `protocol.test.ts` spells its kinds: an assertion built from the constant under test moves
     * with it. This is the same rule as *"an assertion that imports the value under test cannot
     * fail when the value changes"*, and it is applied in the direction where it protects.
     */
    expect(platform.created).toEqual([{ kind: "spectre:create-mailbox" }]);
  });

  it("refuses to create at all while its own storage cannot be read", async () => {
    installPlatform({ host: "signup.example.test" });
    const { session } = renderPanel({
      records: stubRecords({ held: [], collectionFails: true }),
    });

    // **No control rather than a disabled one** — a button that cannot act is a control
    // misreporting the choice as unavailable.
    expect(await screen.findByRole("alert")).toBeDefined();
    expect(screen.queryByRole("button")).toBeNull();
    expect(session.open).not.toHaveBeenCalled();
  });
});

describe("the panel names the page beside it", () => {
  const ORIGINAL_PLATFORM = Object.getOwnPropertyDescriptor(globalThis, "chrome");

  afterEach(() => {
    if (ORIGINAL_PLATFORM === undefined) {
      Reflect.deleteProperty(globalThis, "chrome");
    } else {
      Object.defineProperty(globalThis, "chrome", ORIGINAL_PLATFORM);
    }

    cleanup();
  });

  /**
   * A ready session holding `MAILBOX`, which is what every host case resolves to.
   *
   * **The inbox is `notStarted` rather than `checked`, and the reason is that no host case is about
   * a listing.** It also makes one assertion mean something: with a mailbox present and no listing,
   * "offers no mailbox as being that page's" is a claim about the *address section* — the only part
   * of this panel that ever says a mailbox belongs to the page beside it.
   */
  function readySession() {
    return stubSession({
      kind: "ready",
      mailbox: MAILBOX,
      inbox: { kind: "notStarted" },
      opened: null,
    } as unknown as SessionState);
  }

  /**
   * Mount a panel and wait until it has finished asking the page about itself.
   *
   * **The platform is returned as well as the session**, because a choice is only worth making if
   * something can afterwards be asked of it: the tab switch that must carry the choice back to the
   * rule's answer, and the tab switch that must not. Without the platform a case could establish a
   * selection and then assert nothing about what happens afterwards — which is the recorded shape
   * of `design.md` D10's reworded scenario, whose whole content is *"and it is still there"*.
   */
  async function mount(
    options: {
      readonly host?: string;
      readonly hostByTab?: (tabId: number) => string | undefined;
      readonly hostAnswer?: unknown;
      readonly noActiveTab?: boolean;
    },
    records: PanelRecords,
  ) {
    const platform = installPlatform(options);
    const session = readySession();

    render(<Panel session={session} records={records} primaryProviderName="Mail.tm" />);

    await waitFor(() => {
      expect(screen.getByTestId("panel-host").textContent).not.toMatch(/asking/i);
    });

    /**
     * **Flushed explicitly, because "the host line stopped saying it was asking" is one commit
     * before the panel has finished resolving.**
     *
     * `resolveThePage` publishes the reading and *then* awaits the association lookup, so the host
     * line is already final while `associated` — and therefore which mailbox `restore` is handed —
     * is still in flight. **`waitFor` returns the moment its predicate holds**, which is exactly one
     * render too early here: one case red on a `restore` spy that had not been called yet, which
     * would have been filed as a product defect and is a fixture that stopped one commit early.
     *
     * **An empty `act` is the instrument for "the pending round trip has landed", not a delay.**
     */
    await act(async () => undefined);

    return { session, platform };
  }

  it("names the host the page beside it reported, and the mailbox last used on it", async () => {
    await mount(
      { host: "signup.example.test" },
      stubRecords({ held: [MAILBOX], association: MAILBOX.id }),
    );

    const line = screen.getByTestId("panel-host");
    expect(line.textContent).toContain("signup.example.test");
    expect(line.textContent).toContain(MAILBOX.address);
  });

  it("says it holds no address for a host it has never used one on", async () => {
    await mount(
      { host: "signup.example.test" },
      stubRecords({ held: [MAILBOX], association: null }),
    );

    const line = screen.getByTestId("panel-host");
    expect(line.textContent).toContain("signup.example.test");
    expect(line.textContent).toMatch(/no address has been used here/i);
  });

  it("refuses the association when it names a mailbox this device no longer holds", async () => {
    // **The case a pair of sentences cannot express:** an address *was* used here, and it is gone.
    // `hostHasNoMailbox` would be a lie and `hostHasMailbox` would name the newest mailbox as this
    // host's, which is the one false association this milestone must never give.
    await mount(
      { host: "signup.example.test" },
      stubRecords({ held: [MAILBOX, OLDER], association: "a-mailbox-this-device-has-lost" }),
    );

    const line = screen.getByTestId("panel-host");
    expect(line.textContent).toContain("signup.example.test");
    expect(line.textContent).not.toContain(MAILBOX.address);
    expect(line.textContent).not.toContain(OLDER.address);
    expect(line.textContent).toMatch(/no longer on this device/i);
  });

  it("asks the newly active tab again when the tab changes, with no reload", async () => {
    const records = stubRecords({ held: [MAILBOX], association: MAILBOX.id });
    const platform = installPlatform({ host: "first.example.test" });
    const session = readySession();

    render(<Panel session={session} records={records} primaryProviderName="Mail.tm" />);

    await waitFor(() => {
      expect(platform.asked).toHaveLength(1);
    });

    // **A tab switch behind a different content script**, which is the whole event: the panel
    // re-asks rather than reloading. §4.6 measured that `chrome.tabs.onActivated` fires to a
    // context holding no `tabs` permission, so this needs no polling interval at all.
    platform.activate(9);

    await waitFor(() => {
      expect(platform.asked).toHaveLength(2);
    });

    // **The same host both times**, because this fixture's stub answers every tab alike - and that
    // is stated rather than papered over: what is under test here is *that it asked again without a
    // reload*, not that two pages disagree. Two real documents with two different hosts is staged
    // in the browser tier, where it can be.
    expect(records.askedForHost.filter((host) => host === "first.example.test")).toHaveLength(2);
  });

  it("says it cannot name a page that answered nothing, and offers no mailbox as that page's", async () => {
    // **`hostAnswer` is left unset, so the callback receives `undefined`** - which docs/PROVIDERS.md
    // §4.6 measured is exactly what a page this extension does not reach produces, and which
    // `readHostContextAnswer` reads as a refusal rather than as an empty host.
    await mount({}, stubRecords({ held: [MAILBOX], association: MAILBOX.id }));

    expect(screen.getByTestId("panel-host").textContent).toMatch(/not one SpectreMail runs on/i);
    // **The address section is gone with the claim** - a panel showing its newest mailbox beside an
    // unnamed page is a panel inviting somebody to type another site's address into a form.
    expect(screen.queryByText(MAILBOX.address)).toBeNull();
    expect(screen.queryByTestId("message-list")).toBeNull();
  });

  it("distinguishes a page that ran and reported nothing usable from one that never answered", async () => {
    // **The half of `HostReading` that really is distinguishable**, and the reason it is a separate
    // variant: the script ran, it was asked, and it had nothing to give - which is not the same
    // fact as there being no script at all.
    await mount(
      { hostAnswer: hostContextAnswer(undefined) },
      stubRecords({ held: [MAILBOX], association: MAILBOX.id }),
    );

    expect(screen.getByTestId("panel-host").textContent).toMatch(/did not say which host/i);
    expect(screen.queryByText(MAILBOX.address)).toBeNull();
  });

  it("says it cannot name a page this extension does not reach, and the rest keeps working", async () => {
    installPlatform({ noActiveTab: true });
    const session = readySession();

    render(
      <Panel
        session={session}
        records={stubRecords({ held: [MAILBOX, OLDER], association: MAILBOX.id })}
        primaryProviderName="Mail.tm"
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("panel-host").textContent).toMatch(/not one SpectreMail runs on/i);
    });
    // **A page this extension does not reach is not a fault in the panel**, so the rest of it keeps
    // working: the mailboxes this device holds are still offered, each as a control.
    expect(addressesOf(screen.getByTestId("panel-held"), [MAILBOX, OLDER])).toEqual([
      MAILBOX.address,
      OLDER.address,
    ]);
  });

  /**
   * **The create control beside a page this panel cannot name.**
   *
   * **Four cases because the decision has four parts, and one assertion each would let three of them
   * rot independently.** They were added together with the code they hold (`design.md` A17), and the
   * whole group is the orchestrator's decision rather than a reading of the delta — the delta said
   * only that *"the rest of the panel SHALL continue to work"*, which names nothing and is why a
   * product decision was needed at all.
   */
  describe("offering creation beside a page this panel cannot name", () => {
    /** A page that ran and had nothing usable, beside a device holding two addresses. */
    async function mountUnnamed() {
      return mount(
        { hostAnswer: hostContextAnswer(undefined) },
        stubRecords({ held: [MAILBOX, OLDER], association: MAILBOX.id }),
      );
    }

    it("offers creation, and a press asks the background context to create", async () => {
      const platform = installPlatform({ hostAnswer: hostContextAnswer(undefined) });

      render(
        <Panel
          session={readySession()}
          records={stubRecords({ held: [MAILBOX, OLDER], association: MAILBOX.id })}
          primaryProviderName="Mail.tm"
        />,
      );

      const control = await screen.findByRole("button", {
        name: PANEL_COPY.createForUnnamedPage,
      });

      expect(control).toBeDefined();

      fireEvent.click(control);

      // **Spelled as the message kind rather than as `CREATE_MAILBOX_REQUEST`**, because an
      // assertion built from the constant under test moves with it — `protocol.test.ts` holds this
      // rule for every kind it narrows.
      await waitFor(() => {
        expect(platform.created).toEqual([{ kind: "spectre:create-mailbox" }]);
      });
    });

    it("still offers no mailbox as being that page's", async () => {
      await mountUnnamed();

      /**
       * **The hazard the requirement exists to prevent, and the reason creation was offered rather
       * than *showing* a mailbox.** A newly created mailbox belongs to no host, which is not the same
       * fact as a mailbox being offered as this page's.
       *
       * **The first version of this case asserted the addresses were absent from the page, and was
       * wrong in the direction that hides a defect**: this device holds two mailboxes and the held
       * list renders both under "Addresses on this device" — which is `held.length > 1`, independent
       * of `shown.kind`, and which this repair deliberately left alone. **The claim is that no
       * mailbox is offered *as being that page's*, and that is the address section**, so the section
       * is what is asserted.
       */
      expect(screen.queryByTestId("panel-address")).toBeNull();
      expect(screen.queryByTestId("panel-message")).toBeNull();
      expect(screen.queryByTestId("message-list")).toBeNull();

      /**
       * **And the inventory this device does hold is still offered**, under its own heading — the
       * positive control. Without it, "no mailbox offered" would be satisfied by a panel that had
       * simply rendered nothing, which is the fake-UI defect this whole repair exists to remove.
       *
       * **Read through the entries, because the chooser added a second way for an address to be on
       * this page.** The sentence naming the mailbox this view is showing carries one too, so
       * `textContent` would satisfy both assertions from that sentence alone — which is a claim about
       * a mailbox the device holds, offered as something a person can act on. That is not what this
       * control asserts, and it is not what the requirement asks for here.
       */
      const heldList = screen.getByTestId("panel-held");

      expect(addressesOf(heldList, [MAILBOX, OLDER])).toEqual([MAILBOX.address, OLDER.address]);
    });

    it("does not claim this device holds nothing", async () => {
      // **This device holds two**, which is what makes the claim checkable: the sentence would be
      // true for the wrong reason on an empty device, and false here.
      await mountUnnamed();

      expect(screen.queryByText(PANEL_COPY.noMailboxHeld)).toBeNull();
    });

    it("names no host in the copy it offers", async () => {
      await mountUnnamed();

      const control = await screen.findByRole("button", {
        name: PANEL_COPY.createForUnnamedPage,
      });

      /**
       * **The rendered control's own words, asserted here rather than only through the query above.**
       *
       * `findByRole({ name })` failing is a catch by *absence*, and its attribution is then every
       * case that queried by name at once. **This assertion reads what is on screen**, so this case
       * fails on its own when the panel renders the host-specific variant — which is the defect this
       * case names.
       */
      expect(control.textContent).toBe(PANEL_COPY.createForUnnamedPage);

      // **Spelled out rather than imported as the host-specific string's absence**, because the
      // claim is that these particular words say nothing about a host — which is what
      // `createForHost` beside a named host says by leaving the host out. **The host itself is
      // checked by name as well**, so a sentence naming *some* host fails rather than satisfying a
      // sweep for the word "host".
      expect(control.textContent).not.toMatch(/host|site|domain/i);
      expect(control.textContent).not.toContain("signup.example.test");
      // **And it is a different string from the named-host variant**, so a reader pointed at the
      // wrong constant cannot satisfy this by rendering the host-specific words.
      expect(PANEL_COPY.createForUnnamedPage).not.toBe(PANEL_COPY.createForHost);
    });

    /**
     * **Both unnamed arms in one case, so neither can rot apart from the other.**
     *
     * `unanswered` and `refused` are **two reasons for reaching one panel state** — `Panel.tsx`'s
     * `shown` memo returns `{ kind: "unnamed" }` for every reading that is not `named` — so creation
     * is gated on `shown` and both arms get it identically. **A case per arm would let one rot**: a
     * future change could distinguish them and half the suite would stay green.
     *
     * **The two fixtures below are the whole risk this case carries, and the last assertion is what
     * discharges it.** If both arms somehow produced the *same* reading, the loop would pass while
     * proving nothing — so the case requires the two host lines to differ, and matches each against
     * the wording that belongs to its own reason. **`mountUnnamed` covers only the unanswered arm**,
     * which is why this case exists rather than extending that helper.
     */
    it("offers creation beside either kind of page it cannot name", async () => {
      const arms = [
        {
          options: { hostAnswer: hostContextAnswer(undefined) },
          hostLine: /did not say which host/i,
        },
        {
          /** **No `hostAnswer` at all**, so the callback receives `undefined` — which §4.6 measured. */
          options: {},
          hostLine: /not one SpectreMail runs on/i,
        },
      ] as const;

      const offered: (string | null)[] = [];
      const hostLines: (string | null)[] = [];

      for (const [index, arm] of arms.entries()) {
        /**
         * **Cleanup between the arms, explicitly.** Two `render` calls in one test leave two
         * containers in the document, and `screen` queries across all of them — so the second
         * `findByRole` would fail with *found multiple elements* rather than with anything about the
         * product. `afterEach(cleanup)` cannot help, because it runs once at the end.
         */
        if (index > 0) cleanup();

        await mount(arm.options, stubRecords({ held: [MAILBOX, OLDER], association: MAILBOX.id }));

        offered.push(
          (await screen.findByRole("button", { name: PANEL_COPY.createForUnnamedPage }))
            .textContent,
        );
        hostLines.push(screen.getByTestId("panel-host").textContent);
      }

      expect(offered).toEqual([PANEL_COPY.createForUnnamedPage, PANEL_COPY.createForUnnamedPage]);

      for (const [index, arm] of arms.entries()) {
        expect(hostLines[index]).toMatch(arm.hostLine);
      }

      /** **The two arms are genuinely two readings, not one fixture run twice.** */
      expect(hostLines[0]).not.toBe(hostLines[1]);
    });
  });

  it("never asks the page for a host before it knows what this device holds", async () => {
    const platform = installPlatform({ host: "signup.example.test" });
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const records: PanelRecords = {
      loadMailboxes: async () => {
        await gate;
        return [MAILBOX];
      },
      loadSiteMailboxId: async () => MAILBOX.id,
    };

    render(<Panel session={readySession()} records={records} primaryProviderName="Mail.tm" />);

    // **While the boot read is outstanding the panel shows nothing and asks nothing.** A page
    // question is only meaningful against a device that knows its own contents, and asking first
    // would mean a host answered for a device that has said nothing yet.
    await waitFor(() => {
      expect(screen.getByText(/reading what this device saved/i)).toBeDefined();
    });
    expect(platform.asked).toHaveLength(0);

    release?.();

    await waitFor(() => {
      expect(platform.asked).toHaveLength(1);
    });
  });

  it("restores the mailbox this page resolves to and never opens a new one", async () => {
    const { session } = await mount(
      { host: "signup.example.test" },
      stubRecords({ held: [OLDER, MAILBOX], association: OLDER.id }),
    );

    // **The host resolves to the mailbox this page was last used with, not the newest one** — so
    // the session is handed *that* mailbox.
    expect(session.restore).toHaveBeenCalledWith(OLDER);
    // **And it is restored rather than opened:** handing the session `null` delegates to `open()`,
    // which would create an address the moment the panel is beside a page.
    expect(session.open).not.toHaveBeenCalled();
  });

  it("costs no restore when a tab switch resolves to the mailbox already showing", async () => {
    const records = stubRecords({ held: [OLDER, MAILBOX], association: OLDER.id });
    const platform = installPlatform({ host: "first.example.test" });
    const session = stubSession({
      kind: "ready",
      mailbox: OLDER,
      inbox: { kind: "notStarted" },
      opened: null,
    } as unknown as SessionState);

    render(<Panel session={session} records={records} primaryProviderName="Mail.tm" />);

    await waitFor(() => {
      expect(screen.getByTestId("panel-host").textContent).toContain("first.example.test");
    });

    platform.activate(9);

    await waitFor(() => {
      expect(platform.asked).toHaveLength(2);
    });

    // **A second page resolving to the mailbox already on screen costs nothing.** `restore`
    // reconciles by asking the provider, so re-running it on every switch would be a request per
    // tab change for a mailbox the panel is already showing.
    expect(session.restore).not.toHaveBeenCalled();
  });

  /**
   * **The chooser, and every case here is a decision about where a choice stops applying.**
   *
   * **`design.md` D2 made the choice carry the host it was made for**, and that is why these are
   * seven cases rather than one: a choice that is simply a mailbox id would satisfy the first case
   * and every one of the other six, and `D10`'s two regression guards are exactly the two that would
   * catch it. **Each is proven by a mutation rather than by reading the implementation** — see
   * `tasks.md` 6.3 — because the failure this guards against is a panel that *looks* right beside
   * one page and carries somebody else's mailbox into another.
   */
  describe("choosing a mailbox beside the page", () => {
    /** Two addresses on this device, and this host last used the newer of them. */
    const HELD = [MAILBOX, OLDER] as const;

    /**
     * Press the entry for one mailbox and wait for the panel to publish the consequence.
     *
     * **Waited rather than read straight after the click**, because `choose` is a `setState` and
     * the restore it triggers is `void`-ed — the same reason the fill case waits on `delivered`.
     */
    async function press(mailbox: Mailbox) {
      fireEvent.click(await screen.findByRole("radio", { name: pressedFor(mailbox) }));

      await waitFor(() => {
        expect(screen.getByTestId("panel-held")).toBeDefined();
      });
    }

    it("makes the chosen mailbox the one the panel shows, and hands the session that one", async () => {
      const { session } = await mount(
        { host: "signup.example.test" },
        stubRecords({ held: HELD, association: MAILBOX.id }),
      );

      // **The positive control for everything below it.** Without a selection established first,
      // every assertion about what a choice changed is satisfied by a panel that never had one —
      // and `D10`'s reworded scenario (*"a chosen mailbox is still there"*) is satisfied for the
      // wrong reason by a chooser nobody pressed. This is the repository's recorded *precondition*
      // shape, and this arm is where it would otherwise have been filed as coverage.
      expect(screen.getByTestId("panel-address").textContent).toContain(MAILBOX.address);

      await press(OLDER);

      // **The address section follows the choice** — D4's whole content.
      expect(screen.getByTestId("panel-address").textContent).toContain(OLDER.address);
      expect(screen.getByTestId("panel-address").textContent).not.toContain(MAILBOX.address);

      // **Exactly one restore, naming the chosen record.** `restore` reconciles by asking the
      // provider, so a choice that restored twice would cost two requests to show one mailbox —
      // and the count is asserted rather than the call, because "last called with" is satisfied by
      // a second call that happened to agree with it.
      expect(session.restore).toHaveBeenCalledTimes(1);
      expect(session.restore).toHaveBeenCalledWith(OLDER);
      // **And never a creation**: the panel beside a page must not make an address.
      expect(session.open).not.toHaveBeenCalled();

      // **Both entries are still offered, and only the chosen one is checked.** Offering only the
      // chosen mailbox would make this a `<p>`, which is what the panel shipped before this change
      // and what D9 forbids.
      const held = screen.getByTestId("panel-held");
      expect(addressesOf(held, HELD)).toEqual([MAILBOX.address, OLDER.address]);
      expect(entriesOf(held).map((entry) => entry.checked)).toEqual(["false", "true"]);

      // **And it says in words which mailbox it is about**, because `aria-checked` alone reads as
      // correct to assistive technology and as *which one?* to a person (D6).
      expect(screen.getByText(PANEL_COPY.showingMailbox(OLDER.address))).toBeDefined();
    });

    it("still says what the host was last used with, while showing somebody else's choice", async () => {
      /**
       * **The D4 guard, and it exists because two values in this component are nearly the same
       * thing.**
       *
       * `record` is what the view is *about*; `associatedRecord` is what the host was *last used
       * with*. Before a choice they are the same value, so a host sentence reading the wrong one is
       * indistinguishable from a correct panel — **right up until somebody chooses.** Reading
       * `record` here would rewrite the sentence to say the choice was *this host's*, which is the
       * one thing a transient choice must never claim.
       *
       * **And this is the arm that catches it.** The mutation is a one-word change from
       * `associatedRecord` to `record`, and nothing else in the suite can see it: the address
       * section, the `aria-checked` values and the session are all identical either way.
       */
      await mount(
        { host: "signup.example.test" },
        stubRecords({ held: HELD, association: MAILBOX.id }),
      );

      await press(OLDER);

      const line = screen.getByTestId("panel-host");
      expect(line.textContent).toContain("signup.example.test");
      expect(line.textContent).toContain(MAILBOX.address);
      // **And not the chosen one** — this is the half that fails under the mutation, because the
      // sentence's other half still passes.
      expect(line.textContent).not.toContain(OLDER.address);
      // **Spelled as a claim rather than as a pattern**, so a sentence rewritten in other words
      // fails rather than satisfying a sweep for one phrase.
      expect(line.textContent).not.toMatch(/no longer on this device/i);
    });

    it("keeps the choice when the same host is asked about again", async () => {
      /**
       * **`D10`'s reworded scenario — "a chosen mailbox is still there" — and the positive control
       * is the half that matters.**
       *
       * The panel re-asks on every tab activation (§4.6 measured `chrome.tabs.onActivated` reaching a
       * context holding no `tabs` permission), so a naive `resolution` recomputed from
       * `chosen.mailboxId` alone would be overwritten by the rule's answer the moment the same host
       * reported again. **A fixed `host` makes both activations name the same page**, so the only
       * thing that could drop the choice is the recomputation itself.
       *
       * **Without the pre-switch assertion this case passes on a panel whose choice never took**,
       * which is why the establishment of the selection is not left to the previous case: each case
       * here has to establish its own precondition, because `design.md` D10's sentence is about
       * persistence and persistence is not established by a neighbouring test.
       */
      const { session, platform } = await mount(
        { hostByTab: () => "signup.example.test" },
        stubRecords({ held: HELD, association: MAILBOX.id }),
      );

      await press(OLDER);
      expect(screen.getByTestId("panel-address").textContent).toContain(OLDER.address);

      const restoresBefore = session.restore.mock.calls.length;

      platform.activate(9);

      await waitFor(() => {
        expect(platform.asked).toHaveLength(2);
      });

      expect(screen.getByTestId("panel-address").textContent).toContain(OLDER.address);
      expect(entriesOf(screen.getByTestId("panel-held")).map((entry) => entry.checked)).toEqual([
        "false",
        "true",
      ]);
      expect(screen.getByText(PANEL_COPY.showingMailbox(OLDER.address))).toBeDefined();

      /**
       * **And the re-ask cost no second restore of the same mailbox**, which is the older guard's
       * property and must survive the choice: `restore` reconciles with the provider, so re-running
       * it on every activation would be a request per tab change for a mailbox already showing.
       *
       * **Asserted as a count rather than as the call list**, because a count is what the claim is:
       * "no cost" is not "the same argument again".
       */
      expect(session.restore).toHaveBeenCalledTimes(restoresBefore);
      expect(session.open).not.toHaveBeenCalled();
    });

    it("returns to the rule's answer when the page beside the panel changes", async () => {
      /**
       * **The first of `D10`'s two regression guards, and the one that makes the choice's host key
       * load-bearing.**
       *
       * A choice with no host key survives *every* host change, so this panel would keep showing the
       * mailbox a person picked beside a **different site** — the panel's whole hazard, and the one
       * `resolve-for-host.ts` exists to prevent for associations. **The fixture has to be able to
       * report a different host**, so `hostByTab` answers per tab and `associations` is consulted per
       * host: with one fixed `association` both hosts would resolve to the same mailbox and the
       * assertion would be satisfied by the fixture's own repetition.
       *
       * **The chosen mailbox is deliberately one the *first* host does not resolve to**, so a press
       * is a real change and the pre-switch reading cannot be mistaken for it.
       */
      const { platform } = await mount(
        {
          hostByTab: (tabId) => (tabId === 7 ? "first.example.test" : "second.example.test"),
        },
        stubRecords({
          held: [MAILBOX, OLDER, NEWEST],
          // **The three mailboxes are distinct on purpose.** `OLDER` is the choice and `NEWEST` is
          // what the *second* host resolves to, so *"the choice carried over"* and *"the rule
          // decided again"* are two different readings. **A fixture whose second host resolved to
          // the chosen mailbox could not tell them apart** — and this case existed to be the one
          // that can.
          associations: { "first.example.test": MAILBOX.id, "second.example.test": NEWEST.id },
        }),
      );

      // **The page beside the panel is `first.example.test`, which resolves to `MAILBOX`.**
      expect(screen.getByTestId("panel-host").textContent).toContain("first.example.test");
      expect(screen.getByTestId("panel-address").textContent).toContain(MAILBOX.address);

      await press(OLDER);
      expect(screen.getByTestId("panel-address").textContent).toContain(OLDER.address);

      platform.activate(9);

      await waitFor(() => {
        expect(screen.getByTestId("panel-host").textContent).toContain("second.example.test");
      });

      /**
       * **The rule's answer for the *new* host, and not the choice.**
       *
       * This is the assertion that makes `D10`'s first regression guard falsifiable. A choice with
       * no host key satisfies every other assertion in this case — the host sentence still names
       * `second.example.test`, because `associatedRecord` is re-read per host either way — and
       * fails **only here**, because `OLDER` is not what `second.example.test` resolves to.
       */
      expect(screen.getByTestId("panel-address").textContent).toContain(NEWEST.address);
      expect(screen.getByTestId("panel-address").textContent).not.toContain(OLDER.address);
      expect(screen.getByText(PANEL_COPY.showingMailbox(NEWEST.address))).toBeDefined();

      // **And the entry is checked on the mailbox the rule reached for**, so the difference is in
      // the chooser and not only in the sentence above it.
      expect(entriesOf(screen.getByTestId("panel-held")).map((entry) => entry.checked)).toEqual([
        "false",
        "false",
        "true",
      ]);

      /**
       * **And the host sentence moved with the page** — it names what *the new host* was last used
       * with, which is `NEWEST`, not the mailbox a person had chosen for the old one. This is
       * `D4`'s two-values rule again, in the only configuration where the two can differ, and it
       * is the second half of the guard: under a choice with no host key the address section is
       * wrong *and* the sentence is wrong, and a case asserting only one of them would report a
       * catch it had only half earned.
       */
      expect(screen.getByTestId("panel-host").textContent).toContain("second.example.test");
      expect(screen.getByTestId("panel-host").textContent).toContain(NEWEST.address);
      expect(screen.getByTestId("panel-host").textContent).not.toContain(OLDER.address);
    });

    it("changes only what is shown when the page beside it cannot be named", async () => {
      /**
       * **`D10`'s second regression guard, and it is the half that is easy to get wrong in the
       * *helpful* direction.**
       *
       * `hostKey` is `""` for every reading that named no host, so a choice made there is recorded
       * against `""` and matches `hostKey` on the next resolution — which is what lets a person
       * choose beside a page the panel cannot name at all. **The alternative "repair" would be to
       * suppress the chooser beside an unnamed page**, and that would be the *loss* of a capability
       * to prevent a leak: it would make this case pass by removing the feature.
       *
       * **So the assertions are all about what did not change.** A choice changes what the panel
       * shows; it must not make the panel able to say which mailbox belongs to the page, because
       * the panel still cannot name the page.
       */
      const { session } = await mount(
        { hostAnswer: hostContextAnswer(undefined) },
        stubRecords({ held: HELD, association: MAILBOX.id }),
      );

      // **Nothing is claimed about the page, before anything is chosen** — the precondition this
      // case's later assertions depend on.
      expect(screen.queryByTestId("panel-address")).toBeNull();

      await press(OLDER);

      // **Still no address section**, and still no inbox: a choice moved the view, not the panel's
      // knowledge of the page.
      expect(screen.queryByTestId("panel-address")).toBeNull();
      expect(screen.queryByTestId("message-list")).toBeNull();
      // **And no restore** — D3's *"a chosen mailbox needs no arming of its own"* has to hold for the
      // unnamed arm too, and a restore here would hand the session a mailbox for a page this panel
      // cannot name, which is the hazard `panel-address`'s absence exists to prevent.
      expect(session.restore).not.toHaveBeenCalled();
      expect(session.open).not.toHaveBeenCalled();

      // **Both entries are still offered and the chosen one is checked**, which is what says the
      // choice took effect at all: a panel that ignored the press satisfies every absence
      // assertion above.
      const held = screen.getByTestId("panel-held");
      expect(addressesOf(held, HELD)).toEqual([MAILBOX.address, OLDER.address]);
      expect(entriesOf(held).map((entry) => entry.checked)).toEqual(["false", "true"]);
      expect(screen.getByText(PANEL_COPY.showingMailbox(OLDER.address))).toBeDefined();
    });

    it("refuses a chosen mailbox this device no longer holds", async () => {
      /**
       * **The stale-choice arm, and reaching it needs a creation because the collection is read
       * exactly twice.**
       *
       * `PanelRecords` documents that: `loadMailboxes` is read once at boot and once after a
       * creation, and there is no third call. **A fixture that changed the answer on a call count
       * with no creation behind it would be modelling a read this surface does not perform**, which
       * is why this case presses *create* and rides the second read rather than reaching for a
       * fake the panel does not have.
       *
       * **The fallback is to the rule's answer rather than to nothing**, and the rule is `null` for
       * an unnamed host — so the arms are chosen to tell those apart: `MAILBOX` survives the
       * creation as this host's mailbox, so "falls back to the rule" and "shows nothing" are two
       * different readings and the assertions below distinguish them.
       */
      const platform = installPlatform({
        hostAnswer: hostContextAnswer(undefined),
        // **A `created` answer is what makes the panel re-read the collection at all** — every other
        // answer reports and returns without reading (`Panel.tsx`'s `create`), so a fixture that
        // staged the refused arm would leave the held set unchanged and this case would pass for the
        // wrong reason.
        createAnswer: { kind: "created", address: NEWEST.address, mailboxId: NEWEST.id },
      });
      const session = readySession();
      const records = stubRecords({
        held: HELD,
        heldAfter: [NEWEST, MAILBOX],
        association: MAILBOX.id,
      });

      render(<Panel session={session} records={records} primaryProviderName="Mail.tm" />);

      await screen.findByTestId("panel-held");

      // **The choice is established and shown first** — without this, "no longer checked" is
      // satisfied by a chooser that was never pressed.
      await press(OLDER);
      expect(entriesOf(screen.getByTestId("panel-held")).map((entry) => entry.checked)).toEqual([
        "false",
        "true",
      ]);

      // **The creation is what changes the held set.** `NEWEST` is handed in as the answer rather
      // than being fabricated by the panel, so the case is about the *choice* going stale and not
      // about what a creation produces.
      fireEvent.click(await screen.findByRole("button", { name: PANEL_COPY.createForUnnamedPage }));

      await waitFor(() => {
        expect(platform.created).toEqual([{ kind: "spectre:create-mailbox" }]);
      });

      await waitFor(() => {
        expect(records.collectionReads).toBeGreaterThan(1);
      });

      // **`OLDER` is gone from what this device holds, so nothing is checked** — a chooser able to
      // select an absent mailbox would be offering to read something that does not exist here, and
      // that is the same hazard `resolve-for-host.ts` guards against for a stale association.
      expect(screen.queryByText(PANEL_COPY.showingMailbox(OLDER.address))).toBeNull();
      expect(entriesOf(screen.getByTestId("panel-held")).map((entry) => entry.checked)).toEqual([
        "false",
        "false",
      ]);

      // **And the stale choice fell back to the rule's answer, which here is nothing at all** — the
      // page named no host, so `byRule` is `null` and the panel shows nothing. **That is the arm
      // that distinguishes *"refused"* from *"silently showed the newest"*, and it is asserted as
      // an absence rather than by naming a mailbox this panel has no grounds to name**: `MAILBOX`
      // is still held, and a chooser falling back to the newest would have named it.
      expect(screen.queryByText(PANEL_COPY.showingMailbox(NEWEST.address))).toBeNull();
      expect(screen.queryByText(PANEL_COPY.showingMailbox(MAILBOX.address))).toBeNull();
      expect(screen.queryByTestId("panel-address")).toBeNull();
    });

    it("writes nothing when a person chooses", async () => {
      /**
       * **The write-avoidance claim, and it is asserted with a recorder rather than with a spy on
       * the two read methods.**
       *
       * `PanelRecords` is a read-only contract — it has no write member at all — so a panel that
       * wrote anything would have to reach `chrome.storage` through `extension-platform.ts`, which
       * this unit tier does not install. **A recorder over the two reads is therefore a statement
       * about the panel's own behaviour, not about the platform's**, and the non-empty positive
       * control is what stops it being vacuous: a recorder that recorded nothing would satisfy
       * "no new reads" without ever having watched one.
       */
      const reads: string[] = [];
      const records: PanelRecords = {
        loadMailboxes: async () => {
          reads.push("loadMailboxes");

          return [...HELD];
        },
        loadSiteMailboxId: async (host) => {
          reads.push(`loadSiteMailboxId:${host}`);

          return MAILBOX.id;
        },
      };

      const { session, platform } = await mount({ host: "signup.example.test" }, records);

      /**
       * **The positive control: the recorder has watched real reads, so its silence afterwards
       * means something.** Without it, "the call list is unchanged" is satisfied by a recorder that
       * recorded nothing at all.
       */
      expect(reads).toEqual(["loadMailboxes", "loadSiteMailboxId:signup.example.test"]);

      await press(OLDER);

      expect(screen.getByTestId("panel-address").textContent).toContain(OLDER.address);

      // **No read of either kind happened because of the press.** The boot read is the whole list,
      // and it is asserted as the *exact* list rather than as its length: a length would be
      // satisfied by a re-read of one method in place of another.
      expect(reads).toEqual(["loadMailboxes", "loadSiteMailboxId:signup.example.test"]);
      // **And the platform was asked about the page exactly once**, so the choice did not re-ask
      // the content script — a re-ask is what would let a *changed* host quietly replace the
      // choice rather than the rule replacing it.
      expect(platform.asked).toHaveLength(1);
      expect(session.restore).toHaveBeenCalledTimes(1);
      expect(session.restore).toHaveBeenCalledWith(OLDER);
    });

    it("offers a device holding exactly one mailbox no chooser to choose with", async () => {
      /**
       * **The gate, and it is the half of `tasks.md` 3.2's *"a case asserting the gate"* that the
       * falsification pass found missing rather than merely unproven.**
       *
       * **`held.length > 1` had a positive half and no negative one.** Seven chooser cases and four
       * other arms all hold two or more addresses, so the `> 2` mutation was caught by nine cases
       * while the `> 0` mutation — which gives a device holding exactly one mailbox a chooser of one —
       * left the whole file green. **That is the recorded shape of a check narrower than its rule, and
       * it is here in the half nobody reads:** a gate proven to open at two is not a gate proven to
       * stay shut at one, and only one of those two directions was held by anything.
       */
      await mount(
        { host: "signup.example.test" },
        stubRecords({ held: [MAILBOX], association: MAILBOX.id }),
      );

      /**
       * **The positive control, and it is what makes the absence below mean anything.**
       *
       * `resolution` is `resolveForHost(held, hostKey, associated)` — **the held list is an argument
       * to the rule, not a decoration beside it** — so the address section naming this device's one
       * mailbox is proof that `held` was read and resolved against. Without it, *"offers no chooser"*
       * is satisfied by a panel whose held list never arrived at all, which is the whole of what
       * `queryByTestId` cannot tell apart: an absent element and an element whose `data-testid` was
       * deleted read identically.
       */
      expect(screen.getByTestId("panel-address").textContent).toContain(MAILBOX.address);

      // **The gate itself, read as the absence of the group.**
      expect(screen.queryByTestId("panel-held")).toBeNull();

      // **And read as the absence of a control, which is how a person meets it** — a `radiogroup` of
      // one is a group offering no choice, and a control set that cannot act on anything is exactly
      // what `design.md` D9 refuses to ship. Asserting only the `data-testid` above would be
      // satisfied by a chooser that rendered every entry and dropped the id.
      expect(screen.queryByRole("radio")).toBeNull();
      expect(screen.queryByRole("radiogroup")).toBeNull();

      // **And the sentence about which mailbox is on screen is withheld with it**, because that
      // sentence is part of the chooser and would otherwise be a lone "this panel is showing …" line
      // on a panel that offers nothing to show instead.
      expect(screen.queryByText(PANEL_COPY.showingMailbox(MAILBOX.address))).toBeNull();
    });

    it("names the chooser group for what it is for, from the one copy entry that says so", async () => {
      /**
       * **The group's own accessible name, and it exists because `panel-copy.ts` says why the list
       * carries two sentences rather than one.**
       *
       * The `<h2>` above the group names *the list*; the group's `aria-label` names *what the list is
       * for*, and `panel-copy.test.ts` holds the second sentence's words. **What nothing held was the
       * binding between them**: rewiring `aria-label={PANEL_COPY.heldGroup}` to a literal left every
       * case green, because the copy suite tests the module and the panel suite tests the entries —
       * and neither one reads the sentence the other one owns. **Two suites each holding one end of a
       * wire is this repository's recorded `heldGroup: CHOOSER` shape arriving one level up.**
       */
      await mount(
        { host: "signup.example.test" },
        stubRecords({ held: HELD, association: MAILBOX.id }),
      );

      // **The positive control: the group is on screen and it is a group.** Without it, a name
      // assertion is satisfied by a panel that renders no chooser at all.
      const group = screen.getByTestId("panel-held");
      expect(group.getAttribute("role")).toBe("radiogroup");
      expect(group.querySelectorAll('[role="radio"]')).toHaveLength(HELD.length);

      // **The binding itself, read the way assistive technology reads it** — by accessible name over
      // the role, rather than by the attribute, so a group that carried the sentence somewhere
      // `aria-label` does not reach would fail rather than pass.
      expect(screen.getByRole("radiogroup", { name: PANEL_COPY.heldGroup })).toBe(group);
      expect(group.getAttribute("aria-label")).toBe(PANEL_COPY.heldGroup);

      // **And it is not the heading's sentence**, so the two are still doing different work - the
      // `<h2>` names the list, the group names its purpose, and one string doing both would mean one
      // of the two claims was never made.
      expect(PANEL_COPY.heldGroup).not.toBe(PANEL_COPY.heldHeading);
    });
  });
});

/**
 * ## What the panel says about each message, and what the shared listing says without being asked
 *
 * **`panel-mailbox-choice`'s group 7.2 left a comment in `MessageSurface.tsx` saying the slice that
 * ships the indicator owns this, and this is that slice.** The cases below are the unit half of the
 * delta's seven scenarios; the browser half is `side-panel.spec.ts`, and **both tiers hold the same
 * properties for the reason this file's header gives** - a browser cannot be put into every state on
 * demand, and *"a listing whose verdicts are not all determined"* is one of them.
 *
 * **And the last case is not a panel case at all.** It renders `MessageList` directly with **no**
 * `verdictWording`, because that absence is the delta's own clause - *"a surface that does not ask
 * SHALL render its listing exactly as it does without this requirement"* - and **the panel can never
 * falsify it**, because `Panel.tsx` always asks. A case that renders the panel and finds no marking
 * proves only that this particular caller passed no wording, which is a statement about `Panel.tsx`
 * rather than about the default.
 */
describe("the panel states, per message, what the session found", () => {
  const ORIGINAL_PLATFORM = Object.getOwnPropertyDescriptor(globalThis, "chrome");

  afterEach(() => {
    if (ORIGINAL_PLATFORM === undefined) {
      Reflect.deleteProperty(globalThis, "chrome");
    } else {
      Object.defineProperty(globalThis, "chrome", ORIGINAL_PLATFORM);
    }

    cleanup();
  });

  /**
   * One listed message, distinguished by id and subject only.
   *
   * **The sender and the arrival time are held identical across every message**, so a marking that
   * were rendered by anything other than the verdict cannot be told apart by looking at the row.
   */
  function listed(id: string, subject: string) {
    return { ...LISTED, id, subject };
  }

  /** A `checked` inbox carrying the given messages and verdicts. */
  function checked(
    messages: readonly ReturnType<typeof listed>[],
    verdicts: ReadonlyMap<string, MessageVerdict>,
  ): InboxState {
    return { kind: "checked", listing: { messages, verdicts } } as InboxState;
  }

  /** Render a panel whose session publishes exactly this inbox. */
  function renderPanelWith(inbox: InboxState) {
    installPlatform({ host: "signup.example.test" });

    const session = stubSession({
      kind: "ready",
      mailbox: MAILBOX,
      inbox,
      opened: null,
    } as unknown as SessionState);

    render(
      <Panel
        session={session}
        records={stubRecords({ held: [MAILBOX], association: MAILBOX.id })}
        primaryProviderName="Mail.tm"
      />,
    );
  }

  /**
   * The marking on the row carrying a subject, **read at that row**.
   *
   * **Scoped to the row because a listing-wide read cannot tell a marking from its neighbour's**,
   * and every case below has a row that must carry nothing sitting beside rows that must carry
   * something. `rowFor` refuses to guess as well: a subject that is not on any row throws from
   * `getByText` rather than resolving to `null` and reading as *"this row is bare"*.
   */
  function markingFor(subject: string): string | null {
    const row = screen.getByText(subject).closest("li");

    expect(row, `no row carries ${subject}`).not.toBeNull();

    return within(row as HTMLElement).queryByTestId("message-verdict")?.textContent ?? null;
  }

  it("marks a code row and a link row with their own words, and the two are distinguishable", async () => {
    const messages = [listed("m-code", "Sign-in code"), listed("m-link", "Confirm your address")];

    renderPanelWith(
      checked(
        messages,
        new Map<string, MessageVerdict>([
          ["m-code", { kind: "carriesCode" }],
          ["m-link", { kind: "carriesLink" }],
        ]),
      ),
    );

    await screen.findByText("Sign-in code");

    const code = markingFor("Sign-in code");
    const link = markingFor("Confirm your address");

    /**
     * **Read against the wording record rather than against literal strings**, so a wording changed
     * on purpose does not leave a component test red for a reason that is not the component. The
     * *distinguishable* claim below is the requirement's own clause and it is what carries the case.
     */
    expect(code).toBe(PANEL_VERDICT_WORDING.carriesCode);
    expect(link).toBe(PANEL_VERDICT_WORDING.carriesLink);

    // **The clause: "the marking SHALL name which was detected rather than naming both."** Asserted as
    // an inequality between two readings rather than as an absence of a word, because a row naming
    // both would still satisfy every word-level check that looked for the one it does name.
    expect(code).not.toBe(link);
    expect(code).not.toBeNull();
    expect(link).not.toBeNull();
  });

  it("leaves a row the session read and found nothing bare, and certifies nothing about it", async () => {
    renderPanelWith(
      checked(
        [listed("m-bare", "Weekly digest")],
        new Map([["m-bare", { kind: "carriesNothing" }]]),
      ),
    );

    await screen.findByText("Weekly digest");

    // **The row-level absence, at the row.** `queryByTestId` returns null when *nothing* carries the
    // id, so a panel that rendered no listing at all would satisfy it - which is why the wait above
    // establishes the row is on the page first, and why the case below re-establishes it.
    expect(markingFor("Weekly digest")).toBeNull();
    expect(screen.getByText("Weekly digest")).toBeDefined();

    /**
     * **The rendered panel's own text, swept - and this is where `carriesNothing` earns its empty
     * string.** The requirement's clause is *"the panel SHALL NOT state that the message carries no
     * verification"*, so the claim is about **words on the page** and not about a node's absence.
     *
     * **The patterns are the requirement's own sentence** - *carries no verification*, *contains no
     * verification*, *nothing to verify* - and not the bare substring, because
     * `PANEL_COPY.noLinks` reads *"No verification link was found in this message."*, which reports
     * what a **scan** found rather than certifying what the **message** holds. `panel-copy.test.ts`
     * carries the same narrowing and the same reasoning at the module's own level.
     */
    const CERTIFIES = [
      /\b(?:carries|carry|carried|contains|contain)\s+no\s+(?:detected\s+)?verification\b/i,
      /nothing\s+to\s+verify/i,
      /\b(?:contains?|carries|has|holds?)\s+(?:a\s+|an\s+|the\s+)?(?:detected\s+)?(?:one[- ]time\s+)?(?:code|verification\s+link)\b/i,
    ] as const;

    const panelText = (): string => document.body.textContent ?? "";

    for (const pattern of CERTIFIES) {
      expect(pattern.test(panelText()), String(pattern)).toBe(false);
    }

    /**
     * **The negative control, and it is planted in the running document rather than in a string.**
     *
     * **A sweep over `document.body.textContent` is the easiest reader in this file to write
     * wrongly** - a body that is empty, or a `textContent` that resolved before the row rendered,
     * both answer *false* for every pattern and satisfy every assertion above. So the control puts
     * the phrase on the page and requires the **same reader, called the same way**, to report it.
     */
    const planted = document.createElement("p");
    planted.textContent = "This message carries no verification.";
    document.body.append(planted);

    try {
      expect(CERTIFIES[0].test(panelText())).toBe(true);
    } finally {
      planted.remove();
    }
  });

  it("says on an undetermined row that the message could not be read, and nothing about its contents", async () => {
    /**
     * **An id the map has never heard of**, which is how `undetermined` actually arrives: `verdictFor`
     * defaults to it, so a missing entry *is* the answer rather than an error to handle.
     */
    renderPanelWith(checked([listed("m-new", "Something arrived")], new Map()));

    await screen.findByText("Something arrived");

    const marking = markingFor("Something arrived");

    expect(marking).toBe(PANEL_VERDICT_WORDING.undetermined);
    expect(marking).toMatch(/could not be read/i);

    // **Two separate clauses, asserted separately because they can fail apart**: a wording that said
    // *"we could not read it, but it probably has a code"* satisfies the first and violates the
    // second, which is the delta's *"SHALL NOT be presented as carrying a detection"*.
    expect(marking).not.toMatch(
      /\b(?:contains?|carries|has|holds?)\s+(?:a\s+|an\s+|the\s+)?(?:detected\s+)?(?:one[- ]time\s+)?(?:code|verification\s+link)\b/i,
    );
    expect(marking).not.toMatch(/\b(?:probably|likely|perhaps|appears?\s+to|seems?\s+to)\b/i);
  });

  it("renders exactly the four wordings, on their own rows, and nothing on the fifth", async () => {
    /**
     * **One listing holding one message per verdict**, because the two arms this case has to hold
     * apart - a row that must be marked and a row that must be bare - are indistinguishable in any
     * listing that does not contain both.
     */
    const messages = [
      listed("m-code", "One code"),
      listed("m-link", "One link"),
      listed("m-both", "Code and link"),
      listed("m-bare", "Nothing found"),
      listed("m-unread", "Never read"),
    ];

    renderPanelWith(
      checked(
        messages,
        new Map<string, MessageVerdict>([
          ["m-code", { kind: "carriesCode" }],
          ["m-link", { kind: "carriesLink" }],
          ["m-both", { kind: "carriesCodeAndLink" }],
          ["m-bare", { kind: "carriesNothing" }],
          // **`m-unread` is deliberately absent.** See above.
        ]),
      ),
    );

    await screen.findByText("Never read");

    const rendered = screen.getAllByTestId("message-verdict").map((node) => node.textContent ?? "");

    /**
     * **The identity, and it is one assertion carrying both halves of the claim.**
     *
     * `panel-copy.test.ts`'s *"declares one entry for every verdict kind"* case holds that the record
     * is exhaustive. This one holds that **exactly the non-empty entries reach the page** - so a
     * wording in the record that nothing renders, and a marking on screen that no wording declared,
     * both fail the same assertion. Two separate expectations would each be satisfied by a listing
     * that dropped one row and gained another.
     */
    expect([...rendered].sort()).toEqual(
      Object.entries(PANEL_VERDICT_WORDING)
        .filter(([, wording]) => wording !== "")
        .map(([, wording]) => wording)
        .sort(),
    );

    // **And per row, because a listing-wide count cannot say *which* row is bare.**
    expect(markingFor("One code")).toBe(PANEL_VERDICT_WORDING.carriesCode);
    expect(markingFor("One link")).toBe(PANEL_VERDICT_WORDING.carriesLink);
    expect(markingFor("Code and link")).toBe(PANEL_VERDICT_WORDING.carriesCodeAndLink);
    expect(markingFor("Never read")).toBe(PANEL_VERDICT_WORDING.undetermined);

    /**
     * **The fifth row, on its own.**
     *
     * **`carriesNothing` is `""` and the component refuses to render an empty `<p>`**, so this asserts
     * absence *and* the reason: a bare `""` would otherwise be satisfied by a node carrying an empty
     * paragraph, which is on screen, which is not nothing.
     */
    expect(markingFor("Nothing found")).toBeNull();
    expect(
      within(screen.getByText("Nothing found").closest("li") as HTMLElement).getByText(
        "Nothing found",
      ),
    ).toBeDefined();
  });

  it("keeps the verdicts a failed check's listing already carried", async () => {
    /**
     * **The reverse false claim, and it is the one the delta adds a scenario for.**
     *
     * A check that failed still shows what an **earlier** check determined, and **those messages were
     * read**. Marking them *"could not be read"* would be false in the direction this repository calls
     * the one that costs a user the code they were waiting for - and a refactor that dropped the
     * marking on this variant would lose it silently, because the variant renders identically until
     * somebody looks at this case.
     */
    renderPanelWith({
      kind: "checkFailed",
      listing: {
        messages: [listed("m-old", "From the last good check")],
        verdicts: new Map<string, MessageVerdict>([["m-old", { kind: "carriesCodeAndLink" }]]),
      },
      failure: FAILURE,
    } as unknown as InboxState);

    await screen.findByText("From the last good check");

    // **The positive control: we are on the `checkFailed` variant and not on `checked`.** The listing
    // alone does not distinguish them, so an assertion about retained verdicts on the wrong variant
    // would pass for the right reason. **The sentence is read whole** because `providerFailed`
    // interpolates the provider's own words into one sentence, and a reader matching only the
    // description would be satisfied by any `role="alert"` on the page.
    expect(
      screen.getByText(
        PANEL_COPY.providerFailed(
          FAILURE.providerFailures[0].provider,
          FAILURE.providerFailures[0].description,
        ),
      ),
    ).toBeDefined();

    expect(markingFor("From the last good check")).toBe(PANEL_VERDICT_WORDING.carriesCodeAndLink);
    expect(markingFor("From the last good check")).not.toBe(PANEL_VERDICT_WORDING.undetermined);
  });

  it("renders the shared listing with no marking at all when no surface asks for one", () => {
    /**
     * **The shared component, rendered directly, with the prop absent** - which is the only place
     * the default is observable at all.
     *
     * **Five messages, one per verdict, so "under any verdict" is literal.** A listing of one message
     * with one verdict would be satisfied by a default that only failed to render `carriesCode`.
     */
    const state = checked(
      [
        listed("m-code", "One code"),
        listed("m-link", "One link"),
        listed("m-both", "Code and link"),
        listed("m-bare", "Nothing found"),
        listed("m-unread", "Never read"),
      ],
      new Map<string, MessageVerdict>([
        ["m-code", { kind: "carriesCode" }],
        ["m-link", { kind: "carriesLink" }],
        ["m-both", { kind: "carriesCodeAndLink" }],
        ["m-bare", { kind: "carriesNothing" }],
      ]),
    );

    render(<MessageList state={state} onOpen={() => undefined} />);

    expect(screen.getAllByRole("listitem")).toHaveLength(5);
    expect(screen.queryByTestId("message-verdict")).toBeNull();

    /**
     * **The positive control, and it is the second half of the absence claim.**
     *
     * **Without it, `queryByTestId` returning null proves nothing about the default**: it returns
     * null for a component that never renders a marking whatever it is asked, which is the other
     * failure this default exists to distinguish from. So the **same state, on the same component**,
     * is rendered again with the wording supplied, and the markings have to appear.
     */
    cleanup();
    render(
      <MessageList state={state} onOpen={() => undefined} verdictWording={PANEL_VERDICT_WORDING} />,
    );

    expect(screen.getAllByTestId("message-verdict")).toHaveLength(4);
  });
});
