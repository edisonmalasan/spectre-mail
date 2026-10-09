/**
 * The popup, in jsdom.
 *
 * ## What this tier is for, given a browser tier exists
 *
 * The browser suite proves the popup works **in Chromium as an extension** — real
 * `chrome.storage`, a real `chrome-extension://` origin, real host permissions. What it
 * cannot do cheaply is walk every state, and a suite that only exercises the happy path
 * leaves the branches that matter untested.
 *
 * So the division is: **the browser tier answers "does this work", and this one answers
 * "does every state say the right thing".** The states that matter here are the ones the
 * browser tier cannot reach — a storage read that *fails*, a clipboard that refuses, a
 * session that is mid-creation.
 *
 * ## Every provider response is recorded
 *
 * Same rule as the browser tier and for the same reason: **no test in this repository
 * contacts a live provider**, and `use it externally` stays unverified.
 *
 * @vitest-environment jsdom
 */

import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createMailbox } from "@spectre-mail/core";
import type { Mailbox } from "@spectre-mail/core";
import type { InboxState, MailboxSession, SessionState } from "@spectre-mail/mailbox";

import { Popup } from "./Popup";
import type { PopupStorage } from "./Popup";

const MAILBOX: Mailbox = createMailbox({
  id: "session-token",
  address: "shadow@sharklasers.com",
  createdAt: 1_757_000_000_000,
  credentials: { provider: "guerrilla", sessionId: "session-token" },
});

/**
 * A session stub that actually publishes.
 *
 * **The first version returned `subscribe: () => () => undefined`**, and every assertion
 * about a post-restore state failed — the popup never left the state it was constructed
 * with, because nothing ever told it otherwise. Five tests failed for one cause, and it
 * is a cause worth naming: **a stub that satisfies a type without implementing the
 * behaviour the type describes is a fixture that hides the code under test.**
 *
 * So the listeners are collected and every state-changing method publishes through them,
 * which is what the real session does and what `useSyncExternalStore` expects.
 */
