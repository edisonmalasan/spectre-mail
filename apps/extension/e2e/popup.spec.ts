/**
 * The popup, in a real Chromium, as an extension page.
 *
 * ## What this is the only instrument for
 *
 * Four things about this client cannot be checked anywhere else, and each is a fact
 * about **the extension context** rather than about the code:
 *
 * 1. **`chrome.storage.local` really persists.** jsdom has no `chrome` at all, so the
 *    website's IndexedDB work is only observable in a browser because IndexedDB is a DOM
 *    API. `chrome.storage` exists only inside an extension, so the same applies with more
 *    force: this suite reads back through the platform's own API rather than through the
 *    adapter, which is what distinguishes "the adapter round-tripped" from "the platform
 *    kept it".
 * 2. **The popup runs at a `chrome-extension://` origin**, which is not `http://` and is
 *    where every extension-specific difference shows up.
 * 3. **The built stylesheet** is what Chromium loaded, so the literal sweep reads shipped
 *    output rather than a source file.
 * 4. **The popup needs no web server**, and that is why this tier's config has none.
 *
 * ## What it does not establish, and the list is the point
 *
 * - **Nothing about a live provider.** Every response is a recorded one; see
 *   `recorded-provider.ts`. * - **Nothing about how the popup looks.** No assertion here reads a rendered pixel's
 *   colour or position. The stylesheet sweep reads text, and the contrast requirement is
 *   `packages/ui`'s arithmetic over two hex values. Whether a 22rem popup reads as
 *   balanced is a human judgement and no gate in this repository stands in for it.
 * - **Nothing about Firefox or WebKit.** Neither loads an extension.
 * - **Nothing about the service worker surviving**, which `measurement.spec.ts` measures
 *   and this file does not assume.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { launchExtension } from "./launch-extension";
import type { LaunchedExtension } from "./launch-extension";
import { recordProviderTraffic, FIXTURE_IDS } from "./recorded-provider";
import type { ProviderTraffic } from "./recorded-provider";
import { servedStylesheet, stripGeneratedTokenBlocks } from "./served-stylesheet";

let extension: LaunchedExtension;
let traffic: ProviderTraffic;

test.beforeAll(async () => {
  extension = await launchExtension();
});

test.afterAll(async () => {
  await extension?.close();
});

/**
 * Open the popup at the extension's own origin, with recorded provider traffic.
 *
 * ## Storage is cleared first, and that is a precondition rather than hygiene
 *
 * `chrome.storage.local` is scoped to the **profile**, and one profile is shared by every
 * spec in this file — so without this the second spec finds the mailbox the first one
 * created and shows the address section instead of the create action. That was observed:
 * `openPopup` timed out waiting for "Create an address" in four specs at once.
 *
 * The failure is worth recording rather than only fixing, because **it is the product's
 * persistence working correctly** and it silently reorders the suite: without the reset,
 * which specs pass depends on which ran first. The website's tier gets per-spec context
 * isolation from Playwright for free; an extension's `chrome.storage` survives a new
 * context in the same profile, so it has to be cleared deliberately.
 */
async function openPopup(options: Parameters<typeof recordProviderTraffic>[1] = {}): Promise<Page> {
  traffic = await recordProviderTraffic(extension.context, options);
  await clearStoredMailbox();

  const page = await extension.context.newPage();
  await page.goto(`chrome-extension://${extension.extensionId}/popup.html`);
  // **The boot read is the popup's first act**, so waiting for the create action is
  // waiting for storage to have answered. Anything that would let this settle before
  // the read finished would let a spec read the popup mid-boot.
  await expect(page.getByRole("button", { name: "Create an address" })).toBeVisible();
  return page;
}

/**
 * Empty the extension's storage area.
 *
 * **`clear()` rather than removing the one key**, for the same reason
 * `packages/storage`'s `clearAll` removes the whole area: a narrower call would pass
 * every test written against today's single record and quietly stop clearing everything
 * the moment a later build added a second record kind.
 */
async function clearStoredMailbox(): Promise<void> {
  await extension.worker.evaluate(async () => {
    const area = (
      globalThis as unknown as {
        chrome: { storage: { local: { clear(): Promise<void> } } };
      }
    ).chrome.storage.local;
    await area.clear();
  });
}

