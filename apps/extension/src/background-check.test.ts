/**
 * One wake: what it lists, what it announces, and what it records.
 *
 * ## The session this file can build cannot open a message
 *
 * `extension-client` requires the check to **never open a message**, and that the exclusion of a
 * one-time code from a notification be structural rather than a filter. Both are properties of what
 * the wake is *given*, so {@link createExtensionListingReader} accepts a session factory and the type
 * it accepts is `Pick<MailboxSession, "restore" | "destroy">`. **A fake built here cannot be asked to
 * open anything** — the members do not exist on it — so the strongest form of the claim is checked
 * by the compiler rather than by an assertion, and the case below that passes one only proves the
 * wiring.
 *
 * ## The falsification the arms are shaped for
 *
 * Every outcome differs in what it does to the record, and the arms that differ in the *same* way
 * are the ones worth having pairs for: a refusal and a failed write both leave a message unrecorded,
 * and a quiet listing and a read that failed both leave the record untouched — **for different
 * reasons, with different consequences for the next wake**. A suite that tested only one of each pair
 * would pass a check that swallowed the retry.
 *
 * ## Why `empty-mailbox` is its own outcome rather than `quiet`
 *
 * Because it is the one case the record contract cannot express: `saveSeenMessageIds` **refuses an
 * empty list**, so a mailbox that empties keeps what it had recorded. Folding it into `quiet` would
 * hide a divergence from the delta's prune clause behind an arm that claims nothing was written,
 * which it was not — it was refused.
 *
 * @vitest-environment node
 */

import type { Mailbox, MessageSummary } from "@spectre-mail/core";
import { createMailbox } from "@spectre-mail/core";
import type { InboxListing, SessionState } from "@spectre-mail/mailbox";
import type { Transport } from "@spectre-mail/providers";
import { describe, expect, it, vi } from "vitest";

import {
  createBackgroundCheck,
  createExtensionListingReader,
  runBackgroundCheck,
} from "./background-check";
import type { BackgroundCheckDependencies, WakeSession } from "./background-check";

const WATCHED = createMailbox({
  id: "mailbox-1",
  address: "watched@address.test",
  createdAt: 0,
  credentials: { provider: "guerrilla", sessionId: "watched-session" },
});

function message(id: string, overrides: Partial<MessageSummary> = {}): MessageSummary {
  return {
    id,
    mailboxId: WATCHED.id,
    from: "sender@address.test",
    subject: `subject of ${id}`,
    receivedAt: 0,
    ...overrides,
  };
}

function listing(messages: readonly MessageSummary[]): InboxListing {
  return { messages, verdicts: new Map() };
}

/** The listing a restored mailbox arrives with, which is the state every happy path runs on. */
function readyWith(messages: readonly MessageSummary[]): SessionState {
  return {
    kind: "ready",
    mailbox: WATCHED,
    inbox: { kind: "checked", listing: listing(messages) },
    opened: { kind: "none" },
  };
}

/**
 * The seams one wake acts through, each of which the cases below drive by name.
 *
 * **Every seam is a `vi.fn` so the cases can assert what was *asked*, not only what was returned** —
 * which is the difference between "raises no notification" (observable) and "changed nothing"
 * (observable only by counting writes).
 */
function seams(
  overrides: Partial<BackgroundCheckDependencies> = {},
): BackgroundCheckDependencies & {
  readonly saves: ReturnType<typeof vi.fn>;
  readonly clears: ReturnType<typeof vi.fn>;
  readonly announcements: ReturnType<typeof vi.fn>;
} {
  const saves = vi.fn(async () => {});
  const clears = vi.fn(async () => {});
  const announcements = vi.fn(async () => true);

  return {
    saves,
    clears,
    announcements,
    listMailbox: vi.fn(async () => ({ kind: "listed" as const, listing: listing([]) }) as const),
    loadSeenMessageIds: vi.fn(async () => null),
    saveSeenMessageIds: saves,
    announce: announcements,
    clearAlarm: clears,
    ...overrides,
  };
}

