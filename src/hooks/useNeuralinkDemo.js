// src/hooks/useNeuralinkDemo.js
//
// Attach or detach the developer Neuralink demo consumers. The motion and V1
// servers keep running; these switches only poll them and write into Neural
// Nexus. The share-rail webcam is never assigned.

import { useEffect, useRef, useState } from 'react';
import { LINK_MOTION_URL, LINK_V1_URL } from '../config/linkSimulation';
import { AMBIENT_CAPTURE_INTERVAL_MS } from '../config/ambientCapture';
import { useMedia } from '../context/MediaContext.jsx';
import { resolveAssistantId } from '../components/utils';
import { isPersonalCreatorAvatar } from '../services/avatarListOrder.js';
import { postAvatarMotionTrack } from '../services/avatarService.jsx';
import {
  NEURAL_DECODER_SOURCE,
  V1_CAMERA_FACING,
  appendTrailPoint,
  fetchMotionCurrent,
  fetchMotionCurrentWindow,
  fetchV1Jpeg,
  fetchV1Status,
  trailPointFromCurrent,
  webcamJpegFileFromBlob,
} from '../services/linkSimulation.js';

const WRIST_TRAIL_POLL_MS = 200;
const WRIST_WINDOW_POLL_MS = 2000;
const V1_PREVIEW_POLL_MS = 1000;

export default function useNeuralinkDemo() {
  const { activeAvatar, sendAmbientObservation } = useMedia();
  const assistantId = resolveAssistantId(activeAvatar);
  const personalAvatar = isPersonalCreatorAvatar(activeAvatar);
  const [sightEnabled, setSightEnabled] = useState(false);
  const [wristEnabled, setWristEnabled] = useState(false);
  const [jpegObjectUrl, setJpegObjectUrl] = useState(null);
  const [v1Path, setV1Path] = useState(null);
  const [v1FrameIndex, setV1FrameIndex] = useState(null);
  const [trailPoints, setTrailPoints] = useState([]);
  const [motionPath, setMotionPath] = useState(null);
  const [lastRecorded, setLastRecorded] = useState(null);
  const [sightError, setSightError] = useState(null);
  const [wristError, setWristError] = useState(null);
  const jpegObjectUrlRef = useRef(null);

  useEffect(() => {
    if (!sightEnabled) {
      if (jpegObjectUrlRef.current) {
        URL.revokeObjectURL(jpegObjectUrlRef.current);
        jpegObjectUrlRef.current = null;
      }
      setJpegObjectUrl(null);
      setV1Path(null);
      setV1FrameIndex(null);
      setSightError(null);
      return undefined;
    }

    let cancelled = false;

    const refreshPreview = async () => {
      try {
        const [jpegBlob, status] = await Promise.all([
          fetchV1Jpeg(LINK_V1_URL),
          fetchV1Status(LINK_V1_URL),
        ]);
        if (cancelled) return;
        const nextUrl = URL.createObjectURL(jpegBlob);
        if (jpegObjectUrlRef.current) {
          URL.revokeObjectURL(jpegObjectUrlRef.current);
        }
        jpegObjectUrlRef.current = nextUrl;
        setJpegObjectUrl(nextUrl);
        setV1Path(status.path);
        setV1FrameIndex(status.frame_index);
        setSightError(null);
      } catch (previewError) {
        if (!cancelled) {
          setSightError(previewError?.message || 'V1 simulation is not reachable.');
        }
      }
    };

    const postSight = async () => {
      if (!assistantId || !sendAmbientObservation) return;
      try {
        const jpegBlob = await fetchV1Jpeg(LINK_V1_URL);
        if (cancelled) return;
        await sendAmbientObservation([webcamJpegFileFromBlob(jpegBlob)], {
          cameraFacing: V1_CAMERA_FACING,
        });
        setSightError(null);
      } catch (observationError) {
        if (!cancelled) {
          setSightError(
            observationError?.message || 'Could not post the reconstructed still.'
          );
        }
      }
    };

    refreshPreview();
    postSight();
    const previewTimer = window.setInterval(refreshPreview, V1_PREVIEW_POLL_MS);
    const observationTimer = window.setInterval(postSight, AMBIENT_CAPTURE_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(previewTimer);
      window.clearInterval(observationTimer);
      if (jpegObjectUrlRef.current) {
        URL.revokeObjectURL(jpegObjectUrlRef.current);
        jpegObjectUrlRef.current = null;
      }
    };
  }, [sightEnabled, assistantId, sendAmbientObservation]);

  useEffect(() => {
    if (!wristEnabled) {
      setTrailPoints([]);
      setMotionPath(null);
      setLastRecorded(null);
      setWristError(null);
      return undefined;
    }

    let cancelled = false;

    const refreshTrail = async () => {
      try {
        const snapshot = await fetchMotionCurrent(LINK_MOTION_URL);
        if (cancelled) return;
        setMotionPath(snapshot.path);
        setTrailPoints((points) => appendTrailPoint(points, trailPointFromCurrent(snapshot)));
        setWristError(null);
      } catch (trailError) {
        if (!cancelled) {
          setWristError(trailError?.message || 'Motion simulation is not reachable.');
        }
      }
    };

    const postWindow = async () => {
      if (!assistantId) return;
      try {
        const windowPayload = await fetchMotionCurrentWindow(LINK_MOTION_URL);
        if (cancelled) return;
        const outcome = await postAvatarMotionTrack(assistantId, windowPayload, {
          source: NEURAL_DECODER_SOURCE,
        });
        setLastRecorded(outcome);
        setWristError(null);
      } catch (recordError) {
        if (!cancelled) {
          setWristError(
            recordError?.message || 'Could not record the decoder window.'
          );
        }
      }
    };

    refreshTrail();
    postWindow();
    const trailTimer = window.setInterval(refreshTrail, WRIST_TRAIL_POLL_MS);
    const windowTimer = window.setInterval(postWindow, WRIST_WINDOW_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(trailTimer);
      window.clearInterval(windowTimer);
    };
  }, [wristEnabled, assistantId]);

  return {
    assistantId,
    personalAvatar,
    sightEnabled,
    setSightEnabled,
    wristEnabled,
    setWristEnabled,
    jpegObjectUrl,
    v1Path,
    v1FrameIndex,
    trailPoints,
    motionPath,
    lastRecorded,
    sightError,
    wristError,
  };
}
