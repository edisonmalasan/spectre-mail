/**
 * The two things a background wake reads or writes in the extension's own storage, and the alarm it
 * runs on - read through the platform's own API, from inside the worker's own context.
 *
 * ## Why this file exists rather than three lines in the spec
 *
 * **`chrome.storage` and `chrome.alarms` are both reached reflectively**, for the reason
 * `stored-mailbox.ts` gives at length: there is no `@types/chrome` in this package, so a direct
 * spelling does not compile, and the boundary rule confines the extension's platform global to one
 * module in `src/`. So every operation here walks from `globalThis` through `Reflect.get` with the
 * **path as data passed in from Node** - one definition of where each area lives, and neither side
 * of the bridge spelling an API this product reaches through `packages/storage`.
 *
 * **A read is a precondition, and the helpers say so.** The recorded lesson from `popup.spec.ts` is
 * that waiting for something to appear on screen does not wait for the `chrome.storage` write behind
 * it, so every read here is its own round trip and every write in `stored-mailbox.ts` is confirmed
 * by reading the key back.
 *
 * ## And what these are not
 *
 * **Not a second product reader.** `readSeenMessageIds` returns the raw stored record and the spec
 * narrows it with `readStoredSeenMessageIds` from `packages/storage`, so a record this build cannot
 * read makes the spec *fail* rather than read as "nothing was recorded" - the same direction
 * `stored-mailbox.ts` insists on, and the one that keeps a version bump from turning a case green.
 */

import { EXTENSION_SEEN_MESSAGES_KEY } from "@spectre-mail/storage";

import { BACKGROUND_ALARM_NAME } from "../../src/alarms";
import type { LaunchedExtension } from "../launch-extension";

/** The paths the two platform areas live at, as data rather than as spellings. */
const STORAGE_AREA = ["chrome", "storage", "local"] as const;
const ALARMS = ["chrome", "alarms"] as const;

/** The shape each operation needs, and nothing more. */
interface StorageArea {
  get(keys: string): Promise<Record<string, unknown>>;
}
interface AlarmArea {
  getAll(): Promise<Array<{ name?: unknown }>>;
  clearAll(): Promise<boolean>;
  create(name: string, info: { periodInMinutes: number }): void;
}

/**
 * Every alarm this extension currently owns, by name.
 *
 * **`getAll()` rather than a `get` of one name**, because the claim these cases carry is *"this
 * extension owns exactly one alarm, under this name"* - and a reader that asked only about the name
 * it expected would be satisfied by a device carrying a second one. `alarms.ts` deliberately exposes
 * no `get` member for the same reason.
 */
export async function readArmedAlarms(extension: LaunchedExtension): Promise<string[]> {
  return extension.worker.evaluate(
    async (path) => {
      const alarms = path.reduce<object>(
        (node, key) => Reflect.get(node, key),
        globalThis,
      ) as AlarmArea;
      const found = await alarms.getAll();
      return found.map((alarm) =>
        typeof alarm.name === "string" ? alarm.name : String(alarm.name),
      );
    },
    [...ALARMS],
  );
}

/**
 * Clear every alarm this extension owns.
 *
 * **Between cases rather than after the last one, and that is the point.** The alarm this change
 * ships is *periodic*, so a case that leaves one armed keeps firing for the rest of the file - and the
 * next case, which counts provider requests, would be counting a wake it did not cause. This is the
 * recorded "every case that starts provider work must finish it" precondition, and closing a page does
 * not fix it because the worker outlives the page.
 */
export async function clearArmedAlarms(extension: LaunchedExtension): Promise<void> {
  await extension.worker.evaluate(
    async (path) => {
      const alarms = path.reduce<object>(
        (node, key) => Reflect.get(node, key),
        globalThis,
      ) as AlarmArea;
      await alarms.clearAll();
    },
    [...ALARMS],
  );
}

/**
 * Arm the background alarm on demand, the way the product does.
 *
 * ## Why a spec needs to arm a product alarm
 *
 * **Because the alternative is trusting a precondition nothing can falsify.** Three specs in this
 * tier disarm the background check so that an exact count of provider requests means what it says
 * (`in-page-fill.spec.ts` carries the failing case). **A precondition that is only ever cleared can
 * be deleted by accident and nothing will fail** - the count would still be right on every run short
 * enough for the alarm not to fire, which is exactly how the defect it repairs presented: green in
 * twenty isolated runs, red once in thirty-one under load.
 *
 * So the disarm is paired with this. It is the **positive control** for the precondition: arm the
 * alarm deliberately, confirm the platform accepted it, and require a listing nobody asked for to
 * appear. **A control that can pass without the alarm being armed proves nothing**, so this helper
 * only creates the alarm - the spec reads `readArmedAlarms` back, because `chrome.alarms.create`
 * reports no error for a period it does not accept.
 *
 * **The name and the period are the product's, read from where the product reads them.** `alarms.ts`
 * owns the name and `packages/mailbox`'s cadence owns the period; a spec that restated either would
 * hold a second copy of a decision this repository has already been bitten by, and would keep passing
 * after the product changed both.
 */
