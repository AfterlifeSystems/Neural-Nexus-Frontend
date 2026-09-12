// src/components/CreateAvatarIdentityLinksField.jsx
//
// Optional identity-source links on Create Avatar. Zero is fine. Add one
// address at a time, or paste several; they are ingested after create via
// /update_avatar_identity_with_media.

import { Link, Plus, X } from 'lucide-react';

import {
  addIdentityLinkDraft,
  collectIdentityLinks,
} from '../services/createAvatarIdentityLinks';
import { parseHttpUrls } from '../services/parseHttpUrls';

const addButtonClassName =
  'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md border border-neutral-700 bg-black/60 px-3 py-2 text-sm text-neutral-200 hover:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-amber-400/50 disabled:opacity-50';

/**
 * @param {Object} props
 * @param {string[]} props.links Accepted identity-source addresses.
 * @param {string} props.draft Text still in the field.
 * @param {string} [props.error]
 * @param {boolean} [props.disabled]
 * @param {(links: string[]) => void} props.onLinksChange
 * @param {(draft: string) => void} props.onDraftChange
 * @param {(error: string) => void} props.onErrorChange
 */
const CreateAvatarIdentityLinksField = ({
  links,
  draft,
  error = '',
  disabled = false,
  onLinksChange,
  onDraftChange,
  onErrorChange,
}) => {
  const addFromText = (text) => {
    const result = addIdentityLinkDraft(links, text);
    if (result.error) {
      onErrorChange(result.error);
      return;
    }
    onLinksChange(result.links);
    onDraftChange('');
    onErrorChange('');
  };

  return (
    <div className="mb-4">
      <label className="block text-xl sm:text-2xl text-neutral-300">
        Links
        <span className="ml-2 text-sm font-normal text-white/40">Optional</span>
        <div className="mt-1 flex gap-2">
          <input
            type="text"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            value={draft}
            onChange={(changeEvent) => {
              onDraftChange(changeEvent.target.value);
              if (error) onErrorChange('');
            }}
            onKeyDown={(keyEvent) => {
              if (keyEvent.key !== 'Enter') return;
              keyEvent.preventDefault();
              addFromText(draft);
            }}
            onPaste={(pasteEvent) => {
              const pastedUrls = parseHttpUrls(
                pasteEvent.clipboardData.getData('text/plain')
              );
              if (pastedUrls.length <= 1) return;
              pasteEvent.preventDefault();
              onLinksChange(collectIdentityLinks(links, pastedUrls.join('\n')));
              onDraftChange('');
              onErrorChange('');
            }}
            placeholder="https:// — paste several, separated by spaces or lines"
            disabled={disabled}
            aria-invalid={Boolean(error)}
            className="min-w-0 flex-1 rounded border border-neutral-700 bg-black/60 p-2 text-sm text-neutral-200 focus:outline-none focus:ring-2 focus:ring-amber-400/50 transition-all duration-300"
          />
          <button
            type="button"
            onClick={() => addFromText(draft)}
            disabled={disabled || !draft.trim()}
            className={addButtonClassName}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add
          </button>
        </div>
      </label>
      <p className="mt-1 text-xs text-white/40">
        YouTube, articles, or other pages about this person. They are ingested
        after create as identity media.
      </p>
      {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
      {links.length > 0 && (
        <ul className="mt-2 space-y-1">
          {links.map((url) => (
            <li
              key={url}
              className="flex items-center gap-2 rounded border border-neutral-700 bg-black/60 px-2 py-1 text-xs text-neutral-200"
            >
              <Link className="h-3.5 w-3.5 shrink-0 text-white/40" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate" title={url}>
                {url}
              </span>
              <button
                type="button"
                onClick={() =>
                  onLinksChange(links.filter((candidate) => candidate !== url))
                }
                disabled={disabled}
                className="rounded-md border border-neutral-700 bg-black/60 p-1 text-neutral-200 hover:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-amber-400/50 disabled:opacity-50"
                aria-label={`Remove ${url}`}
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default CreateAvatarIdentityLinksField;
