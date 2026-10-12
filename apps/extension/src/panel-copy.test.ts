/**
 * The chooser's own sentences, and the panel's own verdict wording.
 *
 * ## What this file is for
 *
 * `panel-copy.ts` gained three entries with the mailbox chooser and then one record with this
 * change, and this file holds the claims that are about **the sentences themselves** rather than
 * about the panel that renders them:
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
 * ## And now `PANEL_VERDICT_WORDING`, which carries a second class of claim
 *
 * **The panel is the only surface in this product allowed to state what a session found in a message
 * nobody has opened**, so this record's entries are held to three properties the chooser's are not:
 * they name a kind for **every** verdict and nothing that is not one; exactly one of them is
 * **empty**, and the empty one is `carriesNothing` rather than a verdict chosen for the absence;
 * and **none of them certifies what a message holds** — no percentage, no confidence, no claim that a
 * message carries no verification (`design.md` D6), and no word *pending* (`design.md` D1).
 *
 * **The last of those is a sweep over every entry in this module and not only over the new record**,
 * because the requirement the sweep discharges is about what **the panel** renders.
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

import * as panelCopy from "./panel-copy";
import {
  PANEL_CHOOSER_KEYS,
  PANEL_COPY,
  PANEL_COPY_KEYS,
  PANEL_VERDICT_WORDING,
} from "./panel-copy";

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

/**
 * ## The panel's verdict wording
 *
 * {@link PANEL_VERDICT_WORDING} is a different kind of claim from a chooser caption, and it is
 * held separately for three reasons.
 *
 * **It is the only place in this product that states what a session found in a message no person has
 * opened**, so its wording is the surface the delta's *"SHALL NOT render a confidence value, a
 * percentage, or a claim that a message carries no verification"* clause is about.
 *
 * **It is exhaustive over a shared union on purpose** (`design.md` D14), so the interesting failure
 * is a *missing* kind rather than a wrong one — and a missing kind is invisible to any test that
 * iterates the declaration it is checking. Hence the literal list below.
 *
 * **Exactly one entry is empty and it is `carriesNothing`**, because *"a message read and found to
 * carry none SHALL carry no marking"* is a decision this product makes rather than an absence, and
 * an absence is the thing a later reader cannot tell from an oversight.
 */

/** A provider's own words, so {@link PANEL_COPY.providerFailed} is exercised for real. */
const SENTINEL_REFUSAL = "It said no.";

/** The sample argument each position of a template entry is resolved with. */
const SAMPLES = [HOST, ADDRESS, SENTINEL_REFUSAL] as const;

/**
 * Every verdict kind, **spelled out here rather than read off the union or the declaration**.
 *
 * *The union is the compiler's business and this list is the test's own.* A kind added to
 * `MessageVerdict` fails the declaration's `Record` at compile time, which is the real instrument;
 * but a kind **removed**, or a key **spelled differently** and every consumer renamed with it, would
 * move the declaration and this list together - and then the case would report two things agreeing
 * about a shape nothing else fixes.
 */
const VERDICT_KINDS = [
  "carriesCode",
  "carriesCodeAndLink",
  "carriesLink",
  "carriesNothing",
  "undetermined",
] as const;

/**
 * One forbidden phrasing, with the sentence of the requirement it comes from.
 *
 * **A name and a pattern, never a bare pattern list**: a sweep reporting *which* forbidden claim and
 * *where* is a sweep a reader can act on, and a control that plants a phrase needs the name to
 * assert against.
 */
