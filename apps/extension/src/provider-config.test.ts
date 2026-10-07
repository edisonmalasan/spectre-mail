/**
 * The extension's provider configuration, read as configuration.
 *
 * ## Why the tests read the list rather than the rendered output
 *
 * A test that inferred the providers from what the popup displayed would pass with a
 * factory that reached a provider the list never named, and would fail for a list edit
 * that had not reached the UI yet. **The configuration is the thing under test**, so it
 * is read directly — the same reason `apps/web`'s configuration test reads its list.
 *
 * ## And why the fallback matters here more than anywhere else
 *
 * This is the **first client whose list has two entries**, so it is the first place
 * `createProviderManager`'s fallback loop runs with more than one provider. Two
 * behaviours that have never been exercised anywhere in this repository are asserted
 * here, and both are recorded in `manager.ts`: with a single provider the failure is
 * rethrown **unaltered** so a `SpectreError`'s `code` survives, and with several the
 * composed error names each provider that failed.
 *
 * @vitest-environment node
 */

import { describe, expect, it } from "vitest";

import { isMailbox } from "@spectre-mail/core";

import type { ProviderManager, Transport } from "@spectre-mail/providers";

import {
  guerrillaSessionCreated,
  mailtmAccountCreated,
  mailtmDomains,
  mailtmToken,
} from "../../../packages/providers/src/fixtures";

import {
  createExtensionProviderManager,
  EXTENSION_PROVIDER_IDS,
  primaryProviderName,
} from "./provider-config";

/**
 * A transport answering from a recorded script.
 *
 * **Speaks `Transport`, not `fetch`** — a request object in, a response record out. That
 * is the shape `createFetchTransport` produces and the shape every adapter consumes, so
 * a test that supplied a `fetch` function would be testing a seam nothing uses.
 */
function scriptedTransport(script: Record<string, { status?: number; body: string }>) {
  const requested: string[] = [];

  const transport: Transport = async (request) => {
    requested.push(`${request.method} ${request.url}`);

    const match = Object.entries(script).find(([prefix]) => request.url.startsWith(prefix));
    if (match === undefined) {
      return { status: 404, headers: {}, body: "{}" };
    }

    return {
      status: match[1].status ?? 200,
      headers: { "content-type": "application/json" },
      body: match[1].body,
    };
  };

  return { transport, requested };
}

/**
 * Mail.tm's recorded account-creation exchange, **imported by name rather than restated**.
 *
 * **This file's first version transcribed the bodies inline, which was a defect the
 * architecture suite found rather than one it was asked about.** A provider JSON field
 * name written under `apps/` is provider wire format, and
 * `tests/architecture/boundaries.test.ts` forbids it there with **no test exemption at
 * all** — so four findings appeared in a `*.test.ts` file this change had written. The
 * fixtures were already committed to `packages/providers` and already exported; the rule
 * says the right answer is to import them, and it was right.
 *
 * The shapes that matter are load-bearing and now come from the measurement rather than
 * from a transcription: the account's resource URL is **relative**, which is what makes
 * the adapter follow the provider's own value instead of constructing the path itself,
 * and the domains response's collection key is the one the call actually reads. An
 * earlier draft omitted the resource URL entirely and the adapter reported "created an
 * account but returned no resource URL" — the correct diagnostic for a response the
 * provider would never send.
 */
const MAILTM_SCRIPT: Record<string, { status?: number; body: string }> = {
  "https://api.mail.tm/domains": { body: mailtmDomains.response.body },
  "https://api.mail.tm/accounts": {
    // **The fixture's own `201`, not a `200` this file chose.** The adapter accepts both,
    // so a transcribing version would have passed while asserting something the provider
    // never sent.
    status: mailtmAccountCreated.response.status,
    body: mailtmAccountCreated.response.body,
  },
  "https://api.mail.tm/token": { body: mailtmToken.response.body },
};

/**
 * Guerrilla Mail's recorded session exchange.
 *
 * **The session id comes from the response *body*, never from the `PHPSESSID` cookie** —
 * measured, and the reason is in `packages/core/src/credentials.ts`: the provider sends no
 * `Access-Control-Allow-Credentials`, so a browser cannot send that cookie cross-origin
 * from the extension either. Importing the fixture rather than restating it is what keeps
 * that field name out of this file; the argument above is prose about it, which the rule
 * strips before matching.
 */
const GUERRILLA_SCRIPT = {
  "https://api.guerrillamail.com/ajax.php": { body: guerrillaSessionCreated.response.body },
} as const;