export async function armBackgroundAlarm(
  extension: LaunchedExtension,
  name: string,
  periodInMinutes: number,
): Promise<void> {
  await extension.worker.evaluate(
    async ([path, alarmName, period]) => {
      const alarms = (path as readonly string[]).reduce<object>(
        (node, key) => Reflect.get(node, key),
        globalThis,
      ) as AlarmArea;
      alarms.create(alarmName as string, { periodInMinutes: period as number });
    },
    [[...ALARMS], name, periodInMinutes] as const,
  );
}

/**
 * Wait for the arming a popup press triggers, and then disarm it.
 *
 * ## Why this is not just {@link clearArmedAlarms}
 *
 * **Because clearing and arming can be in flight at the same moment, and the clear loses whenever it
 * arrives first.** `Popup.tsx` renders the address the moment `session.open()` publishes `ready`, and
 * the arming is asked for *after* that — `await storage.addMailbox(...)` and then
 * `await requestBackgroundAlarm()`. So a spec waiting for the address to appear is released while the
 * arming request is still travelling to the worker. A `clearArmedAlarms` issued at that point clears
 * nothing, and the worker arms a moment later.
 *
 * **That is this repository's own recorded lesson, one door over**: *"waiting for the address to
 * appear on the popup does not wait for the `saveMailbox` write"*. Here it is worse, because what goes
 * unwaited is the *arming that follows* the write — and the popup never states on screen whether the
 * arming has happened, so no screen assertion can stand in for it.
 *
 * **Measured rather than reasoned.** Thirty consecutive full-suite runs after the first version of
 * this repair came back **18 green and 12 red**, every red being the same single case, failing on its
 * own assertion that nothing was armed — which is the control reporting that the disarm was a race
 * rather than a disarm. The tell is in the shape: a race is decided by *which side is slower*, so it
 * is decided by machine load, and the pre-repair baseline was one red in forty-six attempts.
 *
 * **So the order is inverted: wait for the arming, then clear.** Reading the alarm back until it is
 * armed *is* observing that the popup's request has been answered — the arming is the last thing that
 * request does — and a clear issued after that cannot lose the race at any load.
 *
 * ## What this is not
 *
 * **Not a second way to disarm.** A spec that wants the device quiet with nothing in flight — an
 * `afterEach`, a `beforeEach` — still calls {@link clearArmedAlarms}. **This one is for the one place
 * where a known arming is still travelling**, and it is a precondition rather than a cleanup.
 *
 * @param timeoutMs - How long the arming may take to become observable. **Passed in rather than
 *   chosen here**, so every caller waits the cadence's own ceiling; a number picked in this helper
 *   would be a number picked to be large enough, and would drift the first time the cadence changed.
 * @throws If no arming appears within `timeoutMs`, naming what it saw. **Reported rather than
 *   swallowed**, because the two states a caller cannot distinguish — the arming is late, and the
 *   arming never happened — need opposite repairs, and a silent clear would leave the first looking
 *   like the second.
 */
export async function waitForTheArmingThenDisarm(
  extension: LaunchedExtension,
  timeoutMs: number,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let armed: readonly string[] = [];

  // **The interval is a sampling rate, not a tolerance.** Nothing is allowed to fail because of it;
  // what decides the outcome is `deadline`, which the caller derived. A coarser rate would only make
  // the same answer arrive later.
  for (;;) {
    armed = await readArmedAlarms(extension);
    if (armed.includes(BACKGROUND_ALARM_NAME)) break;
    if (Date.now() >= deadline) {
      throw new Error(
        `no alarm was armed within ${timeoutMs}ms of a popup press, and this device currently owns ` +
          `[${JSON.stringify(armed)}] - so the arming is either still travelling to the worker or ` +
          `never happened, and clearing now would report the second as though it were the first`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  await clearArmedAlarms(extension);
}

/**
 * The raw reported-messages record on this device, or `null`.
 *
 * **Raw, for the reason `readStoredMailboxRecord` is raw**: the claim a case wants to make is about
 * what is on the device, and narrowing it with the product's own reader inside the helper would make
 * a spec pass by reading an unreadable record as an empty one.
 */
export async function readSeenRecord(extension: LaunchedExtension): Promise<unknown | null> {
  return extension.worker.evaluate(
    async ([areaPath, key]) => {
      const area = (areaPath as readonly string[]).reduce<object>(
        (node, step) => Reflect.get(node, step),
        globalThis,
      ) as StorageArea;
      const found = await area.get(key as string);
      return found[key as string] ?? null;
    },
    [[...STORAGE_AREA], EXTENSION_SEEN_MESSAGES_KEY] as const,
  );
}
