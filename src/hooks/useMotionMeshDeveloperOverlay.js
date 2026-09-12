// src/hooks/useMotionMeshDeveloperOverlay.js
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { isAdminAccount } from '../config/adminAccount';
import { MOTION_WIREFRAME_OVERLAY } from '../config/motionWireframe';
import {
  readMotionMeshDeveloperOverlay,
  shouldDrawMotionMeshOverlay,
  shouldOfferMotionMeshDeveloperOption,
  subscribeMotionMeshDeveloperOverlay,
  writeMotionMeshDeveloperOverlay,
} from '../config/motionMeshDeveloperOverlay';

/**
 * The developer option that draws the motion wireframe over the camera tile.
 *
 * `offered` is whether the switch should be shown at all — the administrator
 * in a development build, nobody else. `shown` is the stored switch. `draw`
 * is the one thing the camera tile needs: whether to paint the mesh now.
 *
 * @returns {{offered: boolean, shown: boolean, draw: boolean, setShown: (shown: boolean) => void}}
 */
export default function useMotionMeshDeveloperOverlay() {
  const { user } = useAuth();
  const offered = shouldOfferMotionMeshDeveloperOption({
    isDev: Boolean(import.meta.env?.DEV),
    isAdmin: isAdminAccount(user),
  });
  const [shown, setStoredShown] = useState(() => readMotionMeshDeveloperOverlay());
  useEffect(() => {
    setStoredShown(readMotionMeshDeveloperOverlay());
    return subscribeMotionMeshDeveloperOverlay((next) =>
      setStoredShown(Boolean(next))
    );
  }, []);
  const setShown = useCallback((next) => {
    writeMotionMeshDeveloperOverlay(next);
  }, []);
  return {
    offered,
    shown,
    draw: shouldDrawMotionMeshOverlay({
      overlayEnabled: MOTION_WIREFRAME_OVERLAY,
      offered,
      shown,
    }),
    setShown,
  };
}
