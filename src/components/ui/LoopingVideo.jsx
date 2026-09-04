// src/components/ui/LoopingVideo.jsx
import React, { useEffect, useRef, useState } from 'react';
import {
  createIdleLoopVideo,
  disposeIdleLoopTape,
  disposeIdleLoopVideo,
  paintIdleLoopFrame,
  stepIdleLoopMedia,
} from './idleLoopSeam';

const IDLE_LOOP_MAX_EDGE = 512;

/**
 * A silent, looping, autoplaying video with a still as its poster.
 *
 * The still and the loop of a swap are decoded off-screen, then one of them
 * is shown — never both. Stacking the poster under a contained video was
 * painting two faces. The outgoing frame stays up until the incoming pair is
 * ready, then they crossfade.
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
  mediaClassName = 'w-full h-full object-cover',
}) => {
  const [layers, setLayers] = useState(() => [{ id: 0, src, poster }]);
  const [visibleId, setVisibleId] = useState(null);
  const nextIdRef = useRef(1);
  const visibleIdRef = useRef(null);
  const layersRef = useRef(layers);
  const videoElementsRef = useRef(new Map());
  const hiddenVideosRef = useRef(new Map());
  const canvasElementsRef = useRef(new Map());
  const loopRef = useRef(loop);
  const onEndedRef = useRef(onEnded);
  const onPresentedRef = useRef(onPresented);
  const readyRef = useRef({});
  const presentedOnceRef = useRef(false);
  const [crossfade, setCrossfade] = useState(false);

  visibleIdRef.current = visibleId;
  layersRef.current = layers;
  loopRef.current = loop;
  onEndedRef.current = onEnded;
  onPresentedRef.current = onPresented;

  const revealIfReady = (layerId) => {
    const layer = layersRef.current.find((item) => item.id === layerId);
    if (!layer) return;
    const ready = readyRef.current[layerId] ?? {};
    if (layer.poster && !ready.poster) return;
    if (layer.src && !ready.video) return;
    if (!layer.poster && !layer.src) return;
    const alreadyShowing = visibleIdRef.current === layerId;
    setVisibleId(layerId);
    if (!alreadyShowing) {
      onPresentedRef.current?.({ src: layer.src, poster: layer.poster });
    }
    setTimeout(() => {
      setLayers((previous) => {
        const latest = previous[previous.length - 1];
        const next = previous.filter(
          (item) => item.id === visibleIdRef.current || item.id === latest?.id
        );
        layersRef.current = next;
        return next;
      });
    }, 500);
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
    }
    for (const [layerId, video] of hiddenVideosRef.current) {
      if (wanted.has(layerId)) continue;
      disposeIdleLoopVideo(video);
      hiddenVideosRef.current.delete(layerId);
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
        if (canvas) paintIdleLoopFrame(canvas, video);
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
    if (visibleId == null) return undefined;
    if (presentedOnceRef.current) {
      setCrossfade(true);
    }
    presentedOnceRef.current = true;
    return undefined;
  }, [visibleId]);

  const fadeClass = crossfade ? 'transition-opacity duration-500 ease-in-out' : '';
  const useHiddenIdle = pingPong !== false;

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {layers.map((layer) => {
        const shown = layer.id === visibleId;
        const layerClass = `absolute inset-0 ${mediaClassName} ${fadeClass} ${
          shown ? 'opacity-100' : 'opacity-0'
        }`;
        if (layer.src && useHiddenIdle) {
          return (
            <canvas
              key={layer.id}
              ref={(element) => {
                if (element) {
                  canvasElementsRef.current.set(layer.id, element);
                } else {
                  canvasElementsRef.current.delete(layer.id);
                }
              }}
              aria-label={alt}
              className={layerClass}
            />
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
                  }
                } else {
                  const existing = videoElementsRef.current.get(layer.id);
                  disposeIdleLoopTape(existing);
                  videoElementsRef.current.delete(layer.id);
                }
              }}
              src={layer.src}
              crossOrigin={
                typeof layer.src === 'string' &&
                (layer.src.startsWith('http://') || layer.src.startsWith('https://'))
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
              }}
              onError={() => markReady(layer.id, 'video')}
              onEnded={() => {
                if (loopRef.current) return;
                if (layer.id !== visibleIdRef.current) return;
                onEndedRef.current?.();
              }}
              className={layerClass}
            />
          );
        }
        if (layer.poster) {
          return (
            <img
              key={layer.id}
              src={layer.poster}
              alt={shown ? alt : ''}
              className={layerClass}
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
