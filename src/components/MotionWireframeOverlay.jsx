import { useEffect, useRef } from 'react';
import { MOTION_MESH_MIN_WIDTH_PX } from '../config/motionWireframe';
import { BODY_OVERLAY_EDGES, coverTransform } from '../services/motionWireframe';

const MESH_STROKE = 'rgba(74, 222, 128, 0.45)';
const CONTOUR_STROKE = 'rgba(134, 239, 172, 0.95)';
const SKELETON_STROKE = 'rgba(74, 222, 128, 0.8)';
const JOINT_FILL = '#22c55e';
const VISIBILITY_FLOOR = 0.7;

/**
 * Draw the wireframe over a camera preview: the face mesh the landmarker
 * actually produces — all 478 vertices joined by the library's own
 * tessellation — plus the body skeleton.
 *
 * The preview fills its tile with `object-cover`, which crops the video, so
 * normalized landmark coordinates are mapped through the same cover transform
 * or the mesh sits beside the face instead of on it.
 *
 * @param {{
 *   frame: {face: Float32Array|null, body: Float32Array|null},
 *   meshEdges: {tessellation: {start:number,end:number}[]|null, contours: {start:number,end:number}[]|null}|null,
 *   frameSize: {width:number, height:number},
 *   mirrored?: boolean,
 *   className?: string,
 * }} props
 */
export default function MotionWireframeOverlay({
  frame,
  meshEdges,
  frameSize,
  mirrored = false,
  className = '',
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    const width = parent?.clientWidth || canvas.clientWidth || 96;
    const height = parent?.clientHeight || canvas.clientHeight || 96;
    const ratio = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
    }
    const context = canvas.getContext('2d');
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);

    const face = frame?.face ?? null;
    const body = frame?.body ?? null;
    if (!face && !body) return;

    const { scale, offsetX, offsetY } = coverTransform(frameSize, { width, height });
    const frameWidth = frameSize?.width || width;
    const toX = (x) => {
      const drawn = offsetX + x * frameWidth * scale;
      return mirrored ? width - drawn : drawn;
    };
    const toY = (y) => offsetY + y * (frameSize?.height || height) * scale;

    if (face) {
      // The full tessellation at tile sizes that can show it; the contours
      // (eyes, brows, lips, oval, irises) when the tile is a thumbnail.
      const dense = width >= MOTION_MESH_MIN_WIDTH_PX && meshEdges?.tessellation;
      const edges = dense ? meshEdges.tessellation : meshEdges?.contours;
      if (edges) {
        const path = new Path2D();
        for (const edge of edges) {
          const a = edge.start * 2;
          const b = edge.end * 2;
          path.moveTo(toX(face[a]), toY(face[a + 1]));
          path.lineTo(toX(face[b]), toY(face[b + 1]));
        }
        context.lineWidth = dense ? 0.5 : 1;
        context.strokeStyle = dense ? MESH_STROKE : CONTOUR_STROKE;
        context.stroke(path);
      }
      if (dense && meshEdges?.contours) {
        // The features, brighter, over the mesh, so a face reads as a face.
        const path = new Path2D();
        for (const edge of meshEdges.contours) {
          const a = edge.start * 2;
          const b = edge.end * 2;
          path.moveTo(toX(face[a]), toY(face[a + 1]));
          path.lineTo(toX(face[b]), toY(face[b + 1]));
        }
        context.lineWidth = 1;
        context.strokeStyle = CONTOUR_STROKE;
        context.stroke(path);
      }
      if (!edges) {
        // No edge list yet (the module is still loading): show the vertices.
        context.fillStyle = CONTOUR_STROKE;
        for (let index = 0; index < face.length; index += 2) {
          context.fillRect(toX(face[index]) - 0.5, toY(face[index + 1]) - 0.5, 1, 1);
        }
      }
    }

    if (body) {
      const seen = (index) => body[index * 3 + 2] >= VISIBILITY_FLOOR;
      const path = new Path2D();
      for (const [a, b] of BODY_OVERLAY_EDGES) {
        if (!seen(a) || !seen(b)) continue;
        path.moveTo(toX(body[a * 3]), toY(body[a * 3 + 1]));
        path.lineTo(toX(body[b * 3]), toY(body[b * 3 + 1]));
      }
      context.lineWidth = 1.5;
      context.strokeStyle = SKELETON_STROKE;
      context.stroke(path);
      for (let index = 0; index < body.length / 3; index += 1) {
        if (!seen(index)) continue;
        context.beginPath();
        context.arc(toX(body[index * 3]), toY(body[index * 3 + 1]), 2.5, 0, Math.PI * 2);
        context.fillStyle = JOINT_FILL;
        context.fill();
        context.lineWidth = 1;
        context.strokeStyle = 'rgba(255,255,255,0.85)';
        context.stroke();
      }
    }
  }, [frame, meshEdges, frameSize, mirrored]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 w-full h-full ${className}`.trim()}
    />
  );
}
