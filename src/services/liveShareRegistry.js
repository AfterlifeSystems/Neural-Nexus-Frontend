// What the browser has live at this moment, published for the turn plumbing.
//
// `MediaShareContext` owns the webcam and screen streams, and reads
// `MediaContext` to send observations — so `MediaContext` cannot read
// `MediaShareContext` back without a cycle. Every turn nevertheless has to
// report what is being shared (the `live_shares` form field), and a `look_now`
// pause has to be answered with a frame captured this instant. Both cross the
// same boundary, so both cross it here: the share provider publishes its live
// sources and its capture function, and anything sending a turn reads them.
//
// The registry holds no React state on purpose. A turn in flight reads what is
// live at the moment it asks, not what was live when a component last rendered.

/**
 * @type {{
 *   sources: string[],
 *   peekableSources: string[],
 *   capture: ((sources: string[]) => Promise<File[]>) | null,
 *   peek: (() => Promise<File|null>) | null,
 *   peekDesktop: (() => Promise<File|null>) | null,
 *   stop: ((sources: string[]) => string[]) | null,
 *   startScreenShare: (() => Promise<void>) | null,
 * }}
 */
let live = {
  sources: [],
  peekableSources: [],
  capture: null,
  peek: null,
  peekDesktop: null,
  stop: null,
  startScreenShare: null,
};

/**
 * Publish what is being shared right now, and how to capture a frame of it.
 *
 * @param {Object} state
 * @param {string[]} state.sources Live source names (`webcam`, `screen`).
 * @param {string[]} [state.peekableSources] What this browser could open for a
 *   single look if the avatar asked — never the same list as `sources`, and
 *   never watched. Only the desktop is reported here; the camera's permission
 *   is per avatar, so the caller adds it.
 * @param {(sources: string[]) => Promise<File[]>} [state.capture] Grabs one
 *   fresh frame per requested source. Frames are captured on demand and are
 *   deliberately NOT put through the ambient loop's unchanged-frame filter: a
 *   look was asked for, so the answer is the scene as it is, whether or not it
 *   changed since the loop last sent one.
 * @param {() => Promise<File|null>} [state.peek] Opens the camera, takes one
 *   frame, and closes it — the avatar's own look, allowed from avatar settings.
 * @param {() => Promise<File|null>} [state.peekDesktop] Takes one frame of the
 *   desktop capture the person granted, without ever starting one.
 * @param {(sources: string[]) => string[]} [state.stop] Switches shares off.
 * @param {() => Promise<void>} [state.startScreenShare] Opens the browser's
 *   screen picker for a look the avatar asked for, starting the capture in
 *   peek mode. Only ever called straight out of a press by the person: no
 *   browser lets a page start a screen capture any other way.
 * @returns {void}
 */
export function publishLiveShares({
  sources,
  peekableSources,
  capture,
  peek,
  peekDesktop,
  stop,
  startScreenShare,
}) {
  live = {
    sources: Array.isArray(sources) ? [...sources] : [],
    peekableSources: Array.isArray(peekableSources)
      ? [...peekableSources]
      : live.peekableSources,
    capture: capture ?? live.capture,
    peek: peek ?? live.peek,
    peekDesktop: peekDesktop ?? live.peekDesktop,
    stop: stop ?? live.stop,
    startScreenShare: startScreenShare ?? live.startScreenShare,
  };
}

/**
 * What is being shared at this moment.
 *
 * @returns {string[]}
 */
export function getLiveShareSources() {
  return [...live.sources];
}

/**
 * The `live_shares` form value for a turn, or `null` when nothing is shared.
 *
 * @returns {string|null}
 */
export function liveShareFormValue() {
  const sources = getLiveShareSources();
  return sources.length > 0 ? JSON.stringify(sources) : null;
}

/**
 * What this browser could open for ONE look right now, if the avatar asked.
 *
 * Not the same thing as what is being shared, and never watched: a peekable
 * source feeds no ambient observation.
 *
 * The two get here by different routes, because the browser treats them
 * differently. The **screen** is peekable while the person is running a
 * capture in peek mode — they pressed something, chose in the browser's own
 * picker what it covers, and that act is the whole consent; `MediaShareContext`
 * publishes it. The **camera** is peekable on a standing origin permission
 * plus a per-avatar setting, which the caller reads because this registry does
 * not know which avatar a turn is for.
 *
 * @param {Object} [allowed]
 * @param {boolean} [allowed.cameraAllowed] May this avatar open the camera.
 * @returns {string[]}
 */
