// src/components/ui/LoopingVideo.jsx
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  corsDecodableMediaUrl,
  createIdleLoopVideo,
  disposeIdleLoopTape,
  disposeIdleLoopVideo,
  findMountedIdleLoopVideo,
  idleLoopPaintKeyState,
  idleLoopVideoCanPaint,
  paintIdleLoopFrame,
  stepIdleLoopMedia,
} from './idleLoopSeam';
import {
  loopingVideoLayerMayReveal,
  loopingVideoLayerIsShown,
  loopingVideoLayersAfterReveal,
  loopingVideoPosterIsVisible,
  loopingVideoIdleLayerIsShown,
} from './loopingVideoLayer';

const IDLE_LOOP_MAX_EDGE = 512;

/**
 * A silent, looping, autoplaying video with a still as its poster.
 *
 * The still of a swap is shown as soon as it has decoded. The idle loop
 * paints over it once a frame exists. Waiting for the clip before showing
 * anything left voice mode empty while the decoder started — switching
 * felt slow and the well was a hollow frame. The unpainted canvas stays
 * opacity 0 so a 300×150 default size does not flash on top of the still.
 * The still is then taken off: contain letterboxes a 9:16 canvas, and a
 * transparent letterbox would show the square still beside the clip.
 * The outgoing frame stays up until the incoming still is ready, then the
 * incoming face replaces the outgoing face in the same paint. A dissolve
 * left two faces on screen.
 *
 * Idle loops are not cyclic clips. They play forward, then reverse, so
 * wrapping to frame 0 is never a jump — the same hidden-video path as the
 * avatar carousel. Reverse is the same wall-clock duration as the clip.
 *
 * Lip-sync clips (`pingPong={false}`) play once in a visible video element.
 *
 * `muted` and `playsInline` are what let a browser autoplay at all.
 *
 * @param {Object} parameters
 * @param {string} [parameters.src] The loop URL; when absent the poster shows.
 * @param {string} [parameters.poster] The still to show before the first frame.
 * @param {string} [parameters.alt] Accessible description.
 * @param {boolean} [parameters.loop] Whether to keep ping-ponging. A lip-sync
 *   clip does not.
 * @param {boolean|'auto'} [parameters.pingPong] Reverse at the end instead of
 *   wrapping to frame 0. `'auto'` (the default while looping) records the
 *   first play and then reverses.
 * @param {Function} [parameters.onEnded] Called when a non-looping clip
 *   finishes (after the reverse, when ping-pong is active).
 * @param {Function} [parameters.onPresented] Called when a newly decoded
 *   still or loop is shown. Voice mode waits for this so the caption and
 *   the face change in the same paint.
 * @param {string} [parameters.className] Sizing classes for the frame.
 * @param {string} [parameters.mediaClassName] Fit classes for the media.
 *   Default is `object-contain` so a 9:16 generated loop shows in full.
 */
