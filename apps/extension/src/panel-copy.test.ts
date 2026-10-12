/**
 * The chooser's own sentences, which is a surface of its own inside the side panel.
 *
 * ## What this file is for
 *
 * `panel-copy.ts` gained three entries with the mailbox chooser, and this file holds the two claims
 * that are about **the sentences themselves** rather than about the panel that renders them:
 *
 * - **every declared entry resolves to real words** — a chooser entry renamed leaves a sweep reading
 *   nothing, and a sweep reading nothing satisfies every assertion above it for ever;
 * - **none of them names a host or a provider** — because `resolve-for-host.ts` decides which
 *   mailbox a host means, and an entry restating that rule's answer in a place the rule does not live
 *   is the second spelling `design.md` D3 exists to prevent.
 *
 * **This is the same class of case as the popup's *"names no host in the copy it offers"*
 * (`Panel.test.tsx:954`)**, and it is the one that would catch a chooser caption claiming a page.
 *
 * ## Why the sweep takes records rather than reading `PANEL_COPY` itself
 *
 * Because a negative control has to be able to hand it something. A sweep that reaches into the
 * copy object and returns a list can only be exercised with a **planted** value, and this repository
 * has recorded the defect that absence produces repeatedly: **a sweep matching nothing satisfies the
 * claim above it for ever**. So {@link chooserText} resolves an arbitrary record and
 * {@link hostOrProviderReports} reads an arbitrary list, and the case below plants a sentinel into
 * each direction and requires both to be reported by name.
 *
 * ## What the address argument is doing in the sweep
 *
 * **The address is removed before the hostname-shaped pattern runs, and that is the whole reason the
 * sweep can look for hostnames at all.** An address is host-shaped — `shadow@sharklasers.com` carries
 * a dotted domain — so a sweep matching `/[a-z0-9-]+(\.[a-z0-9-]+)+/` over the rendered text would
 * report every chooser entry in this file, and the honest repair would then be to exempt the address
 * by hand, which is an exemption with no rule behind it. Removing the exact address first makes the
 * pattern mean what it says: **a dotted host that is not the mailbox's own domain.**
 *
 * @module
 */

import { describe, expect, it } from "vitest";

import { PANEL_CHOOSER_KEYS, PANEL_COPY, PANEL_COPY_KEYS } from "./panel-copy";

/** The address every chooser sentence is resolved against, so a template is exercised for real. */
const ADDRESS = "shadow@sharklasers.com";

/** The host the panel is beside, which no chooser sentence may name. */
const HOST = "signup.example.test";

/** The providers a client can name, which no chooser sentence may name either. */
const PROVIDERS = ["Mail.tm", "Guerrilla Mail"] as const;

/** A provider name no sentence here carries, used to plant a violation the sweep must report. */
const SENTINEL_PROVIDER = "Sentinel Provider";

/** A host no sentence here carries, used the same way. */
const SENTINEL_HOST = "sentinel.invalid";

/** One resolved sentence, and the entry it came from. */
type ChooserText = { readonly key: string; readonly text: string };

/**
 * Resolve every declared chooser entry against one address.
 *
 * **A function entry is called rather than skipped**, which is the popup's `POPUP_COPY_TEMPLATES`
 * rule again: `Panel.tsx` substitutes when it renders, so an entry left unresolved here would be an
 * entry no assertion in this file reads.
 */
function chooserText(copy: Record<string, unknown>, address: string): ChooserText[] {
  return PANEL_CHOOSER_KEYS.map((key) => {
    const value = copy[key];

    return {
      key,
      text:
        typeof value === "function" ? (value as (given: string) => string)(address) : String(value),
    };
  });
}

/**
 * Report every chooser sentence that names a page or a provider.
 *
 * **Three ways and no more, and the third is the one that would catch a real caption.** A host
 * `signup.example.test` written into a chooser entry is caught by the word sweep only by accident —
 * it contains neither *host* nor *site* — so the specific host is checked by name, exactly as
 * `Panel.test.tsx:977` checks it. **A provider is caught by its own name**, because no provider name
 * contains the word *host* either.
 */
function hostOrProviderReports(
  entries: readonly ChooserText[],
  forbidden: {
    readonly host: string;
    readonly address: string;
    readonly providers: readonly string[];
  },
): string[] {
  return entries.flatMap(({ key, text }) => {
    /** The mailbox's own domain is not a claim about the page beside the panel. */
    const withoutAddress = text.split(forbidden.address).join("");
    const reasons: string[] = [];

    if (/host|site|domain/i.test(withoutAddress)) {
      reasons.push(`${key} names a page in words`);
    }

    const shaped = /[a-z0-9-]+(?:\.[a-z0-9-]+)+/i.exec(withoutAddress);
    if (shaped) {
      reasons.push(`${key} names the host ${shaped[0]}`);
    }

    if (text.includes(forbidden.host)) {
      reasons.push(`${key} names the page beside the panel, ${forbidden.host}`);
    }

    for (const provider of forbidden.providers) {
      if (text.includes(provider)) {
        reasons.push(`${key} names the provider ${provider}`);
      }
    }

    return reasons;
  });
}

