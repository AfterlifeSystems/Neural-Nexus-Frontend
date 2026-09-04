/**
 * A spinning ring. `fullscreen` pins it to the viewport centre so a page
 * placeholder is not dumped into the top-left of the document flow.
 *
 * @param {Object} [parameters]
 * @param {boolean} [parameters.fullscreen] Fill the viewport and centre.
 * @param {string} [parameters.label] Visible caption under the ring.
 */
export default function LoadingSpinner({ fullscreen = false, label }) {
  const spinner = (
    <div className="flex flex-col items-center justify-center gap-3">
      <div
        className="h-6 w-6 border-4 border-white/10 border-t-white rounded-full animate-spin"
        role="status"
        aria-label={label ?? 'Loading'}
      />
      {label ? <p className="text-white/70 text-sm">{label}</p> : null}
    </div>
  );
  if (!fullscreen) return spinner;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
      {spinner}
    </div>
  );
}
