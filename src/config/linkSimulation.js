// src/config/linkSimulation.js
//
// Always-on Neuralink simulation servers the developer demo panel attaches to.
// The buttons only attach or detach consumers; they do not start or stop the
// loops. Defaults are the local `make demo` ports.

export const DEFAULT_LINK_MOTION_URL = 'http://127.0.0.1:8101';
export const DEFAULT_LINK_V1_URL = 'http://127.0.0.1:8102';

export const LINK_MOTION_URL = (
  import.meta.env.VITE_LINK_MOTION_URL || DEFAULT_LINK_MOTION_URL
).replace(/\/$/, '');

export const LINK_V1_URL = (
  import.meta.env.VITE_LINK_V1_URL || DEFAULT_LINK_V1_URL
).replace(/\/$/, '');
