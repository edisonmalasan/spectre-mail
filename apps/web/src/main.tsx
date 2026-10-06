/**
 * Entry point.
 *
 * ## The two stylesheets, and why they are imported here rather than linked in markup
 *
 * The token layer is imported **before** the page's own styles, and the order is the
 * reason both are here: the app stylesheet is written entirely in terms of the tokens,
 * so it must be parsed after they are declared. A bundler concatenates in import order,
 * which is the only mechanism that guarantees it — a `<link>` in `index.html` beside an
 * `import` in here would race, and the failure mode is a page whose colours silently
 * fall back to their initial values.
 *
 * **Both files are local.** Nothing here reaches a third-party origin, which is a
 * promoted requirement of `build-and-verification` and a promise this page makes in
 * words in its own Local Data region. `tests/architecture/boundaries.test.ts` fails the
 * build if either file names a remote URL, and `index.html` is checked for the same
 * thing because neither check covers the other.
 *
 * @module
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "@spectre-mail/ui/tokens.css";
import "./styles.css";

import { App } from "./App";

const container = document.getElementById("root");

if (!container) {
  throw new Error("Missing #root element. index.html and main.tsx are out of sync.");
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