describe("listing the watched mailbox", () => {
  it("takes one listing through one session, and releases that session", async () => {
    // **`(Mailbox | null)[]`, because that is what the real signature accepts.** Narrowing the
    // record instead would make this case unable to say what it was handed.
    const restores: (Mailbox | null)[] = [];
    const destroys: number[] = [];
    const sessions: WakeSession[] = [];

    const reader = createExtensionListingReader(
      { send: vi.fn(), headers: vi.fn() } as unknown as Transport,
      () => {
        const index = sessions.length;
        sessions.push({
          // **`Mailbox | null`, and that is the real signature.** `MailboxSession.restore` is
          // typed to accept a null for the first-visit path, so narrowing the fake's parameter
          // here would be a type error rather than a stricter fake.
          restore: async (mailbox: Mailbox | null) => {
            restores.push(mailbox);
            return readyWith([message("m1")]);
          },
          destroy: () => destroys.push(index),
        });
        return sessions[index]!;
      },
    );

    const outcome = await reader(WATCHED);

    expect(outcome).toEqual({ kind: "listed" as const, listing: listing([message("m1")]) });
    // **One restore and one destroy, counted.** This is the unit half of the one-request-per-wake
    // claim; the browser tier measures the requests themselves, because a session could restore once
    // and poll.
    expect(restores).toEqual([WATCHED]);
    expect(destroys).toEqual([0]);
  });

  it("releases the session even when the listing failed", async () => {
    const destroys = vi.fn();

    const reader = createExtensionListingReader(
      { send: vi.fn(), headers: vi.fn() } as unknown as Transport,
      () => ({
        restore: async () => {
          throw new Error("the provider could not be reached");
        },
        destroy: destroys,
      }),
    );

    // **The `finally`, and it is the only thing standing between a failed wake and a worker holding a
    // session.** A reader without one would pass every case in the suite above and leak on every
    // real provider failure.
    await expect(reader(WATCHED)).rejects.toThrow("the provider could not be reached");
    expect(destroys).toHaveBeenCalledTimes(1);
  });

  it("reports a mailbox the provider has reported gone as gone, and anything else as unavailable", async () => {
    const stateFor = (state: SessionState): ReturnType<typeof createExtensionListingReader> =>
      createExtensionListingReader(
        { send: vi.fn(), headers: vi.fn() } as unknown as Transport,
        () => ({ restore: async () => state, destroy: () => {} }),
      );

    await expect(
      await stateFor({ kind: "expired", mailbox: WATCHED, opened: { kind: "none" } })(WATCHED),
    ).toEqual({ kind: "expired" });

    await expect(
      await stateFor({
        kind: "restoreFailed",
        mailbox: WATCHED,
        failure: {
          code: "PROVIDER_UNAVAILABLE",
          description: "no answer",
          providerFailures: [],
        },
        opened: { kind: "none" },
      })(WATCHED),
    ).toEqual({ kind: "unavailable", reason: "the session reported restoreFailed" });

    // **A check that failed carries the *previous* listing**, and announcing from it would be
    // announcing a listing this wake never took. So it is refused rather than used.
    await expect(
      await stateFor({
        kind: "ready",
        mailbox: WATCHED,
        inbox: {
          kind: "checkFailed",
          listing: listing([message("stale")]),
          failure: {
            code: "PROVIDER_UNAVAILABLE",
            description: "no answer",
            providerFailures: [],
          },
        },
        opened: { kind: "none" },
      })(WATCHED),
    ).toEqual({ kind: "unavailable", reason: "no answer" });
  });
});

