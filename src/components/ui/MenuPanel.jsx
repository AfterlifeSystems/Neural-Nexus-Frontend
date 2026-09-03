// src/components/ui/MenuPanel.jsx
import React, { useEffect, useRef } from 'react';

/**
 * A pop-up menu that closes on a press outside or on Escape.
 *
 * The click-outside listener is the one `UserSettingsMenu` uses; it lives here
 * so the composer's "+" menu and its Connectors submenu do not each re-derive
 * it. The panel is positioned by the caller through `className` (the composer
 * opens upward, a submenu opens to the side), and it renders nothing while
 * closed so nothing is left in the tab order.
 *
 * @param {Object} parameters
 * @param {boolean} parameters.open Whether the panel is shown.
 * @param {Function} parameters.onClose Called when the panel should close.
 * @param {string} [parameters.className] Positioning and sizing classes.
 * @param {string} [parameters.id] Element id, for `aria-controls`.
 * @param {React.ReactNode} parameters.children The menu rows.
 */
const MenuPanel = ({ open, onClose, className = '', id, children }) => {
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const handlePressOutside = (pressEvent) => {
      if (panelRef.current && !panelRef.current.contains(pressEvent.target)) {
        onClose?.();
      }
    };
    const handleEscape = (keyEvent) => {
      if (keyEvent.key === 'Escape') onClose?.();
    };
    document.addEventListener('mousedown', handlePressOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePressOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      id={id}
      ref={panelRef}
      role="menu"
      className={`absolute z-50 backdrop-blur-lg bg-black/70 rounded-xl border border-white/10 shadow-lg p-1.5 ${className}`}
    >
      {children}
    </div>
  );
};

/**
 * One row of a menu panel: an icon, a label, and an optional trailing slot
 * (a chevron for a submenu, a switch for a toggle).
 */
export const MenuRow = ({
  icon,
  label,
  onClick,
  trailing,
  disabled = false,
  isDanger = false,
  className = '',
}) => (
  <button
    type="button"
    role="menuitem"
    disabled={disabled}
    onClick={onClick}
    className={`w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center gap-2 text-sm ${
      isDanger
        ? 'text-red-400 hover:bg-red-900/40 hover:text-neutral-100'
        : 'text-white/70 hover:bg-white/10 hover:text-neutral-100'
    } disabled:opacity-40 disabled:hover:bg-transparent ${className}`}
  >
    {icon}
    <span className="flex-grow truncate">{label}</span>
    {trailing}
  </button>
);

export default MenuPanel;
