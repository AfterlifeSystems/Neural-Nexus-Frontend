// src/components/ui/Modal.jsx
import React, { useEffect } from 'react';
import { ArrowLeft, X } from 'lucide-react';

/**
 * The overlay-and-card modal every settings dialog in this app hand-rolls.
 *
 * Same recipe as the portrait and connect-card modals in AvatarSettings — a
 * blurred black overlay and a translucent card — collected once so the New
 * Connector picker, the connect card, and the custom connector form share one
 * implementation of Escape-to-close and click-outside-to-close.
 *
 * @param {Object} parameters
 * @param {boolean} parameters.open Whether the modal is shown.
 * @param {Function} parameters.onClose Called on Escape, the close button, or
 *   a click on the overlay.
 * @param {string} [parameters.title] Heading shown at the top of the card.
 * @param {Function} [parameters.onBack] When given, a back arrow precedes the
 *   title (the custom connector form returns to the picker this way).
 * @param {string} [parameters.widthClassName] Tailwind max-width for the card.
 * @param {React.ReactNode} parameters.children The card body.
 */
const Modal = ({
  open,
  onClose,
  title,
  onBack,
  widthClassName = 'max-w-lg',
  children,
}) => {
  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = (keyEvent) => {
      if (keyEvent.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onMouseDown={(pressEvent) => {
        if (pressEvent.target === pressEvent.currentTarget) onClose?.();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`w-full ${widthClassName} max-h-[85vh] flex flex-col bg-black/60 backdrop-blur-lg rounded-2xl border border-white/10 shadow-xl`}
      >
        {(title || onBack) && (
          <div className="flex items-center gap-2 px-5 pt-4 pb-3 border-b border-white/10">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                aria-label="Back"
                className="p-1.5 rounded-lg text-white/60 hover:text-neutral-100 hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400/50"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <h3 className="text-neutral-200 font-semibold flex-grow truncate">
              {title}
            </h3>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="p-1.5 rounded-lg text-white/60 hover:text-neutral-100 hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400/50"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        <div className="p-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};

export default Modal;
