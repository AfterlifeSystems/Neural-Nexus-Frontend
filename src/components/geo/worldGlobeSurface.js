// src/components/geo/worldGlobeSurface.js
//
// The globe the map screen and the page background share: night-Earth texture,
// Esri slippy tiles when the camera comes in, the same atmosphere, and the
// same HTML pins.

import { GLOBE_TILE_URL } from '../../config/maps';
import earthNightTexture from '../../assets/globe/earth-night.jpg';
import {
  GLOBE_HTML_MARKER_ALTITUDE,
  GLOBE_HTML_TRANSITION_MS,
  GLOBE_TILE_MAX_ZOOM,
  WORLD_GLOBE_ATMOSPHERE_ALTITUDE,
  WORLD_GLOBE_ATMOSPHERE_COLOR,
  WORLD_GLOBE_AUTO_ROTATE_SPEED,
  WORLD_GLOBE_BACKGROUND_COLOR,
  globeMinDistance,
  slippyTileUrl,
} from '../../services/globeMap';
import { globeMarkerElement } from './globePinMarker';

/**
 * Paint the shared world surface onto a globe.gl instance.
 *
 * @param {Object} globeInstance
 * @param {{autoRotate?: boolean, enableRotate?: boolean, enableZoom?: boolean, enablePan?: boolean}} [options]
 * @returns {{controls: Object, globeRadius: number}}
 */
export function applyWorldGlobeSurface(globeInstance, options = {}) {
  const {
    autoRotate = true,
    enableRotate = true,
    enableZoom = true,
    enablePan = true,
  } = options;

  globeInstance
    .backgroundColor(WORLD_GLOBE_BACKGROUND_COLOR)
    .globeImageUrl(earthNightTexture);

  if (typeof globeInstance.globeTileEngineUrl === 'function') {
    globeInstance.globeTileEngineUrl((tileX, tileY, zoomLevel) =>
      slippyTileUrl(GLOBE_TILE_URL, tileX, tileY, zoomLevel)
    );
  }
  if (typeof globeInstance.globeTileEngineMaxLevel === 'function') {
    globeInstance.globeTileEngineMaxLevel(GLOBE_TILE_MAX_ZOOM);
  } else if (typeof globeInstance.globeTileEngineMaxZoom === 'function') {
    globeInstance.globeTileEngineMaxZoom(GLOBE_TILE_MAX_ZOOM);
  }

  // After tiles: GlowMesh is rebuilt from the globe geometry, and must stay
  // visible once the slippy engine hides the night-texture sphere.
  globeInstance
    .showAtmosphere(true)
    .atmosphereColor(WORLD_GLOBE_ATMOSPHERE_COLOR)
    .atmosphereAltitude(WORLD_GLOBE_ATMOSPHERE_ALTITUDE)
    .ringsData([]);

  const renderer = globeInstance.renderer?.();
  if (renderer?.setClearColor) {
    renderer.setClearColor(0x000000, 1);
  }

  const controls = globeInstance.controls();
  controls.autoRotate = autoRotate;
  controls.autoRotateSpeed = WORLD_GLOBE_AUTO_ROTATE_SPEED;
  if (typeof controls.enableRotate === 'boolean') {
    controls.enableRotate = enableRotate;
  }
  if (typeof controls.enableZoom === 'boolean') {
    controls.enableZoom = enableZoom;
  }
  if (typeof controls.enablePan === 'boolean') {
    controls.enablePan = enablePan;
  }

  const globeRadius = globeInstance.getGlobeRadius?.() ?? 100;
  if (typeof controls.minDistance === 'number') {
    controls.minDistance = globeMinDistance(globeRadius);
  }
  const camera = globeInstance.camera?.();
  if (camera && typeof camera.near === 'number') {
    camera.near = Math.min(camera.near, globeRadius * 0.0002);
    camera.updateProjectionMatrix?.();
  }

  return { controls, globeRadius };
}

/**
 * @param {Object} globeInstance
 * @param {Array<Object>} groups
 * @param {{onInspect?: Function, onHover?: Function, selectedAssistantId?: string|null, interactive?: boolean}} [options]
 */
export function applyWorldGlobeHtmlPins(globeInstance, groups, options = {}) {
  const {
    onInspect,
    onHover,
    selectedAssistantId = null,
    interactive = true,
  } = options;
  globeInstance
    .htmlElementsData(groups ?? [])
    .htmlLat('latitude')
    .htmlLng('longitude')
    .htmlAltitude(GLOBE_HTML_MARKER_ALTITUDE)
    .htmlTransitionDuration(GLOBE_HTML_TRANSITION_MS)
    .htmlElement((group) =>
      globeMarkerElement(
        group,
        onInspect,
        onHover,
        selectedAssistantId,
        { interactive }
      )
    );
}