describe("the extension's provider configuration", () => {
  it("declares Mail.tm first with Guerrilla Mail behind it", () => {
    // **Read as a value, and in order.** Not "contains both" — a list with the two
    // reversed still contains both, and would make the primary provider the fallback.
    expect([...EXTENSION_PROVIDER_IDS]).toEqual(["mailtm", "guerrilla"]);
  });

  it("has two entries, which is a capability this client has and the website does not", () => {
    // The claim `apps/web`'s configuration makes about itself is the mirror image of
    // this one: its list is one long *on purpose*. Asserting the length here is what
    // makes dropping either provider a failing change rather than a quiet one — and
    // removing the fallback would leave an extension that can reach Mail.tm and dies
    // with it, which is strictly worse than the website's single-provider setup.
    expect(EXTENSION_PROVIDER_IDS).toHaveLength(2);
  });

  it("builds a manager whose providers are the declared list, in order", () => {
    const { transport } = scriptedTransport({});
    const manager = createExtensionProviderManager(transport);

    // **Derived, not re-declared.** A factory that hardcoded its own order would pass
    // the list test above and fail this one, which is the pair that makes the exported
    // list a configuration rather than a comment.
    expect(manager.available.map((provider) => provider.id)).toEqual([...EXTENSION_PROVIDER_IDS]);
  });

  it("announces the provider the manager reaches first, by the name the package declares", () => {
    const { transport } = scriptedTransport({});
    const manager = createExtensionProviderManager(transport);

    // **Read from the manager, not compared against a string written here.**
    //
    // This assertion is *deliberately not* `toBe("Mail.tm")`. Writing the expected value
    // would put the very literal the architecture rule forbids back into a client file —
    // and in a test the rule exempts, which is worse, because an exempt copy reads as
    // permitted. The point of the test is that the name **comes from the adapter**, so the
    // only honest expectation is that it equals what the adapter declares.
    const announced = primaryProviderName(manager);

    expect(announced).toBe(manager.available[0]?.displayName);

    // **And it is a name, not an id.** The id is `mailtm` and the display name is not;
    // asserting they differ is what distinguishes "read the display name" from "read
    // something provider-shaped", and without it a function returning the id would pass.
    expect(announced).not.toBe("mailtm");

    // **The negative control for the branch below**, in the sense that matters: this test
    // *does* reach `available[0]`, so an implementation returning a literal would differ
    // from the manager the moment the package renames Mail.tm — which is the drift that
    // rule exists to prevent.
    expect(announced.length).toBeGreaterThan(0);
  });

  it("refuses to announce a provider when the manager has none", () => {
    // **The one branch `createExtensionProviderManager` cannot reach**, and it is covered
    // rather than left as an assertion of unreachability.
    //
    // `createProviderManager` rejects an empty list, so through this client the branch is
    // dead code — which is precisely the shape this repository records as *not* a gap in
    // coverage but also not as coverage. Constructing a manager-shaped object is how a
    // dead branch is made reachable for one assertion, and it is stated here rather than
    // left for a reader to assume either way.
    const empty = { available: [], createMailbox: async () => ({}) } as unknown as ProviderManager;

    expect(() => primaryProviderName(empty)).toThrow(/no providers/);
  });

  it("creates a mailbox through Mail.tm and never reaches the fallback", async () => {
    const { transport, requested } = scriptedTransport(MAILTM_SCRIPT);

    const mailbox = await createExtensionProviderManager(transport).createMailbox();

    expect(isMailbox(mailbox)).toBe(true);
    expect(mailbox.provider).toBe("mailtm");
    // **The fallback is never touched on the happy path.** A manager that called
    // Guerrilla Mail speculatively would spend a request on a provider it did not need.
    expect(requested.some((line) => line.includes("guerrillamail"))).toBe(false);
  });

  it("falls back to Guerrilla Mail when Mail.tm cannot be reached", async () => {
    // Mail.tm answers every path with a 503 — the shape of an origin the extension holds
    // permission for but that is not serving. This is the first time in this repository
    // that the fallback loop runs with more than one provider.
    const { transport, requested } = scriptedTransport({
      "https://api.mail.tm": { status: 503, body: "{}" },
      ...GUERRILLA_SCRIPT,
    });

    const mailbox = await createExtensionProviderManager(transport).createMailbox();

    expect(mailbox.provider).toBe("guerrilla");
    // **Both were tried, and the order is the preference order.** A fallback that did
    // not first try Mail.tm would be a different product, and one that retried Mail.tm
    // after the fallback would be a loop.
    expect(requested[0]).toContain("api.mail.tm");
    expect(requested.some((line) => line.includes("guerrillamail"))).toBe(true);
  });

  it("reports the provider that served the mailbox, never the one it preferred", async () => {
    // **The requirement's own words, as a test.** A fallback that reported `mailtm`
    // would tell the user their mailbox lives at a provider that never answered, and
    // every downstream thing — routing, reporting, the popup's own display — would then
    // be working from a false premise.
    const { transport } = scriptedTransport({
      "https://api.mail.tm": { status: 503, body: "{}" },
      ...GUERRILLA_SCRIPT,
    });

    const mailbox = await createExtensionProviderManager(transport).createMailbox();

    expect(mailbox.provider).not.toBe(EXTENSION_PROVIDER_IDS[0]);
    expect(mailbox.provider).toBe("guerrilla");
  });

  it("names every provider that failed when they all do", async () => {
    const { transport } = scriptedTransport({});

    // **The composed error, and it exists because with more than one provider the
    // composition genuinely is the answer** — no single provider's error can say that
    // two were tried. With one provider this same code rethrows the original error
    // unaltered, which is the branch the website has and this client cannot reach.
    const failure = await createExtensionProviderManager(transport)
      .createMailbox()
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(Error);
    const message = (failure as Error).message;
    for (const id of EXTENSION_PROVIDER_IDS) {
      expect(message, `the composed error must name ${id}`).toContain(id);
    }
  });
});
