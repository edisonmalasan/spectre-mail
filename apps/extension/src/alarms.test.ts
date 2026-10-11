/**
 * The one alarm, and the period it is given.
 *
 * ## Why most of this is a behavioural test and one case is a source rule
 *
 * The arming arms nothing and returns nothing, so `armBackgroundAlarm` is only observable through
 * the platform it was handed — which is exactly what these cases inspect. **The one claim that is
 * not observable any other way is "the period came from the shared cadence"**: a test can assert the
 * number the platform was asked for, and that number is equally correct whether it was computed as
 * `INBOX_POLL_PROMPT_MS / 60_000` or typed in beside it. So the requirement's real content — *taken
 * from `packages/mailbox` rather than restated* — is a **source rule**, and it carries a negative
 * control because a rule matching nothing would satisfy it.
 *
 * ## The numeric assertion is against the imported constant, not against a literal
 *
 * `expect(...).toBe(5000 / 60_000)` would pass for a hardcoded `5000 / 60_000`, and would then be a
 * test that measures the constant it also restates. Asserting against `INBOX_POLL_PROMPT_MS`
 * imported from the same module the source imports it from makes the case a statement about the
 * wiring rather than about a number.
 *
 * @vitest-environment node
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { INBOX_POLL_PROMPT_MS } from "@spectre-mail/mailbox";
import { describe, expect, it, vi } from "vitest";

import {
  BACKGROUND_ALARM_NAME,
  BACKGROUND_ALARM_PERIOD_MINUTES,
  armBackgroundAlarm,
  clearBackgroundAlarm,
  reconcileBackgroundAlarm,
} from "./alarms";
import type { AlarmPlatform } from "./extension-platform";

const ALARMS_PATH = fileURLToPath(new URL("./alarms.ts", import.meta.url));
const alarmsSource = readFileSync(ALARMS_PATH, "utf8");

/** Code with comments removed, so this file's own prose cannot satisfy or fail a rule. */
function code(contents: string): string {
  return contents.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^[ \t]*\/\/.*$/gm, " ");
}

/** A platform that records what it was asked, and answers as chosen. */
function platform(overrides: Partial<AlarmPlatform> = {}): AlarmPlatform {
  return {
    create: vi.fn(async () => {}),
    clear: vi.fn(async () => true),
    ...overrides,
  };
}

describe("the background alarm", () => {
  it("is one alarm, under one name, with a period taken from the shared cadence", async () => {
    const alarms = platform();

    await armBackgroundAlarm(alarms);

    expect(alarms.create).toHaveBeenCalledTimes(1);
    expect(alarms.create).toHaveBeenCalledWith(BACKGROUND_ALARM_NAME, {
      // **Against the imported constant.** A literal here would be the restatement the requirement
      // forbids, written into the file that is supposed to be checking for it.
      periodInMinutes: INBOX_POLL_PROMPT_MS / 60_000,
    });
    expect(BACKGROUND_ALARM_PERIOD_MINUTES).toBe(INBOX_POLL_PROMPT_MS / 60_000);
  });

  it("names the alarm once and restates no number beside it", () => {
    const withoutComments = code(alarmsSource);

    // **One `periodInMinutes` in the product, and it is spelled in terms of the constant.** A second
    // one would be a second place the period is decided, which is the whole thing this rule is for —
    // and it would not have to be a wrong number to be the defect.
    expect(withoutComments.match(/periodInMinutes/g) ?? []).toHaveLength(1);
    expect(withoutComments).toContain("INBOX_POLL_PROMPT_MS");

    // **The restatement a rule exists to catch, planted into a copy of the real source.** Without
    // this, a reader that matched nothing would satisfy the two assertions above for ever — which is
    // the recorded shape of a check narrower than its rule, and the thirty-first instance of it in
    // this repository was found by exactly this omission.
    const restated = `${alarmsSource}\nconst restatedPeriod = 5000 / 60_000;\n`;
    expect(code(restated)).toContain("5000 / 60_000");
    expect(code(alarmsSource)).not.toContain("5000 / 60_000");
  });

  it("arms nothing where this context has no alarm platform", async () => {
    // **A browser without `alarms` is a device that cannot be told**, and the extension must keep
    // working rather than fail a wake. `undefined` is answered, not thrown.
    await expect(armBackgroundAlarm(undefined)).resolves.toBeUndefined();
    await expect(
      reconcileBackgroundAlarm({ platform: undefined, holdsMailbox: async () => true }),
    ).resolves.toBe(false);
    await expect(clearBackgroundAlarm(undefined)).resolves.toBe(false);
  });
});

describe("reconciling the alarm", () => {
  it("arms on a device holding a mailbox, and it is asked again rather than read", async () => {
    // **"Is there already one" is never asked**, because `create` replaces. The property the
    // requirement names is about what this extension creates, so the test reads exactly that: one
    // create, under the one name.
    const alarms = platform();

    await expect(
      reconcileBackgroundAlarm({ platform: alarms, holdsMailbox: async () => true }),
    ).resolves.toBe(true);
    expect(alarms.create).toHaveBeenCalledTimes(1);
    expect(alarms.create).toHaveBeenCalledWith(BACKGROUND_ALARM_NAME, {
      periodInMinutes: BACKGROUND_ALARM_PERIOD_MINUTES,
    });
  });

  it("arms nothing on a device holding no mailbox, because a wake would spend requests to find that out", async () => {
    const alarms = platform();

    await expect(
      reconcileBackgroundAlarm({ platform: alarms, holdsMailbox: async () => false }),
    ).resolves.toBe(false);
    expect(alarms.create).not.toHaveBeenCalled();
  });

  it("arms nothing when the read that answers the question fails, which is the conservative direction", async () => {
    // **Arming against a failed read would spend provider budget on a device whose storage is
    // broken**; withholding means the next browser start, or the next write of a mailbox, tries
    // again.
    const alarms = platform();

    await expect(
      reconcileBackgroundAlarm({
        platform: alarms,
        holdsMailbox: async () => {
          throw new Error("the read failed");
        },
      }),
    ).resolves.toBe(false);
    expect(alarms.create).not.toHaveBeenCalled();
  });

  it("clears under the one name, and reports the platform's own answer", async () => {
    // **Clearing is the one irreversible thing this product schedules**, so it is asserted against
    // the name rather than against "a clear happened": a clear under any other name would leave the
    // schedule running and satisfy a weaker assertion.
    const alarms = platform({ clear: vi.fn(async () => false) });

    await expect(clearBackgroundAlarm(alarms)).resolves.toBe(false);
    expect(alarms.clear).toHaveBeenCalledTimes(1);
    expect(alarms.clear).toHaveBeenCalledWith(BACKGROUND_ALARM_NAME);
  });
});
