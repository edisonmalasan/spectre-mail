/**
 * The product's public name, as one value.
 *
 * ## Why this lives here and not in a client
 *
 * **The package's own module documentation decides it, and it is quoted rather than
 * paraphrased** — `index.ts` states the rule this value falls under:
 *
 * > *"Moving components into a shared package before anything needs them shared risks freezing
 * > an API shape no second client ever agreed to. Tokens are different: a palette is shared by
 * > definition and its interface is data, not behaviour."*
 *
 * **A product name is shared by definition** — two clients, four build inputs, eight rendering
 * surfaces — **and it is data rather than behaviour**, because it is a string. So the sentence that
 * defers *components* does not defer a *constant*, and the sentence that justifies putting the
 * palette here justifies putting the name beside it. That is the whole argument, and it is the
 * package's own rather than a preference made here.
 *
 * ## Why `packages/core` was considered and rejected
 *
 * `shared-domain-model`'s approved Purpose is explicit: *"This capability specifies the model and
 * its invariants only. It deliberately does not describe a provider adapter, an HTTP call, mailbox
 * lifecycle behaviour, or the mapping from a provider response onto these types."* **A brand name is
 * neither a model nor an invariant** — it is a string with no relationship to a mailbox, a message
 * or a credential — so putting it in `packages/core` would widen a capability that today constrains
 * the wire format, and would make a marketing string part of the dependency every client and every
 * provider adapter already takes for the type system.
 *
 * ## What this is not for
 *
 * **It is not a place to put copy that mentions the name.** `"Use SpectreMail"`,
 * `"SpectreMail could not read its own storage"` and `"Guerrilla Mail is asking SpectreMail to slow
 * down"` are sentences, they live in the copy modules that own them, and interpolating this value
 * into them would couple three correct strings to one rename for no gain. `docs/BRANDING.md`'s
 * surface table names the eight places the product names **itself**, which is a different and much
 * smaller set.
 *
 * ## Why the type is a literal and not widened
 *
 * **`as const` on the export keeps `typeof PRODUCT_NAME` equal to the string literal**, which is what
 * lets `PANEL_COPY`'s own `as const` preserve `title` as a literal type after this value is
 * substituted into it. Widening it to `string` would silently change a copy object's shape, and no
 * requirement would notice.
 *
 * @module
 */

/**
 * The product's public name — the one value every surface that names the product renders.
 *
 * **A published name is a single word, and `name.test.ts` requires that**, because a stray space is
 * a defect no other check in this repository would see: a document title reading `"SpectreMail "` is
 * invisible in a diff, invisible in a screenshot, and visible in every tab a person opens.
 */
export const PRODUCT_NAME = "SpectreMail";
