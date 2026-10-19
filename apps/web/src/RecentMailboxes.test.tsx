/**
 * The mailboxes this device holds, and the way back to one.
 *
 * ## What is asserted, and what is not
 *
 * **Assertions are about words and about what is offered**, never about markup or colour - the same
 * rule `Inbox.test.tsx` states and for the same reason: a requirement about what is *displayed*
 * cannot be checked against a component's return value, and a snapshot would pass unchanged if the
 * component stopped rendering at all.
 *
 * ## The two cases that make the rest of this file falsifiable
 *
 * 1. **A mailbox reported gone and a mailbox that could not be checked are said differently**, and
 *    the wording is *taken from* the two components that already render those facts rather than
 *    invented here. **The containment is asserted by rendering both**, because "no second vocabulary
 *    for the same two facts" is otherwise a claim a reader has to make by eye - and a component
 *    holding two copies of a sentence is the failure this change would have shipped.
 * 2. **No number about how long an address lasts appears anywhere**, swept over the whole surface
 *    rather than over the sentence a reader suspects. That is the requirement's own limit and it is
 *    the one a future edit is most likely to break by adding a helpful number.
 *
 * ## What this file cannot establish
 *
 * Nothing about how the list looks. No test in this repository reads a rendered pixel, and the
 * change's `design.md` D8 says so rather than letting a green suite imply otherwise.
 *
 * @module
 */

// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { createMailbox, NormalizedErrorCode } from "@spectre-mail/core";
import type { Mailbox, SpectreError } from "@spectre-mail/core";
import { createMailboxSession } from "@spectre-mail/mailbox";
import type { MailboxScheduler } from "@spectre-mail/mailbox";
import { createProviderManager } from "@spectre-mail/providers";
import type { MailProvider } from "@spectre-mail/providers";
import type { SpectreMailboxes, SpectreStorage } from "@spectre-mail/storage";

import { App } from "./App";
import { applyJsdomSuiteBudget } from "./jsdom-suite-budget";
import { RecentMailboxes, RECENT_ADDRESS_GONE, RECENT_ADDRESS_UNCHECKED } from "./RecentMailboxes";
import type { UnreachableVerdict } from "./RecentMailboxes";
import { StoredAddressGone } from "./StoredAddressGone";
import { StoredAddressUnchecked } from "./StoredAddressUnchecked";
import type { LocalDataState } from "./useMailboxSession";

applyJsdomSuiteBudget();

afterEach(cleanup);

function mailbox(id: string, address: string): Mailbox {
  return createMailbox({
    id,
    address,
    createdAt: 1_757_000_000_000,
    credentials: { provider: "guerrilla", sessionId: id },
  });
}

const OLDER = mailbox("older-token", "older@sharklasers.com");
const NEWER = mailbox("newer-token", "newer@sharklasers.com");

interface StubOptions {
  readonly held?: readonly Mailbox[];
  readonly loadThrows?: unknown;
  /** Every read the surface made, in order. */
  readonly reads?: string[];
}

/** A collection that reports what it was given, and what it was asked for. */
function stubMailboxes(options: StubOptions = {}): SpectreMailboxes & { reads: () => number } {
  let reads = 0;
  return {
    async loadMailboxes() {
      reads += 1;
      options.reads?.push("load");
      if (options.loadThrows !== undefined) throw options.loadThrows;
      return options.held ?? [];
    },
    async addMailbox() {
      throw new Error("the surface never records a mailbox; the page's own binding does");
    },
    reads: () => reads,
  };
}

const READY = (mailboxes: SpectreMailboxes) => ({ kind: "ready", mailboxes }) as const;

const NO_STATE: LocalDataState = { kind: "stored" };

async function renderSurface(
  overrides: {
    readonly held?:
      ReturnType<typeof READY> | { readonly kind: "blocked"; readonly reason: string };
    readonly current?: Mailbox | null;
    readonly unreachable?: UnreachableVerdict;
    readonly storageState?: LocalDataState;
    readonly onReturnTo?: (mailbox: Mailbox) => void;
    readonly wrapper?: (rerender: () => void, element: React.ReactElement) => void;
  } = {},
) {
  const returned: Mailbox[] = [];
  const view = render(
    <RecentMailboxes
      held={overrides.held ?? READY(stubMailboxes())}
      current={overrides.current ?? null}
      unreachable={overrides.unreachable ?? {}}
      storageState={overrides.storageState ?? NO_STATE}
      onReturnTo={(one) => {
        returned.push(one);
        overrides.onReturnTo?.(one);
      }}
    />,
  );
  return { returned, view };
}

