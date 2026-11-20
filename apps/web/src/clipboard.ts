/**
 * The one clipboard action both Copy controls call.
 *
 * The reference has a Copy button in the address pill and another in the action
 * toolbar. They are two pictures of one job, so they share this function rather
 * than each growing its own `navigator.clipboard.writeText` call — two spellings
 * of the same write would be the first thing to drift.
 */

/** Write an address to the platform clipboard. `false` means the platform refused. */
export async function copyAddressToClipboard(address: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(address);
    return true;
  } catch {
    // An expected refusal (permission, insecure context, unfocused document) is
    // reported as state by the caller, not thrown at the page.
    return false;
  }
}
