/**
 * What a notification is allowed to say, and what a refusal looks like.
 *
 * ## The strongest form of "no one-time code" is a type, not an assertion
 *
 * `extension-client` requires a notification to name **the sender and the subject, and no other
 * value from the message**. This file cannot prove the exclusion of a code, because the value it
 * receives is a `MessageSummary`, and `MessageSummary` carries no body: **a code is not filtered out
 * of these two lines, it was never in the value.** The case for it therefore lives where the
 * mechanism is — `background-check.test.ts`, which holds a session whose only members are `restore`
 * and `destroy`, so "the wake never opens a message" is a property of what it *can* do.
 *
 * **What this file does prove is the weaker claim that is still worth proving**: the request built
 * here carries exactly three keys, and two of them are the sender line and the subject.
 *
 * ## `true` is a refusal flag and not a delivery receipt
 *
 * Measured on 2026-10-11 (`docs/PROVIDERS.md` §4.5): `chrome.notifications.onError` **does not
 * exist** on the Chromium measured, so a callback resolving is the *only* signal available — and it
 * resolved for a request that registered nothing, which is why the icon is mandatory. So `true` means
 * "the platform answered with an id" and nothing about a person seeing anything. **Every case below
 * is therefore written so that `true` and `false` are both reachable and distinguishable**, which is
 * the only thing that keeps the difference load-bearing for the record that depends on it.
 *
 * @vitest-environment node
 */

import { describe, expect, it, vi } from "vitest";

import type { MessageSummary } from "@spectre-mail/core";

import type { NotificationPlatform } from "./extension-platform";
import {
  NOTIFICATION_ICON_FILE,
  buildNotificationRequest,
  notificationIdFor,
  raiseNotification,
} from "./notification";

/** A summary, built so every field a notification could name is distinguishable from the others. */
function summary(overrides: Partial<MessageSummary> = {}): MessageSummary {
  return {
    id: "message-1",
    mailboxId: "mailbox-1",
    from: "sender@address.test",
    fromName: "Sender Service",
    subject: "Your code is 482913",
    receivedAt: 1_700_000_000_000,
    ...overrides,
  };
}

/**
 * A platform whose answer is chosen by the test.
 *
 * **`answered` is a parameter rather than a flag on a fake with three modes**, because a fake whose
 * behaviour is switched by a boolean gives a reader no way to tell a refusal from a throw from an
 * absent platform — and this file's whole subject is that they are the same answer.
 */
function platformThat(answered: string | null | (() => never)): NotificationPlatform {
  return {
    create: vi.fn(async (_id: string, _options: unknown) => {
      // **Two branches and one return type**, because `never` is only reachable through the call
      // above - the throw is the point of the arm, and returning it would widen the seam's own
      // signature to something no platform can answer.
      if (typeof answered === "function") {
        return answered();
      }
      return answered;
    }),
    clear: vi.fn(async () => true),
  };
}

const ICON_URL = "chrome-extension://spectre/icon.png";

describe("what a notification says", () => {
  it("names the sender and the subject, and carries exactly those two lines", () => {
    const request = buildNotificationRequest(summary(), ICON_URL);

    expect(request.title).toBe("Sender Service <sender@address.test>");
    expect(request.message).toBe("Your code is 482913");

    // **The exact-key assertion, and it is the one that matters here.** A new field added to the
    // request would widen what reaches a lock screen, and a notification is read outside every
    // privacy control this product enforces — so this is the check that would catch it, rather than
    // a check that only reads the two lines it happens to know about.
    expect(Object.keys(request).sort()).toEqual(["iconUrl", "message", "title"]);
  });

  it("names the address alone when the provider reported no display name", () => {
    // **`exactOptionalPropertyTypes` is on, so the key is removed rather than set to undefined.**
    // A summary carrying `fromName: undefined` is a different value from one carrying no display
    // name, and only the second is what a provider reports.
    const { fromName: _reported, ...withoutName } = summary();

    const request = buildNotificationRequest(withoutName, ICON_URL);

    expect(request.title).toBe("sender@address.test");
  });

  it("substitutes nothing for a subject the provider left empty", () => {
    // **An invented sentence here would appear on a lock screen**, which is the same class of leak
    // the code exclusion exists to prevent: this product would be putting a phrase of its own into
    // a place a person reads without choosing to.
    const request = buildNotificationRequest(summary({ subject: "" }), ICON_URL);

    expect(request.message).toBe("");
  });

  it("carries the shipped raster icon, and names it in one place", () => {
    // **The format is a measurement and not a preference** (`docs/PROVIDERS.md` §4.5): a request
    // naming no icon resolves its callback and registers nothing, and one naming an SVG is refused
    // with `null`. So the file name is asserted literally rather than read from a constant, because a
    // constant would make this case pass for a value nothing had checked.
    expect(NOTIFICATION_ICON_FILE).toBe("icon.png");
    expect(buildNotificationRequest(summary(), ICON_URL).iconUrl).toBe(ICON_URL);
  });

  it("names an id after the mailbox and the message, because the namespace is flat", () => {
    // **Two mailboxes on one device can hold the same message id**, and a shared name would let one
    // mailbox's arrival replace another's notification. The assertion is on the whole id rather than
    // on "contains the message id", which a `spectre:${id}` spelling would also satisfy.
    expect(notificationIdFor(summary())).toBe("spectre:mailbox-1:message-1");
    expect(notificationIdFor(summary({ mailboxId: "mailbox-2" }))).not.toBe(
      notificationIdFor(summary()),
    );
  });
});

describe("whether the platform answered", () => {
  it("reports an id as an answer", async () => {
    const platform = platformThat("spectre:mailbox-1:message-1");

    await expect(raiseNotification(summary(), platform, ICON_URL)).resolves.toBe(true);
    expect(platform.create).toHaveBeenCalledWith("spectre:mailbox-1:message-1", {
      title: "Sender Service <sender@address.test>",
      message: "Your code is 482913",
      iconUrl: ICON_URL,
    });
  });

  it("reports a null answer as a refusal, which is the measured signal and the only one", async () => {
    await expect(raiseNotification(summary(), platformThat(null), ICON_URL)).resolves.toBe(false);
  });

  it("reports a throw as the same refusal, because the platform offers no other signal", async () => {
    // **`chrome.notifications.onError` does not exist on the Chromium measured**, so a throwing
    // `create` and a `null` answer are the only two refusals a caller can observe. Treating one
    // differently would give the record two rules where the platform offers one.
    const throwing = platformThat(() => {
      throw new Error("the platform refused");
    });

    await expect(raiseNotification(summary(), throwing, ICON_URL)).resolves.toBe(false);
  });

  it("reports an absent platform as a refusal rather than failing the wake", async () => {
    // **A browser without the notification API is a device that cannot be told**, and a wake that
    // threw every five seconds would spend its whole life in an error instead of in a check.
    await expect(raiseNotification(summary(), undefined, ICON_URL)).resolves.toBe(false);
  });

  it("distinguishes an answer from a refusal, so the record that depends on it is not vacuous", async () => {
    // **The negative control for the whole file.** Every case above reads one arm; a function that
    // returned `false` unconditionally would satisfy the four of them that expect a refusal, and
    // only this one would notice. It is here so the reader is proven able to fail rather than merely
    // present, which is the same discipline `service-worker.test.ts` states for its source rules.
    await expect(raiseNotification(summary(), platformThat("an-id"), ICON_URL)).resolves.toBe(true);
    await expect(raiseNotification(summary(), platformThat(null), ICON_URL)).resolves.toBe(false);
  });
});
