/**
 * The popup's entry point.
 *
 * ## This file used to be the only file that names `chrome`, and no longer is
 *
 * `chrome.storage.local` exists **only inside an extension**, so reading it is not a client
 * reaching past `packages/storage` into a browser global — it is the client supplying the
 * platform the adapter needs. `packages/storage` declares the shape of an area rather than
 * reading a global itself, precisely so that this line is the only place the choice is made.
 *
 * **That sentence was true until M9 slice 1 and was deleted rather than reworded.** The
 * content script needs the same read from a second context, so this file's own copy of the
 * reflective read became the *second* spelling, and `local-area.ts` was written beside
 * it with identical logic. Two copies of a shape check drift: one would gain a method the other
 * did not, and the extension would store a mailbox the popup could not read back.
 *
 * **So the reader is now {@link readChromeLocalArea}, and the popup calls it.** The claim this
 * file used to make about itself is now made by a rule that can fail — `keeps the extension
 * platform global to one module` in `tests/architecture/boundaries.test.ts`, which found this
 * duplication on its first run by reporting `main.tsx line 41`.
 *
 * **`Reflect.get` rather than a typed global, and the reason is a checked one.**
 * There is no `chrome` declaration in this workspace's DOM lib, so a property access would not
 * compile. A `declare global` block would make the platform's shape ambient across the whole
 * package, which `extension-platform.ts` deliberately refuses. Reading it reflectively keeps the
 * platform reachable from exactly one expression, and turns "no `chrome` in this environment"
 * into a value this file can branch on rather than a crash on load.
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
import { readChromeLocalArea } from "./extension-platform";
import { createExtensionStorage, loadInsertableMailboxes } from "./storage";

const container = document.getElementById("root");

if (container) {
  const storage = createExtensionStorage(readChromeLocalArea());

  createRoot(container).render(
    <StrictMode>
      {storage.kind === "ready" ? (
        <App
          storage={{
            // **One answer, computed in one place.** `loadInsertableMailboxes` is the only
            // function in this client that decides which stored mailbox the popup shows, so
            // the popup cannot disagree with the in-page control about which address this
            // device holds.
            loadMailbox: async () => (await loadInsertableMailboxes(storage.records))[0] ?? null,
            addMailbox: storage.records.mailboxes.addMailbox,
          }}
        />
      ) : (
        <main className="popup">
          <h1 className="popup__heading">SpectreMail</h1>
          <p role="alert">{storage.reason}</p>
        </main>
      )}
    </StrictMode>,
  );
}
