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

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createMailbox } from "@spectre-mail/core";
import type { Mailbox } from "@spectre-mail/core";
import type { MailboxSession, SessionState } from "@spectre-mail/mailbox";

import { Panel } from "./Panel";
import type { PanelRecords } from "./Panel";
import { HOST_CONTEXT_REQUEST, fillCodeRequest, hostContextAnswer } from "./protocol";

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
  providerFailures: [{ provider: "mailtm", description: "Mail.tm answered 503." }],
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
    readonly association?: string | null;
    readonly collectionFails?: boolean;
    readonly associationFails?: boolean;
  } = {},
): PanelRecords & { askedForHost: string[] } {
  const askedForHost: string[] = [];

  return {
    askedForHost,
    loadMailboxes: async () => {
      if (options.collectionFails === true) {
        throw new Error("this device cannot say what it holds");
      }

      return options.held ?? [MAILBOX];
    },
    loadSiteMailboxId: async (host: string) => {
      askedForHost.push(host);

      if (options.associationFails === true) {
        throw new Error("this device cannot say what this host used");
      }

      return options.association ?? null;
    },
  };
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
          callback(
            options.hostAnswer !== undefined
              ? options.hostAnswer
              : options.host === undefined
                ? undefined
                : hostContextAnswer(options.host),
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
  });

  it("lists what the last check found and opens the one that is pressed", async () => {
    const platform = installPlatform({ host: "signup.example.test" });
    const { session } = renderPanel();

    await screen.findByText("Your sign-in code");

    // **Named by what the control says, not by a fragment of it** — "Read" is the row's whole
    // accessible name, and matching `/open/i` would have found nothing at all while looking as
    // though it had looked in the right place.
    fireEvent.click(screen.getByRole("button", { name: "Read" }));

    expect(session.openMessage).toHaveBeenCalledWith("m1");
    // **The host question was asked once, and the listing cost nothing of the panel's own** — the
    // listing came from the session the popup also drives.
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

    expect(list.textContent).toContain(MAILBOX.address);
    expect(list.textContent).toContain(OLDER.address);
    // **Newest first**, because that is the order `loadInsertableMailboxes` promises and an order
    // this surface sorts for itself would be a second spelling of that contract.
    expect((list.textContent ?? "").indexOf(MAILBOX.address)).toBeLessThan(
      (list.textContent ?? "").indexOf(OLDER.address),
    );
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

  /** Mount a panel and wait until it has finished asking the page about itself. */
  async function mount(
    options: {
      readonly host?: string;
      readonly hostAnswer?: unknown;
      readonly noActiveTab?: boolean;
    },
    records: PanelRecords,
  ) {
    installPlatform(options);
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

    return session;
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
    // working: the mailboxes this device holds are still named, in full.
    expect(screen.getByTestId("panel-held").textContent).toContain(OLDER.address);
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
    const session = await mount(
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
});
