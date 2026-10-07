/**
 * The extension preview, as a user would perceive it.
 *
 * ## The one thing this file exists to check
 *
 * **That the depiction is not operable.** `design.md` D2 forbids the preview rendering an
 * interactive element of any kind, and this is the assertion that can fail if someone adds one
 * later: someone adding "and a button to install it" is the obvious next idea, and it is exactly
 * the fake-UI defect `extension-client` removed from the popup itself.
 *
 * ## Why the non-interactive check is written twice
 *
 * **Both a role query and a direct query of the rendered document, because either alone has a
 * known way of passing while a control is present.** Testing Library derives roles from its own
 * element-to-role map, so an element carrying `role="button"` is reported as a button by role
 * query *and* is not a `<button>` element — a tag-count assertion alone misses it. Conversely a
 * bare `queryByRole` covers only the roles it knows. So the check runs twice, over two
 * independent readings, and the roles listed include the ones most likely to be reached for by
 * accident (`link`, `checkbox`, `switch`, `tab`, `menuitem`, `textbox`, plus every `a` with an
 * `href` and every element carrying any `role` attribute at all).
 *
 * This is the same lesson as the footer defect Chromium found and jsdom did not: a substitute
 * platform's answer can be confidently wrong. `apps/web/e2e/sections.spec.ts` therefore reads
 * Chromium's own accessibility tree over CDP for the shipped page, and this file is the unit
 * half — neither alone is the claim.
 *
 * ## What this file does not establish
 *
 * **Nothing about how the preview looks.** Everything below reads text and reads the document.
 * No test in this repository reads a rendered pixel's colour or position.
 *
 * @module
 */

// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

// **No `screen` import.** The queries here are bound from each `render()` result, because
// `screen` in this project resolves to an installation of `@testing-library/dom` that does not
// carry `queryAllByRole`. See the note beside the role assertion for the measurement.

import { ExtensionPreview } from "./ExtensionPreview";
import { EXTENSION_PREVIEW } from "./sections";

afterEach(cleanup);

/** Every role a depiction must never expose, because each one reads as operable. */
const OPERABLE_ROLES = [
  "button",
  "link",
  "checkbox",
  "switch",
  "radio",
  "tab",
  "menuitem",
  "menuitemcheckbox",
  "menuitemradio",
  "option",
  "textbox",
  "searchbox",
  "combobox",
  "slider",
  "spinbutton",
] as const;

/** Selectors for markup that is operable whatever role it resolves to. */
const OPERABLE_SELECTORS = [
  "button",
  "a[href]",
  "input",
  "select",
  "textarea",
  "[role]",
  "[onclick]",
];

describe("the extension preview", () => {
  it("renders the copy the section declares", () => {
    render(<ExtensionPreview />);

    const region = document.querySelector('[data-region="extension"]');
    expect(
      region,
      "the region carries the hook the page-order assertion reads it by",
    ).not.toBeNull();

    const text = region?.textContent ?? "";
    for (const sentence of [
      EXTENSION_PREVIEW.heading,
      EXTENSION_PREVIEW.lede,
      EXTENSION_PREVIEW.caption,
      EXTENSION_PREVIEW.note,
      ...EXTENSION_PREVIEW.regions.map((region_) => region_.does),
    ]) {
      expect(text, "every declared sentence is on the page").toContain(sentence);
    }
  });

  it("renders every depicted label, and the label is what the page prints", () => {
    const { container } = render(<ExtensionPreview />);

    const labels = [...container.querySelectorAll(".preview__label")].map(
      (node) => node.textContent,
    );
    const declared = EXTENSION_PREVIEW.regions.flatMap((region) =>
      region.labels.map((l) => l.label),
    );

    // **Count first, then content.** A component that rendered only the first label would
    // satisfy a `toContain` per declared label while showing a visitor a third of the popup,
    // and the count is what makes that visible.
    expect(labels, "one rendered label per declared label").toHaveLength(declared.length);
    expect(labels.sort(), "the labels rendered are the labels declared").toEqual(
      [...declared].sort(),
    );
  });

  it("renders no interactive element, by role", () => {
    const { container, queryAllByRole } = render(<ExtensionPreview />);

    for (const role of OPERABLE_ROLES) {
      expect(
        container.querySelectorAll(`[role="${role}"]`),
        `the preview must expose no element with role "${role}"`,
      ).toHaveLength(0);
    }

    // **And through Testing Library's own role mapping**, which is a second instrument rather
    // than a restatement: it derives the role from the element rather than reading the
    // attribute, so a `<div role="button">` is caught here even though the attribute scan above
    // is what a reader of that assertion would expect to be sufficient.
    //
    // **Bound from the render result, not from `screen`.** `screen.queryAllByRole` is *not a
    // function* in this project - `@testing-library/react` and the `@testing-library/dom` copy
    // that declares it resolve to different installations, which was measured rather than
    // assumed after the first run of this file failed with exactly that `TypeError`.
    for (const role of OPERABLE_ROLES) {
      expect(
        queryAllByRole(role as never),
        `the preview must expose no accessible element with role "${role}"`,
      ).toHaveLength(0);
    }
  });

  it("renders no interactive element, by markup", () => {
    const { container } = render(<ExtensionPreview />);

    for (const selector of OPERABLE_SELECTORS) {
      expect(
        container.querySelectorAll(selector),
        `the preview must contain no "${selector}"`,
      ).toHaveLength(0);
    }

    // **The region itself, not only the component.** If a future change moved the figure
    // outside `<ExtensionPreview>` and into `App.tsx`, these assertions would keep passing
    // while the shipped page grew a control.
    const region = document.querySelector('[data-region="extension"]');
    expect(region, "the region is rendered").not.toBeNull();
    for (const selector of OPERABLE_SELECTORS) {
      expect(
        region?.querySelectorAll(selector) ?? [],
        `the shipped region must contain no "${selector}"`,
      ).toHaveLength(0);
    }
  });

  it("announces the depiction as a figure, so it cannot read as the popup itself", () => {
    const { container } = render(<ExtensionPreview />);

    const figure = container.querySelector("figure.preview");
    expect(figure, "the depiction is a figure").not.toBeNull();

    const caption = figure?.querySelector("figcaption");
    expect(caption?.textContent).toBe(EXTENSION_PREVIEW.caption);

    // **Not `aria-hidden`.** Concealing the depiction would make the non-interactive check
    // pass by hiding the content from assistive technology rather than by the markup not
    // containing anything operable, and it would hide the labels from a reader entitled to
    // them. So this asserts the opposite of hidden.
    expect(figure?.hasAttribute("aria-hidden"), "the depiction is not concealed").toBe(false);
  });

  it("names no provider", () => {
    const { container } = render(<ExtensionPreview />);
    const text = container.textContent ?? "";

    // **Named, not implied.** The extension does reach two providers and says so in its own
    // popup; this page reaches one and `website-client` requires it to name no other. The
    // words are listed rather than derived from `ProviderManager`, because the rule is about
    // what a visitor reads and a provider renamed in a package would silently widen a list
    // that was checked by eye.
    expect(text, "the preview names no provider").not.toMatch(/mail\.tm|guerrilla/i);
  });
});
