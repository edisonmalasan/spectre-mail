import { defineConfig, devices } from "@playwright/test";

/**
 * The extension's browser tier.
 *
 * ## Why this is a second config and not a second project in `apps/web`'s
 *
 * **Loading an extension requires `chromium.launchPersistentContext`.** Playwright's
 * `chromium.launch` — which is what `use: {}` in the website's config reaches — has no
 * `--load-extension` option at all, because a non-persistent context has no profile to
 * install one into. So the website's config cannot express this suite's subject no
 * matter how many projects are added to it, and pretending otherwise would produce a
 * suite that silently does not load the extension.
 *
 * Two configs also keeps the two tiers' **subjects** apart, which is the reason the
 * tier exists in the first place: the website suite asks what the built *page* does in
 * a browser, and this one asks what Chromium does with *this extension* — its manifest,
 * its service worker's idle lifetime, and whether the host permissions it declares
 * actually grant a request.
 *
 * ## No `webServer`, and that is not an omission
 *
 * An extension is not served over HTTP. It is a directory Chromium loads from disk, and
 * `popup.html` is opened as a `chrome-extension://` URL. There is nothing to start, so
 * the config has no `webServer` — and the suite's own precondition is that `dist` exists
 * and is current, which `test:browser` guarantees by building first.
 *
 * **`in-page.spec.ts` does have a page, and it still adds no `webServer`.** A content script
 * only runs against a real navigation to a real `https://` origin, so that suite needs a page;
 * it gets one from `page.route`, fulfilling three responses off disk on a reserved
 * `.invalid` origin. The decision and the recorded failure behind it — the website tier's
 * browser job hanging five times because `webServer`'s wrapper process outlives Playwright —
 * are in `helpers/in-page-fixture.ts`. **A third `webServer` on the tier that already had that
 * bug is a port and a process bought to avoid.**
 *
 * ## Chromium only, for the same reason the website's config says it
 *
 * `--load-extension` is a Chromium flag. No other engine here has it, and the honest
 * form of this claim is "verified in Chromium" rather than "verified in a browser".
 */
export default defineConfig({
  testDir: "./e2e",
  testMatch: /.*\.spec\.ts$/,

  // **An empty run fails**, which is Playwright's default and is relied on rather
  // than set: Playwright exits non-zero with `No tests found` when `testDir` matches
  // nothing. See `apps/web/playwright.config.ts` for why this is not a flag here.
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  // No `webServer`. See the note above.

  // This tier is allowed to be slower than the unit tier and is not counted against it.
  timeout: 90_000,
});

/**
 * Where the built extension lives, and the flag that loads it.
 *
 * **Exported rather than repeated in each spec**, because a suite that loads one
 * directory and asserts against another verifies nothing — and the same reason
 * `SITE_ORIGIN` is exported from the website's config.
 *
 * **`dist` relative to this file**, so the suite loads the *built* output — the same
 * directory a user would load unpacked. A suite that loaded the TypeScript sources
 * would verify something no user ever receives, and `manifest.json` is the file that has
 * to be right for the extension to work at all.
 */
export const EXTENSION_DIST = "dist";

/**
 * The flags Chromium needs before it will load an unpacked extension.
 *
 * **Both, and both of them measured rather than looked up.** Three separate things had
 * to be true, and two of the first three guesses were wrong:
 *
 * 1. **`--disable-extensions-except` is required.** `--load-extension` alone was tried
 *    first and Chromium accepted the command line and loaded **nothing** —
 *    `serviceWorkers()` and `backgroundPages()` both `[]` after four seconds.
 * 2. **The path must be absolute.** `--load-extension=dist` silently loads nothing;
 *    `--load-extension=C:\...\apps\extension\dist` registers the worker immediately.
 *    **This is the same failure shape as the slash-less host permission the architecture
 *    rules warn about, one layer down**: a plausible-looking declaration that grants
 *    nothing, with no error anywhere.
 * 3. **Neither the headless shell nor headless mode was the cause.** `channel:
 *    "chromium"` (the full binary, new headless mode) registered nothing on its own,
 *    and neither did a headed window. The channel is kept for the reason
 *    `launch-extension.ts` gives, but it is **not** what makes the load succeed.
 *
 * So the function takes a resolved absolute path rather than reading `EXTENSION_DIST`
 * itself, which is the only reason it is a function: a relative path here is not a
 * smaller convenience, it is a suite that verifies nothing.
 */
export function extensionFlags(resolvedDist: string): string[] {
  return [`--load-extension=${resolvedDist}`, `--disable-extensions-except=${resolvedDist}`];
}

/**
 * The origin Chromium serves a loaded extension from.
 *
 * **`chrome-extension://<id>`, and the id is not known in advance** — Chromium derives
 * it from the extension's key or its path. So a spec reads the real id from the
 * service worker's own registration rather than hard-coding one, which is what
 * `extension.spec.ts` does.
 */
export const EXTENSION_SCHEME = "chrome-extension://";
