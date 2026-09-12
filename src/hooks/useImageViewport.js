// src/hooks/useImageViewport.js
//
// Pointer, wheel, and pinch for a framed picture. The math lives in
// imageViewport.js so this file only keeps the gesture state.

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  IMAGE_VIEWPORT_RESET,
  clampImageViewport,
  imageViewportCanPan,
  imageViewportCoverLayout,
  imageViewportCssTransform,
  imageViewportIsFramed,
  imageViewportIsZoomed,
  imageViewportPointerDistance,
  imageViewportScaleAfterPinch,
  imageViewportScaleAfterStep,
  imageViewportScaleAfterWheel,
  panImageViewport,
  readImageViewport,
  writeImageViewport,
  zoomImageViewport,
} from '../services/imageViewport';
import {
  assistantIdFromProfileBubbleKey,
  readProfileBubbleViewport,
  writeProfileBubbleViewport,
} from '../services/profileBubbleViewport';

const DRAG_THRESHOLD_PIXELS = 4;

const measureMedia = (element) => {
  const media = element?.querySelector?.('img, video, canvas');
  if (!media) return { width: 0, height: 0 };
  if (media.tagName === 'VIDEO') {
    return { width: media.videoWidth || 0, height: media.videoHeight || 0 };
  }
  if (media.tagName === 'CANVAS') {
    return { width: media.width || 0, height: media.height || 0 };
  }
  return {
    width: media.naturalWidth || 0,
    height: media.naturalHeight || 0,
  };
};

const measureFrame = (element, fit = 'contain') => {
  if (!element) return { width: 0, height: 0, fit };
  const media = measureMedia(element);
  return {
    width: element.clientWidth,
    height: element.clientHeight,
    fit,
    mediaWidth: media.width,
    mediaHeight: media.height,
  };
};

const originInFrame = (frame, clientX, clientY) => {
  const box = frame.getBoundingClientRect();
  return { x: clientX - box.left, y: clientY - box.top };
};

/**
 * @param {Object} [options]
 * @param {string|number|null} [options.resetKey] Changing this fits the picture again.
 * @param {string|null} [options.persistKey] localStorage slot, when the framing
 *   should come back the next time this picture is shown.
 * @param {'contain'|'cover'} [options.fit] Cover is the profile bubble crop.
 * @returns {{
 *   frameRef: React.RefObject<HTMLElement|null>,
 *   viewport: {scale: number, offsetX: number, offsetY: number},
 *   transformStyle: {transform: string, transformOrigin: string},
 *   isGrabbing: boolean,
 *   isZoomed: boolean,
 *   zoomIn: () => void,
 *   zoomOut: () => void,
 *   reset: () => void,
 *   onPointerDown: (event: PointerEvent) => void,
 *   onPointerMove: (event: PointerEvent) => void,
 *   onPointerUp: (event: PointerEvent) => void,
 *   onDoubleClick: (event: MouseEvent) => void,
 *   onKeyDown: (event: KeyboardEvent) => void,
 * }}
 */
