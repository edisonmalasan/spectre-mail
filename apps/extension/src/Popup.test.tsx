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
