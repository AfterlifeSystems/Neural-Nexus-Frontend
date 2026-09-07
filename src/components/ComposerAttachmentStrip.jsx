import { useEffect, useState } from 'react';
import { HiXMark } from 'react-icons/hi2';
import {
  composeComposerAttachments,
  describeAttachment,
  isImageAttachment,
} from './composerAttachments';

/**
 * The preview strip message mode and voice mode share: images as thumbnails,
 * everything else as a kind chip, with a remove control until the file is
 * already on its way.
 *
 * @param {Object} props
 * @param {File[]} [props.mediaFiles] Files still waiting to send.
 * @param {File[]} [props.attachmentsInFlight] Files of a turn already sent.
 * @param {(index: number) => void} [props.onRemove]
 */
const ComposerAttachmentStrip = ({
  mediaFiles = [],
  attachmentsInFlight = [],
  onRemove,
}) => {
  const composerAttachments = composeComposerAttachments(
    mediaFiles,
    attachmentsInFlight
  );
  const [attachmentPreviewUrls, setAttachmentPreviewUrls] = useState([]);

  useEffect(() => {
    const createdUrls = composeComposerAttachments(
      mediaFiles,
      attachmentsInFlight
    ).map((attachedFile) =>
      isImageAttachment(attachedFile)
        ? URL.createObjectURL(attachedFile)
        : null
    );
    setAttachmentPreviewUrls(createdUrls);
    return () => {
      createdUrls.forEach(
        (objectUrl) => objectUrl && URL.revokeObjectURL(objectUrl)
      );
    };
  }, [mediaFiles, attachmentsInFlight]);

  if (composerAttachments.length === 0) return null;

  return (
    <div className="composer-attachment-strip p-3 border-b border-neutral-700/50">
      <div className="flex gap-3 overflow-x-auto scrollbar-thin scrollbar-thumb-neutral-600">
        {composerAttachments.map((file, index) => {
          // Anything past the composed files belongs to a turn already
          // under way: it is shown, but cannot be taken back.
          const isBeingSent = index >= mediaFiles.length;
          const imagePreviewUrl = attachmentPreviewUrls[index];
          const { Icon, label, tileClassName } = describeAttachment(file);
          return (
            <div
              key={`${file.name}-${file.lastModified}-${index}`}
              className={`relative flex-shrink-0 group ${
                isBeingSent ? 'opacity-60' : ''
              }`}
            >
              {imagePreviewUrl ? (
                <>
                  <img
                    src={imagePreviewUrl}
                    alt={file.name}
                    title={file.name}
                    className="h-16 w-16 object-cover rounded-lg border border-neutral-600 group-hover:border-neutral-200 transition-colors"
                  />
                  {isBeingSent && (
                    <span className="absolute inset-x-0 bottom-0 rounded-b-lg bg-black/70 text-[10px] text-center text-neutral-200 py-0.5">
                      Sending…
                    </span>
                  )}
                  {!isBeingSent && (
                    <button
                      type="button"
                      onClick={() => onRemove?.(index)}
                      aria-label={`Remove ${file.name}`}
                      className="composer-attachment-remove absolute top-1 right-1 p-0! w-4 h-4 rounded-full flex items-center justify-center bg-black/70 text-neutral-200 hover:bg-red-500 transition-colors z-20"
                    >
                      <HiXMark className="w-2.5 h-2.5" />
                    </button>
                  )}
                </>
              ) : (
                <div
                  title={file.name}
                  className="h-16 flex items-center gap-2 pl-2 pr-2 rounded-lg border border-neutral-600 bg-black/60 group-hover:border-neutral-200 transition-colors"
                >
                  <span
                    className={`w-9 h-9 shrink-0 rounded-lg flex items-center justify-center ${tileClassName}`}
                  >
                    <Icon size={18} className="text-neutral-200" />
                  </span>
                  <span className="min-w-0">
                    <span className="block max-w-[10rem] truncate text-sm text-neutral-200">
                      {file.name}
                    </span>
                    <span className="block text-xs text-neutral-400">
                      {isBeingSent ? 'Sending…' : label}
                    </span>
                  </span>
                  {!isBeingSent && (
                    <button
                      type="button"
                      onClick={() => onRemove?.(index)}
                      aria-label={`Remove ${file.name}`}
                      className="composer-attachment-remove shrink-0 p-0! w-5 h-5 rounded-full flex items-center justify-center text-neutral-400 hover:text-neutral-100 hover:bg-red-500 transition-colors"
                    >
                      <HiXMark className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ComposerAttachmentStrip;
