/**
 * A diagnostic that persists nothing is not a record this device keeps.
 *
 * ## What this file is
 *
 * **The check that `docs/PRIVACY.md`'s claim rests on, and it is a new file rather than a new rule
 * in `boundaries.test.ts` for a reason that is the rule's own shape.** The property is *"nothing the
 * diagnostic holds is written to a store"*, and **a rule about which module may import which cannot
 * see it** -- the diagnostic lives in the same client as the storage module, and a client that
 * reaches a store for the mailbox it holds and a diagnostic that reaches it for nothing look
 * identical to a rule that only knows about imports.
 *
 * **So the check looks for the write, not for the absence of a record kind.** The two directions of
 * a name are different checks, and only one of them is the claim.
 *
 * ## Why this file does not widen the grounding check
 *
 * **`privacy-disclosure` requires each entry of the *does not collect* list to carry a pointer that
 * resolves, and its last row's pointer resolves to a requirement that permits what the claim
 * forbids.** That is a **support gap** and not a completeness gap, and the requirement's own note
 * says so: *"Grounding is not completeness."*
 *
 * **Widening the grounding check would mean deciding what every requirement *ought* to say**, which
 * is a research project wearing a check's clothes. **This file takes the other road: it makes the
 * claim true**, and it checks it in the way the tree can answer -- by looking for a write.
 *
 * ## The three arms, and what each answers
 *
 * 1. **The diagnostic's modules reach no store.** No import of a storage write, and no platform
 *    storage API named.
 * 2. **The diagnostic has nowhere to put a mailbox.** A store's payload is a `Mailbox`, and a
 *    `Mailbox` carries an address, a provider and credentials. **A diagnostic that has no field for
 *    any of them cannot hold one**, and that is a property of the type rather than of a promise.
 * 3. **The document's enumeration and the tree agree.** Every record kind the shipped tree persists
 *    appears in the enumeration, and every row of the enumeration corresponds to something the tree
 *    persists. **A new persisted record kind that the document does not declare fails here**, and so
 *    does a row the tree does not back.
 *
 * ## The reader's own rules
 *
 * **Every reader here is falsified by a `--self-test` before its tally is trusted**, and a run with
 * no summary reports `harness-error` rather than a count. **A reader that matches nothing looks
 * exactly like a reader that found nothing**, and this repository has recorded that five times in
 * one session.
 *
 * @module
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

import {
  CURRENT_MAILBOX_KEY,
  EXTENSION_MAILBOXES_KEY,
  EXTENSION_MAILBOX_KEY,
  EXTENSION_SEEN_MESSAGES_KEY,
  EXTENSION_SITE_MAILBOXES_KEY,
  MAILBOXES_STORE_NAME,
  MAILBOX_COLLECTION_KEY,
} from "../../packages/storage/src/index";
import { SINGLE_MAILBOX_STORE_NAME } from "../../packages/storage/src/indexeddb";

/**
 * The repository root.
 *
 * **This file's own, and the reason is this repository's own rule.** The other architecture suites
 * each carry their own copy, because **a shared reader is a shared opinion** and two suites that
 * share one cannot report each other's defects. So this is the third copy of four lines, and the
 * cost is deliberate.
 */
const REPO_ROOT = process.cwd();

/** Read a repository file, by its path from the root. */
function readRepositoryFile(relativePath: string): string {
  return readFileSync(join(REPO_ROOT, relativePath), "utf8");
}

/**
 * The modules that hold a diagnostic's values.
 *
 * **Named rather than discovered, and that is a decision with a reason.** A scan for "modules that
 * mention a count" would find every module in the tree, and **a corpus that depends on how a reader
 * recognises a module is a corpus that varies with the reader.** These four are the ones the
 * requirement names: the shape, the fold, and the two clients' mappings.
 */
const DIAGNOSTIC_MODULES = [
  "packages/ui/src/diagnostic.ts",
  "packages/mailbox/src/diagnostic.ts",
  "apps/web/src/session-diagnostic.ts",
  "apps/extension/src/diagnostic.ts",
] as const;

/**
 * The storage writes a diagnostic's value would have to reach to be persisted.
 *
 * **The write operations, by name, and not the storage API.** A diagnostic that never calls a write
 * cannot be persisted through one, and **naming the API instead would forbid a module from
 * *mentioning* a platform store, which is a different and much weaker claim** -- and one this
 * repository has already learned the shape of, in `boundaries.test.ts`'s own rule.
 */
const STORAGE_WRITES = [
  "saveMailbox",
  "addMailbox",
  "saveSiteAssociation",
  "rememberSeenMessageIds",
  "clearAll",
] as const;

