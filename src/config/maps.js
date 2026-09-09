// src/config/maps.js
//
// Map configuration for geo-located avatars. The local map (the sidebar panel
// and the pin picker) draws raster tiles from a tile server; the world globe
// draws its own imagery and needs none.
//
// The tile server is deployment configuration, not a per-user setting. The
// default is the OpenStreetMap standard tile layer, whose usage policy asks
// that a production deployment point VITE_MAP_TILE_URL at its own tile server
// or a commercial provider.

export const DEFAULT_MAP_TILE_URL =
  'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

export const DEFAULT_MAP_TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

export const MAP_TILE_URL =
  import.meta.env.VITE_MAP_TILE_URL ?? DEFAULT_MAP_TILE_URL;

export const MAP_TILE_ATTRIBUTION =
  import.meta.env.VITE_MAP_TILE_ATTRIBUTION ?? DEFAULT_MAP_TILE_ATTRIBUTION;

// The geocoder the pin picker's search box asks when a person types a place
// name rather than coordinates. The default is the public Nominatim instance,
// whose usage policy allows one request per second and no autocomplete; a
// production deployment should point VITE_GEOCODER_URL at its own Nominatim or
// a commercial provider that speaks the same /search?q=&format=jsonv2 shape.
export const DEFAULT_GEOCODER_URL = 'https://nominatim.openstreetmap.org/search';

export const GEOCODER_URL =
  import.meta.env.VITE_GEOCODER_URL || DEFAULT_GEOCODER_URL;
