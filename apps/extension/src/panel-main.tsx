/**
 * The side panel's entry point.
 *
 * ## Why this is a second composition root rather than a branch in `main.tsx`
 *
 * **Because `sidepanel.html` and `popup.html` are two documents Chromium loads independently**, and
 * a module that mounted the wrong surface would be a surface nobody asked for. Two roots, each
 * mounting its own, is the shape the manifest declares.
 *
 * **Both stylesheets, imported here, in this order — the popup's order, and the order is the
 * mechanism.** The token stylesheet before the client's own, because `styles.css` is written in
 * terms of the tokens and must be parsed after they are declared; a bundler concatenates in import
 * order, which is the only thing that guarantees it. **Reusing the popup's stylesheet rather than
 * writing a second one is `design.md` D8's "no new token" in practice** — a panel with its own
 * sheet would be visual surface no capability describes.
 *
 * ## The session is this panel's own, and that is D10's accepted cost
 *
 * **Nothing prevents a person having this docked and the popup open at once**, and each builds its
 * own session over the same provider. D10 records why that is accepted rather than prevented, and
 * this file is where the duplication is created.
 *
 * ## No alarm seam, and that is a measured difference rather than an omission
 *
 * **The panel creates by asking the background context to do it** (`tasks.md` 5.8), and the worker
 * arms the alarm itself on that path — so a seam here would be a second way to ask for the same
 * thing. `App.tsx` needs one because *it* writes the mailbox itself.
 *
 * ## The heading in the branch below is the panel's, and it renders the one name
 *
 * **This file renders a copy of the panel's `<h1>` that `panel-copy.ts` does not own** — the branch
 * taken when this client's own storage could not be read at all, which is the same fourth heading
 * `main.tsx` renders for the popup. `panel-copy.ts`'s `title` is the panel's own copy constant and
 * `Panel.tsx` renders it three times; this branch renders the same value directly, because the
 * branch is a different component and the copy object does not reach it.
 *
 * **Two ways of holding the same name in one directory, and the requirement asks for the value
 * rather than for one mechanism.** `docs/BRANDING.md`'s surface table names both renderings and
 * `tests/architecture/branding-audit.test.ts` resolves it in both directions, so the next one is
 * reported by name. **The alternative — routing this branch's heading through `PANEL_COPY.title` —
 * was not taken**, because it would make a copy module reachable from a composition root that has
 * no other reason to import it, and `panel-copy.ts`'s own note says the module exists so a claim is
 * reviewable beside the requirement it serves.
 *
 * @module
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { PRODUCT_NAME } from "@spectre-mail/ui";

import "@spectre-mail/ui/tokens.css";
import "./styles.css";

import { createMailboxSession } from "@spectre-mail/mailbox";

import { readChromeLocalArea } from "./extension-platform";
import { Panel } from "./Panel";
import { createExtensionProviderManager, primaryProviderName } from "./provider-config";
import { extensionScheduler } from "./scheduler";
import { createExtensionStorage, loadInsertableMailboxes } from "./storage";
import { extensionTransport } from "./transport";

const container = document.getElementById("root");

if (container) {
  const storage = createExtensionStorage(readChromeLocalArea());

  /**
   * **Built once, here rather than inside the component, and for the popup's reason:** one manager
   * object supplies both halves, so this panel cannot be told one provider's name while its session
   * was handed another. **Called once rather than twice** — the first version called the factory
   * independently for the session and for the name, which is two managers where the popup builds
   * one, and the two-spellings problem `App.tsx` records for the string literal it replaced.
   */
  const manager = createExtensionProviderManager(extensionTransport);

  createRoot(container).render(
    <StrictMode>
      {storage.kind === "ready" ? (
        <Panel
          session={createMailboxSession(manager, extensionScheduler)}
          primaryProviderName={primaryProviderName(manager)}
          records={{
            /**
             * **The same function the popup and the in-page control use**, and for the same reason
             * `storage.ts` gives: three callers each deciding "the newest, unless it was written
             * before the collection existed" is how a device ends up showing one address in its
             * popup and offering another on a page.
             */
            loadMailboxes: () => loadInsertableMailboxes(storage.records),
            loadSiteMailboxId: storage.records.associations.loadSiteMailboxId,

            /**
             * **Through the singular contract, while the area holds four kinds** — which is exactly
             * the shape `packages/storage/src/chrome.test.ts:235` was written for: one removal through
             * one contract's whole-area operation, with a record planted through a different contract
             * gone with it.
             *
             * **A `SpectreStorage` has no other member that removes anything**, so this line names
             * the operation the requirement names and cannot narrow it to the records this build
             * recognises (`design.md` D4).
             *
             * **Bound as an arrow and not passed by reference**, because `readSiteMailboxId` above is
             * passed by reference because `ChromeStorage` builds these as closures over the area and
             * `clearAll` happens to be too — **but the panel must not depend on that.** A seam that
             * only works while the implementation happens to be a closure is a seam whose next
             * implementation breaks it silently, and this is the one member whose failure is
             * irreversible.
             */
            clearAll: () => storage.records.stored.clearAll(),
          }}
        />
      ) : (
        <main className="panel">
          <h1 className="panel__heading">{PRODUCT_NAME}</h1>
          <p role="alert">{storage.reason}</p>
        </main>
      )}
    </StrictMode>,
  );
}
