// src/components/ui/LoopingVideo.jsx
import React, { useEffect, useRef, useState } from 'react';

/**
 * A silent, looping, autoplaying video with a still as its poster.
 *
 * The idle loops are generated so their first and last frames match the still,
 * so `loop` plays them end to end without a visible seam. `muted` and
 * `playsInline` are what let a browser autoplay at all — an unmuted autoplay is
 * blocked everywhere, and iOS insists on inline playback. When the source
 * changes (a new emotion) the previous clip keeps showing until the next one
 * has a frame ready, then the two cross-fade, so an emotion swap never flashes
 * the poster.
 *
 * @param {Object} parameters
 * @param {string} [parameters.src] The loop URL; when absent the poster shows.
 * @param {string} [parameters.poster] The still to show before the first frame.
 * @param {string} [parameters.alt] Accessible description.
 * @param {boolean} [parameters.loop] Whether to loop (a lip-sync clip does not).
 * @param {Function} [parameters.onEnded] Called when a non-looping clip ends.
 * @param {string} [parameters.className] Sizing classes for the frame.
 * @param {string} [parameters.mediaClassName] Fit classes for the media.
 */
const LoopingVideo = ({
  src,
  poster,
  alt = '',
  loop = true,
  onEnded,
  className = '',
  mediaClassName = 'w-full h-full object-cover',
}) => {
  // Two layers: the one on screen and the one loading. Swapping `src` on a
  // single element blanks it for a frame, which reads as a flicker.
  const [layers, setLayers] = useState(() => [{ id: 0, src }]);
  const [visibleId, setVisibleId] = useState(0);
  const nextIdRef = useRef(1);

  useEffect(() => {
    setLayers((previous) => {
      const current = previous.find((layer) => layer.id === visibleId);
      if (current?.src === src) return previous;
      const incoming = { id: nextIdRef.current, src };
      nextIdRef.current += 1;
      return [...previous.filter((layer) => layer.id === visibleId), incoming];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  const handleReady = (layerId) => {
    setVisibleId(layerId);
    // Drop the layer that just faded out once the new one is showing.
    setTimeout(() => {
      setLayers((previous) => previous.filter((layer) => layer.id === layerId));
    }, 400);
  };

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {poster && (
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
            src={layer.src}
            poster={poster}
            loop={loop}
            autoPlay
            muted
            playsInline
            preload="auto"
            aria-label={alt}
            onLoadedData={() => handleReady(layer.id)}
            onEnded={() => onEnded?.()}
            className={`absolute inset-0 ${mediaClassName} transition-opacity duration-300 ${
              layer.id === visibleId ? 'opacity-100' : 'opacity-0'
            }`}
          />
        ) : null
      )}
    </div>
  );
};

export default LoopingVideo;
