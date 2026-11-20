/**
 * The light action strip below the hero, in the reference's order.
 *
 * Each control is real: Copy writes the address, Refresh asks the provider to
 * check the inbox again, Change replaces the address, and Delete clears what this
 * device remembers. The icons are inline SVG so the page requests no image file,
 * and they inherit `currentColor` so no second set of colour tokens is needed.
 *
 * @module
 */

export interface ActionToolbarProps {
  readonly onCopy: () => void;
  readonly onRefresh: () => void;
  readonly onChange: () => void;
  readonly onDelete: () => void;
}

function Icon({ kind }: { readonly kind: "copy" | "refresh" | "change" | "delete" }) {
  if (kind === "copy") {
    return (
      <svg className="toolbar__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <rect
          x="8"
          y="8"
          width="12"
          height="12"
          rx="2"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path
          d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
      </svg>
    );
  }
  if (kind === "refresh") {
    return (
      <svg className="toolbar__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path
          d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (kind === "change") {
    return (
      <svg className="toolbar__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path
          d="M12 3a5 5 0 0 0-5 5c0 3 5 9 5 9s5-6 5-9a5 5 0 0 0-5-5Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path d="M10 8h4M10 11h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg className="toolbar__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M6 6l12 12M18 6L6 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ActionToolbar({ onCopy, onRefresh, onChange, onDelete }: ActionToolbarProps) {
  return (
    <div className="toolbar">
      <div className="toolbar__actions" data-testid="toolbar">
        <button
          type="button"
          className="toolbar__button"
          onClick={onCopy}
          data-testid="toolbar-copy"
        >
          <Icon kind="copy" />
          <span>Copy</span>
        </button>
        <button
          type="button"
          className="toolbar__button"
          onClick={onRefresh}
          data-testid="toolbar-refresh"
        >
          <Icon kind="refresh" />
          <span>Refresh</span>
        </button>
        <button
          type="button"
          className="toolbar__button"
          onClick={onChange}
          data-testid="toolbar-change"
        >
          <Icon kind="change" />
          <span>Change</span>
        </button>
        <button
          type="button"
          className="toolbar__button"
          /* The visible label is "Delete", so the accessible name must contain it
             (WCAG 2.5.3 Label in Name) and also say what is cleared. "Delete" and
             "Clear saved data" are both substrings, so voice control and role
             queries in both tiers keep matching the same control. */
          aria-label="Delete: Clear saved data"
          onClick={onDelete}
          data-testid="toolbar-delete"
        >
          <Icon kind="delete" />
          <span>Delete</span>
        </button>
      </div>
    </div>
  );
}