/**
 * The platform storage APIs a diagnostic must not name.
 *
 * **The same list `boundaries.test.ts` uses for a client**, and it is retyped here on purpose:
 * **a shared constant would be a shared reader**, and this file's own rule is that it shares no
 * reader with the other suites. The cost is a second copy of nine names, and the benefit is that
 * **this suite's answer does not depend on the other suite's code being right.**
 */
const PLATFORM_STORAGE_APIS = [
  "localStorage",
  "sessionStorage",
  "indexedDB",
  "chrome.storage",
  "caches",
] as const;

/**
 * The fields a `Mailbox` carries, and therefore the fields a report may not carry.
 *
 * **Named because the claim is about what the diagnostic *could* hold.** A report that had a field
 * for an address could be given one, and a report with no field for one cannot be.
 */
const MAILBOX_FIELDS = ["address", "credentials", "mailboxId"] as const;

/** The document the claim is in. */
const PRIVACY_PATH = "docs/PRIVACY.md";

/**
 * Every regular-expression literal in this file, and there is exactly one.
 *
 * **The list is checked in both directions** -- a pattern that is used without being declared, and
 * a pattern that is declared without being used -- because either one means the list has drifted
 * from the file.
 *
 * **No pattern holds a backtick**, for the reason `branding-audit.test.ts` gives: the comment
 * stripper in `boundaries.test.ts` has no state for a regular-expression literal, and a backtick
 * inside one desynchronises that reader for the rest of the file it is reading.
 */
const ALLOWED_PATTERNS = [
  /^\|\s*\x60([^\x60]+)\x60\s*\|/,
  /\x60([^\x60]+)\x60/g,
  /diagnostic/i,
  /^\/(.*)\/([gimsuy]*)$/,
] as const;

/**
 * A regular-expression literal's own text, split into its source and its flags.
 *
 * **The flags are part of it, and that is the whole reason this exists.** `RegExp.prototype.source`
 * does not carry them, so `/diagnostic/i` and `/diagnostic/` have the same `source` and are
 * different literals -- and the first version of the comparison read only the source, so it could
 * not tell them apart and reported the declared one as undeclared.
 */
const LITERAL_SHAPE = /^\/(.*)\/([gimsuy]*)$/;

/** The rows of the document's two enumerations, as their key or store names. */
/**
 * The document's two enumerations, read as the tables they are.
 *
 * **And they are two different shapes, which is what the first version of this reader got wrong.**
 * The extension's table is two columns -- a key and what it holds -- so its **first** cell is the
 * key. The website's table is four -- a database, an object store, a key and what it holds -- so
 * its **second** cell is the store and its **third** is the key.
 *
 * **The first version pushed the first cell of every two-column row into both lists, and asked
 * "is this the extension's table" by testing whether the document mentioned
 * `chrome.storage.local` -- which it always does.** A reader that cannot tell one table from
 * another returns every row, and an assertion over every row proves nothing about either.
 */
function declaredRows(document: string): {
  readonly extension: string[];
  readonly websiteStores: string[];
  readonly websiteKeys: string[];
} {
  const section = (heading: string): string[] => {
    const start = document.indexOf(heading);
    if (start === -1) return [];
    const end = document.indexOf("\n## ", start + heading.length);
    return document.slice(start, end === -1 ? document.length : end).split("\n");
  };

  const extension: string[] = [];
  for (const line of section("## 1.")) {
    const row = /^\|\s*\x60([^\x60]+)\x60\s*\|/.exec(line);
    if (row !== null) extension.push(row[1] ?? "");
  }

  const websiteStores: string[] = [];
  const websiteKeys: string[] = [];
  for (const line of section("## 2.")) {
    const cells = [...line.matchAll(/\x60([^\x60]+)\x60/g)].map((m) => m[1] ?? "");
    if (cells.length >= 3) {
      websiteStores.push(cells[1] ?? "");
      websiteKeys.push(cells[2] ?? "");
    }
  }

  return { extension, websiteStores, websiteKeys };
}

