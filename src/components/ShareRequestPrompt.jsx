// src/components/ShareRequestPrompt.jsx
import React from 'react';
import { Monitor, X } from 'lucide-react';
import { useMedia } from '../context/MediaContext';
import { useAuth } from '../context/AuthContext';
import { resolveAssistantId } from './utils';

/**
 * The one press that lets the avatar look at the screen, when it asked.
 *
 * The avatar can open the camera by itself, but never a screen capture: every
 * browser requires a real gesture for `getDisplayMedia` and keeps no standing
 * grant for it. So when the avatar needs the screen and cannot see it, it
 * asks, and this is what the person presses. Pressing it is the gesture, which
 * is why the picker opens from here and not from the reply.
 *
 * What it starts is a look, not a watch: the capture runs unwatched, the
 * avatar takes one frame for the question it asked, and nothing is
 * snapshotted on a timer. The person can turn it into an ordinary shared
 * screen from the share controls if they want to.
 */
const ShareRequestPrompt = () => {
  const { pendingShareRequest, acceptShareRequest, dismissShareRequest } =
    useMedia();
  const { activeAvatar } = useAuth();

  if (!pendingShareRequest) return null;
  // An offer belongs to the conversation it was made in.
  if (pendingShareRequest.assistantId !== resolveAssistantId(activeAvatar)) {
    return null;
  }

  return (
    <div className="mx-auto mb-2 flex w-full max-w-3xl flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-black/60 px-4 py-3 backdrop-blur-lg">
      <Monitor size={18} className="shrink-0 text-white/60" />
      <p className="min-w-0 flex-1 text-sm text-white/70">
        {pendingShareRequest.reason
          ? `${activeAvatar?.name ?? 'Your avatar'} asked to see your screen: ${pendingShareRequest.reason}`
          : `${activeAvatar?.name ?? 'Your avatar'} asked to see your screen.`}
      </p>
      <button
        type="button"
        onClick={acceptShareRequest}
        className="rounded-lg bg-white/10 px-3 py-1.5 text-sm font-medium text-white/90 transition-colors hover:bg-white/20"
      >
        Let it look
      </button>
      <button
        type="button"
        onClick={dismissShareRequest}
        aria-label="Dismiss"
        className="rounded-lg p-1.5 text-white/40 transition-colors hover:text-white/70"
      >
        <X size={16} />
      </button>
    </div>
  );
};

export default ShareRequestPrompt;
