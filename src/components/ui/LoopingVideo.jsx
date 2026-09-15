// src/components/ui/LoopingVideo.jsx
import React, { useEffect, useRef, useState } from 'react';
import {
  corsDecodableMediaUrl,
  createIdleLoopVideo,
  disposeIdleLoopTape,
  disposeIdleLoopVideo,
  paintIdleLoopFrame,
  stepIdleLoopMedia,
} from './idleLoopSeam';
import {
  loopingVideoLayerMayReveal,
  loopingVideoLayerIsShown,
  loopingVideoLayersAfterReveal,
  loopingVideoPosterIsVisible,
} from './loopingVideoLayer';

const IDLE_LOOP_MAX_EDGE = 512;

/**
 * A silent, looping, autoplaying video with a still as its poster.
 *
 * The still of a swap is shown as soon as it has decoded. The idle loop
 * paints over it once a frame exists. Waiting for both before showing
 * anything left voice mode empty while the loop's decoder had not started.
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
    // #region agent log
    fetch('http://127.0.0.1:7435/ingest/1ee0e368-4b09-4cc1-9ed9-f1724140320e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'97868d'},body:JSON.stringify({sessionId:'97868d',runId:'post-fix',hypothesisId:'E',location:'LoopingVideo.jsx:revealIfReady',message:'looping video reveal',data:{layerId,alreadyShowing,visibleId:visibleIdRef.current,hasPoster:Boolean(layer.poster),hasSrc:Boolean(layer.src),layerCount:layersRef.current.length},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
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
        if (canvas && paintIdleLoopFrame(canvas, video)) {
          if (!loopPaintedIdsRef.current.has(layerId)) {
            loopPaintedIdsRef.current.add(layerId);
            setLoopPaintedIds((previous) => {
              if (previous.has(layerId)) return previous;
              const next = new Set(previous);
              next.add(layerId);
              return next;
            });
            if (layerId === visibleIdRef.current) {
              const layer = layersRef.current.find(
                (item) => item.id === layerId
              );
              onPresentedRef.current?.({
                src: layer?.src,
                poster: layer?.poster,
              });
            }
          }
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
        const shown = loopingVideoLayerIsShown(
          layer.id,
          visibleId,
          layers[0]?.id
        );
        const layerClass = `absolute inset-0 ${mediaClassName} ${
          shown ? 'opacity-100' : 'opacity-0'
        }`;
        if (layer.src && useHiddenIdle) {
          const showPoster = loopingVideoPosterIsVisible(
            layer,
            loopPaintedIds.has(layer.id)
          );
          return (
            <React.Fragment key={layer.id}>
              {showPoster ? (
                <img
                  src={layer.poster}
                  alt={shown ? alt : ''}
                  className={layerClass}
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
                className={layerClass}
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
