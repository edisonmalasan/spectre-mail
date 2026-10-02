/**
 * The website's transport.
 *
 * One place where a browser global is read, so every other file in this client
 * stays free of one. `tests/architecture/boundaries.test.ts` allows exactly this
 * file's access and no other, and a test drives {@link createWebsiteProviderManager}
 * with a recording transport to prove the difference is real rather than nominal.
 *
 * There is no proxy, no backend, and no credential handling here. Requests go
 * straight from the page to the provider, which is the only arrangement the
 * architecture permits.
 *
 * @module
 */

import { createFetchTransport } from "@spectre-mail/providers";

/**
 * The transport the browser uses.
 *
 * `globalThis.fetch` is read at call time rather than captured at module load, so
 * a test importing this module in a DOM-less environment fails when the transport
 * is actually used instead of when it is merely imported.
 */
export const webTransport = createFetchTransport((url, init) => globalThis.fetch(url, init));
