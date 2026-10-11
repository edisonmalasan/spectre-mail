/**
 * One wake of the background check, in a real Chromium, measured by the requests it costs.
 *
 * ## What only this tier can answer
 *
 * Three things, of which the first is a fact about the platform and the other two are facts about
 * what this product's code costs on the wire — which nothing above a browser holds either way:
 *
 * 1. **that a `chrome.alarms` firing actually wakes an MV3 worker.** `docs/PROVIDERS.md` §4.1.1
 *    measured the worker's *lifetime* as a bound and recorded, in the words this repository keeps
 *    using, that *"nothing in this repository has observed that wake"*. **This file observes it**:
 *    the worker is idle, an alarm fires, and the next thing that happens is a provider request from
 *    a context that had been terminated.
 * 2. **that one wake costs exactly one provider request.** The unit tier counts `restoreSummaries`
 *    calls; this tier counts what went over the wire **and when each request was made**. That last
 *    part is not decoration - it is the difference between measuring a per-wake cost and measuring a
 *    total, and the falsification harness found this case measuring a total: an arm making every wake
 *    list twice was **green**, because two wakes listing once and one wake listing twice produce the
 *    same log of URLs. Counting alone is `docs/PROVIDERS.md`-shaped folklore here; counting *and
 *    spacing* is a measurement. The tier distinction is not pedantry either - it is the instrument
 *    that caught `in-page-fill`'s `close()` defect, where a session could restore once and then poll,
 *    and every unit-level reading of the session said it had not.
 *
 *    **It is also the instrument that caught a shipped defect in this slice.** The case below was
 *    written against *"one listing per wake is twelve provider requests a minute"*, which is a
 *    figure the change had worked out on paper, and it failed with **two** requests for a mailbox
 *    holding **one** message - the listing, and a read of that message's body - and the **same two**
 *    on the next wake. So the cost did not converge: each wake builds a fresh session, and the
 *    tracker's memory of what it has read dies with it. `packages/mailbox` now offers a listing that
 *    reads no body for a caller that renders nothing, and this is the count that says it costs one.
 * 3. **that the wake reads no message body.** Asserted as an absence over the same request log, which
 *    is where `extension-client`'s "a wake takes one listing and reads no message body" is a claim
 *    about requests rather than about intentions. **This is a repair rather than a first
 *    verification**: the same sentence used to read *"never opens a message"*, which was true of
 *    `openMessage` and silent about the verdict pass behind it, and the count above is what showed
 *    the body being read.
 *
 * ## What this does not establish
 *
 * - **Nothing about a live provider.** Every response is recorded; see `recorded-provider.ts`.
 * - **Nothing about whether the five-second period is tolerable to a real one.** The period is this
 *   product's own number and `use it externally` remains unverified.
 * - **Nothing about a notification being seen.** The wake this file measures is a *first* check, which
 *   baselines rather than announcing - so this file does not reach `chrome.notifications` at all, and
 *   the limits recorded in `docs/PROVIDERS.md` §4.5 are unchanged by anything here.
 * - **Nothing about a headed desktop**, or about alarm firing under load. §4.1.1 measured mean
 *   spacing on this machine and found no packing on this substrate; the starvation it found was
 *   between *two* armed alarms, which this slice never creates.
 *
 * @module
 */

import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { INBOX_POLL_CEILING_MS, INBOX_POLL_PROMPT_MS } from "@spectre-mail/mailbox";
import { readStoredMailboxCollection, readStoredSeenMessageIds } from "@spectre-mail/storage";

import { BACKGROUND_ALARM_NAME } from "../src/alarms";
import { launchExtension } from "./launch-extension";
import type { LaunchedExtension } from "./launch-extension";
import { FIXTURE_IDS, recordProviderTraffic } from "./recorded-provider";
import type { ProviderTraffic } from "./recorded-provider";
import { clearStoredMailbox, readMailboxCollectionRecord } from "./helpers/stored-mailbox";
import { clearArmedAlarms, readArmedAlarms, readSeenRecord } from "./helpers/background-state";

let extension: LaunchedExtension;

/** The pages this file opens, so each case can close all of them. */
const opened: Page[] = [];

test.beforeAll(async () => {
  extension = await launchExtension();
});

test.afterAll(async () => {
  await extension?.close();
});

/**
 * Start every case from a device that holds nothing and schedules nothing.
 *
 * **Both halves, always, and in this order.** The alarm is cleared *after* the storage so that a
 * wake already in flight finds no mailbox rather than one the previous case left behind; and the
 * storage is cleared before the popup is opened, because the popup reads it once at boot. This is
 * the recorded "every case that starts provider work must finish it" precondition: the alarm is
 * periodic, the worker outlives the page, and closing a page does not stop an alarm.
 */
test.beforeEach(async () => {
  await clearArmedAlarms(extension);
  await clearStoredMailbox(extension);
});

