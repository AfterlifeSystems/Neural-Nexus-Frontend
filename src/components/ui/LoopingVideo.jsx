// src/components/ui/LoopingVideo.jsx
import React, { useEffect, useRef, useState } from 'react';
import {
  attachIdleLoopCapture,
  disposeIdleLoopTape,
  idleLoopReverseImage,
  idleLoopUsesNativeLoop,
  stepIdleLoopPingPong,
} from './idleLoopSeam';

/**
 * A silent, looping, autoplaying video with a still as its poster.
 *
 * Idle loops are meant to start and end on the same frame. When they do not,
 * the clip plays forward then reverse so the seam is not a jump. Native
 * looping stays on until a reverse tape is ready, so the stage does not
 * freeze at the last frame. `muted` and `playsInline` are what let a
 * browser autoplay at all.
 *
 * @param {Object} parameters
 * @param {string} [parameters.src] The loop URL; when absent the poster shows.
 * @param {string} [parameters.poster] The still to show before the first frame.
 * @param {string} [parameters.alt] Accessible description.
 * @param {boolean} [parameters.loop] Whether to loop (a lip-sync clip does not).
 * @param {boolean|'auto'} [parameters.pingPong] Reverse at the end instead of
 *   wrapping to frame 0. `'auto'` (the default while looping) records the
 *   first play and only reverses when the ends do not match.
 * @param {Function} [parameters.onEnded] Called when a non-looping clip ends.
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
  className = '',
  mediaClassName = 'w-full h-full object-cover',
}) => {
  const [layers, setLayers] = useState(() => [{ id: 0, src }]);
  const [visibleId, setVisibleId] = useState(0);
  const [usePingPong, setUsePingPong] = useState(pingPong === true);
  const nextIdRef = useRef(1);
  const directionRef = useRef(1);
  const visibleIdRef = useRef(0);
  const videoElementsRef = useRef(new Map());
  const reverseCanvasRef = useRef(null);
  const usePingPongRef = useRef(usePingPong);
  const allowPingPongRef = useRef(loop && pingPong !== false);

  visibleIdRef.current = visibleId;
  usePingPongRef.current = usePingPong;
  allowPingPongRef.current = loop && pingPong !== false;

  useEffect(() => {
    directionRef.current = 1;
    setUsePingPong(pingPong === true);
    setLayers((previous) => {
      const current = previous.find((layer) => layer.id === visibleIdRef.current);
      if (current?.src === src) return previous;
      const incoming = { id: nextIdRef.current, src };
      nextIdRef.current += 1;
      return [
        ...previous.filter((layer) => layer.id === visibleIdRef.current),
        incoming,
      ];
    });
  }, [src, pingPong]);

  useEffect(() => {
    if (!loop || pingPong === false) return undefined;
    let raf = 0;
    const tick = (now) => {
      if (allowPingPongRef.current) {
        const video = videoElementsRef.current.get(visibleIdRef.current);
        if (video) {
          directionRef.current = stepIdleLoopPingPong(
            video,
            directionRef.current,
            now
          );
          const active = !idleLoopUsesNativeLoop(video);
          if (active !== usePingPongRef.current) {
            usePingPongRef.current = active;
            setUsePingPong(active);
          }
          const reverseFrame = idleLoopReverseImage(video);
          const canvas = reverseCanvasRef.current;
          if (canvas) {
            if (reverseFrame) {
              if (
                canvas.width !== reverseFrame.width ||
                canvas.height !== reverseFrame.height
              ) {
                canvas.width = reverseFrame.width;
                canvas.height = reverseFrame.height;
              }
              const context = canvas.getContext('2d');
              if (context) context.drawImage(reverseFrame, 0, 0);
              canvas.style.opacity = '1';
            } else {
              canvas.style.opacity = '0';
            }
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [loop, src, pingPong]);

  useEffect(
    () => () => {
      videoElementsRef.current.forEach((video) => disposeIdleLoopTape(video));
      videoElementsRef.current.clear();
    },
    []
  );

  const handleReady = (layerId) => {
    setVisibleId(layerId);
    setTimeout(() => {
      setLayers((previous) => previous.filter((layer) => layer.id === layerId));
    }, 400);
  };

  const videoIsShowing = layers.some(
    (layer) => layer.id === visibleId && layer.src
  );

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {poster && !videoIsShowing && (
        <img
          src={poster}
          alt={alt}
          className={`absolute inset-0 ${mediaClassName}`}
          draggable={false}
        />
      )}
      {layers.map((layer) =>
        layer.src ? (
          <video
            key={layer.id}
            ref={(element) => {
              if (element) {
                videoElementsRef.current.set(layer.id, element);
                attachIdleLoopCapture(element);
              } else {
                const existing = videoElementsRef.current.get(layer.id);
                disposeIdleLoopTape(existing);
                videoElementsRef.current.delete(layer.id);
              }
            }}
            src={layer.src}
            poster={poster}
            crossOrigin="anonymous"
            loop={loop && !usePingPong}
            autoPlay
            muted
            playsInline
            preload="auto"
            aria-label={alt}
            onLoadedData={() => handleReady(layer.id)}
            onEnded={() => {
              if (usePingPongRef.current && loop) return;
              if (allowPingPongRef.current) return;
              onEnded?.();
            }}
            className={`absolute inset-0 ${mediaClassName} transition-opacity duration-300 ${
              layer.id === visibleId ? 'opacity-100' : 'opacity-0'
            }`}
          />
        ) : null
      )}
      <canvas
        ref={reverseCanvasRef}
        aria-hidden="true"
        className={`absolute inset-0 ${mediaClassName} pointer-events-none`}
        style={{ opacity: 0 }}
      />
    </div>
  );
};

export default LoopingVideo;
