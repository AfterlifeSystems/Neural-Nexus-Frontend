import React, { useEffect, useRef } from 'react';
import { NEURAL_NEXUS_API_BASE_URL } from '../services/neuralNexusApiClient';
import { apiOriginOf } from '../services/connectionOauthPopup';

/**
 * Fullscreen takeover of the avatar's hosted computer.
 *
 * Sticky banner stays until the owner presses I'm done, continue. The remote
 * page (including two-factor) is the vendor's own page. Neural Nexus never
 * intercepts a code.
 */
const AgentComputerTakeover = ({ card, onDone, onSkip }) => {
  const canvasRef = useRef(null);
  const socketRef = useRef(null);
  const task =
    card?.task ||
    'Sign in on the vendor page (including any two-factor step), then hand back';
  const sessionId = card?.session_id || card?.login_id;
  const token = card?.view_token;
  const streamPath = card?.stream_path || `/computer/${sessionId}/stream`;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !token || !sessionId) return undefined;
    const drawing = canvas.getContext('2d');
    let frameWidth = 1280;
    let frameHeight = 800;
    const origin = apiOriginOf(NEURAL_NEXUS_API_BASE_URL);
    let streamHost = '';
    try {
      streamHost = new URL(origin || window.location.origin).host;
    } catch {
      streamHost = window.location.host;
    }
    const socketProtocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
    const socket = new WebSocket(
      `${socketProtocol}${streamHost}${streamPath}?t=${encodeURIComponent(token)}`
    );
    socketRef.current = socket;

    const send = (message) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(message));
      }
    };

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type !== 'frame' || !payload.data) return;
        const image = new Image();
        image.onload = () => {
          frameWidth = payload.width || image.width;
          frameHeight = payload.height || image.height;
          canvas.width = frameWidth;
          canvas.height = frameHeight;
          drawing.drawImage(image, 0, 0);
        };
        image.src = `data:image/jpeg;base64,${payload.data}`;
      } catch {
        // A bad frame must not tear down the takeover.
      }
    };

    const point = (mouseEvent) => {
      const box = canvas.getBoundingClientRect();
      const scaleX = frameWidth / box.width;
      const scaleY = frameHeight / box.height;
      return {
        x: (mouseEvent.clientX - box.left) * scaleX,
        y: (mouseEvent.clientY - box.top) * scaleY,
      };
    };

    const onMouse = (mouseEvent, action) => {
      mouseEvent.preventDefault();
      const { x, y } = point(mouseEvent);
      send({
        type: 'mouse',
        action,
        x,
        y,
        button: mouseEvent.button === 2 ? 'right' : 'left',
      });
    };
    const onWheel = (wheelEvent) => {
      wheelEvent.preventDefault();
      send({ type: 'wheel', deltaX: wheelEvent.deltaX, deltaY: wheelEvent.deltaY });
    };
    const onKey = (keyEvent, action) => {
      keyEvent.preventDefault();
      send({ type: 'key', action, key: keyEvent.key });
    };

    canvas.addEventListener('mousemove', (event) => onMouse(event, 'move'));
    canvas.addEventListener('mousedown', (event) => onMouse(event, 'down'));
    canvas.addEventListener('mouseup', (event) => onMouse(event, 'up'));
    canvas.addEventListener('wheel', onWheel, { passive: false });
    const onKeyDown = (event) => onKey(event, 'down');
    const onKeyUp = (event) => onKey(event, 'up');
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      try {
        socket.close();
      } catch {
        // The socket may already be closed.
      }
    };
  }, [sessionId, streamPath, token]);

  return (
    <div className="fixed inset-0 z-[80] bg-black flex flex-col" data-agent-computer-takeover>
      <div className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 bg-[#141418] border-b border-white/10">
        <p className="min-w-0 flex-grow text-neutral-200 text-sm whitespace-normal break-words">
          {task}
        </p>
        <button
          type="button"
          onClick={onSkip}
          className="shrink-0 px-3 py-1.5 rounded-lg text-white/60 hover:text-white/90 text-sm"
        >
          Skip this step
        </button>
        <button
          type="button"
          onClick={onDone}
          className="shrink-0 px-4 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-black text-sm font-medium"
        >
          I&apos;m done, continue
        </button>
      </div>
      <div className="flex-grow flex items-center justify-center bg-black overflow-hidden">
        <canvas
          ref={canvasRef}
          tabIndex={0}
          width={1280}
          height={800}
          className="max-w-full max-h-full outline-none cursor-default"
        />
      </div>
    </div>
  );
};

export default AgentComputerTakeover;