export default function useImageViewport({
  resetKey = null,
  persistKey = null,
  fit = 'contain',
} = {}) {
  const frameRef = useRef(null);
  const viewportRef = useRef({ ...IMAGE_VIEWPORT_RESET });
  const pointersRef = useRef(new Map());
  const pinchRef = useRef(null);
  const dragRef = useRef(null);
  const [viewport, setViewportState] = useState(() => {
    const profileAssistantId = assistantIdFromProfileBubbleKey(persistKey);
    return profileAssistantId
      ? readProfileBubbleViewport(profileAssistantId)
      : clampImageViewport(readImageViewport(persistKey), null);
  });
  const [isGrabbing, setIsGrabbing] = useState(false);
  const fitRef = useRef(fit);
  fitRef.current = fit;

  const boundsOf = useCallback(
    (element = frameRef.current) => measureFrame(element, fitRef.current),
    []
  );

  const commit = useCallback(
    (next) => {
      const bounds = boundsOf();
      const framed = {
        ...clampImageViewport(next, bounds),
        mediaWidth: bounds.mediaWidth,
        mediaHeight: bounds.mediaHeight,
      };
      viewportRef.current = framed;
      setViewportState(framed);
      const profileAssistantId = assistantIdFromProfileBubbleKey(persistKey);
      if (profileAssistantId) {
        writeProfileBubbleViewport(profileAssistantId, framed, bounds);
      } else {
        writeImageViewport(persistKey, framed);
      }
      return framed;
    },
    [boundsOf, persistKey]
  );

  useEffect(() => {
    const profileAssistantId = assistantIdFromProfileBubbleKey(persistKey);
    const stored = profileAssistantId
      ? readProfileBubbleViewport(profileAssistantId, boundsOf())
      : clampImageViewport(readImageViewport(persistKey), null);
    viewportRef.current = stored;
    setViewportState(stored);
    dragRef.current = null;
    pinchRef.current = null;
    pointersRef.current.clear();
    setIsGrabbing(false);
  }, [resetKey, persistKey, boundsOf]);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => {
      commit(viewportRef.current);
    });
    observer.observe(frame);
    return () => observer.disconnect();
  }, [commit]);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return undefined;
    const onWheel = (event) => {
      if (event.target.closest?.('button')) return;
      event.preventDefault();
      const nextScale = imageViewportScaleAfterWheel(
        viewportRef.current.scale,
        event.deltaY
      );
      commit(
        zoomImageViewport(
          viewportRef.current,
          nextScale,
          originInFrame(frame, event.clientX, event.clientY),
          boundsOf(frame)
        )
      );
    };
    frame.addEventListener('wheel', onWheel, { passive: false });
    return () => frame.removeEventListener('wheel', onWheel);
  }, [commit]);

  const zoomIn = useCallback(() => {
    const size = boundsOf();
    commit(
      zoomImageViewport(
        viewportRef.current,
        imageViewportScaleAfterStep(viewportRef.current.scale, 1),
        { x: size.width / 2, y: size.height / 2 },
        size
      )
    );
  }, [boundsOf, commit]);

  const zoomOut = useCallback(() => {
    const size = boundsOf();
    commit(
      zoomImageViewport(
        viewportRef.current,
        imageViewportScaleAfterStep(viewportRef.current.scale, -1),
        { x: size.width / 2, y: size.height / 2 },
        size
      )
    );
  }, [boundsOf, commit]);

  const reset = useCallback(() => {
    commit({ ...IMAGE_VIEWPORT_RESET });
  }, [commit]);

  const onPointerDown = useCallback((event) => {
    if (event.target.closest?.('button')) return;
    const frame = frameRef.current;
    if (!frame) return;
    pointersRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    try {
      event.currentTarget.setPointerCapture?.(event.pointerId);
    } catch {
      // Capture can fail if the pointer already went up.
    }
    if (pointersRef.current.size === 2) {
      const [first, second] = [...pointersRef.current.values()];
      pinchRef.current = {
        distance: imageViewportPointerDistance(
          first.x,
          first.y,
          second.x,
          second.y
        ),
      };
      dragRef.current = null;
      setIsGrabbing(false);
      return;
    }
    dragRef.current = {
      x: event.clientX,
      y: event.clientY,
      moved: false,
    };
  }, []);

  const onPointerMove = useCallback(
    (event) => {
      const frame = frameRef.current;
      if (!frame) return;
      if (pointersRef.current.has(event.pointerId)) {
        pointersRef.current.set(event.pointerId, {
          x: event.clientX,
          y: event.clientY,
        });
      }
      if (pointersRef.current.size >= 2 && pinchRef.current) {
        event.preventDefault();
        const [first, second] = [...pointersRef.current.values()];
        const distance = imageViewportPointerDistance(
          first.x,
          first.y,
          second.x,
          second.y
        );
        const nextScale = imageViewportScaleAfterPinch(
          viewportRef.current.scale,
          pinchRef.current.distance,
          distance
        );
        const midX = (first.x + second.x) / 2;
        const midY = (first.y + second.y) / 2;
        commit(
          zoomImageViewport(
            viewportRef.current,
            nextScale,
            originInFrame(frame, midX, midY),
            boundsOf(frame)
          )
        );
        pinchRef.current = { distance };
        return;
      }
      const drag = dragRef.current;
      if (!drag) return;
      const deltaX = event.clientX - drag.x;
      const deltaY = event.clientY - drag.y;
      if (
        !drag.moved &&
        Math.hypot(deltaX, deltaY) < DRAG_THRESHOLD_PIXELS
      ) {
        return;
      }
      if (!imageViewportCanPan(viewportRef.current, boundsOf(frame))) return;
      event.preventDefault();
      drag.moved = true;
      drag.x = event.clientX;
      drag.y = event.clientY;
      if (!isGrabbing) setIsGrabbing(true);
      commit(
        panImageViewport(
          viewportRef.current,
          deltaX,
          deltaY,
          boundsOf(frame)
        )
      );
    },
    [commit, isGrabbing]
  );

  const onPointerUp = useCallback((event) => {
    pointersRef.current.delete(event.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;
    if (pointersRef.current.size === 0) {
      dragRef.current = null;
      setIsGrabbing(false);
    }
  }, []);

  const onDoubleClick = useCallback(
    (event) => {
      if (event.target.closest?.('button')) return;
      event.preventDefault();
      if (imageViewportIsZoomed(viewportRef.current)) {
        reset();
        return;
      }
      const frame = frameRef.current;
      if (!frame) return;
      commit(
          zoomImageViewport(
            viewportRef.current,
            imageViewportScaleAfterStep(1, 1) ** 3,
            originInFrame(frame, event.clientX, event.clientY),
            boundsOf(frame)
          )
      );
    },
    [commit, reset]
  );

  const onKeyDown = useCallback(
    (event) => {
      if (event.target.closest?.('button, input, textarea')) return;
      if (event.key === '+' || event.key === '=') {
        event.preventDefault();
        zoomIn();
        return;
      }
      if (event.key === '-' || event.key === '_') {
        event.preventDefault();
        zoomOut();
        return;
      }
      if (event.key === '0') {
        event.preventDefault();
        reset();
        return;
      }
      if (!imageViewportCanPan(viewportRef.current, boundsOf())) return;
      const step = 24;
      const moves = {
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, -step],
        ArrowDown: [0, step],
      };
      const delta = moves[event.key];
      if (!delta) return;
      event.preventDefault();
      commit(
        panImageViewport(
          viewportRef.current,
          delta[0],
          delta[1],
          boundsOf()
        )
      );
    },
    [boundsOf, commit, reset, zoomIn, zoomOut]
  );

  useEffect(() => {
    const frame = frameRef.current;
    const image = frame?.querySelector?.('img');
    if (!image) return undefined;
    const onLoad = () => commit(viewportRef.current);
    image.addEventListener('load', onLoad);
    if (image.complete && image.naturalWidth > 0) onLoad();
    return () => image.removeEventListener('load', onLoad);
  }, [commit, resetKey]);

  const bounds = boundsOf();

  return {
    frameRef,
    viewport,
    transformStyle: imageViewportCssTransform(viewport),
    coverLayout: imageViewportCoverLayout(viewport, bounds),
    isGrabbing,
    isZoomed: imageViewportIsZoomed(viewport),
    isFramed: imageViewportIsFramed(viewport),
    canPan: imageViewportCanPan(viewport, bounds),
    zoomIn,
    zoomOut,
    reset,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onDoubleClick,
    onKeyDown,
  };
}