describe("the mailboxes this device holds", () => {
  it("offers every one of them, in the order the collection reports", async () => {
    await renderSurface({ held: READY(stubMailboxes({ held: [NEWER, OLDER] })) });

    await screen.findByTestId("recent-held");

    // **The order is the collection's own**, and it is read from the document rather than from
    // the props - a component that sorted its input would satisfy a prop assertion.
    const addresses = screen.getAllByRole("button").map((button) => button.textContent);
    expect(addresses).toEqual(["Use this address", "Use this address"]);
    const rendered = screen.getByTestId("recent-held").parentElement?.textContent ?? "";
    expect(rendered.indexOf(NEWER.address)).toBeGreaterThanOrEqual(0);
    expect(rendered.indexOf(NEWER.address)).toBeLessThan(rendered.indexOf(OLDER.address));
  });

  it("keeps an older mailbox on the page when a newer one has been recorded", async () => {
    const held = stubMailboxes({ held: [NEWER, OLDER] });
    const view = (storageState: LocalDataState) => (
      <RecentMailboxes
        held={READY(held)}
        current={NEWER}
        unreachable={{}}
        storageState={storageState}
        onReturnTo={() => undefined}
      />
    );
    const { rerender } = render(view(NO_STATE));
    await screen.findByTestId("recent-held");

    // **The page re-reads when the storage state is re-confirmed**, which is the moment a
    // replacement lands. A surface that read once at mount would keep showing the address that
    // was replaced, because the mount read happened before the write. **A fresh element each
    // time, because React bails out of a `rerender` handed the identical object** - which would
    // make this case pass for the wrong reason.
    rerender(view({ kind: "stored" }));

    await waitFor(() => {
      expect(held.reads()).toBeGreaterThan(1);
    });
    expect(screen.getByText(OLDER.address)).toBeTruthy();
    expect(screen.getByText(NEWER.address)).toBeTruthy();
  });

  it("returns to the mailbox that was chosen, and names no other action", async () => {
    const { returned } = await renderSurface({
      held: READY(stubMailboxes({ held: [NEWER, OLDER] })),
      current: NEWER,
    });
    await screen.findByTestId("recent-held");

    const controls = screen.getAllByRole("button");
    // **One control, for the address that is not already on screen.** A control for the address
    // already in use cannot do anything, which is the fake-UI defect this page has removed twice.
    expect(controls).toHaveLength(1);
    expect(controls[0]?.textContent).toBe("Use this address");

    fireEvent.click(controls[0] as HTMLButtonElement);

    // **The chosen mailbox, by identity** - and nothing else was asked for.
    expect(returned).toEqual([OLDER]);
  });

  it("says a mailbox the provider reported gone differently from one it could not check", async () => {
    await renderSurface({
      held: READY(stubMailboxes({ held: [OLDER] })),
      unreachable: { [OLDER.id]: "gone" },
    });
    await screen.findByTestId(`recent-gone-${OLDER.id}`);
    expect(screen.queryByTestId(`recent-unchecked-${OLDER.id}`)).toBeNull();
    const gone = screen.getByTestId(`recent-gone-${OLDER.id}`).textContent ?? "";
    cleanup();

    await renderSurface({
      held: READY(stubMailboxes({ held: [OLDER] })),
      unreachable: { [OLDER.id]: "unchecked" },
    });
    await screen.findByTestId(`recent-unchecked-${OLDER.id}`);
    expect(screen.queryByTestId(`recent-gone-${OLDER.id}`)).toBeNull();
    const unchecked = screen.getByTestId(`recent-unchecked-${OLDER.id}`).textContent ?? "";

    /**
     * **The texts compared, and not only the markers.**
     *
     * Two `data-testid`s are a structure; a structure is satisfied by a component that renders the
     * *same* sentence under both of them, which is the whole defect this change was told not to
     * ship. So the sentences themselves are read out of the document and compared — and each is
     * compared against the component that already renders that fact, which is the containment the
     * next case asserts.
     */
    expect(gone).not.toBe(unchecked);
    expect(gone).toContain("does not recognise this address");
    expect(unchecked).toContain("the check did not complete");
  });

  it("does not offer a mailbox the provider will not serve as though it worked", async () => {
    await renderSurface({
      held: READY(stubMailboxes({ held: [OLDER] })),
      unreachable: { [OLDER.id]: "gone" },
    });
    await screen.findByTestId(`recent-gone-${OLDER.id}`);

    // **The control asks rather than claims.** "Use this address" on a mailbox the provider has
    // said it no longer recognises is precisely the claim the requirement forbids, and this is
    // the sentence that makes the difference on screen.
    const control = await screen.findByRole("button");
    expect(control.textContent).toBe("Check this address again");
    expect(control.textContent).not.toContain("Use this address");
  });

  it("uses the words the two stored-address components already render", async () => {
    // **The containment, asserted by rendering both.** "No second vocabulary for the same two
    // facts" is otherwise a claim a reader has to make by eye, and two components holding two
    // copies of a sentence is the defect this change would otherwise have shipped.
    const { container } = render(
      <StoredAddressGone mailbox={OLDER} onRetry={() => undefined} onReplace={() => undefined} />,
    );
    expect(container.textContent).toContain(RECENT_ADDRESS_GONE);

    cleanup();

    const unchecked = render(
      <StoredAddressUnchecked
        mailbox={OLDER}
        failure={{ code: "NETWORK", description: "the provider did not answer" } as never}
        onRetry={() => undefined}
        onStartFresh={() => undefined}
      />,
    );
    expect(unchecked.container.textContent).toContain(RECENT_ADDRESS_UNCHECKED);
  });

  it("states no number about how long an address lasts", async () => {
    await renderSurface({
      held: READY(stubMailboxes({ held: [NEWER, OLDER] })),
      current: NEWER,
      unreachable: { [OLDER.id]: "unchecked" },
    });
    await screen.findByTestId("recent-held");

    // **A sweep over the whole surface rather than the sentence a reader suspects.** The words
    // are: a count, a duration, a unit, and the two names a retention policy would use.
    const text = document.body.textContent ?? "";
    for (const forbidden of [
      /\b\d+\b/,
      /\bday\b/i,
      /\bhours?\b/i,
      /\bweek/i,
      /\bexpire/i,
      /\bexpiry\b/i,
      /\bretention\b/i,
      /\bexpires\b/i,
    ]) {
      expect(text, `the surface must not state ${forbidden}`).not.toMatch(forbidden);
    }
  });

  it("renders nothing when this device holds none, because LocalData already says so", async () => {
    await renderSurface({ held: READY(stubMailboxes({ held: [] })) });

    await waitFor(() => {
      expect(document.body.textContent).toBe("");
    });
  });

  it("does not report a failed read as a device that holds none", async () => {
    await renderSurface({
      held: READY(stubMailboxes({ loadThrows: new Error("the store could not be opened") })),
    });

    const notice = await screen.findByTestId("recent-unreadable");
    // **The reason, and no claim in either direction.** "Nothing is stored" here would be the
    // conversion `spectre-storage` reserves `null` to prevent, and it is what makes a page
    // believe it is a first visit.
    expect(notice.textContent).toContain("could not say which addresses it is holding");
    expect(notice.textContent).toContain("Nothing was changed");
    expect(notice.textContent).toContain("the store could not be opened");
    expect(document.body.textContent).not.toContain("holding one address");
  });

  it("offers nothing where the platform provides no store", async () => {
    await renderSurface({ held: { kind: "blocked", reason: "no IndexedDB here" } });

    await waitFor(() => {
      expect(document.body.textContent).toBe("");
    });
  });
});