test.describe("the popup as an extension page", () => {
  test("names the provider it will reach and offers no way to change it", async () => {
    const page = await openPopup();

    // **Named before it is used**, because this client reaches two providers and the
    // one thing a user must not be misled about is which one will actually be asked.
    await expect(page.getByRole("heading", { name: "Asking Mail.tm first" })).toBeVisible();

    // **No selector, asserted as an absence.** A control over two reachable options
    // could act here in a way it could not on the website — so the reason it is absent
    // is not "one option cannot act" but that choosing is a disclosure at this
    // milestone, not a user action.
    await expect(page.getByRole("combobox")).toHaveCount(0);
    await expect(page.getByRole("radio")).toHaveCount(0);
  });

  test("creates a mailbox and reports the provider that actually served it", async () => {
    const page = await openPopup();

    await page.getByRole("button", { name: "Create an address" }).click();

    // **The provider is named by the one that *served*, not the one that was preferred.**
    // That distinction is the whole point of `provider-abstraction`'s requirement that a
    // fallback cannot masquerade as the primary.
    await expect(page.getByRole("heading", { name: "mailtm" })).toBeVisible();

    // **The address's domain comes from the recorded `/domains` response, and the local
    // part does not.** An earlier draft of this spec asserted a fixed
    // `ghost83@uberip.com` and failed twice with two different addresses
    // (`9j3k4qkdcscx@uberip.com`, `vt76ijfnw2z5@uberip.com`) — because Mail.tm's adapter
    // **generates the local part itself** from the `randomToken` the extension supplies,
    // and the account-creation response only echoes it back. Asserting the whole address
    // would have been asserting that the adapter ignores its own randomness.
    //
    // So: the domain is the recorded one, the local part is present and non-empty, and
    // the extension — not a fixed string — is what chose it.
    const address = (await page.locator(".popup__address").textContent()) ?? "";
    expect(address).toMatch(/^[a-z0-9]{8,}@uberip\.com$/);

    // **And the fallback was never contacted**, which is a different claim from the one
    // above: a client that speculatively called both would show the same heading.
    expect(traffic.requested.some((url) => url.includes("guerrillamail"))).toBe(false);
  });

  test("persists the mailbox through chrome.storage, read back by the platform", async () => {
    const page = await openPopup();
    await page.getByRole("button", { name: "Create an address" }).click();
    await expect(page.locator(".popup__address")).toHaveText(/@uberip\.com$/);
    const shown = (await page.locator(".popup__address").textContent()) ?? "";

    // **Polled, not read once.** The first version of this test waited for the address to
    // appear and then read storage — and got `{}`. **The address renders from the
    // session's state, which is published before `saveMailbox` has resolved**, so waiting
    // for the address is not waiting for the write. It is the fifth recorded instance of
    // a precondition weaker than the property it measures, and in the direction this
    // repository cares about: it does not fail, it measures too early.
    //
    // Polling for the record itself is the wait that matches the claim.
    await expect
      .poll(async () =>
        extension.worker.evaluate(async () => {
          const area = (
            globalThis as unknown as {
              chrome: {
                storage: { local: { get(key: string): Promise<Record<string, unknown>> } };
              };
            }
          ).chrome.storage.local;
          const found = await area.get("current");
          const record = found.current as { version?: number } | undefined;
          return record?.version;
        }),
      )
      .toBe(1);

    // **Read through the platform's own API, not through the adapter.** Reading it
    // through `createChromeStorage` would only prove the adapter round-tripped, and this
    // is the claim that the *platform* kept it — which is the claim the website's browser
    // tier makes about IndexedDB and the reason this suite exists at all.
    const stored = await extension.worker.evaluate(async () => {
      const area = (
        globalThis as unknown as {
          chrome: { storage: { local: { get(key: string): Promise<Record<string, unknown>> } } };
        }
      ).chrome.storage.local;
      return area.get("current");
    });

    const record = stored.current as {
      version: number;
      mailbox: { address: string; provider: string };
    };
    // **The versioned record, through the shared narrowing.** `record.ts` is shared
    // between both adapters precisely so a record one platform wrote is readable by
    // either, and this is where that is observable.
    expect(record.version).toBe(1);
    // **The stored address is the one on screen**, which is the round-trip claim.
    expect(record.mailbox.address).toBe(shown);
    expect(record.mailbox.provider).toBe("mailtm");
  });

  test("falls back to Guerrilla Mail and names it, not the provider it preferred", async () => {
    const page = await openPopup({ mailTmUnavailable: true });

    await page.getByRole("button", { name: "Create an address" }).click();

    // **The requirement's own words as a browser assertion.** Mail.tm answered 503 and
    // Guerrilla Mail served the mailbox; a popup that kept showing "Asking Mail.tm
    // first" over a Guerrilla address would be telling the user their mail lives at a
    // provider that never answered.
    //
    // **The address is `FIXTURE_IDS`, not a string this file chose** — and that is a
    // correction rather than a detail. The previous version of this spec asserted
    // `shadow@sharklasers.com`, a value its own recorded-provider module had invented, so
    // the assertion proved the popup echoed a fixture this repository wrote rather than
    // proving it reported a provider's answer. The tier now imports the measured
    // fixtures by name, and the measured Guerrilla Mail address is a different string.
    await expect(page.locator(".popup__address")).toHaveText(FIXTURE_IDS.guerrilla.address);
    await expect(page.getByRole("heading", { name: "guerrilla" })).toBeVisible();

    // **Both were tried, in the declared order.**
    const mailtmIndex = traffic.requested.findIndex((url) => url.includes("api.mail.tm"));
    const guerrillaIndex = traffic.requested.findIndex((url) => url.includes("guerrillamail"));
    expect(mailtmIndex).toBeGreaterThanOrEqual(0);
    expect(guerrillaIndex).toBeGreaterThan(mailtmIndex);
  });

  test("answers a user-asked inbox check, and only when asked", async () => {
    const page = await openPopup();
    await page.getByRole("button", { name: "Create an address" }).click();
    await expect(page.locator(".popup__address")).toHaveText(/@uberip\.com$/);

    // **Before any check, the count is an answer about nothing and says so.**
    await expect(page.getByText("No mail has arrived.")).toBeVisible();
    const requestsBefore = traffic.requested.length;

    // **Nothing polled on its own while the popup sat open.** This is D1's requirement,
    // asserted in the place it matters: a background check would have shown up here as a
    // provider request nobody asked for.
    await page.waitForTimeout(1_500);
    expect(traffic.requested.length).toBe(requestsBefore);

    await page.getByRole("button", { name: "Check for mail" }).click();

    // **Then a check does reach the provider** — so the assertion above is not merely
    // satisfied by a check control that does nothing, which is the fourth recorded
    // instance of an assertion narrower than the rule it documents.
    await expect.poll(() => traffic.requested.length).toBeGreaterThan(requestsBefore);

    // **And the count is the recorded one, which is not zero.**
    //
    // **This assertion was "No mail has arrived.", and it was wrong twice over.** The
    // recorded listing this tier serves is the measured one from `packages/providers`,
    // and it holds a single message — so an empty-inbox claim was never going to be
    // true of it. Before the fixture change the module transcribed its own *empty*
    // collection, which is what made the claim pass: **the spec had been asserting
    // against a body this repository invented rather than one a provider returned.**
    //
    // Asserting the measured count is the stronger claim. It cannot be satisfied by a
    // stub, it distinguishes a popup that counted from one that always says "nothing",
    // and it fails if the adapter's mapping of the listing ever changes.
    await expect(page.getByText("1 message")).toBeVisible();
  });

  test("requests no origin the tier did not script", async () => {
    const page = await openPopup();
    await page.getByRole("button", { name: "Create an address" }).click();
    await expect(page.locator(".popup__address")).toHaveText(/@uberip\.com$/);

    // **The strong form of "everything here is recorded".** An extension is precisely
    // the kind of program that could reach somewhere nobody scripted, so the check is
    // that nothing did — and it names the origin rather than counting, because a count
    // cannot be told apart from a check that found nothing to complain about.
    expect(traffic.unscripted, `unscripted origins: ${traffic.unscripted.join(", ")}`).toEqual([]);
  });
});