test.afterEach(async () => {
  for (const page of opened.splice(0)) {
    await page.close().catch(() => undefined);
  }
  await clearArmedAlarms(extension);
});

/**
 * The ceiling for waiting on an alarm to fire.
 *
 * **`INBOX_POLL_CEILING_MS`, imported rather than chosen.** The alarm's period is
 * `INBOX_POLL_PROMPT_MS` - five seconds - so this is six periods, which is the same six the website
 * tier waits for a poll to be *askable*. A number picked here would be a number picked to be large
 * enough, which is the recorded defect with a larger constant, and it would drift the first time the
 * cadence changed.
 */
const WAKE_CEILING_MS = INBOX_POLL_CEILING_MS;

/** A device that has just been given a mailbox by a person pressing the popup's control. */
interface Armed {
  readonly traffic: ProviderTraffic;
  /** How many provider requests had been made before the alarm could have fired. */
  readonly baseline: number;
}

/**
 * Create a mailbox through the popup, and return the request log to measure against.
 *
 * **The popup is opened as a document at its own origin**, for the reason `in-page-fill.spec.ts`
 * records: `chrome.action.openPopup()` adds no Playwright page, and a popup opened as a tab is its
 * own active tab. **The address appearing is not the arming**, and the baseline is taken only after
 * the alarm is *observed* armed - so the count this file asserts on cannot include a wake that
 * happened while it was still setting up.
 */
async function createAndWaitForTheAlarm(): Promise<Armed> {
  const traffic = await recordProviderTraffic(extension.context);
  expect(traffic.unscripted).toEqual([]);

  const popup = await extension.context.newPage();
  opened.push(popup);
  await popup.goto(`chrome-extension://${extension.extensionId}/popup.html`);
  await expect(popup.getByRole("button", { name: "Create an address" })).toBeVisible();

  // **A device holding no mailbox schedules nothing, and it is asserted before the press rather
  // than assumed.** The requirement says the alarm is armed where a mailbox is written, so a device
  // that armed it on boot would be spending provider budget on a wake with nothing to list.
  expect(await readArmedAlarms(extension)).toEqual([]);

  await popup.getByRole("button", { name: "Create an address" }).click();
  await expect(popup.locator(".popup__address")).toHaveText(/@uberip\.com$/);

  /**
   * **The alarm is waited for rather than slept for.** `service-worker.ts` arms it in the message
   * listener's own continuation, so the address is on screen before the `create` has been asked for,
   * and a baseline taken at the address would be racing the arming.
   */
  await expect
    .poll(() => readArmedAlarms(extension), { timeout: WAKE_CEILING_MS })
    .toEqual([BACKGROUND_ALARM_NAME]);

  const baseline = traffic.requested.length;
  await popup.close();

  return { traffic, baseline };
}

/** One provider request the wake made, with the instant it was seen reaching the interceptor. */
interface Asked {
  readonly url: string;
  readonly at: number;
}

/**
 * Every provider request made since {@link Armed.baseline} was taken, with when each was seen.
 *
 * **URL and time together, and neither alone answers the question this file asks.** The `url` says
 * *what* was asked for and the `at` says *which iteration of a loop* asked for it; a log of URLs
 * answers only the first, and the limit below is what a case built on URLs alone can and cannot see.
 */
function since(traffic: ProviderTraffic, baseline: number): readonly Asked[] {
  return traffic.requested
    .slice(baseline)
    .map((url, offset) => ({ url, at: traffic.requestedAt[baseline + offset] ?? 0 }));
}

/**
 * The smallest gap that can only be explained by two separate iterations of the alarm.
 *
 * **`INBOX_POLL_PROMPT_MS / 5`, derived rather than chosen.** The alarm's period is
 * `INBOX_POLL_PROMPT_MS`, and a fifth of it is an order of magnitude above what two requests made
 * back to back by the same iteration have ever been observed to cost (milliseconds, against a
 * local interceptor answering a recorded response) and well below the period. **A number picked
 * here would be a number picked to be large enough**, which is the recorded defect with a larger
 * constant.
 *
 * **It is a discriminator, not a measurement of the period.** Nothing here claims the alarm fires
 * every 5 000 ms; `docs/PROVIDERS.md` §4.1.1 measured mean spacing on this substrate and found no
 * packing, and this file takes that as background rather than re-deriving it. What this constant
 * buys is the one distinction the URL log cannot make.
 */
const SEPARATE_WAKE_GAP_MS = INBOX_POLL_PROMPT_MS / 5;

