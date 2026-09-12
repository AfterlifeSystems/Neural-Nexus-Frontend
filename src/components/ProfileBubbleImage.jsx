// src/components/ProfileBubbleImage.jsx
//
// A profile bubble that uses the crop framed in Avatar Settings.
// The frame fills a sized, positioned parent (`absolute inset-0`). An
// absolutely placed crop must not be the only in-flow child of a flex
// circle — that shrinks the frame to nothing and leaves a black square.

import { useEffect, useRef, useState } from 'react';

import {
  profileBubbleCoverLayout,
  readProfileBubbleViewport,
  subscribeProfileBubbleViewport,
} from '../services/profileBubbleViewport';

/**
 * @param {Object} props
 * @param {string} props.src
 * @param {string} props.alt
 * @param {string|null|undefined} [props.assistantId]
 * @param {string} [props.className] Extra classes on the filling frame.
 * @param {Function} [props.onError]
 */
const ProfileBubbleImage = ({
  src,
  alt,
  assistantId = null,
  className = '',
  onError,
}) => {
  const frameRef = useRef(null);
  const [frameSize, setFrameSize] = useState({ width: 0, height: 0 });
  const [mediaSize, setMediaSize] = useState({ width: 0, height: 0 });
  const [viewport, setViewport] = useState(() =>
    readProfileBubbleViewport(assistantId)
  );

  useEffect(() => {
    setViewport(readProfileBubbleViewport(assistantId));
    return subscribeProfileBubbleViewport(assistantId, setViewport);
  }, [assistantId]);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || typeof ResizeObserver === 'undefined') return undefined;
    const update = () => {
      setFrameSize({
        width: frame.clientWidth,
        height: frame.clientHeight,
      });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [src]);

  const mediaWidth = mediaSize.width || Number(viewport.mediaWidth) || 0;
  const mediaHeight = mediaSize.height || Number(viewport.mediaHeight) || 0;
  const hasMedia = mediaWidth > 0 && mediaHeight > 0;
  const painted =
    frameSize.width > 0 && frameSize.height > 0 && hasMedia
      ? readProfileBubbleViewport(assistantId, {
          ...frameSize,
          mediaWidth,
          mediaHeight,
        })
      : null;
  const layout = painted
    ? profileBubbleCoverLayout(painted, {
        ...frameSize,
        mediaWidth: painted.mediaWidth ?? mediaWidth,
        mediaHeight: painted.mediaHeight ?? mediaHeight,
      })
    : null;
  const hasUsableLayout =
    Boolean(layout) && layout.width > 0 && layout.height > 0;

  const rememberMediaSize = (imageEvent) => {
    const image = imageEvent.currentTarget;
    if (image.naturalWidth > 0 && image.naturalHeight > 0) {
      setMediaSize({
        width: image.naturalWidth,
        height: image.naturalHeight,
      });
    }
  };

  return (
    <div
      ref={frameRef}
      className={`absolute inset-0 overflow-hidden ${className}`.trim()}
    >
      {hasUsableLayout ? (
        <img
          src={src}
          alt={alt}
          draggable={false}
          onLoad={rememberMediaSize}
          onError={onError}
          className="absolute max-w-none"
          style={{
            width: layout.width,
            height: layout.height,
            left: layout.left,
            top: layout.top,
            objectFit: 'contain',
          }}
        />
      ) : (
        <img
          src={src}
          alt={alt}
          draggable={false}
          onLoad={rememberMediaSize}
          onError={onError}
          className="h-full w-full object-cover"
        />
      )}
    </div>
  );
};

export default ProfileBubbleImage;
