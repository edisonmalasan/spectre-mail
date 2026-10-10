/**
 * The one alarm, and the period it is given.
 *
 * ## Exactly one, and that is a measurement rather than a preference
 *
 * Armed together on the Chromium this repository uses, a 5 000 ms and a 30 000 ms alarm produced
 * **24 and 0 firings in 120 seconds** - the slower one was never scheduled, not scheduled late
 * (`docs/PROVIDERS.md` §4.1.1, `alarms-packing-interval`). A second alarm in this extension is
 * therefore not a second feature; it is the only way this extension could stop notifying at all.
 *
 * ## The period is imported, never restated
 *
 * {@link INBOX_POLL_PROMPT_MS} is read from `packages/mailbox` at the point of use, so there is no
 * second place for the number to live and no figure in this file that could drift from the cadence
 * the rest of the product already uses. The conversion to minutes happens **here and only here**,
 * because `chrome.alarms` speaks minutes and a rounded conversion would quadruple the request rate.
 *
 * ## What this module does not do
 *
 * It does not decide *whether* to run a wake - that is `background-check.ts`, and the difference
 * between the two is what keeps this file testable without a platform. It does not read the
 * mailbox, and it holds nothing between firings. **It also does not arm on a timer of its own:** an
 * alarm is armed when this device holds a mailbox and reconciled when the browser starts, because
 * nothing here may assume a schedule outlived a reboot (`docs/PROVIDERS.md` §4.1.1 holds a 120 000 ms
 * idle *bound*, not a lifetime).
 *
 * @module
 */

import { INBOX_POLL_PROMPT_MS } from "@spectre-mail/mailbox";

import type { AlarmPlatform } from "./extension-platform";

/**
 * The one alarm this extension owns.
 *
 * **Namespaced, and the name is the whole of the uniqueness claim.** `chrome.alarms` is a flat
 * namespace per extension, and a generic name like `"poll"` would be one a future change could
 * collide with without anything saying so.
 */
export const BACKGROUND_ALARM_NAME = "spectre-background-check";

/**
 * The period, in the unit `chrome.alarms` wants.
 *
 * **Exported so a test can assert the number the platform is asked for without reading the
 * expression**, and divided by `60_000` here so the conversion lives beside the constant it
 * converts. `docs/PROVIDERS.md` §4.1.1 measured `5000 / 60000` firing at 5 000 ms mean spacing.
 */
export const BACKGROUND_ALARM_PERIOD_MINUTES = INBOX_POLL_PROMPT_MS / 60_000;

/** What this module needs from its caller, and nothing else. */
export interface BackgroundAlarmDependencies {
  /**
   * The alarm platform, or `undefined` where this context has none.
   *
   * **`undefined` is a normal answer rather than a fault**, for the same reason `createExtensionStorage`
   * treats a missing area as an answer: a browser without alarms is a device that cannot be told
   * about new mail, and the extension must keep working rather than throw on every wake.
   */
  readonly platform: AlarmPlatform | undefined;
  /** Whether this device holds a mailbox to watch. **Never** the mailbox itself - see the module note. */
  readonly holdsMailbox: () => Promise<boolean>;
}

/** Arm the background alarm. Resolves once the platform has taken the request. */
export async function armBackgroundAlarm(
  platform: AlarmPlatform | undefined,
): Promise<void> {
  await platform?.create(BACKGROUND_ALARM_NAME, {
    periodInMinutes: BACKGROUND_ALARM_PERIOD_MINUTES,
  });
}

/**
 * Clear the background alarm, and report whether the platform had one.
 *
 * **Called only for a mailbox the provider reported gone** - `extension-client` forbids clearing it
 * for a check that merely failed, because a provider that could not be reached will be reachable
 * again and this device is the thing that decides whether it hears about what arrives meanwhile.
 */
export async function clearBackgroundAlarm(
  platform: AlarmPlatform | undefined,
): Promise<boolean> {
  return (await platform?.clear(BACKGROUND_ALARM_NAME)) ?? false;
}

/**
 * Reconcile the alarm on browser start, and on every moment this extension first holds a mailbox.
 *
 * ## Asking again is the reconciliation
 *
 * **No "is there already one" read happens, because `create` replaces.** Whether or not the previous
 * alarm survived a restart, asking for it again produces exactly one alarm under exactly one name -
 * so the property is established by what this extension creates rather than by what it inspects,
 * which is the property the requirement names.
 *
 * ## Held none, held one, and no arm either way
 *
 * A device holding no mailbox gets **no alarm at all**, rather than one that fires every five
 * seconds to discover there is nothing to list. That is a provider budget decision: twelve requests a
 * minute is inside the only measured limit and is not free.
 *
 * @param dependencies - The platform and the question of whether there is anything to watch.
 * @returns Whether an alarm was armed.
 */
export async function reconcileBackgroundAlarm(
  dependencies: BackgroundAlarmDependencies,
): Promise<boolean> {
  if (dependencies.platform === undefined) {
    return false;
  }

  let holding: boolean;
  try {
    holding = await dependencies.holdsMailbox();
  } catch {
    // **A storage read that failed answers "not armed"**, and that is deliberately the conservative
    // direction: the next `onStartup` or the next write of a mailbox tries again, whereas arming
    // against a read that failed would spend provider budget on a device whose storage is broken.
    return false;
  }

  if (!holding) {
    return false;
  }

  await armBackgroundAlarm(dependencies.platform);
  return true;
}