describe("what a wake announces", () => {
  it("does nothing at all where this device holds no mailbox", async () => {
    const deps = seams();

    await expect(runBackgroundCheck(null, deps)).resolves.toEqual({ kind: "no-mailbox" });

    // **Nothing was asked and nothing was written**, which is what makes "an alarm with no mailbox
    // behind it" cost nothing beyond the wake that discovered it.
    expect(deps.listMailbox).not.toHaveBeenCalled();
    expect(deps.saves).not.toHaveBeenCalled();
  });

  it("establishes a baseline on the first check and announces nothing", async () => {
    const deps = seams({
      listMailbox: vi.fn(async () => ({
        kind: "listed" as const,
        listing: listing([message("m1"), message("m2")]),
      })),
    });

    await expect(runBackgroundCheck(WATCHED, deps)).resolves.toEqual({
      kind: "baseline",
      recorded: 2,
    });

    // **The requirement's case in full**: no notification for what the listing returned, and those
    // ids recorded. Without the baseline a device installing over a full mailbox would be told about
    // forty messages at once.
    expect(deps.announcements).not.toHaveBeenCalled();
    expect(deps.saves).toHaveBeenCalledWith(WATCHED.id, ["m1", "m2"]);
  });

  it("announces only what this device has not been told about", async () => {
    const deps = seams({
      listMailbox: vi.fn(async () => ({
        kind: "listed" as const,
        listing: listing([message("m1"), message("m2")]),
      })),
      loadSeenMessageIds: vi.fn(async () => ["m1"]),
    });

    await expect(runBackgroundCheck(WATCHED, deps)).resolves.toEqual({
      kind: "announced",
      raised: ["m2"],
      withheld: [],
    });

    expect(deps.announcements).toHaveBeenCalledTimes(1);
    expect(deps.announcements.mock.calls[0]?.[0]).toEqual(message("m2"));
    expect(deps.saves).toHaveBeenCalledWith(WATCHED.id, ["m1", "m2"]);
  });

  it("does not record a message whose notification the platform refused", async () => {
    const deps = seams({
      listMailbox: vi.fn(async () => ({
        kind: "listed" as const,
        listing: listing([message("m1"), message("m2")]),
      })),
      loadSeenMessageIds: vi.fn(async () => ["m1"]),
      announce: vi.fn(async () => false),
    });

    // **`withheld` names it, and the outcome is `announced` rather than `unchanged`.** This is the
    // property `in-page-fill` found in a control that removed itself from the page without telling
    // its caller: the retry depends on the caller being told, and both a record that advanced anyway
    // *and* an outcome that reported nothing happened would swallow it. **Two assertions, because
    // the second is the one the first was found by** — the record was already right here, and only
    // the arm was wrong.
    await expect(runBackgroundCheck(WATCHED, deps)).resolves.toEqual({
      kind: "announced",
      raised: [],
      withheld: ["m2"],
    });
    // **And no write at all**, because replacing the record with itself is not a change. A case
    // asserting only the outcome above would pass an implementation that rewrote the record on
    // every refused notification.
    expect(deps.saves).not.toHaveBeenCalled();
  });

  it("writes nothing where the listing has not changed", async () => {
    const deps = seams({
      listMailbox: vi.fn(async () => ({
        kind: "listed" as const,
        listing: listing([message("m2"), message("m1")]),
      })),
      // **A different order, the same set.** The comparison is by membership, so a provider that
      // reorders its listing does not make every wake a write.
      loadSeenMessageIds: vi.fn(async () => ["m1", "m2"]),
    });

    await expect(runBackgroundCheck(WATCHED, deps)).resolves.toEqual({ kind: "unchanged" });
    expect(deps.saves).not.toHaveBeenCalled();
    expect(deps.announcements).not.toHaveBeenCalled();
  });

  it("prunes an id the provider no longer reports", async () => {
    const deps = seams({
      listMailbox: vi.fn(async () => ({
        kind: "listed" as const,
        listing: listing([message("m1")]),
      })),
      loadSeenMessageIds: vi.fn(async () => ["m1", "gone"]),
    });

    // **`pruned` rather than `announced`, and the arm is the assertion.** Nothing was asked of the
    // platform here, so an outcome claiming a notification was raised would be the same lie in the
    // other direction — and the requirement's "written only when that changed" needs the write to
    // be visible somewhere, or a reader cannot tell pruning from a no-op.
    await expect(runBackgroundCheck(WATCHED, deps)).resolves.toEqual({
      kind: "pruned",
      removed: ["gone"],
    });
    expect(deps.saves).toHaveBeenCalledWith(WATCHED.id, ["m1"]);
    expect(deps.announcements).not.toHaveBeenCalled();
  });

  it("costs one listing and no storage traffic where the mailbox is empty", async () => {
    const deps = seams({
      listMailbox: vi.fn(async () => ({ kind: "listed" as const, listing: listing([]) })),
      loadSeenMessageIds: vi.fn(async () => ["m1"]),
    });

    await expect(runBackgroundCheck(WATCHED, deps)).resolves.toEqual({ kind: "empty-mailbox" });

    // **The record was not read and not written.** An empty mailbox cannot be told about, so the
    // cheapest correct answer is to stop there — and the record it left behind is the one case the
    // contract cannot express, which `alarms.test.ts`'s sibling case in the design record names.
    expect(deps.loadSeenMessageIds).not.toHaveBeenCalled();
    expect(deps.saves).not.toHaveBeenCalled();
    expect(deps.announcements).not.toHaveBeenCalled();
  });
});

