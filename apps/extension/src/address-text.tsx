/**
 * A mailbox address, with one break opportunity and only one: after its `@`.
 *
 * ## Why this is a component rather than two copies
 *
 * **The popup and the panel both render an address, and a break decided in two places is a
 * break that disagrees.** The panel's address and the popup's are the same value at the same
 * step — `surface-hierarchy` makes the address the largest datum on whichever surface shows it
 * — so one of the two would eventually be repaired and the other left splitting a domain.
 *
 * ## Why the break is required rather than preferred
 *
 * **A domain split across two lines is a domain a person copies wrong.** Measured on the built
 * popup before this change: at `--type-base` a 32-character Guerrilla address is about 307 px
 * in a 304 px content box, so the extension was already breaking mid-domain — the defect was
 * pre-existing, and raising the address to `--type-2xl` makes it certain rather than likely.
 * `overflow-wrap: anywhere` is what allows the break at all; this element is what puts it
 * where a reader can still read the address.
 *
 * ## `<wbr>` and not a zero-width space
 *
 * **A zero-width space is a character in the value.** It would be copied with the address and
 * pasted into a form that rejects it, which is the one failure this product's address handling
 * exists to prevent. `<wbr />` is a break opportunity with no character in the text content, so
 * the text a person takes is the address with nothing inserted and nothing removed.
 *
 * @module
 */

/**
 * The address, split so the line can break after the `@`.
 *
 * **`lastIndexOf` rather than `indexOf`**, for the reason `apps/web/src/Address.tsx` gives: an
 * address has one `@`, and if a malformed one carried two, the break belongs at the last one.
 * **An address with no `@` at all is rendered whole** — there is no break opportunity to offer,
 * and inventing one would put a split inside a value nothing else in the product understands.
 */
export function AddressText({ address }: { readonly address: string }) {
  const at = address.lastIndexOf("@");
  if (at === -1) {
    return <>{address}</>;
  }

  return (
    <>
      {address.slice(0, at + 1)}
      <wbr />
      {address.slice(at + 1)}
    </>
  );
}
