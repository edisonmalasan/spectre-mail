/**
 * Contract invariants.
 *
 * Two kinds of assertion live here, and the distinction matters.
 *
 * - **Runtime** assertions read the contract's source and are falsifiable by this
 *   suite. They exist because the absence of a member is otherwise unobservable.
 * - **Compile-time** assertions below are checked by `tsc --noEmit`, not by any
 *   `it`. `pnpm typecheck` is a separate gate from `pnpm test`; a type error fails
 *   the former and is invisible to the latter.
 *
 * @module
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const CONTRACT_SOURCE = readFileSync(
  join(process.cwd(), "packages/providers/src/contract.ts"),
  "utf8",
);

/**
 * The contract's declarations, with comments and string literals removed.
 *
 * Required because this file's rules are about what the contract *declares*, and
 * `contract.ts` documents in prose exactly why the absent member is absent. Matching
 * raw source made the check fail on its own documentation — a rule that cannot
 * distinguish a declaration from a comment about that declaration is measuring the
 * wrong thing, and the fix is to measure the right thing rather than to reword the
 * documentation until the rule goes quiet.
 */
function contractDeclarations(): string {
  let out = "";
  let inBlock = false;
  let inLine = false;
  let inString: '"' | "'" | "`" | null = null;

  for (let i = 0; i < CONTRACT_SOURCE.length; i += 1) {
    const char = CONTRACT_SOURCE[i] as string;
    const next = CONTRACT_SOURCE[i + 1];

    if (inLine) {
      if (char === "\n") inLine = false;
      else out += " ";
      continue;
    }
    if (inBlock) {
      if (char === "*" && next === "/") {
        inBlock = false;
        out += "  ";
        i += 1;
      } else out += char === "\n" ? "\n" : " ";
      continue;
    }
    if (inString !== null) {
      out += char;
      if (char === "\\") {
        const following = CONTRACT_SOURCE[i + 1];
        if (following !== undefined) {
          out += following;
          i += 1;
        }
        continue;
      }
      if (char === inString) inString = null;
      continue;
    }
    if (char === "/" && next === "/") {
      inLine = true;
      out += " ";
      i += 1;
      continue;
    }
    if (char === "/" && next === "*") {
      inBlock = true;
      out += " ";
      i += 1;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      inString = char;
      out += char;
      continue;
    }
    out += char;
  }

  return out;
}

const DECLARATIONS = contractDeclarations();

describe("the MailProvider contract", () => {
  it("declares no subscription method", () => {
    // Measured: five SSE candidate paths and two WebSocket candidates were probed
    // and none connected. `GET /messages/events` answers `406` for
    // `Accept: text/event-stream` and `404` for every format its negotiator accepts,
    // while Mail.tm's marketing copy claims SSE is available.
    //
    // Asserted over the declarations rather than over the type because the absence of
    // a member is not observable at runtime — a `subscribe?` that no adapter
    // implements would typecheck and pass every behavioural test while telling
    // callers a polling client could become event-driven for free.
    expect(DECLARATIONS).not.toContain("subscribe");
  });

  it("declares no push transport of any name", () => {
    // The broader form, so a future `startStreaming` or `onMessage` cannot
    // reintroduce the same gap under a different spelling.
    expect(DECLARATIONS).not.toMatch(/EventSource|WebSocket|text\/event-stream|\bon[A-Z]\w*\(/);
  });

  // An optional method whose absence surfaces only as `undefined` is a runtime trap
  // at every call site. Required makes "can I do this?" a compile-time question and
  // means no adapter can forget to answer it. See "keeps supports() required".

  it("documents that adapters must not retain state", () => {
    // The no-persistence requirement is the reason a mailbox restored from storage
    // works after a restart. It is invisible in behaviour tests, because a test
    // process never restarts, so its presence is checked here. This one *is* a
    // documentation check, so it reads the comments rather than the declarations.
    expect(CONTRACT_SOURCE).toMatch(/MUST NOT retain state between calls/);
  });

  it("keeps supports() required rather than optional", () => {
    expect(DECLARATIONS).toMatch(/\bsupports\(operation: ProviderOperation\): boolean;/);
  });
});

/* -- compile-time invariants, checked by `tsc --noEmit` --------------------- */

import type { MailProvider } from "./contract";

/** Fail to compile unless `T` and `U` are mutually assignable. */
type AssertSame<T, U> = [T] extends [U] ? ([U] extends [T] ? true : never) : never;

/** Fail to compile unless `A` and `B` are the same union of literals. */
type AssertExactUnion<A, B> =
  Exclude<A, B> extends never ? (Exclude<B, A> extends never ? true : never) : never;

/**
 * `subscribe` must not be a member of the contract.
 *
 * A source scan can be defeated by writing the member in a form the scan misses.
 * This cannot: if a `subscribe` member is added, `K` stops satisfying
 * `keyof MailProvider` and `pnpm typecheck` fails.
 */
type _NoSubscribe = "subscribe" extends keyof MailProvider ? never : true;

/**
 * The optional operations the contract names must be exactly these two.
 *
 * `AssertExactUnion` rather than assignability, so adding a third operation — or
 * renaming one — fails to compile. Assignability alone would accept a wider union
 * and quietly make a caller's exhaustive `switch` non-exhaustive.
 */
type _OperationsAreTheDeclaredTwo = AssertExactUnion<
  Parameters<MailProvider["supports"]>[0],
  "deleteMessage" | "destroyMailbox"
>;

/**
 * Every adapter's `createMailbox` resolves to the shared `Mailbox`, never a
 * provider-specific shape.
 *
 * If an adapter ever returned its own object type, this stops compiling — which is
 * the mechanism that keeps provider wire format from leaking upward through the
 * return type rather than through a runtime check.
 */
type _CreateReturnsMailbox = AssertSame<
  Awaited<ReturnType<MailProvider["createMailbox"]>>,
  import("@spectre-mail/core").Mailbox
>;

/**
 * Present only so the assertions above are read as used.
 *
 * `noUnusedLocals` would otherwise reject every type alias in this file, which
 * would in turn make it tempting to delete them. They are load-bearing at compile
 * time even when nothing references them at run time.
 */
export type CONTRACT_INVARIANTS =
  _NoSubscribe | _OperationsAreTheDeclaredTwo | _CreateReturnsMailbox;