test.describe("the stylesheet the browser actually loaded", () => {
  test("names no colour, radius, spacing step, type size or duration literally", async () => {
    const page = await openPopup();
    const served = await servedStylesheet(page);

    // **The guard, before the sweep, and it is the assertion most likely to be missing.**
    // `stripGeneratedTokenBlocks` removes `:root` blocks on the strength of the generator
    // emitting its tokens there and nowhere else. If the popup's own stylesheet ever
    // declared a `:root`, the strip would eat real styles and the sweep would
    // under-report — which is the direction that lets a violation through. So the premise
    // is asserted rather than trusted. This is the same guard
    // `apps/web/e2e/sections.spec.ts` carries, for the same reason.
    const authored = readFileSync(
      fileURLToPath(new URL("../src/styles.css", import.meta.url)),
      "utf8",
    );
    expect(
      authored.match(/(^|[{}])\s*:root\s*\{/g) ?? [],
      "the popup's own stylesheet must declare no :root, or the token strip would hide real styles",
    ).toEqual([]);

    const css = stripGeneratedTokenBlocks(served);

    // **The token layer really is excluded, and it really does hold colours** — otherwise
    // the sweep below could be passing on a strip that removed everything. Measured on the
    // first run of this file: the unswept sheet carried 18 hex values, all of them the
    // generated palette's.
    expect(served).toMatch(/#[0-9a-f]{6}\b/i);
    expect(css).not.toMatch(/#[0-9a-f]{6}\b/i);

    // **Five categories, because those are the five a boundary rule does *not* check.**
    // `AGENTS.md` records that the enforced stylesheet rules cover remote URLs, outline
    // suppression, and unresolved `var()` references, and that "no literal" for colour,
    // radius, type size and spacing is a **measurement** rather than an assertion. This
    // is that measurement, run against what Chromium loaded.
    //
    // Each is a *whole-declaration* test rather than a pattern for one component of a
    // value, because the earlier version of this sweep counted
    // `border-radius: var(--radius-md)` as a literal — a check that cries wolf gets
    // deleted, so it is worth getting right the first time.
    const declarations = [...css.matchAll(/(^|[;{])\s*([a-z-]+)\s*:\s*([^;}]+)/gi)].map(
      (match) => ({ property: (match[2] ?? "").trim(), value: (match[3] ?? "").trim() }),
    );

    /** Values that are not a literal in any category. */
    const PERMITTED = new Set([
      "0",
      "auto",
      "none",
      "inherit",
      "initial",
      "unset",
      "revert",
      "normal",
      "bold",
      "solid",
      "collapse",
      "border-box",
      "content-box",
    ]);

    /**
     * Is every component of this value a token reference or a permitted keyword?
     *
     * **Component by component, not the whole value as one string.** The first version
     * tested `!/\d/.test(value)`, which is wrong for the most ordinary value in the
     * stylesheet: `--space-5` contains a digit. It reported `gap: var(--space-5)` as a
     * literal spacing — five false positives in one test, on correct declarations. The
     * second version tested the whole value against `var(`, which fixes those and then
     * misses `padding: var(--space-2) var(--space-4)`. Splitting the value is what makes
     * a two-token value two checks.
     */
    const isTokenised = (value: string): boolean =>
      value
        .split(/\s+/)
        .filter((component) => component.length > 0)
        .every((component) => component.startsWith("var(--") || PERMITTED.has(component));

    const categories: readonly { readonly label: string; readonly properties: RegExp }[] = [
      {
        label: "colour",
        properties: /^(color|background|border.*color|outline-color|fill|stroke)$/i,
      },
      { label: "radius", properties: /^border.*radius$/i },
      {
        label: "spacing",
        properties: /^(margin|padding|gap|row-gap|column-gap|top|left|right|bottom|inset)/i,
      },
      { label: "type size", properties: /^font(-size)?$/i },
      {
        label: "duration",
        properties: /^(animation|transition|animation-duration|transition-duration)/i,
      },
    ];

    for (const category of categories) {
      const offenders = declarations
        .filter((d) => category.properties.test(d.property) && !isTokenised(d.value))
        .map((d) => `${d.property}: ${d.value}`);
      expect(
        offenders,
        `${category.label} written literally in the popup's served stylesheet: ${offenders.join(" | ")}`,
      ).toEqual([]);
    }
  });

  test("carries no remote stylesheet, font or image", async () => {
    // **The extension half of a promise the website makes and `sections.spec.ts` checks
    // there.** An extension has strictly more reason to keep every asset local: it holds
    // host permissions, and a remote font is a third-party request the product would be
    // making on the user's behalf, from a context that can reach origins a page cannot.
    const page = await openPopup();
    const served = await servedStylesheet(page);

    expect(served).not.toMatch(/@import\s+url/i);
    expect(served).not.toMatch(/url\(\s*['"]?https?:/i);
  });
});