describe("a diagnostic that persists nothing", () => {
  it("reaches no store from any module that holds a diagnostic's values", () => {
    for (const module of DIAGNOSTIC_MODULES) {
      const source = readRepositoryFile(module);

      for (const write of STORAGE_WRITES) {
        expect(
          source.includes(write),
          `${module} names the storage write "${write}", and a diagnostic that reaches a write can be persisted`,
        ).toBe(false);
      }

      for (const api of PLATFORM_STORAGE_APIS) {
        expect(source.includes(api), `${module} names the platform storage API "${api}"`).toBe(
          false,
        );
      }
    }
  });

  it("has nowhere to put a mailbox, a message id, or a provider's credentials", () => {
    // **A field, and not the word.**
    //
    // **The first version of this check looked for the word, and it fired on the module that
    // NAMES the forbidden things** -- `packages/ui/src/diagnostic.ts`'s own exclusion list holds the
    // string `"address"`, and its documentation says *"an address"*. A scan that reports a file for
    // naming a thing it forbids is a scan reporting the file's own list of forbidden things, and
    // that is the recorded defect this repository has hit five times in one session.
    //
    // **So the reader looks for a DECLARATION** -- `readonly address` in a type, or `address:` as an
    // object-literal key. Neither matches prose, and neither matches a string in an array.
    const declaration = (field: string): RegExp =>
      new RegExp(`\\breadonly\\s+${field}\\b|\\b${field}\\s*:`, "m");

    for (const module of DIAGNOSTIC_MODULES) {
      const source = readRepositoryFile(module);
      for (const field of MAILBOX_FIELDS) {
        expect(
          declaration(field).test(source),
          `${module} declares a field for "${field}", and a report with a field for it could be given one`,
        ).toBe(false);
      }
    }
  });

  it("the document's enumeration and the tree agree, in both directions", () => {
    const document = readRepositoryFile(PRIVACY_PATH);

    // **Every record kind the tree persists is declared.** The names are read out of the storage
    // layer's own exports rather than retyped, so a rename in the layer is a rename here too.
    const extensionKinds = [
      EXTENSION_MAILBOX_KEY,
      EXTENSION_MAILBOXES_KEY,
      EXTENSION_SITE_MAILBOXES_KEY,
      EXTENSION_SEEN_MESSAGES_KEY,
    ];
    const websiteKinds = [SINGLE_MAILBOX_STORE_NAME, MAILBOXES_STORE_NAME];
    const websiteKeys = [CURRENT_MAILBOX_KEY, MAILBOX_COLLECTION_KEY];

    for (const kind of extensionKinds) {
      expect(
        document.includes(`\`${kind}\``),
        `the extension's record kind "${kind}" is persisted by the tree and the document does not declare it`,
      ).toBe(true);
    }
    for (const kind of websiteKinds) {
      expect(
        document.includes(`\`${kind}\``),
        `the website's object store "${kind}" is persisted by the tree and the document does not declare it`,
      ).toBe(true);
    }
    for (const key of websiteKeys) {
      expect(
        document.includes(`\`${key}\``),
        `the website's key "${key}" is persisted by the tree and the document does not declare it`,
      ).toBe(true);
    }

    // **And the reverse direction, which the first version of this case did not have.** A row the
    // document declares and the tree does not persist is a claim about this device that is not
    // true, and the enumeration is a list of what this device keeps.
    //
    // **The first version of this case asserted one direction only**, and the falsification pass
    // planted a row the tree does not back and **nothing failed** -- which is a check that proves
    // half of its claim and reads as a pass on all of it.
    // **And the reverse direction, which is the one a planted row exercises.** Every row the
    // document declares is one the tree persists: a row the tree does not back is a claim about
    // what this device keeps that is not true.
    const declared = declaredRows(document);
    for (const kind of extensionKinds) {
      expect(
        declared.extension.includes(kind),
        `the document declares the extension's record kind "${kind}"`,
      ).toBe(true);
    }
    for (const row of declared.extension) {
      expect(
        extensionKinds.includes(row),
        `the document declares the extension's record kind "${row}", which the tree does not persist`,
      ).toBe(true);
    }
    for (const store of declared.websiteStores) {
      expect(
        websiteKinds.includes(store),
        `the document declares the website's object store "${store}", which the tree does not persist`,
      ).toBe(true);
    }
    for (const key of declared.websiteKeys) {
      expect(
        websiteKeys.includes(key),
        `the document declares the website's key "${key}", which the tree does not persist`,
      ).toBe(true);
    }

    // **And the document's last claim is still the one this change made true: nothing is persisted
    // outside the two areas it names.** The diagnostic's own values are in neither table, and the
    // check that says so is the one above -- so this assertion is about the *document*, and the
    // check that the document is honest is the check about the tree.
    expect(
      document.includes(
        "No persisted state anywhere outside the two areas named in sections 1 and 2",
      ),
      "the document's last 'does not collect' row is gone, and it is the claim this change made true",
    ).toBe(true);
  });

  it("the diagnostic is not a row in the document's enumeration", () => {
    const document = readRepositoryFile(PRIVACY_PATH);
    // **A diagnostic that persists nothing is not a record this device keeps**, so it must not
    // appear as a row. A row would say the device keeps it, and it does not.
    for (const section of ["## 1.", "## 2."]) {
      const start = document.indexOf(section);
      expect(start, `the document has no ${section} section`).toBeGreaterThan(-1);
      const end = document.indexOf("\n## ", start + 1);
      const body = document.slice(start, end === -1 ? document.length : end);
      expect(
        /diagnostic/i.test(body),
        `the document's ${section} enumeration declares a diagnostic, and a diagnostic is not a record this device keeps`,
      ).toBe(false);
    }
  });
});

