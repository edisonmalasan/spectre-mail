/**
 * What the website renders, in each state.
 *
 * These assertions are about what a user can perceive, which is why they run
 * against a real render in jsdom rather than against a description of one. A test
 * that checked a component's return value would pass unchanged if the component
 * stopped rendering at all.
 *
 * Every state is asserted by its **words**. Nothing here depends on colour or on a
 * stylesheet, so a failure means the content is missing rather than merely
 * unstyled.
 *
 * @module
 */

// @vitest-environment jsdom

import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NormalizedErrorCode } from "@spectre-mail/core";
import type { Mailbox, SpectreError } from "@spectre-mail/core";
import { createMailboxSession } from "@spectre-mail/mailbox";
import { createProviderManager } from "@spectre-mail/providers";
import type { MailProvider } from "@spectre-mail/providers";

import { App } from "./App";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** A mailbox at a reserved `.example` domain, so no test address is ever real. */
function mailbox(id: string, expiresAt?: number): Mailbox {
  return {
    id,
    provider: "guerrilla",
    address: `${id}@mail.example`,
    createdAt: Date.parse("2026-10-02T12:00:00.000Z"),
    ...(expiresAt === undefined ? {} : { expiresAt }),
    status: "active",
    credentials: { provider: "guerrilla", sessionId: `session-${id}` },
  };
}

function providerReturning(over: {
  mailbox?: Mailbox;
  failWith?: SpectreError;
  create?: () => Promise<Mailbox>;
}): MailProvider {
  return {
    id: "guerrilla",
    displayName: "Guerrilla Mail",
    supports: () => false,
    checkHealth: () => Promise.resolve({ provider: "guerrilla", status: "ok" }),
    // Typed `Promise<Mailbox>` even where it rejects, so a scripted failure and a
    // scripted success are the same shape. A `Promise<never>` here would be a lie
    // about the contract the provider manager sees.
    createMailbox:
      over.create ??
      (() =>
        over.failWith !== undefined
          ? Promise.reject(over.failWith)
          : Promise.resolve(over.mailbox ?? mailbox("guerrilla-1"))),
    listMessages: () => Promise.resolve([]),
    getMessage: () => Promise.reject(new Error("unused")),
  };
}

/**
 * A provider call that fails with `error`.
 *
 * Typed as the call's declared return rather than as `Promise<SpectreError>`:
 * `Promise.reject(x)` is a `Promise<never>`, which is assignable to anything, so
 * the failure is reachable through the same `() => Promise<Mailbox>` signature a
 * success takes. A provider is not a different type of thing when it refuses.
 */
function refuses(error: SpectreError): Promise<Mailbox> {
  return Promise.reject(error);
}

function sessionOver(provider: MailProvider) {
  return createMailboxSession(createProviderManager([provider]));
}

/** Every character of visible text on the page. */
function visibleText(): string {
  return document.body.textContent ?? "";
}