const FORBIDDEN = [
  {
    /** *"... a confidence value, a percentage, or ..."* - the percentage half. */
    name: "a percentage",
    pattern: /%/,
    /** A planted phrase that must be reported, and which entry it is planted into. */
    control: "Contains a one-time code, 90% sure.",
  },
  {
    /** The confidence half, as the words it could be written in. */
    name: "a confidence value",
    pattern: /\bcertain[a-z]*\b|\bconfiden[a-z]*\b/i,
    control: "Certainly contains a one-time code.",
  },
  {
    /**
     * *"or a claim that a message carries no verification"*, **phrased the way the requirement
     * phrases it** rather than as the substring `no verification`.
     *
     * **The narrowing is the requirement's own sentence, and it is recorded rather than smuggled.**
     * `PANEL_COPY.noLinks` reads *"No verification link was found in this message."*, so a bare
     * `/no verification/i` fires on **shipped copy this change does not touch** - and the honest
     * repair is then to exempt that one entry by hand, which is an exemption with no rule behind it.
     * What the clause forbids is a claim **about a message**, and this sentence is the parser's
     * report of what **it** found in one: the requirement's own explanation says the wording must
     * *"report what the session determined and never certify what the message holds"*, and a
     * sentence naming what a scan found is the first of those, not the second.
     *
     * **So the pattern names the certification shapes** - *carries no verification*, *contains no
     * verification*, *nothing to verify* - and a message-read report is not one of them. **The
     * arm in tasks.md 6.2 that this has to catch is *"the wording changed to 'no verification'"*, and
     * the control below is that arm verbatim**: it is planted as a verdict wording, so this pattern
     * is falsifiable in the exact place the arm names.
     */
    name: "a claim that the message carries no verification",
    pattern:
      /\b(?:carries|carry|carried|contains|contain)\s+no\s+(?:detected\s+)?verification\b|nothing\s+to\s+verify/i,
    control: "Carries no verification.",
  },
  {
    /**
     * *`design.md` D1* - the word is refused outright because *"pending"* names a state this product
     * never reaches and does not intend to.
     */
    name: "the word 'pending'",
    pattern: /\bpending\b/i,
    control: "A verification is pending.",
  },
] as const;

/** The wording record read as resolved sentences, keyed the way the sweep reports them. */
function wordingText(): ChooserText[] {
  return VERDICT_KINDS.map((kind) => ({
    key: `verdictWording.${kind}`,
    text: PANEL_VERDICT_WORDING[kind],
  }));
}

/**
 * Every sentence this module declares, resolved — **and that is the whole point of the function.**
 *
 * `panel-copy.test.ts`'s chooser sweep covers three keys of ~30. This requirement is about what the
 * **panel** renders, so the sweep below reads `PANEL_COPY_KEYS` rather than the chooser's list: a
 * verdict wording added to `PANEL_COPY` instead of to the record this change introduces would be
 * swept here and reported by name.
 *
 * Templates are called with fixed samples by position, so an entry that grew a second parameter
 * still resolves and is still swept.
 */
function everyPanelSentence(): ChooserText[] {
  /**
   * Widened through a `Record`, for the reason {@link chooserText} takes one as an argument:
   * `PANEL_COPY_KEYS` is `Object.keys(...)` and so is a `string[]`, and indexing the declared
   * shape with one would either need a cast the reader has to check or a narrowing that would
   * make the sweep **miss a value it could not type**.
   */
  const declared = PANEL_COPY as Readonly<Record<string, unknown>>;

  return PANEL_COPY_KEYS.map((key) => {
    const value = declared[key];

    return {
      key,
      text:
        typeof value === "function"
          ? (value as (...args: string[]) => string)(...(SAMPLES as readonly string[]))
          : String(value),
    };
  });
}

/**
 * Report every sentence matching one forbidden pattern, by name.
 *
 * **Read from a list rather than derived from {@link PANEL_COPY_KEYS},** so the arm that plants a
 * phrase is a case about the pattern rather than about the enumeration.
 */
function forbiddenPhrasingsReport(entries: readonly ChooserText[], pattern: RegExp): string[] {
  return entries.flatMap(({ key, text }) => {
    const found = pattern.exec(text);

    return found === null ? [] : [`${key} carries ${String(pattern)} in "${found[0]}"`];
  });
}

