/**
 * The reference's empty-inbox state: a circular envelope illustration above two
 * lines of mono copy. It is a picture, not a control — nothing here can be pressed.
 *
 * @module
 */

export function EmptyInboxArt() {
  return (
    <svg className="empty-inbox__art" viewBox="0 0 160 160" aria-hidden="true" focusable="false">
      <circle className="empty-inbox__ring" cx="80" cy="80" r="52" />
      <path className="empty-inbox__arrow" d="M119 48a52 52 0 0 1 9 39" />
      <path className="empty-inbox__arrow" d="M41 112a52 52 0 0 1-9-39" />
      <rect className="empty-inbox__envelope" x="52" y="60" width="56" height="40" rx="4" />
      <path className="empty-inbox__flap" d="M52 64l28 20 28-20" />
    </svg>
  );
}