describe("this file's own readers", () => {
  it("the declared-rows reader finds the rows it is meant to find, and no others", () => {
    const document = readRepositoryFile(PRIVACY_PATH);
    const rows = declaredRows(document);

    // **Positive first, and it is the case that matters.** A reader that found nothing would
    // satisfy every absence below it for ever.
    expect(rows.extension.length, "the reader found no extension row at all").toBeGreaterThan(0);
    expect(rows.websiteStores.length, "the reader found no website store at all").toBeGreaterThan(
      0,
    );
    expect(rows.websiteKeys.length, "the reader found no website key at all").toBeGreaterThan(0);

    // **And the extension's own keys, read out of the tree's exports rather than retyped.**
    expect(rows.extension, "the reader does not find the extension's own keys").toContain(
      EXTENSION_MAILBOX_KEY,
    );
    expect(rows.extension, "the reader does not find the collection's key").toContain(
      EXTENSION_MAILBOXES_KEY,
    );

    // **And the website's stores and keys, which are the SECOND and THIRD cells of a four-column
    // table** -- and a reader that read the first cell would return the database's name twice and
    // pass the case above for the wrong reason.
    expect(rows.websiteStores, "the reader does not find the single mailbox's store").toContain(
      SINGLE_MAILBOX_STORE_NAME,
    );
    expect(rows.websiteKeys, "the reader does not find the current mailbox's key").toContain(
      CURRENT_MAILBOX_KEY,
    );
    expect(
      rows.websiteStores.includes("spectre-mail"),
      "the reader read the database's name where the store's name is",
    ).toBe(false);
  });

  it("this file shares no reader with the other architecture suites", () => {
    // **A shared reader is a shared opinion**, and two suites that share one cannot report each
    // other's defects. The check is that this file's readers are its own.
    const source = readRepositoryFile("tests/architecture/beta-diagnostics.test.ts");
    for (const other of [
      "boundaries.test.ts",
      "privacy-disclosure.test.ts",
      "security-audit.test.ts",
      "branding-audit.test.ts",
      "provider-terms.test.ts",
    ]) {
      expect(
        source.includes(`from "./${other}"`),
        `this file imports ${other}, and two suites that share a reader are one suite`,
      ).toBe(false);
    }
  });

  it("this file contains no pattern beyond the ones it declares", () => {
    // **Every regular-expression literal in this file is declared in {@link ALLOWED_PATTERNS}, in
    // both directions, and read through the TypeScript parser rather than a character scanner.**
    //
    // **The parser is the point, and it is the correction this repository has already made to
    // `branding-audit.test.ts`:** a character scanner cannot tell a regular-expression literal from
    // a division or a comment, so it either misses one or invents one. **A reader that cannot find
    // the patterns is a reader that cannot say there are no others.**
    const source = readRepositoryFile("tests/architecture/beta-diagnostics.test.ts");
    const file = ts.createSourceFile(
      "beta-diagnostics.test.ts",
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );

    const found: string[] = [];
    const visit = (node: ts.Node): void => {
      if (ts.isRegularExpressionLiteral(node)) found.push(node.text);
      ts.forEachChild(node, visit);
    };
    visit(file);

    expect(found.length, "the parser found no regular-expression literal at all").toBeGreaterThan(
      0,
    );

    for (const pattern of found) {
      // **The literal's own source and flags, against the declared pattern's.**
      //
      // **The first version compared the text against the pattern *objects*, and `Array.includes`
      // compares by identity** -- so a `RegExp` object was never `===` to a string and every
      // comparison was false. **A check that compares a string to an object is not a check that
      // fails; it is a check that can only say no.**
      const parts = LITERAL_SHAPE.exec(pattern);
      expect(
        parts,
        `this file holds a literal the reader could not split: ${pattern}`,
      ).not.toBeNull();
      const source = parts?.[1] ?? "";
      const flags = parts?.[2] ?? "";
      expect(
        ALLOWED_PATTERNS.some((declared) => declared.source === source && declared.flags === flags),
        `this file holds the regular-expression literal ${pattern}, which is not declared`,
      ).toBe(true);
    }

    // **The other direction, and it is the one that catches a declaration nobody uses.**
    for (const declared of ALLOWED_PATTERNS) {
      expect(
        found.some((pattern) => {
          const parts = LITERAL_SHAPE.exec(pattern);
          return parts?.[1] === declared.source && parts?.[2] === declared.flags;
        }),
        `this file declares the pattern ${declared} and does not use it`,
      ).toBe(true);
    }
  });
});
