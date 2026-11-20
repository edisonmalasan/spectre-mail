/**
 * A small domain picker for the Change flow.
 *
 * The list is never authored here: it is the catalog's current answer, i.e. domains
 * a provider actually reported and can create a mailbox on. With no domains the
 * picker offers automatic selection and says why no list is available, rather than
 * inventing names or hinting at a provider this build cannot reach.
 *
 * @module
 */

import type { Domain } from "@spectre-mail/core";

export interface DomainPickerProps {
  readonly domains: readonly Domain[];
  readonly onAutomatic: () => void;
  readonly onSelect: (domain: Domain) => void;
  readonly onClose: () => void;
}

export function DomainPicker({ domains, onAutomatic, onSelect, onClose }: DomainPickerProps) {
  return (
    <div className="domain-picker" role="dialog" aria-label="Choose an address domain">
      <p className="domain-picker__title">New address</p>
      <button type="button" className="domain-picker__option" onClick={onAutomatic}>
        Automatic — let the provider choose
      </button>
      {domains.length === 0 ? (
        <p className="domain-picker__empty">
          No provider reachable from this browser exposes a domain list, so only automatic addresses
          are available here.
        </p>
      ) : (
        <ul className="domain-picker__list">
          {domains.map((domain) => (
            <li key={`${domain.provider}:${domain.id}`}>
              <button
                type="button"
                className="domain-picker__option"
                onClick={() => onSelect(domain)}
              >
                @{domain.name}
              </button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="domain-picker__cancel" onClick={onClose}>
        Cancel
      </button>
    </div>
  );
}
