/**
 * Raising one notification for one message, and nothing more.
 *
 * ## What a notification is allowed to carry, and why that is structural here
 *
 * `extension-client` requires a notification to name its sender and its subject "and no other value
 * from the message", and states that the exclusion of a one-time code is **structural rather than a
 * filter**. That is true here for a reason no code in this file enforces: the only thing this module
 * receives is a `MessageSummary`, and a summary carries no body at all — `packages/core` states that
 * listing a mailbox must not require fetching bodies. **A code is not filtered out of this text; it
 * was never in the value.** A filter would have to be written, would have to be tested, and would be
 * wrong the day a new field reached the summary.
 *
 * **The check that calls this never opens a message**, which is the same fact seen from the other
 * side: opening one is a second provider request per notification to obtain a body this notification
 * has no use for.
 *
 * ## The icon is passed in, and why this module does not find it
 *
 * `design.md` D12 measured that a notification created with no `iconUrl` **resolves its callback and
 * registers nothing**, and that an SVG is refused outright. The icon is therefore mandatory. This
 * module takes it as a required parameter rather than resolving it, so that **a caller cannot forget
 * it in a way the type does not catch** — and `service-worker.ts` resolves the asset URL through
 * `extensionAssetUrl`, the one place that reads the extension's own URL prefix.
 *
 * ## What the returned boolean claims, precisely
 *
 * **`true` means the platform answered `create` with a non-null id.** It does not mean a person saw
 * anything: this repository cannot observe an operating system's notification centre, and the
 * measurement that makes the icon mandatory found a callback that resolved for a notification the
 * platform did not hold. **The bool is a refusal flag, not a delivery receipt**, and the caller's use
 * of it — refusing to advance the record — is what keeps that distinction load-bearing.
 *
 * @module
 */

import type { MessageSummary } from "@spectre-mail/core";

import type { NotificationPlatform, NotificationRequest } from "./extension-platform";

/**
 * The file this extension ships as its notification icon, named here rather than at the call site.
 *
 * **A raster image, and the format is a measurement** (`docs/PROVIDERS.md` §4.5, 2026-10-11):
 * the same request naming an SVG resolved `null`. A second file name somewhere would be a second
 * answer to "which icon", and the wrong one would be silently refused.
 */
export const NOTIFICATION_ICON_FILE = "icon.png";

/**
 * The notification id for one message.
 *
 * **Derived from the message id and namespaced by the mailbox**, because `chrome.notifications` is a
 * flat namespace per extension: two mailboxes on one device can both hold a message with the same id,
 * and a shared name would let one mailbox's arrival clear another's notification — or be cleared by
 * it. The two separators are there because provider ids are not required to exclude either character.
 */
export function notificationIdFor(message: MessageSummary): string {
  return `spectre:${message.mailboxId}:${message.id}`;
}

/**
 * The two lines a notification shows, taken from the summary and nothing else.
 *
 * ## The sender line prefers a name and falls back to the address, and states which it used
 *
 * `MessageSummary` carries `from` and an optional `fromName`. A display name is what a person
 * recognises and an address is what they can verify, so the name is preferred **and the address is
 * kept in the line when one was given** — a name on its own invites a person to trust an unverifiable
 * string, and an address on its own reads as a machine talking. Where there is no name, the address
 * is the whole truth available.
 *
 * **Both are values the provider reported about the sender, not a value from the message body.**
 * That distinction is the module's reason for existing.
 */
function senderLine(message: MessageSummary): string {
  const name = message.fromName?.trim() ?? "";
  const address = message.from.trim();

  if (name.length === 0) {
    return address;
  }
  if (address.length === 0) {
    return name;
  }
  return `${name} <${address}>`;
}

/**
 * Build the request for one message. Exported so the boundary between *what is said* and *what is
 * asked of the platform* is a thing a test can name.
 */
export function buildNotificationRequest(message: MessageSummary, iconUrl: string): NotificationRequest {
  return {
    title: senderLine(message),
    // **The subject, verbatim, and never a fallback the module invented.** A provider that reports
    // no subject has produced a message whose subject is empty, and this repository says elsewhere
    // that preserving an empty subject is honest where inventing one is not. The alternative —
    // "New message" — would put a sentence this product did not write into a place a lock screen
    // shows, which is the same class of leak the code exclusion exists to prevent.
    message: message.subject,
    iconUrl,
  };
}

/**
 * Raise one notification and report whether the platform accepted the request.
 *
 * @param message - The message to announce. **A summary, never an opened message** — see the module
 *   note for why that makes the code exclusion structural.
 * @param platform - The notification platform, or `undefined` where this context has none.
 * @param iconUrl - The absolute URL of the shipped raster icon. Required, and never optional.
 * @returns `true` when the platform answered with a non-null id; `false` for every refusal —
 *   including an absent platform and a call that threw. **`false` is the value that keeps the
 *   seen-record from advancing, so a throw is caught here rather than allowed to escape and take the
 *   whole wake with it.**
 */
export async function raiseNotification(
  message: MessageSummary,
  platform: NotificationPlatform | undefined,
  iconUrl: string,
): Promise<boolean> {
  if (platform === undefined) {
    // **An absent platform is a refusal, not a crash.** A browser without the notification API is a
    // device that cannot be told, and a wake that threw on every fifth second would spend its time
    // in an error rather than in a check.
    return false;
  }

  try {
    const answered = await platform.create(
      notificationIdFor(message),
      buildNotificationRequest(message, iconUrl),
    );
    return answered !== null && typeof answered === "string";
  } catch {
    /**
     * **A throw is a refusal here, and that is the honest reading.**
     *
     * The measured platform has no error event, so a throwing `create` and a `null` answer are the
     * only two refusals a caller can observe, and treating one differently from the other would give
     * the record two rules where the platform offers one.
     */
    return false;
  }
}