describe("the website", () => {
  describe("while creating", () => {
    it("says it is creating, and shows no address of any kind", async () => {
      let release: (value: Mailbox) => void = () => undefined;
      const pending = new Promise<Mailbox>((resolve) => {
        release = resolve;
      });
      const session = sessionOver(providerReturning({ create: () => pending.then((m) => m) }));

      render(<App session={session} />);

      // The creating state must be reachable and say what it is doing.
      expect(screen.getByTestId("creating")).toBeTruthy();
      expect(visibleText()).toContain("Asking Guerrilla Mail for a new address.");

      // **No address**, and specifically nothing shaped like one. A placeholder, an
      // example, or an empty input would all be read as a real address by anything
      // parsing the page, and a user could type a signup form into it.
      expect(document.querySelector("input")).toBeNull();
      expect(visibleText()).not.toContain("@");
      expect(visibleText()).not.toContain("mail.example");

      await act(async () => {
        release(mailbox("guerrilla-1"));
        await pending;
      });
    });

    it("renders no address while a second address is being created", async () => {
      // The positive control for the above: the page *can* show an address, so its
      // absence during creation is a decision rather than a page that never had one.
      let release: (value: Mailbox) => void = () => undefined;
      const pending = new Promise<Mailbox>((resolve) => {
        release = resolve;
      });
      let call = 0;
      const session = sessionOver(
        providerReturning({
          create: () => {
            call += 1;
            return call === 1 ? Promise.resolve(mailbox("guerrilla-1")) : pending;
          },
        }),
      );

      render(<App session={session} />);
      await screen.findByTestId("ready");
      expect(visibleText()).toContain("guerrilla-1@mail.example");

      await act(async () => {
        screen.getByRole("button", { name: /replace address/i }).click();
      });

      // The old address is gone while the new one is in flight. Keeping it on screen
      // would be a lie about which address the user currently holds.
      expect(screen.queryByTestId("ready")).toBeNull();
      expect(visibleText()).not.toContain("guerrilla-1@mail.example");

      await act(async () => {
        release(mailbox("guerrilla-2"));
        await pending;
      });
      expect(visibleText()).toContain("guerrilla-2@mail.example");
    });
  });

  describe("when ready", () => {
    it("presents the address as selectable text", async () => {
      const session = sessionOver(providerReturning({ mailbox: mailbox("guerrilla-1") }));

      render(<App session={session} />);
      await screen.findByTestId("ready");

      // The address is a text node, not an input value and not an image, so it can
      // be selected by hand and announced by a screen reader without a special case.
      const address = screen.getByTestId("address");
      expect(address.textContent).toContain("guerrilla-1@mail.example");
      expect(address.querySelector("input")).toBeNull();
      expect(address.querySelector("img")).toBeNull();
      expect(address.textContent?.trim()).toBe(address.textContent?.trim());
    });

    it("names the copy action for what it copies", async () => {
      const session = sessionOver(providerReturning({}));

      render(<App session={session} />);
      await screen.findByTestId("ready");

      // "Copy address", not "Copy" and not an icon. The requirement is that the
      // action's name says what it copies, and a bare "Copy" on a page with one
      // address would read as copying the page.
      expect(screen.getByRole("button", { name: "Copy address" })).toBeTruthy();
    });

    it("confirms a successful copy", async () => {
      const writeText = vi.fn(() => Promise.resolve());
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { writeText },
      });

      const session = sessionOver(providerReturning({}));
      render(<App session={session} />);
      await screen.findByTestId("ready");

      await act(async () => {
        screen.getByRole("button", { name: "Copy address" }).click();
      });

      // The address goes over unchanged - no trimming, no normalisation - because a
      // silently altered address is one the user pastes and finds rejected.
      expect(writeText).toHaveBeenCalledWith("guerrilla-1@mail.example");
      expect(screen.getByRole("status").textContent).toContain("on your clipboard");
    });

    it("reports a refused clipboard and keeps the address selectable", async () => {
      // The clipboard rejects for ordinary reasons: no permission, an insecure
      // context, an unfocused document. This must be a rendered state, not an
      // unhandled rejection, and the address must survive it.
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { writeText: () => Promise.reject(new Error("not allowed")) },
      });

      const session = sessionOver(providerReturning({}));
      render(<App session={session} />);
      await screen.findByTestId("ready");

      await act(async () => {
        screen.getByRole("button", { name: "Copy address" }).click();
      });

      expect(screen.getByRole("status").textContent).toContain("was not copied");
      // Still there, still selectable: copying by hand is a complete answer.
      expect(screen.getByTestId("address").textContent).toContain("guerrilla-1@mail.example");
    });

    it("renders each state as different, labelled content", async () => {
      const session = sessionOver(
        providerReturning({ create: () => new Promise<Mailbox>(() => undefined) }),
      );

      // Rendered once and held. The creating state never resolves, so this captures
      // a real settled render rather than a transient one.
      render(<App session={session} />);

      const creatingHeading = screen.getByRole("heading", { name: /creating your address/i });
      const creatingText = visibleText();

      // Distinct heading and distinct prose, so the state is told apart by words. A
      // page that signalled state by colour alone would render identical text in
      // every state and pass - and there is no colour in this client to signal with.
      expect(creatingHeading.textContent).toBe("Creating your address");
      expect(creatingText).toContain("Asking Guerrilla Mail for a new address.");

      // The other two states' content is absent, so the three are mutually exclusive
      // rather than all rendered and merely reordered. These four strings are the
      // whole claim: the first version of this test checked only the two `testid`s,
      // and a mutation that added the word "Ready" to the *creating* state passed it.
      expect(screen.queryByTestId("ready")).toBeNull();
      expect(screen.queryByTestId("failure-explanation")).toBeNull();
      expect(creatingText).not.toContain("Your address");
      expect(creatingText).not.toContain("No address yet");
      expect(creatingText).not.toContain("Try again");
      // Plain containment, not a word-boundary match. `textContent` concatenates
      // adjacent elements with no separator, so "new address.Ready" has no
      // whitespace before "Ready" — and a regex anchored on `/(^|\s)Ready(\s|$)/`
      // passed a mutation that rendered exactly that. The falsification pass is the
      // only reason this is a plain `not.toContain`.
      expect(creatingText).not.toContain("Ready");
    });
  });

  describe("mailbox lifetime", () => {
    it("says the lifetime is unknown and shows no time value", async () => {
      const session = sessionOver(providerReturning({ mailbox: mailbox("guerrilla-1") }));

      render(<App session={session} />);
      await screen.findByTestId("ready");

      expect(screen.getByTestId("lifetime-unknown").textContent).toContain("Unknown");

      // No `<time>` element, and no digit run that could be a countdown or a
      // duration. Mail.tm publishes a 7-day retention and says a mailbox lasts until
      // deleted, but neither appears in any API response, so any number here would be
      // one this product invented.
      expect(document.querySelector("time")).toBeNull();
      const lifetime = screen.getByTestId("lifetime-unknown").textContent ?? "";
      expect(lifetime).not.toMatch(/\d/);
    });

    it("renders a provider-reported expiry, attributed, when there is one", async () => {
      // **The positive control for the absence above.** With an expiry present the
      // page does render one, so the previous test's silence is a decision and not an
      // omission.
      const expiresAt = Date.parse("2026-10-09T12:00:00.000Z");
      const session = sessionOver(
        providerReturning({ mailbox: mailbox("guerrilla-1", expiresAt) }),
      );

      render(<App session={session} />);
      await screen.findByTestId("ready");

      expect(screen.getByTestId("lifetime-reported").textContent).toContain(
        "2026-10-09T12:00:00.000Z",
      );
      // Attributed to the provider, not presented as a SpectreMail guarantee.
      expect(screen.getByTestId("lifetime-reported").textContent).toContain(
        "not a SpectreMail guarantee",
      );
      expect(screen.queryByTestId("lifetime-unknown")).toBeNull();
    });
  });

  describe("when creation fails", () => {
    it("shows a throttle in the user's terms, with a retry and no address", async () => {
      const session = sessionOver(
        providerReturning({
          failWith: {
            code: NormalizedErrorCode.RATE_LIMITED,
            provider: "guerrilla",
            description: "Rate limited; try again shortly.",
            rateLimit: "1; w=60",
          },
        }),
      );

      render(<App session={session} />);
      await screen.findByTestId("failure-explanation");

      expect(screen.getByTestId("failure-explanation").textContent).toContain(
        "asking SpectreMail to slow down",
      );
      expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
      // No address anywhere, in any form.
      expect(visibleText()).not.toContain("@");
      expect(document.querySelector("input")).toBeNull();
    });

    it("shows an unreachable provider differently from a throttle", async () => {
      // One render per test, deliberately. An earlier version of this test rendered
      // a throttled session, unmounted it, and rendered an unavailable one in the
      // same body; the second render stayed stuck in `creating`, so the comparison
      // silently became a comparison of nothing. One render per test removes the
      // cross-render coupling entirely, and the throttle's own wording is asserted
      // in the previous test rather than re-read from a sibling render.
      const session = sessionOver(
        providerReturning({
          failWith: {
            code: NormalizedErrorCode.PROVIDER_UNAVAILABLE,
            provider: "guerrilla",
            description: "Could not be reached.",
          },
        }),
      );

      render(<App session={session} />);
      await screen.findByTestId("failure-explanation");

      const text = screen.getByTestId("failure-explanation").textContent ?? "";
      expect(text).toContain("could not be reached");
      // Distinct from the throttle's wording. Two conditions, two instructions: a
      // generic message for both would make the normalized code pointless.
      expect(text).not.toContain("slow down");
      expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
      expect(visibleText()).not.toContain("@");
    });

    it("never retries by itself", async () => {
      const create = vi.fn((): Promise<Mailbox> =>
        refuses({
          code: NormalizedErrorCode.RATE_LIMITED,
          provider: "guerrilla",
          description: "Rate limited.",
        }),
      );
      const session = sessionOver(providerReturning({ create }));

      render(<App session={session} />);
      await screen.findByTestId("failure-explanation");

      // Exactly one attempt with no user action. A page that hid a 429 behind a
      // spinner would tell a rate-limited user their request was being handled; the
      // retry has to be theirs to press.
      expect(create).toHaveBeenCalledTimes(1);
    });

    it("retries when the user asks, and succeeds", async () => {
      let call = 0;
      const create = vi.fn((): Promise<Mailbox> => {
        call += 1;
        return call === 1
          ? refuses({
              code: NormalizedErrorCode.PROVIDER_UNAVAILABLE,
              provider: "guerrilla",
              description: "Could not be reached.",
            })
          : Promise.resolve(mailbox("guerrilla-9"));
      });
      const session = sessionOver(providerReturning({ create }));

      render(<App session={session} />);
      await screen.findByTestId("failure-explanation");

      await act(async () => {
        screen.getByRole("button", { name: "Try again" }).click();
      });

      await screen.findByTestId("ready");
      expect(create).toHaveBeenCalledTimes(2);
      expect(visibleText()).toContain("guerrilla-9@mail.example");
    });

    it("shows a rate limit verbatim, with no scope attached", async () => {
      const session = sessionOver(
        providerReturning({
          failWith: {
            code: NormalizedErrorCode.RATE_LIMITED,
            provider: "guerrilla",
            description: "Rate limited.",
            rateLimit: "1; w=60",
          },
        }),
      );

      render(<App session={session} />);
      await screen.findByTestId("failure-explanation");

      // Verbatim, and explicitly not interpreted. Whether `1; w=60` is per-IP or
      // per-account was never verified, so no scope may be stated.
      expect(screen.getByTestId("failure-rate-limit").textContent).toContain("1; w=60");
      expect(screen.getByTestId("failure-rate-limit").textContent).toContain(
        "does not know what it is counted per",
      );
      expect(screen.getByTestId("failure-rate-limit").textContent).not.toMatch(/per (ip|account)/i);
    });

    it("says so when it cannot tell why", async () => {
      const session = sessionOver(
        providerReturning({
          failWith: {
            code: NormalizedErrorCode.UNKNOWN_PROVIDER_ERROR,
            provider: "guerrilla",
            description: "Something unclassified happened.",
          },
        }),
      );

      render(<App session={session} />);
      await screen.findByTestId("failure-explanation");

      // An unknown cause is stated as unknown rather than guessed at. Reading a cause
      // out of prose would fail silently and permanently the first time the wording
      // changed.
      expect(screen.getByTestId("failure-explanation").textContent).toContain("could not tell why");
      expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
    });
  });

  describe("what the page claims", () => {
    it("says nothing that contradicts what the page does", async () => {
      const session = sessionOver(providerReturning({}));

      render(<App session={session} />);
      await screen.findByTestId("ready");

      const text = visibleText();

      // The M1 page claimed the client had no mailbox feature. It has one now, and
      // leaving the old sentence would make the page contradict itself.
      expect(text).not.toMatch(/no mailbox feature/i);
      expect(text).not.toMatch(/it has no mailbox/i);

      // Statements that are still true are kept.
      expect(text).toMatch(/no backend/i);
      expect(text).toMatch(/never (relays|proxies)/i);

      // And the limitations that are true are stated, including the ones that are
      // unflattering.
      expect(text).toMatch(/no inbox/i);
      expect(text).toMatch(/reload discards/i);
      expect(text).toContain("Guerrilla Mail and nothing else");
    });

    it("inserts no provider value as markup", async () => {
      const hostile = mailbox("guerrilla-1");
      Object.defineProperty(hostile, "address", {
        configurable: true,
        value: '<img src=x onerror="alert(1)">@mail.example',
      });
      const session = sessionOver(providerReturning({ mailbox: hostile }));

      const { container } = render(<App session={session} />);
      await screen.findByTestId("ready");

      // An address is provider-supplied text. It renders as text, so the tag is
      // visible characters and no element was created from it.
      expect(container.querySelector("img")).toBeNull();
      expect(screen.getByTestId("address").textContent).toContain("<img src=x");
    });

    // The structural counterpart - that no file under `apps/` contains an escape hatch
    // at all - lives in `tests/architecture/boundaries.test.ts`, next to the other
    // boundary rules and using its comment-stripping helper. It is not duplicated here:
    // a copy in a test file would be a second definition of the rule that could drift
    // from the first, which is precisely the defect this repository has now recorded
    // eleven times.
  });
});