test.describe("a wake of the background check", () => {
  test("costs one provider request, and it is a listing and nothing else", async () => {
    const { traffic, baseline } = await createAndWaitForTheAlarm();

    await expect
      .poll(() => since(traffic, baseline).length, { timeout: WAKE_CEILING_MS })
      .toBeGreaterThan(0);

    /**
     * **A second wake is waited for before counting, and that is the first of two repairs.**
     *
     * The first version of this case read the count as soon as it went above zero, and it was red with
     * **two** requests - the listing, and a read of the message body - which the change's own delta
     * said could not happen. Reading only the first wake would also have stopped short of the finding
     * that mattered: the second wake cost the same two, so the figure was not a first-wake cost that
     * later wakes avoided, it was a loop. Counting across two wakes makes the claim a **per-wake
     * constant**, which is the property `packages/mailbox`'s case measures one layer down.
     *
     * **`toBeGreaterThan(1)` rather than `toBe(2)`, and the difference is the report.** A wake costing
     * two requests each would carry the count straight past 2 to 4, and a poll waiting for `toBe(2)`
     * would then run to its ceiling and fail naming a *timeout* rather than the count it was waiting
     * for. The exact number is asserted on the next line, where a failure names the numbers.
     */
    await expect
      .poll(() => since(traffic, baseline).length, { timeout: WAKE_CEILING_MS })
      .toBeGreaterThan(1);

    const asked = since(traffic, baseline);
    expect(asked).toHaveLength(2);

    /**
     * **Named rather than counted alone.** A count of two is equally consistent with two requests of
     * the right kind and two of the wrong kind, and this line is what says which.
     */
    for (const { url } of asked) expect(url).toContain("/messages?page=1");

    /**
     * **No message body was read, asserted as an absence over the same log.**
     *
     * A wake that read a body would cost a *second* request per message, so the length assertion above
     * would already fail - but it would fail naming a count, and this names what the count must not
     * contain. The id is the recorded one, imported rather than retyped, for the reason
     * `recorded-provider.ts` gives.
     */
    expect(
      asked.filter(({ url }) => url.includes(`/messages/${FIXTURE_IDS.mailtm.messageId}`)),
    ).toEqual([]);

    /**
     * **The second of the two repairs, and the one this file was wrong about until an arm said so.**
     *
     * A count of two is produced by **two wakes listing once each** and by **one wake listing twice**,
     * and a log of URLs cannot tell them apart — so this case, written to measure a per-wake cost,
     * would have accepted a wake doing double the work. The falsification harness proved it: an arm
     * making every wake list twice came back **green**, which is the recorded "an assertion that
     * passes for the wrong reason" in the one shape it is hardest to notice, because the case looked
     * like it was counting something.
     *
     * **The gap is what tells them apart**, and it is asserted on the two requests rather than on a
     * wake count because nothing observes a wake except its requests. Two requests from one iteration
     * are back to back; two iterations of a five-second alarm are not.
     */
    const first = asked[0];
    const second = asked[1];
    if (first === undefined || second === undefined) throw new Error("two requests were expected");
    expect(second.at - first.at).toBeGreaterThanOrEqual(SEPARATE_WAKE_GAP_MS);
  });

  test("records what the provider reported, and announces nothing on a first check", async () => {
    const { traffic, baseline } = await createAndWaitForTheAlarm();

    await expect
      .poll(() => since(traffic, baseline).length, { timeout: WAKE_CEILING_MS })
      .toBeGreaterThan(0);

    /**
     * **The record is waited for rather than read on the next line.** The request log records that a
     * request was *made*, not that the wake finished writing behind it - and this repository has
     * already recorded that difference twice, in the opposite direction ("waiting for the address to
     * appear on the popup does not wait for the `saveMailbox` write").
     */
    const mailboxId = await watchedMailboxId(extension);
    await expect
      .poll(async () => readStoredSeenMessageIds(await readSeenRecord(extension), mailboxId), {
        timeout: WAKE_CEILING_MS,
      })
      .toMatchObject({ kind: "ids" });

    /**
     * **And it holds the message the recorded provider actually reported.** Read through the
     * product's own reader, so a record this build cannot narrow fails the case rather than reading
     * as "nothing was recorded".
     */
    const read = readStoredSeenMessageIds(await readSeenRecord(extension), mailboxId);
    expect(read.kind).toBe("ids");
    expect(read.kind === "ids" ? read.ids : []).toContain(FIXTURE_IDS.mailtm.messageId);
  });
});

/**
 * The id of the mailbox this device is watching, read from the collection through the product's own
 * reader.
 *
 * **Read rather than derived.** The Mail.tm adapter builds the id as its resource URL, so a spec
 * that rebuilt that string would hold a second copy of a rule this repository has already been bitten
 * by twice - and `FIXTURE_IDS.mailtm.accountId` is the bare account id, which is *not* the mailbox
 * id. So the answer is read from where the product put it.
 *
 * @throws If the device holds no mailbox the collection can be read from.
 */
async function watchedMailboxId(launched: LaunchedExtension): Promise<string> {
  const raw = await readMailboxCollectionRecord(launched);
  const collection = raw === null ? null : readStoredMailboxCollection(raw);
  if (collection === null || collection.length === 0) {
    throw new Error(
      "this device holds no mailbox the collection reader can narrow, so it has nothing for a " +
        "wake to watch - and a spec that carried on would look the message up under a null id",
    );
  }
  return collection[0]!.id;
}