function stubSession(initial: SessionState) {
  let state = initial;
  const listeners = new Set<(next: SessionState) => void>();

  const publish = (next: SessionState): SessionState => {
    state = next;
    for (const listener of listeners) listener(next);
    return next;
  };

  const session = {
    current: () => state,
    subscribe: (listener: (next: SessionState) => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    open: vi.fn(async () =>
      publish({
        kind: "ready",
        mailbox: MAILBOX,
        inbox: { kind: "notStarted" },
        opened: null,
      } as unknown as SessionState),
    ),
    restore: vi.fn(async (stored: Mailbox | null) =>
      publish(
        stored === null
          ? state
          : ({
              kind: "ready",
              mailbox: stored,
              inbox: { kind: "notStarted" },
              opened: null,
            } as unknown as SessionState),
      ),
    ),
    health: vi.fn(async () => ({ provider: "guerrilla", status: "ok" })),
    checkInbox: vi.fn(
      async () =>
        ({ kind: "checked", listing: { messages: [], verdicts: new Map() } }) as InboxState,
    ),
    openMessage: vi.fn(),
    destroy: vi.fn(),
  };

  return session as unknown as MailboxSession & {
    readonly open: ReturnType<typeof vi.fn>;
    readonly restore: ReturnType<typeof vi.fn>;
    readonly checkInbox: ReturnType<typeof vi.fn>;
  };
}

/** A storage that either reads a mailbox, reads nothing, or refuses. */
function storageReading(outcome: Mailbox | null | Error): PopupStorage & {
  readonly addMailbox: ReturnType<typeof vi.fn>;
} {
  return {
    loadMailbox: vi.fn(async () => {
      if (outcome instanceof Error) throw outcome;
      return outcome;
    }),
    addMailbox: vi.fn(async () => undefined),
  };
}

describe("the popup", () => {
  /**
   * Unmount between tests.
   *
   * **Imported rather than configured globally**, because `vitest.config.ts` runs with
   * `environment: "node"` and this file opts into jsdom with a docblock — so there is no
   * global `afterEach` for Testing Library's automatic cleanup to attach to. Without this
   * the second test found two "Create an address" buttons: the first test's popup was
   * still in the document. `apps/web`'s suites do the same, for the same reason.
   */
  afterEach(() => {
    cleanup();
  });

  it("offers a create action once storage has answered, and only then", async () => {
    const session = stubSession({ kind: "idle", opened: null } as unknown as SessionState);
    render(
      <Popup session={session} storage={storageReading(null)} primaryProviderName="Mail.tm" />,
    );

    // **The boot read gates the action.** A popup offering "Create an address" before it
    // has looked would invite a user to overwrite the address they came back for.
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Create an address" })).toBeDefined(),
    );
  });

  it("adopts a stored mailbox instead of offering to create one", async () => {
    const session = stubSession({ kind: "idle", opened: null } as unknown as SessionState);
    render(
      <Popup session={session} storage={storageReading(MAILBOX)} primaryProviderName="Mail.tm" />,
    );

    // **`restore` is called with the stored mailbox** — and the create action is not
    // offered, because a popup that offered both would be asking the user to choose
    // between the address they came back for and a new one, at the moment they least
    // want a decision.
    await waitFor(() => expect(session.restore).toHaveBeenCalledWith(MAILBOX));
    expect(screen.queryByRole("button", { name: "Create an address" })).toBeNull();
  });

  it("refuses to create anything when the storage read fails", async () => {
    const session = stubSession({ kind: "idle", opened: null } as unknown as SessionState);
    render(
      <Popup
        session={session}
        storage={storageReading(new Error("storage unavailable"))}
        primaryProviderName="Mail.tm"
      />,
    );

    // **The refusal is an alert, and there is no create action at all.**
    //
    // This is the branch that matters most and the one a first-visit happy path never
    // reaches: `SpectreStorage` reserves `null` for "nothing stored" and rejects for
    // "could not read", so treating a failure as absence would tell a user who came
    // back for their address that they had none — then offer to make a new one.
    await waitFor(() => expect(screen.getByRole("alert")).toBeDefined());
    expect(screen.queryByRole("button", { name: "Create an address" })).toBeNull();
    // **And it says so in its own words**, not as a generic error.
    expect(screen.getByRole("alert").textContent).toMatch(/could not read its own storage/i);
    // **Nothing was restored**, because a failed read has no value to hand over.
    expect(session.restore).not.toHaveBeenCalled();
  });

  it("saves a mailbox only after the session confirms one", async () => {
    const session = stubSession({ kind: "idle", opened: null } as unknown as SessionState);
    const storage = storageReading(null);
    render(<Popup session={session} storage={storage} primaryProviderName="Mail.tm" />);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Create an address" })).toBeDefined(),
    );
    expect(storage.addMailbox).not.toHaveBeenCalled();

    screen.getByRole("button", { name: "Create an address" }).click();

    // **The confirmed mailbox is what is persisted.** `docs/PROVIDERS.md` records an
    // unrecognised Guerrilla session answering `HTTP 200` with an empty inbox, so a
    // mailbox stored before the provider confirmed it would be offered back as though it
    // worked — and this is the assertion that the order is the safe one.
    await waitFor(() => expect(storage.addMailbox).toHaveBeenCalledWith(MAILBOX));
  });

  it("reports a refused clipboard and leaves the address on screen", async () => {
    const session = stubSession({
      kind: "ready",
      mailbox: MAILBOX,
      inbox: { kind: "notStarted" },
      opened: null,
    } as unknown as SessionState);
    const writeText = vi.fn(async () => {
      throw new Error("clipboard refused");
    });
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });

    render(
      <Popup session={session} storage={storageReading(null)} primaryProviderName="Mail.tm" />,
    );

    // **The boot read gates every control**, so waiting for the control is waiting for
    // storage to have answered. A test that queried immediately would be reading the
    // booting branch — and would then be a test of nothing.
    const copyButton = await screen.findByRole("button", { name: "Copy address" });
    await act(async () => {
      copyButton.click();
    });

    // **Reported as a sentence the user can act on**, not a swallowed rejection. The
    // address stays on screen because selecting it by hand is a complete answer to the
    // same need — which is why `user-select: all` is on that element.
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toMatch(/clipboard refused/i),
    );
    expect(screen.getByText(MAILBOX.address)).toBeDefined();
  });

  it("shows the last known count after a failed check, not an empty inbox", async () => {
    const session = stubSession({
      kind: "ready",
      mailbox: MAILBOX,
      inbox: {
        kind: "checkFailed",
        listing: { messages: summaries(2), verdicts: new Map() },
        failure: { code: "NETWORK_ERROR" },
      },
      opened: null,
    } as unknown as SessionState);

    render(
      <Popup session={session} storage={storageReading(null)} primaryProviderName="Mail.tm" />,
    );

    // **Awaited, because the boot read gates every control.** A synchronous query reads
    // the booting branch, and a test that reads the booting branch asserts nothing about
    // the state it named. This was the cause of three failures at once in an earlier
    // draft, and the fix is a wait rather than a loosened matcher.
    //
    // **One element, one sentence** — the copy is a function of the count so a text
    // matcher can address it, which the two-adjacent-expressions version could not.
    const sentence = await screen.findByText(/last check failed/i);
    expect(sentence.textContent).toMatch(/2 messages/);
    // **A failed check is a condition of the inbox, not the loss of it.** Reporting "no
    // mail has arrived" after a failure would tell the user their mailbox is empty when
    // the truth is that SpectreMail could not look.
    expect(screen.queryByText("No mail has arrived.")).toBeNull();
  });

  it("names the provider that served the mailbox, not the one it will reach first", async () => {
    const session = stubSession({
      kind: "ready",
      mailbox: MAILBOX,
      inbox: { kind: "notStarted" },
      opened: null,
    } as unknown as SessionState);

    render(
      <Popup session={session} storage={storageReading(null)} primaryProviderName="Mail.tm" />,
    );

    // **`primaryProviderName` is not on screen once a mailbox exists.** The heading names
    // the mailbox's own provider, so a mailbox served by the fallback is never described
    // by the preference that was tried first.
    expect(await screen.findByRole("heading", { name: "guerrilla" })).toBeDefined();
    expect(screen.queryByText("Mail.tm")).toBeNull();
  });

  it("says an address that no longer receives mail rather than reporting an empty inbox", async () => {
    const session = stubSession({
      kind: "expired",
      mailbox: MAILBOX,
      opened: null,
    } as unknown as SessionState);

    render(
      <Popup session={session} storage={storageReading(null)} primaryProviderName="Mail.tm" />,
    );

    // **An `expired` state carries no inbox at all**, by design. Rendering "no messages"
    // for an address that cannot receive any is unrepresentable rather than merely
    // avoided — so this asserts the sentence, not the absence of a count.
    expect(await screen.findByText(/no longer receives mail/i)).toBeDefined();
    expect(screen.queryByText("No mail has arrived.")).toBeNull();
  });
});

