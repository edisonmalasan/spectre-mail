/**
 * A fake `chrome.storage.local` area, shared by every test that needs one.
 *
 * ## Why it lives here rather than in one test file
 *
 * `site-associations` added two more adapters over the same platform, and copying this fake into
 * each of their test files would have made three copies of the one place where the platform's
 * documented behaviour is written down. **A fake that has been copied is a fake whose behaviour has
 * started to drift**, and the properties that matter here — an absent key is absent rather than
 * `undefined`, `set` resolves on acceptance with nothing to wait for — are exactly the properties a
 * copy is most likely to get subtly wrong while still passing its own tests.
 *
 * ## What it does and does not establish
 *
 * It is **not Chromium**. It implements the shape `chrome.storage` is written against, so the
 * properties asserted through it are properties of *this adapter against a fake behaving as
 * documented*. Nothing here establishes that the browser does the same, which is the same limit
 * `AGENTS.md` records for `fake-indexeddb` and the reason this file says so next to the fake rather
 * than only in the test files that use it.
 *
 * @module
 */

import type { ChromeStorageArea } from "../chrome-api";

/**
 * An area, plus the data it holds and every call made against it.
 *
 * **The call log is not a convenience.** What the adapter *asked the platform to do* is a different
 * claim from what the platform then did, and both matter: an adapter that clears the whole area
 * rather than one key is visible only in the call it made, never in the data afterwards — the
 * result of both is an empty area.
 */
export function fakeChromeArea(seed: Record<string, unknown> = {}) {
  const data: Record<string, unknown> = { ...seed };
  const calls: string[] = [];

  const area: ChromeStorageArea = {
    async get(keys) {
      calls.push(`get(${keys === undefined ? "" : String(keys)})`);
      if (keys === undefined || keys === null) {
        return { ...data };
      }
      const wanted =
        typeof keys === "string" ? [keys] : Array.isArray(keys) ? keys : Object.keys(keys);
      const out: Record<string, unknown> = {};
      // **A key that was never written is ABSENT, not present-and-undefined.**
      // That is the platform's documented shape and the reason the adapter reads
      // defensively; a fake that stored `undefined` would hide a real bug.
      for (const key of wanted) {
        if (Object.hasOwn(data, key)) {
          out[key] = data[key];
        }
      }
      return out;
    },
    async set(items) {
      calls.push(`set(${Object.keys(items).join(",")})`);
      Object.assign(data, items);
    },
    async clear() {
      calls.push("clear()");
      for (const key of Object.keys(data)) {
        delete data[key];
      }
    },
  };

  return { area, data, calls };
}
