// src/components/showVoiceReadyToast.jsx
//
// The avatar now has a voice audio model. Clicking the notice opens that
// avatar's voice chat; Close dismisses it. A plain toast would dismiss on
// press (see main.jsx) and never take the reader where they need to go.

import React from 'react';
import { toast } from 'react-hot-toast';
import { AudioLines } from 'lucide-react';

import { openVoiceChat } from '../services/voiceModePreference';

function voiceReadyToastId(assistantId) {
  return `voice-ready:${assistantId || 'avatar'}`;
}

/**
 * Show a two-pane toast: left opens voice chat, right dismisses.
 *
 * @param {Object} parameters
 * @param {string} parameters.assistantId The avatar whose voice chat to open.
 * @param {string} [parameters.avatarName] For the sentence.
 * @param {string} [parameters.detail] Extra line (what was just added).
 */
export function showVoiceReadyToast({ assistantId, avatarName, detail }) {
  const toastId = voiceReadyToastId(assistantId);
  const who = avatarName ?? 'the avatar';
  const detailText = typeof detail === 'string' ? detail.trim() : '';

  const openChat = () => {
    toast.dismiss(toastId);
    openVoiceChat(assistantId);
  };

  toast.custom(
    (voiceToast) => (
      <div
        className={`${
          voiceToast.visible
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 -translate-y-2'
        } transition-all duration-200 max-w-md w-full flex pointer-events-auto rounded-lg shadow-lg backdrop-blur-lg bg-[rgba(0,0,0,0.92)] ring-1 ring-white/15`}
      >
        <div
          role="button"
          tabIndex={0}
          onClick={openChat}
          onKeyDown={(keyboardEvent) => {
            if (keyboardEvent.key === 'Enter' || keyboardEvent.key === ' ') {
              keyboardEvent.preventDefault();
              openChat();
            }
          }}
          className="group flex-1 w-0 p-4 cursor-pointer hover:bg-white/5 rounded-l-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
        >
          <div className="flex items-start gap-3">
            <AudioLines
              className="w-5 h-5 text-amber-300 shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <div className="min-w-0">
              <p className="text-sm font-medium text-neutral-100">
                Voice model ready
              </p>
              <p className="mt-1 text-sm text-white/60">
                {detailText ? `${detailText} ` : ''}
                {who} can speak. Open{' '}
                <span className="font-semibold text-neutral-300 underline underline-offset-2 group-hover:text-neutral-100">
                  voice chat
                </span>
                .
              </p>
            </div>
          </div>
        </div>
        <div className="flex border-l border-white/10">
          <button
            type="button"
            onClick={() => toast.dismiss(voiceToast.id)}
            className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-amber-300 hover:text-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
          >
            Close
          </button>
        </div>
      </div>
    ),
    { id: toastId, duration: Infinity }
  );
}
