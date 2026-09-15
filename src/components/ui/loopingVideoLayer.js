// src/components/ui/loopingVideoLayer.js
//
// A generated still may show before the idle loop when no 9:16 frame is
// ready yet, so the well is not empty. If the carousel already decoded
// that loop, skip the still: object-cover on the square still zooms the
// face, then the 9:16 clip unzooms it. The unpainted canvas stays opacity
// 0 until a 9:16 frame exists, so a 300×150 default canvas does not flash.

/**
 * Whether this still/loop pair may be shown.
 *
 * A painted idle loop is enough. Waiting for the square still after that
 * loop was on the canvas left the still to win the first paint, then the
 * clip replaced it — the video resize.
 *
 * @param {{poster?: string|null, src?: string|null}|null|undefined} layer
 * @param {{poster?: boolean, video?: boolean, loop?: boolean}|null|undefined} ready
 * @returns {boolean}
 */
export function loopingVideoLayerMayReveal(layer, ready = {}) {
  if (!layer) return false;
  if (layer.src && ready.loop) return true;
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
 * Whether the idle-loop canvas or lip-sync video may be opaque.
 *
 * An unpainted canvas is 300×150. Showing that on top of the still, then
 * sizing the canvas to the clip, is the video resize. Keep the still
 * visible until a real frame is on the canvas.
 *
 * @param {boolean} layerIsShown
 * @param {boolean} loopHasPainted
 * @param {boolean} hasLoopSrc
 * @returns {boolean}
 */
export function loopingVideoIdleLayerIsShown(
  layerIsShown,
  loopHasPainted,
  hasLoopSrc
) {
  if (hasLoopSrc && !loopHasPainted) return false;
  return Boolean(layerIsShown);
}

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
export function loopingVideoLayersAfterReveal(layers, visibleId) {
  if (!Array.isArray(layers) || layers.length === 0) {
    return Array.isArray(layers) ? layers : [];
  }
  const latestLayer = layers[layers.length - 1];
  return layers.filter(
    (layer) => layer.id === visibleId || layer.id === latestLayer?.id
  );
}
