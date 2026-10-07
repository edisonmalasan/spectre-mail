/**
 * The popup's entry point.
 *
 * ## This is the only file that names `chrome`
 *
 * `chrome.storage.local` exists **only inside an extension**, so reading it is not a
 * client reaching past `packages/storage` into a browser global — it is the client
 * supplying the platform the adapter needs. `packages/storage` declares the shape of an
 * area rather than reading a global itself, precisely so that this line is the only
 * place the choice is made.
 *
 * **`Reflect.get` rather than a typed global, and the reason is a checked one.**
 * There is no `chrome` declaration in this workspace's DOM lib, so `chrome.storage.local`
 * would not compile. A `declare global` block would make the platform's shape ambient
 * across the whole package, which is what `chrome-api.ts` deliberately refuses. Reading
 * it reflectively keeps the platform reachable from exactly one expression, and turns
 * "no `chrome` in this environment" into a value this file can branch on rather than a
 * crash on load.
 *
 * ## Both stylesheets, imported here, in this order
 *
 * The token stylesheet before the popup's own, for the reason `apps/web/src/main.tsx`
 * gives: the app stylesheet is written in terms of the tokens and must be parsed after
 * they are declared. A bundler concatenates in import order, which is the only mechanism
 * that guarantees it.
 *
 * @module
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "@spectre-mail/ui/tokens.css";
import "./styles.css";

import { App } from "./App";
import { createExtensionStorage } from "./storage";

/** Read `chrome.storage.local`, or `undefined` where there is no extension context. */
function chromeLocalArea(): ReturnType<typeof toArea> {
  return toArea(Reflect.get(Reflect.get(globalThis, "chrome"), "storage")?.local);
}

/** Narrow a read value to the area shape `packages/storage` declares. */
function toArea(value: unknown): Parameters<typeof createExtensionStorage>[0] {
  // **A shape check rather than a cast**, because the whole point of not declaring a
  // global `chrome` is that nothing has verified this value. A cast would assert the
  // three operations exist without having looked.
  if (
    typeof value !== "object" ||
    value === null ||
    typeof (value as { get?: unknown }).get !== "function" ||
    typeof (value as { set?: unknown }).set !== "function" ||
    typeof (value as { clear?: unknown }).clear !== "function"
  ) {
    return undefined;
  }
  return value as Parameters<typeof createExtensionStorage>[0];
}

const container = document.getElementById("root");

if (container) {
  const storage = createExtensionStorage(chromeLocalArea());

  createRoot(container).render(
    <StrictMode>
      {storage.kind === "ready" ? (
        <App storage={storage.storage} />
      ) : (
        <main className="popup">
          <h1 className="popup__heading">SpectreMail</h1>
          <p role="alert">{storage.reason}</p>
        </main>
      )}
    </StrictMode>,
  );
}