/**
 * The whole page, which is where the placement claims live.
 *
 * **`RecentMailboxes` on its own cannot answer any of them**: "inside the product region" and "in
 * every session state" are both statements about `App`, and `page-composition`'s "no sixth region"
 * is a statement about the five regions the page still has. So these cases render the page.
 */
describe("the offer on the page the product ships", () => {
  it("renders inside the product region, and the page still has five regions", async () => {
    renderPage({ stored: null, held: [OLDER] });

    await screen.findByTestId("recent-held");

    const product = document.querySelector('[data-region="product"]');
    expect(product).not.toBeNull();
    expect(product?.querySelector('[data-testid="recent-held"]')).not.toBeNull();

    // **Five, and that is `page-composition`'s clause rather than this component's preference.**
    // Read from the document rather than from `PAGE_ORDER`, which is the array `sections.spec.ts`
    // compares against - so a page that grew a region would fail here rather than pass by
    // re-reading its own constant.
    expect(document.querySelectorAll("[data-region]").length).toBe(5);
  });

  it("is still there when the address the user asked for could not be created", async () => {
    renderPage({
      // **A device that holds an address, adopted successfully.** A *boot* creation failure is
      // unreachable together with a held address — the boot only creates when the device holds
      // nothing — so the requirement's scenario is the creation failure the **user** asks for,
      // which is `Replace address`. That is a finding about the requirement's reachability and it
      // is why the fixture is what it is rather than the obvious one.
      stored: OLDER,
      held: [OLDER],
      createMailbox: () => Promise.reject(new Error("the provider refused")),
    });

    await screen.findByTestId("ready");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Replace address" }));
    });

    // **A state where the page has no working address at all**, and the addresses it holds are
    // still offered. What this browser remembers has nothing to do with what the session is doing.
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /no address yet/i })).toBeTruthy();
    });
    await screen.findByTestId("recent-held");
    expect(screen.getByText(OLDER.address)).toBeTruthy();
  });

  it("brings the chosen mailbox up without asking the provider for a new one", async () => {
    const provider = stubProvider();
    const saves: Mailbox[] = [];
    // **The page is handed an address, so the boot adopts rather than creates.** A first visit
    // would create one, and a create here would make `creates` non-zero for a reason that has
    // nothing to do with the return path.
    renderPage({ stored: NEWER, held: [NEWER, OLDER], provider, saves });

    await screen.findByTestId("recent-held");

    const control = screen
      .getAllByRole("button")
      .find((one) => one.textContent === "Use this address");
    expect(control).toBeTruthy();
    await act(async () => {
      fireEvent.click(control as HTMLButtonElement);
    });

    // **The older address is the one on screen**, and no mailbox was created - which is the
    // whole difference between a return path and a creation path.
    await waitFor(() => {
      expect(document.querySelector('[data-testid="address"]')?.textContent).toBe(OLDER.address);
    });
    expect(provider.creates()).toBe(0);
  });

  it("does not offer the address the provider reported gone with a control that claims it works", async () => {
    /**
     * **The requirement's own clause, asserted where the page can reach it.**
     *
     * The delta says a mailbox this device can no longer reach "SHALL NOT be offered as though it
     * worked". The falsification pass found that **the control's second label is unreachable on the
     * built page** - the page only ever asks the provider about the mailbox it holds, so the only
     * mailbox it can mark is the one it is on, and that entry carries no control at all. So the
     * mechanism actually in force is the absence of a control, and **this is the case that says so**.
     *
     * The two mechanisms overlap, and the reachable one is the one doing the work. The unit tier's
     * case above already holds the other half - that the address the page is on gets no control
     * while another address does.
     */
    renderPage({ stored: OLDER, held: [OLDER], listMessages: () => Promise.reject(expired()) });

    await waitFor(() => {
      expect(screen.getByTestId(`recent-gone-${OLDER.id}`)).toBeTruthy();
    });

    // **The entry carrying the mark.**
    const row = Array.from(document.querySelectorAll("li")).find((one) =>
      one.textContent?.includes(OLDER.address),
    );
    expect(row, "the list does not carry the address the provider reported gone").toBeDefined();

    // **And no control on it.** A control that claims the address works is what the requirement
    // forbids, and the page's own "your saved address is gone" region is where the retry lives -
    // so a second control here would be one the page can neither justify nor need.
    expect(
      row?.querySelector("button"),
      "the address the provider reported gone carries a control",
    ).toBeNull();
  });

  it("marks the address the provider reported gone, and says it differently from one it could not check", async () => {
    // **Two renders, because the session holds exactly one mailbox at a time.** A page that has
    // asked about one address has an answer about one address; the list marks that one and offers
    // the rest plainly.
    renderPage({ stored: OLDER, held: [OLDER], listMessages: () => Promise.reject(expired()) });

    await waitFor(() => {
      expect(screen.getByTestId(`recent-gone-${OLDER.id}`)).toBeTruthy();
    });

    cleanup();

    renderPage({ stored: OLDER, held: [OLDER], listMessages: () => Promise.reject(unchecked()) });

    await waitFor(() => {
      expect(screen.getByTestId(`recent-unchecked-${OLDER.id}`)).toBeTruthy();
    });
    expect(screen.queryByTestId(`recent-gone-${OLDER.id}`)).toBeNull();
  });
});

