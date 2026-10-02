/**
 * Guarded optional-operation tests.
 *
 * These exist because the verification pass found a requirement scenario with no
 * implementation behind it. The requirement said an unsupported operation SHALL be
 * reported as `UNSUPPORTED_OPERATION` naming the operation; what actually happened
 * was `TypeError: provider.destroyMailbox is not a function`, which no layer that
 * knows only the closed error vocabulary can catch, present, or recover from.
 *
 * @module
 */

import { NormalizedErrorCode, isSpectreError } from "@spectre-mail/core";
import type { Mailbox, ProviderId, SpectreError } from "@spectre-mail/core";
import { describe, expect, it } from "vitest";

import type { MailProvider, ProviderOperation } from "./contract";
import { providerOnlyEnvironment, stubEnvironment } from "./environments";
import * as fixtures from "./fixtures";
import { createGuerrillaAdapter } from "./guerrilla";
import { createMailTmAdapter } from "./mailtm";
import { deleteMessage, destroyMailbox } from "./operations";

const MAILBOX: Mailbox = {
  id: "https://api.mail.tm/accounts/x",
  provider: "mailtm",
  address: "someone@uberip.com",
  createdAt: 0,
  credentials: { provider: "mailtm", accountId: "/accounts/x", accessToken: "t" },
  status: "active",
};

describe("guarded optional operations", () => {
  it("reports mailbox deletion as an unsupported operation, naming it", async () => {
    const guerrilla = createGuerrillaAdapter(providerOnlyEnvironment([]));

    // The behaviour being repaired. Before this guard existed, this line threw
    // `TypeError: provider.destroyMailbox is not a function`.
    const error = await capture(() => destroyMailbox(guerrilla, MAILBOX));

    expect(error?.code).toBe(NormalizedErrorCode.UNSUPPORTED_OPERATION);
    expect(
      error?.code === NormalizedErrorCode.UNSUPPORTED_OPERATION ? error.operation : undefined,
    ).toBe("destroyMailbox");
    expect(error?.provider).toBe("guerrilla");
    // Names the provider in prose too, so a message shown to a user is useful
    // without the caller having to assemble it.
    expect(error?.description).toContain("Guerrilla Mail");
  });

  it("reports message deletion as an unsupported operation, naming it", async () => {
    const guerrilla = createGuerrillaAdapter(providerOnlyEnvironment([]));

    const error = await capture(() => deleteMessage(guerrilla, MAILBOX, "any-id"));

    expect(error?.code).toBe(NormalizedErrorCode.UNSUPPORTED_OPERATION);
    expect(
      error?.code === NormalizedErrorCode.UNSUPPORTED_OPERATION ? error.operation : undefined,
    ).toBe("deleteMessage");
  });

  it("records the absence as unobserved rather than as a provider limitation", async () => {
    const guerrilla = createGuerrillaAdapter(providerOnlyEnvironment([]));

    const error = await capture(() => destroyMailbox(guerrilla, MAILBOX));

    // "Not observed" is not "does not exist". Asserting the stronger claim in the
    // error text would bake an unmeasured provider fact into the product, and the
    // next probe observing deletion working would then contradict its own message.
    expect(error?.description).toContain("never observed to work");
    expect(error?.description).toContain("not because the provider was proven unable");
  });

  it("invokes the operation when the adapter does support it", async () => {
    const environment = stubEnvironment([fixtures.mailtmDeleted]);

    await destroyMailbox(createMailTmAdapter(environment), MAILBOX);

    // The guard must not become a blanket refusal. Observed working means
    // observed, so it is performed.
    expect(environment.requests).toEqual([
      expect.objectContaining({ method: "DELETE", url: MAILBOX.id }),
    ]);
  });

  it("consults supports() rather than testing for the property's presence", async () => {
    const calls: ProviderOperation[] = [];
    const answering: MailProvider = {
      id: "mailtm" satisfies ProviderId,
      displayName: "Answering",
      // A provider that claims support while omitting the method. The guard trusts
      // `supports`, so the conformance suite - not this guard - is what catches a
      // provider that lies about itself. Recorded here so the choice is visible.
      supports: (operation) => {
        calls.push(operation);
        return false;
      },
      checkHealth: async () => ({ provider: "mailtm", status: "ok" }),
      createMailbox: async () => MAILBOX,
      listMessages: async () => [],
      getMessage: async () => {
        throw new Error("unused");
      },
    };

    const error = await capture(() => destroyMailbox(answering, MAILBOX));

    expect(calls).toEqual(["destroyMailbox"]);
    expect(error?.code).toBe(NormalizedErrorCode.UNSUPPORTED_OPERATION);
  });

  it("throws a value the closed vocabulary recognises, not a bare TypeError", async () => {
    const guerrilla = createGuerrillaAdapter(providerOnlyEnvironment([]));

    // The specific regression. `isSpectreError` is the guard every consumer relies
    // on, so a thrown value failing it means the error would be lost, not merely
    // awkward.
    await expect(destroyMailbox(guerrilla, MAILBOX)).rejects.toSatisfy((thrown: unknown) =>
      isSpectreError(thrown),
    );
  });
});

async function capture(operation: () => Promise<unknown>): Promise<SpectreError | undefined> {
  try {
    await operation();
    return undefined;
  } catch (cause) {
    if (isSpectreError(cause)) {
      return cause;
    }
    throw cause;
  }
}