/** `n` message summaries, which is all an inbox listing needs to be counted. */
function summaries(n: number): unknown[] {
  return Array.from({ length: n }, (_, index) => ({
    id: `m${index}`,
    provider: "guerrilla" as const,
    from: "someone@example.test",
    subject: "hello",
    receivedAt: 1_757_000_000_000,
  }));
}

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

/** The opened message, carrying one detected code. */
const OPENED = {
  ...LISTED,
  readable: "Your code is 493028",
  codes: [{ value: "493028", confidence: 0.85 }],
  links: [],
};

/**
 * The extension's platform, as this component's two seams see it.
 *
 * **`findActiveTab` and `sendToTab` both go through `extension-platform.ts`, which is the only
 * module allowed to read `chrome` — so a jsdom test drives them by installing that one global,
 * not by passing them anything.** The record of what was sent is here rather than inside the
 * platform, because the claim these tests make is about *which tab* and *what message*.
 */
function installTabsPlatform(options: {
  readonly tabs?: readonly { readonly id: number }[] | undefined;
  readonly reply?: unknown;
  readonly answer?: boolean;
}) {
  const sent: Array<{ readonly tabId: unknown; readonly request: unknown }> = [];
  const chrome = {
    runtime: { onMessage: {}, sendMessage: () => undefined },
    tabs: {
      query: (_info: unknown, respond: (found: unknown) => void) => {
        respond(options.tabs ?? [{ id: 41 }]);
      },
      sendMessage: (tabId: unknown, request: unknown, respond: (reply: unknown) => void): void => {
        sent.push({ tabId, request });
        // **The callback is invoked either way, and that is the platform's own shape.** With no
        // content script listening, Chromium calls back with `undefined` and sets `lastError`; it
        // does not stay silent. The first version of this fixture modelled "no page" by *never*
        // answering, which models a hang instead — and a hanging `sendToTab` left the popup
        // saying "Sending…" forever, so the case failed with a timeout rather than with the
        // refusal it was written to check. **A fake that refuses to answer is testing a hang.**
        respond(options.answer === false ? undefined : options.reply);
      },
    },
  };
  Object.defineProperty(globalThis, "chrome", { value: chrome, configurable: true });

  return sent;
}

