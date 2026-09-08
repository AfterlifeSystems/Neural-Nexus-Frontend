import { useState } from 'react';
import { chatImageClassName, chatImageToggleLabel } from './secureImage';

/**
 * Render an image attachment.
 *
 * A missing address is a final state, not a pending one — nothing arrives later
 * to fill it in. Saying "Loading image…" forever was how an attachment that
 * never got a URL looked exactly like a slow network, which hid the bug that
 * produced it. Name the file instead, so the message still shows what was sent.
 *
 * A click (or Enter/Space) toggles the height cap so the same picture can sit
 * in the bubble or fill more of the transcript, then go back.
 */
const SecureImage = ({ mediaUrl, filename }) => {
  const [expanded, setExpanded] = useState(false);

  if (!mediaUrl) {
    return (
      <div className="text-xs text-neutral-300 italic">
        {filename ? `${filename} (no preview available)` : 'Image unavailable'}
      </div>
    );
  }

  const toggleLabel = chatImageToggleLabel(expanded, filename);

  return (
    <button
      type="button"
      onClick={() => setExpanded((current) => !current)}
      aria-expanded={expanded}
      aria-label={toggleLabel}
      title={toggleLabel}
      className="block max-w-full p-0 m-0 bg-transparent border-0 rounded cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
    >
      <img
        src={mediaUrl}
        alt={filename}
        className={chatImageClassName(expanded)}
      />
    </button>
  );
};

export default SecureImage;
