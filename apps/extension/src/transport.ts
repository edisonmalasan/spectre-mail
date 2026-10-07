/**
 * How the extension performs a provider request.
 *
 * ## Why this exists rather than a bare `fetch`
 *
 * `packages/mail-parser` may never reach the global `fetch`, and
 * `tests/architecture/boundaries.test.ts` asserts it. Every other client here does the
 * same thing for the same reason: a bare `fetch` at a call site is a seam nothing can
 * substitute, so a test cannot record what was sent without standing up a network.
 *
 * `apps/web` has a `transport.ts` for exactly this. This is its counterpart, and the
 * boundary rule that confines composition seams to a client's `provider-config.ts` and
 * `transport.ts` is why the name is not arbitrary — renaming it would need that rule
 * edited, and nothing else in the repository depends on the name.
 *
 * ## What a provider request looks like from here
 *
 * **Identical to the website's**, which is the point. An extension's privilege is
 * reaching an origin a page cannot; it is not a different request shape.
 *
 * `credentials: "omit"` is what makes a cross-origin provider call usable from either
 * host: Guerrilla Mail sends `Access-Control-Allow-Origin: *` with **no**
 * `Access-Control-Allow-Credentials`, so a browser cannot send its session cookie
 * cross-origin from either environment — which is why the adapter takes the session id
 * from the response body rather than the `PHPSESSID` cookie (`docs/PROVIDERS.md`).
 *
 * @module
 */

import { createFetchTransport } from "@spectre-mail/providers";
import type { Transport } from "@spectre-mail/providers";

/**
 * The transport the extension's providers use.
 *
 * `globalThis.fetch` is read at **call time** rather than captured at module load, for
 * the reason `apps/web`'s transport gives: a test importing this module in a DOM-less
 * environment should fail when the transport is *used*, not when it is merely imported.
 */
export const extensionTransport: Transport = createFetchTransport((url, init) =>
  globalThis.fetch(url, { credentials: "omit", ...init }),
);