export function getPeekableShareSources({ cameraAllowed = false } = {}) {
  const peekable = new Set(live.peekableSources);
  if (cameraAllowed && !live.sources.includes('webcam')) {
    peekable.add('webcam');
  }
  return ['webcam', 'screen'].filter((source) => peekable.has(source));
}

/**
 * The `peekable_shares` form value for a turn.
 *
 * Always a value, never `null`: a browser that reports the field is believed,
 * including when it reports that nothing can be looked at. Only a client that
 * never sends the field at all is read by the older rule (see
 * `peekable_sources` in `look_tools.py`).
 *
 * @param {string[]} [sources] What can be looked at, from
 *   `getPeekableShareSources`. Read afresh when not given.
 * @returns {string}
 */
export function peekableShareFormValue(sources) {
  return JSON.stringify(sources ?? getPeekableShareSources());
}

/**
 * Capture one fresh frame per requested source, right now.
 *
 * @param {string[]} [sources] Which to capture; everything live by default.
 * @returns {Promise<File[]>} The frames, empty when nothing could be captured.
 */
export async function captureLiveShareFrames(sources) {
  const wanted = (
    Array.isArray(sources) && sources.length > 0 ? sources : getLiveShareSources()
  ).filter((source) => live.sources.includes(source));
  if (wanted.length === 0 || !live.capture) return [];
  try {
    const frames = await live.capture(wanted);
    return Array.isArray(frames) ? frames.filter(Boolean) : [];
  } catch (captureError) {
    // A look that cannot be taken is reported to the avatar as unavailable;
    // it must never take the turn down with it.
    console.warn('A live-share frame could not be captured:', captureError);
    return [];
  }
}

/** Forget the published shares. For tests, and for a provider unmounting. */
export function resetLiveShares() {
  live = {
    sources: [],
    peekableSources: [],
    capture: null,
    peek: null,
    peekDesktop: null,
    stop: null,
    startScreenShare: null,
  };
}

// --- Answering a look -------------------------------------------------------

/** The `kind` on a pause the browser answers itself, with a fresh frame. */
export const LOOK_NOW_INTERRUPT_KIND = 'look_now';

/**
 * How many looks one turn may take before the turn answers from what it has.
 *
 * A model that keeps asking to look would otherwise park the turn on the
 * server indefinitely, each look costing a capture and a description.
 */
export const MAXIMUM_LOOKS_PER_TURN = 3;

/**
 * Name the source a captured frame came from, from the file name.
 *
 * @param {string} filename `webcam.jpg` / `screen.jpg`.
 * @returns {string}
 */
export function sourceOfFrameName(filename) {
  const stem = String(filename ?? '')
    .split('.')[0]
    .trim()
    .toLowerCase();
  return stem === 'webcam' || stem === 'screen' ? stem : 'image';
}

/**
 * Open the camera for one look and close it again.
 *
 * @returns {Promise<File|null>} The frame, or null when the camera would not open.
 */
export async function peekThroughLiveCamera() {
  if (!live.peek) return null;
  try {
    return await live.peek();
  } catch (peekError) {
    console.warn('The camera could not be opened for a look:', peekError);
    return null;
  }
}

/**
 * Take one frame of the desktop, from the capture the person granted.
 *
 * @returns {Promise<File|null>} The frame, or null with nothing to look at.
 */
export async function peekAtLiveDesktop() {
  if (!live.peekDesktop) return null;
  try {
    return await live.peekDesktop();
  } catch (peekError) {
    console.warn('The desktop could not be captured for a look:', peekError);
    return null;
  }
}

/**
 * Switch shares off, on the avatar's say-so.
 *
 * @param {string[]} sources `'webcam'` / `'screen'`.
 * @returns {string[]} What was actually switched off.
 */
export function stopLiveShares(sources) {
  if (!live.stop) return [];
  try {
    return live.stop(sources ?? []) ?? [];
  } catch (stopError) {
    console.warn('A share could not be switched off:', stopError);
    return [];
  }
}

/**
 * Open the screen picker for a look the avatar asked for, in PEEK mode.
 *
 * Call only from a press by the person: that press is the gesture every
 * browser requires, and the capture it starts is one the avatar may glance at
 * when a question needs it, never one that is watched on a timer.
 *
 * @returns {Promise<void>}
 */
export async function startLiveScreenShare() {
  if (!live.startScreenShare) return;
  await live.startScreenShare();
}
