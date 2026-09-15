// src/components/ui/loopingVideoLayer.js
//
// When a generated still is ready, show it. Do not wait for the idle loop.
// Waiting for both is why voice mode stayed empty while the loop's decoder
// had not started. The gallery does the opposite for generated cards: it
// keeps the 9:16 window empty until the clip has a frame, because binding
// the square still first paints a circle that then pops into the portrait.

/**
 * Whether this still/loop pair may be shown.
 *
 * @param {{poster?: string|null, src?: string|null}|null|undefined} layer
 * @param {{poster?: boolean, video?: boolean}|null|undefined} ready
 * @returns {boolean}
 */
export function loopingVideoLayerMayReveal(layer, ready = {}) {
  if (!layer) return false;
  if (layer.poster && !ready.poster) return false;
  if (!layer.poster && layer.src && !ready.video) return false;
  return Boolean(layer.poster || layer.src);
}

/**
 * Whether the still belongs on screen with the idle loop.
 *
 * The still shows first so the stage is not empty. Once the loop has
 * painted, the still must leave: `object-contain` letterboxes a 9:16
 * canvas in a square well, and the unused box is transparent, so the
 * still would sit beside the clip — two portraits of the same face.
 *
 * @param {{poster?: string|null, src?: string|null}|null|undefined} layer
 * @param {boolean} [loopHasPainted]
 * @returns {boolean}
 */
export function loopingVideoPosterIsVisible(layer, loopHasPainted = false) {
  if (!layer?.poster) return false;
  if (layer.src && loopHasPainted) return false;
  return true;
}

/**
 * Layers kept after the incoming face is shown. The outgoing face leaves
 * in the same paint. Holding the outgoing face for a dissolve left two
 * faces on screen.
 *
 * A newer layer that is still decoding stays so the next swap is not lost.
 *
 * @param {Array<{id: number}>|null|undefined} layers
 * @param {number|null|undefined} visibleId
 * @returns {Array<{id: number}>}
 */
/**
 * Whether this layer is the face on stage.
 *
 * `visibleId` starts null until decode finishes. Waiting for that left the
 * well empty, so the world globe showed through. The first layer stays on
 * screen until a later layer is revealed.
 *
 * @param {number} layerId
 * @param {number|null|undefined} visibleId
 * @param {number|null|undefined} firstLayerId
 * @returns {boolean}
 */
export function loopingVideoLayerIsShown(layerId, visibleId, firstLayerId) {
  if (visibleId == null) return layerId === firstLayerId;
  return layerId === visibleId;
}

export function loopingVideoLayersAfterReveal(layers, visibleId) {
  if (!Array.isArray(layers) || layers.length === 0) {
    return Array.isArray(layers) ? layers : [];
  }
  const latestLayer = layers[layers.length - 1];
  return layers.filter(
    (layer) => layer.id === visibleId || layer.id === latestLayer?.id
  );
}