describe("what a wake that cannot answer changes", () => {
  it("announces nothing and leaves the record alone where the provider could not be reached", async () => {
    const deps = seams({
      listMailbox: vi.fn(async () => ({ kind: "unavailable", reason: "no answer" }) as const),
      loadSeenMessageIds: vi.fn(async () => ["m1"]),
    });

    await expect(runBackgroundCheck(WATCHED, deps)).resolves.toEqual({
      kind: "failed",
      reason: "no answer",
    });

    expect(deps.announcements).not.toHaveBeenCalled();
    expect(deps.saves).not.toHaveBeenCalled();
    // **The alarm stays.** A provider that could not be reached will be reachable again, and
    // clearing on failure would silence this device until something else armed it.
    expect(deps.clears).not.toHaveBeenCalled();
  });

  it("leaves the record alone where the record itself could not be read", async () => {
    // **A read reported as empty would announce the whole mailbox.** This is the `loadMailbox` rule
    // in `packages/storage`, one step on, and it is why `loadSeenMessageIds` rejects rather than
    // answering `null` for a failure.
    const deps = seams({
      listMailbox: vi.fn(async () => ({
        kind: "listed" as const,
        listing: listing([message("m1"), message("m2")]),
      })),
      loadSeenMessageIds: vi.fn(async () => {
        throw new Error("the record could not be read");
      }),
    });

    await expect(runBackgroundCheck(WATCHED, deps)).resolves.toEqual({
      kind: "failed",
      reason: "the record could not be read",
    });
    expect(deps.announcements).not.toHaveBeenCalled();
    expect(deps.saves).not.toHaveBeenCalled();
  });

  it("records nothing where the write failed, so the message is announced again", async () => {
    // **The same end state as a refusal, reached by a different cause**, and both are needed: a
    // single case for "nothing was recorded" would pass a check that treated either cause as the
    // other.
    const deps = seams({
      listMailbox: vi.fn(async () => ({
        kind: "listed" as const,
        listing: listing([message("m1")]),
      })),
      loadSeenMessageIds: vi.fn(async () => []),
      saveSeenMessageIds: vi.fn(async () => {
        throw new Error("the write did not commit");
      }),
    });

    await expect(runBackgroundCheck(WATCHED, deps)).resolves.toEqual({
      kind: "failed",
      reason: "the write did not commit",
    });
    expect(deps.announcements).toHaveBeenCalledTimes(1);
    expect(deps.clears).not.toHaveBeenCalled();
  });

  it("clears the alarm for a mailbox the provider reported gone, and removes nothing", async () => {
    const deps = seams({
      listMailbox: vi.fn(async () => ({ kind: "expired" }) as const),
      loadSeenMessageIds: vi.fn(async () => ["m1"]),
    });

    await expect(runBackgroundCheck(WATCHED, deps)).resolves.toEqual({ kind: "expired" });

    expect(deps.clears).toHaveBeenCalledTimes(1);
    // **The stored mailbox is left exactly where it is.** A provider's word about a mailbox is not
    // this product's authority to delete the user's record of it, and nothing here has a removal.
    expect(deps.saves).not.toHaveBeenCalled();
    expect(deps.announcements).not.toHaveBeenCalled();
  });
});