/** A provider failure the session maps to `expired`. */
function expired(): SpectreError {
  return {
    code: NormalizedErrorCode.MAILBOX_EXPIRED,
    provider: "guerrilla",
    description: "no such mailbox",
  };
}

/** A provider failure the session maps to `restoreFailed`. */
function unchecked(): SpectreError {
  return {
    code: NormalizedErrorCode.NETWORK_ERROR,
    provider: "guerrilla",
    description: "the provider did not answer",
    cause: new Error("no answer"),
  };
}

/** A scheduler that records nothing and runs nothing, so nothing polls after an assertion. */
function inertScheduler(): MailboxScheduler {
  return { schedule: () => () => undefined };
}

function stubProvider(
  over: {
    readonly createMailbox?: () => Promise<Mailbox>;
    readonly listMessages?: () => Promise<never[]>;
  } = {},
): MailProvider & { readonly creates: () => number } {
  let creates = 0;
  return {
    id: "guerrilla",
    displayName: "Guerrilla Mail",
    supports: () => false,
    checkHealth: () => Promise.resolve({ provider: "guerrilla", status: "ok" }),
    createMailbox: () => {
      creates += 1;
      return over.createMailbox ? over.createMailbox() : Promise.resolve(NEWER);
    },
    listMessages: () => (over.listMessages ? over.listMessages() : Promise.resolve([])),
    getMessage: () => Promise.reject(new Error("unused")),
    /**
     * **The count is the instrument here, not a convenience.** "The page brought the chosen
     * address up" cannot distinguish a return from a creation, because both put an address on
     * screen — and a creation against a rate-limited provider is the failure the return path
     * exists to avoid.
     */
    creates: () => creates,
  };
}

