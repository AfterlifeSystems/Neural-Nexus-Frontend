/**
 * Render an image attachment.
 *
 * A missing address is a final state, not a pending one — nothing arrives later
 * to fill it in. Saying "Loading image…" forever was how an attachment that
 * never got a URL looked exactly like a slow network, which hid the bug that
 * produced it. Name the file instead, so the message still shows what was sent.
 */
const SecureImage = ({ mediaUrl, filename }) => {
  if (!mediaUrl) {
    return (
      <div className="text-xs text-neutral-300 italic">
        {filename ? `${filename} (no preview available)` : 'Image unavailable'}
      </div>
    );
  }

  return (
    <img
      src={mediaUrl}
      alt={filename}
      className="max-w-full max-h-64 object-contain rounded border border-neutral-300"
    />
  );
};

export default SecureImage;