describe("composing a wake for this context", () => {
  /** Records with only the members this composition reads, so a case can say which one it is about. */
  function recordsWith(held: readonly Mailbox[], loadRejects = false) {
    return {
      stored: {
        loadMailbox: async () => null,
        saveMailbox: async () => {},
        clearAll: async () => {},
      },
      mailboxes: {
        loadMailboxes: async () => {
          if (loadRejects) throw new Error("the collection read failed");
          return held;
        },
        addMailbox: async () => {},
      },
      associations: {
        loadSiteMailboxId: async () => null,
        saveSiteMailboxId: async () => {},
      },
      seen: { loadSeenMessageIds: async () => null, saveSeenMessageIds: async () => {} },
    };
  }

  const transport = { send: vi.fn(), headers: vi.fn() } as unknown as Transport;

  it("watches the head of the mailboxes this device would hand a visitor", async () => {
    // **The answer is computed by `loadInsertableMailboxes` and by nothing else**, so the mailbox the
    // background check watches is the mailbox a visitor is handed. **Two mailboxes are given so a
    // reader taking the tail, or checking both, would be caught** — and the seam below is the
    // composition's own, because `createExtensionListingReader` reaches a real session and a real
    // provider, and a case about *which mailbox was chosen* must not depend on either.
    const newest = createMailbox({
      id: "newest",
      address: "newest@address.test",
      createdAt: 1,
      credentials: { provider: "guerrilla", sessionId: "newest-session" },
    });
    const older = createMailbox({
      id: "older",
      address: "older@address.test",
      createdAt: 0,
      credentials: { provider: "guerrilla", sessionId: "older-session" },
    });

    const watchedFor: Mailbox[] = [];
    const recordFor: string[] = [];

    const wake = createBackgroundCheck(
      {
        transport,
        records: {
          ...recordsWith([newest, older]),
          seen: {
            loadSeenMessageIds: async (mailboxId) => {
              recordFor.push(mailboxId);
              return null;
            },
            saveSeenMessageIds: async () => {},
          },
        },
        announce: async () => true,
        clearAlarm: async () => {},
      },
      async (mailbox) => {
        watchedFor.push(mailbox);
        return { kind: "listed" as const, listing: listing([message("m1")]) };
      },
    );

    // **Two reads of the same fact, and both have to agree.** One would pass a composition that
    // listed one mailbox and recorded another.
    const outcome = await wake();

    expect(outcome).toEqual({ kind: "baseline", recorded: 1 });
    expect(watchedFor.map((held) => held.id)).toEqual(["newest"]);
    expect(recordFor).toEqual(["newest"]);
  });

  it("falls back to the mailbox a build predating the collection wrote", async () => {
    // **`loadInsertableMailboxes` rather than the collection alone**, for the reason `storage.ts`
    // gives: a device whose mailbox predates the collection still holds one, and asking the
    // collection alone would tell this extension it has nothing to watch — silently, at the one
    // moment the answer decides whether the user is told about new mail at all.
    const legacy = createMailbox({
      id: "legacy",
      address: "legacy@address.test",
      createdAt: 0,
      credentials: { provider: "guerrilla", sessionId: "legacy-session" },
    });

    const watchedFor: Mailbox[] = [];

    const wake = createBackgroundCheck(
      {
        transport,
        records: {
          ...recordsWith([]),
          stored: {
            loadMailbox: async () => legacy,
            saveMailbox: async () => {},
            clearAll: async () => {},
          },
        },
        announce: async () => true,
        clearAlarm: async () => {},
      },
      async (mailbox) => {
        watchedFor.push(mailbox);
        return { kind: "listed" as const, listing: listing([]) };
      },
    );

    await wake();

    expect(watchedFor.map((held) => held.id)).toEqual(["legacy"]);
  });

  it("answers a failed storage read rather than throwing inside an alarm listener", async () => {
    // **An unhandled rejection in an alarm listener is a worker that logs and stops**, and the next
    // wake then does not arrive because the listener is gone.
    const wake = createBackgroundCheck({
      transport,
      records: recordsWith([], true) as never,
      announce: async () => true,
      clearAlarm: async () => {},
    });

    await expect(wake()).resolves.toEqual({
      kind: "failed",
      reason: "the collection read failed",
    });
  });
});
