// src/components/ui/Switch.jsx
import React from 'react';

/**
 * An on/off switch in the house style: an amber knob on a translucent track.
 *
 * Rendered as a real `button` with `role="switch"` so it is keyboard operable
 * and screen readers announce the state. `busy` dims the control and refuses
 * clicks while a change is in flight, which matters here because flipping a
 * connection off deletes a stored credential and must not be double-fired.
 *
 * @param {Object} parameters
 * @param {boolean} parameters.checked Current state.
 * @param {Function} parameters.onChange Called with the next boolean state.
 * @param {string} parameters.label Accessible name for the switch.
 * @param {boolean} [parameters.busy] Whether a change is in flight.
 * @param {boolean} [parameters.disabled] Whether the switch is inert.
 * @param {string} [parameters.className] Extra layout classes.
 */
const Switch = ({
  checked,
  onChange,
  label,
  busy = false,
  disabled = false,
  className = '',
}) => {
  const isInert = disabled || busy;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-busy={busy || undefined}
      disabled={isInert}
      onClick={(clickEvent) => {
        clickEvent.stopPropagation();
        if (!isInert) onChange?.(!checked);
      }}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400/50 ${
        checked
          ? 'bg-amber-400/30 border-amber-400/50'
          : 'bg-white/10 border-white/10'
      } ${isInert ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${className}`}
    >
      <span
        aria-hidden="true"
        className={`inline-block h-3.5 w-3.5 rounded-full shadow transition-transform ${
          checked ? 'translate-x-[18px] bg-amber-400' : 'translate-x-[3px] bg-neutral-300'
        }`}
      />
    </button>
  );
};

export default Switch;