describe("the panel's verdict wording", () => {
  it("declares one entry for every verdict kind, and no entry that is not one", () => {
    // **The positive control**, and without it a record emptied to `{}` would satisfy both directions
    // below and every sweep that reads it.
    expect(VERDICT_KINDS.length).toBeGreaterThan(0);

    // **Spelled literally here, on this side.** `toEqual` on arrays is order-sensitive, so the
    // expectation is sorted: reordering five declarations is not a defect.
    expect([...VERDICT_KINDS].sort()).toEqual([...Object.keys(PANEL_VERDICT_WORDING)].sort());

    // **And the other direction, from the other side.** The assertion above compares two lists that
    // could both be wrong in the same way, so the record is also read directly for anything its
    // declared union does not name — a key added because a caller wanted a sixth row would be
    // reported here even if VERDICT_KINDS were widened to match it.
    expect(
      Object.keys(PANEL_VERDICT_WORDING).filter((key) => !VERDICT_KINDS.includes(key as never)),
    ).toEqual([]);
  });

  it("gives real words to every verdict but the one that must carry none", () => {
    for (const { key, text } of wordingText()) {
      if (key.endsWith("carriesNothing")) {
        // **The empty string asserted as `""` rather than as falsy**, so an entry changed to
        // `" "` satisfies neither this nor the sweep below — and the requirement's clause is about
        // there being *no marking*, which a blank paragraph would be.
        expect(text, key).toBe("");
      } else {
        expect(text.length, key).toBeGreaterThan(0);
      }
    }
  });

  it("names a code, a link, or both — and never both for a single detection", () => {
    // **The requirement's *"SHALL name which was detected rather than naming both"* clause, read
    // off the record rather than off the component.** It is here rather than only in `Panel.test.tsx`
    // because a component test proves the *panel* said it while this proves the *record* says it,
    // and the two are separately falsifiable: a component wired to the wrong key passes the
    // component test only if the wiring is right, and this one only if the record is.
    expect(PANEL_VERDICT_WORDING.carriesCode).toContain("one-time code");
    expect(PANEL_VERDICT_WORDING.carriesCode).not.toContain("verification link");
    expect(PANEL_VERDICT_WORDING.carriesLink).toContain("verification link");
    expect(PANEL_VERDICT_WORDING.carriesLink).not.toContain("one-time code");

    // **And both is both** — a check that only ever looked for "the other one absent" would be
    // satisfied by a record in which no entry names both at all.
    expect(PANEL_VERDICT_WORDING.carriesCodeAndLink).toContain("one-time code");
    expect(PANEL_VERDICT_WORDING.carriesCodeAndLink).toContain("verification link");
  });

  it("says what the session does not know and never what the message holds", () => {
    const undetermined = PANEL_VERDICT_WORDING.undetermined;

    // **Two claims the requirement's *"a message the session has not determined SHALL NOT be
    // presented as carrying a detection"* clause rests on**, and they are separate because they can
    // fail apart: a wording that said "we could not read it, but there is probably a code" fails
    // the second and passes the first.
    expect(undetermined).toMatch(/could not be read/i);

    /**
     * **A claim about what the message holds, and not merely the word *carries*.**
     *
     * *The first version of this assertion was `/\b(?:contains?|carries?|has)\b/i` and it **failed on
     * the shipped wording**, which reads *"so what it carries is unknown"* — the phrase is the
     * requirement's own way of putting it, and the assertion was reading a **claim** as though it
     * were a **verb**. `state.ts`'s docstring makes the same point about collapsing `undetermined`
     * into a negative being *"the one false claim in this product that costs a user the code they
     * were waiting for"*, so what is forbidden is naming a detection and hedging about it, not the
     * word.
     */
    expect(undetermined).not.toMatch(
      /\b(?:contains?|carries|carrying|has|holds?)\s+(?:a\s+|an\s+|the\s+)?(?:detected\s+)?(?:one[- ]time\s+)?(?:code|verification\s+link)\b/i,
    );
    expect(undetermined).not.toMatch(/\b(?:probably|likely|perhaps|appears?\s+to|seems?\s+to)\b/i);
  });

  it("carries no forbidden phrasing, in the wording or in any sentence this module declares", () => {
    /**
     * **The claim, on the shipped copy — the wording record and every `PANEL_COPY` entry.**
     *
     * {@link everyPanelSentence} exists so the sweep's scope is the module rather than the new
     * record: the requirement is about what the **panel** renders, and a verdict wording declared as
     * a `PANEL_COPY` entry is still a sentence the panel renders.
     */
    const shipped = [...wordingText(), ...everyPanelSentence()];

    // **The positive control for the enumeration itself**: without it, `PANEL_COPY_KEYS` emptied
    // would leave a sweep over four wording entries that reads exactly the same.
    expect(shipped.length).toBeGreaterThan(wordingText().length);

    for (const { name, pattern } of FORBIDDEN) {
      expect(forbiddenPhrasingsReport(shipped, pattern), name).toEqual([]);
    }

    /**
     * **One negative control per pattern, planted into a verdict wording and planted into a panel
     * sentence in turn — and each asserted by name.**
     *
     * **Two plants per pattern, because one reader and two sources are two sweeps.** A control
     * planted only into the record would be satisfied by a pattern that reads only the record, and a
     * control planted only into `PANEL_COPY` only by one that reads only that. Each is asserted for
     * exactly the key it was planted into, so a reader that returned *every* entry cannot pass the
     * claim above it for the wrong reason either.
     */
    for (const { name, pattern, control } of FORBIDDEN) {
      const inWording = wordingText().map((entry) =>
        entry.key === "verdictWording.carriesCode" ? { ...entry, text: control } : entry,
      );
      expect(forbiddenPhrasingsReport(inWording, pattern), name).toEqual([
        expect.stringContaining("verdictWording.carriesCode"),
      ]);

      const inPanelCopy = everyPanelSentence().map((entry) =>
        entry.key === "heldGroup" ? { ...entry, text: `${entry.text} ${control}` } : entry,
      );
      expect(forbiddenPhrasingsReport(inPanelCopy, pattern), name).toEqual([
        expect.stringContaining("heldGroup"),
      ]);
    }
  });

  it("exports nothing that could become a second table of what counts as a detection", () => {
    /**
     * **The website's `CARRIES_VERIFICATION` is deliberately not ported** (`design.md` D14), and this
     * is the case that makes its absence a decision rather than an oversight.
     *
     * **Asserted over the module's own export list**, because that is the only surface a port could
     * arrive on: a closed set of positive kinds copied here would be a second thing to keep in step
     * with the union, with no consumer until someone gives the panel's rows an accent rule.
     */
    expect(Object.keys(panelCopy).sort()).toEqual([
      "PANEL_CHOOSER_KEYS",
      "PANEL_COPY",
      "PANEL_COPY_KEYS",
      "PANEL_VERDICT_WORDING",
    ]);
  });

  it("adds no chooser key", () => {
    /**
     * **tasks.md 2.2's "byte-identical", asserted rather than asserted-about.**
     *
     * **The list is spelled literally**, so a fourth key added here is reported by this case; the
     * count is not compared against itself. And the second direction: a key removed from
     * `PANEL_CHOOSER_KEYS` while remaining in `PANEL_COPY` would leave the chooser sweep reading one
     * entry fewer and passing — which is the same shape as a sweep matching nothing.
     */
    expect([...PANEL_CHOOSER_KEYS].sort()).toEqual([
      "chooseMailbox",
      "heldGroup",
      "showingMailbox",
    ]);
    expect(PANEL_CHOOSER_KEYS.filter((key) => !PANEL_COPY_KEYS.includes(key))).toEqual([]);
  });
});
