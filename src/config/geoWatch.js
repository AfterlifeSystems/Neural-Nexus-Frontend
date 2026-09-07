// src/config/geoWatch.js
//
// How often the browser reports its position to the API while the person has
// turned on the watch for nearby geo-located avatars. The device reports a new
// position far more often than that; this is the floor the client applies
// before calling POST /geo/checkin, so walking down a street is a handful of
// requests rather than hundreds.

import { geoCheckinIntervalMilliseconds } from './geoCheckinInterval';

export {
  DEFAULT_GEO_CHECKIN_INTERVAL_SECONDS,
  MINIMUM_GEO_CHECKIN_INTERVAL_SECONDS,
  geoCheckinIntervalMilliseconds,
} from './geoCheckinInterval';

export const GEO_CHECKIN_INTERVAL_MS = geoCheckinIntervalMilliseconds(
  import.meta.env.VITE_GEO_CHECKIN_INTERVAL_SECONDS
);
