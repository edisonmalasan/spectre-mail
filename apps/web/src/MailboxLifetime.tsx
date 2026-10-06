/**
 * The mailbox lifetime, as far as anyone actually knows it.
 *
 * ## Why this component mostly says "unknown"
 *
 * Mail.tm publishes a 7-day message retention and states a mailbox lasts until
 * deleted. **Neither value appears in any API response, and neither was verified
 * against the live API.** Guerrilla publishes nothing equivalent. So there is no
 * measured source for a countdown, and a number derived from either figure would
 * be one this product invented — wrong in the one direction that costs a user a
 * verification code they were waiting for.
 *
 * When a provider *does* report an expiry, this renders it and attributes it. That
 * attribution is the whole point: a provider's statement about its own mailbox is
 * evidence, and SpectreMail's own guarantee would not be.
 *
 * This is also why no countdown ticks here. A countdown computed at render time
 * from a creation timestamp would be elapsed-time inference wearing a clock's
 * clothes.
 *
 * @module
 */

import type { Mailbox } from "@spectre-mail/core";

export interface MailboxLifetimeProps {
  readonly mailbox: Mailbox;
}

export function MailboxLifetime({ mailbox }: MailboxLifetimeProps) {
  // `expiresAt` is absent unless a provider reported one. With
  // `exactOptionalPropertyTypes` on, "absent" cannot be written as `undefined`, so
  // this branch is reached only by a mailbox that genuinely carries no expiry.
  if (mailbox.expiresAt === undefined) {
    return (
      <section className="region" aria-labelledby="lifetime-heading">
        <h2 id="lifetime-heading">How long this address lasts</h2>
        <p data-testid="lifetime-unknown">
          Unknown. The provider publishes no expiry for this mailbox, so SpectreMail will not
          estimate one. Save any message you need.
        </p>
      </section>
    );
  }

  return (
    <section className="region" aria-labelledby="lifetime-heading">
      <h2 id="lifetime-heading">How long this address lasts</h2>
      {/*
        The provider's own statement, attributed. Not a countdown, and not phrased as
        a guarantee SpectreMail could keep.
      */}
      <p data-testid="lifetime-reported">
        The provider reports this mailbox expires at{" "}
        <time dateTime={new Date(mailbox.expiresAt).toISOString()}>
          {new Date(mailbox.expiresAt).toISOString()}
        </time>
        . That is the provider&apos;s statement, not a SpectreMail guarantee.
      </p>
    </section>
  );
}
