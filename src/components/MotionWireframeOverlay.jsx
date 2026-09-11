import { useEffect, useRef } from 'react';
import { BODY_OVERLAY_EDGES } from '../services/motionWireframe';

/**
 * Draw the wireframe over a camera preview: green landmark dots and the few
 * body edges that make a skeleton legible at tile size. Points arrive in
 * normalized image coordinates; the canvas is sized to the element it covers.
 *
 * @param {{ points: {x:number,y:number,kind:string}[], mirrored?: boolean, className?: string }} props
 */
export default function MotionWireframeOverlay({ points, mirrored = false, className = '' }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    const width = parent?.clientWidth || canvas.clientWidth || 96;
    const height = parent?.clientHeight || canvas.clientHeight || 96;
    const ratio = window.devicePixelRatio || 1;
    if (canvas.width !== width * ratio || canvas.height !== height * ratio) {
      canvas.width = width * ratio;
      canvas.height = height * ratio;
    }
    const context = canvas.getContext('2d');
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    if (!points?.length) return;
    // The preview is object-cover; assume the stream aspect roughly matches
    // the tile so normalized coordinates map straight onto it.
    const toX = (x) => (mirrored ? 1 - x : x) * width;
    const toY = (y) => y * height;
    const body = {};
    let bodyIndex = 0;
    for (const point of points) {
      if (point.kind === 'body') {
        body[bodyIndex] = point;
        bodyIndex += 1;
      }
    }
    context.lineWidth = 1.5;
    context.strokeStyle = 'rgba(74, 222, 128, 0.7)';
    const bodyPoints = points.filter((point) => point.kind === 'body');
    // Edges are by joint index; with invisible joints dropped, map by order is
    // wrong, so draw edges only when both endpoints were kept (dense case).
    if (bodyPoints.length === 33) {
      for (const [a, b] of BODY_OVERLAY_EDGES) {
        context.beginPath();
        context.moveTo(toX(bodyPoints[a].x), toY(bodyPoints[a].y));
        context.lineTo(toX(bodyPoints[b].x), toY(bodyPoints[b].y));
        context.stroke();
      }
    }
    for (const point of points) {
      const radius = point.kind === 'body' ? 3 : 1.5;
      context.beginPath();
      context.arc(toX(point.x), toY(point.y), radius, 0, Math.PI * 2);
      context.fillStyle = point.kind === 'body' ? '#22c55e' : 'rgba(134, 239, 172, 0.9)';
      context.fill();
      if (point.kind === 'body') {
        context.strokeStyle = 'white';
        context.lineWidth = 1;
        context.stroke();
      }
    }
  }, [points, mirrored]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 w-full h-full ${className}`.trim()}
    />
  );
}