const LoopingVideo = ({
  src,
  poster,
  alt = '',
  loop = true,
  pingPong = 'auto',
  onEnded,
  onPresented,
  className = '',
  mediaClassName = 'w-full h-full object-contain',
}) => {
  const [layers, setLayers] = useState(() => [{ id: 0, src, poster }]);
  const [visibleId, setVisibleId] = useState(null);
  const nextIdRef = useRef(1);
  const visibleIdRef = useRef(null);
  const layersRef = useRef(layers);
  const videoElementsRef = useRef(new Map());
  const hiddenVideosRef = useRef(new Map());
  const canvasElementsRef = useRef(new Map());
  const lastPaintKeyRef = useRef(new Map());
  const loopRef = useRef(loop);
  const onEndedRef = useRef(onEnded);
  const onPresentedRef = useRef(onPresented);
  const readyRef = useRef({});
  const loopPaintedIdsRef = useRef(new Set());
  const [loopPaintedIds, setLoopPaintedIds] = useState(() => new Set());

  visibleIdRef.current = visibleId;
  layersRef.current = layers;
  loopRef.current = loop;
  onEndedRef.current = onEnded;
  onPresentedRef.current = onPresented;

  const revealIfReady = (layerId) => {
    const layer = layersRef.current.find((item) => item.id === layerId);
    if (!layer) return;
    const ready = readyRef.current[layerId] ?? {};
    if (!loopingVideoLayerMayReveal(layer, ready)) return;
    const alreadyShowing = visibleIdRef.current === layerId;
    setVisibleId(layerId);
    if (!alreadyShowing) {
      onPresentedRef.current?.({ src: layer.src, poster: layer.poster });
    }
    setLayers((previous) => {
      const next = loopingVideoLayersAfterReveal(previous, layerId);
      layersRef.current = next;
      return next;
    });
  };

  const markReady = (layerId, kind) => {
    const current = readyRef.current[layerId] ?? {};
    if (current[kind]) {
      revealIfReady(layerId);
      return;
    }
    readyRef.current[layerId] = { ...current, [kind]: true };
    revealIfReady(layerId);
  };

  const markLoopPainted = (layerId, size = null) => {
    if (loopPaintedIdsRef.current.has(layerId)) return;
    loopPaintedIdsRef.current.add(layerId);
    setLoopPaintedIds((previous) => {
      if (previous.has(layerId)) return previous;
      const next = new Set(previous);
      next.add(layerId);
      return next;
    });
    markReady(layerId, 'loop');
  };

  const paintLoopIfReady = (layerId, src) => {
    const canvas = canvasElementsRef.current.get(layerId);
    const owned = hiddenVideosRef.current.get(layerId);
    const video = idleLoopVideoCanPaint(owned)
      ? owned
      : findMountedIdleLoopVideo(src);
    if (!canvas || !idleLoopVideoCanPaint(video)) return false;
    if (!paintIdleLoopFrame(canvas, video)) return false;
    markLoopPainted(layerId, {
      reusedMounted: video !== owned,
      canvasW: canvas.width,
      canvasH: canvas.height,
      videoW: video.videoWidth,
      videoH: video.videoHeight,
    });
    return true;
  };

  useEffect(() => {
    setLayers((previous) => {
      const latest = previous[previous.length - 1];
      if (latest?.src === src && latest?.poster === poster) return previous;
      const incoming = { id: nextIdRef.current, src, poster };
      nextIdRef.current += 1;
      const next = [
        ...previous.filter((layer) => layer.id === visibleIdRef.current),
        incoming,
      ];
      layersRef.current = next;
      return next;
    });
  }, [src, poster]);

  useEffect(() => {
    for (const layer of layers) {
      const ready = readyRef.current[layer.id] ?? {};
      if (ready.started) continue;
      readyRef.current[layer.id] = {
        started: true,
        poster: !layer.poster,
        video: !layer.src,
      };
      if (!layer.poster) {
        revealIfReady(layer.id);
        continue;
      }
      const image = new Image();
      const finishPoster = () => markReady(layer.id, 'poster');
      image.onload = () => {
        if (typeof image.decode === 'function') {
          image.decode().then(finishPoster).catch(finishPoster);
        } else {
          finishPoster();
        }
      };
      image.onerror = finishPoster;
      image.src = layer.poster;
      if (image.complete && image.naturalWidth > 0) {
        if (typeof image.decode === 'function') {
          image.decode().then(finishPoster).catch(finishPoster);
        } else {
          finishPoster();
        }
      }
    }
  }, [layers]);

  // Paint a 9:16 frame from the carousel's already-decoded loop before the
  // browser paints, so the square still never fills the well and then unzooms.
  useLayoutEffect(() => {
    if (pingPong === false) return undefined;
    for (const layer of layers) {
      if (!layer.src) continue;
      paintLoopIfReady(layer.id, layer.src);
    }
    return undefined;
  }, [layers, pingPong]);

  // Idle loops: same hidden video as the carousel. React never owns `loop`.
  useEffect(() => {
    if (pingPong === false) {
      hiddenVideosRef.current.forEach((video) => disposeIdleLoopVideo(video));
      hiddenVideosRef.current.clear();
      return undefined;
    }
    const wanted = new Set();
    for (const layer of layers) {
      if (!layer.src) continue;
      wanted.add(layer.id);
      if (hiddenVideosRef.current.has(layer.id)) continue;
      const layerId = layer.id;
      const video = createIdleLoopVideo(layer.src, {
        repeat: loopRef.current,
        maxEdge: IDLE_LOOP_MAX_EDGE,
        onLoaded: () => markReady(layerId, 'video'),
        onError: () => markReady(layerId, 'video'),
      });
      hiddenVideosRef.current.set(layerId, video);
      paintLoopIfReady(layerId, layer.src);
    }
    for (const [layerId, video] of hiddenVideosRef.current) {
      if (wanted.has(layerId)) continue;
      disposeIdleLoopVideo(video);
      hiddenVideosRef.current.delete(layerId);
      lastPaintKeyRef.current.delete(layerId);
    }
    return undefined;
  }, [layers, pingPong]);

  useEffect(() => {
    if (pingPong === false) return undefined;
    let raf = 0;
    const tick = (now) => {
      for (const [layerId, video] of hiddenVideosRef.current) {
        video._idleLoopMaxEdge = IDLE_LOOP_MAX_EDGE;
        const stepped = stepIdleLoopMedia(
          video,
          video._idleLoopDirection ?? 1,
          now,
          { repeat: loopRef.current }
        );
        video._idleLoopDirection = stepped.direction;
        const canvas = canvasElementsRef.current.get(layerId);
        const paintState = idleLoopPaintKeyState(
          video,
          lastPaintKeyRef.current.get(layerId)
        );
        const shouldPaint =
          canvas &&
          (!paintState.unchanged || !loopPaintedIdsRef.current.has(layerId));
        if (shouldPaint && paintIdleLoopFrame(canvas, video)) {
          lastPaintKeyRef.current.set(layerId, paintState.key);
          const firstPaint = !loopPaintedIdsRef.current.has(layerId);
          markLoopPainted(layerId, {
            canvasW: canvas.width,
            canvasH: canvas.height,
            videoW: video.videoWidth,
            videoH: video.videoHeight,
          });
          if (firstPaint && layerId === visibleIdRef.current) {
            const layer = layersRef.current.find(
              (item) => item.id === layerId
            );
            onPresentedRef.current?.({
              src: layer?.src,
              poster: layer?.poster,
            });
          }
        } else if (paintState.unchanged) {
          lastPaintKeyRef.current.set(layerId, paintState.key);
        }
        if (layerId === visibleIdRef.current && stepped.cycleEnded) {
          onEndedRef.current?.();
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [pingPong]);

  useEffect(
    () => () => {
      hiddenVideosRef.current.forEach((video) => disposeIdleLoopVideo(video));
      hiddenVideosRef.current.clear();
      videoElementsRef.current.forEach((video) => disposeIdleLoopTape(video));
      videoElementsRef.current.clear();
    },
    []
  );

  useEffect(() => {
    const wanted = new Set(layers.map((layer) => layer.id));
    const previous = loopPaintedIdsRef.current;
    const next = new Set();
    let changed = false;
    for (const id of previous) {
      if (wanted.has(id)) {
        next.add(id);
      } else {
        changed = true;
      }
    }
    if (!changed) return;
    loopPaintedIdsRef.current = next;
    setLoopPaintedIds(next);
  }, [layers]);

  const useHiddenIdle = pingPong !== false;

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {layers.map((layer) => {
        const loopHasPainted = loopPaintedIds.has(layer.id);
        const layerShown = loopingVideoLayerIsShown(
          layer.id,
          visibleId,
          layers[0]?.id
        );
        const loopShown = loopingVideoIdleLayerIsShown(
          layerShown,
          loopHasPainted,
          Boolean(layer.src)
        );
        const posterClass = `absolute inset-0 ${mediaClassName} ${
          layerShown ? 'opacity-100' : 'opacity-0'
        }`;
        const loopClass = `absolute inset-0 ${mediaClassName} ${
          loopShown ? 'opacity-100' : 'opacity-0'
        }`;
        if (layer.src && useHiddenIdle) {
          const mountedLoopReady = Boolean(
            findMountedIdleLoopVideo(layer.src)
          );
          const showPoster = loopingVideoPosterIsVisible(
            layer,
            loopHasPainted || mountedLoopReady
          );
          return (
            <React.Fragment key={layer.id}>
              {showPoster ? (
                <img
                  src={layer.poster}
                  alt={layerShown ? alt : ''}
                  className={posterClass}
                  draggable={false}
                />
              ) : null}
              <canvas
                ref={(element) => {
                  if (element) {
                    canvasElementsRef.current.set(layer.id, element);
                  } else {
                    canvasElementsRef.current.delete(layer.id);
                  }
                }}
                aria-label={alt}
                className={loopClass}
              />
            </React.Fragment>
          );
        }
        if (layer.src) {
          return (
            <video
              key={layer.id}
              ref={(element) => {
                if (element) {
                  videoElementsRef.current.set(layer.id, element);
                  if (element.readyState >= 2) {
                    markReady(layer.id, 'video');
                    if (element.videoWidth > 0) {
                      markLoopPainted(layer.id, {
                        videoW: element.videoWidth,
                        videoH: element.videoHeight,
                      });
                    }
                  }
                } else {
                  const existing = videoElementsRef.current.get(layer.id);
                  disposeIdleLoopTape(existing);
                  videoElementsRef.current.delete(layer.id);
                }
              }}
              src={corsDecodableMediaUrl(layer.src)}
              crossOrigin={
                typeof layer.src === 'string' &&
                (layer.src.startsWith('http://') ||
                  layer.src.startsWith('https://'))
                  ? 'anonymous'
                  : undefined
              }
              loop={loop}
              autoPlay
              muted
              playsInline
              preload="auto"
              aria-label={alt}
              onLoadedData={(event) => {
                if (layer.id !== visibleIdRef.current) {
                  event.currentTarget.pause();
                  try {
                    event.currentTarget.currentTime = 0;
                  } catch {
                    // Seeking before the first frame is ready is harmless.
                  }
                }
                markReady(layer.id, 'video');
                if (event.currentTarget.videoWidth > 0) {
                  markLoopPainted(layer.id, {
                    videoW: event.currentTarget.videoWidth,
                    videoH: event.currentTarget.videoHeight,
                  });
                }
                if (layer.id === visibleIdRef.current) {
                  onPresentedRef.current?.({
                    src: layer.src,
                    poster: layer.poster,
                  });
                }
              }}
              onError={() => markReady(layer.id, 'video')}
              onEnded={() => {
                if (loopRef.current) return;
                if (layer.id !== visibleIdRef.current) return;
                onEndedRef.current?.();
              }}
              className={loopClass}
            />
          );
        }
        if (layer.poster) {
          return (
            <img
              key={layer.id}
              src={layer.poster}
              alt={layerShown ? alt : ''}
              className={posterClass}
              draggable={false}
            />
          );
        }
        return null;
      })}
    </div>
  );
};

export default LoopingVideo;