/**
 * The provider overrides a caller named, or none.
 *
 * **A function rather than an object literal at the call site**, because `exactOptionalPropertyTypes`
 * refuses `{ createMailbox: undefined }` for a property declared `createMailbox?: () => …`, and a
 * page-level helper that cannot be called without naming every override is a helper every case
 * re-implements.
 */
function overrides(options: {
  readonly createMailbox?: () => Promise<Mailbox>;
  readonly listMessages?: () => Promise<never[]>;
}): {
  readonly createMailbox?: () => Promise<Mailbox>;
  readonly listMessages?: () => Promise<never[]>;
} {
  const built: { createMailbox?: () => Promise<Mailbox>; listMessages?: () => Promise<never[]> } =
    {};
  if (options.createMailbox !== undefined) built.createMailbox = options.createMailbox;
  if (options.listMessages !== undefined) built.listMessages = options.listMessages;
  return built;
}

/**
 * Render the whole page, with the storage, the collection and the provider all injected.
 *
 * **Every one of the three is injected rather than reached**, because the real ones need IndexedDB
 * and `jsdom` has none, and a test that installed a fake global would be mutating shared state the
 * next case could see.
 */
function renderPage(options: {
  readonly stored: Mailbox | null;
  readonly held: readonly Mailbox[];
  readonly provider?: ReturnType<typeof stubProvider>;
  readonly saves?: Mailbox[];
  readonly createMailbox?: () => Promise<Mailbox>;
  readonly listMessages?: () => Promise<never[]>;
}) {
  const provider = options.provider ?? stubProvider(overrides(options));

  const storage: SpectreStorage = {
    loadMailbox: () => Promise.resolve(options.stored),
    saveMailbox: (one) => {
      options.saves?.push(one);
      return Promise.resolve();
    },
    clearAll: () => Promise.resolve(),
  };

  return render(
    <App
      session={createMailboxSession(createProviderManager([provider]), inertScheduler())}
      storage={{ kind: "ready", storage }}
      mailboxes={READY(stubMailboxes({ held: options.held }))}
    />,
  );
}