describe("the popup's delivery controls", () => {
  const ORIGINAL_PLATFORM = Object.getOwnPropertyDescriptor(globalThis, "chrome");

  /**
   * **Restore the global after every case, and this file is the reason it has to be said.**
   *
   * `globalThis` is shared with every other test in the process, and a leaked `chrome` would let a
   * later case pass by finding a platform nobody installed. `extension-platform.test.ts` records
   * the same rule for the same reason.
   */
  afterEach(() => {
    if (ORIGINAL_PLATFORM === undefined) {
      Reflect.deleteProperty(globalThis, "chrome");
    } else {
      Object.defineProperty(globalThis, "chrome", ORIGINAL_PLATFORM);
    }
    cleanup();
  });

  /** A session holding one listed message, and the popup asked to show it. */
  function renderWithOpened(opened: unknown) {
    const session = stubSession({
      kind: "ready",
      mailbox: MAILBOX,
      inbox: { kind: "checked", listing: { messages: [LISTED], verdicts: new Map() } },
      opened,
    } as unknown as SessionState);

    render(
      <Popup session={session} storage={storageReading(null)} primaryProviderName="Mail.tm" />,
    );

    return session;
  }

  it("lists what the last check found, each row offering to read it", async () => {
    renderWithOpened({ kind: "none" });

    const row = await screen.findByText("Your sign-in code");

    // **The sender is shown by name when the provider gave one,** and the row carries a control
    // rather than opening the message on a click anywhere: a row that filled on any click would
    // spend a provider request on a mis-click.
    expect(screen.getByText("Example")).toBeDefined();
    expect(screen.getByRole("button", { name: "Read" })).toBeDefined();
    expect(row).toBeDefined();
  });

  /**
   * **The listing names no code, and there is nothing here it could have been derived from.**
   *
   * `MessageSummary` carries no detections, so a marker on a row would be a guess about a message
   * nobody has read — and `extension-client` forbids it outright. This case is about the *absence*
   * of a marker, so it also has to assert that the code is nowhere on screen while the message is
   * unopened: a popup that merely omitted a marker but leaked the code elsewhere would satisfy it.
   */
  it("indicates nothing about a message the user has not opened", async () => {
    renderWithOpened({ kind: "none" });

    await screen.findByText("Your sign-in code");

    expect(screen.queryByText("493028")).toBeNull();
    expect(screen.queryByRole("button", { name: /Fill in code/ })).toBeNull();
  });

  it("sends nothing until the user presses, and offers one control per code", async () => {
    const sent = installTabsPlatform({ reply: { kind: "filled" } });
    renderWithOpened({ kind: "opened", message: OPENED });

    const control = await screen.findByRole("button", { name: "Fill in code 493028" });

    // **Nothing has been sent, because the popup opening is not a decision to fill a page.**
    expect(sent).toEqual([]);

    await act(async () => {
      control.click();
    });
    await act(async () => {
      await Promise.resolve();
    });

    // **The named tab, and the code verbatim in a message this extension recognises.** The request
    // is written out here rather than built with the same function the component uses, because an
    // expectation imported from the code under test cannot fail when that code changes.
    expect(sent).toEqual([{ tabId: 41, request: { kind: "spectre:fill-code", code: "493028" } }]);
  });

  /**
   * Press the fill control, once the popup has finished booting.
   *
   * ## Why the query is outside `act`, and this is not a style choice
   *
   * **`findByRole` retries on a timer, and `act` flushes React's work synchronously.** Wrapping the
   * *search* in `act` — as the first version of these cases did — means the retry cannot run until
   * the `await` inside the callback resolves, which it never does; the case then fails with
   * *"Unable to find role=button"*, which reads as a missing control and is actually a missing
   * flush. **The search waits for the popup; the press is what gets flushed.**
   */
  async function pressFill(): Promise<HTMLElement> {
    const control = await screen.findByRole("button", { name: "Fill in code 493028" });

    await act(async () => {
      control.click();
    });

    return control;
  }

  it("reports the page's confirmation, and only the page's confirmation", async () => {
    installTabsPlatform({ reply: { kind: "filled" } });
    renderWithOpened({ kind: "opened", message: OPENED });

    await pressFill();

    // **`filled` is the only sentence that claims the page now holds the code,** so it is the one
    // asserted; every refusal below shares this control and is asserted to say something else.
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toBe("The code is in the page."),
    );
  });

  it.each([
    [{ kind: "noField" }, "That page has no one-time-code field."],
    [{ kind: "fieldHoldsText" }, "The only field on that page already has something in it."],
    [{ kind: "notTopFrame" }, "That is not the top of that page, so nothing was filled."],
    [{ kind: "asked" }, "The page is asking which field to fill."],
    [{ kind: "notActedOn" }, "Could not confirm the code went into the page."],
  ])("reports %j without claiming anything was filled", async (reply, sentence) => {
    installTabsPlatform({ reply });
    renderWithOpened({ kind: "opened", message: OPENED });

    await pressFill();

    await waitFor(() => expect(screen.getByRole("status").textContent).toBe(sentence));
    // **The absence is asserted as well as the sentence,** because a popup that printed both would
    // satisfy every row above.
    expect(screen.getByRole("status").textContent).not.toBe("The code is in the page.");
  });

  /**
   * **A page that answers nothing is the case `extension-client` names, and it is not an error.**
   *
   * No content script on that tab — an ordinary web page, or a tab whose script has not been
   * injected — produces no answer at all, and the popup has no way to tell that from a page that
   * chose not to reply. So it says it could not confirm, and *says nothing about the page*.
   */
  it("reports that it could not confirm when no page answers", async () => {
    installTabsPlatform({ answer: false });
    renderWithOpened({ kind: "opened", message: OPENED });

    await pressFill();

    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toBe(
        "Could not confirm the code went into the page.",
      ),
    );
  });

  it("reports that it could not find a page, and sends to no tab at all", async () => {
    const sent = installTabsPlatform({ tabs: [] });
    renderWithOpened({ kind: "opened", message: OPENED });

    await pressFill();

    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toBe(
        "Could not find which page to send it to.",
      ),
    );
    // **Nothing was sent to anything.** The refusal to fall back is the requirement, and a
    // sentence about it is not the same claim as the absence of a delivery.
    expect(sent).toEqual([]);
  });

  /**
   * **One delivery to one tab, with two tabs open.**
   *
   * `design.md` D1 measured what "no tab was named, so send to all of them" actually does: it
   * reaches exactly one tab in a real browser, which reads like a success and is not one — the
   * reason it reached one is nothing to do with intent. So the claim under test is the **count and
   * the id**, asserted on the record of what was sent: a broadcast would satisfy every case above
   * this one, because they each look only at the sentence the popup printed.
   */
  it("sends to the tab it named, and to no other tab that is open", async () => {
    const sent = installTabsPlatform({
      tabs: [{ id: 41 }, { id: 42 }, { id: 43 }],
      reply: { kind: "filled" },
    });
    renderWithOpened({ kind: "opened", message: OPENED });

    await pressFill();

    expect(sent).toEqual([{ tabId: 41, request: { kind: "spectre:fill-code", code: "493028" } }]);
    // **Spelled out rather than derived**, because `sent.length === 1` is also satisfied by an
    // implementation that sent one message to no tab at all.
    expect(sent.map((message) => message.tabId)).not.toContain(42);
    expect(sent.map((message) => message.tabId)).not.toContain(43);
  });

  /**
   * **Two codes, two controls, and each carries its own.**
   *
   * `mail-parser` never reports a detection as certain and its output is ranked, so a control
   * offered only for the top-ranked code would act on a guess about which of two was real. The
   * case is here rather than in the browser tier because the recorded fixture carries one code,
   * and a fixture rewritten to carry two would make every other case in the browser tier depend on
   * a message body this repository wrote differently from the one it recorded.
   */
  it("offers a control for each code, and names each one with the code it fills", async () => {
    const two = {
      ...OPENED,
      codes: [
        { value: "493028", confidence: 0.85 },
        { value: "222222", confidence: 0.7 },
      ],
    };
    const sent = installTabsPlatform({ reply: { kind: "filled" } });
    renderWithOpened({ kind: "opened", message: two });

    const controls = await screen.findAllByRole("button", { name: /^Fill in code/ });
    expect(controls.map((control) => control.textContent)).toEqual([
      "Fill in code 493028",
      "Fill in code 222222",
    ]);

    // **The second one fills its own code**, which is the difference between two controls and one
    // control rendered twice.
    await act(async () => {
      controls[1]?.click();
    });

    expect(sent).toEqual([{ tabId: 41, request: { kind: "spectre:fill-code", code: "222222" } }]);
  });

  it("says it looked and found no code, when the message carries none", async () => {
    renderWithOpened({ kind: "opened", message: { ...OPENED, codes: [] } });

    // **Reported rather than showing an empty list,** because an empty control area on a message
    // that genuinely had no code is indistinguishable from a failure to read it.
    expect(await screen.findByText("No one-time code was found in this message.")).toBeDefined();
    expect(screen.queryByRole("button", { name: /Fill in code/ })).toBeNull();
  });

  it("says it is reading while a message is being opened", async () => {
    renderWithOpened({ kind: "opening", messageId: "m1" });

    expect(await screen.findByText("Reading")).toBeDefined();
    expect(screen.queryByRole("button", { name: /Fill in code/ })).toBeNull();
  });

  it("reports a message it could not read, and offers no code from it", async () => {
    renderWithOpened({ kind: "openFailed", failure: { code: "NETWORK_ERROR" } });

    expect(await screen.findByRole("alert")).toBeDefined();
    expect(screen.queryByRole("button", { name: /Fill in code/ })).toBeNull();
  });
});