describe("the chooser's own copy", () => {
  it("declares exactly the three entries the chooser renders, spelled out here", () => {
    // **The positive control**, and it is not decorative: a declaration emptied to nothing would
    // satisfy both sweeps below by resolving nothing.
    expect(PANEL_CHOOSER_KEYS.length).toBeGreaterThan(0);

    // **The list spelled literally, on this side rather than read back off the object.** A test that
    // compares the declaration to a value derived from the declaration moves with it, so a chooser
    // entry renamed would leave this file green while the sweep above reads a name that is not there.
    // `toEqual` on arrays is order-sensitive, so the expectation is sorted: a reordering of two
    // declarations is not a defect.
    expect([...PANEL_CHOOSER_KEYS].sort()).toEqual([
      "chooseMailbox",
      "heldGroup",
      "showingMailbox",
    ]);
  });

  it("declares no entry that the copy does not carry", () => {
    // **The other direction.** Without it, a typo in `PANEL_CHOOSER_KEYS` exempts an entry that is
    // not there while the real one is left unswept, and the case above would report both sides
    // agreeing about an exemption nothing earned.
    expect(PANEL_CHOOSER_KEYS.filter((key) => !PANEL_COPY_KEYS.includes(key))).toEqual([]);
  });

  it("resolves each declared entry to real words, and each template to a sentence carrying the address", () => {
    for (const { key, text } of chooserText(
      PANEL_COPY as unknown as Record<string, unknown>,
      ADDRESS,
    )) {
      expect(text.length, key).toBeGreaterThan(0);

      // **A template entry that dropped its parameter would still resolve to a non-empty string**, so
      // the length check above would pass while the chooser named no address at all. Each entry here
      // is read for the value it was given.
      if (key === "heldGroup") {
        expect(text).toBe(PANEL_COPY.heldGroup);
        // **The heading carries no address, and saying so is a claim rather than a tautology**: it is
        // what stops a heading that grew the address being read as a second copy of every entry.
        expect(text).not.toContain(ADDRESS);
      } else if (key === "chooseMailbox") {
        expect(text).toContain(ADDRESS);
        expect(text).not.toContain("{");
      } else {
        expect(text).toContain(ADDRESS);
        expect(text).not.toContain("{");
      }
    }
  });

  it("names no host and no provider in any of the chooser's sentences", () => {
    const entries = chooserText(PANEL_COPY as unknown as Record<string, unknown>, ADDRESS);
    const forbidden = { host: HOST, address: ADDRESS, providers: PROVIDERS };

    // **The claim, on the shipped copy.**
    expect(hostOrProviderReports(entries, forbidden)).toEqual([]);

    /**
     * **The negative controls, and there is one per direction — a sweep reporting nothing is
     * indistinguishable from a sweep that stopped working.**
     */
    const withProvider = entries.map((entry) =>
      entry.key === "chooseMailbox"
        ? { key: entry.key, text: `${entry.text} — via ${SENTINEL_PROVIDER}` }
        : entry,
    );
    expect(
      hostOrProviderReports(withProvider, { ...forbidden, providers: [SENTINEL_PROVIDER] }),
    ).toEqual([`chooseMailbox names the provider ${SENTINEL_PROVIDER}`]);

    const withHost = entries.map((entry) =>
      entry.key === "showingMailbox"
        ? { key: entry.key, text: `${entry.text} (${SENTINEL_HOST})` }
        : entry,
    );
    expect(hostOrProviderReports(withHost, forbidden)).toEqual([
      `showingMailbox names the host ${SENTINEL_HOST}`,
    ]);

    const withWord = entries.map((entry) =>
      entry.key === "heldGroup" ? { key: entry.key, text: `${entry.text} for this host` } : entry,
    );
    expect(hostOrProviderReports(withWord, forbidden)).toEqual(["heldGroup names a page in words"]);

    // **And the reader cannot pass for the wrong reason in the other direction either**: a reader
    // that returned every value would satisfy the first three controls and fail this one.
    expect(
      hostOrProviderReports(
        [{ key: "control", text: "Choose which address this panel shows" }],
        forbidden,
      ),
    ).toEqual([]);
  });

  it("carries no host and no provider in a chooser entry's own value, before any rendering", () => {
    /**
     * **The sweep above resolves through `chooserText`; this one reads the object.**
     *
     * They differ in one way that matters: {@link chooserText} substitutes an address it is handed,
     * so a caption that named the page **inside its template** — `"Show ${address} on this site"` —
     * would be caught by it. A caption that named a page **as a literal, in an entry that takes no
     * argument**, is caught here and would also be caught there, so this is belt-and-braces rather
     * than a second rule — **and the pair of assertions is what says there is exactly one
     * argument-free chooser entry**, so a fourth entry added as a bare string is reported by this
     * case rather than swept silently by the one above.
     */
    const literals = PANEL_CHOOSER_KEYS.filter((key) => typeof PANEL_COPY[key] === "string").map(
      (key) => ({ key, text: PANEL_COPY[key] as string }),
    );

    expect(literals.map((entry) => entry.key)).toEqual(["heldGroup"]);
    expect(
      hostOrProviderReports(literals, { host: HOST, address: ADDRESS, providers: PROVIDERS }),
    ).toEqual([]);
  });
});
